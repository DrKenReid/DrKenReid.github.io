#!/usr/bin/env python3
"""Headless smoke tests: load key pages and assert the JS-rendered UI
actually appears. The static audit checks markup; this catches the
class of bug where content exists in the DOM but never becomes visible
(e.g. reveal-animation regressions).

It also covers the accessibility behaviour that only exists at runtime and
so cannot be seen in the markup: keyboard access to a clickable canvas, a
live region that announces without flooding, sliders that expose the value
a reader can see, a focus ring that survives the cascade, reduced motion,
and the related-posts block being rendered once rather than twice. Every
one of those has been broken here before; running this suite against the
tree from before those fixes produces 24 failures.

Run locally:  .venv/Scripts/python.exe .github/scripts/smoke_test.py
CI:           see .github/workflows/site-checks.yml (smoke job)
"""

import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
from harness import ROOT, Reporter, serve, watch_console  # noqa: E402

PORT = 8123

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
    # frodo-sam keeps its generated related-posts block just outside
    # .blog-post, which is exactly the shape that once got a second block
    # injected on top of it. Worth pinning on a post that has that layout.
    ("blog/frodo-sam-and-love.html", [
        ("exactly one related-posts block",
         "document.querySelectorAll('.related-posts').length === 1"),
        ("back-link sits inside main",
         "(() => { const c = document.querySelector('.post-cta');"
         "  return !!c && !!c.closest('main'); })()"),
    ]),
    ("blog/rating-systems.html", [
        ("post body visible", "(() => { const p = document.querySelector('.blog-post > p'); return p && getComputedStyle(p).opacity !== '0'; })()"),
        ("exactly one related-posts block",
         "document.querySelectorAll('.related-posts').length === 1"),
        ("back-link sits inside main",
         "(() => { const c = document.querySelector('.post-cta');"
         "  return !!c && !!c.closest('main'); })()"),
        ("toc built", "document.querySelectorAll('.kr-toc a').length >= 4"),
        ("footer latest posts", "document.querySelectorAll('.kr-footer-posts a').length >= 1"),
        ("progress bar", "!!document.querySelector('.kr-progress-bar')"),
    ]),
    ("series-how-this-site-is-built.html", [
        ("series parts render", "document.querySelectorAll('#series-grid .blog-card').length >= 4"),
        ("part chips", "document.querySelectorAll('#series-grid .kr-series-chip').length >= 4"),
    ]),
    ("quotes.html", [
        ("quote cards", "document.querySelectorAll('.kr-quote-card').length >= 500"),
    ]),
    ("map.html", [
        ("leaflet initialized", "!!document.querySelector('.leaflet-container')"),
        ("region markers", "document.querySelectorAll('.kr-map-marker').length >= 10"),
    ]),
]


def interactive_posts():
    """Blog posts with a <canvas> demo. Auto-discovered so future
    interactive posts (simulated annealing, genetic algorithms, ...)
    get the mobile check without anyone remembering to add them."""
    posts = []
    for f in sorted((ROOT / "blog").glob("*.html")):
        if "<canvas" in f.read_text(encoding="utf-8", errors="replace"):
            posts.append(f"blog/{f.name}")
    return posts


def check_converges(page, path, rep):
    """A demo that renders but never gets anywhere still looks fine in a
    screenshot. Widgets on the kr-viz engine expose a handle, so drive one
    deterministically and assert it actually moved: same seed twice gives
    the same readout, and 150 steps change something.

    Posts not yet on the engine are skipped rather than failed.
    """
    page.set_viewport_size({"width": 1100, "height": 900})
    page.goto(f"http://127.0.0.1:{PORT}/{path}", wait_until="domcontentloaded")
    page.wait_for_timeout(700)
    handles = page.evaluate(
        "() => [...document.querySelectorAll('.kr-viz')]"
        "        .filter(e => e.krViz).map(e => e.id)")
    for wid in handles:
        js = """(id) => {
            const v = document.getElementById(id).krViz;
            v.seed(20260807); v.stepTo(1);   const a = v.read();
            v.stepTo(150);                   const b = v.read();
            v.seed(20260807); v.stepTo(150); const c = v.read();
            return {a, b, c};
        }"""
        try:
            r = page.evaluate(js, wid)
        except Exception as e:  # noqa: BLE001 - report, do not abort the suite
            rep.check(path, f"#{wid} handle threw", False, e)
            continue
        moved = r["a"]["stats"] != r["b"]["stats"] or r["b"]["iteration"] > r["a"]["iteration"]
        same = r["b"] == r["c"]
        rep.check(path, f"#{wid} demo advances", moved)
        rep.check(path, f"#{wid} same seed, same run", same)


