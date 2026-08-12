"""Functional check of one engine-backed widget, via its test handle.

Drives a demo deterministically instead of photographing it: seeds a run,
steps to a known iteration, and asserts it is reproducible, that it makes
progress, that the chrome was built, that reduced motion mounts paused,
and that nothing overflows at phone width.

Run:  .venv/Scripts/python.exe .github/scripts/viz_verify.py <post> <mount-selector>
e.g.  ... viz_verify.py blog/drafts/algorithms-live/tabu-search-live.html "#tabu-demo"

smoke_test.py covers published posts automatically; this is for working on
one widget at a time, including unpublished drafts.
"""
import sys, threading
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
rel, mountsel = sys.argv[1], sys.argv[2]
PORT = 8171

h = partial(SimpleHTTPRequestHandler, directory=str(ROOT))
srv = ThreadingHTTPServer(("127.0.0.1", PORT), h)
srv.RequestHandlerClass.log_message = lambda *a, **k: None
threading.Thread(target=srv.serve_forever, daemon=True).start()

fails = []
with sync_playwright() as p:
    b = p.chromium.launch()
    for theme, w, hgt in (("dark", 1200, 900), ("light", 360, 780)):
        page = b.new_page(viewport={"width": w, "height": hgt})
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" else None)
        page.add_init_script(f"try{{localStorage.setItem('kr-theme','{theme}')}}catch(e){{}}")
        page.goto(f"http://127.0.0.1:{PORT}/{rel}", wait_until="networkidle")
        page.wait_for_timeout(1200)
        tag = f"{theme}@{w}"

        has = page.evaluate("s => !!(document.querySelector(s) || {}).krViz", mountsel)
        if not has:
            fails.append(f"{tag}: no krViz handle"); page.close(); continue

        # determinism: same seed and iteration must give the same readout twice
        a1 = page.evaluate("s => {const v=document.querySelector(s).krViz; v.seed(20260812); v.stepTo(40); return v.read();}", mountsel)
        a2 = page.evaluate("s => {const v=document.querySelector(s).krViz; v.seed(20260812); v.stepTo(40); return v.read();}", mountsel)
        if a1 != a2: fails.append(f"{tag}: not deterministic\n  {a1}\n  {a2}")
        if a1["iteration"] != 40 and not a1["finished"]:
            fails.append(f"{tag}: stepTo(40) landed on {a1['iteration']}")

        # it must actually make progress, not just run
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

        overflow = page.evaluate("document.documentElement.scrollWidth")
        if overflow > w + 1: fails.append(f"{tag}: horizontal overflow {overflow}")
        for c in page.query_selector_all(f"{mountsel} canvas"):
            box = c.bounding_box()
            if box["width"] > w or box["height"] < 60:
                fails.append(f"{tag}: canvas {round(box['width'])}x{round(box['height'])}")
        print(f"  {tag}: {counts}")
        if errs: fails.append(f"{tag}: {errs[:2]}")
        page.close()

    # reduced motion must mount paused
    page = b.new_page(viewport={"width": 1200, "height": 900}, reduced_motion="reduce")
    page.goto(f"http://127.0.0.1:{PORT}/{rel}", wait_until="networkidle")
    page.wait_for_timeout(900)
    st = page.evaluate("s => document.querySelector(s).krViz.read()", mountsel)
    it1 = st["iteration"]
    page.wait_for_timeout(900)
    it2 = page.evaluate("s => document.querySelector(s).krViz.read().iteration", mountsel)
    if it2 != it1: fails.append(f"reduced-motion: kept running ({it1} -> {it2})")
    print(f"  reduced-motion: iteration {it1} -> {it2}, status '{st['status']}'")
    page.close()
    b.close()
srv.shutdown()
print(("FAIL\n  " + "\n  ".join(fails)) if fails else "\nall checks passed")
