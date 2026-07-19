import importlib
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional, TypedDict

import yaml
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
from langgraph.graph import END, StateGraph
from langgraph.types import interrupt

from core.classifier import classify_job
from core.llm import extract_keypoints, generate_cover_letter
from core.logger import Logger
from core.models import ApplicationPayload, JobEvent, TailoredResult
from core.scorer import compute_score

LOGS_FILE = "logs/applications.jsonl"
BASE_RESUMES_DIR = "resumes"
LOGS_RESUMES_DIR = "logs/resumes"
VARIANT_MAP = {
    "engineering": "engineering_v1.txt",
    "data": "data_v1.txt",
    "product": "product_v1.txt",
    "devops": "devops_v1.txt",
    "design": "design_v1.txt",
    "ml": "ml_v1.txt",
}

_active_workers: Dict[str, Any] = {}
_log = Logger()


class PipelineState(TypedDict):
    job_event: dict
    filtered: bool
    filter_reason: str
    tailored_result: Optional[dict]
    application_payload: Optional[dict]
    decision: str
    final_status: str
    error: Optional[str]


def _load_config():
    try:
        with open("config.yaml") as f:
            return yaml.safe_load(f)
    except Exception:
        return {}


def _load_profile():
    try:
        with open("profile.yaml") as f:
            return yaml.safe_load(f)
    except Exception:
        return {}


async def filter_job(state: PipelineState, config=None) -> dict:
    cfg = _load_config()
    job = state["job_event"]

    title_lower = job.get("title", "").lower()
    company_lower = job.get("company", "").lower()
    location_lower = job.get("location", "").lower()
    desc_lower = job.get("description", "").lower()
    full_text = f"{title_lower} {desc_lower}"

    filter_cfg = cfg.get("filters", {})
    autonomy = cfg.get("autonomy", {})

    exclude_keywords = [k.lower() for k in filter_cfg.get("exclude_keywords", [])]
    blacklist_keywords = [k.lower() for k in autonomy.get("blacklist_keywords", [])]
    blacklist_companies = [c.lower() for c in autonomy.get("blacklist_companies", [])]
    allowed_titles = [t.lower() for t in filter_cfg.get("titles", [])]
    allowed_locations = [l.lower() for l in filter_cfg.get("locations", [])]

    for kw in exclude_keywords:
        if kw in full_text:
            _log.skip(job.get("platform", ""), f"{job.get('title', '')} @ {job.get('company', '')}", f"exclude keyword '{kw}'")
            return {"filtered": False, "filter_reason": f"exclude keyword '{kw}' matched"}

    for kw in blacklist_keywords:
        if kw in full_text:
            _log.skip(job.get("platform", ""), f"{job.get('title', '')} @ {job.get('company', '')}", f"blacklist keyword '{kw}'")
            return {"filtered": False, "filter_reason": f"blacklist keyword '{kw}' matched"}

    for c in blacklist_companies:
        if c in company_lower:
            _log.skip(job.get("platform", ""), f"{job.get('title', '')} @ {job.get('company', '')}", f"blacklisted company '{c}'")
            return {"filtered": False, "filter_reason": f"blacklisted company '{c}'"}

    if allowed_titles:
        from difflib import SequenceMatcher
        title_matched = False
        for allowed in allowed_titles:
            if allowed in title_lower:
                title_matched = True
                break
            ratio = SequenceMatcher(None, allowed, title_lower).ratio()
            if ratio >= 0.7:
                title_matched = True
                break
            allowed_words = set(allowed.split())
            title_words = set(title_lower.split())
            if allowed_words and title_words:
                overlap = allowed_words & title_words
                if len(overlap) / max(len(allowed_words), len(title_words)) >= 0.6:
                    title_matched = True
                    break
        if not title_matched:
            return {"filtered": False, "filter_reason": f"title '{job.get('title', '')}' not in filter list"}

    if allowed_locations:
        loc_matched = False
        for allowed in allowed_locations:
            if allowed in location_lower or location_lower in allowed:
                loc_matched = True
                break
        if not loc_matched:
            return {"filtered": False, "filter_reason": f"location '{job.get('location', '')}' not in filter list"}

    _log.detail(f"filter_job: forwarding {job.get('title', '')} @ {job.get('company', '')}")
    return {"filtered": True, "filter_reason": "passed all filters"}


