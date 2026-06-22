# NexApply

Automated job application system that detects job postings in real-time, tailors resumes via AI, and submits applications within 1-2 minutes.

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

# Start Redis (optional — in-memory fallback works)
brew install redis && brew services start redis

# Save cookies for each platform (required for ApplyFleet)
python3 scripts/save_cookies.py indeed
python3 scripts/save_cookies.py linkedin
python3 scripts/save_cookies.py naukri
python3 scripts/save_cookies.py internshala

# Run
python3 main.py
```

## The Core Challenge
Apply within 1-2 minutes of job posting. Pipeline: Job Posted → Detected in <30s → Resume Tailored in <20s → Form Filled in <30s → Submitted.
Requires real-time monitoring + parallel execution + pre-cached tailoring.

## Architecture
```
┌──────────────────────────────────────────────────────────────────┐
│                        NEXAPPLY RUNTIME                          │
├──────────────┬──────────────────┬──────────────────┬─────────────┤
│  RadarAgent  │   TailorAgent    │   ApplyFleet      │  GuardAgent │
│  (Watchers)  │  (LLM + Resume)  │  (Playwright)     │  (Phase 4)  │
├──────────────┼──────────────────┼──────────────────┼─────────────┤
│ LinkedIn RSS │ Classifier (5ms) │ Worker: LinkedIn  │ Review card │
│ Indeed RSS   │ → keyword match  │ Worker: Indeed    │ Approve/    │
│ Naukri scraper│ Groq API (8s)   │ Worker: Naukri    │ Edit/Skip   │
│ Internshala  │ → Ollama fallback│ Worker: Internshala│ Auto-skip   │
│ Dedup (Redis)│ Scorer (0-100)   │ Form fill + pause │ after 5min  │
└──────┬───────┴──────┬───────────┴──────────┬───────┴─────────────┘
       │              │                      │
       ▼              ▼                      ▼
  job_queue       tailor_queue          guard_queue
  (JobEvents)     (TailoredResult)   (ApplicationPayload)
```

**Agent pipeline:** RadarAgent → `job_queue` → TailorAgent → `tailor_queue` → ApplyFleet → `guard_queue` → GuardAgent (Phase 4)

## Speed Strategy

| Step | Target | Actual |
|------|--------|--------|
| Job detection | <30s | ~30s (RSS) / ~2min (scrape) |
| Classification | 5ms | <1ms (keyword match) |
| Keyword extraction (Groq) | 8s | ~500ms |
| Resume injection | 1s | <10ms |
| Total tailor time | 10s | ~1-2s |
| Form fill (browser) | 30s | ~15-25s |

## Agent Communication

Agents communicate via `asyncio.Queue` with no external broker dependency:

```
job_queue = JobQueue()      # Radar → Tailor
tailor_queue = JobQueue()   # Tailor → ApplyFleet
guard_queue = JobQueue()    # ApplyFleet → GuardAgent (Phase 4)
```

All queues live in-process. Each job flows through the full pipeline in under 2 minutes.

## ApplyFleet (Phase 3)

ApplyFleet consumes TailoredResults and produces ApplicationPayloads using Playwright browser automation.

### How it works

1. **Route** — TailoredResult arrives, routed to the correct platform worker
2. **Launch** — Worker opens Playwright browser with pre-stored cookies
3. **Navigate** — Goes to `apply_url`, detects form fields
4. **Fill** — Maps fields to `profile.yaml` answers, fills with human-like delays (0.5-1.2s)
5. **Upload** — Converts tailored resume to file and uploads
6. **Screenshot** — Captures the filled form as PNG
7. **Pause** — STOPS before submit, sends ApplicationPayload to guard_queue
8. **Wait** — Never submits without human approval (Phase 4)

### Platform Workers

| Worker | Fields | Challenges |
|--------|--------|------------|
| **Indeed** | first_name, last_name, email, phone, resume, cover_letter | Sometimes redirects to external ATS (Workday, Greenhouse) |
| **LinkedIn** | phone, resume, multi-step wizard (Easy Apply) | Multi-page modal, next button varies per step |
| **Naukri** | cover_letter, notice_period, current_ctc, expected_ctc | Login required, CTC fields are Naukri-specific |
| **Internshala** | cover_letter, availability | Easiest — simple form, login required |

### Session Management

Cookies are saved once with `scripts/save_cookies.py`, then reused on every run:

```bash
python3 scripts/save_cookies.py indeed    # Opens browser → you log in → cookies saved
python3 scripts/save_cookies.py linkedin
python3 scripts/save_cookies.py naukri
python3 scripts/save_cookies.py internshala
```

Cookies stored in `cookies/{platform}_cookies.json`. Expired cookies log a warning and skip the platform — never crash.

### Field Filling Strategy (`smart_fill`)

Each field has a fallback chain of CSS selectors in `selectors.yaml`. Tries each in order, uses the first that matches:

```yaml
indeed:
  first_name:
    - input[name="first_name"]
    - input[id*="first"]
    - input[placeholder*="First"]
