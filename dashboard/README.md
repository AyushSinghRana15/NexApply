# `dashboard/` — Real-Time Review Dashboard

Standalone FastAPI server that provides the human review interface for GuardAgent. Pushes review cards via WebSocket and handles approve/skip decisions.

```
dashboard/
├── server.py       # FastAPI app with WebSocket + HTML/JS embedded
└── static/
    └── index.html  # 630-line embedded HTML/JS review UI
```

---

## `server.py`

| Endpoint | Method | Purpose |
|---|---|---|
| `/ws` | WebSocket | Streams NEW_REVIEW, COUNTDOWN, CLEARED events |
| `/` | GET | Serves the review dashboard HTML |
| `/approve` | POST | Approves a review (sends decision via WS) |
| `/skip` | POST | Skips a review |
| `/status` | GET | Returns queue status JSON |

---

## How the Review Flow Works

1. **ApplyFleet** fills a form, takes a screenshot, enqueues `ApplicationPayload` → `guard_queue`
2. **GuardAgent** receives it, broadcasts `NEW_REVIEW` via WebSocket to the dashboard
3. **Dashboard** shows: job details (40% width) + screenshot (60% width), animated match score bar, live countdown timer
4. **User** clicks **Approve** / **Edit** / **Skip** (or keyboard shortcuts A / E / S)
5. **GuardAgent** signals back → **ApplyFleet** submits or closes

## Dashboard Features

- Dark-themed card layout
- Job title, company, platform, match score
- Screenshot of the filled form
- Live countdown (turns red under 60s)
- Card slides in/out on transition
- Empty state with pulsing dot when idle