async def tailor_job(state: PipelineState, config=None) -> dict:
    cfg = _load_config()
    job = state["job_event"]
    profile = _load_profile()

    category = classify_job(job.get("title", ""), job.get("description", ""))
    _log.classify(category)

    variant_name = VARIANT_MAP.get(category, VARIANT_MAP["engineering"])
    variant_path = os.path.join(BASE_RESUMES_DIR, variant_name)

    use_user_resume = cfg.get("tailor", {}).get("use_user_resume", False)
    base_resume = None

    if use_user_resume:
        parsed_data = _load_parsed_resume(cfg)
        if parsed_data:
            _log.detail("Using parsed resume data — building dynamic template")
            from core.resume_parser import build_resume_text
            base_resume = build_resume_text(parsed_data, category=category)
            variant_name = f"parsed_{category}"

    if base_resume is None:
        if not os.path.exists(variant_path):
            variant_path = os.path.join(BASE_RESUMES_DIR, VARIANT_MAP["engineering"])
            variant_name = VARIANT_MAP["engineering"]
        with open(variant_path) as f:
            base_resume = f.read()

    _log.variant(variant_name)

    use_llm = cfg.get("tailor", {}).get("use_llm", True)
    if use_llm:
        _log.llm_call("Groq API called — extracting keywords...")
        keywords, llm_used = await extract_keypoints(
            job.get("description", ""), job.get("title", ""), cfg
        )
        _log.keywords_extracted(keywords)
    else:
        from core.llm import _fallback_from_title
        keywords = _fallback_from_title(job.get("title", ""))
        llm_used = "none"

    tailored = base_resume.replace("{{KEYWORDS}}", ", ".join(keywords))

    preferred_categories = cfg.get("profile", {}).get("categories", ["engineering"])
    preferred_locations = cfg.get("filters", {}).get("locations", ["Remote"])
    score = compute_score(
        category=category,
        keywords=keywords,
        base_resume_text=base_resume,
        job_location=job.get("location", "Remote"),
        preferred_categories=preferred_categories,
        preferred_locations=preferred_locations,
    )

    min_score = cfg.get("tailor", {}).get("min_match_score", 70)
    if score < min_score:
        _log.warn(f"Match score {score} below threshold {min_score} — skipping")
        return {
            "tailored_result": None,
            "filtered": False,
            "filter_reason": f"match score {score} below threshold {min_score}",
        }

    _log.tailored(score)

    os.makedirs(LOGS_RESUMES_DIR, exist_ok=True)
    safe_company = job.get("company", "unknown").lower().replace(" ", "_").replace("/", "_")
    filename = f"{job.get('job_id', 'unknown')}_{safe_company}_tailored.txt"
    filepath = os.path.join(LOGS_RESUMES_DIR, filename)
    with open(filepath, "w") as f:
        f.write(tailored)

    cover_letter = ""
    cl_llm = ""
    if cfg.get("tailor", {}).get("generate_cover_letter", True):
        _log.llm_call("Generating cover letter...")
        cover_letter, cl_llm = await generate_cover_letter(
            profile, job.get("title", ""), job.get("company", ""),
            keywords, cfg,
        )
        _log.cover_letter(len(cover_letter.split()))

    screening_answers = {}
    autonomy = cfg.get("autonomy", {})
    if autonomy.get("mode") == "full":
        screening_answers = profile.get("screening_answers", {})

    result = TailoredResult(
        job_id=job.get("job_id", ""),
        platform=job.get("platform", ""),
        title=job.get("title", ""),
        company=job.get("company", ""),
        apply_url=job.get("apply_url", ""),
        resume_variant=variant_name.replace(".txt", ""),
        tailored_resume=tailored,
        keywords_injected=keywords,
        match_score=score,
        llm_used=llm_used,
        cover_letter=cover_letter,
        screening_answers=screening_answers,
    )

    _log.queued_tailor()
    return {"tailored_result": result.to_dict()}


