from datetime import datetime, timezone

from fastapi import APIRouter
from sqlalchemy import text

from api.core.config import settings
from api.db.database import SessionLocal

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
def health_check():
    db_ok = False
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1"))
        db.close()
        db_ok = True
    except Exception:
        pass

    redis_ok = "fallback"
    try:
        import redis as redis_mod
        r = redis_mod.from_url(settings.redis_url)
        r.ping()
        redis_ok = "ok"
    except Exception:
        pass

    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "agents": {
            "radar": "online",
            "tailor": "online",
            "fleet": "online",
            "guard": "online",
        },
        "database": "ok" if db_ok else "unreachable",
        "redis": redis_ok,
        "groq": "configured" if settings.groq_api_key else "missing",
    }
