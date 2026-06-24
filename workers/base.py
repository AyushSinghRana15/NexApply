import asyncio
import json
import os
import random
import tempfile
from io import BytesIO
from typing import Any, Dict, List, Optional

import yaml
from playwright.async_api import async_playwright, Page, BrowserContext

from core.logger import Logger
from core.models import ApplicationPayload, TailoredResult

SCREENSHOTS_DIR = "logs/screenshots"
COOKIES_DIR = "cookies"


FIELD_MAPPING = {
    "full_name":        lambda p, g: p["personal"]["full_name"],
    "first_name":       lambda p, g: p["personal"]["first_name"],
    "last_name":        lambda p, g: p["personal"]["last_name"],
    "email":            lambda p, g: p["personal"]["email"],
    "phone":            lambda p, g: p["personal"]["phone"],
    "mobile":           lambda p, g: p["personal"]["phone"],
    "whatsapp":         lambda p, g: p["personal"]["whatsapp"],
    "dob":              lambda p, g: p["personal"]["date_of_birth"],
    "date_of_birth":    lambda p, g: p["personal"]["date_of_birth"],
    "gender":           lambda p, g: p["personal"]["gender"],
    "city":             lambda p, g: p["personal"]["location"]["city"],
    "state":            lambda p, g: p["personal"]["location"]["state"],
    "pincode":          lambda p, g: str(p["personal"]["location"]["pincode"]),
    "zip":              lambda p, g: str(p["personal"]["location"]["pincode"]),
    "postal":           lambda p, g: str(p["personal"]["location"]["pincode"]),
    "nationality":      lambda p, g: p["personal"]["nationality"],
    "languages":        lambda p, g: ", ".join(p["personal"]["languages"]),

    "current_ctc":      lambda p, g: p["professional"]["current_ctc"],
    "expected_ctc":     lambda p, g: p["professional"]["expected_ctc"],
    "ctc":              lambda p, g: p["professional"]["expected_ctc"],
    "stipend":          lambda p, g: p["professional"]["expected_stipend"],
    "expected_stipend": lambda p, g: p["professional"]["expected_stipend"],
    "notice_period":    lambda p, g: p["professional"]["notice_period"],
    "notice":           lambda p, g: p["professional"]["notice_period"],
    "experience":       lambda p, g: p["professional"]["years_of_experience"],
    "total_experience": lambda p, g: p["professional"]["years_of_experience"],
    "availability":     lambda p, g: p["professional"]["availability"],
    "duration":         lambda p, g: p["professional"]["internship_duration"],
    "work_preference":  lambda p, g: p["professional"]["work_preference"],
    "current_title":    lambda p, g: p["professional"]["current_title"],

    "college":          lambda p, g: p["education"]["highest"]["college"],
    "university":       lambda p, g: p["education"]["highest"]["university"],
    "degree":           lambda p, g: p["education"]["highest"]["degree"],
    "field_of_study":   lambda p, g: p["education"]["highest"]["field"],
    "major":            lambda p, g: p["education"]["highest"]["field"],
    "cgpa":             lambda p, g: p["education"]["highest"]["grade"],
    "grade":            lambda p, g: p["education"]["highest"]["grade"],
    "percentage":       lambda p, g: p["education"]["highest"]["grade"],
    "graduation_year":  lambda p, g: p["education"]["highest"]["end_year"],
    "passing_year":     lambda p, g: p["education"]["highest"]["end_year"],
    "tenth":            lambda p, g: p["education"]["high_school"]["percentage"],
    "tenth_year":       lambda p, g: p["education"]["high_school"]["year"],
    "twelfth":          lambda p, g: p["education"]["secondary"]["percentage"],
    "twelfth_year":     lambda p, g: p["education"]["secondary"]["year"],
    "high_school":      lambda p, g: p["education"]["high_school"]["percentage"],
    "intermediate":     lambda p, g: p["education"]["secondary"]["percentage"],
    "secondary":        lambda p, g: p["education"]["secondary"]["percentage"],

    "linkedin":         lambda p, g: p["personal"]["linkedin_url"],
    "linkedin_url":     lambda p, g: p["personal"]["linkedin_url"],
    "github":           lambda p, g: p["personal"]["github_url"],
    "github_url":       lambda p, g: p["personal"]["github_url"],
    "portfolio":        lambda p, g: p["personal"]["portfolio_url"],
    "portfolio_url":    lambda p, g: p["personal"]["portfolio_url"],
    "website":          lambda p, g: p["personal"]["personal_website"],
    "leetcode":         lambda p, g: p["social"]["leetcode"],
    "hackerrank":       lambda p, g: p["social"]["hackerrank"],
    "codeforces":       lambda p, g: p["social"]["codeforces"],
    "kaggle":           lambda p, g: p["social"]["kaggle"],

    "cover_letter":     lambda p, g: g.get("cover_letter", ""),
    "about":            lambda p, g: g.get("generated_summary", ""),
    "objective":        lambda p, g: g.get("generated_summary", ""),
    "summary":          lambda p, g: g.get("generated_summary", ""),
    "skills":           lambda p, g: ", ".join(p["skills"]["primary"]),
    "technical_skills": lambda p, g: ", ".join(p["skills"]["primary"]),
}


