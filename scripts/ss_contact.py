import asyncio
from playwright.async_api import async_playwright
from pathlib import Path
OUT = Path(r"C:\Users\Ken\.openclaw\workspace")
async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1400, "height": 900})
        await page.goto("http://localhost:8773/contact.html", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        await page.screenshot(path=str(OUT / "contact-1-hero.png"), full_page=False)
        await page.evaluate("document.getElementById('social').scrollIntoView()")
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT / "contact-2-social.png"), full_page=False)
        await page.evaluate("document.getElementById('bluesky').scrollIntoView()")
        await page.wait_for_timeout(2000)
        await page.screenshot(path=str(OUT / "contact-3-bluesky.png"), full_page=False)
        await page.evaluate("document.getElementById('location').scrollIntoView()")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=str(OUT / "contact-4-map.png"), full_page=False)
        await browser.close()
        print("Done!")
asyncio.run(main())
