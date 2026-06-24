import asyncio
import os
import sys
import webbrowser

import yaml

from core.fleet import ApplyFleet
from core.guard import GuardAgent, WSManager
from core.logger import Logger
from core.models import ApplicationPayload
from core.queue import JobQueue
from core.radar import RadarAgent
from core.tailor import TailorAgent
from dashboard.server import DashboardServer


async def main():
    log = Logger()

    try:
        with open("config.yaml") as f:
            config = yaml.safe_load(f)
    except FileNotFoundError:
        log.error("config.yaml not found — using defaults")
        config = {
            "platforms": {"indeed": True, "naukri": True, "internshala": True},
            "polling_interval_seconds": 30,
            "filters": {},
            "tailor": {"min_match_score": 60},
            "fleet": {"max_concurrent_browsers": 3, "headless": True},
            "guard": {"review_timeout_seconds": 300, "max_pending_reviews": 3, "dashboard_port": 8000, "auto_skip_below_score": 60},
        }

    job_queue = JobQueue()
    tailor_queue = JobQueue()
    guard_queue = JobQueue()

    ws_manager = WSManager()
    guard = GuardAgent(config, guard_queue, ws_manager)
    dashboard_port = config.get("guard", {}).get("dashboard_port", 8000)
    dashboard = DashboardServer(ws_manager, guard, port=dashboard_port)

    radar = RadarAgent(config, job_queue)
    tailor = TailorAgent(config, job_queue, tailor_queue)
    fleet = ApplyFleet(config, tailor_queue, guard_queue)

    asyncio.create_task(dashboard.start())
    await asyncio.sleep(1)
    webbrowser.open(f"http://localhost:{dashboard_port}")

    radar_task = asyncio.create_task(radar.start())
    tailor_task = asyncio.create_task(tailor.start())
    fleet_task = asyncio.create_task(fleet.start())
    guard_task = asyncio.create_task(guard.start())

    if "--test" in sys.argv:
        screenshots_dir = "logs/screenshots"
        os.makedirs(screenshots_dir, exist_ok=True)
        test_screenshot = os.path.join(screenshots_dir, "test-001_razorpay.png")
        if not os.path.exists(test_screenshot):
            from PIL import Image
            img = Image.new("RGB", (800, 600), color=(30, 41, 59))
            img.save(test_screenshot)

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
        await guard_queue.enqueue(fake)
        log.detail("Test payload injected into guard_queue")



    await asyncio.gather(radar_task, tailor_task, fleet_task, guard_task)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down NexApply...")
        sys.exit(0)
