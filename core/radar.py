import asyncio
import hashlib
import json
import os
import re
from datetime import datetime, timezone
from typing import Optional, Set

from core.logger import Logger
from core.models import JobEvent
from core.queue import JobQueue

REDIS_AVAILABLE = False
try:
    import redis.asyncio as redis
    REDIS_AVAILABLE = True
except ImportError:
    pass

PLAYWRIGHT_AVAILABLE = False
try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    pass

AIOHTTP_AVAILABLE = False
try:
    import aiohttp
    AIOHTTP_AVAILABLE = True
except ImportError:
    pass

ERROR_LOG = "logs/errors.log"


def _log_error(platform: str, url: str, selector: str, message: str, detail: str = ""):
    os.makedirs(os.path.dirname(ERROR_LOG), exist_ok=True)
    try:
        entry = {
            "type": "scraper_error",
            "platform": platform,
            "url": url,
            "selector": selector,
            "error": message,
            "detail": detail,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        with open(ERROR_LOG, "a") as f:
            f.write(json.dumps(entry, default=str) + "\n")
    except Exception:
        pass


class RadarAgent:

    def __init__(self, config: dict, queue: JobQueue):
        self.cfg = config
        self.queue = queue
        self.log = Logger()
        self._interval = config.get("polling_interval_seconds", 30)
        self._seen: Set[str] = set()
        self._skipped_count = 0
        self._redis = None
        self._redis_available = False

    async def _init_redis(self):
        if not REDIS_AVAILABLE:
            self.log.warn("redis not installed — falling back to in-memory dedup")
            return
        try:
            self._redis = redis.from_url("redis://localhost:6379", decode_responses=True)
            await self._redis.ping()
            self._redis_available = True
            self.log.detail("Redis connected — using Redis SET for dedup")
        except Exception:
            self.log.warn("Redis not running — falling back to in-memory dedup")

    def _dedup_key(self, url: str) -> str:
        return f"nexapply:seen:{hashlib.md5(url.encode()).hexdigest()}"

    async def _is_seen(self, url: str) -> bool:
        key = self._dedup_key(url)
        if self._redis_available:
            return bool(await self._redis.sismember("nexapply:seen_urls", key))
        return key in self._seen

    async def _mark_seen(self, url: str):
        key = self._dedup_key(url)
        if self._redis_available:
            await self._redis.sadd("nexapply:seen_urls", key)
        self._seen.add(key)

    def _seen_count(self) -> int:
        if self._redis_available:
            return -1
        return len(self._seen)

    def _relative_time(self, published_parsed) -> str:
        if not published_parsed:
            return "unknown"
        now = datetime.now(timezone.utc)
        then = datetime(*published_parsed[:6], tzinfo=timezone.utc)
        delta = now - then
        mins = int(delta.total_seconds() / 60)
        if mins < 1:
            return "just now"
        if mins < 60:
            return f"{mins} min ago"
        hours = mins // 60
        return f"{hours}h ago"

    async def _emit_job(self, platform: str, title: str, company: str, location: str,
                        description: str, apply_url: str, posted_at: str):
        if not title or title.strip() == "Unknown":
            return
        if not company or company.strip() == "Unknown":
            company = platform.capitalize()
        if await self._is_seen(apply_url):
            self.log.skip(platform, title, "already seen")
            self._skipped_count += 1
            return

        event = JobEvent(
            platform=platform,
            title=title.strip(),
            company=company.strip(),
            location=location.strip() or "Remote",
            description=description[:500],
            apply_url=apply_url,
            posted_at=posted_at,
        )
        await self._mark_seen(apply_url)
        self.log.new_job(platform, f"{event.title} @ {event.company}", self._relative_time(None))
        self.log.queued(event.job_id, platform)
        await self.queue.enqueue(event)

    async def _heartbeat(self):
        while True:
            await asyncio.sleep(60)
            seen = len(self._seen)
            self.log.heartbeat(self.queue.qsize(), seen, self._skipped_count)

    async def start(self):
        self.log.start("RadarAgent started — watching platforms")
        await self._init_redis()

        platforms = self.cfg.get("platforms", {})
        tasks = []
        delay = 5
        order = ["indeed", "naukri", "internshala"]
        watchers = {
            "indeed": self._watch_indeed,
            "naukri": self._watch_naukri,
            "internshala": self._watch_internshala,
        }

        for i, name in enumerate(order):
            if platforms.get(name, True):
                fn = watchers[name]

                async def _wrapped(fn=fn, idx=i):
                    await asyncio.sleep(idx * delay)
                    await fn()

                tasks.append(asyncio.create_task(_wrapped()))

        tasks.append(asyncio.create_task(self._heartbeat()))

        await asyncio.gather(*tasks, return_exceptions=True)

    def _get_search_queries(self, platform: str, default: list) -> list:
        queries = self.cfg.get("search_queries", {}).get(platform, default)
        if isinstance(queries, str):
            queries = [queries]
        return queries if queries else default

    async def _scrape_with_playwright(self, url: str, platform: str, card_selector: str,
                                       title_selectors: list, company_selectors: list,
                                       link_selectors: list, location_selectors: list,
                                       max_jobs: int = 10) -> list:
        if not PLAYWRIGHT_AVAILABLE:
            self.log.warn(f"playwright not installed — {platform} scraper disabled")
            return []

        results = []
        try:
            async with async_playwright() as pw:
                browser = await pw.chromium.launch(headless=True)
                context = await browser.new_context(
                    user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    viewport={"width": 1280, "height": 900},
                )
                page = await context.new_page()
                page.set_default_timeout(20000)
                try:
                    await page.goto(url, timeout=20000, wait_until="domcontentloaded")
                    await page.wait_for_timeout(4000)

                    if "login" in page.url.lower() or "signin" in page.url.lower():
                        self.log.warn(f"{platform} login wall detected — skipping scrape")
                        await browser.close()
                        return results

                    cards = await page.query_selector_all(card_selector)
                    self.log.detail(f"{platform}: found {len(cards)} job cards via '{card_selector}'")
                    _log_error(platform, url, card_selector,
                               f"found {len(cards)} cards", "")

                    for card in cards[:max_jobs]:
                        try:
                            title = await self._extract_text(card, title_selectors)
                            company = await self._extract_text(card, company_selectors)
                            link = await self._extract_href(card, link_selectors)
                            location = await self._extract_text(card, location_selectors)

                            if title and link:
                                if link and not link.startswith("http"):
                                    domain = platform
                                    link = f"https://www.{domain}.com" + link
                                results.append({
                                    "title": title.strip(),
                                    "company": company.strip() if company else platform.capitalize(),
                                    "location": location.strip() if location else "Remote",
                                    "apply_url": link,
                                    "description": f"{title} at {company}",
                                })
                        except Exception as e:
                            _log_error(platform, url, card_selector,
                                       f"card parse error: {e}", "")
                            continue

                except Exception as e:
                    self.log.warn(f"{platform} scrape failed: {e}")
                    _log_error(platform, url, card_selector,
                               f"scrape failed: {e}", str(e)[:200])
                finally:
                    await browser.close()
        except Exception as e:
            self.log.error(f"{platform} watcher error: {e}")
            _log_error(platform, url, card_selector,
                       f"watcher error: {e}", str(e)[:200])

        return results

    async def _extract_text(self, card, selectors: list) -> str:
        for sel in selectors:
            try:
                el = await card.query_selector(sel)
                if el:
                    text = await el.inner_text()
                    if text and text.strip():
                        return text.strip()
            except Exception:
                continue
        return ""

    async def _extract_href(self, card, selectors: list) -> str:
        for sel in selectors:
            try:
                el = await card.query_selector(sel)
                if el:
                    href = await el.get_attribute("href")
                    if href:
                        return href.strip()
            except Exception:
                continue
        return ""

    async def _watch_indeed(self):
        queries = self._get_search_queries("indeed", ["software engineer remote"])
        self.log.feed(f"Indeed scraper started — {len(queries)} search queries")

        selectors = {
            "card": ".card, .jobCard, .job_seen_beacon, .result, .job-row, div[data-jk], .tapItem",
            "title": ["a.jobtitle", "a[id*='jobtitle']", "h2.jobTitle a", "a[data-jk]", "span[title]"],
            "company": ["span.companyName", ".company", "[data-testid*='company']", ".company_location"],
            "location": [".companyLocation", "div.location", "[data-testid*='location']"],
            "link": ["a.jobtitle", "a[id*='jobtitle']", "h2.jobTitle a", "a[data-jk]"],
        }

        while True:
            try:
                for query in queries:
                    search_q = query.replace(" ", "+")
                    url = f"https://in.indeed.com/jobs?q={search_q}&l=remote"

                    jobs = await self._scrape_with_playwright(
                        url, "indeed", selectors["card"],
                        selectors["title"], selectors["company"],
                        selectors["link"], selectors["location"],
                    )
                    for job in jobs:
                        await self._emit_job(
                            "indeed", job["title"], job["company"],
                            job["location"], job["description"],
                            job["apply_url"], "",
                        )

                    await asyncio.sleep(5)

            except Exception as e:
                self.log.error(f"Indeed watcher error: {e}")
                _log_error("indeed", "", "", f"watcher error: {e}", str(e)[:200])
            await asyncio.sleep(self._interval)

    async def _watch_naukri(self):
        if not PLAYWRIGHT_AVAILABLE:
            self.log.warn("playwright not installed — Naukri scraper disabled")
            return

        queries = self._get_search_queries("naukri", ["python-developer-jobs"])
        self.log.feed(f"Naukri scraper started — {len(queries)} search queries")

        selectors = {
            "card": ".srp-jobtuple-wrapper, .cust-job-tuple, .jobTuple, "
                    "div[class*='jobTuple'], .job-card, article.job, "
                    ".job-listing, li[class*='job'], .widget",
            "title": ["a.title", "a[class*='title']", "a[class*='jobTitle']"],
            "company": ["a.subTitle", "a[class*='subTitle']", ".company-name", "span[class*='company']"],
            "link": ["a.title", "a[class*='title']"],
            "location": [],
        }

        while True:
            try:
                for query in queries:
                    url = f"https://www.naukri.com/{query}"

                    jobs = await self._scrape_with_playwright(
                        url, "naukri", selectors["card"],
                        selectors["title"], selectors["company"],
                        selectors["link"], selectors["location"],
                    )
                    for job in jobs:
                        await self._emit_job(
                            "naukri", job["title"], job["company"],
                            job["location"], job["description"],
                            job["apply_url"], "",
                        )

                    await asyncio.sleep(5)

            except Exception as e:
                self.log.error(f"Naukri watcher error: {e}")
                _log_error("naukri", "", "", f"watcher error: {e}", str(e)[:200])
            await asyncio.sleep(self._interval)

    async def _watch_internshala(self):
        if not PLAYWRIGHT_AVAILABLE:
            self.log.warn("playwright not installed — Internshala scraper disabled")
            return

        queries = self._get_search_queries("internshala", ["python internship"])
        self.log.feed(f"Internshala scraper started — {len(queries)} search queries")

        selectors = {
            "card": ".individual_internship, div[class*='internship'], "
                    ".internship-card, .card, li[class*='internship']",
            "title": ["h2.job-internship-name a.job-title-href", "a[class*='title']",
                      "a.job-title-href", "h2 a"],
            "company": [".internship_logo img", "a[class*='company']",
                        ".company-name", ".company"],
            "location": [".locations", ".row-1-item.locations",
                         "a[class*='location']", ".location"],
            "link": ["h2.job-internship-name a.job-title-href",
                     "a.job-title-href", "a[class*='title']"],
        }

        while True:
            try:
                for query in queries:
                    search_q = query.replace(" ", "%20")
                    url = f"https://internshala.com/internships/{search_q}"

                    jobs = await self._scrape_with_playwright(
                        url, "internshala", selectors["card"],
                        selectors["title"], selectors["company"],
                        selectors["link"], selectors["location"],
                    )
                    for job in jobs:
                        await self._emit_job(
                            "internshala", job["title"], job["company"],
                            job["location"], job["description"],
                            job["apply_url"], "",
                        )

                    await asyncio.sleep(5)

            except Exception as e:
                self.log.error(f"Internshala watcher error: {e}")
                _log_error("internshala", "", "", f"watcher error: {e}", str(e)[:200])
            await asyncio.sleep(self._interval)
