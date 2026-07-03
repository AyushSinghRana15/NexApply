# `hooks/` — React Hooks

```
hooks/
├── useQueries.ts    # 8 TanStack Query hooks with configurable stale times
└── useWebSocket.ts  # Basic WebSocket hook returning a ref
```

---

## `useQueries.ts`

| Hook | Purpose |
|---|---|
| `useJobs(page)` | Fetches paginated jobs |
| `useApplications(params)` | Fetches filtered applications |
| `useApplication(id)` | Fetches single application |
| `useStatsSummary()` | Fetches aggregate stats |
| `useStatsTimeline()` | Fetches timeline data |
| `useStatsPlatforms()` | Fetches platform breakdown |
| `useResumes()` | Fetches resume variants |
| `useConfig()` | Fetches full config |

All hooks use TanStack Query with `staleTime` and `refetchInterval` configured for real-time-ish updates.

---

## `useWebSocket.ts`

| Export | Purpose |
|---|---|
| `useWebSocket()` | Returns a `wsRef` (MutableRefObject\<WebSocket \| null\>) |
