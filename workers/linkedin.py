from typing import Optional

from core.models import ApplicationPayload, TailoredResult
from workers.base import BaseWorker


class LinkedInWorker(BaseWorker):

    async def apply(self, result: TailoredResult) -> Optional[ApplicationPayload]:
        await self.launch()
        try:
            await self.load_cookies("linkedin")
        except FileNotFoundError:
            self.log.warn("LinkedIn cookies not found — worker disabled")
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

        if "linkedin.com" not in self.page.url:
            self.log.warn(f"Redirected — cookies may be expired")
            await self.close()
            return ApplicationPayload(
                job_id=result.job_id, platform=result.platform,
                title=result.title, company=result.company,
                apply_url=result.apply_url, match_score=result.match_score,
                keywords_injected=result.keywords_injected,
                resume_variant=result.resume_variant,
                status=ApplicationPayload.STATUS_NEEDS_COOKIES,
            )

        clicked = await self.smart_click("easy_apply_button", "linkedin")
        if not clicked:
            self.log.warn("Easy Apply button not found — form may already be open or not available")
            return ApplicationPayload(
                job_id=result.job_id, platform=result.platform,
                title=result.title, company=result.company,
                apply_url=result.apply_url, match_score=result.match_score,
                keywords_injected=result.keywords_injected,
                resume_variant=result.resume_variant,
                status=ApplicationPayload.STATUS_UNKNOWN_FORM,
            )

        await self.page.wait_for_timeout(2000)

        p = self.profile["personal"]
        form_data = {}

        phone_filled = await self.smart_fill("phone", p["phone"], "linkedin")
        if phone_filled:
            form_data["phone"] = p["phone"]

        await self.upload_resume(result.tailored_resume, "linkedin")
        form_data["resume_uploaded"] = "yes"

        steps = 0
        while steps < 10:
            next_clicked = await self.smart_click("next_button", "linkedin")
            if next_clicked:
                steps += 1
                await self.page.wait_for_timeout(1500)
                continue
            review_clicked = await self.smart_click("review_button", "linkedin")
            if review_clicked:
                steps += 1
                await self.page.wait_for_timeout(1500)
                continue
            break

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
