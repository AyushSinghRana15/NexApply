CATEGORY_RULES = {
    "engineering": [
        "software engineer", "backend", "frontend", "sde", "developer",
        "python", "java", "golang", "node", "react", "fullstack",
    ],
    "data": [
        "data scientist", "machine learning", "ml engineer", "data analyst",
        "pytorch", "tensorflow", "nlp", "deep learning", "llm",
    ],
    "product": [
        "product manager", "pm", "roadmap", "stakeholder", "go-to-market",
        "product strategy", "agile", "scrum master",
    ],
    "devops": [
        "devops", "cloud", "aws", "kubernetes", "docker", "ci/cd",
        "infrastructure", "sre", "platform engineer",
    ],
    "design": [
        "ui/ux", "designer", "figma", "user research", "product design",
    ],
    "ml": [
        "machine learning", "ml engineer", "deep learning", "nlp",
        "computer vision", "rag", "llm", "tensorflow", "pytorch",
        "data scientist", "artificial intelligence",
    ],
}


def classify_job(title: str, description: str) -> str:
    text = f"{title} {description}".lower()
    scores = {}
    for category, keywords in CATEGORY_RULES.items():
        score = sum(1 for kw in keywords if kw in text)
        if score > 0:
            scores[category] = score
    if not scores:
        return "engineering"
    return max(scores, key=scores.get)
