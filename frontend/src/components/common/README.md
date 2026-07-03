# `components/common/` — Shared UI Primitives

```
common/
├── index.ts              # Re-exports: LoadingSkeleton, CardSkeleton, TableSkeleton, EmptyState, ErrorBoundary, toast
├── EmptyState.tsx        # Empty state display with icon, title, description, action
├── ErrorBoundary.tsx     # React class error boundary with retry button
├── LoadingSkeleton.tsx   # 3 skeleton loading variants
└── Toast.tsx             # Toast notification system via Zustand
```

---

## `EmptyState.tsx`

| Export | Props | Purpose |
|---|---|---|
| `EmptyState` | icon, title, description?, action? | Shown when a list/data view has no content |

## `ErrorBoundary.tsx`

| Export | Props | Purpose |
|---|---|---|
| `ErrorBoundary` | children | Catches render errors, shows retry button |

## `LoadingSkeleton.tsx`

| Export | Props | Purpose |
|---|---|---|
| `LoadingSkeleton` | className?, lines? | Generic skeleton lines |
| `CardSkeleton` | — | Card-shaped skeleton |
| `TableSkeleton` | rows? | Table row skeleton |

## `Toast.tsx`

| Export | Purpose |
|---|---|
| `useToast` store | Zustand store: toasts[], add(), remove() |
| `ToastContainer` | Fixed bottom-right toast list |
| `toast` | Convenience alias for adding toasts |
