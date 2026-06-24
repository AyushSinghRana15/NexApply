"""
Demo script — injects fake data for a live-looking demo.

Usage:
    python3 scripts/demo.py

Requires the API server to be running on localhost:8000.
Injects 3 realistic ApplicationPayloads into the guard queue
and logs fake activity.
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import yaml
from PIL import Image

from core.logger import Logger
from core.models import ApplicationPayload

log = Logger()

DEMO_JOBS = [
    {
        "job_id": "demo-001",
        "platform": "indeed",
        "title": "Software Engineer",
        "company": "Google",
        "apply_url": "https://in.indeed.com/viewjob?jk=demo001",
        "match_score": 92,
        "keywords_injected": ["Python", "Go", "Distributed Systems", "Kubernetes", "gRPC"],
        "resume_variant": "engineering_v1",
    },
    {
        "job_id": "demo-002",
        "platform": "naukri",
        "title": "Senior Backend Engineer",
        "company": "Razorpay",
        "apply_url": "https://www.naukri.com/job/demo002",
        "match_score": 78,
        "keywords_injected": ["FastAPI", "PostgreSQL", "Redis", "Docker", "AWS"],
        "resume_variant": "engineering_v1",
    },
    {
        "job_id": "demo-003",
        "platform": "internshala",
        "title": "ML Intern",
        "company": "Salesforce",
        "apply_url": "https://internshala.com/internship/demo003",
        "match_score": 85,
        "keywords_injected": ["PyTorch", "NLP", "Transformers", "Python", "SQL"],
        "resume_variant": "ml_v1",
    },
]


async def main():
    log.start("NexApply Demo — injecting fake data...")

    screenshots_dir = "logs/screenshots"
    os.makedirs(screenshots_dir, exist_ok=True)

    colors = [(30, 41, 59), (15, 23, 42), (20, 30, 50)]
    payloads = []

    for i, job in enumerate(DEMO_JOBS):
        ss_path = os.path.join(screenshots_dir, f"{job['job_id']}.png")
        if not os.path.exists(ss_path):
            img = Image.new("RGB", (800, 600), color=colors[i])
            img.save(ss_path)

        payload = ApplicationPayload(
            job_id=job["job_id"],
            platform=job["platform"],
            title=job["title"],
            company=job["company"],
            apply_url=job["apply_url"],
            match_score=job["match_score"],
            keywords_injected=job["keywords_injected"],
            resume_variant=job["resume_variant"],
            screenshot_path=ss_path,
            status=ApplicationPayload.STATUS_PENDING_REVIEW,
            approval_event=asyncio.Event(),
        )
        payloads.append(payload)
        log.new_job(job["platform"], f"{job['title']} @ {job['company']}", "just now")

    from core.guard import GuardAgent
    from core.queue import JobQueue
    from core.logger import Logger as CoreLogger

    from api.core.websocket import ws_manager

    guard_queue = JobQueue()
    guard = GuardAgent({}, guard_queue, ws_manager)

    for p in payloads:
        await guard_queue.enqueue(p)
        log.detail(f"Injected {p.job_id} → guard_queue")

    log.start("Demo data injected. Check the dashboard at http://localhost:5173")
    log.detail("Press Ctrl+C to exit")

    watch_task = asyncio.create_task(guard.start())

    try:
        await asyncio.Event().wait()
    except KeyboardInterrupt:
        watch_task.cancel()
        log.start("Demo stopped")


if __name__ == "__main__":
    asyncio.run(main())
