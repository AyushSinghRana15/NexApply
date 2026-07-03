# `resumes/` — Pre-Built Resume Variants

Each file is a plain-text resume template for a specific job category, with `{{KEYWORDS}}` placeholders. TailorAgent selects the nearest variant, extracts JD-specific keywords via LLM, and injects them into the template.

```
resumes/
├── engineering_v1.txt   # SDE / Backend / Fullstack roles
├── data_v1.txt          # Data Science / Analytics roles
├── product_v1.txt       # Product Management roles
├── devops_v1.txt        # DevOps / SRE / Infrastructure roles
├── design_v1.txt        # UI / UX Design roles
└── ml_v1.txt            # ML Engineering / AI roles
```

---

## How It Works

1. **TailorAgent** classifies the job into a category (engineering, data, product, etc.)
2. It picks the corresponding `.txt` file as the base template
3. **LLM** extracts 5 key skills/technologies from the job description
4. Those keywords replace `{{KEYWORDS}}` in the template
5. The tailored result is saved to `logs/resumes/{job_id}_{company}.txt`

---

## Adding a New Category

1. Create `resumes/{category}_v1.txt` with `{{KEYWORDS}}` placeholder
2. Add keywords in `core/classifier.py` → `CATEGORY_KEYWORDS`
3. Register in `core/tailor.py` → `VARIANT_MAP`
4. Add to `config.yaml` → `profile.categories`

---

## Design Rationale

**Why pre-built templates instead of LLM-generated resumes?**

- **Speed**: Template injection takes <10ms vs 10–15s for full LLM generation
- **Safety**: LLMs hallucinate experience and skills. Templates ground the output in real content
- **Control**: You write exactly what goes into each variant — the LLM only adds keywords
