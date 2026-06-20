import sys
from datetime import datetime


class Logger:

    def _ts(self) -> str:
        return datetime.now().strftime("%H:%M:%S")

    def _out(self, msg: str):
        print(f"[{self._ts()}] {msg}", flush=True)

    def info(self, msg: str):
        self._out(f"ℹ️  {msg}")

    def start(self, msg: str):
        self._out(f"🚀 {msg}")

    def feed(self, msg: str):
        self._out(f"📡 {msg}")

    def scraper(self, msg: str):
        self._out(f"🌐 {msg}")

    def new_job(self, platform: str, title: str, posted: str):
        self._out(f"✅ NEW JOB — {platform} | \"{title}\" | Posted {posted}")

    def queued(self, job_id: str, platform: str):
        self._out(f"📥 Queued → job_id: {job_id} | platform: {platform} | match pending")

    def skip(self, platform: str, title: str, reason: str):
        self._out(f"⏭️  SKIP — {platform} | \"{title}\" — {reason}")

    def warn(self, msg: str):
        self._out(f"⚠️  {msg}")

    def error(self, msg: str):
        self._out(f"❌ {msg}")

    def heartbeat(self, queued: int, seen: int, skipped: int):
        self._out(f"💓 RadarAgent alive — {queued} jobs queued, {seen} seen, {skipped} skipped")

    def detail(self, msg: str):
        self._out(f"  · {msg}")
