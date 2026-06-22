from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from api.db.database import get_db
from api.models.job import Job
from api.schemas.job import JobListResponse, JobResponse

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("", response_model=JobListResponse)
def list_jobs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Job).order_by(Job.created_at.desc())
    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return JobListResponse(items=items, total=total, page=page, per_page=per_page)


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.job_id == job_id).first()
    return job
