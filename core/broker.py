import asyncio
import logging
import os
import re
from difflib import SequenceMatcher
from typing import List, Set

from core.logger import Logger
from core.models import JobEvent
from core.queue import JobQueue

ERROR_LOG = "logs/errors.log"


class QueueBroker:

    def __init__(self, config: dict, input_queue: JobQueue, output_queue: JobQueue):
        self.cfg = config
        self.input_queue = input_queue
        self.output_queue = output_queue
        self.log = Logger()
        self._filter_cfg = config.get("filters", {})
        self._autonomy = config.get("autonomy", {})

        self._allowed_titles: List[str] = [
            t.lower() for t in self._filter_cfg.get("titles", [])
        ]
        self._exclude_keywords: List[str] = [
            k.lower() for k in self._filter_cfg.get("exclude_keywords", [])
        ]
        self._allowed_locations: List[str] = [
            l.lower() for l in self._filter_cfg.get("locations", [])
        ]

        self._blacklist_companies: List[str] = [
            c.lower() for c in self._autonomy.get("blacklist_companies", [])
        ]
        self._blacklist_keywords: List[str] = [
            k.lower() for k in self._autonomy.get("blacklist_keywords", [])
        ]

        self._filtered_count = 0
        self._forwarded_count = 0

    async def start(self):
        self.log.info("QueueBroker started — filtering jobs between Radar and Tailor")
        asyncio.create_task(self._heartbeat())
        while True:
            event = await self.input_queue.dequeue()
            if event is None:
                await asyncio.sleep(0.1)
                continue
            asyncio.create_task(self._process_event(event))

    async def _process_event(self, event: JobEvent):
        decision, reason = self._check_event(event)
        if decision == "DROP":
            self.log.skip(event.platform, f"{event.title} @ {event.company}", reason)
            self._log_filtered(event, reason)
            self._filtered_count += 1
            return

        self.log.detail(f"QueueBroker: forwarding {event.title} @ {event.company}")
        await self.output_queue.enqueue(event)
        self._forwarded_count += 1

    def _check_event(self, event: JobEvent) -> tuple:
        title_lower = event.title.lower()
        company_lower = event.company.lower() if event.company else ""
        location_lower = event.location.lower() if event.location else ""
        desc_lower = event.description.lower() if event.description else ""
        full_text = f"{title_lower} {desc_lower}"

        for kw in self._exclude_keywords:
            if kw in full_text:
                return "DROP", f"exclude keyword '{kw}' matched"

        for kw in self._blacklist_keywords:
            if kw in full_text:
                return "DROP", f"blacklist keyword '{kw}' matched"

        for c in self._blacklist_companies:
            if c in company_lower:
                return "DROP", f"blacklisted company '{c}'"

        if self._allowed_titles:
            if not self._title_matches(title_lower):
                return "DROP", f"title '{event.title}' not in filter list"

        if self._allowed_locations:
            if not self._location_matches(location_lower):
                return "DROP", f"location '{event.location}' not in filter list"

        return "FORWARD", "passed all filters"

    def _title_matches(self, title_lower: str) -> bool:
        for allowed in self._allowed_titles:
            if allowed in title_lower:
                return True
            ratio = SequenceMatcher(None, allowed, title_lower).ratio()
            if ratio >= 0.7:
                return True
            allowed_words = set(allowed.split())
            title_words = set(title_lower.split())
            if allowed_words and title_words:
                overlap = allowed_words & title_words
                if len(overlap) / max(len(allowed_words), len(title_words)) >= 0.6:
                    return True
        return False

    def _location_matches(self, location_lower: str) -> bool:
        for allowed in self._allowed_locations:
            if allowed in location_lower or location_lower in allowed:
                return True
        return True

    def _log_filtered(self, event: JobEvent, reason: str):
        os.makedirs(os.path.dirname(ERROR_LOG), exist_ok=True)
        try:
            import json
            entry = {
                "type": "filter_drop",
                "job_id": event.job_id,
                "platform": event.platform,
                "title": event.title,
                "company": event.company,
                "reason": reason,
                "detected_at": event.detected_at,
            }
            with open(ERROR_LOG, "a") as f:
                f.write(json.dumps(entry, default=str) + "\n")
        except Exception:
            pass

    async def _heartbeat(self):
        while True:
            await asyncio.sleep(60)
            self.log.info(
                f"QueueBroker alive — {self._forwarded_count} forwarded, "
                f"{self._filtered_count} filtered out"
            )

    @property
    def filtered_count(self) -> int:
        return self._filtered_count

    @property
    def forwarded_count(self) -> int:
        return self._forwarded_count
