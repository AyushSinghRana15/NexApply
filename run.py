import asyncio
import os
import sys

import uvicorn
import yaml

from api.core import runtime
from core.logger import Logger


async def inject_test_jobs():
    while not runtime.is_running():
        await asyncio.sleep(0.5)
    job_queue = runtime.get_job_queue()

    screenshots_dir = "logs/screenshots"
    os.makedirs(screenshots_dir, exist_ok=True)
    test_screenshot = os.path.join(screenshots_dir, "test-001_razorpay.png")
    if not os.path.exists(test_screenshot):
        from PIL import Image
        Image.new("RGB", (800, 600), color=(30, 41, 59)).save(test_screenshot)

    from core.models import JobEvent
    test_jobs = [
        JobEvent(
            job_id="test-001",
            platform="indeed",
            title="Backend Engineer",
            company="Razorpay",
            location="Remote",
            description="Backend Engineer role with Python, FastAPI, Redis",
            apply_url="https://in.indeed.com/viewjob?jk=test001",
        ),
        JobEvent(
            job_id="test-002",
            platform="naukri",
            title="Senior SDE",
            company="Google",
            location="Bangalore",
            description="Senior Software Engineer with system design, Python, Kubernetes",
            apply_url="https://naukri.com/job/test002",
        ),
        JobEvent(
            job_id="test-003",
            platform="internshala",
            title="Backend Intern",
            company="Salesforce",
            location="Remote",
            description="Backend internship with Python, SQL",
            apply_url="https://internshala.com/internship/test003",
        ),
    ]
    for fake in test_jobs:
        await asyncio.sleep(1)
        await job_queue.enqueue(fake)
        Logger().detail(f"Test job {fake.job_id} injected into job_queue")


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
            from core.resume_parser import parse_resume, merge_into_profile
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

    if "--test" in sys.argv:
        asyncio.create_task(inject_test_jobs())

    log.detail(f"API running → http://localhost:8000")
    log.detail(f"Frontend → http://localhost:5173")

    import webbrowser
    webbrowser.open("http://localhost:5173")

    log.start("NexApply ready")

    from api.main import app
    config_uv = uvicorn.Config(app, host="0.0.0.0", port=8000, log_level="error")
    server = uvicorn.Server(config_uv)
    await server.serve()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutting down NexApply...")
        sys.exit(0)