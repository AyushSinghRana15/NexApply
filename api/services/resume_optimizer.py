import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from api.core.websocket import ws_manager
from api.models.application import Application


class ResumeOptimizer:
    """Analyzes resume variant performance and generates improvement suggestions."""

    def _generate_suggestions(self, variant: str, avg_score: float) -> list[str]:
        suggestions = {
            "engineering": [
                "Add more quantifiable impact metrics in experience section",
                "Include relevant system design keywords from recent job postings",
                "Strengthen the projects section with tech stack details",
            ],
            "data": [
                "Emphasize ML model deployment and production experience",
                "Add specific frameworks and libraries used in projects",
                "Include data pipeline and ETL experience keywords",
            ],
            "product": [
                "Highlight cross-functional collaboration examples",
                "Add metrics-driven decision making case studies",
                "Include A/B testing and product analytics experience",
            ],
        }
        for key, items in suggestions.items():
            if key in variant.lower():
                return items
        return [
            f"Review keyword density for target job descriptions (avg score: {avg_score:.0f}/100)",
            "Add more role-specific terminology and industry keywords",
            "Consider restructuring for better ATS compatibility",
        ]

    async def run(self, db: Session) -> list[dict]:
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        apps = db.query(Application).filter(
            Application.created_at >= cutoff
        ).all()

        variant_scores = defaultdict(list)
        for a in apps:
            if a.resume_variant:
                variant_scores[a.resume_variant].append(a.match_score)

        suggestions = []
        log_path = Path("logs/resume_suggestions.jsonl")
        log_path.parent.mkdir(parents=True, exist_ok=True)

        for variant, scores in variant_scores.items():
            avg_score = sum(scores) / len(scores)
            entry = {
                "variant": variant,
                "avg_score": round(avg_score, 1),
                "application_count": len(scores),
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
            if avg_score < 70:
                entry["suggestions"] = self._generate_suggestions(variant, avg_score)
                suggestions.append(entry)

            with log_path.open("a") as f:
                f.write(json.dumps(entry) + "\n")

            await ws_manager.broadcast_event(
                "RESUME_SUGGESTION",
                variant=variant,
                avg_score=round(avg_score, 1),
                application_count=len(scores),
                suggestions=entry.get("suggestions", []),
            )

        return suggestions


resume_optimizer = ResumeOptimizer()
