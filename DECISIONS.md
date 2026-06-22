# Decision Log — NexApply

This file tracks key architectural decisions, changes, and context throughout the project. Every entry includes a timestamp and rationale.

---

### 2024-01-01 — Project initialized

- Git repo initialized with remote `origin` set to `github.com/AyushSinghRana15/NexApply`.
- `README.md` created with project outline: job radar, AI tailoring, apply fleet, review dashboard.
- `AGENTS.md` created defining 5-agent architecture (RadarAgent, QueueBroker, TailorAgent, ApplyFleet, GuardAgent).

### 2024-01-01 — Removed "ResuMorph" name

- The project was originally referred to as "ResuMorph" in the README. Corrected to "NexApply" only.
- Rationale: the user clarified the actual project name is NexApply; ResuMorph was a mistake.

### 2024-01-01 — Created DECISIONS.md

- Added this file to track all future decisions and changes with timestamps.

### 2026-06-22 — Phase 2: TailorAgent complete

- Built TailorAgent with 5 core modules: classifier (keyword match, <1ms), llm (Groq→Ollama→title fallback), scorer (0-100 formula), tailor (main pipeline), and updated models (TailoredResult dataclass).
- Created 6 resume variants in `/resumes/` (engineering, data, product, devops, design, ml) with `{{KEYWORDS}}` placeholders.
- Extracted user's original resume (ml_v1.txt) from PDF — PDF added to `.gitignore`.
- Prompts versioned in `/prompts/keyword_extraction.txt` — no inline prompt strings.
- Groq API call with 8s hard timeout; falls back to Ollama (mistral) → title word extraction.
- Match score formula: 60% keyword overlap + 25% category + 15% location.
- Live terminal logging with emoji prefixes matching the spec (🧠, 📋, 🔍, ⚡, 🔑, ✅, 💾, 📤).
- Updated main.py to run RadarAgent + TailorAgent concurrently on shared asyncio queues.
- Updated config.yaml with `tailor:` section (min_match_score, models, timeouts).
- Updated README.md with full Phase 2 docs, architecture diagram, config reference.
- Added `__pycache__/` to `.gitignore`.
- Added `logs/resumes/` and `*.pdf` to `.gitignore`.

### 2026-06-22 — Phase 3: ApplyFleet complete

- Built ApplyFleet orchestrator (`core/fleet.py`) with platform routing, semaphore-based concurrency (max 3 browsers), and JSONL application logging.
- Created `workers/base.py` — BaseWorker class with `smart_fill` (selector fallback chain), cookie loader, resume upload, screenshot capture, and human-like delays (0.5-1.2s).
- Created 4 platform workers: Indeed (form fill + external ATS detection), LinkedIn (Easy Apply multi-step wizard), Naukri (modal with CTC/notice period), Internshala (simple cover + availability).
- Built `scripts/save_cookies.py` — one-time cookie saver that opens visible browser, waits for manual login (120s), saves to `cookies/{platform}_cookies.json`.
- Created `profile.yaml` — answer bank (name, phone, CTC, cover letter template with `{title}/{company}/{keywords}` placeholders).
- Created `selectors.yaml` — all DOM selectors externalized outside code with fallback chains per field.
- Added `ApplicationPayload` dataclass to `core/models.py` with status codes (PENDING_REVIEW, MANUAL_REQUIRED, NEEDS_COOKIES, FAILED, UNKNOWN_FORM) and JSONL serialization.
- Added fleet-specific terminal logging methods (🚀, 🍪, 🌐, 🔓, 📝, 📎, 📸, ⏸️, 📤).
- Updated main.py to run all 3 agents (Radar → Tailor → Fleet) concurrently on shared queues.
- Updated config.yaml with `fleet:` section (max_concurrent_browsers, headless, delays, timeout).
- Updated README.md with full Phase 3 docs, architecture diagram, worker table, status codes, and cookie setup instructions.
- Added `cookies/`, `logs/screenshots/`, `scripts/` directories.
- Updated `.gitignore` for all new log/asset directories.

### 2025-06-20 — Phase 1: Job Radar complete

- Built RadarAgent with 4 platform watchers (LinkedIn/Indeed RSS, Naukri/Internshala scraping).
- Redis dedup with in-memory fallback.
- Live terminal logger with timestamps and emoji prefixes.
- Updated feed URLs: LinkedIn with `&format=rss`, Indeed → `in.indeed.com`.
- Installed Playwright + Chromium for Naukri/Internshala scrapers.
- Created `requirements.txt`, updated `README.md` with setup instructions.
- Added `.venv/` to `.gitignore`.
