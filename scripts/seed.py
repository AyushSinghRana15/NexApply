"""
Seed script — injects demo applications into the database for a live-looking UI.

Runs automatically in run.sh when the applications table is empty.
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from api.db.database import SessionLocal
from api.models.application import Application
from api.models.resume import ResumeVariant

DEMO_APPS = [
    {
        "job_id": "demo-001", "platform": "indeed",
        "title": "Software Engineer", "company": "Google",
        "match_score": 92, "resume_variant": "engineering_v1",
        "keywords": ["Python", "Go", "Distributed Systems", "Kubernetes", "gRPC"],
        "status": "APPLIED", "decision": "approved",
        "ago_hours": 2,
    },
    {
        "job_id": "demo-002", "platform": "naukri",
        "title": "Senior Backend Engineer", "company": "Razorpay",
        "match_score": 78, "resume_variant": "engineering_v1",
        "keywords": ["FastAPI", "PostgreSQL", "Redis", "Docker", "AWS"],
        "status": "APPLIED", "decision": "approved",
        "ago_hours": 5,
    },
    {
        "job_id": "demo-003", "platform": "internshala",
        "title": "ML Intern", "company": "Salesforce",
        "match_score": 85, "resume_variant": "ml_v1",
        "keywords": ["PyTorch", "NLP", "Transformers", "Python", "SQL"],
        "status": "APPLIED", "decision": "approved",
        "ago_hours": 8,
    },
    {
        "job_id": "demo-004", "platform": "indeed",
        "title": "Backend Developer", "company": "Stripe",
        "match_score": 71, "resume_variant": "engineering_v1",
        "keywords": ["Python", "PostgreSQL", "Redis"],
        "status": "SKIPPED", "decision": "skipped",
        "ago_hours": 12,
    },
    {
        "job_id": "demo-005", "platform": "naukri",
        "title": "SDE-2", "company": "Amazon",
        "match_score": 88, "resume_variant": "engineering_v1",
        "keywords": ["Java", "AWS", "System Design", "Microservices"],
        "status": "PENDING_REVIEW", "decision": "",
        "ago_hours": 1,
    },
]


def seed():
    db = SessionLocal()
    count = db.query(Application).count()
    if count > 0:
        db.close()
        return

    now = datetime.now(timezone.utc)
    for d in DEMO_APPS:
        created = now - timedelta(hours=d["ago_hours"])
        app = Application(
            job_id=d["job_id"],
            platform=d["platform"],
            title=d["title"],
            company=d["company"],
            match_score=d["match_score"],
            resume_variant=d["resume_variant"],
            keywords_injected=json.dumps(d["keywords"]),
            screenshot_path="",
            form_data="{}",
            status=d["status"],
            decision=d.get("decision", ""),
            decided_at=created.isoformat() if d.get("decision") else "",
            created_at=created,
        )
        db.add(app)

    demo_resume = ResumeVariant(
        name="Parsed Resume (Demo)",
        category="engineering",
        content="Sample resume content for demo.\n\n{{KEYWORDS}}",
        is_active=True,
    )
    existing = db.query(ResumeVariant).count()
    if existing == 0:
        db.add(demo_resume)

    db.commit()
    db.close()
    print(f"Seeded {len(DEMO_APPS)} demo applications")


if __name__ == "__main__":
    seed()