def check_a11y(page, path, rep):
    """The demos hold most of the site's interaction, so they hold most of its
    accessibility risk, and none of it is visible in a screenshot.

    Each of these has been broken in the past:
      - a canvas advertising "click or tap to add points" that ignored the
        keyboard entirely (WCAG 2.1.1, level A)
      - a status span written every step while marked aria-live, which meant
        around fifty announcements a second
      - sliders whose screen-reader value was the raw slider integer rather
        than the temperature or the log-scaled rate the reader can see
      - a focus ring stripped by a vendor rule further down the stylesheet
    """
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(f"http://127.0.0.1:{PORT}/{path}", wait_until="domcontentloaded")
    page.wait_for_timeout(1200)

    def report(name, ok, detail=""):
        return rep.check(path, f"a11y {name}", ok, detail)

    # --- sliders announce what the reader can see -----------------------
    mute = page.evaluate(
        "() => [...document.querySelectorAll('.kr-viz input[type=range]')]"
        "      .filter(r => !r.hasAttribute('aria-valuetext'))"
        "      .map(r => r.id || '(no id)')")
    report("sliders have aria-valuetext", not mute, mute)

    # --- focus stays visible on every control type ----------------------
    # The site's focus style is an outline plus a halo. Accepting the halo
    # alone would have let the original bug through: two vendor rules stripped
    # outline from links and inputs and left only the faint box-shadow, which
    # is why this insists on the outline itself.
    dim = page.evaluate("""() => {
        const out = [];
        for (const sel of ['.kr-viz .kr-btn', '.kr-viz input[type=range]',
                           '.kr-viz select', '.kr-viz input[type=checkbox]',
                           'main a']) {
            const n = document.querySelector(sel);
            if (!n) continue;
            n.focus();
            const cs = getComputedStyle(n);
            if (cs.outlineStyle === 'none' || parseFloat(cs.outlineWidth) < 1)
                out.push(sel + ' (outline: ' + cs.outlineStyle + ' ' + cs.outlineWidth + ')');
            n.blur();
        }
        return out;
    }""")
    report("focus ring is visible on controls", not dim, dim)

    # --- a clickable canvas is operable from the keyboard ---------------
    canvases = page.evaluate(
        "() => document.querySelectorAll('.kr-viz canvas.kr-interactive').length")
    if canvases:
        info = page.evaluate("""() => {
            const c = document.querySelector('.kr-viz canvas.kr-interactive');
            const d = c.getAttribute('aria-describedby');
            return {tabindex: c.getAttribute('tabindex'),
                    hint: !!(d && document.getElementById(d.split(' ').pop()))};
        }""")
        report("interactive canvas is focusable", info["tabindex"] == "0", info)
        report("interactive canvas describes its keys", info["hint"], info)

        # freeze it, so any pixel change is the keypress and not the animation
        page.evaluate("() => document.querySelectorAll('.kr-viz')"
                      ".forEach(r => r.krViz && r.krViz.pause())")
        page.wait_for_timeout(250)
        target = page.query_selector(".kr-viz canvas.kr-interactive")
        target.focus()
        for _ in range(3):
            page.keyboard.press("ArrowRight")
        page.wait_for_timeout(150)
        shot = "() => document.querySelector('.kr-viz canvas.kr-interactive').toDataURL()"
        before = page.evaluate(shot)
        page.keyboard.press("Enter")
        page.wait_for_timeout(500)
        report("Enter acts on the canvas", page.evaluate(shot) != before)

    # --- the live region does not flood ---------------------------------
    # Posts not on the engine have no live region to measure; a post that is
    # on the engine and has lost one is a regression, so the two are separated.
    on_engine = page.evaluate(
        "() => [...document.querySelectorAll('.kr-viz')].some(e => e.krViz)")
    if not on_engine:
        rep.skip(path, "a11y live region", "post is not on the engine")
        return
    page.evaluate("() => {const r = document.querySelector('.kr-viz');"
                  "       if (r) r.scrollIntoView({block: 'center'});}")
    page.wait_for_timeout(300)
    page.evaluate("() => document.querySelectorAll('.kr-viz')"
                  ".forEach(r => r.krViz && r.krViz.run())")
    churn = page.evaluate("""() => new Promise(res => {
        const live = document.querySelector('.kr-viz .kr-sr-only[aria-live]');
        if (!live) return res(-1);
        let n = 0;
        const mo = new MutationObserver(() => n++);
        mo.observe(live, {childList: true, characterData: true, subtree: true});
        setTimeout(() => { mo.disconnect(); res(n); }, 3000);
    })""")
    # throttled to one every 1.2s, so three in three seconds is the ceiling
    report("live region exists", churn != -1, "no .kr-sr-only[aria-live] found")
    if churn != -1:
        report("live region is throttled", churn <= 3,
               f"{churn} announcements in 3s")


