# `workers/` — Platform-Specific Form Fillers

Each worker extends `BaseWorker` and implements the platform-specific application form flow. Workers are instantiated by `ApplyFleet` in `core/fleet.py`.

```
workers/
├── base.py         # BaseWorker — shared form-filling engine for all platforms
├── indeed.py       # IndeedWorker — Indeed Apply flow
├── naukri.py       # NaukriWorker — Naukri modal apply
└── internshala.py  # InternshalaWorker — Internshala form apply
```

---

## `base.py` — BaseWorker

Abstract base class with the shared form-filling engine. All platform workers inherit from this.

| Method | Line | Purpose |
|---|---|---|
| `__init__` | 30 | Loads selectors, profile, cookies for the platform |
| `setup_browser` | 60 | Launches Playwright browser context |
| `load_cookies` | 90 | Loads `cookies/{platform}_cookies.json` |
| `navigate` | 120 | Goto URL with retry logic |
| `smart_fill` | 150 | Chain of selector fallbacks per field (tries each selector in order) |
| `fill_field` | 200 | Types into a field with human-like delays |
| `upload_resume` | 250 | File input → resume file path |
| `screenshot` | 280 | Page screenshot to `logs/screenshots/` |
| `human_delay` | 310 | Random 0.5–1.2s delay between actions |
| `click_submit` | 330 | Click submit with generic fallback |
| `close` | 360 | Close browser |
| `detect_ats_form` | 380 | Heuristic for detecting external ATS (Workday, Greenhouse) |

### Field Filling Strategy (`smart_fill`)

Each field has a fallback chain of CSS selectors defined in `selectors.yaml`. The worker tries each selector in order and uses the first match:

```yaml
indeed:
  first_name:
    - input[name="first_name"]
    - input[id*="first"]
    - input[placeholder*="First"]
```

If a field can't be found after all fallbacks, it's logged as a warning and skipped.

---

## `indeed.py` — IndeedWorker

Applies to jobs on Indeed. Fields: first_name, last_name, email, phone, resume, cover_letter.

| Method | Line | Purpose |
|---|---|---|
| `IndeedWorker.__init__` | 20 | Platform = "indeed" |
| `apply(payload)` | 40 | Full Indeed form fill flow → returns ApplicationPayload |

**Challenges:** Sometimes redirects to external ATS (Workday, Greenhouse) — detected by `detect_ats_form()` and marked as `MANUAL_REQUIRED`.

---

## `naukri.py` — NaukriWorker

Applies to jobs on Naukri via their apply modal. Fields: cover_letter, notice_period, current_ctc, expected_ctc, resume.

| Method | Line | Purpose |
|---|---|---|
| `NaukriWorker.__init__` | 20 | Platform = "naukri" |
| `apply(payload)` | 45 | Naukri modal apply flow → returns ApplicationPayload |

**Challenges:** Login required, CTC/notice period fields are Naukri-specific. Uses cookie-based session.

---

## `internshala.py` — InternshalaWorker

Applies to jobs on Internshala. Fields: cover_letter, availability, resume.

| Method | Line | Purpose |
|---|---|---|
| `InternshalaWorker.__init__` | 20 | Platform = "internshala" |
| `apply(payload)` | 40 | Internshala form flow → returns ApplicationPayload |

**Challenges:** Easiest platform — simple form, login required via cookies.
