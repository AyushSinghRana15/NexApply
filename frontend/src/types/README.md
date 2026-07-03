# `types/` — TypeScript Type Definitions

```
types/
└── index.ts  # 12 interfaces + WSMessage union type
```

## `index.ts`

| Export | Purpose |
|---|---|
| `interface Job` | Job listing from API |
| `interface Application` | Application record |
| `interface StatsSummary` | Aggregate statistics |
| `interface EmailTrackingStats` | Email tracking data |
| `interface TimelinePoint` | Timeline data point |
| `interface PlatformBreakdown` | Per-platform stats |
| `interface ResumeVariant` | Resume template |
| `interface ParsedResumeData` | Parsed resume sections |
| `interface ReviewPayload` | Review card from WebSocket |
| `interface AgentStatus` | Agent state (online/offline/jobs_today) |
| `interface ActivityEvent` | Activity feed entry |
| `interface ActivityLogEntry` | Log entry from API |
| `type PlatformName` | "indeed" \| "naukri" \| "internshala" |
| `interface CookieStatus` | Cookie validity per platform |
| `type WSMessage` | Union of 12 WebSocket message types |
