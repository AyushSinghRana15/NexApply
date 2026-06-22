from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class JobResponse(BaseModel):
    id: int
    job_id: str
    platform: str
    title: str
    company: str
    location: str
    description: str
    apply_url: str
    posted_at: str
    detected_at: str
    created_at: datetime

    model_config = {"from_attributes": True}


class JobListResponse(BaseModel):
    items: list[JobResponse]
    total: int
    page: int
    per_page: int
