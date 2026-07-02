import asyncio
import json
import os
from datetime import datetime, timezone
from typing import Dict, Optional

from core.logger import Logger
from core.models import ApplicationPayload
from core.queue import JobQueue

LOGS_FILE = "logs/applications.jsonl"


class WSManager:

    def __init__(self):
        self._connections: set = set()

    async def connect(self, ws):
        self._connections.add(ws)

    async def disconnect(self, ws):
        self._connections.discard(ws)

    async def broadcast(self, message: dict):
        dead = set()
        for ws in self._connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        self._connections -= dead

    @property
    def count(self) -> int:
        return len(self._connections)


class GuardAgent:

    def __init__(self, config: dict, input_queue: JobQueue, ws_manager: WSManager, save_cb=None):
        self.cfg = config
        self.input_queue = input_queue
        self.ws_manager = ws_manager
        self.log = Logger()
        self._save_cb = save_cb
        self._pending: Dict[str, ApplicationPayload] = {}
        self._guard_cfg = config.get("guard", {})
        self._review_timeout = self._guard_cfg.get("review_timeout_seconds", 300)
        self._max_pending = self._guard_cfg.get("max_pending_reviews", 3)
        self._auto_skip_below = self._guard_cfg.get("auto_skip_below_score", 60)
        self._total_approved = 0
        self._total_skipped = 0
        self._total_timeout = 0

    async def on_decision(self, job_id: str, action: str):
        payload = self._pending.pop(job_id, None)
        if not payload:
            self.log.warn(f"No pending review for {job_id}")
            return

        if action == "APPROVE":
            payload.decision = "APPROVE"
            payload.approval_event.set()
            self._total_approved += 1
            self.log.guard_approved(payload.title, payload.company)
        elif action == "SKIP":
            payload.decision = "SKIP"
            payload.approval_event.set()
            self._total_skipped += 1
            self.log.guard_skipped(payload.title, payload.company, "user skipped")
        elif action == "EDIT":
            payload.decision = "EDIT"
            payload.approval_event.set()
            self.log.detail(f"EDIT — \"{payload.title} @ {payload.company}\" — manual")

        await self.ws_manager.broadcast({
            "type": "CLEARED",
            "job_id": job_id,
        })
        self._log_decision(payload, action)

    async def start(self):
        self.log.guard_start()
        asyncio.create_task(self._heartbeat())

        while True:
            payload = await self.input_queue.dequeue()
            if payload is None:
                await asyncio.sleep(0.1)
                continue

            try:
                if payload.match_score < self._auto_skip_below:
                    self.log.skip(
                        payload.platform, payload.title,
                        f"Score {payload.match_score} < {self._auto_skip_below}"
                    )
                    payload.decision = "SKIP"
                    payload.approval_event.set()
                    self._log_decision(payload, "SKIP")
                    continue

                if len(self._pending) >= self._max_pending:
                    self.log.warn(
                        f"Max pending reviews ({self._max_pending}) — "
                        f"holding \"{payload.title}\" in queue"
                    )

                self._pending[payload.job_id] = payload
                self.log.guard_review_ready(
                    payload.title, payload.company, payload.platform, payload.match_score
                )
                self.log.guard_countdown(self._review_timeout)

                await self.ws_manager.broadcast({
                    "type": "NEW_REVIEW",
                    "payload": {
                        "job_id": payload.job_id,
                        "platform": payload.platform,
                        "title": payload.title,
                        "company": payload.company,
                        "match_score": payload.match_score,
                        "keywords": payload.keywords_injected,
                        "resume_variant": payload.resume_variant,
                        "screenshot_url": f"/screenshot/{payload.job_id}",
                        "posted_ago": "just now",
                        "filled_at": payload.filled_at,
                    },
                })

                asyncio.create_task(self._countdown_and_timeout(payload))
            except Exception as e:
                self.log.error(f"GuardAgent error processing job {payload.job_id}: {e}")
                payload.decision = "TIMEOUT"
                payload.approval_event.set()

    async def _countdown_and_timeout(self, payload: ApplicationPayload):
        remaining = self._review_timeout
        while remaining > 0:
            await asyncio.sleep(5)
            remaining -= 5
            if payload.job_id not in self._pending:
                return
            await self.ws_manager.broadcast({
                "type": "COUNTDOWN",
                "job_id": payload.job_id,
                "seconds_remaining": max(remaining, 0),
            })

        if payload.job_id in self._pending:
            self._pending.pop(payload.job_id)
            payload.decision = "TIMEOUT"
            payload.approval_event.set()
            self._total_timeout += 1
            self.log.guard_timeout(payload.title, payload.company, self._review_timeout)
            await self.ws_manager.broadcast({
                "type": "CLEARED",
                "job_id": payload.job_id,
            })
            self._log_decision(payload, "TIMEOUT")

    def _log_decision(self, payload: ApplicationPayload, action: str):
        os.makedirs("logs", exist_ok=True)
        entry = {
            "job_id": payload.job_id,
            "platform": payload.platform,
            "title": payload.title,
            "company": payload.company,
            "match_score": payload.match_score,
            "resume_variant": payload.resume_variant,
            "keywords_injected": payload.keywords_injected,
            "apply_url": payload.apply_url,
            "status": payload.status if payload.status != "PENDING_REVIEW" else action,
            "decision": action,
            "decided_at": datetime.now(timezone.utc).isoformat(),
        }
        with open(LOGS_FILE, "a") as f:
            f.write(json.dumps(entry, default=str) + "\n")
        if self._save_cb:
            self._save_cb(payload, action)

    async def _heartbeat(self):
        while True:
            await asyncio.sleep(60)
            self.log.guard_heartbeat(len(self._pending))
