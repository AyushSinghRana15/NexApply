import asyncio
import json
import os
import time as time_mod
from datetime import datetime
from datetime import time as dt_time
from datetime import timezone
from typing import Any, Dict, Optional

from core.logger import Logger

_log = Logger()

_runtime: Dict[str, Any] = {
    "job_queue": None,
    "radar": None,
    "graph_worker": None,
    "watchdog": None,
    "tasks": [],
    "started_at": None,
}


def is_running() -> bool:
    return _runtime["job_queue"] is not None


def get_job_queue():
    return _runtime["job_queue"]


async def start_agent_stack(config: dict):
    if is_running():
        return
    from core.graph_worker import GraphWorker
    from core.queue import JobQueue
    from core.radar import RadarAgent

    job_queue = JobQueue()
    radar = RadarAgent(config, job_queue)
    worker = GraphWorker(config, job_queue)

    _runtime["job_queue"] = job_queue
    _runtime["radar"] = radar
    _runtime["graph_worker"] = worker
    _runtime["started_at"] = datetime.now(timezone.utc).isoformat()

    _runtime["tasks"].append(asyncio.create_task(radar.start()))
    _runtime["tasks"].append(asyncio.create_task(worker.start()))
    _runtime["tasks"].append(asyncio.create_task(watchdog_loop(config)))

    _log.start("Agent pipeline started — RadarAgent + GraphWorker (LangGraph)")
    return job_queue


async def stop_agent_stack():
    for t in _runtime["tasks"]:
        t.cancel()
    _runtime["tasks"].clear()


def get_agent_status() -> dict:
    radar = _runtime.get("radar")
    worker = _runtime.get("graph_worker")
    watchdog = _runtime.get("watchdog")
    return {
        "radar": {
            "state": "online" if radar else "offline",
            "queue_size": radar.queue.qsize() if radar else None,
            "started_at": _runtime.get("started_at"),
        },
        "graph_worker": {
            "state": "online" if worker else "offline",
            "processed": worker._processed if worker else None,
            "failed": worker._failed if worker else None,
            "started_at": _runtime.get("started_at"),
        },
        "watchdog": {
            "state": "online" if watchdog else "offline",
        },
    }


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


async def watchdog_loop(config: dict):
    autonomy = config.get("autonomy", {})
    safety = config.get("safety", {})
    stop_file = safety.get("emergency_stop_file", "STOP")
    apply_hours = autonomy.get("apply_hours", {"start": "08:00", "end": "23:00"})
    skip_weekends = autonomy.get("skip_weekends", False)
    max_fails = safety.get("max_failures_before_pause", 5)
    report_hour = safety.get("report_hour", 21)
    last_report_date = ""

    from api.core import runtime as _self
    _self._runtime["watchdog"] = asyncio.current_task()

    while True:
        try:
            if os.path.exists(stop_file):
                _log.critical(f"STOP file detected — shutting down all agents")
                _log.warn("Remove STOP file and restart to resume")
                os._exit(0)

            recent = _count_recent_failures()
            if recent >= max_fails:
                _log.warn(f"{recent} failures detected — pausing 10 minutes")
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
                    _log.watchdog_sleep(f"Outside apply hours ({start_str}-{end_str}) — sleeping {delta/3600:.1f}h until {start_str}")
                    await asyncio.sleep(min(delta, 3600))
                else:
                    next_start = datetime(now.year, now.month, now.day, start_h, start_m)
                    delta = (next_start - now).total_seconds()
                    _log.watchdog_sleep(f"Before apply hours — sleeping {delta/3600:.1f}h until {start_str}")
                    await asyncio.sleep(min(delta, 3600))
                continue

            if skip_weekends and now.weekday() >= 5:
                days_until_monday = (7 - now.weekday()) % 7
                if days_until_monday == 0:
                    days_until_monday = 7
                _log.watchdog_sleep(f"Weekend — skipping until Monday")
                await asyncio.sleep(days_until_monday * 86400)
                continue

            today_str = now.strftime("%Y-%m-%d")
            if safety.get("daily_report", False) and report_hour and last_report_date != today_str:
                if now.hour >= report_hour:
                    try:
                        from api.services.daily_report import DailyReport
                        report = DailyReport()
                        subject, body = await report.generate()
                        _log.report_sent(subject)
                        last_report_date = today_str
                    except Exception as e:
                        _log.warn(f"Daily report error: {e}")

            await asyncio.sleep(30)
        except asyncio.CancelledError:
            return
        except Exception as e:
            _log.warn(f"Watchdog error: {e}")
            await asyncio.sleep(30)