async def apply_job(state: PipelineState, config=None) -> dict:
    cfg = _load_config()
    tr_dict = state.get("tailored_result")
    if not tr_dict:
        return {"application_payload": None, "final_status": "SKIPPED"}

    result = TailoredResult(**tr_dict)
    autonomy = cfg.get("autonomy", {})
    mode = autonomy.get("mode", "full")

    if mode == "full":
        from core.autonomous import AutonomousAgent
        autonomous = AutonomousAgent(cfg)
        decision, reason = await autonomous.decide(result)
        if decision == "SKIP":
            _log.autonomous_skip(result.title, result.company, reason)
            return {"application_payload": None, "final_status": "SKIPPED"}

    platform = result.platform
    cookie_path = f"cookies/{platform}_cookies.json"
    if not os.path.exists(cookie_path):
        _log.warn(f"{platform.capitalize()} cookies missing — skipping")
        return {"application_payload": None, "final_status": "SKIPPED"}

    _log.applying(f"{result.title} @ {result.company}", platform)

    worker_map = {
        "indeed": ("workers.indeed", "IndeedWorker"),
        "naukri": ("workers.naukri", "NaukriWorker"),
        "internshala": ("workers.internshala", "InternshalaWorker"),
    }

    entry = worker_map.get(platform)
    if not entry:
        _log.warn(f"Unknown platform: {platform}")
        return {"application_payload": None, "final_status": "SKIPPED"}

    mod_name, cls_name = entry
    mod = importlib.import_module(mod_name)
    cls = getattr(mod, cls_name)
    worker = cls(cfg)

    auto_submit = mode == "full"

    try:
        payload = await worker.apply_with_timeout(result, auto_submit=auto_submit)
    except Exception as e:
        _log.error(f"Worker failed for {platform}: {e}")
        await worker.close()
        return {
            "application_payload": ApplicationPayload(
                job_id=result.job_id, platform=result.platform,
                title=result.title, company=result.company,
                apply_url=result.apply_url, match_score=result.match_score,
                keywords_injected=result.keywords_injected,
                resume_variant=result.resume_variant,
                status=ApplicationPayload.STATUS_FAILED,
            ).to_dict(),
            "final_status": "FAILED",
            "error": str(e),
        }

    if payload is None:
        await worker.close()
        return {"application_payload": None, "final_status": "FAILED"}

    if auto_submit:
        final_status = "APPLIED" if payload.status == ApplicationPayload.STATUS_APPLIED else "FAILED"
        await worker.close()
        return {"application_payload": payload.to_dict(), "final_status": final_status}

    _active_workers[result.job_id] = worker
    return {
        "application_payload": payload.to_dict(),
        "final_status": "PENDING_REVIEW",
    }


async def guard_review(state: PipelineState, config=None) -> dict:
    payload_dict = state.get("application_payload")
    if not payload_dict:
        return {"decision": "SKIP"}

    review_info = {
        "job_id": payload_dict.get("job_id", ""),
        "platform": payload_dict.get("platform", ""),
        "title": payload_dict.get("title", ""),
        "company": payload_dict.get("company", ""),
        "match_score": payload_dict.get("match_score", 0),
        "keywords": payload_dict.get("keywords_injected", []),
        "resume_variant": payload_dict.get("resume_variant", ""),
        "screenshot_url": f"/screenshot/{payload_dict.get('job_id', '')}",
    }

    decision = interrupt(review_info)

    worker = _active_workers.pop(payload_dict.get("job_id", ""), None)
    if decision == "APPROVE" and worker:
        submitted = await worker.submit(payload_dict.get("platform", ""))
        if submitted:
            _log.guard_applied(payload_dict.get("title", ""), payload_dict.get("company", ""))
        else:
            _log.guard_submit_failed(payload_dict.get("title", ""), payload_dict.get("company", ""))
            decision = "SUBMIT_FAILED"
    elif worker:
        await worker.close()

    return {"decision": decision}


