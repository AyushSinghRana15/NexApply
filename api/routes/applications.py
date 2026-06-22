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
    per_page: int = Query(20, ge=1, le=100),
    platform: str | None = Query(None),
    status: str | None = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Application).order_by(Application.created_at.desc())
    if platform:
        query = query.filter(Application.platform == platform)
    if status:
        query = query.filter(Application.status == status)
    total = query.count()
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return ApplicationListResponse(items=items, total=total, page=page, per_page=per_page)


@router.get("/{application_id}", response_model=ApplicationResponse)
def get_application(application_id: int, db: Session = Depends(get_db)):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.patch("/{application_id}/decision", response_model=ApplicationResponse)
def patch_decision(application_id: int, body: DecisionRequest, db: Session = Depends(get_db)):
    app = decision_service.apply_decision(application_id, body.action, db)
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app
