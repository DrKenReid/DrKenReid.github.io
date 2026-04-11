import asyncio
from playwright.async_api import async_playwright
from pathlib import Path
OUT = Path(r"C:\Users\Ken\.openclaw\workspace")
async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 900, "height": 1200})
        await page.goto("http://localhost:8772/embed_test.html", wait_until="domcontentloaded")
        await page.wait_for_timeout(8000)
        await page.screenshot(path=str(OUT / "embed-test.png"), full_page=True)
        await browser.close()
        print("Done!")
asyncio.run(main())
