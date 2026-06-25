import asyncio
import json
import os

from core.classifier import classify_job
from core.llm import answer_screening_question, extract_keypoints, generate_cover_letter
from core.logger import Logger
from core.models import JobEvent, TailoredResult
from core.queue import JobQueue
from core.scorer import compute_score
from core.resume_parser import build_resume_text, parse_resume

VARIANT_MAP = {
    "engineering": "engineering_v1.txt",
    "data": "data_v1.txt",
    "product": "product_v1.txt",
    "devops": "devops_v1.txt",
    "design": "design_v1.txt",
    "ml": "ml_v1.txt",
}

BASE_RESUMES_DIR = "resumes"
LOGS_RESUMES_DIR = "logs/resumes"
DEFAULT_PREFERRED_CATEGORIES = ["engineering"]


class TailorAgent:

    def __init__(self, config: dict, input_queue: JobQueue, output_queue: JobQueue):
        self.cfg = config
        self.input_queue = input_queue
        self.output_queue = output_queue
        self.log = Logger()
        self._tailored_count = 0
        self._skipped_count = 0
        self._min_score = config.get("tailor", {}).get("min_match_score", 60)
        self._gen_cover = config.get("tailor", {}).get("generate_cover_letter", True)
        self._preferred_categories = config.get("profile", {}).get(
            "categories", DEFAULT_PREFERRED_CATEGORIES
        )
        self._preferred_locations = config.get("filters", {}).get("locations", ["Remote"])
        self._profile = self._load_profile()
        self._parsed_resume_data = self._load_parsed_resume()
        os.makedirs(LOGS_RESUMES_DIR, exist_ok=True)

    def _load_profile(self) -> dict:
        import yaml
        try:
            with open("profile.yaml") as f:
                return yaml.safe_load(f)
        except Exception:
            return {}

    def _load_parsed_resume(self) -> dict | None:
        use_user = self.cfg.get("tailor", {}).get("use_user_resume", False)
        if not use_user:
            return None

        db = None
        try:
            from api.db.database import SessionLocal
            from api.models.resume import ResumeVariant
            db = SessionLocal()
            variant = (
                db.query(ResumeVariant)
                .filter(ResumeVariant.parsed_data.isnot(None), ResumeVariant.is_active == True)
                .order_by(ResumeVariant.created_at.desc())
                .first()
            )
            if variant and variant.parsed_data:
                self.log.detail(f"Loaded parsed resume variant: {variant.name}")
                return variant.parsed_data
        except Exception:
            pass
        finally:
            if db:
                db.close()

        pdf_paths = [
            os.path.join(BASE_RESUMES_DIR, f)
            for f in os.listdir(BASE_RESUMES_DIR)
            if f.lower().endswith(".pdf")
        ]
        if pdf_paths:
            path = pdf_paths[0]
            self.log.detail(f"Parsing PDF resume: {path}")
            try:
                return parse_resume(path)
            except Exception as e:
                self.log.warn(f"Failed to parse resume PDF: {e}")

        return None

    async def start(self):
        self.log.brain("TailorAgent started — watching queue")
        asyncio.create_task(self._heartbeat())
        while True:
            event = await self.input_queue.dequeue()
            if event is None:
                await asyncio.sleep(0.1)
                continue
            asyncio.create_task(self._process_job(event))

    async def _process_job(self, event: JobEvent):
        self.log.job_received(f"{event.title} @ {event.company}", event.platform)

        category = classify_job(event.title, event.description)
        self.log.classify(category)

        variant_name = VARIANT_MAP.get(category, VARIANT_MAP["engineering"])
        variant_path = os.path.join(BASE_RESUMES_DIR, variant_name)

        base_resume = None

        if self._parsed_resume_data:
            self.log.detail("Using parsed resume data — building dynamic template")
            base_resume = build_resume_text(
                self._parsed_resume_data,
                category=category,
            )
            variant_name = f"parsed_{category}"

        if base_resume is None:
            if not os.path.exists(variant_path):
                variant_path = os.path.join(BASE_RESUMES_DIR, VARIANT_MAP["engineering"])
                variant_name = VARIANT_MAP["engineering"]

            with open(variant_path) as f:
                base_resume = f.read()

        self.log.variant(variant_name)

        use_llm = self.cfg.get("tailor", {}).get("use_llm", True)
        if use_llm:
            self.log.llm_call("Groq API called — extracting keywords...")
            keywords, llm_used = await extract_keypoints(
                event.description, event.title, self.cfg
            )
            self.log.keywords_extracted(keywords)
        else:
            keywords = []
            llm_used = "none"
            self.log.llm_call("LLM disabled — using title-based keywords")
            from core.llm import _fallback_from_title
            keywords = _fallback_from_title(event.title)
            self.log.keywords_extracted(keywords)

        tailored = base_resume.replace("{{KEYWORDS}}", ", ".join(keywords))

        score = compute_score(
            category=category,
            keywords=keywords,
            base_resume_text=base_resume,
            job_location=event.location,
            preferred_categories=self._preferred_categories,
            preferred_locations=self._preferred_locations,
        )

        if score < self._min_score:
            self.log.warn(
                f"Match score {score} below threshold {self._min_score} — skipping"
            )
            self._skipped_count += 1
            return

        self.log.tailored(score)

        safe_company = event.company.lower().replace(" ", "_").replace("/", "_")
        filename = f"{event.job_id}_{safe_company}_tailored.txt"
        filepath = os.path.join(LOGS_RESUMES_DIR, filename)
        with open(filepath, "w") as f:
            f.write(tailored)
        self.log.saved(filepath)

        cover_letter = ""
        cl_llm = ""
        if self._gen_cover:
            self.log.llm_call("Generating cover letter...")
            cover_letter, cl_llm = await generate_cover_letter(
                self._profile,
                event.title,
                event.company,
                keywords,
                self.cfg,
            )
            self.log.cover_letter(len(cover_letter.split()))

        screening_answers: dict = {}
        autonomy = self.cfg.get("autonomy", {})
        if autonomy.get("mode") == "full":
            self.log.detail("Autonomous mode — pre-generating screening answers")
            static_answers = self._profile.get("screening_answers", {})
            for question, answer in static_answers.items():
                screening_answers[question] = answer

        result = TailoredResult(
            job_id=event.job_id,
            platform=event.platform,
            title=event.title,
            company=event.company,
            apply_url=event.apply_url,
            resume_variant=variant_name.replace(".txt", ""),
            tailored_resume=tailored,
            keywords_injected=keywords,
            match_score=score,
            llm_used=llm_used,
            cover_letter=cover_letter,
            screening_answers=screening_answers,
            generated_summary="",
        )
        await self.output_queue.enqueue(result)
        self.log.queued_tailor()
        self._tailored_count += 1

    async def _heartbeat(self):
        while True:
            await asyncio.sleep(60)
            reason = ""
            if self._skipped_count > 0:
                reason = f"{self._skipped_count} below threshold"
            self.log.tailor_heartbeat(self._tailored_count, self._skipped_count, reason)
