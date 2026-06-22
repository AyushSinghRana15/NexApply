"""
One-time cookie saver per platform.

Usage:
    python3 scripts/save_cookies.py linkedin
    python3 scripts/save_cookies.py indeed
    python3 scripts/save_cookies.py naukri
    python3 scripts/save_cookies.py internshala

Opens a visible browser, navigates to login page,
waits for you to log in manually (120s timeout),
then saves cookies to cookies/{platform}_cookies.json.
"""

import asyncio
import json
import os
import sys

from playwright.async_api import async_playwright

LOGIN_URLS = {
    "linkedin": "https://www.linkedin.com/login",
    "indeed": "https://secure.indeed.com/auth",
    "naukri": "https://www.naukri.com/nlogin/login",
    "internshala": "https://internshala.com/login",
}


async def save_cookies(platform: str):
    if platform not in LOGIN_URLS:
        print(f"❌ Unknown platform: {platform}")
        print(f"   Choose from: {', '.join(LOGIN_URLS.keys())}")
        sys.exit(1)

    login_url = LOGIN_URLS[platform]
    cookie_dir = "cookies"
    os.makedirs(cookie_dir, exist_ok=True)
    cookie_path = os.path.join(cookie_dir, f"{platform}_cookies.json")

    print(f"🔓 Opening browser for {platform}...")
    print(f"🌐 Navigated to {login_url}")
    print(f"⏳ Please log in manually within 120 seconds...")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        await page.goto(login_url, timeout=30000)

        try:
            await page.wait_for_url(
                lambda url: url != login_url,
                timeout=120000,
            )
        except Exception:
            print("⏰ 120s timeout reached — saving whatever cookies exist")

        await asyncio.sleep(2)

        cookies = await context.cookies()
        with open(cookie_path, "w") as f:
            json.dump(cookies, f, indent=2)

        print(f"✅ {platform.capitalize()} cookies saved — {len(cookies)} cookies stored")
        await browser.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/save_cookies.py <platform>")
        print(f"Platforms: {', '.join(LOGIN_URLS.keys())}")
        sys.exit(1)

    asyncio.run(save_cookies(sys.argv[1]))
