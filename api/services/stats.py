from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from api.db.database import get_db
from api.models.application import Application
from api.schemas.stats import PlatformBreakdown, SummaryResponse, TimelinePoint


class StatsService:

    def summary(self, db: Session) -> SummaryResponse:
        total = db.query(Application).count()
        applied = db.query(Application).filter(Application.status == "APPLIED").count()
        skipped = db.query(Application).filter(Application.status.in_(["SKIPPED", "TIMEOUT"])).count()
        pending = db.query(Application).filter(Application.status == "PENDING_REVIEW").count()
        timeout = db.query(Application).filter(Application.status == "TIMEOUT").count()
        avg = db.query(func.avg(Application.match_score)).filter(Application.match_score > 0).scalar() or 0
        return SummaryResponse(
            total_applied=applied,
            total_skipped=skipped,
            total_pending=pending,
            total_timeout=timeout,
            avg_match_score=round(float(avg), 1),
        )

    def timeline(self, db: Session) -> list[TimelinePoint]:
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        apps = db.query(Application).filter(Application.created_at >= thirty_days_ago).all()
        daily: dict[str, dict[str, int]] = {}
        for i in range(30):
            day = (thirty_days_ago + timedelta(days=i)).strftime("%Y-%m-%d")
            daily[day] = {"applied": 0, "skipped": 0}
        for app in apps:
            day = app.created_at.strftime("%Y-%m-%d") if app.created_at else ""
            if day in daily:
                if app.status == "APPLIED":
                    daily[day]["applied"] += 1
                elif app.status in ("SKIPPED", "TIMEOUT"):
                    daily[day]["skipped"] += 1
        return [TimelinePoint(date=d, applied=v["applied"], skipped=v["skipped"]) for d, v in sorted(daily.items())]

    def platforms(self, db: Session) -> list[PlatformBreakdown]:
        apps = db.query(Application).all()
        groups: dict[str, dict[str, int]] = defaultdict(lambda: {"total": 0, "applied": 0, "skipped": 0})
        for app in apps:
            p = app.platform
            groups[p]["total"] += 1
            if app.status == "APPLIED":
                groups[p]["applied"] += 1
            elif app.status in ("SKIPPED", "TIMEOUT"):
                groups[p]["skipped"] += 1
        return [PlatformBreakdown(platform=p, **v) for p, v in sorted(groups.items())]


stats_service = StatsService()
