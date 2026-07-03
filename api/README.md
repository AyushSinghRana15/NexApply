# `api/` — REST API (FastAPI)

FastAPI-based REST API for managing jobs, applications, resume variants, configuration, statistics, and WebSocket connections. Serves the frontend dashboard and supports external integrations.

```
api/
├── main.py              # FastAPI app entry, lifespan, router mounting
├── __init__.py
├── core/
│   ├── config.py        # Pydantic BaseSettings (env vars)
│   └── websocket.py     # WebSocket connection manager
├── db/
│   ├── database.py      # SQLAlchemy engine, session, init_db
│   └── migrations/
├── models/              # SQLAlchemy ORM models
│   ├── job.py           # Job model
│   ├── application.py   # Application model (JSON list/dict types)
│   └── resume.py        # ResumeVariant model
├── schemas/             # Pydantic request/response schemas
│   ├── application.py   # ApplicationResponse, DecisionRequest
│   ├── job.py           # JobResponse, JobListResponse
│   └── stats.py         # SummaryResponse, TimelinePoint, PlatformBreakdown, EmailTrackingStats
├── routes/              # API route handlers
│   ├── health.py        # GET /api/health
│   ├── jobs.py          # GET /api/jobs
│   ├── applications.py  # CRUD + decision + email history
│   ├── stats.py         # Summary, timeline, platform breakdown, email tracking
│   ├── resumes.py       # CRUD + upload + parse + preview + profile from resume
│   ├── config.py        # GET / PATCH config
│   ├── logs.py          # GET activity log
│   └── ws.py            # WebSocket upgrade endpoint
├── services/            # Business logic
│   ├── agent_bridge.py  # Bridges API ↔ core agents
│   ├── decision.py      # Approve/skip/timeout workflow
│   ├── stats.py         # Statistics computation
│   ├── gmail_tracker.py # Simulated email status tracking
│   ├── daily_report.py  # Markdown report generation
│   ├── scheduler.py     # APScheduler for recurring tasks
│   └── resume_optimizer.py  # Resume variant AI analysis
└── middleware/
    ├── error_handler.py # Global exception handler
    └── logging.py       # Request duration tracking
```

---

## `main.py`

| Function | Line | Purpose |
|---|---|---|
| `create_app()` | 20 | Creates FastAPI app, sets lifespan |
| `lifespan(app)` | 40 | Agent startup/shutdown |
| `mount_routers(app)` | 70 | Mounts all route modules |

---

## Routes

| Endpoint | Methods | Purpose |
|---|---|---|
| `/api/health` | GET | System health (version, uptime, agents, timestamp) |
| `/api/jobs` | GET | Paginated job list |
| `/api/applications` | GET | Paginated, filterable application list |
| `/api/applications/{id}` | GET | Single application detail |
| `/api/applications/{id}/email-history` | GET | Email history for an application |
| `/api/applications/{id}/decision` | PATCH | Approve/skip/timeout a review |
| `/api/applications` | DELETE | Clear all applications |
| `/api/stats/summary` | GET | Aggregate stats |
| `/api/stats/timeline` | GET | Application timeline data |
| `/api/stats/platforms` | GET | Per-platform breakdown |
| `/api/stats/email-tracking` | GET | Email status stats |
| `/api/resumes` | GET | List resume variants |
| `/api/resumes` | POST | Create a resume variant |
| `/api/resumes/upload` | POST | Upload resume file |
| `/api/resumes/parse` | POST | Parse a PDF resume |
| `/api/resumes/profile-from-resume` | POST | Generate profile.yaml from resume |
| `/api/resumes/preview` | POST | Preview keyword-injected resume |
| `/api/resumes/{id}` | PATCH | Update a resume variant |
| `/api/resumes/{id}` | DELETE | Delete a resume variant |
| `/api/config` | GET | Get full config |
| `/api/config` | PATCH | Partially update config |
| `/api/logs/activity` | GET | Recent activity log |
| `/ws` | WebSocket | Real-time review events |

---

## Database Models

### `models/job.py` — Job

| Column | Type | Notes |
|---|---|---|
| id | Integer PK | Auto |
| job_id | String | Unique |
| platform | String | indeed/naukri/internshala |
| title | String | |
| company | String | |
| location | String | |
| description | Text | |
| apply_url | String | |
| posted_at | DateTime | |
| detected_at | DateTime | |
| created_at | DateTime | Auto |

### `models/application.py` — Application

| Column | Type | Notes |
|---|---|---|
| id | Integer PK | Auto |
| job_id | String | |
| platform | String | |
| title | String | |
| company | String | |
| match_score | Integer | 0–100 |
| resume_variant | String | |
| tailored_resume | Text | Nullable |
| keywords_injected | JSONList | Custom JSON array type |
| screenshot_path | String | |
| form_data | JSONDict | Nullable |
| status | String | PENDING_REVIEW / APPLIED / SKIPPED / etc. |
| decision | String | Nullable |
| decided_at | DateTime | Nullable |
| time_to_decide_seconds | Integer | Nullable |
| email_status | String | Nullable |
| created_at | DateTime | Auto |
| updated_at | DateTime | On update |

### `models/resume.py` — ResumeVariant

| Column | Type | Notes |
|---|---|---|
| id | Integer PK | Auto |
| name | String | |
| category | String | |
| content | Text | |
| is_active | Boolean | Default true |
| parsed_data | JSONDict | Nullable |
| source_file | String | Nullable |
| created_at | DateTime | Auto |
| updated_at | DateTime | Nullable |

---

## Services

| Service | File | Purpose |
|---|---|---|
| `AgentBridge` | `agent_bridge.py` | Bridges API calls to core agent queues |
| `DecisionService` | `decision.py` | Approve/skip/timeout logic with DB writes |
| `StatsService` | `stats.py` | Computes summary, timeline, platform, email stats |
| `GmailTracker` | `gmail_tracker.py` | Simulated email status via deterministic hashing |
| `DailyReport` | `daily_report.py` | Generates daily/weekly markdown reports |
| `Scheduler` | `scheduler.py` | APScheduler: Gmail scan (15min), resume optimizer (2am), daily report (9pm) |
| `ResumeOptimizer` | `resume_optimizer.py` | AI-based resume variant analysis & suggestions |
