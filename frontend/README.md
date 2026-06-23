# NexApply Frontend

Dashboard and review interface for the NexApply multi-agent job application system.

## Tech Stack

- **React 19** + **TypeScript 6**
- **Vite 8** with React plugin and SWC
- **Tailwind CSS v4** (via `@tailwindcss/vite`)
- **React Router v7** — client-side routing
- **TanStack React Query v5** — server state & caching
- **Zustand v5** — client state (WebSocket, app state)
- **Axios** — HTTP client for REST API
- **Recharts** — analytics charts
- **Lucide React** — icons
- **class-variance-authority** + **tailwind-merge** — UI primitives

## Pages

| Route          | Page          | Description                            |
|----------------|---------------|----------------------------------------|
| `/`            | Dashboard     | Stats summary, timeline, job feed      |
| `/review`      | Review        | Human-in-the-loop application review   |
| `/applications`| Applications  | Full list with filter & search         |
| `/analytics`   | Analytics     | Charts: platform breakdown, timeline   |
| `/resumes`     | Resumes       | Browse/manage resume variants          |
| `/settings`    | Settings      | View and update runtime config         |

## Architecture

```
src/
├── api/          — Axios client with typed endpoint functions
├── components/   — UI primitives, layout shell, WebSocket init
│   ├── charts/   — Recharts wrapper components
│   ├── layout/   — Sidebar + topbar layout
│   └── ui/       — Atomic UI components
├── hooks/        — Custom hooks (queries, WebSocket)
├── pages/        — Route-level page components
├── stores/       — Zustand stores (WebSocket, app state)
├── types/        — Shared TypeScript interfaces & WS message types
├── App.tsx       — Router + QueryClient setup
├── main.tsx      — Entry point
└── index.css     — Tailwind v4 entry with `@import "tailwindcss"`
```

## Key Features

- **Real-time updates** via WebSocket (review cards, job detection, submission status)
- **Human-in-the-loop review** — approve, edit, or skip applications before submission
- **5-minute review timeout** — auto-skips stalled reviews
- **Analytics** — daily application timeline, platform breakdowns, match score distribution

## Setup & Scripts

```bash
# Install dependencies
npm install

# Start dev server (proxies /api → localhost:8000)
npm run dev

# Type-check & production build
npm run build

# Preview production build
npm run preview

# Lint
npm run lint
```

The dev server proxies `/api`, `/ws`, and `/screenshots` to the backend at `localhost:8000`. See `vite.config.ts` for details.
