from typing import Optional

from core.models import ApplicationPayload, TailoredResult
from workers.base import BaseWorker


class InternshalaWorker(BaseWorker):

    async def apply(self, result: TailoredResult) -> Optional[ApplicationPayload]:
        await self.launch()
        try:
            await self.load_cookies("internshala")
        except FileNotFoundError:
            self.log.warn("Internshala cookies not found — worker disabled")
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

        login_indicator = await self.page.locator("input[name='email'], #email, input[type='email']").count()
        if login_indicator > 0 and "internshala.com/login" in self.page.url:
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

        keywords = ", ".join(result.keywords_injected)
        cover = self.profile["cover_letter_template"].format(
            title=result.title, company=result.company, keywords=keywords
        )

        fields = {
            "cover_letter": cover,
            "availability": self.profile["professional"]["notice_period"],
        }

        form_data = {}
        for field_name, value in fields.items():
            self.log.filling(field_name, value)
            ok = await self.smart_fill(field_name, value, "internshala")
            if ok:
                form_data[field_name] = value

        await self.upload_resume(result.tailored_resume, "internshala")
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
