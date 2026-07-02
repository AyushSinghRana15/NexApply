import asyncio
import os
import sys
import time as time_mod
from datetime import datetime
from datetime import time as dt_time

import uvicorn
import yaml

from api.main import app
from core.autonomous import AutonomousAgent
from core.broker import QueueBroker
from core.fleet import ApplyFleet
from core.guard import GuardAgent
from core.logger import Logger
from core.queue import JobQueue
from core.radar import RadarAgent
from core.tailor import TailorAgent
from core.resume_parser import parse_resume, merge_into_profile


async def watchdog(config: dict, log: Logger):
    autonomy = config.get("autonomy", {})
    safety = config.get("safety", {})
    stop_file = safety.get("emergency_stop_file", "STOP")
    apply_hours = autonomy.get("apply_hours", {"start": "08:00", "end": "23:00"})
    skip_weekends = autonomy.get("skip_weekends", False)
    max_fails = safety.get("max_failures_before_pause", 5)
    consecutive_failures = 0
    report_hour = safety.get("report_hour", 21)
    last_report_date = ""

    while True:
        if os.path.exists(stop_file):
            log.critical(f"STOP file detected — shutting down all agents")
            log.warn("Remove STOP file and restart to resume")
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
        current_t = now.time()

        if not (start_t <= current_t <= end_t):
            if current_t > end_t:
                next_start = datetime(now.year, now.month, now.day, start_h, start_m)
                if next_start <= now:
                    next_start = datetime(now.year, now.month, now.day + 1, start_h, start_m)
                delta = (next_start - now).total_seconds()
                log.watchdog_sleep(f"Outside apply hours ({start_str}-{end_str}) — sleeping {delta/3600:.1f}h until {start_str}")
                await asyncio.sleep(min(delta, 3600))
            else:
                next_start = datetime(now.year, now.month, now.day, start_h, start_m)
                delta = (next_start - now).total_seconds()
                log.watchdog_sleep(f"Before apply hours — sleeping {delta/3600:.1f}h until {start_str}")
                await asyncio.sleep(min(delta, 3600))
            continue

        if skip_weekends and now.weekday() >= 5:
            days_until_monday = (7 - now.weekday()) % 7
            if days_until_monday == 0:
                days_until_monday = 7
            log.watchdog_sleep(f"Weekend — skipping until Monday")
            await asyncio.sleep(days_until_monday * 86400)
            continue

        today_str = now.strftime("%Y-%m-%d")
        if safety.get("daily_report", False) and report_hour and last_report_date != today_str:
            if now.hour >= report_hour:
                try:
                    from api.services.daily_report import DailyReport
                    report = DailyReport()
                    subject, body = await report.generate()
                    log.report_sent(subject)
                    last_report_date = today_str
                except Exception as e:
                    log.warn(f"Daily report error: {e}")

        await asyncio.sleep(30)


def _count_recent_failures(window_minutes: int = 10) -> int:
    try:
        with open("logs/applications.jsonl") as f:
            lines = f.readlines()
    except (FileNotFoundError, OSError):
        return 0

    cutoff = time_mod.time() - (window_minutes * 60)
    count = 0
    for line in lines:
        line = line.strip()
        if not line:
            continue
        try:
            import json
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


