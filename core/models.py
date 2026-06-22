from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import List
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

    def to_dict(self) -> dict:
        return asdict(self)
