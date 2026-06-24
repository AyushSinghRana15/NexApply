# AGENTS.md — NexApply

> This document describes the agent architecture powering NexApply: what each agent does, how they communicate, what tools they can use, and what constraints they must respect.

---

## Overview

NexApply is a multi-agent system that monitors job platforms in real-time, tailors resumes using free LLMs, and automates job applications in parallel — targeting a sub-2-minute window from job posting to submission.

The system is composed of **5 specialized agents**, each with a single responsibility, communicating via an async Redis job queue.

```
┌─────────────────────────────────────────────────────────────────┐
│                        NEXAPPLY RUNTIME                         │
│                                                                 │
│  RadarAgent ──→ QueueBroker ──→ TailorAgent ──→ ApplyFleet     │
│                                      ↓                          │
│                               GuardAgent ──→ ReviewDashboard    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Agent Definitions

---

### 1. RadarAgent

**Role:** Real-time job discovery across all platforms.

**What it does:**
- Polls RSS feeds (Indeed) every 30 seconds
- Runs scraping loops for platforms without RSS (Naukri, Internshala)
- Deduplicates jobs using Redis SET to avoid reprocessing
- Emits a structured `JobEvent` to the queue for every new posting

**Tools available:**
- `feedparser` — RSS feed parsing
- `playwright` — headless scraping for Naukri, Internshala
- `redis` — deduplication store
- `aiohttp` — async HTTP requests

**Output schema:**
```json
{
  "job_id": "uuid",
  "platform": "indeed | naukri | internshala",
  "title": "Software Engineer",
  "company": "Razorpay",
  "location": "Remote / Bangalore",
  "description": "...",
  "apply_url": "https://...",
  "posted_at": "2024-01-01T10:00:00Z",
  "detected_at": "2024-01-01T10:00:28Z"
}
```

**Constraints:**
- Must not emit the same `job_id` twice
- Must attach `detected_at` timestamp on every event
- Must not block the event loop — all I/O must be async
- Polling interval must be configurable via `config.yaml`

---

### 2. QueueBroker

**Role:** Central nervous system. Routes `JobEvents` to the right workers.

**What it does:**
- Receives `JobEvents` from RadarAgent
- Applies user-defined filters (job title, salary, location, keywords)
- Prioritizes events by recency and match score
- Dispatches filtered jobs to TailorAgent

**Tools available:**
- `redis` streams — durable, ordered event queue
- Filter rules loaded from `config.yaml`

**Filter config example (`config.yaml`):**
```yaml
filters:
  titles: ["Software Engineer", "Backend Developer", "SDE"]
  exclude_keywords: ["10+ years", "C++ only"]
  locations: ["Remote", "Delhi", "Bangalore"]
  platforms: ["indeed", "naukri", "internshala"]
