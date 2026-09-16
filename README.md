# NexApply

Automated job application system that detects job postings in real-time, tailors your resume to each role using AI (Groq/Ollama), and fills out application forms automatically — all within 1–2 minutes of a job being posted.

## The Problem

Job hunting is a race. The early applicants get seen first, but manually checking job boards, tweaking your resume for each role, and filling out the same forms over and over takes forever. By the time you apply, hundreds of people are already ahead of you.

## The Solution

NexApply runs a **pipeline of 5 tiny agents** that work together in under 2 minutes:

1. **Spots** a new job on Indeed/Naukri/Internshala within ~30 seconds
2. **Tailors** your resume to that specific job description using AI
3. **Fills** the application form in your browser automatically
4. **Pauses** and shows you the filled form for approval before submitting
5. **Submits** only when you say yes

You stay in control — nothing gets sent without your OK.

## How It Works (2-Minute Walkthrough)

```
JOB POSTED ──→ Spotted in ~30s ──→ Resume tailored in ~2s
                                        │
                              Form filled in ~20s
                                        │
                              Paused for YOUR review
                                        │
                              You click Approve/Skip
                                        │
                              Submitted (or discarded)
```

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         NEXAPPLY RUNTIME                             │
│                                                                      │
│  RadarAgent ──→ GraphWorker ──→ LangGraph Pipeline ──→ Result        │
│   (poller)       (consumer)      ┌─────────────────┐                 │
│                                  │ filter_job       │                 │
│                                  │ tailor_job       │                 │
│                                  │ apply_job        │                 │
│                                  │ guard_review ⏸  │ ← human approve │
│                                  │ log_result       │                 │
│                                  └─────────────────┘                 │
│                                        ↕                             │
│                                  SQLite checkpoints                   │
└──────────────────────────────────────────────────────────────────────┘
```

### File Workflow — Tabular View

| File | Role | Reads From | Writes To | Notes |
|---|---|---|---|---|
| `core/radar.py` | Job detection (poller) | Indeed RSS, Naukri/Internshala via Playwright | `job_queue` (asyncio.Queue) | Runs continuously, deduplicates via Redis/in-memory |
| `core/graph_worker.py` | Graph consumer | `job_queue` | invokes `core/workflow.py` | One asyncio task per job, bounded by semaphore |
| `core/workflow.py` | **LangGraph pipeline** | `PipelineState` (in-memory) | `langgraph_checkpoints.db` (SQLite) | Stateful graph with checkpointing + human interrupt |
| `core/workflow.py::filter_job` | Filter node | `config.yaml` filters, blacklists | `PipelineState.filtered` | Title/location/keyword matching |
| `core/workflow.py::tailor_job` | Tailor node | `resumes/*.txt`, Groq/Ollama API | `PipelineState.tailored_result` | Classify → variant → LLM keywords → score |
| `core/workflow.py::apply_job` | Apply node | `workers/*.py`, `cookies/`, `profile.yaml` | `PipelineState.application_payload` | Playwright form fill, stores worker for review |
| `core/workflow.py::guard_review` | Review node | `interrupt()` (LangGraph) | `PipelineState.decision` | Pauses graph, waits for human via API/WebSocket |
| `core/workflow.py::log_result` | Log node | `PipelineState` | `logs/applications.jsonl`, `api/db` | Final status write to JSONL + SQLite DB |
| `api/services/decision.py` | Decision handler | REST API `PATCH /decision` | resumes graph via `resume_pipeline()` | Triggers `Command(resume=action)` on checkpointed graph |
| `api/routes/ws.py` | WebSocket handler | Frontend `DECISION` message | resumes graph via `resume_pipeline()` | Real-time approve/skip from dashboard |
| `core/autonomous.py` | Rate limiter | `config.yaml` autonomy settings | `APPROVE/SKIP` decision | Daily/hourly limits, cooldowns, blacklists |
| `core/classifier.py` | Job classifier | Job title keywords | category string | 5ms, no LLM needed |
| `core/llm.py` | LLM wrapper | Groq API → Ollama → title fallback | keywords, cover letter | <1s with Groq, offline with Ollama |
| `core/scorer.py` | Match scorer | Keywords, category, location | 0–100 score | 60% keyword + 25% category + 15% location |
| `workers/base.py` | Browser automation base | `profile.yaml`, `selectors.yaml`, Playwright | screenshots, form data | 80+ field mappings, smart_fill, DocumentHandler |
| `workers/indeed.py` | Indeed adapter | `base.py` | `ApplicationPayload` | Indeed-specific apply flow |
| `workers/naukri.py` | Naukri adapter | `base.py` | `ApplicationPayload` | Naukri modal apply flow |
| `workers/internshala.py` | Internshala adapter | `base.py` | `ApplicationPayload` | Internshala form flow |
| `core/resume_parser.py` | PDF/TXT parser | `resumes/*.pdf`, `resumes/*.txt` | parsed skills, experience, education | Feeds dynamic resume builder |
| `core/queue.py` | Async queue wrapper | `asyncio.Queue` | enqueue/dequeue | Used by RadarAgent → GraphWorker |
| `core/logger.py` | Structured logger | all agents | terminal + `logs/` | Emoji-prefixed, colorized output |

### The 5 Agents (Plain English)

| Agent | What it does |
|---|---|
| **RadarAgent** | Watches job sites like a hawk. Polls Indeed's RSS feed every 30s, scrapes Naukri & Internshala. Never emits the same job twice. |
| **GraphWorker** | The orchestrator. Consumes detected jobs and invokes the LangGraph pipeline for each one. Bounded concurrency prevents browser overload. |
| **LangGraph Pipeline** | The stateful workflow. Five nodes — filter, tailor, apply, guard review, log — connected as a graph with SQLite checkpointing. Each node wraps the original agent logic. |
| **GuardReview** | The gatekeeper node. Uses LangGraph's `interrupt()` to pause the graph and wait for human approval via REST API or WebSocket. Resumes on decision. |
| **AutonomousAgent** | The rate limiter. Enforces daily/hourly limits, company blacklists, cooldowns between applications, and duplicate detection. |

### Job Flow

```
RadarAgent ──→ job_queue ──→ GraphWorker ──→ LangGraph Pipeline
                                                │
                                          ┌─────┴─────┐
                                          │ filter_job │ ← title/location/blacklist
                                          └─────┬─────┘
                                                │ pass
                                          ┌─────┴─────┐
                                          │ tailor_job │ ← classify + LLM + score
                                          └─────┬─────┘
                                                │ score >= threshold
                                          ┌─────┴──────┐
                                          │ apply_job  │ ← Playwright form fill
                                          └─────┬──────┘
                                                │ PENDING_REVIEW
                                          ┌─────┴────────┐
                                          │ guard_review  │ ← interrupt() → human
                                          └─────┬────────┘
                                                │ APPROVE / SKIP
                                          ┌─────┴─────┐
                                          │ log_result │ ← JSONL + DB
                                          └───────────┘
```

## Quick Start

```bash
# Clone and setup
git clone https://github.com/AyushSinghRana15/NexApply.git
cd NexApply

# Virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install Playwright browser
python -m playwright install chromium

# Create .env file with your Groq API key (free at console.groq.com)
echo 'GROQ_API_KEY=gsk_your_key_here' > .env

# Start Redis (optional — falls back to in-memory)
brew install redis && brew services start redis

# Save cookies for each platform (login once, cookies saved forever)
python3 scripts/save_cookies.py indeed
python3 scripts/save_cookies.py naukri
python3 scripts/save_cookies.py internshala

# Run it (backend API + agents + scheduler)
python3 run.py

# Or the quick way — backend + frontend together
./run.sh
```

The review dashboard opens at `http://localhost:5173`. When a job is ready for review, a card appears with the job details + a screenshot of the filled form. Press **Approve** / **Skip** to decide.

### Try Without Real Jobs

```bash
python3 run.py --test
```

Injects fake test jobs so you can see the full review flow without waiting for real postings.

## Configuration

Everything lives in `config.yaml`:

```yaml
platforms:
  indeed: true          # Toggle platforms on/off
  naukri: true
  internshala: true

polling_interval_seconds: 30

filters:
  titles: ["Software Engineer", "Backend Developer", "SDE"]
  locations: ["Remote", "Delhi", "Bangalore"]
  exclude_keywords: ["10+ years", "only C++"]

tailor:
  min_match_score: 60   # Skip jobs below this score
  groq_model: "llama-3.3-70b-versatile"
  use_llm: true         # Set false to skip AI (dev mode)

fleet:
  max_concurrent_browsers: 3
  headless: true
  human_delay_min: 0.5  # Human-like typing delays
  human_delay_max: 1.2

guard:
  review_timeout_seconds: 300   # Auto-skip after 5 min
  min_match_score: 60
```

Your personal details (name, phone, experience, CTC, cover letter) go in `profile.yaml`. DOM selectors for form fields live in `selectors.yaml`.

## Project Structure

```
├── core/               # Agent logic + LangGraph pipeline
│   ├── radar.py        # RadarAgent — job detection (poller)
│   ├── graph_worker.py # GraphWorker — consumes jobs, invokes pipeline
│   ├── workflow.py     # LangGraph StateGraph — filter, tailor, apply, review, log
│   ├── classifier.py   # Keyword-based job category classifier
│   ├── llm.py          # Groq + Ollama wrapper with fallback
│   ├── scorer.py       # Match score calculator
│   ├── queue.py        # Async job queue
│   ├── autonomous.py   # Rate limiter (daily/hourly limits, blacklists)
│   ├── resume_parser.py # PDF/TXT resume parser + profile merger
│   └── models.py       # Shared data types (JobEvent, TailoredResult, etc.)
├── workers/            # Platform-specific form fillers
│   ├── base.py         # Shared logic (field fill, screenshots, cookies)
│   ├── indeed.py       # Indeed Apply
│   ├── naukri.py       # Naukri Apply
│   └── internshala.py  # Internshala Apply
├── scripts/            # One-time setup scripts
├── cookies/            # Saved login sessions
├── resumes/            # Pre-built resume templates with {{KEYWORDS}}
├── prompts/            # Versioned AI prompts
├── logs/               # Run history (resumes, screenshots, decisions)
├── api/                # REST API (stats, config, decisions)
│   ├── routes/         # FastAPI route handlers
│   ├── services/       # Decision handler, scheduler, agent bridge
│   ├── models/         # SQLAlchemy ORM models
│   └── schemas/        # Pydantic response schemas
├── frontend/           # React dashboard (Review, Analytics, Settings)
├── config.yaml         # All settings
├── profile.yaml        # Your personal details
└── selectors.yaml      # Form field selectors per platform
```

## Key Design Decisions

**Why pre-built resume variants instead of generating from scratch?**
Speed (~2s vs 15s) and safety — AI models sometimes invent experience. Templates ground the output in real skills.

**Why keyword-based classification instead of AI?**
A simple keyword match takes 5ms and is 100% accurate for category detection. Why waste an LLM call on that?

**Why pause before submit?**
One wrong submission is worse than 10 missed opportunities. The GuardAgent ensures a human always has the final say.

**Why cookies instead of login?**
Logging in every time is slow and triggers OTPs/SMS. Save cookies once, reuse forever.

**No Redis? No problem.**
Core functionality uses `asyncio.Queue` — Redis is optional (for deduplication across restarts).

## Benchmarks

| Step | Typical Time |
|---|---|
| Job detection (Indeed RSS) | ~30s |
| Job detection (Scraped platforms) | ~1-2 min |
| Classification + keyword extraction | ~500ms |
| Resume tailoring | ~1-2s |
| Form filling | ~15-25s |
| Human review | ~30s (typical) |

## Environment Variables

```bash
GROQ_API_KEY=gsk_your_key_here     # Required (free at console.groq.com)
REDIS_URL=redis://localhost:6379   # Optional (in-memory fallback)
OLLAMA_HOST=http://localhost:11434 # Optional (AI fallback)
```

## Adding a New Job Platform

1. Add a watcher in `core/radar.py`
2. Create an adapter in `workers/foo.py`
3. Register it in the `worker_map` dict in `core/workflow.py`
4. Add platform-specific fields to `profile.yaml`
5. Add DOM selectors to `selectors.yaml`

No changes needed to the LangGraph pipeline nodes (filter, tailor, log).