async def start_agents(config: dict, log: Logger):
    job_queue = JobQueue()
    filtered_queue = JobQueue()
    tailor_queue = JobQueue()
    guard_queue = JobQueue()

    radar = RadarAgent(config, job_queue)
    broker = QueueBroker(config, job_queue, filtered_queue)
    tailor = TailorAgent(config, filtered_queue, tailor_queue)
    fleet = ApplyFleet(config, tailor_queue, guard_queue)

    mode = config.get("autonomy", {}).get("mode", "full")
    need_guard = mode != "full"

    if need_guard:
        from api.core.websocket import ws_manager as api_ws
        guard = GuardAgent(config, guard_queue, api_ws)
        asyncio.create_task(guard.start())
        log.start("GuardAgent started — supervising applications")
    else:
        log.start("GuardAgent bypassed — fully autonomous mode")

    asyncio.create_task(radar.start())
    asyncio.create_task(broker.start())
    asyncio.create_task(tailor.start())
    asyncio.create_task(fleet.start())
    log.start("Agent pipeline started")

    asyncio.create_task(watchdog(config, log))
    log.start("Watchdog started — monitoring health, hours, STOP file")

    if "--test" in sys.argv:
        screenshots_dir = "logs/screenshots"
        os.makedirs(screenshots_dir, exist_ok=True)
        test_screenshot = os.path.join(screenshots_dir, "test-001_razorpay.png")
        if not os.path.exists(test_screenshot):
            from PIL import Image
            Image.new("RGB", (800, 600), color=(30, 41, 59)).save(test_screenshot)

        from core.models import ApplicationPayload
        test_jobs = [
            ApplicationPayload(
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
            ),
            ApplicationPayload(
                job_id="test-002",
                platform="naukri",
                title="Senior SDE",
                company="Google",
                apply_url="https://naukri.com/job/test002",
                match_score=92,
                keywords_injected=["System Design", "Python", "Kubernetes"],
                resume_variant="engineering_v1",
                screenshot_path=test_screenshot,
                status=ApplicationPayload.STATUS_PENDING_REVIEW,
                approval_event=asyncio.Event(),
            ),
            ApplicationPayload(
                job_id="test-003",
                platform="internshala",
                title="Backend Intern",
                company="Salesforce",
                apply_url="https://internshala.com/internship/test003",
                match_score=45,
                keywords_injected=["Python", "SQL"],
                resume_variant="engineering_v1",
                screenshot_path=test_screenshot,
                status=ApplicationPayload.STATUS_PENDING_REVIEW,
                approval_event=asyncio.Event(),
            ),
        ]

        # In autonomous mode the test payloads go directly to fleet via tailor_queue as TailoredResults
        if mode == "full":
            from core.models import TailoredResult
            for fake in test_jobs:
                tr = TailoredResult(
                    job_id=fake.job_id,
                    platform=fake.platform,
                    title=fake.title,
                    company=fake.company,
                    apply_url=fake.apply_url,
                    match_score=fake.match_score,
                    keywords_injected=fake.keywords_injected,
                    resume_variant=fake.resume_variant,
                    tailored_resume="Test resume content with {{KEYWORDS}}".replace("{{KEYWORDS}}", ", ".join(fake.keywords_injected)),
                )
                await asyncio.sleep(1)
                await tailor_queue.enqueue(tr)
                log.detail(f"Test payload {fake.job_id} injected into tailor_queue")
        else:
            for fake in test_jobs:
                await asyncio.sleep(1)
                await guard_queue.enqueue(fake)
                log.detail(f"Test payload {fake.job_id} injected into guard_queue")


async def main():
    log = Logger()

    log.start("NexApply starting...")

    os.makedirs("logs", exist_ok=True)
    os.makedirs("logs/screenshots", exist_ok=True)
    os.makedirs("documents/certificates", exist_ok=True)
    os.makedirs("documents/internship_letters", exist_ok=True)
    os.makedirs("documents/offer_letters", exist_ok=True)
    os.makedirs("documents/marksheets", exist_ok=True)
    os.makedirs("documents/photo", exist_ok=True)
    os.makedirs("cookies", exist_ok=True)

    try:
        with open("config.yaml") as f:
            config = yaml.safe_load(f)
    except FileNotFoundError:
        log.error("config.yaml not found")
        config = {}

    resume_arg = None
    if "--resume" in sys.argv:
        idx = sys.argv.index("--resume")
        if idx + 1 < len(sys.argv) and not sys.argv[idx + 1].startswith("--"):
            resume_arg = sys.argv[idx + 1]
    if resume_arg:
        log.detail(f"Parsing resume: {resume_arg}")
        try:
            parsed = parse_resume(resume_arg)
            log.success(f"Resume parsed — found {len(parsed.get('skills', {}).get('primary', []))} skills, "
                        f"{len(parsed.get('experience', []))} experiences, "
                        f"{len(parsed.get('projects', []))} projects")
            try:
                with open("profile.yaml") as f:
                    profile_data = yaml.safe_load(f) or {}
                merged = merge_into_profile(parsed, profile_data)
                with open("profile.yaml", "w") as f:
                    yaml.dump(merged, f, default_flow_style=False, sort_keys=False)
                log.success("Profile.yaml updated from parsed resume")
            except Exception as e:
                log.warn(f"Failed to update profile from resume: {e}")
            config.setdefault("tailor", {})["use_user_resume"] = True
            log.detail("Enabled use_user_resume in config")
        except Exception as e:
            log.error(f"Failed to parse resume: {e}")

    mode = config.get("autonomy", {}).get("mode", "full")
    profile_name = "Ayush Singh Rana"

    try:
        with open("profile.yaml") as f:
            profile = yaml.safe_load(f)
        profile_name = profile.get("personal", {}).get("full_name", profile_name)
    except Exception:
        pass

    if mode == "full":
        daily_target = config.get("autonomy", {}).get("max_applications_per_day", 300)
        log.autonomous_start(mode.upper(), profile_name, daily_target)

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
    log.start("Scheduler started — Gmail scan every 15min, optimizer 2AM")

    frontend_url = "http://localhost:5173"
    log.detail(f"API running → http://localhost:8000")
    log.detail(f"Frontend → {frontend_url}")

    import webbrowser
    webbrowser.open(frontend_url)

    log.start("NexApply ready")

    config_uv = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="error")
    server = uvicorn.Server(config_uv)
    await server.serve()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down NexApply...")
        sys.exit(0)
