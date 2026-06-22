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
        test_path2 = os.path.join(screenshots_dir, "test-002_swiggy.png")
        if not os.path.exists(test_path2):
            from PIL import Image
            Image.new("RGB", (800, 600), color=(15, 23, 42)).save(test_path2)
        fake2 = ApplicationPayload(
            job_id="test-002",
            platform="linkedin",
            title="SDE-2",
            company="Swiggy",
            match_score=62,
            keywords_injected=["Django", "PostgreSQL", "AWS"],
            resume_variant="engineering_v1",
            screenshot_path=test_path2,
            status=ApplicationPayload.STATUS_PENDING_REVIEW,
            approval_event=asyncio.Event(),
        )
        await asyncio.sleep(2)
        await guard_queue.enqueue(fake)
        await guard_queue.enqueue(fake2)
        log.detail("Test payloads injected into guard_queue")


async def main():
    log = Logger()
    log.start("NexApply starting...")

    try:
        with open("config.yaml") as f:
            config = yaml.safe_load(f)
    except FileNotFoundError:
        log.error("config.yaml not found")
        config = {}

    asyncio.create_task(start_agents(config, log))

    frontend_url = "http://localhost:5173"
    log.detail(f"Frontend: {frontend_url}")
    log.detail(f"Backend:  http://localhost:8000")

    webbrowser.open(frontend_url)

    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="error")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down NexApply...")
        sys.exit(0)
