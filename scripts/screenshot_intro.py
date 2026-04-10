import asyncio
from playwright.async_api import async_playwright
from pathlib import Path

OUT = Path(r"C:\Users\Ken\.openclaw\workspace")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1400, "height": 900})
        await page.goto("http://localhost:8765/gallery.html", wait_until="networkidle")
        await page.wait_for_timeout(3000)
        
        # Scroll to intro
        await page.evaluate("window.scrollTo(0, 550)")
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT / "gallery-intro-v2.png"), full_page=False)
        
        await browser.close()
        print("Done!")

asyncio.run(main())
