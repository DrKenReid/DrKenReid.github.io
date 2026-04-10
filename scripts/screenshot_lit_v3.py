import asyncio
from playwright.async_api import async_playwright
from pathlib import Path

OUT = Path(r"C:\Users\Ken\.openclaw\workspace")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1400, "height": 900})
        await page.goto("http://localhost:8768/literature.html", wait_until="networkidle")
        await page.wait_for_timeout(5000)

        await page.evaluate("document.getElementById('reviews').scrollIntoView()")
        await page.wait_for_timeout(2000)
        await page.screenshot(path=str(OUT / "lit-reviews-v3.png"), full_page=False)

        # Scroll down a bit more to see more cards
        await page.evaluate("window.scrollBy(0, 600)")
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT / "lit-reviews-v3b.png"), full_page=False)

        await browser.close()
        print("Done!")

asyncio.run(main())
