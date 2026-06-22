import os
import re
import asyncio
from typing import List, Tuple

from dotenv import load_dotenv

load_dotenv()

GROQ_AVAILABLE = False
try:
    from groq import AsyncGroq
    GROQ_AVAILABLE = True
except ImportError:
    pass

PROMPT_PATH = "prompts/keyword_extraction.txt"


def _load_prompt(description: str) -> Tuple[str, str]:
    with open(PROMPT_PATH) as f:
        content = f.read()
    parts = content.strip().split("\n\n", 1)
    system_raw = parts[0].replace("System: ", "", 1)
    user_raw = parts[1].replace("User: ", "", 1) if len(parts) > 1 else ""
    user_prompt = user_raw.format(description=description[:600])
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


async def _call_groq(system: str, user: str, config: dict) -> str:
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
            max_tokens=50,
        ),
        timeout=timeout,
    )
    return response.choices[0].message.content.strip()


async def _call_ollama(system: str, user: str, config: dict) -> str:
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
        "options": {"temperature": 0.1, "num_predict": 50},
    }
    async with aiohttp.ClientSession() as session:
        async with session.post(url, json=payload, timeout=aiohttp.ClientTimeout(total=10)) as resp:
            if resp.status != 200:
                raise RuntimeError(f"Ollama returned {resp.status}")
            data = await resp.json()
            return data.get("message", {}).get("content", "").strip()


async def extract_keypoints(description: str, title: str, config: dict) -> Tuple[List[str], str]:
    system, user = _load_prompt(description)

    # Try Groq
    if GROQ_AVAILABLE and os.environ.get("GROQ_API_KEY"):
        try:
            raw = await _call_groq(system, user, config)
            keywords = _parse_keywords(raw)
            if keywords:
                return keywords, f"groq/{config.get('tailor', {}).get('groq_model', 'llama-3.3-70b-versatile')}"
        except Exception:
            pass

    # Fallback to Ollama
    try:
        raw = await _call_ollama(system, user, config)
        keywords = _parse_keywords(raw)
        if keywords:
            return keywords, f"ollama/{config.get('tailor', {}).get('ollama_model', 'mistral')}"
    except Exception:
        pass

    # Final fallback: keywords from title
    return _fallback_from_title(title), "fallback/title-words"
