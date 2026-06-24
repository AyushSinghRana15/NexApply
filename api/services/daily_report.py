import json
import os
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List, Optional


class DailyReport:

    def __init__(self):
        self.logs_file = "logs/applications.jsonl"

    def _load_today_applications(self) -> List[Dict]:
        today = date.today()
        apps = []
        if not os.path.exists(self.logs_file):
            return apps
        with open(self.logs_file) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    ts = entry.get("filled_at", entry.get("detected_at", ""))
                    if ts:
                        entry_date = datetime.fromisoformat(ts.replace("Z", "+00:00")).date()
                        if entry_date == today:
                            apps.append(entry)
                except (json.JSONDecodeError, ValueError):
                    continue
        return apps

    def _load_week_applications(self) -> List[Dict]:
        week_ago = date.today() - timedelta(days=7)
        apps = []
        if not os.path.exists(self.logs_file):
            return apps
        with open(self.logs_file) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    entry = json.loads(line)
                    ts = entry.get("filled_at", entry.get("detected_at", ""))
                    if ts:
                        entry_date = datetime.fromisoformat(ts.replace("Z", "+00:00")).date()
                        if entry_date >= week_ago:
                            apps.append(entry)
                except (json.JSONDecodeError, ValueError):
                    continue
        return apps

    def _get_response_data(self) -> Dict:
        from api.services.gmail_tracker import GmailTracker
        tracker = GmailTracker()
        today = date.today()
        interviews = 0
        confirmations = 0
        rejections = 0
        interview_details = []
        confirmation_details = []
        rejection_details = []

        try:
            import asyncio
            results = asyncio.run(tracker.classify_recent_emails())
            for app_id, email_info in results.items():
                status = email_info.get("email_status", "")
                if status == "INTERVIEW":
                    interviews += 1
                    interview_details.append(f"  - {email_info.get('company', 'Unknown')}: {email_info.get('title', 'Unknown')}")
                elif status == "CONFIRMATION":
                    confirmations += 1
                    confirmation_details.append(f"  - {email_info.get('company', 'Unknown')}: {email_info.get('title', 'Unknown')}")
                elif status == "REJECTION":
                    rejections += 1
                    rejection_details.append(f"  - {email_info.get('company', 'Unknown')}: {email_info.get('title', 'Unknown')}")
        except Exception:
            pass

        return {
            "interviews": interviews,
            "confirmations": confirmations,
            "rejections": rejections,
            "interview_details": interview_details,
            "confirmation_details": confirmation_details,
            "rejection_details": rejection_details,
        }

    async def generate(self) -> str:
        today = date.today()
        today_str = today.strftime("%d %b %Y")

        apps = self._load_today_applications()
        week_apps = self._load_week_applications()

        applied = sum(1 for a in apps if a.get("status") == "APPLIED" or a.get("decision") == "APPROVE")
        skipped = sum(1 for a in apps if a.get("status") in ("SKIPPED",) or a.get("decision") in ("SKIP", "TIMEOUT"))
        failed = sum(1 for a in apps if a.get("status") == "FAILED")
        scores = [a.get("match_score", 0) for a in apps if a.get("match_score", 0) > 0]
        avg_score = round(sum(scores) / len(scores)) if scores else 0

        sorted_apps = sorted(
            [a for a in apps if a.get("match_score", 0) > 0],
            key=lambda x: x.get("match_score", 0),
            reverse=True,
        )[:3]

        response_data = self._get_response_data()

        week_applied = sum(1 for a in week_apps if a.get("status") == "APPLIED" or a.get("decision") == "APPROVE")
        week_responses = response_data["interviews"] + response_data["confirmations"] + response_data["rejections"]
        response_rate = round((week_responses / week_applied * 100)) if week_applied > 0 else 0
        interview_rate = round((response_data["interviews"] / week_applied * 100)) if week_applied > 0 else 0

        issues = []
        if failed > 0:
            issues.append(f"  - {failed} applications failed")
        inactive_platforms = self._check_inactive_platforms()
        issues.extend(inactive_platforms)

        uptime = self._get_uptime()

        subject = f"NexApply Daily Report — {today_str} — {applied} Applications"

        body = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━
NexApply Daily Report — {today_str}
━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 TODAY'S SUMMARY
Applied:   {applied}
Skipped:   {skipped}
Failed:    {failed}
Avg Score: {avg_score}/100

🏆 TOP APPLICATIONS (by match score)
"""
        if sorted_apps:
            for i, a in enumerate(sorted_apps, 1):
                body += f"{i}. {a.get('title', 'Unknown')} @ {a.get('company', 'Unknown')} ({a.get('platform', 'Unknown')}) — score: {a.get('match_score', 0)}\n"
        else:
            body += "  No applications today\n"

        body += f"""
📧 RESPONSES RECEIVED
🎉 Interviews: {response_data['interviews']}
"""
        for detail in response_data["interview_details"]:
            body += f"{detail}\n"
        body += f"📧 Confirmations: {response_data['confirmations']}\n"
        for detail in response_data["confirmation_details"]:
            body += f"{detail}\n"
        body += f"❌ Rejections: {response_data['rejections']}\n"
        for detail in response_data["rejection_details"]:
            body += f"{detail}\n"

        body += f"""
⚠️  ISSUES
"""
        if issues:
            for issue in issues:
                body += f"{issue}\n"
        else:
            body += "  None — all platforms healthy\n"

        body += f"""
📈 THIS WEEK
Total Applied: {week_applied}
Response Rate: {response_rate}%
Interview Rate: {interview_rate}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━
NexApply running since {uptime}
Next report tomorrow at 9PM
"""
        return subject, body

    def _check_inactive_platforms(self) -> List[str]:
        issues = []
        import yaml
        try:
            with open("config.yaml") as f:
                cfg = yaml.safe_load(f)
            platforms = cfg.get("platforms", {})
            for p, enabled in platforms.items():
                if not enabled:
                    issues.append(f"  - {p.capitalize()} is disabled")
        except Exception:
            pass
        return issues

    def _get_uptime(self) -> str:
        proc_file = "/proc/uptime"
        if os.path.exists(proc_file):
            try:
                with open(proc_file) as f:
                    uptime_seconds = float(f.read().split()[0])
                hours = int(uptime_seconds // 3600)
                minutes = int((uptime_seconds % 3600) // 60)
                return f"{hours}h {minutes}m"
            except Exception:
                pass
        return "N/A"
