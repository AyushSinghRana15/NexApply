from typing import List


def compute_score(
    category: str,
    keywords: List[str],
    base_resume_text: str,
    job_location: str,
    preferred_categories: List[str],
    preferred_locations: List[str],
) -> int:
    resume_lower = base_resume_text.lower()
    found = sum(1 for kw in keywords if kw.lower() in resume_lower)
    keyword_score = (found / 5) * 60

    category_match = 1 if category in preferred_categories else 0
    category_score = category_match * 25

    loc_lower = job_location.lower()
    location_match = 1 if any(loc.lower() in loc_lower or loc_lower in loc.lower() for loc in preferred_locations) else 0
    location_score = location_match * 15

    return int(keyword_score + category_score + location_score)
