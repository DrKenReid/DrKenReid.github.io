#!/usr/bin/env python3
"""Headless smoke tests: load key pages and assert the JS-rendered UI
actually appears. The static audit checks markup; this catches the
class of bug where content exists in the DOM but never becomes visible
(e.g. reveal-animation regressions).

Run locally:  .venv/Scripts/python.exe .github/scripts/smoke_test.py
CI:           see .github/workflows/site-checks.yml (smoke job)
"""

import sys
import threading
import time
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
PORT = 8123

# Console/request errors from third parties are not our site breaking.
NOISE = ("googletagmanager", "google-analytics", "fonts.g", "gstatic",
         "instagram", "bsky", "giscus", "cartocdn", "openlibrary",
         "lastfm", "audioscrobbler", "wikimedia", "youtube", "tiktok",
         "goodreads", "gr-assets", "github.com", "githubassets")

CHECKS = [
    ("index.html", [
        ("hero renders", "!!document.querySelector('.welcome-area')"),
        ("now strip has items or cleared", "document.querySelectorAll('#now-strip .kr-skel-bar').length === 0"),
        ("stats visible", "document.querySelectorAll('.home-stat-value').length >= 4"),
        ("blog cards visible", "Array.from(document.querySelectorAll('.blog-card, .single-post-area')).filter(e => getComputedStyle(e).opacity !== '0').length >= 1"),
        ("footer grid", "!!document.querySelector('.kr-footer-grid')"),
    ]),
    ("blog.html", [
        ("blog tiles visible", "Array.from(document.querySelectorAll('#blog-grid .single-post-area')).filter(e => getComputedStyle(e).opacity !== '0').length >= 3"),
        ("filter buttons", "document.querySelectorAll('.gallery-filter-btn').length >= 3"),
    ]),
    ("gallery.html", [
        ("gallery tiles", "document.querySelectorAll('.single_gallery_item').length >= 12"),
        ("filter buttons", "document.querySelectorAll('.gallery-filter-btn').length >= 5"),
    ]),
    ("blog/rating-systems.html", [
        ("post body visible", "(() => { const p = document.querySelector('.blog-post > p'); return p && getComputedStyle(p).opacity !== '0'; })()"),
        ("toc built", "document.querySelectorAll('.kr-toc a').length >= 4"),
        ("footer latest posts", "document.querySelectorAll('.kr-footer-posts a').length >= 1"),
        ("progress bar", "!!document.querySelector('.kr-progress-bar')"),
    ]),
    ("quotes.html", [
        ("quote cards", "document.querySelectorAll('.kr-quote-card').length >= 500"),
    ]),
    ("map.html", [
        ("leaflet initialized", "!!document.querySelector('.leaflet-container')"),
        ("region markers", "document.querySelectorAll('.kr-map-marker').length >= 10"),
    ]),
]


def main():
    handler = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
    server = ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    failures = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        console_errors = []
        page.on("console", lambda m: console_errors.append(m.text)
                if m.type == "error" else None)

        for path, assertions in CHECKS:
            console_errors.clear()
            try:
                page.goto(f"http://127.0.0.1:{PORT}/{path}",
                          wait_until="domcontentloaded", timeout=30000)
            except Exception as e:
                failures.append(f"{path}: navigation failed: {e}")
                continue
            page.wait_for_timeout(3500)
            for name, expr in assertions:
                try:
                    ok = page.evaluate(f"() => {expr}")
                except Exception as e:
                    ok = False
                    name += f" (evaluate error: {e})"
                status = "ok" if ok else "FAIL"
                print(f"{status:4} {path} :: {name}")
                if not ok:
                    failures.append(f"{path}: {name}")
            own_errors = [e for e in console_errors
                          if not any(n in e for n in NOISE)]
            if own_errors:
                for e in own_errors[:3]:
                    print(f"FAIL {path} :: console error: {e[:140]}")
                failures.append(f"{path}: console errors")
        browser.close()
    server.shutdown()

    if failures:
        print(f"\n{len(failures)} smoke failure(s)")
        return 1
    print("\nsmoke: all green")
    return 0


if __name__ == "__main__":
    sys.exit(main())
