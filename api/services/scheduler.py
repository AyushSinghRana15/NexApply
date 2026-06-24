from apscheduler.schedulers.asyncio import AsyncIOScheduler

from api.db.database import SessionLocal
from api.services.gmail_tracker import gmail_tracker
from api.services.resume_optimizer import resume_optimizer

scheduler = AsyncIOScheduler()


async def _run_gmail_scan():
    db = SessionLocal()
    try:
        await gmail_tracker.scan(db)
    finally:
        db.close()


async def _run_resume_optimizer():
    db = SessionLocal()
    try:
        await resume_optimizer.run(db)
    finally:
        db.close()


def setup_scheduler() -> AsyncIOScheduler:
    scheduler.add_job(
        _run_gmail_scan,
        "interval",
        minutes=15,
        id="gmail_scan",
        name="Gmail email scan",
        replace_existing=True,
    )
    scheduler.add_job(
        _run_resume_optimizer,
        "cron",
        hour=2,
        minute=0,
        id="resume_optimizer",
        name="Nightly resume optimization",
        replace_existing=True,
    )
    return scheduler


def start_scheduler():
    if not scheduler.running:
        scheduler.start()


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
