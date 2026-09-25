#!/usr/bin/env python3
"""Headless smoke tests: load the site in a real browser and assert that
what the scripts build actually appears, fits and stays quiet.

The static audit (audit_site.py) reads markup. This catches what only
exists at runtime: content in the DOM that never becomes visible, a page
that runs off a phone screen, a script that throws on load.

The checks, and the regression each one guards:

  CHECKS            Per-page predicates on the pages whose UI is built by
                    script. Content stuck at opacity 0 (the reveal-animation
                    regressions), the related-posts block injected twice,
                    a hand-coded back link copied into a post, and the hero's
                    animation class pruned out of style.min.css.
  check_sweep       Every tracked top-level page at 360 and 1280 wide in the
                    dark theme, and at 360 in light: nothing runs past the
                    right edge, no console error, uncaught exception or
                    failed request of our own, and no em dash placeholder
                    left in a figure filled from data ([data-colo],
                    [data-lit], [data-count]), which is what a data file
                    that failed to load looks like.
  check_mobile      Every canvas post at 360: no element overflow, canvases
                    fit and keep a usable height (a squashed or zero-height
                    canvas renders "successfully"), no console errors.
  check_converges   Engine demos make progress and are reproducible.
  check_a11y        Sliders announce the value the reader sees, focus rings
                    survive the cascade, a clickable canvas works from the
                    keyboard (WCAG 2.1.1), the live region does not flood.
  check_reduced_motion
                    Demos mount paused under prefers-reduced-motion.
  check_sketches    Every hover sketch runs 120 frames without throwing and
                    paints something.

Every one of the accessibility checks has been broken here before; running
this suite against the tree from before those fixes produces 24 failures.

Regression pins (run_pins). Each pins one bug that shipped and was fixed,
and each was proved against its bug before it was trusted: the fix broken
again in a rewritten response (or, for the stylesheet check, a build made
without one class), and the pin seen to fail.

  check_opener_colours      Opener title #fff and kicker #ffe89e in both
                            themes (the dark paragraph default once turned
                            them grey); share rail buttons and phone sheet
                            not white in dark (they read an undefined
                            --card-bg and fell back to white).
  check_focus_rings         A real Tab press rings .btn, .gallery-filter-btn,
                            .alime-btn, .kr-btn, nav links and the pager in
                            both themes (vendor rules set outline:0 above the
                            site ring's specificity); a mouse click on the
                            quote arrows leaves no ring (Bootstrap's native
                            one on :focus).
  check_gallery_keyboard_and_rows
                            Tab from the filters reaches a photograph once
                            past them (hidden tab stops in between); no lone
                            photograph on a row at 375 and 393 but the last
                            (rounding pushed frames onto rows of their own);
                            ?photo=<stem> opens that frame as a modal dialog.
  check_palette_paths       Ctrl+K on a post: every destination answers 200
                            (links resolved against /blog/) and Escape hands
                            focus back (it was left on the body).
  check_not_found_page      404.html at /blog/no-such-post.html: footer links
                            and posts.json answer 200 (relative paths broke
                            one folder down).
  check_data_fetched_once   Each data/*.json requested once per load on the
                            homepage, the listing and a post (the homepage
                            fetched posts.json twice).
  check_hero_holds          Under reduced motion the hero does not move in
                            12s and nothing off screen takes focus; on a
                            touch screen a tap on Pause holds (Owl's touch
                            handlers restarted autoplay).
  check_theme_toggle        The toggle flips data-theme and theme-color
                            (#faf7f2 in light, not white) and persists.
  check_phone_menu          At 390 the open menu hangs from the bar's foot:
                            the theme toggle clear of it, bar and panel one
                            colour (the panel cut through the bar's row).
  check_blog_url_state      blog.html's filters round-trip through the query
                            string, and values the corpus lacks are dropped.
  check_print               A post printed from the dark theme keeps its
                            title (the print sheet hid every <header>, the
                            opener included) and prints headings in ink.
  check_desktop_geometry    At 1440x900: first blog post above 600px, gallery
                            grid above 900px, measure at most 78 characters,
                            no overflow, header transparent over an opener.
  check_contrast            Buttons, links outside posts, eyebrows, chips,
                            footer headings and opener type clear AA in both
                            themes, on flat colour or on a photograph.
  check_live_classes        No rule is missing from style.min.css for a class
                            a live page uses (the pruner cannot see classes
                            assembled at runtime; the hero's bounceInDown
                            lost its animation that way).

Run one part with --only (pages, sweep, canvas, sketches, pins, classes),
for example `smoke_test.py --only pins` while working on one of them.

Waiting. There are no fixed sleeps. Each page waits on its own predicates
with wait_for_function, given the sleep it used to have plus MARGIN_MS, so
a healthy page moves on as soon as it is ready and a page that is not ready
in time is reported as a failure rather than checked half-built. What
remains are windows that measure behaviour over time (the live-region
count, the reduced-motion watch), which no predicate can shorten. The sweep
opens a few pages at once so they load while earlier ones are measured.
The hero pins watch twelve seconds of carousel time and spend none of it:
they run on Playwright's fake clock (page.clock), installed before the
page loads, and jump it forward.

Run locally:  .venv/Scripts/python.exe .github/scripts/smoke_test.py
CI:           see .github/workflows/site-checks.yml (smoke job)
Siblings:     check_post_template.py (every post's template) and
              perf_budget.py (bytes, layout shift, offline) share harness.py.
"""

import io
import json
import re
import sys
import time
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
import css_prune  # noqa: E402
import minify_css  # noqa: E402
import sitelib  # noqa: E402
from audit_site import EXEMPT_PAGES  # noqa: E402
from harness import (OPENER_COLOURS, ROOT, THEMES, Reporter,  # noqa: E402
                     contrast_ratio, describe_overflow,
                     element_overflow, is_own, next_frames, open_ahead,
                     own_errors, relative_luminance, serve, set_theme,
                     site_context, watch_console)

# 0 lets the OS pick a free port, so two runs (CI and a local one, or two
# people) never collide. Set a number only to reach the server by hand.
PORT = 0

# Added to the fixed sleep each wait replaced. Generous, because a wait that
# runs out is a failure now, and CI runners are slower than a laptop.
MARGIN_MS = 2000

# How long to let late requests (a lazy image, a data file) land before
# console errors are read. Running out is not a failure: map tiles and
# embeds can keep a page's network busy for as long as it is open.
IDLE_MS = 3000

# Engine demos mount from an inline script at the end of the body, so by
# DOMContentLoaded every .kr-viz either has its handle or its mount threw.
# Not the load event: that waits on third-party scripts too, and a slow
# analytics host is not a broken demo. Pages without a demo pass at once.
DEMOS_MOUNTED = ("document.readyState !== 'loading'"
                 " && [...document.querySelectorAll('.kr-viz')].every(e => e.krViz)")

# What a page used to get as a fixed sleep before its checks ran. Kept as
# the base of every page-level wait budget, the sweep's included.
PAGE_BUDGET_MS = 3500

# A reader scrolls, and content drawn on scroll (the section headings'
# scroll flourishes, lazy images, blocks that load as they come into view)
# only settles once it crosses the viewport line. Part of the CHECKS wait rather
# than done once up front, because a page still being built may not yet be
# tall enough to hold the position. Instant, since the site scrolls smoothly.
READER_SCROLL = ("(window.scrollY >= 700"
                 " || (window.scrollTo({top: 700, behavior: 'instant'}), true))")

# Top-level pages the sweep leaves out. The verification stub is not a page
# (the audit exempts it for the same reason), and offline.html is the
# service worker's no-network fallback, only ever shown with the network
# gone, with no main or footer for the overflow walk to measure.
SWEEP_SKIP = EXEMPT_PAGES | {"offline.html"}

# (theme, width, height). Dark is the default theme, so it gets both
# widths; light gets the width where layouts are tightest.
SWEEP_MODES = (("dark", 360, 800), ("dark", 1280, 900), ("light", 360, 800))

# Pages kept loading ahead of the one being measured: enough to hide load
# time, few enough that a two-core runner is not measuring a starved page.
SWEEP_AHEAD = 4

# Overflow that already has an owner and a planned fix. It is reported as
# "known" rather than failed, so the rest of the page stays guarded, and the
# suite says when an entry stops overflowing so the entry can be deleted.
# Page -> the selector the known overflow sits inside. Empty: the record
# crate on music.html fits a 360px screen since its phone spacing, and the
# canvas posts' reference DOIs wrap (ol.references, overflow-wrap:
# anywhere), so both allowances are gone and either would now fail.
KNOWN_OVERFLOW = {}

# A figure filled from a data file reads as an em dash until the data lands,
# so one still showing it after load is a fetch that failed.
PLACEHOLDERS_LEFT = ("[...document.querySelectorAll('[data-colo], [data-lit], [data-count]')]"
                     ".filter(e => e.textContent.trim() === '\\u2014')")

# Every post used to close on a hand-coded "Back to all posts" pair (a rule
# and p > a.post-cta), inside .blog-post in some posts and after it in
# others. The end band under every post routes the reader on now, and
# audit_site.py's back-link rule fails a post that copies the pair back;
# this pins it on the two layouts in the rendered page.
NO_BACK_LINK = ("no hand-coded back link",
                "!document.querySelector('main .post-cta')")

