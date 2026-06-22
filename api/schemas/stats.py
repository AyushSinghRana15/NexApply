from pydantic import BaseModel


class SummaryResponse(BaseModel):
    total_applied: int
    total_skipped: int
    total_pending: int
    total_timeout: int
    avg_match_score: float


class TimelinePoint(BaseModel):
    date: str
    applied: int
    skipped: int


class TimelineResponse(BaseModel):
    days: list[TimelinePoint]


class PlatformBreakdown(BaseModel):
    platform: str
    total: int
    applied: int
    skipped: int


class PlatformBreakdownResponse(BaseModel):
    platforms: list[PlatformBreakdown]
