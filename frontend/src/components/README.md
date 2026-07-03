# `components/` — Reusable React Components

```
components/
├── WebSocketInit.tsx    # Auto-connects WebSocket on mount (returns null)
├── common/              # Shared UI primitives
├── layout/              # Page shell components
└── ui/                  # Themed UI building blocks
```

---

## `WebSocketInit.tsx`

Side-effect-only component that connects the WebSocket on mount and disconnects on unmount. Renders nothing (`null`).

| Export | Purpose |
|---|---|
| `WebSocketInit()` | Calls `useWSStore.connect()` / `.disconnect()` |
