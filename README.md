# NexApply

Automated job application system that detects job postings in real-time, tailors resumes via AI, and submits applications within 1-2 minutes.

## The Core Challenge
Apply within 1-2 minutes of job posting. Pipeline: Job Posted → Detected in <30s → Resume Tailored in <20s → Form Filled in <30s → Submitted.
Requires real-time monitoring + parallel execution + pre-cached tailoring.

## Full Architecture
```
┌─────────────────────────────────────────────────────┐
│                   RESUMORPH CORE                    │
├──────────────┬──────────────┬───────────────────────┤
│  JOB RADAR   │  AI ENGINE   │   APPLY FLEET         │
│  (Watchers)  │  (Groq/LLM)  │   (Playwright Pool)   │
├──────────────┼──────────────┼───────────────────────┤
│ LinkedIn RSS │ Pre-tailored │ Worker: LinkedIn      │
│ Indeed RSS   │ resume cache │ Worker: Indeed        │
│ Naukri API   │ per job type │ Worker: Naukri        │
│ Internshala  │              │ Worker: Internshala   │
│ Polling loop │ Smart match  │ Worker: Custom        │
└──────────────┴──────────────┴───────────────────────┘
         ↓                              ↓
    Redis Queue              Human Review Dashboard
    (job events)             (approve/reject before submit)
```

## Speed Strategy
Don't tailor at apply-time. Pre-tailor nightly:
- Generate 10-15 resume variants by job category (e.g. "SDE resume", "ML Engineer resume")
- At apply-time: classify job → pick nearest variant → minor keyword swap (3-5s)
- Cuts LLM call from 20s → 3s at runtime.

## Tech Stack
- asyncio (parallel execution)
- playwright (browser automation)
- aiohttp (async HTTP for RSS)
- redis (job queue + deduplication)
- groq (free LLM, llama3 70b)
- feedparser (RSS parsing)
- apscheduler (cron-style polling)
- fastapi (review dashboard)

## Job Detection by Platform
| Platform    | Method          | Latency |
|-------------|-----------------|---------|
| LinkedIn    | RSS feed/scrape | ~1 min  |
| Indeed      | RSS feed        | ~30s    |
| Naukri      | Polling API     | ~2 min  |
| Internshala | RSS/scrape      | ~1-2 min|
| Custom      | Webhook/RSS     | Real-time|

## Repo Structure
```
resumorph/
├── core/
│   ├── radar.py        # job watchers per platform
│   ├── tailor.py       # LLM tailoring engine
│   └── queue.py        # Redis job queue
├── workers/
│   ├── linkedin.py     # Playwright worker
│   ├── indeed.py
│   ├── naukri.py
│   └── internshala.py
├── resumes/
│   ├── engineering.txt # pre-built variants
│   ├── product.txt
│   └── data.txt
├── dashboard/          # FastAPI review UI
├── config.yaml         # preferences, filters
└── main.py             # orchestrator
```

## Human Review (Critical)
Never auto-submit blindly. Dashboard shows:
- Job details + platform + age
- Match score
- Resume variant used + injected keywords
- Actions: Preview, Submit, Edit, Skip

## Build Timeline
| Phase | What | Time |
|-------|------|------|
| 1 | RSS radar + Indeed/LinkedIn detection | 2-3 days |
| 2 | Resume variants + Groq tailoring | 1-2 days |
| 3 | Playwright workers per platform | 3-5 days |
| 4 | Review dashboard | 2-3 days |
| **Total** | **Full MVP** | **~2 weeks** |
