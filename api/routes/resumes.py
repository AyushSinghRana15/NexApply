import json
import os
import shutil

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from api.db.database import get_db
from api.models.resume import ResumeVariant
from core.resume_parser import parse_resume, merge_into_profile, build_resume_text

router = APIRouter(prefix="/api/resumes", tags=["resumes"])

UPLOAD_DIR = "resumes"


@router.get("")
def list_resumes(db: Session = Depends(get_db)):
    resumes = db.query(ResumeVariant).order_by(ResumeVariant.created_at.desc()).all()
    return {"items": resumes}


@router.post("")
def create_resume(body: dict, db: Session = Depends(get_db)):
    r = ResumeVariant(
        name=body["name"],
        category=body["category"],
        content=body["content"],
        parsed_data=body.get("parsed_data"),
    )
    db.add(r)
    db.commit()
    return r


@router.post("/upload")
async def upload_resume(
    file: UploadFile = File(...),
    name: str = Form(""),
    category: str = Form("engineering"),
    db: Session = Depends(get_db),
):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "resume.pdf")[1].lower()
    dest = os.path.join(UPLOAD_DIR, f"user_uploaded{ext}")
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        parsed = parse_resume(dest)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse resume: {e}")

    personal = parsed.get("personal", {})
    suggested_name = name or personal.get("full_name", "").strip() or "Parsed Resume"
    variant_name = f"{suggested_name} ({category})"

    resume_text = build_resume_text(parsed, category=category)

    r = ResumeVariant(
        name=variant_name,
        category=category,
        content=resume_text,
        parsed_data=parsed,
        source_file=file.filename or "resume.pdf",
    )
    db.add(r)
    db.commit()

    return {
        "id": r.id,
        "name": r.name,
        "category": r.category,
        "content": r.content,
        "parsed_data": parsed,
        "source_file": r.source_file,
    }


@router.post("/parse")
async def parse_resume_file(file: UploadFile = File(...)):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "resume.pdf")[1].lower()
    dest = os.path.join(UPLOAD_DIR, f"parse_temp{ext}")
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        parsed = parse_resume(dest)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse resume: {e}")
    finally:
        if os.path.exists(dest):
            os.unlink(dest)

    return {"parsed_data": parsed}


@router.post("/profile-from-resume")
async def profile_from_resume(file: UploadFile = File(...)):
    import yaml

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(file.filename or "resume.pdf")[1].lower()
    dest = os.path.join(UPLOAD_DIR, f"profile_temp{ext}")
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        parsed = parse_resume(dest)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Failed to parse resume: {e}")
    finally:
        if os.path.exists(dest):
            os.unlink(dest)

    try:
        with open("profile.yaml") as f:
            profile = yaml.safe_load(f) or {}
    except Exception:
        profile = {}

    merged = merge_into_profile(parsed, profile)

    with open("profile.yaml", "w") as f:
        yaml.dump(merged, f, default_flow_style=False, sort_keys=False)

    return {"message": "Profile updated from resume", "parsed_data": parsed}


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
    if "parsed_data" in body:
        r.parsed_data = body["parsed_data"]
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
