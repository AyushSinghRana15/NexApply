# `scripts/` — One-Time Setup & Demo Scripts

Helper scripts for initial setup, cookie capture, and testing.

```
scripts/
├── save_cookies.py   # Opens browser for manual login → saves session cookies
├── demo.py           # Injects fake jobs into guard_queue for testing
└── seed.py           # Seeds demo data into the database
```

---

## `save_cookies.py`

One-time cookie capture per platform. Opens a Playwright browser, you log in manually, then cookies are saved to `cookies/{platform}_cookies.json`.

```bash
python3 scripts/save_cookies.py indeed
python3 scripts/save_cookies.py naukri
python3 scripts/save_cookies.py internshala
```

| Function | Line | Purpose |
|---|---|---|
| `main()` | 20 | Playwright launch → manual login → save cookies |

---

## `demo.py`

Injects fake application payloads directly into the guard queue (bypasses Radar/Tailor/Fleet). Used for testing the review dashboard flow.

```bash
python3 scripts/demo.py
```

| Function | Line | Purpose |
|---|---|---|
| `inject_demo_jobs()` | 30 | Creates fake ApplicationPayload objects and enqueues them |

---

## `seed.py`

Seeds the SQLite database with demo records for development/testing.

```bash
python3 scripts/seed.py
```

| Function | Line | Purpose |
|---|---|---|
| `seed_demo_data()` | 40 | Creates 5 Application + ResumeVariant records |
| `main()` | 120 | Auto-runs when the database is empty |
