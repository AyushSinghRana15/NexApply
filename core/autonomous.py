import asyncio
import json
import os
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple

from core.logger import Logger
from core.models import TailoredResult

LOGS_FILE = "logs/applications.jsonl"


class AutonomousAgent:

    def __init__(self, config: dict):
        self.cfg = config
        self.autonomy = config.get("autonomy", {})
        self.safety = config.get("safety", {})
        self.log = Logger()
        self.daily_app_count = 0
        self.platform_count: Dict[str, int] = {}
        self.hourly_count = 0
        self.hour_reset = time.time()
        self.consecutive_failures = 0
        self.last_apply_time = 0.0
        self._applied_companies: Set[Tuple[str, str]] = set()
        self._load_applied()

    def _load_applied(self):
        if not os.path.exists(LOGS_FILE):
            return
        window_days = self.autonomy.get("duplicate_window_days", 30)
        cutoff = time.time() - (window_days * 86400)
        try:
            with open(LOGS_FILE) as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        entry = json.loads(line)
                        ts = entry.get("filled_at", entry.get("detected_at", ""))
                        if ts:
                            parsed = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                            if parsed.timestamp() >= cutoff:
                                company = entry.get("company", "")
                                title = entry.get("title", "")
                                if company and title:
                                    self._applied_companies.add((company.lower(), title.lower()))
                    except (json.JSONDecodeError, ValueError):
                        continue
            self.log.detail(f"Loaded {len(self._applied_companies)} applied jobs from history")
        except Exception as e:
            self.log.warn(f"Could not load applied jobs: {e}")

    async def decide(self, payload: TailoredResult) -> Tuple[str, str]:
        company = payload.company
        title = payload.title
        platform = payload.platform

        company_blacklisted, keyword_blacklisted = self._check_blacklist(payload)
        if company_blacklisted:
            return "SKIP", "company blacklisted"
        if keyword_blacklisted:
            return "SKIP", "keyword blacklisted"

        if self.daily_app_count >= self.autonomy.get("max_applications_per_day", 300):
            return "SKIP", "daily limit reached"

        platform_max = self.autonomy.get("max_per_platform", {}).get(platform, 100)
        if self.platform_count.get(platform, 0) >= platform_max:
            return "SKIP", f"{platform} daily limit reached"

        self._reset_hourly_if_needed()
        max_hourly = self.safety.get("max_applications_per_hour", 30)
        if self.hourly_count >= max_hourly:
            return "SKIP", "hourly rate limit reached"

        threshold = self.autonomy.get("auto_apply_threshold", 70)
        if payload.match_score < threshold:
            return "SKIP", f"score {payload.match_score} below threshold {threshold}"

        if self._is_duplicate(company, title):
            return "SKIP", "already applied to this role in last 30 days"

        cooldown = self.autonomy.get("cooldown_between_apps", 45)
        elapsed = time.time() - self.last_apply_time
        if elapsed < cooldown:
            wait = cooldown - elapsed
            self.log.detail(f"Cooldown: waiting {wait:.0f}s before next application")
            await asyncio.sleep(wait)

        return "APPROVE", "all checks passed"

    def _check_blacklist(self, payload: TailoredResult) -> Tuple[bool, bool]:
        company = payload.company.lower()
        description_words = (payload.tailored_resume or "").lower()
        title_lower = payload.title.lower()

        blacklist_companies = self.autonomy.get("blacklist_companies", [])
        for b in blacklist_companies:
            if b.lower() in company:
                return True, False

        blacklist_keywords = self.autonomy.get("blacklist_keywords", [])
        for k in blacklist_keywords:
            kw = k.lower()
            if kw in description_words or kw in title_lower:
                return False, True

        return False, False

    def _is_duplicate(self, company: str, title: str) -> bool:
        return (company.lower(), title.lower()) in self._applied_companies

    def record_apply(self, payload: TailoredResult):
        self.daily_app_count += 1
        self.platform_count[payload.platform] = self.platform_count.get(payload.platform, 0) + 1
        self.hourly_count += 1
        self.last_apply_time = time.time()
        self.consecutive_failures = 0
        self._applied_companies.add((payload.company.lower(), payload.title.lower()))

    def record_failure(self):
        self.consecutive_failures += 1

    def should_pause_for_failures(self) -> bool:
        max_fails = self.safety.get("max_failures_before_pause", 5)
        return self.consecutive_failures >= max_fails

    def _reset_hourly_if_needed(self):
        now = time.time()
        if now - self.hour_reset >= 3600:
            self.hourly_count = 0
            self.hour_reset = now

    def is_within_apply_hours(self) -> Tuple[bool, Optional[str]]:
        now = datetime.now().time()
        start_str = self.autonomy.get("apply_hours", {}).get("start", "08:00")
        end_str = self.autonomy.get("apply_hours", {}).get("end", "23:00")

        start_h, start_m = map(int, start_str.split(":"))
        end_h, end_m = map(int, end_str.split(":"))

        from datetime import time as dt_time
        start = dt_time(hour=start_h, minute=start_m)
        end = dt_time(hour=end_h, minute=end_m)

        if start <= now <= end:
            return True, None

        msg = f"Outside apply hours ({start_str}-{end_str})"
        return False, msg

    def is_skip_weekend(self) -> bool:
        return self.autonomy.get("skip_weekends", False)

    def mode(self) -> str:
        return self.autonomy.get("mode", "full")

    def get_daily_limit(self) -> int:
        return self.autonomy.get("max_applications_per_day", 300)

    def get_platform_limits(self) -> Dict[str, int]:
        return self.autonomy.get("max_per_platform", {"indeed": 100, "naukri": 100, "internshala": 100})
