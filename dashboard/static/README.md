# `static/` — Dashboard Static Files

```
static/
└── index.html  # 630-line embedded HTML + JS review UI
```

Served by `dashboard/server.py` at the root route (`GET /`). Contains the full review dashboard UI — dark-themed card layout with WebSocket connectivity, keyboard shortcuts (A/S), and live countdown timer.
