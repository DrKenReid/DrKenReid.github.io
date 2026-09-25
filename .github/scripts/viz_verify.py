"""Functional check of one engine-backed widget, via its test handle.

Drives a demo deterministically instead of photographing it: seeds a run,
steps to a known iteration, and asserts it is reproducible, that stepTo
lands where asked, that reduced motion mounts paused, and that nothing
overflows at phone width. Progress and the chrome are printed, not
asserted (the readout at iterations 1 and 120, and the buttons, sliders
and tiles found), because what counts as progress, and which chrome the
engine builds, differ from demo to demo.

Run:  .venv/Scripts/python.exe .github/scripts/viz_verify.py <post> <mount-selector>
e.g.  ... viz_verify.py blog/tabu-search-live.html "#tabu-demo"

smoke_test.py covers published posts automatically; this is for working on
one widget at a time, including unpublished drafts.
"""
import sys
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402
from harness import (describe_overflow, element_overflow, serve,  # noqa: E402
                     set_theme, watch_console)

_parser = sitelib.arg_parser(__doc__)
_parser.add_argument("post", help="page to open, relative to the site root (blog/x.html)")
_parser.add_argument("mount", help="CSS selector of the widget's mount, e.g. '#tabu-demo'")
_args = _parser.parse_args()
rel, mountsel = _args.post, _args.mount

# The mount has its handle once the engine has built it. This used to be a
# flat 1.2s sleep; waiting on the handle itself moves on as soon as it is
# there and still allows the old 1.2s plus a margin before giving up.
HANDLE = "s => !!(document.querySelector(s) || {}).krViz"
HANDLE_TIMEOUT_MS = 1200 + 2000


def mounted(page):
    try:
        page.wait_for_function(HANDLE, arg=mountsel, timeout=HANDLE_TIMEOUT_MS)
        return True
    except PlaywrightTimeout:
        return False


fails = []
# serve() with no port takes one from the OS, so this can run beside the
# smoke suite or a second copy of itself.
with serve() as base, sync_playwright() as p:
    b = p.chromium.launch()
    for theme, w, hgt in (("dark", 1200, 900), ("light", 360, 780)):
        context = b.new_context(viewport={"width": w, "height": hgt})
        set_theme(context, theme)
        page = context.new_page()
        errs = []
        # Responses are filtered by host, so the third parties a draft trips
        # over (it has no giscus discussion yet, so its comment lookup always
        # 404s) never reach errs. Uncaught exceptions are collected too.
        watch_console(page, errs, base)
        page.goto(f"{base}/{rel}", wait_until="networkidle")
        tag = f"{theme}@{w}"

        if not mounted(page):
            fails.append(f"{tag}: no krViz handle"); context.close(); continue

        # determinism: same seed and iteration must give the same readout twice
        a1 = page.evaluate("s => {const v=document.querySelector(s).krViz; v.seed(20260812); v.stepTo(40); return v.read();}", mountsel)
        a2 = page.evaluate("s => {const v=document.querySelector(s).krViz; v.seed(20260812); v.stepTo(40); return v.read();}", mountsel)
        if a1 != a2: fails.append(f"{tag}: not deterministic\n  {a1}\n  {a2}")
        if a1["iteration"] != 40 and not a1["finished"]:
            fails.append(f"{tag}: stepTo(40) landed on {a1['iteration']}")

        # Printed for a person to read: a demo can finish early or hold a
        # readout still for a while, so no single rule says it progressed.
        early = page.evaluate("s => {const v=document.querySelector(s).krViz; v.seed(20260812); v.stepTo(1); return v.read();}", mountsel)
        late = page.evaluate("s => {const v=document.querySelector(s).krViz; v.stepTo(120); return v.read();}", mountsel)
        print(f"  {tag}: it1={early['stats']} -> it{late['iteration']}={late['stats']}"
              f" {'FINISHED: ' + late['status'] if late['finished'] else ''}")

        # controls and tiles were built
        counts = page.evaluate("""s => {const r=document.querySelector(s); return {
            buttons: r.querySelectorAll('.kr-btn').length,
            ranges: r.querySelectorAll('input[type=range]').length,
            tiles: r.querySelectorAll('.kr-stat').length,
            live: r.querySelector('.kr-status') ? r.querySelector('.kr-status').getAttribute('aria-live') : null};}""", mountsel)
        # Chrome composition is a per-post choice: some widgets let the engine
        # build controls and tiles, others (simulated annealing) keep their
        # own. So the counts are reported, not asserted; the only rule is that
        # a status line the engine owns must be announced politely.
        if counts["live"] is not None and counts["live"] != "polite":
            fails.append(f"{tag}: status aria-live is {counts['live']}")

        # Per element: html and body clip overflow-x, so the page's own
        # scrollWidth stays at the viewport whatever runs off it.
        overflow = element_overflow(page)
        if overflow: fails.append(f"{tag}: overflow {describe_overflow(overflow)}")
        for c in page.query_selector_all(f"{mountsel} canvas"):
            box = c.bounding_box()
            if box["width"] > w or box["height"] < 60:
                fails.append(f"{tag}: canvas {round(box['width'])}x{round(box['height'])}")
        print(f"  {tag}: {counts}")
        if errs: fails.append(f"{tag}: {errs[:2]}")
        context.close()

    # reduced motion must mount paused
    page = b.new_page(viewport={"width": 1200, "height": 900}, reduced_motion="reduce")
    page.goto(f"{base}/{rel}", wait_until="networkidle")
    if mounted(page):
        st = page.evaluate("s => document.querySelector(s).krViz.read()", mountsel)
        it1 = st["iteration"]
        # A deliberate window, not a wait: a running demo steps dozens of
        # times in this long, and a paused one not at all.
        page.wait_for_timeout(900)
        it2 = page.evaluate("s => document.querySelector(s).krViz.read().iteration", mountsel)
        if it2 != it1: fails.append(f"reduced-motion: kept running ({it1} -> {it2})")
        print(f"  reduced-motion: iteration {it1} -> {it2}, status '{st['status']}'")
    else:
        fails.append("reduced-motion: no krViz handle")
    page.close()
    b.close()
print(("FAIL\n  " + "\n  ".join(fails)) if fails else "\nall checks passed")
sys.exit(1 if fails else 0)
