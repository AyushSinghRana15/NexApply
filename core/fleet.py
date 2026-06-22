import asyncio
import json
import os

from core.logger import Logger
from core.models import ApplicationPayload
from core.queue import JobQueue

LOGS_FILE = "logs/applications.jsonl"
SCREENSHOTS_DIR = "logs/screenshots"


class ApplyFleet:

    def __init__(self, config: dict, input_queue: JobQueue, output_queue: JobQueue):
        self.cfg = config
        self.input_queue = input_queue
        self.output_queue = output_queue
        self.log = Logger()
        self._fleet_cfg = config.get("fleet", {})
        self._semaphore = asyncio.Semaphore(
            self._fleet_cfg.get("max_concurrent_browsers", 3)
        )
        self._pending = 0
        self._failed = 0
        self._manual = 0
        os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

    async def start(self):
        self.log.fleet_start("ApplyFleet started — 4 workers ready")

        platforms = ["linkedin", "indeed", "naukri", "internshala"]
        for p in platforms:
            cookie_path = f"cookies/{p}_cookies.json"
            if os.path.exists(cookie_path):
                self.log.cookies_status(p, "loaded ✅")
            else:
                self.log.cookies_status(p, "not found — worker disabled")

        asyncio.create_task(self._heartbeat())

        while True:
            result = await self.input_queue.dequeue()
            if result is None:
                await asyncio.sleep(0.1)
                continue
            asyncio.create_task(self._route_job(result))

    async def _route_job(self, result):
        async with self._semaphore:
            platform = result.platform

            cookie_path = f"cookies/{platform}_cookies.json"
            if not os.path.exists(cookie_path):
                self.log.warn(f"{platform.capitalize()} cookies missing — skipping")
                return

            self.log.applying(f"{result.title} @ {result.company}", platform)

            worker_map = {
                "linkedin": "LinkedInWorker",
                "indeed": "IndeedWorker",
                "naukri": "NaukriWorker",
                "internshala": "InternshalaWorker",
            }

            mod_map = {
                "linkedin": "workers.linkedin",
                "indeed": "workers.indeed",
                "naukri": "workers.naukri",
                "internshala": "workers.internshala",
            }

            mod_name = mod_map.get(platform)
            cls_name = worker_map.get(platform)
            if not mod_name or not cls_name:
                self.log.warn(f"Unknown platform: {platform}")
                return

            import importlib
            mod = importlib.import_module(mod_name)
            cls = getattr(mod, cls_name)
            worker = cls(self.cfg)

            try:
                payload = await worker.apply(result)
            except Exception as e:
                self.log.error(f"Worker failed for {platform}: {e}")
                payload = ApplicationPayload(
                    job_id=result.job_id,
                    platform=result.platform,
                    title=result.title,
                    company=result.company,
                    apply_url=result.apply_url,
                    match_score=result.match_score,
                    keywords_injected=result.keywords_injected,
                    resume_variant=result.resume_variant,
                    status=ApplicationPayload.STATUS_FAILED,
                )

            if payload is None:
                return

            if payload.status == ApplicationPayload.STATUS_PENDING_REVIEW:
                self._pending += 1
            elif payload.status in (
                ApplicationPayload.STATUS_FAILED,
                ApplicationPayload.STATUS_UNKNOWN_FORM,
            ):
                self._failed += 1
            elif payload.status == ApplicationPayload.STATUS_MANUAL_REQUIRED:
                self._manual += 1

            self._log_application(payload)
            await self.output_queue.enqueue(payload)
            self.log.fleet_queued()

    def _log_application(self, payload: ApplicationPayload):
        os.makedirs(os.path.dirname(LOGS_FILE), exist_ok=True)
        with open(LOGS_FILE, "a") as f:
            f.write(payload.to_jsonl() + "\n")

    async def _heartbeat(self):
        while True:
            await asyncio.sleep(60)
            self.log.fleet_heartbeat(self._pending, self._failed, self._manual)
