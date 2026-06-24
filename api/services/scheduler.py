import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from api.db.database import SessionLocal
from api.services.daily_report import DailyReport
from api.services.gmail_tracker import gmail_tracker
from api.services.resume_optimizer import resume_optimizer

logger = logging.getLogger(__name__)
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


async def _send_daily_report():
    try:
        import yaml
        with open("config.yaml") as f:
            config = yaml.safe_load(f)
        mode = config.get("autonomy", {}).get("mode", "full")
        if mode != "full":
            return
        report = DailyReport()
        subject, body = await report.generate()
        logger.info(f"Daily report generated: {subject}")
    except Exception as e:
        logger.warning(f"Daily report error: {e}")


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
    scheduler.add_job(
        _send_daily_report,
        "cron",
        hour=21,
        minute=0,
        id="daily_report",
        name="Daily report email",
        replace_existing=True,
    )
    return scheduler


def start_scheduler():
    if not scheduler.running:
        scheduler.start()


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
