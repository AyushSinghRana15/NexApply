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
┌────────────────────────────────────────────┐
│               NEXAPPLY CORE                │
├──────────────┬──────────────┬──────────────┤
│  JOB RADAR   │  AI ENGINE   │ APPLY FLEET  │
│  (Watchers)  │  (Groq/LLM)  │ (Playwright) │
├──────────────┼──────────────┼──────────────┤
│ LinkedIn RSS │ Pre-tailored │ Worker: LIn  │
│ Indeed RSS   │ resume cache │ Worker: In   │
│ Naukri API   │ per job type │ Worker: Nauk │
│ Internshala  │              │ Worker: Int  │
│ Polling loop │ Smart match  │ Worker: Cus  │
└──────────────┴──────────────┴──────────────┘
         ↓                   ↓
    Redis Queue      Human Review Dashboard
    (job events)     (approve/reject)
```

## Speed Strategy
Don't tailor at apply-time. Pre-tailor nightly:
- Generate 10-15 resume variants by job category
- At apply-time: classify → pick variant → keyword swap (3-5s)

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
│   ├── radar.py        # RadarAgent — job watchers per platform
│   ├── queue.py        # Async job queue
│   ├── models.py       # JobEvent dataclass
│   └── logger.py       # Live terminal logger
├── workers/            # ApplyFleet (coming in Phase 3)
├── resumes/            # Pre-built resume variants (Phase 2)
├── dashboard/          # Review dashboard (Phase 4)
├── config.yaml         # Platform toggles, filters, intervals
├── main.py             # Entry point
└── requirements.txt    # Dependencies
```

## Environment
```bash
GROQ_API_KEY=           # For Phase 2 (free at console.groq.com)
REDIS_URL=redis://localhost:6379
```

## Build Timeline
| Phase | What | Time |
|-------|------|------|
| 1 | Job Radar — RSS + scrapers | Done |
| 2 | Resume tailoring + Groq | Next |
| 3 | Apply Fleet — Playwright workers | 3-5 days |
| 4 | Review dashboard | 2-3 days |