class DocumentHandler:

    def __init__(self, worker: "BaseWorker", profile: dict):
        self.worker = worker
        self.profile = profile
        self.log = Logger()

    async def attach_resume(self, page: Page, tailored_resume: str) -> bool:
        path = await self._write_tailored_pdf(tailored_resume)
        return await self._upload_to_field(page, path, ["resume", "cv", "résumé"])

    async def attach_certificate(self, page: Page, cert_name: str = "") -> bool:
        certs = self.profile.get("certifications", [])
        if not certs:
            return False
        target = None
        if cert_name:
            for c in certs:
                if cert_name.lower() in c["name"].lower():
                    target = c
                    break
        if not target:
            target = certs[0]
        path = target["file_path"]
        if not os.path.exists(path):
            self.log.warn(f"Certificate file not found: {path}")
            return False
        return await self._upload_to_field(page, path, ["certificate", "certification"])

    async def attach_internship_letter(self, page: Page) -> bool:
        letters = self.profile.get("internship_letters", [])
        if not letters:
            return False
        path = letters[-1]["file_path"]
        if not os.path.exists(path):
            self.log.warn(f"Internship letter not found: {path}")
            return False
        return await self._upload_to_field(page, path, ["internship", "experience letter"])

    async def attach_photo(self, page: Page) -> bool:
        path = self.profile.get("documents", {}).get("photo", "")
        if not path or not os.path.exists(path):
            self.log.warn(f"Photo not found: {path}")
            return False
        return await self._upload_to_field(page, path, ["photo", "picture", "image"])

    async def attach_marksheet(self, page: Page, level: str = "") -> bool:
        marksheets = self.profile.get("documents", {}).get("marksheets", {})
        path = ""
        if level == "tenth":
            path = marksheets.get("tenth", "")
        elif level == "twelfth":
            path = marksheets.get("twelfth", "")
        elif level == "graduation":
            path = marksheets.get("graduation", "")
        else:
            path = marksheets.get("graduation", "") or marksheets.get("twelfth", "") or marksheets.get("tenth", "")
        if not path or not os.path.exists(path):
            self.log.warn(f"Marksheet not found: {path}")
            return False
        return await self._upload_to_field(page, path, ["marksheet", "transcript", "degree", "marksheet"])

    async def smart_attach(self, page: Page, tailored_resume: str):
        upload_fields = await page.query_selector_all('input[type="file"]')
        if not upload_fields:
            return

        for field in upload_fields:
            try:
                label = await self._get_field_label(page, field)
                label_lower = label.lower()

                if any(k in label_lower for k in ["resume", "cv", "résumé"]):
                    path = await self._write_tailored_pdf(tailored_resume)
                    await field.set_input_files(path)
                    self.log.upload_document("Resume", path)
                elif any(k in label_lower for k in ["certificate", "certification"]):
                    await self.attach_certificate(page)
                elif any(k in label_lower for k in ["internship", "experience letter"]):
                    await self.attach_internship_letter(page)
                elif any(k in label_lower for k in ["photo", "picture", "image"]):
                    await self.attach_photo(page)
                elif any(k in label_lower for k in ["marksheet", "transcript", "degree mark"]):
                    await self.attach_marksheet(page)

                await asyncio.sleep(1)
            except Exception as e:
                self.log.warn(f"Smart attach error: {e}")

    async def _write_tailored_pdf(self, tailored_resume: str) -> str:
        try:
            from fpdf import FPDF
            pdf = FPDF()
            pdf.add_page()
            pdf.set_auto_page_break(auto=True, margin=15)
            pdf.set_font("Courier", size=10)
            for line in tailored_resume.split("\n"):
                try:
                    pdf.cell(0, 5, line.encode("latin-1", "replace").decode("latin-1"), new_x="LMARGIN", new_y="NEXT")
                except Exception:
                    continue
            fd, path = tempfile.mkstemp(suffix=".pdf")
            os.close(fd)
            pdf.output(path)
            return path
        except ImportError:
            fd, path = tempfile.mkstemp(suffix=".txt")
            with os.fdopen(fd, "w") as f:
                f.write(tailored_resume)
            return path

    async def _upload_to_field(self, page: Page, file_path: str, keywords: List[str]) -> bool:
        if not os.path.exists(file_path):
            return False
        upload_fields = await page.query_selector_all('input[type="file"]')
        for field in upload_fields:
            try:
                label = await self._get_field_label(page, field)
                if any(k in label.lower() for k in keywords):
                    await field.set_input_files(file_path)
                    await asyncio.sleep(1)
                    return True
            except Exception:
                continue
        if upload_fields:
            try:
                await upload_fields[0].set_input_files(file_path)
                await asyncio.sleep(1)
                return True
            except Exception:
                pass
        return False

    async def _get_field_label(self, page: Page, field) -> str:
        try:
            aria = await field.get_attribute("aria-label")
            if aria:
                return aria
        except Exception:
            pass
        try:
            name = await field.get_attribute("name")
            if name:
                return name
        except Exception:
            pass
        try:
            placeholder = await field.get_attribute("placeholder")
            if placeholder:
                return placeholder
        except Exception:
            pass
        try:
            field_id = await field.get_attribute("id")
            if field_id:
                label_el = await page.query_selector(f"label[for='{field_id}']")
                if label_el:
                    return await label_el.inner_text()
        except Exception:
            pass
        try:
            parent = await page.evaluate("""
                el => {
                    let p = el.parentElement;
                    if (!p) return '';
                    let label = p.querySelector('label');
                    return label ? label.innerText : '';
                }
            """, field)
            if parent:
                return parent
        except Exception:
            pass
        return ""