def check_reduced_motion(browser, path, rep):
    """Under prefers-reduced-motion the demos must mount paused and stay put,
    showing the first frame rather than a blank box."""
    page = browser.new_page(viewport={"width": 1280, "height": 900},
                            reduced_motion="reduce")
    page.goto(f"http://127.0.0.1:{PORT}/{path}", wait_until="domcontentloaded")
    page.wait_for_timeout(1400)
    first = page.evaluate("() => {const r = document.querySelector('.kr-viz');"
                          "return r && r.krViz ? r.krViz.read().iteration : -1;}")
    page.wait_for_timeout(1600)
    later = page.evaluate("() => {const r = document.querySelector('.kr-viz');"
                          "return r && r.krViz ? r.krViz.read().iteration : -1;}")
    page.close()
    if first == -1:
        rep.skip(path, "a11y reduced motion", "post is not on the engine")
        return
    rep.check(path, "a11y honours reduced motion", first == later,
              f"advanced {first} -> {later}")


def run_assertions(page, scope, assertions, rep):
    """Evaluate a table of (name, js-expression) pairs against the open page.

    This is the shape most checks want, so both the CHECKS table and the
    phone-width pass go through it rather than each writing its own loop.
    """
    for name, expr in assertions:
        try:
            ok = page.evaluate(f"() => {expr}")
        except Exception as e:  # noqa: BLE001 - a bad expression is a failure
            ok = False
            name += f" (evaluate error: {e})"
        rep.check(scope, name, ok)


def check_mobile(page, path, console_errors, rep):
    """Interactive demos must scale to phone width: no horizontal
    overflow, no console errors, and every visible canvas both fits the
    viewport and keeps a usable height (a squashed or zero-height canvas
    renders 'successfully' and is still broken)."""
    console_errors.clear()
    scope = f"{path} @360px"
    page.set_viewport_size({"width": 360, "height": 780})
    try:
        page.goto(f"http://127.0.0.1:{PORT}/{path}",
                  wait_until="domcontentloaded", timeout=30000)
    except Exception as e:  # noqa: BLE001
        rep.check(scope, "navigation", False, e)
        return
    page.wait_for_timeout(3500)
    run_assertions(page, scope, [
        ("no horizontal overflow",
         "document.documentElement.scrollWidth <= 362"),
        ("canvases fit viewport",
         "Array.from(document.querySelectorAll('canvas'))"
         ".every(c => c.getBoundingClientRect().width <= 362)"),
        ("canvases keep usable height",
         "Array.from(document.querySelectorAll('canvas'))"
         ".filter(c => c.getBoundingClientRect().width > 0)"
         ".every(c => c.getBoundingClientRect().height >= 100)"),
    ], rep)
    rep.console_errors(scope, console_errors)


def main():
    rep = Reporter()
    with serve(PORT), sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        console_errors = []
        watch_console(page, console_errors)

        for path, assertions in CHECKS:
            console_errors.clear()
            try:
                page.goto(f"http://127.0.0.1:{PORT}/{path}",
                          wait_until="domcontentloaded", timeout=30000)
            except Exception as e:  # noqa: BLE001
                rep.check(path, "navigation", False, e)
                continue
            page.wait_for_timeout(3500)
            # Reveal-on-scroll content (initSectionReveals) only appears
            # once it crosses the viewport line; nudge the page like a
            # reader would. A truly-broken reveal stays hidden regardless.
            page.evaluate("window.scrollBy(0, 700)")
            page.wait_for_timeout(900)
            run_assertions(page, path, assertions, rep)
            rep.console_errors(path, console_errors)

        # Phone-width pass over every interactive (canvas) post.
        for path in interactive_posts():
            check_mobile(page, path, console_errors, rep)
            check_converges(page, path, rep)
            check_a11y(page, path, rep)
        # One reduced-motion pass is enough: the behaviour lives in the engine,
        # not in any one post.
        check_reduced_motion(browser, "blog/particle-swarm-live.html", rep)
        browser.close()
    return rep.summary("smoke")


if __name__ == "__main__":
    sys.exit(main())
