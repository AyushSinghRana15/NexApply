# `components/layout/` — Page Shell Components

```
layout/
├── Layout.tsx     # Main layout shell: Sidebar + TopBar + Outlet
├── Sidebar.tsx    # 7 NavLinks with Rubik's Cube styling, mobile toggle
└── TopBar.tsx     # Header with mobile menu, WS indicator, version badge
```

---

## `Layout.tsx`

| Export | Purpose |
|---|---|
| `Layout()` | Renders Sidebar (left) + TopBar (top) + `<Outlet />` (page content) |

## `Sidebar.tsx`

| Export | Purpose |
|---|---|
| `Sidebar()` | NavLinks for all 7 routes, collapse toggle on mobile |

## `TopBar.tsx`

| Export | Purpose |
|---|---|
| `TopBar()` | Hamburger menu (mobile), WebSocket connection dot, "NexApply" + version badge |
