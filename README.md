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
┌──────────────────────────────────────────────────────────────────┐
│                        NEXAPPLY RUNTIME                          │
├──────────────┬──────────────────┬──────────────────┬─────────────┤
│  RadarAgent  │   TailorAgent    │   ApplyFleet      │  GuardAgent │
│  (Phase 1)   │  (Phase 2)       │  (Phase 3)        │  (Phase 4)  │
├──────────────┼──────────────────┼──────────────────┼─────────────┤
│ Indeed RSS   │ Classifier (5ms) │ Worker: Indeed    │ Review card │
│ Naukri scraper│ Groq API (8s)   │ Worker: Naukri    │ / skip /    │
│ Internshala  │ → Ollama fallback│ Worker: Internshala│ auto-skip   │
│ Dedup (Redis)│ Scorer (0-100)   │ Form fill + pause │ after 5min  │
└──────┬───────┴──────┬───────────┴──────────┬───────┴─────────────┘
       │              │                      │
       ▼              ▼                      ▼
  job_queue       tailor_queue          guard_queue
```

### The 5 Agents (Plain English)

| Agent | What it does |
|---|---|
| **RadarAgent** | Watches job sites like a hawk. Polls Indeed's RSS feed every 30s, scrapes Naukri & Internshala. Never emits the same job twice. |
| **QueueBroker** | The filter. Checks if a job matches your preferences (title, location, keywords). Drops the ones that don't. |
| **TailorAgent** | The resume whisperer. Figures out what category the job is (Engineering, Design, etc.), picks the closest pre-built resume template, asks Groq AI to extract key skills from the JD, and injects them into your resume. Scores the match 0–100. |
| **ApplyFleet** | The robot hands. Opens a browser, navigates to the application page, fills every field using your saved profile (name, phone, CTC, etc.), uploads the tailored resume, takes a screenshot — then **stops** and asks for permission. Never submits without you. |
| **GuardAgent** | The gatekeeper. Pushes a review card to a live dashboard showing the job details, your tailored resume, and a screenshot of the filled form. Gives you Approve / Edit / Skip buttons. Auto-skips after 5 minutes if you're away. |

### Job Flow

```
RadarAgent → job_queue → QueueBroker → filtered_queue → TailorAgent
                                                              ↓
                                                        tailor_queue
                                                              ↓
                                                         ApplyFleet
                                                              ↓
                                                        guard_queue
                                                              ↓
                                                         GuardAgent
                                                              ↓
                                             Human approves → Submitted
                                             Human skips    → Discarded
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

# Run it
python3 main.py
```

The review dashboard opens at `http://localhost:8000`. When a job is ready for review, a card appears with the job details + a screenshot of the filled form. Press **A** to approve, **S** to skip.

### Try Without Real Jobs

```bash
python3 main.py --test
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
├── core/               # The 5 agents + helpers
│   ├── radar.py        # RadarAgent — job detection
│   ├── broker.py       # QueueBroker — filtering
│   ├── tailor.py       # TailorAgent — resume AI
│   ├── fleet.py        # ApplyFleet — browser automation
│   ├── guard.py        # GuardAgent — human review gate
│   ├── classifier.py   # Keyword-based job category classifier
│   ├── llm.py          # Groq + Ollama wrapper with fallback
│   ├── scorer.py       # Match score calculator
│   ├── queue.py        # Async job queue
│   └── models.py       # Shared data types
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
├── dashboard/          # Review dashboard server
├── api/                # Optional API (stats, config management)
├── frontend/           # Dashboard frontend
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
3. Register it in `workers/__init__.py`
4. Add platform-specific fields to `profile.yaml`
5. Add DOM selectors to `selectors.yaml`

No changes needed to TailorAgent, QueueBroker, or GuardAgent.
