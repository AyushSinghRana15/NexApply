# `components/ui/` — Themed UI Building Blocks

```
ui/
├── index.ts       # Re-exports: StatCard, Badge, Button, Table, ScoreBar
├── Badge.tsx      # Status badge: default/success/warning/danger/pending
├── Button.tsx     # Styled button: primary/secondary/ghost/danger, sm/md/lg
├── ScoreBar.tsx   # Animated horizontal score bar with color thresholds
├── StatCard.tsx   # Stat display: label, value, icon, color variant
└── Table.tsx      # Generic typed table with render props + empty state
```

---

## `Badge.tsx`

| Export | Variants | Purpose |
|---|---|---|
| `Badge` | default / success / warning / danger / pending | Inline status indicator |

## `Button.tsx`

| Export | Variants | Sizes | Purpose |
|---|---|---|---|
| `Button` | primary / secondary / ghost / danger | sm / md / lg | Clickable action button |

## `ScoreBar.tsx`

| Export | Props | Purpose |
|---|---|---|
| `ScoreBar` | score (0–100), size? | Animated horizontal bar → green (≥75), yellow (51–74), red (≤50) |

## `StatCard.tsx`

| Export | Props | Purpose |
|---|---|---|
| `StatCard` | label, value, icon, variant?, className? | Metric display card |

## `Table.tsx`

| Export | Generic | Purpose |
|---|---|---|
| `Table<T>` | columns, data, onRowClick? | Type-safe table with render props for each column |
