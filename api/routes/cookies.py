import os
from datetime import datetime, timezone

import yaml
from fastapi import APIRouter

router = APIRouter(prefix="/api/cookies", tags=["cookies"])

COOKIES_DIR = "cookies"


def _load_config_platforms() -> dict:
    try:
        with open("config.yaml") as f:
            config = yaml.safe_load(f) or {}
        return config.get("platforms", {}) or {}
    except Exception:
        return {}


@router.get("/status")
def cookie_status():
    platforms = _load_config_platforms()
    result = {}
    for platform, enabled in platforms.items():
        path = os.path.join(COOKIES_DIR, f"{platform}_cookies.json")
        loaded = os.path.exists(path)
        last_captured = None
        if loaded:
            try:
                ts = os.path.getmtime(path)
                last_captured = datetime.fromtimestamp(ts, timezone.utc).isoformat()
            except OSError:
                pass
        result[platform] = {
            "enabled": bool(enabled),
            "loaded": loaded,
            "last_captured": last_captured,
        }
    return {"platforms": result}