import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

import yaml

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.core.config import settings
from api.db.database import Base, engine
from api.middleware.error_handler import setup_error_handlers
from api.middleware.logging import LoggingMiddleware
from api.routes import applications, config, health, jobs, logs, resumes, stats, ws

os.makedirs("logs", exist_ok=True)

_agent_tasks: list[asyncio.Task] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _run_migrations()
    from api.services.scheduler import start_scheduler
    start_scheduler()
    _start_agents()
    yield
    for t in _agent_tasks:
        t.cancel()
    from api.services.scheduler import stop_scheduler
    stop_scheduler()


def _start_agents():
    try:
        with open("config.yaml") as f:
            config = yaml.safe_load(f) or {}
        from core.queue import JobQueue
        from core.radar import RadarAgent
        from core.tailor import TailorAgent
        from core.fleet import ApplyFleet
        from core.logger import Logger
        log = Logger()

        job_queue = JobQueue()
        tailor_queue = JobQueue()
        guard_queue = JobQueue()

        radar = RadarAgent(config, job_queue)
        tailor = TailorAgent(config, job_queue, tailor_queue)
        fleet = ApplyFleet(config, tailor_queue, guard_queue)

        mode = config.get("autonomy", {}).get("mode", "full")
        need_guard = mode != "full"

        if need_guard:
            from api.core.websocket import ws_manager as api_ws
            from core.guard import GuardAgent
            guard = GuardAgent(config, guard_queue, api_ws)
            _agent_tasks.append(asyncio.create_task(guard.start()))

        _agent_tasks.append(asyncio.create_task(radar.start()))
        _agent_tasks.append(asyncio.create_task(tailor.start()))
        _agent_tasks.append(asyncio.create_task(fleet.start()))
        log.start("Agent pipeline started via API lifespan")
    except Exception as e:
        print(f"[nexapply] Failed to start agents: {e}")


def _run_migrations():
    try:
        from sqlalchemy import inspect, text as sa_text
        from api.db.database import SessionLocal
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        if "resume_variants" not in tables:
            return
        existing = {c["name"] for c in inspector.get_columns("resume_variants")}
        with SessionLocal() as conn:
            if "parsed_data" not in existing:
                conn.execute(sa_text("ALTER TABLE resume_variants ADD COLUMN parsed_data TEXT"))
            if "source_file" not in existing:
                conn.execute(sa_text("ALTER TABLE resume_variants ADD COLUMN source_file VARCHAR(256)"))
            conn.commit()
    except Exception:
        pass



app = FastAPI(title="NexApply API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(LoggingMiddleware)

setup_error_handlers(app)

app.include_router(health.router)
app.include_router(jobs.router)
app.include_router(applications.router)
app.include_router(stats.router)
app.include_router(resumes.router)
app.include_router(config.router)
app.include_router(ws.router)
app.include_router(logs.router)

if Path("logs/screenshots").exists():
    app.mount("/screenshots", StaticFiles(directory="logs/screenshots"), name="screenshots")
