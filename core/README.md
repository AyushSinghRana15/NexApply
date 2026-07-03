# `core/` — The 5 Agents + Supporting Modules

This is the heart of NexApply. All agent logic, data models, queues, scoring, classification, and LLM integration live here.

```
core/
├── radar.py         # RadarAgent  — job detection (RSS + scrapers)
├── broker.py        # QueueBroker — job filtering & routing
├── tailor.py        # TailorAgent — resume classification, AI tailoring, scoring
├── fleet.py         # ApplyFleet  — concurrent browser worker orchestrator
├── guard.py         # GuardAgent  — human-in-the-loop review gate
├── autonomous.py    # AutonomousAgent — rate limits, daily caps, duplicate control
├── models.py        # Shared dataclasses (JobEvent, TailoredResult, ApplicationPayload)
├── queue.py         # Async queue wrapper around asyncio.Queue
├── llm.py           # LLM module — Groq primary, Ollama fallback
├── classifier.py    # Keyword-based job category classifier
├── scorer.py        # Match score calculator (0–100)
├── logger.py        # Emoji-prefixed console logger
└── resume_parser.py # PDF/TXT resume parser
```

---

## Agent Descriptions

### `radar.py` — RadarAgent

Real-time job discovery. Polls Indeed RSS every 30s, scrapes Naukri & Internshala via Playwright. Deduplicates jobs using Redis SET (with in-memory fallback). Emits `JobEvent` objects to `job_queue`.

| Method | Line | Purpose |
|---|---|---|
| `RadarAgent.__init__` | 70 | Stores config, initializes seen_jobs set |
| `start` | 95 | Spawns watcher coroutines per platform |
| `_watch_indeed` | 105 | RSS polling via feedparser |
| `_watch_naukri` | 135 | Playwright scraping loop |
| `_watch_internshala` | 175 | Playwright scraping loop |
| `_emit` | 220 | Puts JobEvent into job_queue |
| `_is_duplicate` | 235 | Redis SET + memory dedup check |
| `_dedup_key` | 250 | Returns "radar:seen:\<job_id\>" |

### `broker.py` — QueueBroker

Central filter. Consumes `JobEvent` from `job_queue`, applies user-defined filters (title, location, exclude_keywords), and dispatches matching jobs to `filtered_queue`.

| Method | Line | Purpose |
|---|---|---|
| `QueueBroker.__init__` | 30 | Loads title/location/exclude filters |
| `start` | 50 | Consumes from job_queue, pushes to filtered_queue |
| `_matches` | 65 | Title + location + exclude keyword check |
| `_log_dispatch` | 100 | Dispatch audit log entry |

### `tailor.py` — TailorAgent

Resume adaptation pipeline per job: classify → select variant → extract keywords via LLM → inject into template → score match → save log.

| Method | Line | Purpose |
|---|---|---|
| `TailorAgent.__init__` | 40 | Loads classifier, LLM, scorer, resume variants |
| `start` | 70 | Consumes from filtered_queue |
| `_process` | 85 | Full pipeline per job |
| `classify_job` | 120 | Delegates to classifier.classify_job() |
| `select_variant` | 145 | Picks nearest resume template |
| `extract_keywords` | 170 | Calls LLM.extract_keywords() |
| `inject_keywords` | 200 | Replaces {{KEYWORDS}} placeholder |
| `score_match` | 220 | Calls scorer.compute_score() |
| `generate_cover_letter` | 245 | Optional LLM cover letter |
| `_save_log` | 270 | Saves tailored resume to logs/resumes/ |

### `fleet.py` — ApplyFleet

Orchestrates concurrent Playwright browser workers. Consumes `TailoredResult` from `tailor_queue`, routes to correct platform worker, manages semaphore-based concurrency.

| Method | Line | Purpose |
|---|---|---|
| `ApplyFleet.__init__` | 40 | Semaphore, platform→worker map |
| `start` | 70 | Consumes from tailor_queue |
| `_process` | 90 | Routes to correct worker |
| `_get_worker` | 120 | Returns platform-specific worker instance |
| `_run_worker` | 140 | Wraps worker.apply() with semaphore |
| `_log_application` | 170 | JSONL log entry |

### `guard.py` — GuardAgent

Human-in-the-loop review gate. Receives `ApplicationPayload`, pushes review cards to dashboard, waits for human decision with 5-min auto-skip timeout.

