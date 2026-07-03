# `prompts/` — Versioned LLM Prompts

All LLM prompts live here as `.txt` files. Agents read from this directory instead of using inline prompt strings in code. This ensures prompts are version-controlled, auditable, and editable without touching code.

```
prompts/
├── keyword_extraction.txt   # Extracts top 5 ATS keywords from a job description
├── cover_letter.txt         # Generates a 3-paragraph cover letter
└── screening.txt            # Answers screening questions
```

---

## `keyword_extraction.txt`

Used by `core/llm.py:LLM.extract_keywords()`. Instructs the model to extract the 5 most important ATS-friendly keywords from a job description for a given category.

**Model:** Groq `llama-3.3-70b-versatile` (fallback: Ollama Mistral)

**Max tokens:** 50 (fast, ~200ms)

---

## `cover_letter.txt`

Used by `core/llm.py:LLM.generate_cover_letter()`. Instructs the model to write a concise 3-paragraph cover letter incorporating specific keywords.

**Model:** Groq `llama-3.3-70b-versatile`

**Enabled via:** `config.yaml` → `tailor.generate_cover_letter: true`

---

## `screening.txt`

Used by `core/llm.py:LLM.answer_screening()`. Instructs the model to answer screening questions in 1–3 sentences, tailored to the job and your profile.

**Model:** Groq `llama-3.3-70b-versatile`

**Enabled via:** `config.yaml` → `tailor.answer_screening: true`
