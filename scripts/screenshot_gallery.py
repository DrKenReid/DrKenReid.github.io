"""Take screenshots of the gallery page sections."""
import asyncio
from playwright.async_api import async_playwright
from pathlib import Path

OUT = Path(r"C:\Users\Ken\.openclaw\workspace")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1400, "height": 900})
        await page.goto("http://localhost:8765/gallery.html", wait_until="networkidle")
        
        # Wait for gallery to render
        await page.wait_for_timeout(3000)
        
        # Screenshot 1: Hero/breadcrumb + intro
        await page.screenshot(path=str(OUT / "gallery-hero.png"), full_page=False)
        
        # Screenshot 2: Scroll to intro/achievements
        await page.evaluate("window.scrollTo(0, 600)")
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT / "gallery-intro.png"), full_page=False)
        
        # Screenshot 3: Gallery filters + grid
        gallery = page.locator("#gallery")
        await gallery.scroll_into_view_if_needed()
        await page.wait_for_timeout(1000)
        await page.screenshot(path=str(OUT / "gallery-grid.png"), full_page=False)
        
        # Screenshot 4: Chrome themes
        themes = page.locator("#themes")
        await themes.scroll_into_view_if_needed()
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT / "gallery-themes.png"), full_page=False)
        
        # Screenshot 5: Find Me / online presence
        online = page.locator("#online")
        await online.scroll_into_view_if_needed()
        await page.wait_for_timeout(500)
        await page.screenshot(path=str(OUT / "gallery-findme.png"), full_page=False)
        
        await browser.close()
        print("Done! Screenshots saved.")

asyncio.run(main())
