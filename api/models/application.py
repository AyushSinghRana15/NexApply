from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from api.db.database import Base


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    platform: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str] = mapped_column(String(255), nullable=False)
    match_score: Mapped[int] = mapped_column(Integer, default=0)
    resume_variant: Mapped[str] = mapped_column(String(64), default="")
    keywords_injected: Mapped[str] = mapped_column(Text, default="[]")
    screenshot_path: Mapped[str] = mapped_column(String(512), default="")
    form_data: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(32), default="PENDING_REVIEW")
    decision: Mapped[str] = mapped_column(String(32), default="")
    decided_at: Mapped[str] = mapped_column(String(64), default="")
    time_to_decide_seconds: Mapped[int] = mapped_column(Integer, default=0)
    email_status: Mapped[str] = mapped_column(String(32), default="")
    email_received_at: Mapped[str] = mapped_column(String(64), default="")
    email_subject: Mapped[str] = mapped_column(String(512), default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
