import json
import os
from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("/activity")
def get_activity():
    items = []
    log_files = [
        "logs/applications.jsonl",
        "logs/guard_decisions.jsonl",
    ]
    for lf in log_files:
        if not os.path.exists(lf):
            continue
        try:
            with open(lf) as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        items.append({
                            "id": len(items) + 1,
                            "type": entry.get("decision", entry.get("status", "event")),
                            "message": f"{entry.get('title', '')} @ {entry.get('company', '')} — {entry.get('decision', entry.get('status', ''))}",
                            "timestamp": entry.get("decided_at", entry.get("created_at", datetime.now(timezone.utc).isoformat())),
                            "data": entry,
                        })
                    except (json.JSONDecodeError, KeyError):
                        continue
        except (IOError, OSError):
            continue
    items.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"items": items[:100]}
