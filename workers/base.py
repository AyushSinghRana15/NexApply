import asyncio
import json
import os
import random
import tempfile
from io import BytesIO
from typing import Any, List, Optional

import yaml
from playwright.async_api import async_playwright, Page, BrowserContext

from core.logger import Logger
from core.models import ApplicationPayload, TailoredResult

SCREENSHOTS_DIR = "logs/screenshots"
COOKIES_DIR = "cookies"


class BaseWorker:

    def __init__(self, config: dict):
        self.cfg = config
        self.log = Logger()
        self.profile = self._load_yaml("profile.yaml")
        self.selectors = self._load_yaml("selectors.yaml")
        self._playwright = None
        self.browser = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self._fleet_cfg = config.get("fleet", {})

    def _load_yaml(self, path: str) -> dict:
        with open(path) as f:
            return yaml.safe_load(f)

    def _platform_selectors(self, platform: str) -> dict:
        return self.selectors.get(platform, {})

    def _delay(self):
        lo = self._fleet_cfg.get("human_delay_min", 0.5)
        hi = self._fleet_cfg.get("human_delay_max", 1.2)
        return random.uniform(lo, hi)

    async def launch(self):
        headless = self._fleet_cfg.get("headless", True)
        self._playwright = await async_playwright().start()
        self.browser = await self._playwright.chromium.launch(headless=headless)
        self.context = await self.browser.new_context(
            viewport={"width": 1280, "height": 900},
        )
        self.page = await self.context.new_page()
        self.page.set_default_timeout(
            self._fleet_cfg.get("page_timeout_seconds", 30) * 1000
        )

    async def load_cookies(self, platform: str):
        path = os.path.join(COOKIES_DIR, f"{platform}_cookies.json")
        if not os.path.exists(path):
            raise FileNotFoundError(f"Cookies not found: {path}")
        with open(path) as f:
            cookies = json.load(f)
        await self.context.add_cookies(cookies)
        self.log.detail(f"🍪 {len(cookies)} cookies loaded for {platform}")

    async def smart_fill(self, field_name: str, value: Any, platform: str) -> bool:
        selectors = self._platform_selectors(platform).get(field_name, [])
        for selector in selectors:
            try:
                locator = self.page.locator(selector)
                count = await locator.count()
                if count > 0:
                    await locator.first.fill(str(value))
                    await asyncio.sleep(self._delay())
                    return True
            except Exception:
                continue
        self.log.warn(f"Field not found: {field_name} — skipping")
        return False

    async def smart_click(self, field_name: str, platform: str) -> bool:
        selectors = self._platform_selectors(platform).get(field_name, [])
        for selector in selectors:
            try:
                locator = self.page.locator(selector)
                count = await locator.count()
                if count > 0:
                    await locator.first.click()
                    await asyncio.sleep(self._delay())
                    return True
            except Exception:
                continue
        return False

    async def upload_resume(self, tailored_resume: str, platform: str) -> bool:
        selectors = self._platform_selectors(platform).get("resume_upload", [])
        fd, path = tempfile.mkstemp(suffix=".txt")
        try:
            with os.fdopen(fd, "w") as f:
                f.write(tailored_resume)
            for selector in selectors:
                try:
                    locator = self.page.locator(selector)
                    count = await locator.count()
                    if count > 0:
                        await locator.first.set_input_files(path)
                        await asyncio.sleep(2)
                        return True
                except Exception:
                    continue
            return False
        finally:
            try:
                os.unlink(path)
            except OSError:
                pass

    async def take_screenshot(self, job_id: str, company: str) -> str:
        os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
        safe = company.lower().replace(" ", "_").replace("/", "_")
        filename = f"{job_id}_{safe}.png"
        filepath = os.path.join(SCREENSHOTS_DIR, filename)
        await self.page.screenshot(path=filepath, full_page=False)
        return filepath

    async def close(self):
        try:
            if self.page:
                await self.page.close()
        except Exception:
            pass
        try:
            if self.context:
                await self.context.close()
        except Exception:
            pass
        try:
            if self.browser:
                await self.browser.close()
        except Exception:
            pass
        try:
            if self._playwright:
                await self._playwright.stop()
        except Exception:
            pass

    async def apply(self, result: TailoredResult) -> Optional[ApplicationPayload]:
        raise NotImplementedError("Subclass must implement apply()")
