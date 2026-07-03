# `pages/` — Route Page Components

7 pages, one per route. Each handles its own data fetching via TanStack Query hooks and renders into the Layout Outlet.

```
pages/
├── index.ts           # Re-exports all 7 pages
├── Dashboard.tsx      # / — Agent status, stats, activity feed
├── Review.tsx         # /review — Review queue with approve/skip
├── Applications.tsx   # /applications — Table + detail panel
├── Analytics.tsx      # /analytics — Recharts charts
├── Resumes.tsx        # /resumes — Resume variant manager
├── Settings.tsx       # /settings — Full app configuration
└── Apps.tsx           # /apps — Cookie management
```

---

## `Dashboard.tsx` — Route: `/`

Home page. Shows agent status cards, stat cards, live activity feed, platform health indicators, and recent applications.

| Internal Component | Purpose |
|---|---|
| `AgentCard({ agent })` | Status card for each of the 5 agents (online/offline/jobs_today) |
| `EventIcon({ type, className })` | Icon for activity feed event types |

## `Review.tsx` — Route: `/review`

Real-time review queue. Displays one review at a time with screenshot, job details, tailored resume tabs, and live countdown.

| Internal Component | Purpose |
|---|---|
| `CountdownBar({ timeLeft, total })` | Animated countdown bar (turns red under 60s) |

**Keyboard shortcuts:** A = Approve, E = Edit, S = Skip

## `Applications.tsx` — Route: `/applications`

Filterable, sortable table of all applications. Click a row to open a slide-out detail panel showing full application info, decision, and email history.

## `Analytics.tsx` — Route: `/analytics`

Chart dashboard using Recharts:

| Chart | Type | Data |
|---|---|---|
| Applications over time | Bar chart (Timeline) | Per-day counts |
| Platform distribution | Pie chart | Indeed / Naukri / Internshala |
| Match score distribution | Bar chart | Score buckets |
| Decision speed | Bar chart | Avg time-to-decide per platform |

| Internal Component | Purpose |
|---|---|
| `CustomPieLabel({ cx, cy })` | Custom label renderer for pie chart |

## `Resumes.tsx` — Route: `/resumes`

Grid of resume variants with full CRUD:

| Feature | Purpose |
|---|---|
| Upload | Upload a .txt or .pdf file as a new variant |
| Parse | Parse a PDF resume into structured data |
| Edit | Modify variant content inline |
| Preview | Preview keyword-injected version |
| Delete | Remove a variant |
| Toggle | Activate/deactivate a variant |

| Internal Function | Purpose |
|---|---|
| `wordCount(text)` | Count words in resume content |
| `ParsedDataSummary({ data })` | Display parsed resume sections |

## `Settings.tsx` — Route: `/settings`

Full configuration UI:

| Section | Controls |
|---|---|
| Platform toggles | indeed / naukri / internshala on/off |
| Filters | Title tags, location tags, exclude keyword tags |
| Agent timing | Polling interval, human delays, page timeout |
| LLM config | Groq model, timeout, Ollama host |
| Guard config | Review timeout, min match score |
| Autonomous mode | Daily cap, cooldown, rate limit |
| Danger zone | Clear all applications, emergency stop |

| Internal Component | Purpose |
|---|---|
| `TagInput({ tags, onChange, placeholder })` | Tag-style input for arrays (titles, locations, etc.) |
| `Toggle({ checked, onChange, label })` | On/off toggle switch |

## `Apps.tsx` — Route: `/apps`

Cookie/session management per platform.

| Internal Component | Purpose |
|---|---|
| `PlatformCard({ platform, status, onCapture, onClear, capturing })` | Card showing cookie status, capture/clear buttons |
