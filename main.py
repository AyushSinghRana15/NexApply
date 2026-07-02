import asyncio
import os
import sys
import time as time_mod
from datetime import datetime
from datetime import time as dt_time

import yaml

from core.autonomous import AutonomousAgent
from core.broker import QueueBroker
from core.fleet import ApplyFleet
from core.guard import GuardAgent, WSManager
from core.logger import Logger
from core.models import ApplicationPayload, TailoredResult
from core.queue import JobQueue
from core.radar import RadarAgent
from core.tailor import TailorAgent
from dashboard.server import DashboardServer


async def watchdog(config: dict, log: Logger):
    autonomy = config.get("autonomy", {})
    safety = config.get("safety", {})
    stop_file = safety.get("emergency_stop_file", "STOP")
    apply_hours = autonomy.get("apply_hours", {"start": "08:00", "end": "23:00"})
    skip_weekends = autonomy.get("skip_weekends", False)
    max_fails = safety.get("max_failures_before_pause", 5)

    while True:
        if os.path.exists(stop_file):
            log.critical("STOP file detected — shutting down all agents")
            os._exit(0)

        recent = _count_recent_failures()
        if recent >= max_fails:
            log.warn(f"{recent} failures detected — pausing 10 minutes")
            await asyncio.sleep(600)

        now = datetime.now()
        start_str = apply_hours.get("start", "08:00")
        end_str = apply_hours.get("end", "23:00")
        start_h, start_m = map(int, start_str.split(":"))
        end_h, end_m = map(int, end_str.split(":"))

        start_t = dt_time(hour=start_h, minute=start_m)
        end_t = dt_time(hour=end_h, minute=end_m)

        if not (start_t <= now.time() <= end_t):
            log.watchdog_sleep(f"Outside apply hours ({start_str}-{end_str}) — sleeping")
            await asyncio.sleep(300)
            continue

        if skip_weekends and now.weekday() >= 5:
            log.watchdog_sleep("Weekend — sleeping 1 hour")
            await asyncio.sleep(3600)
            continue

        await asyncio.sleep(30)


def _count_recent_failures(window_minutes: int = 10) -> int:
    try:
        with open("logs/applications.jsonl") as f:
            lines = f.readlines()
    except (FileNotFoundError, OSError):
        return 0

    cutoff = time_mod.time() - (window_minutes * 60)
    count = 0
    import json
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
            if entry.get("status") in ("FAILED", "SUBMIT_FAILED"):
                ts = entry.get("filled_at", entry.get("detected_at", ""))
                if ts:
                    parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                    if parsed.timestamp() >= cutoff:
                        count += 1
        except Exception:
            continue
    return count


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
            "autonomy": {"mode": "full", "auto_apply_threshold": 70,
                         "max_applications_per_day": 300,
                         "cooldown_between_apps": 45},
            "safety": {"max_failures_before_pause": 5, "emergency_stop_file": "STOP"},
            "guard": {"review_timeout_seconds": 300, "max_pending_reviews": 3,
                      "dashboard_port": 8000, "auto_skip_below_score": 60},
        }

    job_queue = JobQueue()
    filtered_queue = JobQueue()
    tailor_queue = JobQueue()
    guard_queue = JobQueue()

    ws_manager = WSManager()
    guard = GuardAgent(config, guard_queue, ws_manager)
    dashboard_port = config.get("guard", {}).get("dashboard_port", 8000)
    dashboard = DashboardServer(ws_manager, guard, port=dashboard_port)

    radar = RadarAgent(config, job_queue)
    broker = QueueBroker(config, job_queue, filtered_queue)
    tailor = TailorAgent(config, filtered_queue, tailor_queue)
    fleet = ApplyFleet(config, tailor_queue, guard_queue)

    asyncio.create_task(dashboard.start())
    await asyncio.sleep(1)
    import webbrowser
    webbrowser.open(f"http://localhost:{dashboard_port}")

    mode = config.get("autonomy", {}).get("mode", "full")
    if mode == "full":
        log.start("Autonomous mode — GuardAgent bypassed")

    radar_task = asyncio.create_task(radar.start())
    broker_task = asyncio.create_task(broker.start())
    tailor_task = asyncio.create_task(tailor.start())
    fleet_task = asyncio.create_task(fleet.start())
    guard_task = asyncio.create_task(guard.start())

    watchdog_task = asyncio.create_task(watchdog(config, log))
    log.start("Watchdog started")

    if "--test" in sys.argv:
        screenshots_dir = "logs/screenshots"
        os.makedirs(screenshots_dir, exist_ok=True)
        test_screenshot = os.path.join(screenshots_dir, "test-001_razorpay.png")
        if not os.path.exists(test_screenshot):
            from PIL import Image
            img = Image.new("RGB", (800, 600), color=(30, 41, 59))
            img.save(test_screenshot)

        if mode == "full":
            test_jobs = [
                {"job_id": "test-001", "platform": "indeed", "title": "Backend Engineer",
                 "company": "Razorpay", "match_score": 84, "keywords": ["FastAPI", "Redis", "Python"]},
                {"job_id": "test-002", "platform": "naukri", "title": "Senior SDE",
                 "company": "Google", "match_score": 92, "keywords": ["System Design", "Python", "K8s"]},
                {"job_id": "test-003", "platform": "internshala", "title": "Backend Intern",
                 "company": "Salesforce", "match_score": 45, "keywords": ["Python", "SQL"]},
            ]
            for j in test_jobs:
                tr = TailoredResult(
                    job_id=j["job_id"], platform=j["platform"],
                    title=j["title"], company=j["company"],
                    apply_url=f"https://{j['platform']}.com/job/{j['job_id']}",
                    match_score=j["match_score"],
                    keywords_injected=j["keywords"],
                    resume_variant="engineering_v1",
                    tailored_resume=f"Test resume with {', '.join(j['keywords'])}",
                )
                await tailor_queue.enqueue(tr)
            log.detail("3 test TailoredResults injected into tailor_queue")
        else:
            fake = ApplicationPayload(
                job_id="test-001", platform="indeed",
                title="Backend Engineer", company="Razorpay",
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

    await asyncio.gather(radar_task, broker_task, tailor_task, fleet_task, guard_task, watchdog_task)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down NexApply...")
        sys.exit(0)
