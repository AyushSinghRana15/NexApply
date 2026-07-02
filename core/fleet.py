import asyncio
import json
import os
import time
from datetime import datetime, timezone

from core.autonomous import AutonomousAgent
from core.logger import Logger
from core.models import ApplicationPayload, TailoredResult
from core.queue import JobQueue

LOGS_FILE = "logs/applications.jsonl"


class ApplyFleet:

    def __init__(self, config: dict, input_queue: JobQueue, output_queue: JobQueue, save_cb=None):
        self.cfg = config
        self.input_queue = input_queue
        self.output_queue = output_queue
        self.log = Logger()
        self._save_cb = save_cb
        self._fleet_cfg = config.get("fleet", {})
        self._semaphore = asyncio.Semaphore(
            self._fleet_cfg.get("max_concurrent_browsers", 3)
        )
        self._pending = 0
        self._applied = 0
        self._failed = 0
        self._manual = 0
        self._autonomy = config.get("autonomy", {})
        self._mode = self._autonomy.get("mode", "full")
        self._safety = config.get("safety", {})
        self._consecutive_failures = 0
        os.makedirs("logs/screenshots", exist_ok=True)

        if self._mode == "full":
            self.autonomous = AutonomousAgent(config)

    async def start(self):
        mode_label = {"full": "FULL", "supervised": "SUPERVISED", "manual": "MANUAL"}
        self.log.fleet_start(f"ApplyFleet started — mode: {mode_label.get(self._mode, self._mode.upper())}")

        platforms = ["indeed", "naukri", "internshala"]
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

    async def _route_job(self, result: TailoredResult):
        # Check autonomy mode first
        if self._mode == "manual":
            self.log.skip(result.platform, f"{result.title} @ {result.company}", "manual mode — no auto-apply")
            self._log_application_raw(result, "SKIPPED")
            return

        if self._mode == "full":
            decision, reason = await self.autonomous.decide(result)
            if decision == "SKIP":
                self.log.autonomous_skip(result.title, result.company, reason)
                self._log_application_raw(result, "SKIPPED")
                return

            self.log.autonomous_approve(result.title, result.company, reason)

            if self._mode == "full":
                max_fails = self._safety.get("max_failures_before_pause", 5)
                if self.autonomous.consecutive_failures >= max_fails:
                    self.log.warn(f"{max_fails} consecutive failures — pausing 10 minutes")
                    await asyncio.sleep(600)
                    self.autonomous.consecutive_failures = 0

        async with self._semaphore:
            platform = result.platform

            cookie_path = f"cookies/{platform}_cookies.json"
            if not os.path.exists(cookie_path):
                self.log.warn(f"{platform.capitalize()} cookies missing — skipping")
                if self._mode == "full":
                    self.autonomous.record_failure()
                return

            self.log.applying(f"{result.title} @ {result.company}", platform)

            worker_map = {
                "indeed": "IndeedWorker",
                "naukri": "NaukriWorker",
                "internshala": "InternshalaWorker",
            }
            mod_map = {
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

            auto_submit = self._mode == "full"

            try:
                payload = await worker.apply_with_timeout(result, auto_submit=auto_submit)
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
                if self._mode == "full":
                    self.autonomous.record_failure()

            if payload is None:
                if self._mode == "full":
                    self.autonomous.record_failure()
                return

            if auto_submit:
                if payload.status == ApplicationPayload.STATUS_APPLIED:
                    self._applied += 1
                    self._consecutive_failures = 0
                    self.autonomous.record_apply(result)
                    self.log.autonomous_stats(
                        self.autonomous.daily_app_count,
                        self.autonomous.get_daily_limit(),
                        self.autonomous.platform_count,
                        result.match_score,
                    )
                    cooldown = self._autonomy.get("cooldown_between_apps", 45)
                    if cooldown > 0:
                        self.log.autonomous_cooldown(cooldown)
                else:
                    self._failed += 1
                    self._consecutive_failures += 1
                    if self._mode == "full":
                        self.autonomous.record_failure()

                self._log_application(payload)

                try:
                    await worker.close()
                except Exception:
                    pass
                return

            if payload.status == ApplicationPayload.STATUS_PENDING_REVIEW:
                self._pending += 1
                payload.approval_event = asyncio.Event()
                await self.output_queue.enqueue(payload)

                try:
                    await asyncio.wait_for(payload.approval_event.wait(), timeout=600)
                except asyncio.TimeoutError:
                    self.log.warn(f"GuardAgent never responded for {payload.job_id} — safety timeout")

                decision = payload.decision or "TIMEOUT"
                self._pending -= 1
                self.log.detail(f"Decision for {payload.job_id}: {decision}")

                if decision == "APPROVE":
                    submitted = await worker.submit(platform)
                    if submitted:
                        payload.status = ApplicationPayload.STATUS_APPLIED
                        self._applied += 1
                        self._consecutive_failures = 0
                        self.log.guard_applied(payload.title, payload.company)
                    else:
                        payload.status = ApplicationPayload.STATUS_SUBMIT_FAILED
                        self._failed += 1
                        self._consecutive_failures += 1
                        self.log.guard_submit_failed(payload.title, payload.company)
                elif decision == "EDIT":
                    payload.status = ApplicationPayload.STATUS_APPLIED
                    self._applied += 1
                    self._consecutive_failures = 0
                    self.log.detail(f"EDIT — \"{payload.title} @ {payload.company}\" — manual completion")
                else:
                    payload.status = ApplicationPayload.STATUS_SKIPPED
                    self.log.guard_skipped(payload.title, payload.company, decision.lower())

                await worker.close()
            else:
                if payload.status in (
                    ApplicationPayload.STATUS_FAILED,
                    ApplicationPayload.STATUS_UNKNOWN_FORM,
                ):
                    self._failed += 1
                    self._consecutive_failures += 1
                elif payload.status == ApplicationPayload.STATUS_MANUAL_REQUIRED:
                    self._manual += 1
                await worker.close()

            self._log_application(payload)

    def _log_application(self, payload: ApplicationPayload):
        os.makedirs(os.path.dirname(LOGS_FILE), exist_ok=True)
        with open(LOGS_FILE, "a") as f:
            f.write(payload.to_jsonl() + "\n")
        if self._save_cb:
            self._save_cb(payload)

    def _log_application_raw(self, result: TailoredResult, decision: str):
        entry = {
            "job_id": result.job_id,
            "platform": result.platform,
            "title": result.title,
            "company": result.company,
            "apply_url": result.apply_url,
            "match_score": result.match_score,
            "keywords_injected": result.keywords_injected,
            "resume_variant": result.resume_variant,
            "status": decision,
            "decision": decision,
            "filled_at": datetime.now(timezone.utc).isoformat(),
        }
        os.makedirs(os.path.dirname(LOGS_FILE), exist_ok=True)
        with open(LOGS_FILE, "a") as f:
            f.write(json.dumps(entry, default=str) + "\n")
        if self._save_cb:
            payload = ApplicationPayload(
                job_id=result.job_id,
                platform=result.platform,
                title=result.title,
                company=result.company,
                apply_url=result.apply_url,
                match_score=result.match_score,
                keywords_injected=result.keywords_injected,
                resume_variant=result.resume_variant,
                status=decision,
            )
            self._save_cb(payload, decision)

    async def _heartbeat(self):
        while True:
            await asyncio.sleep(60)
            self.log.fleet_heartbeat(self._pending, self._failed, self._manual)
