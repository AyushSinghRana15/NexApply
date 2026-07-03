# `frontend/src/` — React Frontend Source

React 18 + TypeScript + Vite single-page application. Serves as the NexApply dashboard for reviewing applications, managing settings, viewing analytics, and more.

```
src/
├── main.tsx               # React entry — StrictMode → App
├── App.tsx                # BrowserRouter + QueryClient + Routes (7 pages)
├── index.css              # Tailwind + Rubik's Cube theme
├── vite-env.d.ts          # Vite type declarations
├── api/
│   └── client.ts          # Axios client with 25 exported API functions
├── hooks/
│   ├── useQueries.ts      # 8 TanStack Query hooks
│   └── useWebSocket.ts    # Basic WebSocket hook
├── stores/
│   ├── useAppStore.ts     # Zustand — sidebar toggle state
│   └── useWSStore.ts      # Zustand — WebSocket, reviews, agents, activity
├── types/
│   └── index.ts           # 12 interfaces + WSMessage union type
├── lib/
│   └── utils.ts           # 6 utility functions
├── components/
│   ├── WebSocketInit.tsx   # Auto-connect WebSocket on mount
│   ├── common/             # EmptyState, ErrorBoundary, LoadingSkeleton, Toast
│   ├── layout/             # Layout, Sidebar, TopBar
│   └── ui/                 # Badge, Button, ScoreBar, StatCard, Table
└── pages/
    ├── Dashboard.tsx       # Home — agent status, stats, activity feed
    ├── Review.tsx          # Review queue with approve/skip/edit
    ├── Applications.tsx    # Application table with detail panel
    ├── Analytics.tsx       # Recharts charts
    ├── Resumes.tsx         # Resume variant manager
    ├── Settings.tsx        # Full app settings
    └── Apps.tsx            # Cookie management per platform
```

---

## Routes (defined in `App.tsx`)

| Path | Page | Purpose |
|---|---|---|
| `/` | Dashboard | Agent status cards, stats, activity feed, recent apps |
| `/review` | Review | Review queue with screenshot + approve/skip |
| `/applications` | Applications | Filterable/sortable table with detail panel |
| `/analytics` | Analytics | Timeline bar, platform pie, score distribution, decision speed |
| `/resumes` | Resumes | Grid of resume variants + upload/parse/edit/delete |
| `/settings` | Settings | Platform toggles, filters, agent timing, LLM config |
| `/apps` | Apps | Cookie capture/clear per platform |

---

## Key Libraries

| Library | Purpose |
|---|---|
| React 18 + TypeScript | UI framework |
| Vite | Build tool |
| React Router v6 | Client-side routing (7 pages) |
| TanStack Query v5 | Server state, caching, refetching |
| Zustand | Client state (sidebar, WebSocket) |
| Recharts | Charts for analytics page |
| Tailwind CSS | Styling |
| Lucide React | Icons |
| Axios | HTTP client |
| clsx + tailwind-merge | Class name utilities |
