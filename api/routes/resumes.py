import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.db.database import get_db
from api.models.resume import ResumeVariant

router = APIRouter(prefix="/api/resumes", tags=["resumes"])


@router.get("")
def list_resumes(db: Session = Depends(get_db)):
    resumes = db.query(ResumeVariant).order_by(ResumeVariant.created_at.desc()).all()
    return {"items": resumes}


@router.post("")
def create_resume(body: dict, db: Session = Depends(get_db)):
    r = ResumeVariant(name=body["name"], category=body["category"], content=body["content"])
    db.add(r)
    db.commit()
    return r


@router.post("/preview")
def preview_resume(body: dict, db: Session = Depends(get_db)):
    variant_id = body.get("variant_id")
    sample_keywords = body.get("sample_keywords", [])
    r = db.query(ResumeVariant).filter(ResumeVariant.id == variant_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Resume not found")
    injected = r.content.replace("{{KEYWORDS}}", ", ".join(sample_keywords))
    return {"injected": injected}


@router.patch("/{resume_id}")
def update_resume(resume_id: int, body: dict, db: Session = Depends(get_db)):
    r = db.query(ResumeVariant).filter(ResumeVariant.id == resume_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Resume not found")
    if "name" in body:
        r.name = body["name"]
    if "content" in body:
        r.content = body["content"]
    if "category" in body:
        r.category = body["category"]
    if "is_active" in body:
        r.is_active = body["is_active"]
    db.commit()
    return r


@router.delete("/{resume_id}")
def delete_resume(resume_id: int, db: Session = Depends(get_db)):
    r = db.query(ResumeVariant).filter(ResumeVariant.id == resume_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Resume not found")
    db.delete(r)
    db.commit()
    return {"ok": True}
