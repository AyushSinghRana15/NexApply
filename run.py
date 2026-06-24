import asyncio
import os
import sys
import webbrowser

import uvicorn
import yaml

from api.main import app
from api.core.websocket import ws_manager
from core.fleet import ApplyFleet
from core.guard import GuardAgent
from core.logger import Logger
from core.queue import JobQueue
from core.radar import RadarAgent
from core.tailor import TailorAgent


async def start_agents(config: dict, log: Logger):
    job_queue = JobQueue()
    tailor_queue = JobQueue()
    guard_queue = JobQueue()

    radar = RadarAgent(config, job_queue)
    tailor = TailorAgent(config, job_queue, tailor_queue)
    fleet = ApplyFleet(config, tailor_queue, guard_queue)

    from api.core.websocket import ws_manager as api_ws
    guard = GuardAgent(config, guard_queue, api_ws)

    asyncio.create_task(radar.start())
    asyncio.create_task(tailor.start())
    asyncio.create_task(fleet.start())
    asyncio.create_task(guard.start())
    log.start("Agent pipeline started")

    if "--test" in sys.argv:
        screenshots_dir = "logs/screenshots"
        os.makedirs(screenshots_dir, exist_ok=True)
        test_screenshot = os.path.join(screenshots_dir, "test-001_razorpay.png")
        if not os.path.exists(test_screenshot):
            from PIL import Image
            Image.new("RGB", (800, 600), color=(30, 41, 59)).save(test_screenshot)

        from core.models import ApplicationPayload
        fake = ApplicationPayload(
            job_id="test-001",
            platform="indeed",
            title="Backend Engineer",
            company="Razorpay",
            apply_url="https://in.indeed.com/viewjob?jk=test001",
            match_score=84,
            keywords_injected=["FastAPI", "Redis", "Python"],
            resume_variant="engineering_v1",
            screenshot_path=test_screenshot,
            status=ApplicationPayload.STATUS_PENDING_REVIEW,
            approval_event=asyncio.Event(),
        )
        await asyncio.sleep(2)
        await guard_queue.enqueue(fake)
        log.detail("Test payloads injected into guard_queue")


async def main():
    log = Logger()
    log.start("NexApply starting...")

    os.makedirs("logs", exist_ok=True)
    os.makedirs("logs/screenshots", exist_ok=True)

    try:
        with open("config.yaml") as f:
            config = yaml.safe_load(f)
    except FileNotFoundError:
        log.error("config.yaml not found")
        config = {}

    db_count = 0
    try:
        from api.db.database import SessionLocal
        from api.models.application import Application
        db = SessionLocal()
        db_count = db.query(Application).count()
        db.close()
    except Exception:
        pass
    log.detail(f"Database initialized — {db_count} applications")

    asyncio.create_task(start_agents(config, log))

    from api.services.scheduler import start_scheduler
    await start_scheduler()
    log.start("Scheduler started — Gmail scan every 15min")

    frontend_url = "http://localhost:5173"
    log.detail(f"API running → http://localhost:8000")
    log.detail(f"Frontend → {frontend_url}")

    webbrowser.open(frontend_url)

    log.start("NexApply ready")

    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="error")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down NexApply...")
        sys.exit(0)
