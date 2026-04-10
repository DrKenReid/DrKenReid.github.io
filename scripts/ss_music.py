import asyncio
from playwright.async_api import async_playwright
from pathlib import Path
OUT = Path(r"C:\Users\Ken\.openclaw\workspace")
async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1400, "height": 900})
        await page.goto("http://localhost:8771/music.html", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        await page.screenshot(path=str(OUT / "music-1-hero.png"), full_page=False)
        await page.evaluate("window.scrollTo(0, 600)")
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT / "music-2-guitar.png"), full_page=False)
        await page.evaluate("document.getElementById('playlists').scrollIntoView()")
        await page.wait_for_timeout(1000)
        await page.screenshot(path=str(OUT / "music-3-playlists.png"), full_page=False)
        await page.evaluate("document.getElementById('lastfm').scrollIntoView()")
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT / "music-4-lastfm.png"), full_page=False)
        await page.evaluate("document.getElementById('find').scrollIntoView()")
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT / "music-5-findme.png"), full_page=False)
        await browser.close()
        print("Done!")
asyncio.run(main())
