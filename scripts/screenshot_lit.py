import asyncio
from playwright.async_api import async_playwright
from pathlib import Path

OUT = Path(r"C:\Users\Ken\.openclaw\workspace")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1400, "height": 900})
        await page.goto("http://localhost:8766/literature.html", wait_until="networkidle")
        await page.wait_for_timeout(4000)

        await page.screenshot(path=str(OUT / "lit-1-hero-quotes.png"), full_page=False)

        await page.evaluate("document.getElementById('reviews').scrollIntoView()")
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT / "lit-2-reviews.png"), full_page=False)

        await page.evaluate("document.getElementById('stats').scrollIntoView()")
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT / "lit-3-stats.png"), full_page=False)

        await page.evaluate("document.getElementById('shelves').scrollIntoView()")
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT / "lit-4-shelves.png"), full_page=False)

        await page.evaluate("document.getElementById('find').scrollIntoView()")
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT / "lit-5-findme.png"), full_page=False)

        await browser.close()
        print("Done!")

asyncio.run(main())
