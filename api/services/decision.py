import asyncio
import json
from datetime import datetime, timezone

from fastapi import Depends
from sqlalchemy.orm import Session

from api.db.database import get_db
from api.models.application import Application


class DecisionService:

    def apply_decision(self, application_id: int, action: str, db: Session) -> Application | None:
        app = db.query(Application).filter(Application.id == application_id).first()
        if not app:
            return None

        app.decision = action
        app.decided_at = datetime.now(timezone.utc).isoformat()
        now = datetime.fromisoformat(app.created_at.isoformat()) if app.created_at else datetime.now(timezone.utc)
        then = datetime.fromisoformat(app.decided_at)
        app.time_to_decide_seconds = int((then - now).total_seconds())

        if action == "APPROVE":
            app.status = "APPLIED"
        elif action == "SKIP":
            app.status = "SKIPPED"
        elif action == "TIMEOUT":
            app.status = "TIMEOUT"
        elif action == "EDIT":
            app.status = "APPLIED"

        db.commit()
        db.refresh(app)

        if app.job_id and action in ("APPROVE", "SKIP", "EDIT"):
            asyncio.create_task(self._resume_graph(app.job_id, action))

        return app

    async def _resume_graph(self, job_id: str, action: str):
        try:
            from core.workflow import resume_pipeline
            await resume_pipeline(job_id, action)
        except Exception as e:
            import logging
            logging.getLogger("decision").warning(f"Failed to resume graph for {job_id}: {e}")


decision_service = DecisionService()
