from typing import List
import re

def _word_in_text(word: str, text: str) -> bool:
    word_lower = word.lower().strip(".,;:!?\"'()[]{}")
    if not word_lower:
        return False
    if word_lower in text:
        return True
    pattern = r'(?<![a-zA-Z])' + re.escape(word_lower) + r'(?![a-zA-Z])'
    return bool(re.search(pattern, text))


def _keyword_match_score(keyword: str, resume_text: str) -> float:
    resume_lower = resume_text.lower()
    kw_lower = keyword.lower().strip(".,;:!?\"'()[]{}")
    if not kw_lower:
        return 0.0
    if kw_lower in resume_lower:
        pattern = r'(?<![a-zA-Z])' + re.escape(kw_lower) + r'(?![a-zA-Z])'
        if re.search(pattern, resume_lower):
            return 1.0
        return 0.8
    parts = kw_lower.split()
    if len(parts) > 1:
        matched = sum(1 for p in parts if p in resume_lower)
        if matched >= len(parts) * 0.6:
            return 0.6 * (matched / len(parts))
    return 0.0


def compute_score(
    category: str,
    keywords: List[str],
    base_resume_text: str,
    job_location: str,
    preferred_categories: List[str],
    preferred_locations: List[str],
) -> int:
    if not keywords:
        keyword_score = 0
    else:
        raw = sum(_keyword_match_score(kw, base_resume_text) for kw in keywords)
        max_possible = min(len(keywords), 10)
        keyword_score = (raw / max_possible) * 60

    category_match = 1 if category in preferred_categories else 0
    category_score = category_match * 25

    loc_lower = job_location.lower()
    location_match = 1 if any(loc.lower() in loc_lower or loc_lower in loc.lower() for loc in preferred_locations) else 0
    location_score = location_match * 15

    return int(keyword_score + category_score + location_score)
