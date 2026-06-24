import os
import re
import asyncio
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv

load_dotenv()

GROQ_AVAILABLE = False
try:
    from groq import AsyncGroq
    GROQ_AVAILABLE = True
except ImportError:
    pass

KEYWORD_PROMPT_PATH = "prompts/keyword_extraction.txt"
COVER_LETTER_PROMPT_PATH = "prompts/cover_letter.txt"
SCREENING_PROMPT_PATH = "prompts/screening.txt"


def _load_prompt(path: str, description: str = "") -> Tuple[str, str]:
    with open(path) as f:
        content = f.read()
    parts = content.strip().split("\n\n", 1)
    system_raw = parts[0].replace("System: ", "", 1)
    user_raw = parts[1].replace("User: ", "", 1) if len(parts) > 1 else ""
    user_prompt = user_raw.format(description=description[:600]) if description else user_raw
    return system_raw, user_prompt


def _load_cover_letter_prompt(kwargs: dict) -> Tuple[str, str]:
    with open(COVER_LETTER_PROMPT_PATH) as f:
        content = f.read()
    parts = content.strip().split("\n\n", 1)
    system_raw = parts[0].replace("System: ", "", 1)
    user_raw = parts[1].replace("User: ", "", 1) if len(parts) > 1 else ""
    user_prompt = user_raw.format(**kwargs)
    return system_raw, user_prompt


def _load_screening_prompt(kwargs: dict) -> Tuple[str, str]:
    with open(SCREENING_PROMPT_PATH) as f:
        content = f.read()
    parts = content.strip().split("\n\n", 1)
    system_raw = parts[0].replace("System: ", "", 1)
    user_raw = parts[1].replace("User: ", "", 1) if len(parts) > 1 else ""
    user_prompt = user_raw.format(**kwargs)
    return system_raw, user_prompt


def _parse_keywords(raw: str) -> List[str]:
    keywords = [k.strip() for k in raw.split(",") if k.strip()]
    return keywords[:5]


def _fallback_from_title(title: str) -> List[str]:
    stop_words = {"for", "the", "and", "with", "in", "at", "to", "a", "an",
                  "of", "is", "engineer", "developer", "intern", "trainee",
                  "opening", "job", "hiring", "required"}
    words = re.findall(r'\w+', title.lower())
    seen = []
    for w in words:
        if w not in stop_words and w not in seen:
            seen.append(w)
        if len(seen) >= 5:
            break
    return seen if seen else ["python"]


async def _call_groq(system: str, user: str, config: dict, max_tokens: int = 50) -> str:
    if not GROQ_AVAILABLE:
        raise RuntimeError("groq SDK not installed")
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not set")
    client = AsyncGroq(api_key=api_key)
    model = config.get("tailor", {}).get("groq_model", "llama-3.3-70b-versatile")
    timeout = config.get("tailor", {}).get("groq_timeout_seconds", 8)
    response = await asyncio.wait_for(
        client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.1,
            max_tokens=max_tokens,
        ),
        timeout=timeout,
    )
    return response.choices[0].message.content.strip()


async def _call_ollama(system: str, user: str, config: dict, max_tokens: int = 50) -> str:
    import aiohttp
    host = config.get("tailor", {}).get("ollama_host", "http://localhost:11434")
    model = config.get("tailor", {}).get("ollama_model", "mistral")
    url = f"{host}/api/chat"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "stream": False,
        "options": {"temperature": 0.1, "num_predict": max_tokens},
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status != 200:
                raise RuntimeError(f"Ollama returned {resp.status}")
            data = await resp.json()
            return data.get("message", {}).get("content", "").strip()


async def _call_llm(system: str, user: str, config: dict, max_tokens: int = 50) -> Tuple[str, str]:
    if GROQ_AVAILABLE and os.environ.get("GROQ_API_KEY"):
        try:
            raw = await _call_groq(system, user, config, max_tokens)
            if raw:
                return raw, f"groq/{config.get('tailor', {}).get('groq_model', 'llama-3.3-70b-versatile')}"
        except Exception:
            pass
    try:
        raw = await _call_ollama(system, user, config, max_tokens)
        if raw:
            return raw, f"ollama/{config.get('tailor', {}).get('ollama_model', 'mistral')}"
    except Exception:
        pass
    return "", "fallback/none"


async def extract_keypoints(description: str, title: str, config: dict) -> Tuple[List[str], str]:
    system, user = _load_prompt(KEYWORD_PROMPT_PATH, description)

    if GROQ_AVAILABLE and os.environ.get("GROQ_API_KEY"):
        try:
            raw = await _call_groq(system, user, config)
            keywords = _parse_keywords(raw)
            if keywords:
                return keywords, f"groq/{config.get('tailor', {}).get('groq_model', 'llama-3.3-70b-versatile')}"
        except Exception:
            pass

    try:
        raw = await _call_ollama(system, user, config)
        keywords = _parse_keywords(raw)
        if keywords:
            return keywords, f"ollama/{config.get('tailor', {}).get('ollama_model', 'mistral')}"
    except Exception:
        pass

    return _fallback_from_title(title), "fallback/title-words"


async def generate_cover_letter(
    profile: dict,
    title: str,
    company: str,
    keywords: List[str],
    config: dict,
    max_words: int = 150,
) -> Tuple[str, str]:
    top_skills = ", ".join(profile.get("skills", {}).get("primary", [])[:5])
    education = profile.get("education", {}).get("highest", {})
    personal = profile.get("personal", {})
    professional = profile.get("professional", {})

    kwargs = {
        "full_name": personal.get("full_name", ""),
        "years_of_experience": professional.get("years_of_experience", "0"),
        "current_title": professional.get("current_title", ""),
        "top_skills": top_skills,
        "degree": education.get("degree", ""),
        "college": education.get("college", ""),
        "title": title,
        "company": company,
        "keywords": ", ".join(keywords),
    }

    system, user = _load_cover_letter_prompt(kwargs)
    text, llm_used = await _call_llm(system, user, config, max_tokens=300)

    if not text:
        text = (
            f"I am excited to apply for the {title} role at {company}. "
            f"My experience with {', '.join(keywords)} makes me a strong fit. "
            f"I look forward to contributing to your team."
        )
        llm_used = "fallback/template"

    words = text.split()
    if len(words) > max_words:
        text = " ".join(words[:max_words])

    return text, llm_used


async def answer_screening_question(
    profile: dict,
    question: str,
    config: dict,
) -> Tuple[str, str]:
    screening_answers = profile.get("screening_answers", {})
    if question in screening_answers:
        return screening_answers[question], "profile/static"

    personal = profile.get("personal", {})
    professional = profile.get("professional", {})
    education = profile.get("education", {}).get("highest", {})
    skills = profile.get("skills", {})

    kwargs = {
        "full_name": personal.get("full_name", ""),
        "years_of_experience": professional.get("years_of_experience", "0"),
        "current_title": professional.get("current_title", ""),
        "primary_skills": ", ".join(skills.get("primary", [])[:5]),
        "degree": education.get("degree", ""),
        "field": education.get("field", ""),
        "college": education.get("college", ""),
        "question": question,
    }

    system, user = _load_screening_prompt(kwargs)
    text, llm_used = await _call_llm(system, user, config, max_tokens=100)

    if not text:
        text = "Yes"
        llm_used = "fallback/default"

    return text, llm_used