CHECKS = [
    ("index.html", [
        ("hero renders", "!!document.querySelector('.welcome-area')"),
        ("now strip has items or cleared", "document.querySelectorAll('#now-strip .kr-skel-bar').length === 0"),
        ("stats visible", "document.querySelectorAll('.home-stat-value').length >= 4"),
        ("blog cards visible", "Array.from(document.querySelectorAll('.blog-card, .single-post-area')).filter(e => getComputedStyle(e).opacity !== '0').length >= 1"),
        ("footer grid", "!!document.querySelector('.kr-footer-grid')"),
        # active.js applies an animate.css class named by data-animation
        # when the hero changes slide. The class appears in no class
        # attribute, so the CSS pruner dropped the rule that sets
        # animation-name and the headline landed with no animation for
        # months without anything failing. Assert the class still
        # resolves to a real animation.
        ("hero slide animation survives pruning",
         "(() => { const d = document.createElement('div');"
         "  d.className = 'animated bounceInDown';"
         "  document.body.appendChild(d);"
         "  const n = getComputedStyle(d).animationName; d.remove();"
         "  return n === 'bounceInDown'; })()"),
        # The carousel contract in active.js: slides off screen (and Owl's
        # loop clones) are inert, so none of their links is a tab stop, and
        # the hero's arrows are named buttons rather than divs.
        ("carousel slides off screen are inert",
         "(() => { const i = [...document.querySelectorAll('.owl-item')];"
         "  return i.length > 0 && i.every(x => x.classList.contains('active') !== x.hasAttribute('inert')); })()"),
        ("hero arrows are named buttons",
         "(() => { const b = [...document.querySelectorAll('.welcome-slides .owl-nav > *')];"
         "  return b.length === 2 && b.every(x => x.tagName === 'BUTTON' && !!x.getAttribute('aria-label')); })()"),
    ]),
    ("blog.html", [
        ("blog tiles visible", "Array.from(document.querySelectorAll('#blog-grid .single-post-area')).filter(e => getComputedStyle(e).opacity !== '0').length >= 3"),
        ("filter buttons", "document.querySelectorAll('.gallery-filter-btn').length >= 3"),
    ]),
    ("gallery.html", [
        ("gallery tiles", "document.querySelectorAll('.single_gallery_item').length >= 12"),
        ("filter buttons", "document.querySelectorAll('.gallery-filter-btn').length >= 5"),
        # The thumbnail is the lightbox link (gallery.js buildTile): one
        # tab stop and one tap per tile, the place name out of the order.
        ("each tile is one link around its thumbnail",
         "(() => { const t = [...document.querySelectorAll('#gallery-grid .single_gallery_item')];"
         "  return t.length > 0 && t.every(c => c.querySelectorAll('a.portfolio-img > img').length === 1"
         "    && [...c.querySelectorAll('a, button')].filter(e => e.tabIndex >= 0).length === 1); })()"),
    ]),
    # frodo-sam keeps its generated related-posts block just outside
    # .blog-post, which is exactly the shape that once got a second block
    # injected on top of it. Worth pinning on a post that has that layout.
    ("blog/frodo-sam-and-love.html", [
        ("exactly one related-posts block",
         "document.querySelectorAll('.related-posts').length === 1"),
        NO_BACK_LINK,
    ]),
    ("blog/rating-systems.html", [
        ("post body visible", "(() => { const p = document.querySelector('.blog-post > p'); return p && getComputedStyle(p).opacity !== '0'; })()"),
        ("exactly one related-posts block",
         "document.querySelectorAll('.related-posts').length === 1"),
        NO_BACK_LINK,
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


def all_of(exprs):
    """One JS predicate that holds when every expression in `exprs` does.

    An expression that throws counts as false here; run_assertions evaluates
    each one again afterwards and reports the error against its own name.
    """
    return " && ".join(
        f"(() => {{ try {{ return !!({e}); }} catch (_) {{ return false; }} }})()"
        for e in exprs)


def wait_until(page, predicate, budget_ms):
    """Wait until the JS expression `predicate` holds, instead of sleeping.

    `budget_ms` is the fixed sleep the wait replaced, and MARGIN_MS goes on
    top, so nothing that passed before can fail for want of time. Returns
    whether it held; the caller decides how to report it.
    """
    try:
        page.wait_for_function(f"() => {predicate}", timeout=budget_ms + MARGIN_MS)
        return True
    except PlaywrightTimeout:
        return False


def settle(page, scope, rep, predicate, budget_ms, what="ready"):
    """wait_until, with running out reported as a failure: the page was not
    ready, and checking it anyway only moves the failure somewhere less
    informative."""
    if wait_until(page, predicate, budget_ms):
        return True
    rep.check(scope, f"{what} within {(budget_ms + MARGIN_MS) / 1000:g}s", False)
    return False


def let_network_settle(page):
    """Give late requests IDLE_MS to finish before console errors are read."""
    try:
        page.wait_for_load_state("networkidle", timeout=IDLE_MS)
    except PlaywrightTimeout:
        pass


def check_converges(page, base, path, rep):
    """A demo that renders but never gets anywhere still looks fine in a
    screenshot. Widgets on the kr-viz engine expose a handle, so drive one
    deterministically and assert it actually moved: same seed twice gives
    the same readout, and 150 steps change something.

    Posts not yet on the engine are skipped rather than failed.
    """
    page.set_viewport_size({"width": 1100, "height": 900})
    page.goto(f"{base}/{path}", wait_until="domcontentloaded")
    if not settle(page, path, rep, DEMOS_MOUNTED, 700, "demos mounted"):
        return
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


def check_a11y(page, base, path, rep):
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
    page.goto(f"{base}/{path}", wait_until="domcontentloaded")
    if not settle(page, path, rep, DEMOS_MOUNTED, 1200, "a11y demos mounted"):
        return

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
        next_frames(page)
        target = page.query_selector(".kr-viz canvas.kr-interactive")
        target.focus()
        for _ in range(3):
            page.keyboard.press("ArrowRight")
        next_frames(page)
        canvas = "document.querySelector('.kr-viz canvas.kr-interactive')"
        before = page.evaluate(f"() => {canvas}.toDataURL()")
        page.keyboard.press("Enter")
        # Polled every 50ms rather than every frame: toDataURL encodes a PNG.
        try:
            page.wait_for_function(f"before => {canvas}.toDataURL() !== before",
                                   arg=before, polling=50,
                                   timeout=500 + MARGIN_MS)
            acted = True
        except PlaywrightTimeout:
            acted = False
        report("Enter acts on the canvas", acted)

    # --- the live region does not flood ---------------------------------
    # Posts not on the engine have no live region to measure; a post that is
    # on the engine and has lost one is a regression, so the two are separated.
    on_engine = page.evaluate(
        "() => [...document.querySelectorAll('.kr-viz')].some(e => e.krViz)")
    if not on_engine:
        rep.skip(path, "a11y live region", "post is not on the engine")
        return
    # Instant, because the page scrolls smoothly by default and a smooth
    # scroll is still travelling when the next line runs.
    page.evaluate("() => {const r = document.querySelector('.kr-viz');"
                  "       if (r) r.scrollIntoView({block: 'center', behavior: 'instant'});}")
    # The engine pauses a demo its IntersectionObserver reports off screen;
    # that report must arrive before run(), or it lands after and stops it.
    next_frames(page)
    page.evaluate("() => document.querySelectorAll('.kr-viz')"
                  ".forEach(r => r.krViz && r.krViz.run())")
    # A deliberate window, not a wait: count announcements over 3s.
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


def check_sketches(page, base, rep):
    """Every registered hover sketch draws: instantiate each at card size
    through the engine's own factory, step it 120 frames and require that
    it threw nothing and painted something. One sketch once sat blank for
    most of its cycle and only an eye caught it; this is the check that
    would have."""
    scope = "js/covers.js sketches"
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto(f"{base}/blog.html", wait_until="domcontentloaded")
    page.wait_for_function("() => typeof krLoadLiveCovers === 'function'", timeout=15000)
    page.evaluate("() => krLoadLiveCovers()")
    page.wait_for_function("() => window.krLiveCovers && window.krLiveCovers.kinds.length > 60", timeout=15000)
    result = page.evaluate("""() => {
        const api = window.krLiveCovers, out = { count: 0, bad: [] };
        const args = { 'gallery:globe': { lat: 56.1, lng: -3.9 } };
        for (const kind of api.kinds) {
            out.count++;
            const c = document.createElement('canvas'); c.width = 360; c.height = 220;
            const ctx = c.getContext('2d');
            try {
                const s = api.make(kind, 360, 220, 7, args[kind] || null);
                let painted = 0;
                for (let i = 0; i < 120; i++) {
                    s.step();
                    if (i % 30 === 29) {
                        ctx.clearRect(0, 0, 360, 220); s.draw(ctx);
                        const d = ctx.getImageData(0, 0, 360, 220).data; let n = 0;
                        for (let k = 3; k < d.length; k += 16) if (d[k] > 0) n++;
                        painted = Math.max(painted, n / (d.length / 16));
                    }
                }
                if (painted < 0.001) out.bad.push(kind + ' (blank)');   // a lone glyph or a pin is enough; blank is blank
            } catch (e) { out.bad.push(kind + ' (' + (e && e.message) + ')'); }
        }
        return out;
    }""")
    rep.check(scope, f"all {result['count']} sketches run and draw",
              not result["bad"], ", ".join(result["bad"][:6]))


def check_reduced_motion(browser, base, path, rep):
    """Under prefers-reduced-motion the demos must mount paused and stay put,
    showing the first frame rather than a blank box."""
    page = browser.new_page(viewport={"width": 1280, "height": 900},
                            reduced_motion="reduce")
    page.goto(f"{base}/{path}", wait_until="domcontentloaded")
    settle(page, path, rep, DEMOS_MOUNTED, 1400, "reduced-motion demos mounted")
    first = page.evaluate("() => {const r = document.querySelector('.kr-viz');"
                          "return r && r.krViz ? r.krViz.read().iteration : -1;}")
    # A deliberate window, not a wait: a running demo steps dozens of times
    # in this long, and a paused one not at all.
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


def overflow(page, known=None):
    """(unexpected, known) boxes running past the right edge; see
    harness.element_overflow for how they are found."""
    found = element_overflow(page, known=known)
    return ([f for f in found if not f["known"]],
            [f for f in found if f["known"]])


def check_overflow(page, scope, rep, known=None):
    """Nothing in main or footer runs past the right edge.

    Offenders inside `known` are listed as known instead of failing. Returns
    how many there were, so a caller can tell when an allowance has become
    unnecessary.
    """
    new, old = overflow(page, known)
    rep.check(scope, "no element overflow", not new, describe_overflow(new))
    if old:
        rep.known(scope, f"overflow inside {known}", describe_overflow(old))
    return len(old)


def check_mobile(page, base, path, console_errors, rep, tokens=None):
    """Interactive demos must scale to phone width: nothing runs off the
    screen, no console errors, and every visible canvas both fits the
    viewport and keeps a usable height (a squashed or zero-height canvas
    renders 'successfully' and is still broken).

    Overflow is measured per element (harness.element_overflow); the page's
    own scrollWidth cannot show it, because html and body clip overflow-x.
    `tokens` (a LiveTokens) collects the page's classes on the way past.
    """
    console_errors.clear()
    scope = f"{path} @360px"
    page.set_viewport_size({"width": 360, "height": 780})
    try:
        page.goto(f"{base}/{path}", wait_until="domcontentloaded", timeout=30000)
    except Exception as e:  # noqa: BLE001
        rep.check(scope, "navigation", False, e)
        return
    settle(page, scope, rep, DEMOS_MOUNTED, PAGE_BUDGET_MS, "demos mounted")
    let_network_settle(page)
    check_overflow(page, scope, rep)
    run_assertions(page, scope, [
        ("canvases fit viewport",
         "Array.from(document.querySelectorAll('canvas'))"
         ".every(c => c.getBoundingClientRect().width <= 362)"),
        ("canvases keep usable height",
         "Array.from(document.querySelectorAll('canvas'))"
         ".filter(c => c.getBoundingClientRect().width > 0)"
         ".every(c => c.getBoundingClientRect().height >= 100)"),
    ], rep)
    rep.console_errors(scope, console_errors)
    if tokens:
        tokens.add(page, scope)


def sweep_pages():
    """Every tracked top-level page, read from git as the audit and the CSS
    pruner do, so a page still being written is not swept before it ships."""
    return [p.name for p in sitelib.tracked("*.html")
            if p.parent == ROOT and p.name not in SWEEP_SKIP]


def sweep_one(page, scope, sink, rep, known=None):
    """One page in one theme at one width: it fits, its data-filled figures
    are filled, and nothing of ours errored. One line when all three hold,
    a line per problem when not."""
    # Waiting on the placeholders is also the page's readiness: the figures
    # are the last thing a data page fills in. A timeout shows up below as
    # the placeholders still being there.
    wait_until(page, f"document.readyState !== 'loading' && !{PLACEHOLDERS_LEFT}.length",
               PAGE_BUDGET_MS)
    let_network_settle(page)
    new, old = overflow(page, known)
    left = page.evaluate(f"() => {PLACEHOLDERS_LEFT}.map(e => e.outerHTML.slice(0, 60))")
    if not (new or left or own_errors(sink)):
        rep.check(scope, "fits, figures filled, no errors", True)
    else:
        if new:
            rep.check(scope, "no element overflow", False, describe_overflow(new))
        if left:
            rep.check(scope, "data figures filled", False,
                      f"{len(left)} still a placeholder: {left[0]}")
        rep.console_errors(scope, sink)
    if old:
        rep.known(scope, f"overflow inside {known}", describe_overflow(old))
    return len(old)


def check_sweep(browser, base, rep, tokens=None):
    """Every top-level page in every SWEEP_MODES pass; `tokens` (a
    LiveTokens) collects each page's classes on the way past."""
    pages = sweep_pages()
    known_seen = {path: 0 for path in KNOWN_OVERFLOW}
    for theme, width, height in SWEEP_MODES:
        context = browser.new_context(viewport={"width": width, "height": height})
        set_theme(context, theme)
        for path, page, sink in open_ahead(context, base, pages, SWEEP_AHEAD):
            known = KNOWN_OVERFLOW.get(path)
            scope = f"{path} {theme}@{width}"
            count = sweep_one(page, scope, sink, rep, known)
            if known:
                known_seen[path] += count
            if tokens:
                tokens.add(page, scope)
            page.close()
        context.close()
    for path, count in known_seen.items():
        if not count and path in pages:
            rep.note(f"note {path} :: no overflow inside {KNOWN_OVERFLOW[path]} "
                     f"any more; delete its KNOWN_OVERFLOW entry")


# ---------------------------------------------------------------------------
# Regression pins
# ---------------------------------------------------------------------------
# One function per bug this site has shipped and fixed; the module
# docstring lists them with the bug each one pins. They run after the
# page checks and the sweep, each in a context of its own (site_context):
# third parties aborted, since a slow analytics host or an embed is not
# what any of them measures, and the service worker blocked, so a page is
# always the page as served rather than whatever an earlier navigation
# left in a cache (perf_budget.py owns the offline behaviour).
#
# Adding a pin: write a check_* function that takes (browser, base, rep),
# name the regression in its docstring and in the module docstring, call it
# from run_pins(), and prove it bites: break the fix in a copy of the page
# (a Playwright route that rewrites one response is enough) and watch the
# pin fail before trusting it.

# The post the pins read: it has an opener, a contents rail, references
# with sidenotes, and code-free prose, so it exercises most of the template.
PIN_POST = "blog/rating-systems.html"

# A second long read for the measure check, with a different layout
# (paintings in figures between the paragraphs).
PIN_POST_2 = "blog/frodo-sam-and-love.html"

# theme-color follows the theme so the phone's browser chrome matches the
# page (theme.js). Light is the warm off-white surface, not #fff.
THEME_COLOR_LIGHT = "#faf7f2"

# Elements that must show the site's keyboard ring after a real Tab
# press, each with the pages to find one on (the first page that has a
# visible match is used). Every one of these once had no ring at all:
# Bootstrap's .btn:focus and classy-nav's link rule set outline:0 at a
# specificity the element-level ring could not beat (style.css, "Focus
# ring, restated last"). .alime-btn survives as an alias of .kr-btn, so
# it is looked for where old markup still carries it.
FOCUS_TARGETS = (
    ("Bootstrap .btn", ("blog.html",), "button.btn, a.btn"),
    (".gallery-filter-btn", ("gallery.html",), ".gallery-filter-btn"),
    # The template's button survives as an alias of .kr-btn (style.css §03)
    # on one post only; every page moved to .kr-btn.
    (".alime-btn", ("blog/50-blogs-an-infographic.html",), ".alime-btn"),
    (".kr-btn", ("about.html", "music.html", "colophon.html", "404.html"), ".kr-btn"),
    ("nav link", ("blog.html",), "#nav > li > a[href]"),
    ("pagination", ("blog.html",), "#blog-pagination a[href], #blog-pagination button"),
)

# Clicked with a mouse, this button must not keep a ring: Bootstrap's
# reboot gives a focused button the browser's own outline, and the site's
# ring waits for :focus-visible (style.css, button:focus:not(:focus-visible)).
MOUSE_NO_RING = ("index.html", ".kr-home-quote__nav")

# How many Tab presses past the filter buttons it may take to reach the
# first photograph. The gallery's tiles are one link each and the tile
# captions are out of the Tab order (gallery.js buildTile); a place link
# or a hidden control between the two once made keyboard users walk
# through dozens of invisible stops first.
GALLERY_TAB_SLACK = 2

# Phone widths at which the justified gallery must never leave one photo
# alone on a row, except the last. packRows closes a row only once it has
# two frames; a width rounding error that pushed the second frame down
# gave phones a column of lone frames.
GALLERY_PHONE_WIDTHS = (375, 393)

# Fixed lengths for the hero checks: longer than the carousel's
# autoplayTimeout (10s, js/default-assets/active.js), so a rotation the
# pause failed to stop has had time to happen. Run on Playwright's fake
# clock, so they cost nothing in real time.
HERO_WATCH_MS = 12000

# Geometry at a desktop size, the budgets named in the design review:
# the first post on the blog above 600px, the gallery grid starting on
# the first screen, a reading measure of at most 78 characters a line.
DESKTOP = (1440, 900)
BLOG_FIRST_CARD_MAX = 600
GALLERY_GRID_TOP_MAX = 900
MEASURE_MAX_CPL = 78

# Named elements whose text must clear WCAG AA in both themes: 4.5:1, or
# 3:1 for large text (24px, or 18.66px bold). The pages are the templates
# where each kind appears.
CONTRAST_PAGES = ("index.html", "blog.html", "gallery.html", "literature.html", PIN_POST)
PROSE_LINKS = (":where(main :is(p, dd, figcaption, :is(ul, ol):not([class]) > li))"
               " a:not([class]):not(.blog-post *)")
CONTRAST_TARGETS = (
    ("button", ".kr-btn, .alime-btn, .btn.gallery-filter-btn"),
    ("link", PROSE_LINKS + ", .kr-accent-link"),
    ("eyebrow", ".section-eyebrow"),
    ("chip", ".post-catagory, .blog-tag, .kr-series-chip"),
    ("footer heading", ".kr-footer-heading"),
    ("opener", ".kr-opener__title, .kr-opener__kicker, .kr-opener__standfirst,"
               " .page-title, .breadcrumb-item a, .breadcrumb-item.active"),
)
# Per kind and page, so a page with forty chips does not take all day.
CONTRAST_SAMPLE = 5
# Containers that paint a photograph beneath their text from a sibling
# layer or an <img>, which an ancestor walk cannot see: the post and page
# openers, the hero, the photo bands, the overlay post cards. Text inside
# one of these without an opaque colour of its own is judged on pixels.
PHOTO_GROUNDS = (".kr-opener, .breadcrumb-area, .welcome-area, .kr-photo-band,"
                 " .kr-blog-promo, .single-post-area, .bg-overlay")
# On a photograph, the ground is the lightest 10% of the pixels under the
# letters for light text (the darkest 10% for dark text): the worst of
# the photo that the letters actually cross, not its average.
GROUND_PERCENTILE = 0.9


def open_page(context, base, path, rep, scope, ready="true", budget_ms=PAGE_BUDGET_MS):
    """New page at `path`, waited on `ready` (a JS expression). Returns
    (page, sink), or (None, sink) when it never got ready, which has
    already been reported as a failure against `scope`."""
    page = context.new_page()
    sink = []
    watch_console(page, sink, base)
    try:
        page.goto(f"{base}/{path}", wait_until="domcontentloaded", timeout=30000)
    except Exception as e:  # noqa: BLE001 - reported, the suite goes on
        rep.check(scope, "navigation", False, e)
        page.close()
        return None, sink
    if not settle(page, scope, rep, f"document.readyState !== 'loading' && ({ready})",
                  budget_ms):
        page.close()
        return None, sink
    return page, sink


def check_opener_colours(browser, base, rep):
    """The opener's title is white and its kicker gold in BOTH themes, and
    in the dark theme the share rail's buttons and the phone share sheet
    are not white. Pins: the dark theme's paragraph default repainting the
    opener's type grey; the share UI reading --card-bg, which nothing
    defines, and falling back to a white disc on the dark page."""
    for theme in THEMES:
        context = site_context(browser, base, theme, DESKTOP)
        scope = f"{PIN_POST} {theme}"
        page, sink = open_page(context, base, PIN_POST, rep, scope,
                               "!!document.querySelector('.kr-opener__title')")
        if page:
            got = page.evaluate("""() => {
                const c = s => { const e = document.querySelector(s); return e && getComputedStyle(e).color; };
                return {title: c('.kr-opener .kr-opener__title'), kicker: c('.kr-opener .kr-opener__kicker')};
            }""")
            rep.check(scope, "opener title #fff and kicker #ffe89e", got == OPENER_COLOURS, got)
            if theme == "dark":
                # Built by renderFloatingBlogShare at every width; the rail
                # shows from 992px and the sheet under it, but a computed
                # background is there to read whichever is on screen.
                bgs = page.evaluate("""() => [...document.querySelectorAll(
                        '.kr-share-rail .kr-share-btn, .kr-share-modal')]
                    .map(e => getComputedStyle(e).backgroundColor)""")
                white = [b for b in bgs if b in ("rgb(255, 255, 255)", "rgba(255, 255, 255, 1)")]
                rep.check(scope, "share rail and sheet are not white", bgs and not white,
                          f"{len(bgs)} backgrounds, {len(white)} white" if bgs else "no share UI")
            rep.console_errors(scope, sink)
            page.close()
        context.close()


def check_focus_rings(browser, base, rep):
    """A real Tab press gives every kind of control in FOCUS_TARGETS a
    visible outline, in both themes; a mouse click on the quote arrows
    leaves none. Focus is placed on the control, moved back one stop with
    Shift+Tab and returned with Tab, so the ring is the one :focus-visible
    draws for a keyboard, not the programmatic-focus case."""
    for theme in THEMES:
        context = site_context(browser, base, theme)
        pages = {}

        def page_for(path):
            if path not in pages:
                pages[path] = open_page(context, base, path, rep, f"{path} {theme}",
                                        "document.readyState === 'complete'")[0]
            return pages[path]

        for label, candidates, selector in FOCUS_TARGETS:
            scope = f"focus {theme}"
            found = None
            for path in candidates:
                page = page_for(path)
                if page and page.evaluate(FIND_FOCUSABLE, selector) >= 0:
                    found = (path, page)
                    break
            if not found:
                rep.skip(scope, f"{label} ring", f"no visible {selector} on {', '.join(candidates)}")
                continue
            path, page = found
            page.evaluate(FIND_FOCUSABLE_AND_FOCUS, selector)
            page.keyboard.press("Shift+Tab")
            page.keyboard.press("Tab")
            got = page.evaluate(FOCUS_RING)
            rep.check(scope, f"{label} ring on Tab ({path})",
                      got["target"] and got["visible"] and got["ring"], got["detail"])

        path, selector = MOUSE_NO_RING
        page = page_for(path)
        if page and page.evaluate(FIND_FOCUSABLE, selector) >= 0:
            page.click(f"{selector} >> visible=true", timeout=5000)
            got = page.evaluate("""sel => { const e = document.activeElement, cs = getComputedStyle(e);
                return {on: e.matches(sel), outline: cs.outlineStyle + ' ' + cs.outlineWidth}; }""", selector)
            rep.check(f"focus {theme}", f"no ring after a mouse click on {selector} ({path})",
                      got["on"] and got["outline"].startswith("none"), got)
        for page in pages.values():
            if page:
                page.close()
        context.close()


# The index of the first visible, focusable match of a selector, or -1.
# A disabled button keeps tabIndex 0 but cannot take focus (the pager's
# Previous on page one), so it is passed over.
FIND_FOCUSABLE = """sel => [...document.querySelectorAll(sel)].findIndex(e => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && e.tabIndex >= 0 && !e.matches(':disabled')
        && !e.closest('[inert], [hidden]') && getComputedStyle(e).visibility !== 'hidden'; })"""

FIND_FOCUSABLE_AND_FOCUS = """sel => {
    const i = (""" + FIND_FOCUSABLE + """)(sel);
    const e = document.querySelectorAll(sel)[i];
    e.setAttribute('data-kr-focus-target', '');
    e.scrollIntoView({block: 'center', behavior: 'instant'});
    e.focus({preventScroll: true});
}"""

FOCUS_RING = """() => {
    const want = document.querySelector('[data-kr-focus-target]');
    want.removeAttribute('data-kr-focus-target');
    const e = document.activeElement, cs = getComputedStyle(e);
    const width = parseFloat(cs.outlineWidth) || 0;
    const colour = cs.outlineColor.replace(/\\s/g, '');
    return {target: e === want, visible: e.matches(':focus-visible'),
            ring: cs.outlineStyle !== 'none' && width >= 1
                  && !/rgba\\([^)]*,0\\)$/.test(colour) && colour !== 'transparent',
            detail: e.tagName.toLowerCase() + '.' + [...e.classList].join('.')
                    + ' outline ' + cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor};
}"""


def check_gallery_keyboard_and_rows(browser, base, rep):
    """Three gallery regressions: Tab from the filter buttons reaches the
    first photograph within the filters plus GALLERY_TAB_SLACK presses; at
    phone widths no row holds a single photograph except the last; and
    gallery.html?photo=<stem> opens that frame in the lightbox as a named
    modal dialog, paging through batches to find it: the deep link the
    photo strip on every other page uses."""
    context = site_context(browser, base)
    scope = "gallery.html"
    page, sink = open_page(context, base, "gallery.html", rep, scope,
                           "document.querySelectorAll('#gallery-grid a.portfolio-img').length >= 12"
                           " && document.querySelectorAll('#gallery-filters .gallery-filter-btn').length >= 3")
    if page:
        filters = page.evaluate("[...document.querySelectorAll('#gallery-filters button, #gallery-filters a[href]')]"
                                ".filter(e => e.tabIndex >= 0 && e.getBoundingClientRect().width > 0).length")
        page.focus("#gallery-filters .gallery-filter-btn")
        presses, stops = 0, []
        for presses in range(1, filters + GALLERY_TAB_SLACK + 1):
            page.keyboard.press("Tab")
            where = page.evaluate("(() => { const e = document.activeElement; return [e.matches('#gallery-grid a'),"
                                  " e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '.' + [...e.classList].join('.')]; })()")
            stops.append(where[1])
            if where[0]:
                break
        else:
            presses = -1
        rep.check(scope, f"Tab from the filters reaches a photograph within {filters + GALLERY_TAB_SLACK}",
                  presses > 0, f"stops: {', '.join(stops[-4:])}")
        rep.console_errors(scope, sink)
        page.close()
    context.close()

    for width in GALLERY_PHONE_WIDTHS:
        context = site_context(browser, base, size=(width, 800))
        scope = f"gallery.html @{width}"
        page, _ = open_page(context, base, "gallery.html", rep, scope,
                            "document.querySelectorAll('#gallery-grid .single_gallery_item').length >= 12")
        if page:
            rows = page.evaluate("""() => {
                const rows = [];
                for (const t of document.querySelectorAll('#gallery-grid .single_gallery_item')) {
                    const top = t.getBoundingClientRect().top;
                    const row = rows.find(r => Math.abs(r.top - top) < 2);
                    if (row) row.n++; else rows.push({top, n: 1});
                }
                return rows.sort((a, b) => a.top - b.top).map(r => r.n);
            }""")
            lone = [i + 1 for i, n in enumerate(rows[:-1]) if n < 2]
            rep.check(scope, "no lone photograph on a row but the last", rows and not lone,
                      f"rows {lone[:5]} of {len(rows)} hold one frame" if lone else "no rows")
            page.close()
        context.close()

    # A frame past the first batch, so the deep link has to page for it.
    files = json.loads((ROOT / "data" / "photography-files.json").read_text(encoding="utf-8"))
    stem = Path(files[min(59, len(files) - 1)]).stem
    context = site_context(browser, base)
    scope = f"gallery.html?photo={stem}"
    page, sink = open_page(context, base, f"gallery.html?photo={stem}", rep, scope,
                           "!!document.querySelector('.mfp-wrap[role=dialog][aria-modal=true]')",
                           PAGE_BUDGET_MS + 1500)
    if page:
        got = page.evaluate("""() => ({label: document.querySelector('.mfp-wrap').getAttribute('aria-label'),
                                       search: location.search})""")
        rep.check(scope, "opens the frame as a named modal dialog",
                  bool(got["label"]) and f"photo={stem}" in got["search"], got)
        page.close()
    context.close()


def check_palette_paths(browser, base, rep):
    """On a post (one directory down), Ctrl+K opens the command palette,
    every destination it can offer answers 200, and Escape hands focus
    back to the link that had it. Pins: palette links resolved against
    the post's own folder (/blog/index.html), and focus left on the page
    body after closing, which drops a keyboard user at the top."""
    context = site_context(browser, base)
    scope = f"palette on {PIN_POST}"
    page, sink = open_page(context, base, PIN_POST, rep, scope,
                           "typeof window.krPalette === 'object' && !!document.querySelector('.blog-post a[href]')")
    if page:
        page.evaluate("""() => { const a = [...document.querySelectorAll('.blog-post a[href]')]
                .find(e => e.getBoundingClientRect().width > 0);
            a.setAttribute('data-kr-before', ''); a.focus(); }""")
        page.keyboard.press("Control+k")
        opened = wait_until(page, "window.krPalette.isOpen()", 1000)
        rep.check(scope, "Ctrl+K opens it", opened)
        if opened:
            hrefs = page.evaluate(PALETTE_DESTINATIONS)
            bad = page.evaluate(STATUS_OF_URLS, hrefs)
            rep.check(scope, f"all {len(hrefs)} destinations answer 200", hrefs and not bad,
                      ", ".join(bad[:4]))
            page.keyboard.press("Escape")
            back = page.evaluate("!window.krPalette.isOpen() && document.activeElement"
                                 " && document.activeElement.hasAttribute('data-kr-before')")
            rep.check(scope, "Escape closes it and restores focus", back)
        rep.console_errors(scope, sink)
        page.close()
    context.close()


# Every destination the palette can show: the pages it lists before a
# query, then the results for each series, photo subject and place and
# a few post titles, resolved against the page. krPalette.search() is its
# documented test surface.
PALETTE_DESTINATIONS = """async () => {
    await window.krPalette.ready();
    const out = new Set([...document.querySelectorAll('.kr-palette-item')].map(a => a.href));
    const posts = await loadBlogPosts();
    const places = await krFetchJson('data/photo-locations.json').catch(() => ({regions: []}));
    const queries = [
        ...new Set(posts.flatMap(p => postSeriesList(p).map(s => s.name))),
        ...KR_PHOTO_CATEGORIES.map(c => c.label),
        ...(places.regions || []).slice(0, 5).map(r => r.name),
        ...posts.slice(0, 3).map(p => p.title),
    ];
    for (const q of queries)
        for (const r of window.krPalette.search(q)) out.add(new URL(r.href, location.href).href);
    return [...out];
}"""

# The URLs among `urls` that do not answer 200, each with its status.
STATUS_OF_URLS = """async urls => {
    const bad = [];
    await Promise.all([...new Set(urls.map(u => u.split('#')[0]))].map(async u => {
        try { const r = await fetch(u, {method: 'HEAD', cache: 'no-store'});
              if (r.status !== 200) bad.push(r.status + ' ' + u); }
        catch (e) { bad.push('failed ' + u); }
    }));
    return bad;
}"""


def check_not_found_page(browser, base, rep):
    """404.html, served where readers meet it: at a missing address one
    folder down, as GitHub Pages does (harness.serve does the same). Its
    footer links answer 200, posts.json loads, and none of its own
    requests fails. Pins: the page's relative paths resolving against the
    missed URL (/blog/css/..., /blog/data/posts.json), which is what
    <html data-kr-root="/"> is for."""
    context = site_context(browser, base)
    path = "blog/no-such-post.html"
    scope = f"404 at /{path}"
    data = []
    page = context.new_page()
    sink = []
    watch_console(page, sink, base)
    page.on("response", lambda r: data.append((r.status, r.url)) if "/data/posts.json" in r.url else None)
    response = page.goto(f"{base}/{path}", wait_until="domcontentloaded")
    rep.check(scope, "answers 404 with the site's page",
              response.status == 404 and page.evaluate("!!document.documentElement.dataset.krRoot"),
              response.status)
    if settle(page, scope, rep, "document.querySelectorAll('.kr-footer a[href]').length >= 5", PAGE_BUDGET_MS):
        let_network_settle(page)
        links = page.evaluate("[...document.querySelectorAll('.kr-footer a[href]')].map(a => a.href)")
        own = [u for u in links if is_own(u, base)]
        bad = page.evaluate(STATUS_OF_URLS, own)
        rep.check(scope, f"all {len(own)} footer links answer 200", own and not bad, ", ".join(bad[:4]))
        rep.check(scope, "posts.json loads", bool(data) and all(s == 200 for s, _u in data), data)
    # The page's own address is the one 404 that is meant to happen.
    rep.console_errors(scope, [e for e in sink if not e.endswith(f"/{path}")])
    page.close()
    context.close()


def check_data_fetched_once(browser, base, rep):
    """No data file is requested twice in one page load. Pins: the
    homepage fetching posts.json from an inline script and again through
    loadBlogPosts, and the Bluesky feed twice; every reader now goes
    through krFetchJson, which shares one request per URL."""
    context = site_context(browser, base)
    for path in ("index.html", "blog.html", PIN_POST):
        counts = {}

        def count(request, counts=counts):
            url = request.url.split("?")[0]
            if "/data/" in url and url.endswith(".json"):
                counts[url] = counts.get(url, 0) + 1

        page = context.new_page()
        page.on("request", count)
        try:
            page.goto(f"{base}/{path}", wait_until="load", timeout=30000)
        except Exception as e:  # noqa: BLE001
            rep.check(path, "navigation", False, e)
            page.close()
            continue
        let_network_settle(page)
        twice = {Path(u).name: n for u, n in counts.items() if n > 1}
        rep.check(path, f"each of {len(counts)} data files fetched once", counts and not twice, twice)
        page.close()
    context.close()


# The hero's position and its pause button's label.
HERO_STATE = """() => {
    const core = window.jQuery && jQuery('.welcome-slides').data('owl.carousel');
    const btn = document.querySelector('.welcome-area .carousel-pause-btn');
    return {at: core ? core.current() : null, label: btn && btn.getAttribute('aria-label')};
}"""
HERO_READY = ("!!document.querySelector('.welcome-slides.owl-loaded')"
              " && !!document.querySelector('.welcome-area .carousel-pause-btn')")

# Elements inside slides off screen that can still take focus. Tried for
# real (focus() and see whether it stuck) rather than inferred from inert
# or tabindex, which is the mechanism under test.
FOCUSABLE_OFF_SCREEN = """() => {
    const found = [];
    for (const el of document.querySelectorAll('.welcome-slides .owl-item:not(.active) *')) {
        if (!el.matches('a[href], button, input, select, textarea, summary, [tabindex]')) continue;
        el.focus({preventScroll: true});
        if (document.activeElement === el) { found.push(el.tagName.toLowerCase()); el.blur(); }
    }
    return found;
}"""


def check_hero_holds(browser, base, rep):
    """The homepage slideshow stays put when it has been told to.

    Under prefers-reduced-motion it starts paused and does not move in
    HERO_WATCH_MS, and nothing in a slide off screen can take focus. On a
    touch screen, a tap on Pause holds through a touch on the slide and a
    tap elsewhere on the page. Pins: Owl restarting autoplay from its
    touch and mouse handlers (touchend without asking whether it was
    rotating), which made the pause a suggestion on phones, and the
    reduced-motion start that relied on autoplay:false alone.

    Both run on Playwright's fake clock, installed before the page loads
    so Owl's timer is one of its timers: fast_forward() then fires every
    timer due in the window at once, and twelve seconds cost nothing.
    """
    context = site_context(browser, base, reduced_motion="reduce")
    scope = "index.html reduced motion"
    page = context.new_page()
    page.clock.install()
    page.goto(f"{base}/index.html", wait_until="domcontentloaded")
    if settle(page, scope, rep, HERO_READY, PAGE_BUDGET_MS):
        before = page.evaluate(HERO_STATE)
        page.clock.fast_forward(HERO_WATCH_MS)
        after = page.evaluate(HERO_STATE)
        rep.check(scope, f"hero does not advance in {HERO_WATCH_MS // 1000}s",
                  before["at"] is not None and before["at"] == after["at"], f"{before} -> {after}")
        stray = page.evaluate(FOCUSABLE_OFF_SCREEN)
        rep.check(scope, "nothing in a slide off screen takes focus", not stray, stray[:5])
    page.close()
    context.close()

    context = site_context(browser, base, size=(390, 800), has_touch=True, is_mobile=True)
    scope = "index.html touch"
    page = context.new_page()
    page.clock.install()
    page.goto(f"{base}/index.html", wait_until="domcontentloaded")
    if settle(page, scope, rep, HERO_READY, PAGE_BUDGET_MS):
        page.tap(".welcome-area .carousel-pause-btn")
        before = page.evaluate(HERO_STATE)
        # A touch on the slide (Owl's touchstart and touchend handlers,
        # plus the mouseover a tap emulates), then a tap on plain page
        # content outside the hero (the emulated mouseleave).
        slide = page.evaluate("(() => { const r = document.querySelector('.welcome-slides')"
                              ".getBoundingClientRect(); return [r.left + 20, r.top + r.height * 0.85]; })()")
        page.touchscreen.tap(*slide)
        page.evaluate("window.scrollBy(0, 500)")
        outside = page.evaluate(PLAIN_POINT)
        if outside:
            page.touchscreen.tap(*outside)
        page.clock.fast_forward(HERO_WATCH_MS)
        after = page.evaluate(HERO_STATE)
        rep.check(scope, "a tap on Pause holds the hero",
                  bool(outside) and before["label"] == after["label"] and before["at"] == after["at"]
                  and (before["label"] or "").startswith("Play"), f"{before} -> {after}")
    page.close()
    context.close()


# A point on plain page content outside the hero, for a tap that should
# do nothing: no link, control or anything with a handler of its own.
PLAIN_POINT = """() => {
    for (let y = innerHeight - 40; y > 40; y -= 20)
        for (let x = 30; x < innerWidth - 30; x += 40) {
            const el = document.elementFromPoint(x, y);
            if (el && !el.closest('.welcome-area, header, a, button, input, select, textarea,'
                                  + ' label, summary, [tabindex], [role=button]')) return [x, y];
        }
    return null;
}"""


def check_theme_toggle(browser, base, rep):
    """The toggle flips data-theme both ways and keeps <meta
    name=theme-color> in step (THEME_COLOR_LIGHT in light, the page's own
    dark value back again), and the choice survives a reload. Pins: the
    light theme-color left at #fff when the light surface became warm,
    and a toggle whose label and meta fell out of step with the page."""
    context = site_context(browser, base, theme=None)
    scope = "theme toggle"
    page, sink = open_page(context, base, "index.html", rep, scope,
                           "!!document.getElementById('theme-toggle')")
    if page:
        state = "() => [document.documentElement.dataset.theme, document.querySelector('meta[name=theme-color]').content]"
        start = page.evaluate(state)
        page.click("#theme-toggle")
        flipped = wait_until(page, "document.documentElement.dataset.theme === 'light'", 1500)
        light = page.evaluate(state)
        rep.check(scope, f"dark to light, theme-color {THEME_COLOR_LIGHT}",
                  start[0] == "dark" and flipped and light[1].lower() == THEME_COLOR_LIGHT, f"{start} -> {light}")
        page.reload(wait_until="domcontentloaded")
        rep.check(scope, "the choice survives a reload",
                  page.evaluate("document.documentElement.dataset.theme") == "light")
        wait_until(page, "!!document.getElementById('theme-toggle')", 1000)
        page.click("#theme-toggle")
        back = wait_until(page, "document.documentElement.dataset.theme === 'dark'", 1500)
        dark = page.evaluate(state)
        rep.check(scope, "light to dark, theme-color back", back and dark[1] == start[1], dark)
        rep.console_errors(scope, sink)
        page.close()
    context.close()


# The open phone menu, measured once its slide in has ended: the panel's
# box, the bar's, the theme toggle's, and the colours of the bar's surface
# and the panel's.
PHONE_MENU_FACTS = """() => {
    const box = el => { const r = el.getBoundingClientRect();
                        return {top: r.top, bottom: r.bottom, left: r.left, right: r.right}; };
    const panel = document.querySelector('.classy-menu');
    const bar = document.querySelector('.main-header-area');
    return {panel: box(panel), bar: box(bar),
            toggle: box(document.getElementById('theme-toggle')),
            panelColour: getComputedStyle(panel).backgroundColor,
            barColour: getComputedStyle(bar, '::after').backgroundColor};
}"""


def check_phone_menu(browser, base, rep):
    """At 390px the open menu hangs from the bar's foot, so the bar's row
    (wordmark, theme toggle, menu button) is one surface in the menu's own
    colour. Pins: the panel slid in from the top of the screen and cut
    through the bar's row, leaving the theme toggle half on the panel and
    half on the bar, with the panel's shadow across the bar."""
    for theme in THEMES:
        context = site_context(browser, base, theme, (390, 844), reduced_motion="reduce")
        scope = f"phone menu ({theme})"
        page, sink = open_page(context, base, "about.html", rep, scope,
                               "!!document.querySelector('.classy-navbar-toggler')")
        if page:
            page.click(".classy-navbar-toggler")
            wait_until(page, "(() => { const m = document.querySelector('.classy-menu.menu-on');"
                             " return !!m && m.getBoundingClientRect().left >= 0; })()", 1000)
            facts = page.evaluate(PHONE_MENU_FACTS)
            panel, bar, toggle = facts["panel"], facts["bar"], facts["toggle"]
            rep.check(scope, "the panel starts at the bar's foot",
                      abs(panel["top"] - bar["bottom"]) <= 1, (panel["top"], bar["bottom"]))
            overlaps = (toggle["left"] < panel["right"] and toggle["right"] > panel["left"]
                        and toggle["top"] < panel["bottom"] and toggle["bottom"] > panel["top"])
            rep.check(scope, "the theme toggle is clear of the panel", not overlaps, (toggle, panel))
            rep.check(scope, "bar and panel are one colour",
                      facts["barColour"] == facts["panelColour"],
                      (facts["barColour"], facts["panelColour"]))
            rep.console_errors(scope, sink)
            page.close()
        context.close()


# (query string, what the address bar must say after the first render).
# The listing validates every key against the corpus and writes back only
# what it kept (js/blog.js, VALIDATION). Length keys are short, medium and
# long; 'quick' is not one ("Quick read" is the short button's label).
BLOG_URLS = (
    ("tag=books&len=long&sort=title", {"tag": "books", "len": "long", "sort": "title", "dir": "asc"}),
    ("tag=books&len=quick&sort=title", {"tag": "books", "sort": "title", "dir": "asc"}),
    ("tag=nonsense&len=forever&only=everything&in=nowhere&series=Nope&sort=bogus&dir=sideways", {}),
)

# The listing has rendered: cards, or its "no posts" line. The grid ships
# empty (the no-script list sits outside it), so anything in it was drawn.
LISTING_DRAWN = "!!document.querySelector('#blog-grid > :not(noscript)')"


def check_blog_url_state(browser, base, rep):
    """blog.html's query string round-trips: a valid filter set is applied
    (the matching buttons are pressed) and written back as it came, a
    reload of the written URL gives the same URL, and values the corpus
    does not offer are dropped rather than obeyed (an empty list is never
    the answer to a stale link)."""
    context = site_context(browser, base)
    for query, want in BLOG_URLS:
        scope = f"blog.html?{query[:40]}"
        page, sink = open_page(context, base, f"blog.html?{query}", rep, scope, LISTING_DRAWN)
        if not page:
            continue
        # syncUrl runs once the first render has clamped the page number.
        wait_until(page, f"location.search.length !== {len(query) + 1}", 500)
        got = page.evaluate("Object.fromEntries(new URLSearchParams(location.search))")
        rep.check(scope, f"address bar keeps {sorted(want) or 'nothing'}", got == want, got)
        if want:
            pressed = page.evaluate("""want => {
                const on = sel => { const b = document.querySelector(sel);
                    return !!b && b.getAttribute('aria-pressed') === 'true'; };
                return (!want.tag || on(`button[data-filter-key="${want.tag}"]`))
                    && (!want.len || on(`button[data-length-key="${want.len}"]`));
            }""", want)
            rep.check(scope, "its filters show as pressed", pressed)
            written = page.evaluate("location.search")
            page.reload(wait_until="domcontentloaded")
            wait_until(page, LISTING_DRAWN, PAGE_BUDGET_MS)
            rep.check(scope, "a reload of the written URL writes the same URL",
                      page.evaluate("location.search") == written)
        rep.console_errors(scope, sink)
        page.close()
    context.close()


def check_print(browser, base, rep):
    """A post printed from the dark theme: the opener's title prints, and
    headings print in ink. Pins: the print sheet hiding the bare <header>
    element (which is what the post opener is), so the title vanished from
    paper; and the dark theme's pale headings printed pale on white."""
    context = site_context(browser, base, "dark", DESKTOP)
    scope = f"{PIN_POST} print"
    page, _ = open_page(context, base, PIN_POST, rep, scope,
                        "!!document.querySelector('.kr-opener__title') && !!document.querySelector('.blog-post h2')")
    if page:
        page.emulate_media(media="print")
        got = page.evaluate("""() => {
            const t = document.querySelector('.kr-opener__title'), r = t.getBoundingClientRect();
            const h = [...document.querySelectorAll('.blog-post h2')].find(e => !e.closest('.kr-post-end'));
            return {title: r.width > 0 && r.height > 0 && getComputedStyle(t).visibility !== 'hidden',
                    h2: getComputedStyle(h).color};
        }""")
        rep.check(scope, "the opener's title prints", got["title"], got)
        ink = [int(v) for v in re.findall(r"\d+", got["h2"])[:3]]
        rep.check(scope, "h2 prints in ink", contrast_ratio(tuple(ink), (255, 255, 255)) >= 4.5, got["h2"])
        page.close()
    context.close()


def check_desktop_geometry(browser, base, rep):
    """At 1440x900: the blog's first post starts above BLOG_FIRST_CARD_MAX,
    the gallery grid starts on the first screen, two long posts keep a
    median measure of at most MEASURE_MAX_CPL characters a line, nothing
    runs past the right edge, and the header is transparent at the top of
    a post, over its photograph. Pins: the listing's banner and filters
    pushing every post below the fold; a 90-character measure on wide
    screens; the dark theme's solid nav bar covering the opener."""
    context = site_context(browser, base, "dark", DESKTOP)
    for path, ready, js, limit, what in (
            ("blog.html", "document.querySelectorAll('#blog-grid .single-post-area').length >= 3",
             "document.querySelector('#blog-grid .single-post-area').getBoundingClientRect().top",
             BLOG_FIRST_CARD_MAX, "first post starts above"),
            ("gallery.html", "document.querySelectorAll('#gallery-grid .single_gallery_item').length >= 3",
             "document.querySelector('#gallery-grid').getBoundingClientRect().top",
             GALLERY_GRID_TOP_MAX, "grid starts above")):
        scope = f"{path} @{DESKTOP[0]}"
        page, _ = open_page(context, base, path, rep, scope, ready)
        if page:
            top = page.evaluate(js)
            rep.check(scope, f"{what} {limit}px", top < limit, f"{top:.0f}px")
            check_overflow(page, scope, rep)
            page.close()
    for path in (PIN_POST, PIN_POST_2):
        scope = f"{path} @{DESKTOP[0]}"
        page, _ = open_page(context, base, path, rep, scope,
                            "document.fonts.status === 'loaded' && !!document.querySelector('.blog-post > p')")
        if not page:
            continue
        cpl = page.evaluate(MEASURE_CPL)
        rep.check(scope, f"median measure at most {MEASURE_MAX_CPL} characters",
                  cpl is not None and cpl <= MEASURE_MAX_CPL, cpl)
        check_overflow(page, scope, rep)
        if path == PIN_POST:
            solid = page.evaluate(SOLID_HEADER)
            rep.check(scope, "header is transparent over the opener at the top", not solid, solid[:3])
        page.close()
    context.close()


# The median characters a line across a post's own paragraphs: each
# paragraph's content width over the average advance of its own text set
# on one line in its own font. Paragraphs shorter than two lines say
# nothing about the measure and are left out.
MEASURE_CPL = """() => {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:-99999px';
    document.body.appendChild(probe);
    const out = [];
    for (const p of document.querySelectorAll('.blog-post > p')) {
        const text = p.textContent.replace(/\\s+/g, ' ').trim();
        const cs = getComputedStyle(p);
        const width = p.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        if (text.length < 160 || !width) continue;
        probe.style.font = cs.font;
        probe.style.letterSpacing = cs.letterSpacing;
        probe.style.wordSpacing = cs.wordSpacing;
        probe.textContent = text;
        const advance = probe.getBoundingClientRect().width / text.length;
        if (advance && probe.getBoundingClientRect().width > width * 2) out.push(width / advance);
    }
    probe.remove();
    out.sort((a, b) => a - b);
    return out.length ? Math.round(out[Math.floor(out.length / 2)] * 10) / 10 : null;
}"""

# Elements in the site header that paint a solid colour across most of
# its width at the top of the page. A gradient scrim is allowed (it fades
# to nothing); a background colour with any real opacity is not.
SOLID_HEADER = """() => {
    window.scrollTo({top: 0, behavior: 'instant'});
    const header = document.querySelector('#header-section') || document.querySelector('.header-area');
    if (!header) return ['no header'];
    const width = header.getBoundingClientRect().width;
    const out = [];
    for (const el of [header, ...header.querySelectorAll('*')]) {
        const cs = getComputedStyle(el), r = el.getBoundingClientRect();
        if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < width * 0.5 || r.height < 20) continue;
        const m = cs.backgroundColor.match(/rgba?\\(([^)]+)\\)/);
        const alpha = m ? (m[1].split(/[ ,/]+/).filter(Boolean)[3] ?? 1) : 0;
        if (Number(alpha) > 0.05)
            out.push(el.tagName.toLowerCase() + '.' + [...el.classList].slice(0, 2).join('.') + ' ' + cs.backgroundColor);
    }
    return out;
}"""


def check_contrast(browser, base, rep):
    """Named text (CONTRAST_TARGETS) clears WCAG AA on CONTRAST_PAGES in
    both themes. The ground is found by walking up from the text until an
    opaque background colour; when the walk meets a photograph first (an
    ancestor or its ::before/::after with a background image, or one of
    PHOTO_GROUNDS), the ground is read from pixels instead: the page is
    screenshotted once as it is and once with the text made transparent,
    the pixels that changed are the letters, and the ground is the
    GROUND_PERCENTILE of the transparent shot under them. Pins, among
    others: the light theme's stone eyebrow on the homepage's dark photo
    band, the homepage promo button in ink on a dark photograph, and
    light-theme links set in ink rather than the link colour."""
    for theme in THEMES:
        context = site_context(browser, base, theme, DESKTOP, reduced_motion="reduce")
        for path in CONTRAST_PAGES:
            scope = f"{path} {theme}"
            page, _ = open_page(context, base, path, rep, scope, "document.readyState === 'complete'")
            if not page:
                continue
            let_network_settle(page)
            low = []
            items = page.evaluate(CONTRAST_COLLECT, {
                "targets": [list(t) for t in CONTRAST_TARGETS], "photo": PHOTO_GROUNDS,
                "sample": CONTRAST_SAMPLE})
            for item in items:
                fg = tuple(item["fg"])
                ground = tuple(item["bg"]) if item["bg"] else pixel_ground(page, item["id"], fg)
                if ground is None:
                    continue
                ratio = contrast_ratio(fg, ground)
                need = 3.0 if item["large"] else 4.5
                if ratio < need:
                    low.append(f"{item['kind']} '{item['text']}' {ratio:.2f}:1 < {need:g}"
                               f" ({'photo' if not item['bg'] else 'on ' + str(ground)})")
            rep.check(scope, f"contrast of {len(items)} named elements", items and not low,
                      "; ".join(low[:4]) if low else "nothing measured")
            page.close()
        context.close()


# For each (kind, selector) in targets: up to `sample` visible matches with
# text, each with its text colour, whether it is large, and either its
# ground (the composite of the translucent backgrounds above the first
# opaque one) or, when a photograph lies beneath, an id to judge by pixels.
CONTRAST_COLLECT = """({targets, photo, sample}) => {
    const rgba = s => { const m = (s || '').match(/rgba?\\(([^)]+)\\)/); if (!m) return null;
        const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
        return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
    const over = (top, under) => top.slice(0, 3).map((c, i) => c * top[3] + under[i] * (1 - top[3]));
    const image = (el, pseudo) => { const cs = getComputedStyle(el, pseudo);
        return (!pseudo || (cs.content !== 'none' && cs.content !== 'normal')) && cs.backgroundImage !== 'none'; };
    const shown = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
        return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden'
            && !el.closest('[inert], [aria-hidden=true], .owl-item:not(.active), .kr-offstage:not(.is-visible)')
            && el.checkVisibility({opacityProperty: true}) && (el.innerText || '').trim(); };
    const out = [];
    let n = 0;
    for (const [kind, selector] of targets) {
        let taken = 0;
        for (const el of document.querySelectorAll(selector)) {
            if (taken >= sample) break;
            if (!shown(el)) continue;
            taken++;
            const cs = getComputedStyle(el);
            const layers = [];
            let photographic = false;
            // An image paints above its own element's colour, so it is
            // tested first; an opaque colour nearer the text still wins.
            for (let a = el; a; a = a.parentElement) {
                if (a.matches(photo) || image(a) || image(a, '::before') || image(a, '::after')) {
                    photographic = true; break; }
                const c = rgba(getComputedStyle(a).backgroundColor);
                if (c && c[3] > 0) layers.push(c);
                if (c && c[3] >= 0.999) break;
            }
            let bg = null;
            if (!photographic) {
                bg = [255, 255, 255];
                for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg);
            }
            const id = el.dataset.krContrast || String(++n);
            if (photographic) el.dataset.krContrast = id;
            const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10) || 400;
            out.push({kind, id, text: el.innerText.trim().replace(/\\s+/g, ' ').slice(0, 32),
                      fg: rgba(cs.color).slice(0, 3), bg: bg && bg.map(Math.round),
                      large: size >= 24 || (size >= 18.66 && weight >= 700)});
        }
    }
    return out;
}"""

VISIBLE_BOX = """id => {
    const r = document.querySelector(`[data-kr-contrast="${id}"]`).getBoundingClientRect();
    const x = Math.max(0, r.left), y = Math.max(0, r.top);
    return {x, y, width: Math.min(innerWidth, r.right) - x, height: Math.min(innerHeight, r.bottom) - y};
}"""


def pixel_ground(page, item_id, fg):
    """The ground under an element's letters, read from pixels (see
    check_contrast), as a relative luminance (contrast_ratio takes one in
    place of a colour). None when the element cannot be brought on screen
    (a carousel slide, say)."""
    from PIL import Image, ImageChops  # the smoke job installs Pillow

    page.evaluate(f"document.querySelector('[data-kr-contrast=\"{item_id}\"]')"
                  ".scrollIntoView({block: 'center', behavior: 'instant'})")
    next_frames(page)
    box = page.evaluate(VISIBLE_BOX, item_id)
    if box["width"] < 2 or box["height"] < 2:
        return None
    shown = Image.open(io.BytesIO(page.screenshot(clip=box))).convert("RGB")
    page.evaluate("""id => { const s = document.createElement('style'); s.id = 'kr-contrast-hide';
        const sel = `[data-kr-contrast="${id}"], [data-kr-contrast="${id}"] *`;
        s.textContent = sel + '{color:transparent!important;-webkit-text-fill-color:transparent!important;'
            + 'text-shadow:none!important;text-decoration-color:transparent!important;transition:none!important}';
        document.head.appendChild(s); }""", item_id)
    next_frames(page)
    bare = Image.open(io.BytesIO(page.screenshot(clip=box))).convert("RGB")
    page.evaluate("document.getElementById('kr-contrast-hide').remove()")
    diff = ImageChops.difference(shown, bare).convert("L")
    letters = [i for i, d in enumerate(_pixels(diff)) if d > 24]
    pixels = _pixels(bare)
    under = [relative_luminance(pixels[i]) for i in letters] or [relative_luminance(p) for p in pixels]
    under.sort()
    light_text = relative_luminance(fg) > 0.18
    at = GROUND_PERCENTILE if light_text else 1 - GROUND_PERCENTILE
    return under[min(len(under) - 1, int(len(under) * at))]


def _pixels(image):
    """An image's pixel values in reading order (Pillow 12 renamed the call)."""
    flat = getattr(image, "get_flattened_data", None)
    return list(flat() if flat else image.getdata())


class LiveTokens:
    """Every class and id seen in a live DOM during the run, with the first
    page each class was seen on, for check_live_classes."""

    JS = """() => { const c = new Set(), i = new Set();
        for (const el of document.querySelectorAll('*')) {
            for (const k of el.classList) c.add(k);
            if (el.id) i.add(el.id);
        }
        return [[...c], [...i]]; }"""

    def __init__(self):
        self.classes, self.ids = {}, set()

    def add(self, page, scope):
        try:
            classes, ids = page.evaluate(self.JS)
        except Exception:  # noqa: BLE001 - a closed or crashed page adds nothing
            return
        for c in classes:
            self.classes.setdefault(c, scope)
        self.ids.update(ids)


def _selectors(css):
    """Every selector in a minified stylesheet, through grouping at-rules.
    Uses the pruner's own tokenizer, so this side splits a rule exactly as
    the build did."""
    found = set()
    for prelude, body, _text in css_prune._rules(css):
        head = prelude.strip()
        if body is None or not head:
            continue
        if head.startswith(css_prune.GROUPING_AT_RULES):
            found |= _selectors(body)
        elif not head.startswith("@"):
            found.update(css_prune.split_selectors(head))
    return found


def pruned_selectors():
    """Selectors the stylesheet sources define and style.min.css lacks:
    style.css and every sheet it imports (those the build prunes), each
    minified as the build minifies it, less what the served file holds."""
    source = minify_css.SOURCE.read_text(encoding="utf-8")
    parts = [minify_css.IMPORT_RE.sub("", source)]
    parts += [(ROOT / imp).read_text(encoding="utf-8")
              for imp in minify_css.IMPORT_RE.findall(source) if imp not in minify_css.NO_PRUNE]
    defined = set()
    for part in parts:
        defined |= _selectors(minify_css.minify(minify_css.CHARSET_RE.sub("", part)))
    served = _selectors(minify_css.TARGET.read_text(encoding="utf-8"))
    return defined - served


def check_live_classes(tokens, rep):
    """A rule the pruner dropped although every class and id it names was
    on a page this run looked at. That is a class the scripts assemble
    where the pruner cannot read it (css_prune.py's module docstring), so
    the element renders unstyled; it happened to the hero's bounceInDown,
    which lost its animation for months. The fix is almost always to
    write the class out whole in the script, or to add it to
    RUNTIME_TOKENS in css_prune.py."""
    live = css_prune.Usage(frozenset(tokens.classes), frozenset(tokens.ids), (), frozenset())
    corpus = css_prune.collect_usage()
    lost = sorted(s for s in pruned_selectors() if css_prune.selector_can_match(s, live))
    names = sorted({name for s in lost for kind, name in css_prune.SEL_TOKEN.findall(s)
                    if kind == "." and not corpus.has_class(name)})
    detail = ""
    if lost:
        # Named classes the corpus lacks are the runtime-only ones; if the
        # corpus has them all, the served file is simply an old build.
        why = ("assembled at runtime: " + ", ".join(f".{n} (on {tokens.classes.get(n, '?')})" for n in names[:5])
               if names else "every class is in the corpus, so style.min.css is stale: run minify_css.py")
        detail = f"{len(lost)} selectors, e.g. {', '.join(lost[:3])}; {why}"
    rep.check("style.min.css", f"no rule lost for a class the {len(tokens.classes)} live classes use",
              not lost, detail)


def run_pins(browser, base, rep):
    """Every regression pin, in the order the module docstring lists them."""
    check_opener_colours(browser, base, rep)
    check_focus_rings(browser, base, rep)
    check_gallery_keyboard_and_rows(browser, base, rep)
    check_palette_paths(browser, base, rep)
    check_not_found_page(browser, base, rep)
    check_data_fetched_once(browser, base, rep)
    check_hero_holds(browser, base, rep)
    check_theme_toggle(browser, base, rep)
    check_phone_menu(browser, base, rep)
    check_blog_url_state(browser, base, rep)
    check_print(browser, base, rep)
    check_desktop_geometry(browser, base, rep)
    check_contrast(browser, base, rep)


# The suite's parts, in running order, for --only. "classes" judges what
# the others saw, so on its own it has nothing to judge.
PARTS = ("pages", "sweep", "canvas", "sketches", "pins", "classes")


def main(argv=()):
    """Run the suite (or the PARTS named with --only). `argv` defaults to
    none rather than sys.argv so the suite can be imported and run by a
    wrapper that has arguments of its own."""
    parser = sitelib.arg_parser(__doc__)
    parser.add_argument("--only", metavar="PART[,PART]", default=",".join(PARTS),
                        help="run only these parts: " + ", ".join(PARTS))
    args = parser.parse_args(list(argv))
    parts = {p.strip() for p in args.only.split(",") if p.strip()}
    unknown = parts - set(PARTS)
    if unknown:
        parser.error(f"unknown part(s): {', '.join(sorted(unknown))}; choose from {', '.join(PARTS)}")

    rep = Reporter()
    tokens = LiveTokens()
    started = time.monotonic()
    with serve(PORT) as base, sync_playwright() as pw:
        rep.note(f"serving {base}")
        browser = pw.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        console_errors = []
        watch_console(page, console_errors, base)

        for path, assertions in CHECKS if "pages" in parts else ():
            console_errors.clear()
            try:
                page.goto(f"{base}/{path}", wait_until="domcontentloaded", timeout=30000)
            except Exception as e:  # noqa: BLE001
                rep.check(path, "navigation", False, e)
                continue
            # The old sleeps here were 3.5s, then the scroll, then 0.9s. A
            # truly broken reveal stays hidden however long this waits.
            settle(page, path, rep,
                   f"{READER_SCROLL} && {all_of(e for _n, e in assertions)}",
                   PAGE_BUDGET_MS + 900, "page ready")
            let_network_settle(page)
            run_assertions(page, path, assertions, rep)
            rep.console_errors(path, console_errors)
            tokens.add(page, path)

        # Every top-level page, both widths, both themes.
        if "sweep" in parts:
            check_sweep(browser, base, rep, tokens)

        # Phone-width pass over every interactive (canvas) post.
        if "canvas" in parts:
            for path in interactive_posts():
                check_mobile(page, base, path, console_errors, rep, tokens)
                check_converges(page, base, path, rep)
                check_a11y(page, base, path, rep)
            # One reduced-motion pass is enough: the behaviour lives in the
            # engine, not in any one post.
            check_reduced_motion(browser, base, "blog/particle-swarm-live.html", rep)
        # Every hover sketch, in one pass: they are registered by slug and
        # the engine exposes the factory it uses.
        if "sketches" in parts:
            check_sketches(page, base, rep)
        # One function per bug that has been fixed; see "Regression pins".
        if "pins" in parts:
            run_pins(browser, base, rep)
        # Last: it judges the classes every part above saw in a live DOM.
        if "classes" in parts and tokens.classes:
            check_live_classes(tokens, rep)
        browser.close()
    rep.note(f"\nran in {time.monotonic() - started:.0f}s")
    return rep.summary("smoke")


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
