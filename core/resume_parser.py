import os
import re
from typing import Optional


def parse_resume(file_path: str) -> dict:
    ext = os.path.splitext(file_path)[1].lower()
    text = ""
    if ext == ".pdf":
        text = _extract_pdf_text(file_path)
    elif ext == ".txt":
        with open(file_path) as f:
            text = f.read()
    else:
        raise ValueError(f"Unsupported format: {ext}")

    return _parse_sections(text)


def _extract_pdf_text(path: str) -> str:
    from pypdf import PdfReader
    reader = PdfReader(path)
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    return text.strip() if text.strip() else _extract_fallback(path)


def _extract_fallback(path: str) -> str:
    try:
        import subprocess
        result = subprocess.run(
            ["pdftotext", "-layout", path, "-"],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip()
    except Exception:
        pass
    return ""


def _parse_sections(text: str) -> dict:
    result = {
        "personal": {},
        "summary": "",
        "skills": {"primary": [], "secondary": [], "tools": [], "frameworks": [], "databases": [], "cloud": [], "soft_skills": []},
        "experience": [],
        "education": {"highest": {}, "secondary": {}, "high_school": {}},
        "projects": [],
        "certifications": [],
        "raw_text": text,
    }

    sections = _split_into_sections(text)
    for name, content in sections.items():
        if any(k in name for k in ["contact", "personal", "profile"]):
            result["personal"] = _parse_personal(content)
        elif "summary" in name or "objective" in name or "about" in name:
            result["summary"] = content.strip()[:500]
        elif "skill" in name:
            parsed = _parse_skills(content)
            result["skills"].update(parsed)
        elif "experience" in name or "work" in name or "employment" in name or "history" in name:
            result["experience"] = _parse_experience(content)
        elif "education" in name or "academic" in name or "qualification" in name:
            result["education"] = _parse_education(content)
        elif "project" in name:
            result["projects"] = _parse_projects(content)
        elif "certification" in name or "certificate" in name or "license" in name:
            result["certifications"] = _parse_certifications(content)

    if not result["personal"]:
        result["personal"] = _parse_personal(text)

    return result


_SECTION_HEADERS = re.compile(
    r"(?im)^(#{1,3}\s+)?"
    r"(?P<name>"
    r"(?:education|education\s*details|academic\s*(?:background|qualification|details)|qualifications)"
    r"|(?:experience|work\s*(?:experience|history|background)|employment\s*(?:history|background)|professional\s*(?:experience|background|details))"
    r"|(?:skills?|technical\s*skills?|core\s*competencies|expertise|technologies)"
    r"|(?:projects?|key\s*projects?|personal\s*projects?|academic\s*projects?|open[- ]source)"
    r"|(?:certifications?|certificates?|licenses?|professional\s*certifications?)"
    r"|(?:summary|professional\s*summary|career\s*(?:summary|objective)|objective|profile|about\s*me)"
    r"|(?:contact|personal\s*(?:info|information|details)|personal)"
    r"|(?:achievements?|accomplishments|awards?|honors?)"
    r"|(?:publications?|research)"
    r"|(?:languages?)"
    r"|(?:interests?|hobbies|activities)"
    r"|(?:references?)"
    r")[:\s]*$",
    re.MULTILINE,
)


def _split_into_sections(text: str) -> dict:
    lines = text.split("\n")
    sections = {}
    current = "header"
    current_lines = []

    for line in lines:
        m = _SECTION_HEADERS.match(line)
        if m:
            if current_lines:
                sections[current] = "\n".join(current_lines).strip()
            current = m.group("name").strip().lower()
            current_lines = []
        else:
            current_lines.append(line)

    if current_lines:
        sections[current] = "\n".join(current_lines).strip()
    return sections


def _parse_personal(content: str) -> dict:
    info = {}
    email_re = re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", content)
    if email_re:
        info["email"] = email_re.group()

    phone_re = re.search(r"\+?\d[\d\s\-().]{7,15}\d", content)
    if phone_re:
        info["phone"] = phone_re.group().strip()

    linkedin_re = re.search(r"(?:linkedin\.com/in/|linkedin\.com/)[\w-]+", content, re.I)
    if linkedin_re:
        info["linkedin_url"] = "https://" + linkedin_re.group()

    github_re = re.search(r"github\.com/[\w-]+", content, re.I)
    if github_re:
        info["github_url"] = "https://" + github_re.group()

    lines = [l.strip() for l in content.split("\n") if l.strip()]
    if lines:
        name = _clean_name(lines[0])
        if not any(k in name.lower() for k in ["resume", "cv", "curriculum", "vitae", "@", "http", "phone", "email", "+"]):
            info["full_name"] = name

    location_re = re.search(
        r"\b((?:Delhi|Mumbai|Bangalore|Chennai|Kolkata|Hyderabad|Pune|Ahmedabad|Jaipur|Lucknow|Noida|Gurgaon|Remote|New\s*York|San\s*Francisco|London|Berlin|Tokyo|Singapore|Toronto|Seattle|Austin|Chicago)"
        r"(?:\s*,\s*(?:India|USA|UK|CA|IN|US|GB|Canada|United\s*States|United\s*Kingdom|Germany|Japan|Singapore))?)\b",
        content, re.I
    )
    if location_re:
        loc_text = location_re.group(1)
        parts = [p.strip() for p in loc_text.split(",")]
        info["location"] = {"city": parts[0] if len(parts) > 0 else "", "state": parts[1] if len(parts) > 1 else ""}

    return info


def _clean_name(raw: str) -> str:
    raw = raw.strip().strip("*#").strip()
    stop_words = {"resume", "curriculum", "vitae", "cv", "profile", "contact"}
    words = raw.split()
    filtered = [w for w in words if w.lower() not in stop_words]
    return " ".join(filtered)


def _parse_skills(content: str) -> dict:
    skills = {"primary": [], "secondary": [], "tools": [], "frameworks": [], "databases": [], "cloud": [], "soft_skills": []}
    text = content.lower()

    _all_text_words = set(re.findall(r"[a-zA-Z+#.]+", text))

    tech_keywords = [
        "python", "java", "javascript", "typescript", "go", "golang", "rust",
        "c++", "c#", "ruby", "php", "swift", "kotlin", "scala", "r", "sql",
        "html", "css", "react", "angular", "vue", "node", "node.js", "nodejs",
        "express", "django", "flask", "fastapi", "spring", "spring boot",
        "docker", "kubernetes", "k8s", "aws", "gcp", "azure", "terraform",
        "ansible", "jenkins", "git", "github", "gitlab", "ci/cd",
        "postgresql", "postgres", "mysql", "mongodb", "redis", "elasticsearch",
        "kafka", "rabbitmq", "graphql", "rest", "grpc", "websocket",
        "machine learning", "deep learning", "nlp", "computer vision",
        "tensorflow", "pytorch", "keras", "scikit-learn", "pandas", "numpy",
        "data science", "data analysis", "data engineering", "etl",
        "tableau", "power bi", "looker", "airflow", "spark", "hadoop",
        "linux", "bash", "powershell", "nginx", "apache", "vscode",
        "figma", "sketch", "adobe xd", "photoshop", "illustrator",
        "tailwind", "bootstrap", "sass", "less", "jquery", "ajax",
        "next.js", "nextjs", "nuxt", "svelte", "solidity",
        "selenium", "cypress", "jest", "mocha", "chai",
        "prometheus", "grafana", "datadog", "new relic",
        "circleci", "github actions", "gitlab ci",
        "rust", "elixir", "haskell", "clojure", "lua",
    ]

    found = []
    for kw in tech_keywords:
        escaped = re.escape(kw)
        if re.search(r"(?<![a-zA-Z])" + escaped + r"(?![a-zA-Z])", text):
            if kw not in found:
                found.append(kw)

    primary_indicators = ["proficient", "expert", "advanced", "strong", "primary", "languages", "frameworks"]
    lines = content.split("\n")
    for line in lines:
        ll = line.lower()
        colon_idx = ll.find(":")
        line_after_colon = ll[colon_idx + 1:] if colon_idx >= 0 else ll
        for kw in list(found):
            if kw in line_after_colon and kw not in skills["primary"] and kw not in skills["secondary"]:
                if any(ind in ll[:colon_idx] if colon_idx >= 0 else False for ind in primary_indicators):
                    skills["primary"].append(kw)
                elif colon_idx >= 0:
                    cat = ll[:colon_idx].strip()
                    if any(c in cat for c in ["tool", "database", "cloud", "framework", "library"]):
                        skills["secondary"].append(kw)
                    else:
                        skills["primary"].append(kw)
                else:
                    skills["primary"].append(kw)

    for kw in found:
        if kw not in skills["primary"] and kw not in skills["secondary"]:
            if len(skills["primary"]) < 8:
                skills["primary"].append(kw)
            else:
                skills["secondary"].append(kw)

    cloud_kws = {"aws", "gcp", "azure", "docker", "kubernetes", "k8s", "terraform"}
    db_kws = {"postgresql", "postgres", "mysql", "mongodb", "redis", "elasticsearch", "sqlite"}
    framework_kws = {"react", "angular", "vue", "django", "flask", "fastapi", "spring", "express", "spring boot", "tensorflow", "pytorch", "keras", "next.js", "nextjs"}
    tool_kws = {"git", "docker", "jenkins", "ansible", "terraform", "kubernetes", "airflow", "kafka", "selenium", "jest"}

    for kw in list(skills["primary"]) + list(skills["secondary"]):
        if kw in cloud_kws and kw not in skills["cloud"]:
            skills["cloud"].append(kw)
        if kw in db_kws and kw not in skills["databases"]:
            skills["databases"].append(kw)
        if kw in framework_kws and kw not in skills["frameworks"]:
            skills["frameworks"].append(kw)
        if kw in tool_kws and kw not in skills["tools"]:
            skills["tools"].append(kw)

    soft_skill_kws = ["communication", "teamwork", "leadership", "problem solving",
                      "time management", "critical thinking", "adaptability",
                      "creativity", "collaboration", "organization"]
    for kw in soft_skill_kws:
        if kw in text:
            skills["soft_skills"].append(kw.title())

    return skills


def _parse_experience(content: str) -> list:
    entries = []
    blocks = re.split(r"\n\s*\n", content.strip())
    for block in blocks:
        lines = [l.strip() for l in block.split("\n") if l.strip()]
        if not lines:
            continue
        entry = {"title": "", "company": "", "type": "Full-time", "start_date": "", "end_date": "", "description": "", "achievements": []}
        raw_title = lines[0]
        title_clean = re.sub(r"\s+\(.*?\)", "", raw_title)
        title_clean = re.sub(r"\s+at\s+.*", "", title_clean, flags=re.I)
        entry["title"] = title_clean.strip() or raw_title

        date_re = re.search(
            r"((?:\d{4}-\d{2}|\d{2}/\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s.,]*\d{4}))"
            r"\s*(?:-|–|to|–|—|present|current)\s*"
            r"((?:\d{4}-\d{2}|\d{2}/\d{4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s.,]*\d{4}|present|current))",
            block, re.I
        )
        if not date_re:
            date_re = re.search(
                r"(\d{4}/\d{2}|\d{4}-\d{2}|\d{4})\s*(?:-|–|to)\s*(\d{4}/\d{2}|\d{4}-\d{2}|\d{4}|present|current)",
                block, re.I
            )
        if date_re:
            entry["start_date"] = date_re.group(1)
            entry["end_date"] = date_re.group(2) if date_re.lastindex >= 2 else ""

        company_match = re.search(r"\b(at|@)\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\s*\(|\s*-\s*|\s*–\s*|\s*\|)", block, re.I)
        if not company_match:
            company_match = re.search(r"\b(at|@)\s+([A-Z][A-Za-z0-9\s&.]+?)(?:\s*[\d]|$)", block, re.I)
        if company_match:
            entry["company"] = company_match.group(2).strip()

        for line in lines[1:]:
            if line.startswith(("•", "-", "*", "→")):
                entry["achievements"].append(line.lstrip("•-*→ ").strip())
            elif not entry["company"] and not date_re:
                entry["company"] = line

        if entry["achievements"]:
            entry["description"] = "; ".join(entry["achievements"][:3])

        if entry["title"] or entry["company"]:
            entries.append(entry)

    return entries


def _parse_education(content: str) -> dict:
    result = {"highest": {}, "secondary": {}, "high_school": {}}

    degree_pattern = re.compile(
        r"(B\.?Tech|B\.?E|M\.?Tech|M\.?E|B\.?S\.?C?|M\.?S\.?C?|B\.?A|M\.?A|PhD|"
        r"Bachelor|Master|Doctorate|"
        r"12th|XII|10th|X|High School|Secondary|Senior Secondary|Intermediate)",
        re.I
    )

    blocks = re.split(r"\n\s*\n", content.strip())
    degree_entries = []

    for block in blocks:
        m = degree_pattern.search(block)
        if m:
            degree_text = m.group(1)
            lines = block.split("\n")
            entry = {"degree": "", "field": "", "college": "", "university": "", "grade": "", "start_year": "", "end_year": ""}

            entry["degree"] = degree_text

            in_field = re.search(
                r"(?:B\.?Tech|B\.?E|M\.?Tech|M\.?E|B\.?S|M\.?S|Bachelor|Master)"
                r"(?:\s+in\s+|\s*\(|\s*–\s*)([A-Za-z\s&]+?)(?:\s*[–—]|\s*\(|\s*$|\s*\d)",
                block, re.I
            )
            if in_field:
                entry["field"] = in_field.group(1).strip()

            college_match = re.search(r"(?:[–—]|at)\s*([A-Z][A-Za-z\s&.]+?(?:University|College|Institute|School|Academy))", block, re.I)
            if college_match:
                college_name = college_match.group(1).strip()
                if "university" in college_name.lower():
                    entry["university"] = college_name
                else:
                    entry["college"] = college_name

            grade_re = re.search(r"(?:CGPA|GPA|Percentage|Grade|%)\s*[:\-]?\s*([\d.]+)", block, re.I)
            if grade_re:
                entry["grade"] = grade_re.group(1)

            year_re = re.search(r"(\d{4})\s*(?:-|–|to)\s*(\d{4}|present)", block)
            if year_re:
                entry["start_year"] = year_re.group(1)
                if year_re.group(2) != "present":
                    entry["end_year"] = year_re.group(2)

            if not entry["end_year"]:
                year_single = re.search(r"(?:20\d{2})", block)
                if year_single:
                    entry["end_year"] = year_single.group()

            if not entry["college"] and not entry["university"]:
                for line in lines[1:]:
                    line = line.strip()
                    if line and not any(c in line for c in "0123456789"):
                        if not any(k in line.lower() for k in ["cgpa", "gpa", "grade", "percentage", "year"]):
                            entry["college"] = line
                            break

            degree_entries.append(entry)

    if degree_entries:
        deg_order = ["PhD", "Master", "M.Tech", "M.E", "M.S", "M.Sc", "M.A",
                     "Bachelor", "B.Tech", "B.E", "B.S", "B.Sc", "B.A",
                     "12th", "XII", "Senior Secondary", "Intermediate",
                     "10th", "X", "High School", "Secondary"]

        def sort_key(e):
            d = e.get("degree", "")
            for i, order in enumerate(deg_order):
                if d.lower().startswith(order.lower()) or order.lower().startswith(d.lower()):
                    return i
            return 999

        degree_entries.sort(key=sort_key)
        result["highest"] = degree_entries[0]

        for e in degree_entries[1:]:
            d = e.get("degree", "").lower()
            if any(k in d for k in ["xii", "12th", "senior secondary", "intermediate"]):
                result["secondary"] = e
            elif any(k in d for k in ["x", "10th", "high school", "secondary"]):
                result["high_school"] = e

    return result


def _parse_projects(content: str) -> list:
    projects = []
    blocks = re.split(r"\n\s*\n", content.strip())
    for block in blocks:
        lines = [l.strip() for l in block.split("\n") if l.strip()]
        if not lines:
            continue
        entry = {"name": lines[0], "description": "", "tech_stack": [], "url": "", "duration": ""}

        desc_lines = []
        for line in lines[1:]:
            if line.startswith(("•", "-", "*", "→")):
                desc_lines.append(line.lstrip("•-*→ ").strip())
            elif any(k in line.lower() for k in ["http", "github", "link"]):
                entry["url"] = line.strip()
            elif any(k in line.lower() for k in ["tech", "stack", "tool", "used"]):
                tech_part = re.sub(r"(?i)(tech\s*(?:stack|used|:)|tools?\s*:?\s*)", "", line).strip()
                entry["tech_stack"] = [t.strip() for t in re.split(r"[,|]", tech_part) if t.strip()]
            else:
                desc_lines.append(line)

        if desc_lines:
            entry["description"] = " ".join(desc_lines)[:300]

        if entry["name"] and len(entry["name"]) > 2:
            projects.append(entry)

    return projects


def _parse_certifications(content: str) -> list:
    certs = []
    lines = [l.strip() for l in content.split("\n") if l.strip()]
    for line in lines:
        clean = line
        if line.startswith(("•", "-", "*", "→")):
            clean = line.lstrip("•-*→ ").strip()
        if not clean or len(clean) < 5:
            continue
        issuer_re = re.search(r"^(.+?)\s*[–—]\s*(.+?)$", clean)
        if issuer_re:
            certs.append({"name": issuer_re.group(1).strip(), "issuer": issuer_re.group(2).strip(), "issue_date": ""})
        else:
            cert_re = re.search(r"(?:certified|certification|certificate)\s*(?:in|:)?\s*(.+?)(?:,|\s*[–—]|$)", clean, re.I)
            if cert_re:
                certs.append({"name": cert_re.group(1).strip(), "issuer": "", "issue_date": ""})
            else:
                certs.append({"name": clean, "issuer": "", "issue_date": ""})
    return certs


def merge_into_profile(parsed: dict, profile: dict) -> dict:
    profile = profile.copy()

    personal = parsed.get("personal", {})
    if personal.get("full_name"):
        profile.setdefault("personal", {}).setdefault("full_name", personal["full_name"])
    if personal.get("email"):
        profile.setdefault("personal", {}).setdefault("email", personal["email"])
    if personal.get("phone"):
        profile.setdefault("personal", {}).setdefault("phone", personal["phone"])
    if personal.get("linkedin_url"):
        profile.setdefault("personal", {}).setdefault("linkedin_url", personal["linkedin_url"])
    if personal.get("github_url"):
        profile.setdefault("personal", {}).setdefault("github_url", personal["github_url"])
    if personal.get("location"):
        profile.setdefault("personal", {}).setdefault("location", personal["location"])

    skills = parsed.get("skills", {})
    if skills.get("primary"):
        profile.setdefault("skills", {}).setdefault("primary", skills["primary"])
    if skills.get("secondary"):
        profile.setdefault("skills", {}).setdefault("secondary", skills["secondary"])
    if skills.get("tools"):
        profile.setdefault("skills", {}).setdefault("tools", skills["tools"])
    if skills.get("frameworks"):
        profile.setdefault("skills", {}).setdefault("frameworks", skills["frameworks"])
    if skills.get("databases"):
        profile.setdefault("skills", {}).setdefault("databases", skills["databases"])
    if skills.get("cloud"):
        profile.setdefault("skills", {}).setdefault("cloud", skills["cloud"])

    parsed_exp = parsed.get("experience", [])
    if parsed_exp:
        mapped = []
        for e in parsed_exp:
            mapped.append({
                "title": e.get("title", ""),
                "company": e.get("company", ""),
                "type": e.get("type", "Full-time"),
                "start_date": e.get("start_date", ""),
                "end_date": e.get("end_date", ""),
                "currently_working": "present" in e.get("end_date", "").lower(),
                "description": e.get("description", ""),
                "achievements": e.get("achievements", []),
            })
        profile.setdefault("experience", mapped)

    parsed_edu = parsed.get("education", {}).get("highest", {})
    if parsed_edu.get("degree"):
        profile.setdefault("education", {}).setdefault("highest", {})
        for k in ["degree", "field", "college", "university", "grade", "start_year", "end_year"]:
            if parsed_edu.get(k):
                profile["education"]["highest"][k] = parsed_edu[k]

    parsed_proj = parsed.get("projects", [])
    if parsed_proj:
        mapped = []
        for p in parsed_proj:
            mapped.append({
                "name": p.get("name", ""),
                "description": p.get("description", ""),
                "tech_stack": p.get("tech_stack", []),
                "url": p.get("url", ""),
            })
        profile.setdefault("projects", mapped)

    parsed_certs = parsed.get("certifications", [])
    if parsed_certs:
        profile.setdefault("certifications", parsed_certs)

    return profile


def build_resume_text(parsed: dict, category: str = "engineering", keywords: list[str] | None = None) -> str:
    keywords = keywords or []
    kw_str = ", ".join(keywords) if keywords else ""

    personal = parsed.get("personal", {})
    skills_data = parsed.get("skills", {})
    experience = parsed.get("experience", [])
    education = parsed.get("education", {})
    projects = parsed.get("projects", [])
    certs = parsed.get("certifications", [])
    summary = parsed.get("summary", "")

    name = personal.get("full_name", "Your Name")
    email = personal.get("email", "")
    phone = personal.get("phone", "")
    location = ""
    loc = personal.get("location", {})
    if isinstance(loc, dict):
        parts = [loc.get("city", ""), loc.get("state", "")]
        location = ", ".join(p for p in parts if p)

    lines = []
    lines.append(f"{name}")
    lines.append(f"{email} | {phone}" if email and phone else email or phone)
    if location:
        lines.append(location)
    if personal.get("linkedin_url"):
        lines.append(personal["linkedin_url"])
    if personal.get("github_url"):
        lines.append(personal["github_url"])
    lines.append("")

    if summary:
        lines.append("PROFESSIONAL SUMMARY")
        lines.append(summary)
        lines.append("")

    all_skills = []
    for sk_list in [skills_data.get("primary", []), skills_data.get("secondary", [])]:
        all_skills.extend(sk_list)
    if kw_str:
        for kw in keywords:
            if kw not in all_skills:
                all_skills.append(kw)

    if all_skills:
        lines.append("TECHNICAL SKILLS")
        lines.append(", ".join(all_skills[:12]))
        lines.append("")
        lines.append("Key competencies: {{KEYWORDS}}")
        lines.append("")

    if experience:
        lines.append("EXPERIENCE")
        for exp in experience[:3]:
            title = exp.get("title", "")
            company = exp.get("company", "")
            dates = ""
            if exp.get("start_date") or exp.get("end_date"):
                dates = f" ({exp['start_date']} – {exp['end_date']})"
            header = f"{title} at {company}{dates}" if company else f"{title}{dates}"
            lines.append(header)
            if exp.get("description"):
                lines.append(f"  {exp['description']}")
            for ach in exp.get("achievements", [])[:3]:
                lines.append(f"  • {ach}")
            lines.append("")

    edu = education.get("highest", {})
    if edu.get("degree"):
        lines.append("EDUCATION")
        parts = [edu.get("degree", "")]
        if edu.get("field"):
            parts.append(edu["field"])
        degree_line = " in ".join(parts)
        if edu.get("college"):
            degree_line += f" — {edu['college']}"
        lines.append(degree_line)
        if edu.get("grade"):
            lines.append(f"Grade: {edu['grade']}")
        if edu.get("end_year"):
            lines.append(f"Graduated: {edu['end_year']}")
        lines.append("")

    if projects:
        lines.append("PROJECTS")
        for proj in projects[:3]:
            name = proj.get("name", "")
            tech = ", ".join(proj.get("tech_stack", []))
            desc = proj.get("description", "")
            lines.append(f"{name}" + (f" | {tech}" if tech else ""))
            if desc:
                lines.append(f"  {desc}")
            lines.append("")

    if certs:
        lines.append("CERTIFICATIONS")
        for c in certs[:3]:
            name = c.get("name", "")
            issuer = c.get("issuer", "")
            lines.append(f"  • {name}" + (f" — {issuer}" if issuer else ""))
        lines.append("")

    return "\n".join(lines)
