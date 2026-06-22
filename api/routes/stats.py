from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.db.database import get_db
from api.schemas.stats import (
    PlatformBreakdownResponse,
    SummaryResponse,
    TimelineResponse,
)
from api.services.stats import stats_service

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/summary", response_model=SummaryResponse)
def get_summary(db: Session = Depends(get_db)):
    return stats_service.summary(db)


@router.get("/timeline", response_model=TimelineResponse)
def get_timeline(db: Session = Depends(get_db)):
    days = stats_service.timeline(db)
    return TimelineResponse(days=days)


@router.get("/platforms", response_model=PlatformBreakdownResponse)
def get_platforms(db: Session = Depends(get_db)):
    platforms = stats_service.platforms(db)
    return PlatformBreakdownResponse(platforms=platforms)
