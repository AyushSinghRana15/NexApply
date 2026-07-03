# `stores/` — Zustand State Stores

```
stores/
├── useAppStore.ts   # UI state (sidebar)
└── useWSStore.ts    # WebSocket & real-time state
```

---

## `useAppStore.ts`

| State | Type | Purpose |
|---|---|---|
| `sidebarOpen` | boolean | Sidebar expanded/collapsed |
| `toggleSidebar()` | () => void | Toggle sidebar |

---

## `useWSStore.ts`

Central WebSocket state manager. Handles connection lifecycle, review queue, agent statuses, and activity feed.

| State | Type | Purpose |
|---|---|---|
| `ws` | WebSocket \| null | Active WebSocket connection |
| `isConnected` | boolean | Connection status |
| `reconnectAttempts` | number | Auto-reconnect counter |
| `pendingReviews` | ReviewPayload[] | Queue of pending reviews |
| `activeReviewIndex` | number | Currently displayed review |
| `agents` | Record<string, AgentStatus> | Status per agent |
| `activityFeed` | ActivityEvent[] | Recent activity log |
| `countdowns` | Record<string, number> | Countdown per review (seconds) |

| Action | Purpose |
|---|---|
| `connect()` | Open WebSocket + attach handlers |
| `disconnect()` | Close WebSocket |
| `addReview(r)` | Push to pendingReviews |
| `removeReview(jobId)` | Remove by jobId |
| `nextReview()` | Advance activeReviewIndex |
| `setAgentStatus(agent, status, ...)` | Update agent status |
| `addActivity(event)` | Push to activityFeed (max 50) |
| `updateCountdown(jobId, seconds)` | Set countdown value |
| `clearCountdown(jobId)` | Remove countdown entry |