| Method | Line | Purpose |
|---|---|---|
| `GuardAgent.__init__` | 45 | Review timeout, min match threshold |
| `start` | 75 | Consumes from guard_queue |
| `_show_review_card` | 100 | Prints review card to terminal |
| `approve` | 140 | Clicks submit on live page |
| `skip` | 170 | Closes browser gracefully |
| `_auto_skip_timeout` | 190 | 5-min background timeout task |
| `_log_decision` | 215 | JSONL log |
| `WSManager` | 30 | WebSocket manager for dashboard |

### `autonomous.py` — AutonomousAgent

Rate limiter and safety guard. Enforces daily application caps, cooldowns, rate limits, and duplicate prevention.

| Method | Line | Purpose |
|---|---|---|
| `AutonomousAgent.__init__` | 35 | Loads daily cap, cooldown, rate limit |
| `start` | 60 | Consumes from tailor_queue |
| `_process` | 80 | Check limits, forward or skip |
| `_check_daily_cap` | 110 | Counts today's applications |
| `_check_rate_limit` | 130 | Sliding window check |
| `_check_duplicate` | 150 | Checks for same job_id applied |
| `_enforce_cooldown` | 170 | Wait between dispatches |
| `_load_applied_ids` | 185 | Reads from JSONL |

---

## Supporting Modules

### `models.py`

Shared dataclasses used across all agents.

| Class | Line | Fields |
|---|---|---|
| `JobEvent` | 10 | job_id, platform, title, company, location, description, apply_url, posted_at, detected_at |
| `GeneratedContent` | 30 | cover_letter, screening_answers |
| `TailoredResult` | 40 | job_id, resume_variant, tailored_resume, keywords_injected, match_score, llm_used, category, tailored_at, generated_content |
| `ApplicationPayload` | 60 | Extends TailoredResult + status, page, screenshot_path, form_data, decided_at, time_to_decide_seconds |

### `queue.py`

| Class | Line | Purpose |
|---|---|---|
| `JobQueue` | 15 | Wraps asyncio.Queue with get/put/empty/qsize |

### `llm.py`

| Method | Line | Purpose |
|---|---|---|
| `LLM.__init__` | 30 | Groq client, Ollama config, prompt loading |
| `extract_keywords` | 60 | Groq → Ollama → title word fallback chain |
| `_call_groq` | 100 | Groq SDK call with 8s timeout |
| `_call_ollama` | 130 | Ollama HTTP call |
| `_parse_keywords_response` | 155 | Parse comma-separated keywords |
| `generate_cover_letter` | 175 | Groq for cover letter |
| `answer_screening` | 200 | Groq for screening questions |
| `_load_prompt` | 220 | Read from prompts/{name}.txt |

### `classifier.py`

| Method | Line | Purpose |
|---|---|---|
| `CATEGORY_KEYWORDS` | 10 | Dict: category → list of trigger keywords |
| `classify_job` | 80 | Returns category string from title + description |

### `scorer.py`

| Method | Line | Purpose |
|---|---|---|
| `compute_score` | 20 | Returns 0–100: 60% keyword overlap + 25% category + 15% location |

### `logger.py`

| Method | Line | Purpose |
|---|---|---|
| `Logger.info` | — | Info with emoji prefix |
| `Logger.warn` | — | Warning with emoji prefix |
| `Logger.error` | — | Error with emoji prefix |
| `Logger.debug` | — | Debug with emoji prefix |

### `resume_parser.py`

Full PDF/TXT resume parser (676+ lines).

| Method | Line | Purpose |
|---|---|---|
| `ResumeParser.__init__` | 20 | Init |
| `parse` | 40 | Detects .pdf or .txt, returns ParsedResumeData |
| `_parse_pdf` | 80 | PyPDF2 extraction |
| `_parse_txt` | 130 | Raw text read |
| `_split_sections` | 160 | Regex-based section splitting |
| `_parse_personal` | 220 | Name, email, phone, links |
| `_parse_summary` | 280 | Summary paragraph |
| `_parse_skills` | 310 | Primary/secondary/tools/frameworks/databases/cloud |
| `_parse_experience` | 380 | Title, company, dates, achievements |
| `_parse_education` | 460 | Highest/secondary/high_school |
| `_parse_projects` | 520 | Name, description, tech_stack, url |
| `_parse_certifications` | 580 | Name, issuer, date |
| `merge_into_profile` | 620 | Writes updated profile.yaml |
