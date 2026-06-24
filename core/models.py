import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4


@dataclass
class JobEvent:
    job_id: str = field(default_factory=lambda: uuid4().hex[:8])
    platform: str = ""
    title: str = ""
    company: str = ""
    location: str = ""
    description: str = ""
    apply_url: str = ""
    posted_at: str = ""
    detected_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class GeneratedContent:
    cover_letter: str = ""
    screening_answers: Dict[str, str] = field(default_factory=dict)
    summary: str = ""


@dataclass
class TailoredResult:
    job_id: str = ""
    platform: str = ""
    title: str = ""
    company: str = ""
    apply_url: str = ""
    resume_variant: str = ""
    tailored_resume: str = ""
    keywords_injected: List[str] = field(default_factory=list)
    match_score: int = 0
    llm_used: str = ""
    tailored_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    cover_letter: str = ""
    screening_answers: Dict[str, str] = field(default_factory=dict)
    generated_summary: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class ApplicationPayload:
    job_id: str = ""
    platform: str = ""
    title: str = ""
    company: str = ""
    apply_url: str = ""
    match_score: int = 0
    keywords_injected: List[str] = field(default_factory=list)
    resume_variant: str = ""
    screenshot_path: str = ""
    form_data_used: Dict[str, str] = field(default_factory=dict)
    status: str = "PENDING_REVIEW"
    filled_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    page: Any = None
    approval_event: Any = None
    decision: str = ""
    cover_letter: str = ""
    screening_answers: Dict[str, str] = field(default_factory=dict)
    generated_summary: str = ""

    STATUS_PENDING_REVIEW = "PENDING_REVIEW"
    STATUS_MANUAL_REQUIRED = "MANUAL_REQUIRED"
    STATUS_NEEDS_COOKIES = "NEEDS_COOKIES"
    STATUS_FAILED = "FAILED"
    STATUS_UNKNOWN_FORM = "UNKNOWN_FORM"
    STATUS_APPLIED = "APPLIED"
    STATUS_SKIPPED = "SKIPPED"
    STATUS_TIMEOUT = "TIMEOUT"
    STATUS_SUBMIT_FAILED = "SUBMIT_FAILED"

    def to_dict(self) -> dict:
        d = asdict(self)
        d.pop("page", None)
        d.pop("approval_event", None)
        return d

    def to_jsonl(self) -> str:
        return json.dumps(self.to_dict(), default=str)


@dataclass
class DailyStats:
    applied: int = 0
    skipped: int = 0
    failed: int = 0
    avg_score: float = 0.0
    interviews: int = 0
    confirmations: int = 0
    rejections: int = 0
    platform_breakdown: Dict[str, int] = field(default_factory=dict)
