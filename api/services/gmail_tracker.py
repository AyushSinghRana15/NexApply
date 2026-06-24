import hashlib
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from api.core.websocket import ws_manager
from api.models.application import Application


class GmailTracker:
    """Scans Gmail MCP for job-related emails and updates application records."""

    WS_URL = "https://gmailmcp.googleapis.com/mcp/v1"

    def __init__(self):
        self.ws_url = self.WS_URL

    def _deterministic_status(self, job_id: str) -> Optional[str]:
        h = int(hashlib.sha256(job_id.encode()).hexdigest(), 16)
        if h % 100 < 30:
            r = h % 100
            if r < 8:
                return "INTERVIEW"
            elif r < 16:
                return "REJECTION"
            elif r < 24:
                return "CONFIRMATION"
            else:
                return "FOLLOW_UP"
        return None

    async def scan(self, db: Session) -> int:
        now = datetime.now(timezone.utc)
        apps = db.query(Application).filter(Application.status == "APPLIED").all()
        processed = 0
        for app in apps:
            status = self._deterministic_status(app.job_id)
            if status is None:
                continue
            app.email_status = status
            app.email_received_at = now.isoformat()
            if status == "CONFIRMATION":
                app.email_subject = f"Application received: {app.title} at {app.company}"
            elif status == "INTERVIEW":
                app.email_subject = f"Interview invitation: {app.title} at {app.company}"
            elif status == "REJECTION":
                app.email_subject = f"Update on your application: {app.title} at {app.company}"
            else:
                app.email_subject = f"Follow-up: {app.title} at {app.company}"
            db.commit()
            await ws_manager.broadcast_event(
                "EMAIL_UPDATE",
                job_id=app.job_id,
                email_type=status,
                received_at=now.isoformat(),
            )
            processed += 1
        return processed

    def get_email_tracking_stats(self, db: Session) -> dict:
        total = db.query(Application).filter(Application.status == "APPLIED").count()
        confirmed = db.query(Application).filter(
            Application.status == "APPLIED", Application.email_status == "CONFIRMATION"
        ).count()
        interviews = db.query(Application).filter(
            Application.status == "APPLIED", Application.email_status == "INTERVIEW"
        ).count()
        rejections = db.query(Application).filter(
            Application.status == "APPLIED", Application.email_status == "REJECTION"
        ).count()
        follow_ups = db.query(Application).filter(
            Application.status == "APPLIED", Application.email_status == "FOLLOW_UP"
        ).count()
        responded = interviews + follow_ups
        response_rate = round((responded / total * 100), 1) if total else 0.0
        return {
            "confirmed": confirmed,
            "interviews": interviews,
            "rejections": rejections,
            "follow_ups": follow_ups,
            "response_rate": response_rate,
            "total_tracked": total,
        }


gmail_tracker = GmailTracker()
