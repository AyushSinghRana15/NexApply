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

### 2025-06-20 — Phase 1: Job Radar complete

- Built RadarAgent with 4 platform watchers (LinkedIn/Indeed RSS, Naukri/Internshala scraping).
- Redis dedup with in-memory fallback.
- Live terminal logger with timestamps and emoji prefixes.
- Updated feed URLs: LinkedIn with `&format=rss`, Indeed → `in.indeed.com`.
- Installed Playwright + Chromium for Naukri/Internshala scrapers.
- Created `requirements.txt`, updated `README.md` with setup instructions.
- Added `.venv/` to `.gitignore`.
