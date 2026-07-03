# `lib/` — Utility Functions

```
lib/
└── utils.ts  # 6 helper functions
```

## `utils.ts`

| Function | Purpose |
|---|---|
| `cn(...inputs)` | className merge: clsx + tailwind-merge |
| `formatTimeAgo(iso)` | Relative time: "3m ago", "2h ago" |
| `formatDate(iso)` | Formatted date: "22 Jun, 10:52" |
| `matchScoreColor(score)` | CSS class: green/orange/red text |
| `matchScoreBarColor(score)` | CSS class: bg-green/orange/red bar |
| `platformIcon(platform)` | Icon name string per platform |
