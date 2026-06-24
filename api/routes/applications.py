from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from api.db.database import get_db
from api.models.application import Application
from api.schemas.application import ApplicationListResponse, ApplicationResponse, DecisionRequest
from api.services.decision import decision_service

router = APIRouter(prefix="/api/applications", tags=["applications"])


@router.get("", response_model=ApplicationListResponse)
def list_applications(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    platform: str | None = Query(None),
    status: str | None = Query(None),
    search: str | None = Query(None),
    min_score: int | None = Query(None),
    date_range: str | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Application).order_by(Application.created_at.desc())
    if platform:
        query = query.filter(Application.platform == platform)
    if status:
        query = query.filter(Application.status == status)
    if search:
        query = query.filter(Application.company.ilike(f"%{search}%"))
    if min_score:
        query = query.filter(Application.match_score >= min_score)
    if date_range == "7d":
        from datetime import datetime, timedelta, timezone
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        query = query.filter(Application.created_at >= cutoff)
    elif date_range == "30d":
        from datetime import datetime, timedelta, timezone
        cutoff = datetime.now(timezone.utc) - timedelta(days=30)
        query = query.filter(Application.created_at >= cutoff)
    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return ApplicationListResponse(items=items, total=total, page=page, per_page=per_page)


@router.delete("")
def clear_applications(db: Session = Depends(get_db)):
    db.query(Application).delete()
    db.commit()
    return {"ok": True}


@router.get("/{application_id}", response_model=ApplicationResponse)
def get_application(application_id: int, db: Session = Depends(get_db)):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.get("/{application_id}/email-history")
def get_email_history(application_id: int, db: Session = Depends(get_db)):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    events = []
    if app.email_status:
        events.append({
            "type": app.email_status,
            "received_at": app.email_received_at or "",
            "subject": app.email_subject or "",
        })
    return {"items": events}


@router.patch("/{application_id}/decision", response_model=ApplicationResponse)
def patch_decision(application_id: int, body: DecisionRequest, db: Session = Depends(get_db)):
    app = decision_service.apply_decision(application_id, body.action, db)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app
