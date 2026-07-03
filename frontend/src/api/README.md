# `api/` — API Client

Single file with Axios client and 25 exported API functions.

```
api/
└── client.ts  # Axios instance + all API calls
```

## `client.ts`

| Function | Purpose |
|---|---|
| `fetchJobs(page, perPage)` | Paginated job list |
| `fetchApplications(params)` | Filtered, paginated applications |
| `fetchApplication(id)` | Single application detail |
| `submitDecision(id, action)` | Approve/skip decision |
| `fetchEmailHistory(id)` | Email tracking for an application |
| `fetchStatsSummary()` | Aggregate stats |
| `fetchStatsTimeline()` | Timeline data |
| `fetchStatsPlatforms()` | Per-platform breakdown |
| `fetchEmailTrackingStats()` | Email stats |
| `fetchResumes()` | List resume variants |
| `createResume(body)` | Create a resume variant |
| `uploadResume(file, name?, category?)` | Upload resume file |
| `parseResumeFile(file)` | Parse PDF resume |
| `profileFromResume(file)` | Generate profile from resume |
| `updateResume(id, body)` | Update a variant |
| `deleteResume(id)` | Delete a variant |
| `previewResume(body)` | Preview keyword injection |
| `fetchConfig()` | Get full config |
| `updateConfig(cfg)` | Partial config update |
| `fetchActivityLog()` | Activity log entries |
| `fetchHealth()` | System health |
| `clearApplications()` | Delete all applications |
| `fetchCookieStatus()` | Cookie status per platform |
| `captureCookies(platform)` | Trigger cookie capture |
| `clearCookies(platform)` | Clear saved cookies |
