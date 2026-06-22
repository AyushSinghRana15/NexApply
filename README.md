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

# Run
python3 main.py
```

## The Core Challenge
Apply within 1-2 minutes of job posting. Pipeline: Job Posted → Detected in <30s → Resume Tailored in <20s → Form Filled in <30s → Submitted.
Requires real-time monitoring + parallel execution + pre-cached tailoring.

## Architecture
```
┌──────────────────────────────────────────────────────────┐
│                     NEXAPPLY RUNTIME                      │
├──────────────┬──────────────────┬────────────────────────┤
│  RadarAgent  │   TailorAgent    │   ApplyFleet (Phase 3) │
│  (Watchers)  │  (LLM + Resume)  │    (Playwright)        │
├──────────────┼──────────────────┼────────────────────────┤
│ LinkedIn RSS │ Classifier (5ms) │ Worker: LinkedIn       │
│ Indeed RSS   │ → keyword match  │ Worker: Indeed         │
│ Naukri scraper│ Groq API (8s)   │ Worker: Naukri         │
│ Internshala  │ → Ollama fallback│ Worker: Internshala    │
│ Dedup (Redis)│ Scorer (0-100)   │ Form fill + pause      │
└──────┬───────┴──────┬───────────┴───────────┬────────────┘
       │              │                       │
       ▼              ▼                       ▼
  asyncio.Queue   TailoredResult        GuardAgent
  (JobEvents)     (keywords,score)      (Phase 4 review)
```

**Agent pipeline:** RadarAgent → `job_queue` → TailorAgent → `tailor_queue` → ApplyFleet (Phase 3)

## Speed Strategy

| Step | Target | Actual |
|------|--------|--------|
| Job detection | <30s | ~30s (RSS) / ~2min (scrape) |
| Classification | 5ms | <1ms (keyword match) |
| Keyword extraction (Groq) | 8s | ~500ms |
| Resume injection | 1s | <10ms |
| Total tailor time | 10s | ~1-2s |

## Agent Communication

Agents communicate via `asyncio.Queue` with no external broker dependency:

```
job_queue = JobQueue()     # Radar → Tailor
tailor_queue = JobQueue()  # Tailor → ApplyFleet (Phase 3)
```

Both queues live in-process. Phase 3 will add Redis-backed persistence.

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
│   ├── classifier.py    # Keyword-based job category classifier
│   ├── llm.py           # Groq + Ollama wrapper with fallback
│   ├── scorer.py        # Match score calculator (0-100)
│   ├── queue.py         # Async job queue (asyncio.Queue wrapper)
│   ├── models.py        # JobEvent + TailoredResult dataclasses
│   └── logger.py        # Live terminal logger with emoji prefixes
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
│   └── resumes/                 # Saved tailored resumes per application
├── workers/             # ApplyFleet (coming in Phase 3)
├── dashboard/           # Review dashboard (coming in Phase 4)
├── config.yaml          # Platform toggles, filters, tailor config
├── main.py              # Entry point — launches Radar + Tailor
└── requirements.txt     # Dependencies
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
| 3 | Apply Fleet — Playwright workers | Next |
| 4 | Review dashboard | Not started |