```

**Constraints:**
- Must drop jobs that don't match filters silently (no errors)
- Must preserve original `JobEvent` fields when forwarding
- Must log every dispatch with timestamp for audit trail

---

### 3. TailorAgent

**Role:** Resume adaptation using free LLMs.

**What it does:**
- Classifies the job into a category (Engineering, Data, Product, Design, etc.)
- Selects the nearest pre-built resume variant from `/resumes/`
- Calls Groq API (LLaMA 3.3 70B) or falls back to local Ollama
- Extracts top keywords from the JD and injects them into the resume
- Outputs a tailored resume string + match score (0–100)

**Tools available:**
- `groq` SDK — primary LLM (free tier, ~500ms latency)
- `ollama` — local fallback (Mistral/LLaMA, fully offline)
- `python-docx` — resume `.docx` generation
- Pre-built resume variants in `/resumes/*.txt`

**Tailoring strategy:**
```
Offline (nightly cron):
  → Generate 10–15 resume variants by job category
  → Store as structured templates with {{KEYWORD}} placeholders

At runtime (per job):
  → Classify job via keyword match (no LLM needed, <5ms)
  → Select nearest variant
  → LLM call: extract top 5 JD keywords only (max_tokens=50, ~200ms)
  → Inject keywords into template
  → Return tailored resume + match score
```

**Output schema:**
```json
{
  "job_id": "uuid",
  "resume_variant": "engineering_v3",
  "tailored_resume": "...",
  "keywords_injected": ["FastAPI", "Redis", "System Design"],
  "match_score": 87,
  "llm_used": "groq/llama-3.3-70b-versatile",
  "tailored_at": "2024-01-01T10:00:31Z"
}
```

**Constraints:**
- Must complete tailoring in under 10 seconds
- Must never hallucinate experience or skills not present in base resume
- Must fall back to Ollama if Groq rate limit is hit
- Must store every tailored resume in `/logs/resumes/` for audit

---

### 4. ApplyFleet

**Role:** Parallel browser automation across job platforms.

**What it does:**
- Spins up one Playwright worker per platform (Indeed, Naukri, Internshala)
- Each worker is a separate async coroutine with its own browser context
- Fills application forms using pre-stored answers from `profile.yaml`
- Handles platform-specific DOM structures via dedicated adapters
- Pauses before final submit and sends to GuardAgent for review

**Tools available:**
- `playwright` (async) — browser automation
- `profile.yaml` — pre-filled answers (name, phone, experience, etc.)
- Platform adapters in `/workers/*.py`

**Platform adapter map:**
```
workers/
├── indeed.py       # Indeed Apply flow
├── naukri.py       # Naukri apply modal
└── internshala.py  # Internshala application form
```

**Constraints:**
- Must NEVER auto-submit without GuardAgent approval
- Must take a screenshot before pausing for review
- Must handle login session via stored cookies — never re-login mid-run
- Must time out and skip if form fill exceeds 60 seconds
- Must mark job as `PENDING_REVIEW` not `APPLIED` until confirmed

---

### 5. GuardAgent

**Role:** Human-in-the-loop review gate before any submission.

**What it does:**
- Receives application payload from ApplyFleet (job details + tailored resume + screenshot)
- Pushes a review card to the NexApply Dashboard
- Waits for human approval, edit, or rejection
- On approval: signals ApplyFleet worker to submit
- On rejection: marks job as `SKIPPED` in Redis, releases the browser
- Logs every decision with timestamp and reason

**Tools available:**
- `fastapi` — webhook endpoint for dashboard signals
- `websockets` — real-time push to dashboard UI
- `redis` — stores approval state per `job_id`

**Review card sent to dashboard:**
```json
{
  "job_id": "uuid",
  "platform": "indeed",
  "title": "Senior SDE @ Razorpay",
  "posted_at": "2 min ago",
  "match_score": 87,
  "resume_variant": "engineering_v3",
  "keywords_injected": ["FastAPI", "Redis"],
  "screenshot_url": "/screenshots/uuid.png",
  "actions": ["APPROVE", "EDIT", "SKIP"]
}
```

**Constraints:**
- Must enforce a review timeout of 5 minutes — auto-skip if no response
- Must never forward an application with match score below configured threshold
- Must be the single authority on submission — no other agent can trigger submit

---

## Agent Communication Flow

```
1. RadarAgent detects new job posting
        ↓
2. QueueBroker filters and validates
        ↓
3. TailorAgent generates tailored resume + match score
        ↓
4. ApplyFleet fills the form on the platform (pauses before submit)
        ↓
5. GuardAgent pushes review card to dashboard
        ↓
6. Human approves/edits/skips
        ↓
7. ApplyFleet submits (or releases browser on skip)
        ↓
8. Result logged to /logs/applications.jsonl
```

---

## Shared Constraints (All Agents)

- All agents are stateless — state lives in Redis only
- All agents must log to a structured JSON log file
- No agent may make a network call outside its defined tool set
- All LLM prompts must be versioned in `/prompts/` — no inline prompt strings in code
- Agents must degrade gracefully — a failure in TailorAgent must not crash ApplyFleet

---

## Environment Variables

```bash
GROQ_API_KEY=           # Free at console.groq.com
REDIS_URL=redis://localhost:6379
OLLAMA_HOST=http://localhost:11434
NEXAPPLY_ENV=dev        # dev | prod
REVIEW_TIMEOUT_SECONDS=300
MIN_MATCH_SCORE=60      # Skip jobs below this threshold
```

---

## Adding a New Platform

To add a new job platform (e.g. Wellfound, Cutshort):

1. Add a new watcher in `core/radar.py` under `FEEDS` or `SCRAPERS`
2. Create a new adapter in `workers/wellfound.py`
3. Register it in `PLATFORM_HANDLERS` inside `workers/__init__.py`
4. Add any platform-specific form fields to `profile.yaml`
5. Document the DOM selectors used in a comment block at the top of the adapter file

No changes required to TailorAgent, QueueBroker, or GuardAgent.

---

*Last updated: NexApply v0.1 — architecture subject to change as platform adapters are finalized.*