class BaseWorker:

    def __init__(self, config: dict):
        self.cfg = config
        self.log = Logger()
        self.profile = self._load_yaml("profile.yaml")
        self.selectors = self._load_yaml("selectors.yaml")
        self._playwright = None
        self.browser = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self._fleet_cfg = config.get("fleet", {})

    def _load_yaml(self, path: str) -> dict:
        with open(path) as f:
            return yaml.safe_load(f)

    def _platform_selectors(self, platform: str) -> dict:
        return self.selectors.get(platform, {})

    def _delay(self):
        lo = self._fleet_cfg.get("human_delay_min", 0.3)
        hi = self._fleet_cfg.get("human_delay_max", 0.8)
        return random.uniform(lo, hi)

    async def launch(self):
        headless = self._fleet_cfg.get("headless", True)
        self._playwright = await async_playwright().start()
        self.browser = await self._playwright.chromium.launch(headless=headless)
        self.context = await self.browser.new_context(
            viewport={"width": 1280, "height": 900},
        )
        self.page = await self.context.new_page()
        self.page.set_default_timeout(
            self._fleet_cfg.get("page_timeout_seconds", 30) * 1000
        )

    async def load_cookies(self, platform: str):
        path = os.path.join(COOKIES_DIR, f"{platform}_cookies.json")
        if not os.path.exists(path):
            raise FileNotFoundError(f"Cookies not found: {path}")
        with open(path) as f:
            cookies = json.load(f)
        await self.context.add_cookies(cookies)
        self.log.detail(f"🍪 {len(cookies)} cookies loaded for {platform}")

    async def smart_fill(self, field_name: str, value: Any, platform: str) -> bool:
        selectors = self._platform_selectors(platform).get(field_name, [])
        for selector in selectors:
            try:
                locator = self.page.locator(selector)
                count = await locator.count()
                if count > 0:
                    await locator.first.fill(str(value))
                    await asyncio.sleep(self._delay())
                    return True
            except Exception:
                continue
        self.log.warn(f"Field not found via selectors: {field_name}")
        return False

    async def smart_click(self, field_name: str, platform: str) -> bool:
        selectors = self._platform_selectors(platform).get(field_name, [])
        for selector in selectors:
            try:
                locator = self.page.locator(selector)
                count = await locator.count()
                if count > 0:
                    await locator.first.click()
                    await asyncio.sleep(self._delay())
                    return True
            except Exception:
                continue
        return False

    async def upload_resume(self, tailored_resume: str, platform: str) -> bool:
        selectors = self._platform_selectors(platform).get("resume_upload", [])
        fd, path = tempfile.mkstemp(suffix=".txt")
        try:
            with os.fdopen(fd, "w") as f:
                f.write(tailored_resume)
            for selector in selectors:
                try:
                    locator = self.page.locator(selector)
                    count = await locator.count()
                    if count > 0:
                        await locator.first.set_input_files(path)
                        await asyncio.sleep(2)
                        return True
                except Exception:
                    continue
            return False
        finally:
            try:
                os.unlink(path)
            except OSError:
                pass

    async def universal_fill(self, page: Page, generated: dict, filled_fields: set) -> dict:
        all_inputs = await page.query_selector_all(
            "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='file']):not([type='checkbox']):not([type='radio']), textarea, select"
        )

        form_data = {}
        for field in all_inputs:
            try:
                name = await field.get_attribute("name") or ""
                f_id = await field.get_attribute("id") or ""
                placeholder = await field.get_attribute("placeholder") or ""
                aria = await field.get_attribute("aria-label") or ""
                identifier = (name or f_id or placeholder or aria).lower().strip()

                if not identifier:
                    continue

                if identifier in filled_fields:
                    continue

                value = self._match_field(identifier, generated)
                if value is None or value == "":
                    continue

                tag = await field.evaluate("el => el.tagName.toLowerCase()")

                if tag == "select":
                    try:
                        await field.select_option(label=value)
                        form_data[identifier] = value
                        self.log.filling_field(identifier, value)
                        await asyncio.sleep(random.uniform(0.2, 0.5))
                    except Exception:
                        try:
                            await field.select_option(value=value)
                            form_data[identifier] = value
                            self.log.filling_field(identifier, value)
                            await asyncio.sleep(random.uniform(0.2, 0.5))
                        except Exception:
                            pass
                elif tag == "textarea":
                    await field.fill(value)
                    form_data[identifier] = value
                    self.log.filling_field(identifier, value)
                    await asyncio.sleep(random.uniform(0.3, 0.7))
                else:
                    field_type = await field.get_attribute("type") or "text"
                    if field_type == "file":
                        continue
                    await field.fill(value)
                    form_data[identifier] = value
                    self.log.filling_field(identifier, value)
                    await asyncio.sleep(random.uniform(0.3, 0.7))
            except Exception:
                continue

        return form_data

    def _match_field(self, identifier: str, generated: dict) -> Optional[str]:
        for key_pattern, resolver in FIELD_MAPPING.items():
            if key_pattern in identifier:
                try:
                    return resolver(self.profile, generated)
                except (KeyError, IndexError):
                    continue

        lid = identifier.lower().strip()
        profile = self.profile
        if lid in ("name", "your name"):
            return profile.get("personal", {}).get("full_name", "")
        if lid in ("address", "current address"):
            loc = profile.get("personal", {}).get("location", {})
            parts = [loc.get("city", ""), loc.get("state", ""), loc.get("country", "")]
            return ", ".join(p for p in parts if p)
        if lid in ("e", "mail"):
            return profile.get("personal", {}).get("email", "")
        if lid in ("contact", "contact number"):
            return profile.get("personal", {}).get("phone", "")
        if lid in ("job title", "position"):
            return generated.get("title", "")
        if lid in ("company", "organisation", "organization"):
            return generated.get("company", "")
        if lid in ("location", "job location"):
            return profile.get("personal", {}).get("location", {}).get("city", "")

        if "year" in lid:
            edu = profile.get("education", {}).get("highest", {})
            return edu.get("end_year", "")
        if "skill" in lid:
            return ", ".join(profile.get("skills", {}).get("primary", [])[:3])
        if "reference" in lid:
            refs = profile.get("references", [])
            if refs:
                ref = refs[0]
                return f"{ref.get('name', '')} - {ref.get('relation', '')}"
        if "certification" in lid or "certificate" in lid:
            certs = profile.get("certifications", [])
            if certs:
                return certs[0].get("name", "")

        return None

    async def document_handler(self) -> DocumentHandler:
        return DocumentHandler(self, self.profile)

    async def take_screenshot(self, job_id: str, company: str) -> str:
        os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
        safe = company.lower().replace(" ", "_").replace("/", "_")
        filename = f"{job_id}_{safe}.png"
        filepath = os.path.join(SCREENSHOTS_DIR, filename)
        await self.page.screenshot(path=filepath, full_page=False)
        return filepath

    async def submit(self, platform: str) -> bool:
        selectors = self._platform_selectors(platform).get("submit_button", [])
        selectors += [
            "button[type='submit']",
            "input[type='submit']",
            "button:has-text('Submit')",
            "button:has-text('Apply')",
            "button:has-text('Send')",
            "button:has-text('Save')",
            "button:has-text('Next')",
        ]
        for selector in selectors:
            try:
                locator = self.page.locator(selector)
                count = await locator.count()
                if count > 0:
                    await locator.first.click()
                    await asyncio.sleep(3)
                    return True
            except Exception:
                continue
        self.log.warn(f"Submit button not found for {platform}")
        return False

    async def close(self):
        try:
            if self.page:
                await self.page.close()
        except Exception:
            pass
        try:
            if self.context:
                await self.context.close()
        except Exception:
            pass
        try:
            if self.browser:
                await self.browser.close()
        except Exception:
            pass
        try:
            if self._playwright:
                await self._playwright.stop()
        except Exception:
            pass

    async def apply(self, result: TailoredResult) -> Optional[ApplicationPayload]:
        raise NotImplementedError("Subclass must implement apply()")
