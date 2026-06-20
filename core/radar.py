import asyncio
import hashlib
from datetime import datetime, timezone
from typing import Optional, Set

import feedparser

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
        if await self._is_seen(apply_url):
            self.log.skip(platform, title, "already seen")
            self._skipped_count += 1
            return

        event = JobEvent(
            platform=platform,
            title=title,
            company=company,
            location=location,
            description=description[:500],
            apply_url=apply_url,
            posted_at=posted_at,
        )
        await self._mark_seen(apply_url)
        self.log.new_job(platform, f"{title} @ {company}", self._relative_time(None))
        self.log.queued(event.job_id, platform)
        await self.queue.enqueue(event)

    async def _heartbeat(self):
        while True:
            await asyncio.sleep(60)
            seen = len(self._seen)
            self.log.heartbeat(self.queue.qsize(), seen, self._skipped_count)

    async def start(self):
        """Launch all platform watchers + heartbeat."""
        self.log.start("RadarAgent started — watching 4 platforms")
        await self._init_redis()

        platforms = self.cfg.get("platforms", {})
        tasks = []
        delay = 5
        order = ["linkedin", "indeed", "naukri", "internshala"]
        watchers = {
            "linkedin": self._watch_linkedin,
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

    async def _watch_linkedin(self):
        self.log.feed("LinkedIn feed connected — polling every 30s")
        while True:
            try:
                url = "https://www.linkedin.com/jobs/search/?keywords=python&f_TPR=r3600"
                feed = feedparser.parse(url)
                if not feed.entries:
                    self.log.warn("LinkedIn feed returned no entries — may require auth")
                for entry in feed.entries:
                    title = entry.get("title", "Unknown Title")
                    company = entry.get("company", "Unknown Company")
                    location = entry.get("location", "Remote")
                    desc = entry.get("summary", "")
                    link = entry.get("link", "")
                    posted = entry.get("published", "")
                    await self._emit_job("linkedin", title, company, location, desc, link, posted)
            except Exception as e:
                self.log.error(f"LinkedIn watcher error: {e}")
            await asyncio.sleep(self._interval)

    async def _watch_indeed(self):
        self.log.feed("Indeed feed connected — polling every 30s")
        while True:
            try:
                url = "https://www.indeed.com/rss?q=python+developer&l=remote"
                feed = feedparser.parse(url)
                for entry in feed.entries:
                    title = entry.get("title", "Unknown Title")
                    company = entry.get("source", {}).get("title", "Unknown Company") if hasattr(entry, "source") else "Unknown Company"
                    summary = entry.get("summary", "")
                    location = "Remote"
                    desc = summary
                    link = entry.get("link", "")
                    posted = entry.get("published", "")
                    await self._emit_job("indeed", title, company, location, desc, link, posted)
            except Exception as e:
                self.log.error(f"Indeed watcher error: {e}")
            await asyncio.sleep(self._interval)

    async def _watch_naukri(self):
        self.log.scraper("Naukri scraper initialized")
        if not PLAYWRIGHT_AVAILABLE:
            self.log.warn("playwright not installed — Naukri scraper disabled")
            return
        while True:
            try:
                async with async_playwright() as pw:
                    browser = await pw.chromium.launch(headless=True)
                    page = await browser.new_page()
                    try:
                        await page.goto("https://www.naukri.com/python-developer-jobs", timeout=15000)
                        await page.wait_for_timeout(3000)
                        if "login" in page.url.lower() or "signin" in page.url.lower():
                            self.log.warn("Naukri login wall detected — skipping scrape")
                            await browser.close()
                            await asyncio.sleep(self._interval)
                            continue
                        cards = await page.query_selector_all(".jobTuple, .info, .job-card")
                        self.log.detail(f"Naukri: found {len(cards)} job cards")
                        for card in cards[:10]:
                            try:
                                title_el = await card.query_selector("a.title, .title a")
                                title = await title_el.inner_text() if title_el else "Unknown"
                                company_el = await card.query_selector("a.subTitle, .subTitle")
                                company = await company_el.inner_text() if company_el else "Unknown"
                                link_el = await card.query_selector("a.title")
                                link = await link_el.get_attribute("href") if link_el else ""
                                if link and not link.startswith("http"):
                                    link = "https://www.naukri.com" + link
                                desc = f"{title} at {company}"
                                await self._emit_job("naukri", title.strip(), company.strip(),
                                                     "India", desc, link, "")
                            except Exception:
                                continue
                    except Exception as e:
                        self.log.warn(f"Naukri scrape failed: {e}")
                    await browser.close()
            except Exception as e:
                self.log.error(f"Naukri watcher error: {e}")
            await asyncio.sleep(self._interval)

    async def _watch_internshala(self):
        self.log.scraper("Internshala scraper initialized")
        if not PLAYWRIGHT_AVAILABLE:
            self.log.warn("playwright not installed — Internshala scraper disabled")
            return
        while True:
            try:
                async with async_playwright() as pw:
                    browser = await pw.chromium.launch(headless=True)
                    page = await browser.new_page()
                    try:
                        await page.goto("https://internshala.com/internships/python%20internship", timeout=15000)
                        await page.wait_for_timeout(3000)
                        if "login" in page.url.lower() or "register" in page.url.lower():
                            self.log.warn("Internshala login wall detected — skipping scrape")
                            await browser.close()
                            await asyncio.sleep(self._interval)
                            continue
                        cards = await page.query_selector_all(".internship_meta, .individual_internship, .card")
                        self.log.detail(f"Internshala: found {len(cards)} internship cards")
                        for card in cards[:10]:
                            try:
                                title_el = await card.query_selector(".title a, h3 a, .heading")
                                title = await title_el.inner_text() if title_el else "Unknown"
                                company_el = await card.query_selector(".company_name, .company")
                                company = await company_el.inner_text() if company_el else "Unknown"
                                link_el = await card.query_selector("a")
                                link = await link_el.get_attribute("href") if link_el else ""
                                if link and not link.startswith("http"):
                                    link = "https://internshala.com" + link
                                desc = f"{title} at {company}"
                                await self._emit_job("internshala", title.strip(), company.strip(),
                                                     "Remote", desc, link, "")
                            except Exception:
                                continue
                    except Exception as e:
                        self.log.warn(f"Internshala scrape failed: {e}")
                    await browser.close()
            except Exception as e:
                self.log.error(f"Internshala watcher error: {e}")
            await asyncio.sleep(self._interval)
