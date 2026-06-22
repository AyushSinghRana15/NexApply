import json
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from api.core.websocket import ws_manager
from api.models.application import Application
from api.models.job import Job
from core.guard import WSManager as GuardWSManager
from core.models import ApplicationPayload


class AgentBridge:
    """Connects the existing agent pipeline to the API layer."""

    def __init__(self):
        self.guard_ws = GuardWSManager()

    async def notify_job_detected(self, job: dict):
        await ws_manager.broadcast_event("JOB_DETECTED", job=job)

    async def notify_tailored(self, job_id: str, match_score: int, keywords: list[str], llm_used: str):
        await ws_manager.broadcast_event(
            "JOB_TAILORED",
            job_id=job_id,
            match_score=match_score,
            keywords=keywords,
            llm_used=llm_used,
        )

    async def notify_filled(self, job_id: str, platform: str, screenshot_url: str):
        await ws_manager.broadcast_event("JOB_FILLED", job_id=job_id, platform=platform, screenshot_url=screenshot_url)

    async def notify_review_ready(self, payload: ApplicationPayload):
        await ws_manager.broadcast_event("REVIEW_READY", payload=payload.to_dict())

    async def notify_submitted(self, job_id: str, company: str, platform: str):
        await ws_manager.broadcast_event("APPLICATION_SUBMITTED", job_id=job_id, company=company, platform=platform)

    async def notify_skipped(self, job_id: str, reason: str):
        await ws_manager.broadcast_event("APPLICATION_SKIPPED", job_id=job_id, reason=reason)

    def save_job(self, db: Session, event: dict) -> Job:
        job = Job(
            job_id=event.get("job_id", ""),
            platform=event.get("platform", ""),
            title=event.get("title", ""),
            company=event.get("company", ""),
            location=event.get("location", ""),
            description=event.get("description", ""),
            apply_url=event.get("apply_url", ""),
            posted_at=event.get("posted_at", ""),
            detected_at=event.get("detected_at", ""),
        )
        db.add(job)
        db.commit()
        return job

    def save_application(self, db: Session, payload: ApplicationPayload, decision: str = "") -> Application:
        app = Application(
            job_id=payload.job_id,
            platform=payload.platform,
            title=payload.title,
            company=payload.company,
            match_score=payload.match_score,
            resume_variant=payload.resume_variant,
            keywords_injected=json.dumps(payload.keywords_injected),
            screenshot_path=payload.screenshot_path,
            form_data=json.dumps(payload.form_data_used),
            status=payload.status,
            decision=decision or payload.decision,
            decided_at=datetime.now(timezone.utc).isoformat() if decision else "",
        )
        db.add(app)
        db.commit()
        return app


agent_bridge = AgentBridge()
