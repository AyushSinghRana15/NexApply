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

    def brain(self, msg: str):
        self._out(f"🧠 {msg}")

    def job_received(self, title: str, platform: str):
        self._out(f"📋 JOB RECEIVED — \"{title}\" ({platform})")

    def classify(self, category: str):
        self._out(f"🔍 Classified → category: {category}")

    def variant(self, variant: str):
        self._out(f"📄 Selected resume variant → {variant}")

    def llm_call(self, msg: str):
        self._out(f"⚡ {msg}")

    def keywords_extracted(self, kws: list):
        self._out(f"🔑 Keywords extracted → {', '.join(kws)}")

    def tailored(self, score: int):
        self._out(f"✅ Resume tailored — match score: {score}/100")

    def saved(self, path: str):
        self._out(f"💾 Saved → {path}")

    def queued_tailor(self):
        self._out(f"📤 TailoredResult queued → ready for ApplyFleet (Phase 3)")

    def tailor_heartbeat(self, tailored: int, skipped: int, reason: str = ""):
        suffix = f" ({reason})" if reason else ""
        self._out(f"🧠 TailorAgent alive — {tailored} tailored, {skipped} skipped{suffix}")

    def fleet_start(self, msg: str):
        self._out(f"🚀 {msg}")

    def cookies_status(self, platform: str, status: str):
        emoji = "✅" if "loaded" in status else "⚠️"
        self._out(f"{emoji} {platform.capitalize()} cookies {status}")

    def applying(self, title: str, platform: str):
        self._out(f"🌐 APPLYING — \"{title}\" ({platform})")

    def browser_open(self, msg: str):
        self._out(f"🔓 {msg}")

    def filling(self, field: str, value: str):
        display = value[:40] + "..." if len(value) > 40 else value
        self._out(f"📝 Filling field: {field} → \"{display}\"")

    def uploading(self, path: str):
        self._out(f"📎 Uploading resume → {path}")

    def screenshot_saved(self, path: str):
        self._out(f"📸 Screenshot saved → {path}")

    def paused(self, msg: str):
        self._out(f"⏸️  {msg}")

    def fleet_queued(self):
        self._out("📤 ApplicationPayload sent to guard_queue")

    def fleet_heartbeat(self, pending: int, failed: int, manual: int):
        self._out(f"🚀 ApplyFleet alive — {pending} pending, {failed} failed, {manual} manual")
