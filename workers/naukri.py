from typing import Optional

from core.models import ApplicationPayload, TailoredResult
from workers.base import BaseWorker


class NaukriWorker(BaseWorker):

    async def apply(self, result: TailoredResult) -> Optional[ApplicationPayload]:
        await self.launch()
        try:
            await self.load_cookies("naukri")
        except FileNotFoundError:
            self.log.warn("Naukri cookies not found — worker disabled")
            await self.close()
            return None

        self.log.browser_open("Browser opened — navigating to apply URL")
        try:
            await self.page.goto(result.apply_url, timeout=30000)
        except Exception as e:
            self.log.error(f"Page load timeout — {e}")
            await self.close()
            return ApplicationPayload(
                job_id=result.job_id, platform=result.platform,
                title=result.title, company=result.company,
                apply_url=result.apply_url, match_score=result.match_score,
                keywords_injected=result.keywords_injected,
                resume_variant=result.resume_variant,
                status=ApplicationPayload.STATUS_FAILED,
            )

        login_indicator = await self.page.locator("input[name='username'], #usernameField").count()
        if login_indicator > 0:
            self.log.warn("Redirected to login — cookies expired")
            await self.close()
            return ApplicationPayload(
                job_id=result.job_id, platform=result.platform,
                title=result.title, company=result.company,
                apply_url=result.apply_url, match_score=result.match_score,
                keywords_injected=result.keywords_injected,
                resume_variant=result.resume_variant,
                status=ApplicationPayload.STATUS_NEEDS_COOKIES,
            )

        clicked = await self.smart_click("apply_button", "naukri")
        if not clicked:
            self.log.warn("Apply button not found")
            return ApplicationPayload(
                job_id=result.job_id, platform=result.platform,
                title=result.title, company=result.company,
                apply_url=result.apply_url, match_score=result.match_score,
                keywords_injected=result.keywords_injected,
                resume_variant=result.resume_variant,
                status=ApplicationPayload.STATUS_UNKNOWN_FORM,
            )

        await self.page.wait_for_timeout(2000)

        prof = self.profile["professional"]
        keywords = ", ".join(result.keywords_injected)
        cover = self.profile["cover_letter_template"].format(
            title=result.title, company=result.company, keywords=keywords
        )

        fields = {
            "cover_letter": cover,
            "notice_period": prof["notice_period"],
            "current_ctc": prof["current_ctc"],
            "expected_ctc": prof["expected_ctc"],
        }

        form_data = {}
        for field_name, value in fields.items():
            self.log.filling(field_name, value)
            ok = await self.smart_fill(field_name, value, "naukri")
            if ok:
                form_data[field_name] = value

        await self.upload_resume(result.tailored_resume, "naukri")
        form_data["resume_uploaded"] = "yes"

        screenshot = await self.take_screenshot(result.job_id, result.company)
        self.log.screenshot_saved(screenshot)

        payload = ApplicationPayload(
            job_id=result.job_id,
            platform=result.platform,
            title=result.title,
            company=result.company,
            apply_url=result.apply_url,
            match_score=result.match_score,
            keywords_injected=result.keywords_injected,
            resume_variant=result.resume_variant,
            screenshot_path=screenshot,
            form_data_used=form_data,
            status=ApplicationPayload.STATUS_PENDING_REVIEW,
            page=self.page,
        )

        self.log.paused("PAUSED — waiting for GuardAgent approval")
        return payload