async def log_result(state: PipelineState, config=None) -> dict:
    job = state.get("job_event", {})
    payload_dict = state.get("application_payload")
    decision = state.get("decision", "")
    final_status = state.get("final_status", "")

    if decision == "APPROVE" or decision == "APPLIED":
        final_status = "APPLIED"
    elif decision == "SKIP" or decision == "TIMEOUT":
        final_status = "SKIPPED"
    elif decision == "SUBMIT_FAILED":
        final_status = "SUBMIT_FAILED"
    elif decision == "EDIT":
        final_status = "APPLIED"

    entry = {
        "job_id": job.get("job_id", ""),
        "platform": job.get("platform", ""),
        "title": job.get("title", ""),
        "company": job.get("company", ""),
        "apply_url": job.get("apply_url", ""),
        "match_score": (payload_dict or {}).get("match_score", state.get("tailored_result", {}) and state["tailored_result"].get("match_score", 0)),
        "keywords_injected": (payload_dict or {}).get("keywords_injected", []),
        "resume_variant": (payload_dict or {}).get("resume_variant", ""),
        "screenshot_path": (payload_dict or {}).get("screenshot_path", ""),
        "status": final_status,
        "decision": decision or final_status,
        "filled_at": datetime.now(timezone.utc).isoformat(),
        "filter_reason": state.get("filter_reason", ""),
        "error": state.get("error"),
    }

    os.makedirs(os.path.dirname(LOGS_FILE), exist_ok=True)
    with open(LOGS_FILE, "a") as f:
        f.write(json.dumps(entry, default=str) + "\n")

    try:
        from api.db.database import SessionLocal
        from api.services.agent_bridge import agent_bridge
        db = SessionLocal()
        try:
            ap = ApplicationPayload(
                job_id=entry["job_id"], platform=entry["platform"],
                title=entry["title"], company=entry["company"],
                apply_url=entry["apply_url"], match_score=entry["match_score"],
                keywords_injected=entry["keywords_injected"],
                resume_variant=entry["resume_variant"],
                screenshot_path=entry["screenshot_path"],
                status=final_status,
            )
            agent_bridge.save_application(db, ap, decision)
        finally:
            db.close()
    except Exception:
        pass

    _log.detail(f"log_result: {final_status} — {entry['title']} @ {entry['company']}")
    return {"final_status": final_status}


def _route_after_filter(state: PipelineState) -> str:
    if not state.get("filtered", False):
        return "log_result"
    return "tailor_job"


def _route_after_tailor(state: PipelineState) -> str:
    if not state.get("tailored_result"):
        return "log_result"
    return "apply_job"


def _route_after_apply(state: PipelineState) -> str:
    final = state.get("final_status", "")
    if final == "PENDING_REVIEW":
        return "guard_review"
    return "log_result"


def _route_after_review(state: PipelineState) -> str:
    return "log_result"


async def build_graph(checkpointer=None):
    graph = StateGraph(PipelineState)

    graph.add_node("filter_job", filter_job)
    graph.add_node("tailor_job", tailor_job)
    graph.add_node("apply_job", apply_job)
    graph.add_node("guard_review", guard_review)
    graph.add_node("log_result", log_result)

    graph.set_entry_point("filter_job")

    graph.add_conditional_edges("filter_job", _route_after_filter, {
        "tailor_job": "tailor_job",
        "log_result": "log_result",
    })

    graph.add_conditional_edges("tailor_job", _route_after_tailor, {
        "apply_job": "apply_job",
        "log_result": "log_result",
    })

    graph.add_conditional_edges("apply_job", _route_after_apply, {
        "guard_review": "guard_review",
        "log_result": "log_result",
    })

    graph.add_conditional_edges("guard_review", _route_after_review, {
        "log_result": "log_result",
    })

    graph.add_edge("log_result", END)

    return graph.compile(checkpointer=checkpointer)


_graph = None
_checkpointer = None


async def get_graph():
    global _graph, _checkpointer
    if _graph is None:
        _checkpointer = AsyncSqliteSaver.from_conn_string("langgraph_checkpoints.db")
        await _checkpointer.setup()
        _graph = await build_graph(_checkpointer)
    return _graph


async def invoke_pipeline(job_event: JobEvent):
    graph = await get_graph()
    initial_state: PipelineState = {
        "job_event": job_event.to_dict(),
        "filtered": False,
        "filter_reason": "",
        "tailored_result": None,
        "application_payload": None,
        "decision": "",
        "final_status": "",
        "error": None,
    }
    return await graph.ainvoke(initial_state, config={"configurable": {"thread_id": job_event.job_id}})


async def resume_pipeline(job_id: str, decision: str):
    graph = await get_graph()
    from langgraph.types import Command
    return await graph.ainvoke(
        Command(resume=decision),
        config={"configurable": {"thread_id": job_id}},
    )


def _load_parsed_resume(cfg):
    if not cfg.get("tailor", {}).get("use_user_resume", False):
        return None
    try:
        from api.db.database import SessionLocal
        from api.models.resume import ResumeVariant
        db = SessionLocal()
        try:
            variant = (
                db.query(ResumeVariant)
                .filter(ResumeVariant.parsed_data.isnot(None), ResumeVariant.is_active == True)
                .order_by(ResumeVariant.created_at.desc())
                .first()
            )
            if variant and variant.parsed_data:
                return variant.parsed_data
        finally:
            db.close()
    except Exception:
        pass
    return None
