# NexApply — ResuMorph

Automated job application system that detects job postings in real-time, tailors resumes via AI, and submits applications within 1-2 minutes.

## How it Works

1. **Job Radar** — RSS feeds & polling watch LinkedIn, Indeed, Naukri, Internshala
2. **AI Engine** — Pre-tailored resume variants + Groq keyword injection
3. **Apply Fleet** — Playwright workers fill & submit per platform
4. **Review Dashboard** — Approve/reject before each submission

## Speed

Pre-tailor resumes nightly by category. At apply time: classify → pick variant → swap keywords in ~3s.
