from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class DecisionRequest(BaseModel):
    action: str


class ApplicationResponse(BaseModel):
    id: int
    job_id: str
    platform: str
    title: str
    company: str
    location: str = ""
    match_score: int
    resume_variant: str
    keywords_injected: list[str]
    screenshot_path: str
    form_data: dict
    status: str
    decision: str
    decided_at: str
    time_to_decide_seconds: int
    email_status: str = ""
    email_received_at: str = ""
    email_subject: str = ""
    created_at: datetime

    model_config = {"from_attributes": True}


class ApplicationListResponse(BaseModel):
    items: list[ApplicationResponse]
    total: int
    page: int
    per_page: int
