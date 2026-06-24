import asyncio
import json
import os
import sys
from playwright.async_api import async_playwright

LOGIN_URLS = {
    "indeed":      "https://secure.indeed.com/auth",
    "naukri":      "https://www.naukri.com/nlogin/login",
    "internshala": "https://internshala.com/login",
}

SUCCESS_URLS = {
    "indeed":      lambda url: "indeed.com" in url and "auth" not in url,
    "naukri":      lambda url: "naukri.com" in url and "login" not in url,
    "internshala": lambda url: "internshala.com" in url and "login" not in url,
}


async def save_cookies(platform: str):
    if platform not in LOGIN_URLS:
        print(f"Unknown platform: {platform}")
        sys.exit(1)

    login_url = LOGIN_URLS[platform]
    profile_dir = f"./browser_profiles/{platform}"
    cookie_path = f"cookies/{platform}_cookies.json"

    os.makedirs("cookies", exist_ok=True)
    os.makedirs(profile_dir, exist_ok=True)

    print(f"Opening your Chrome for {platform}...")
    print(f"Log in using EMAIL + PASSWORD (not Google SSO)")
    print(f"Waiting up to 120 seconds for login...")

    async with async_playwright() as p:
        context = await p.chromium.launch_persistent_context(
            user_data_dir=profile_dir,
            channel="chrome",
            headless=False,
            args=["--disable-blink-features=AutomationControlled"],
        )
        page = context.pages[0] if context.pages else await context.new_page()
        await page.goto(login_url, timeout=30000, wait_until="domcontentloaded")

        try:
            await page.wait_for_url(SUCCESS_URLS[platform], timeout=120000)
            print("Login detected — collecting cookies...")
            await asyncio.sleep(3)
        except Exception:
            print("Timeout — saving whatever cookies exist")

        cookies = await context.cookies()
        with open(cookie_path, "w") as f:
            json.dump(cookies, f, indent=2)

        print(f"✅ {platform.capitalize()} cookies saved — {len(cookies)} cookies stored")
        await context.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python3 scripts/save_cookies.py <platform>")
        sys.exit(1)
    asyncio.run(save_cookies(sys.argv[1]))
