from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from api.core.config import settings
from api.db.database import Base, engine
from api.routes import applications, config, jobs, resumes, stats, ws


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="NexApply API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs.router)
app.include_router(applications.router)
app.include_router(stats.router)
app.include_router(resumes.router)
app.include_router(config.router)
app.include_router(ws.router)

if Path("logs/screenshots").exists():
    app.mount("/screenshots", StaticFiles(directory="logs/screenshots"), name="screenshots")