```

### ApplicationPayload Status Codes

| Status | Meaning |
|--------|---------|
| `PENDING_REVIEW` | Form filled, screenshot taken, waiting for human |
| `MANUAL_REQUIRED` | Redirected to external ATS (e.g. Workday) |
| `NEEDS_COOKIES` | Session expired, cookies need refresh |
| `FAILED` | Form fill failed (timeout / error) |
| `UNKNOWN_FORM` | Form structure not recognised |

### Concurrency

- Max 3 concurrent browser instances (configurable)
- One Playwright context per worker
- Semaphore-based limiting
- A single worker failure never crashes the fleet

## TailorAgent (Phase 2)

TailorAgent consumes JobEvents and produces TailoredResults:

1. **Classify** — keyword matching against 6 categories (engineering, data, product, devops, design, ml)
2. **Select variant** — picks nearest resume template from `/resumes/`
3. **Extract keywords** — calls Groq (llama-3.3-70b) with 8s timeout, falls back to Ollama → title words
4. **Inject** — replaces `{{KEYWORDS}}` placeholder with extracted terms
5. **Score** — computes match (0-100) based on keyword overlap, category, location
6. **Save** — writes tailored resume to `logs/resumes/{job_id}_{company}.txt`
7. **Emit** — queues `TailoredResult` for ApplyFleet

### LLM Fallback Chain
```
Groq API (8s timeout) → Ollama (localhost) → Title word extraction
```

### Match Score Formula
```
score = (keywords_found_in_base / 5) × 60   # 60% keyword match
      + (category_match ? 25 : 0)            # 25% category match
      + (location_match ? 15 : 0)            # 15% location match
```

## Job Detection
| Platform    | Method          | Latency |
|-------------|-----------------|---------|
| LinkedIn    | RSS feed/scrape | ~1 min  |
| Indeed      | RSS feed        | ~30s    |
| Naukri      | Scraping        | ~2 min  |
| Internshala | Scraping        | ~1-2 min|

## Project Structure
```
├── core/
│   ├── radar.py         # RadarAgent — job watchers per platform
│   ├── tailor.py        # TailorAgent — resume tailoring pipeline
│   ├── fleet.py         # ApplyFleet — Playwright orchestrator
│   ├── classifier.py    # Keyword-based job category classifier
│   ├── llm.py           # Groq + Ollama wrapper with fallback
│   ├── scorer.py        # Match score calculator (0-100)
│   ├── queue.py         # Async job queue (asyncio.Queue wrapper)
│   ├── models.py        # JobEvent + TailoredResult + ApplicationPayload
│   └── logger.py        # Live terminal logger with emoji prefixes
├── workers/
│   ├── base.py          # BaseWorker — smart_fill, screenshot, cookie loader
│   ├── indeed.py        # Indeed Apply worker
│   ├── linkedin.py      # LinkedIn Easy Apply worker
│   ├── naukri.py        # Naukri modal apply worker
│   └── internshala.py   # Internshala form worker
├── scripts/
│   └── save_cookies.py  # One-time cookie saver per platform
├── cookies/             # Pre-stored session cookies per platform
├── resumes/             # Pre-built resume variants with {{KEYWORDS}}
│   ├── engineering_v1.txt
│   ├── data_v1.txt
│   ├── product_v1.txt
│   ├── devops_v1.txt
│   ├── design_v1.txt
│   └── ml_v1.txt
├── prompts/
│   └── keyword_extraction.txt   # Versioned Groq/Ollama prompt
├── logs/
│   ├── resumes/                 # Saved tailored resumes per application
│   └── screenshots/             # One PNG per application attempt
├── selectors.yaml      # DOM selectors per platform (no hardcoded selectors)
├── profile.yaml        # Your answer bank (name, CTC, cover letter, etc.)
├── config.yaml         # Platform toggles, filters, tailor & fleet config
├── main.py             # Entry point — launches Radar + Tailor + Fleet
├── .env.example        # Template for environment variables
└── requirements.txt    # Dependencies
```

## Configuration (`config.yaml`)

```yaml
platforms:
  linkedin: true
  indeed: true
  naukri: true
  internshala: true

polling_interval_seconds: 30

filters:
  titles: ["Software Engineer", "Backend Developer", "SDE", "Python Developer"]
  locations: ["Remote", "Delhi", "Bangalore", "Mumbai"]
  exclude_keywords: ["10+ years", "only C++"]

tailor:
  min_match_score: 60        # Skip jobs below this score
  groq_model: "llama-3.3-70b-versatile"
  ollama_model: "mistral"
  ollama_host: "http://localhost:11434"
  groq_timeout_seconds: 8
  use_llm: true               # Set false to skip LLM (dev mode)

profile:
  categories: ["engineering", "data", "product", "devops", "design", "ml"]

fleet:
  max_concurrent_browsers: 3
  headless: true
  page_timeout_seconds: 30
  human_delay_min: 0.5
  human_delay_max: 1.2
  resume_format: "txt"
```

## Environment
Create a `.env` file in the project root:

```bash
GROQ_API_KEY=gsk_your_key_here   # Required — get one free at console.groq.com
```

Optional config still uses environment variables:

```bash
REDIS_URL=redis://localhost:6379    # Optional (in-memory fallback)
OLLAMA_HOST=http://localhost:11434  # Optional (Ollama fallback)
```

## Adding a New Resume Category

1. Add a template in `resumes/{category}_v1.txt` with `{{KEYWORDS}}` placeholder
2. Register keywords in `core/classifier.py` `CATEGORY_RULES`
3. Add to `VARIANT_MAP` in `core/tailor.py`
4. Add to `profile.categories` in `config.yaml`

## Build Timeline
| Phase | What | Status |
|-------|------|--------|
| 1 | Job Radar — RSS + scrapers | Done |
| 2 | Resume tailoring + Groq/Ollama | Done |
| 3 | Apply Fleet — Playwright workers | Done |
| 4 | Review dashboard | Not started |
