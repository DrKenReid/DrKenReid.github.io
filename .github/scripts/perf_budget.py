#!/usr/bin/env python3
"""Performance budgets for the page templates, measured in a real browser.

Each template in .github/perf-budgets.json (the homepage, the blog
listing, the gallery, the reading page, a prose post and an interactive
post) is loaded at a phone size (412x823) and a desktop size (1440x900),
RUNS times each from a cold cache, and must hold to:

  layout shift   CLS below the budget's "cls" (0.1, the "good" line in
                 Core Web Vitals), as the median of the runs. Measured the
                 way web-vitals does (the largest session window of
                 layout-shift entries without recent input), over the load
                 and a scroll down the page, so a lazy image without
                 dimensions or a late-filled figure counts too.
  weight         First-party bytes of JS, CSS, fonts and images, and the
                 number of first-party requests, at load (before any
                 scrolling), each at or under the template's budget.
                 Bytes are as the local server sends them, uncompressed:
                 Pages gzips text, so the wire is smaller, but the budget
                 guards change, and the uncompressed figure moves with
                 every byte an edit adds.
  no refetch     No same-origin URL requested twice in one visit, query
                 ignored. The homepage used to fetch posts.json twice and
                 the Bluesky feed twice, and a stylesheet asked for with
                 and without ?v= is two downloads of one file.
  no font twins  No two font URLs with identical bytes: the same face
                 shipped under two names downloads twice and caches twice.
  no blocking    No <script src> in <head> without defer, async or
  head scripts   type=module: every one of those holds the first paint.
  no preloader   No #preloader. It hid every page until its scripts ran,
                 which cost a second of blank screen for nothing.

Then two checks of the site as an installed, offline-capable thing:

  offline        With the service worker in control, read two posts and
                 scroll far enough through the gallery to fill its image
                 cache past sw.js's IMG_LIMIT, then go offline and open a
                 page never visited: offline.html must answer, listing
                 the saved posts, and a saved post must still open. This
                 is the kr-v10 failure: one cache capped at 200 entries,
                 so a scroll through the gallery evicted offline.html and
                 the stylesheet, and the fallback had nothing to show.
  manifest       manifest.json has what an install needs (name,
                 short_name, start_url, scope, display, colours, a 192 and
                 a 512 icon and a maskable one), every icon is a PNG of
                 the size it claims, and every template links to it.

Third-party requests are aborted throughout (harness.block_third_parties)
and the service worker is blocked except in the offline scenario, so each
run measures the site from a cold cache and nothing else.

Raising a budget
----------------
Budgets live in .github/perf-budgets.json, per template and viewport,
set about 15% above what was measured when they were written. When a
change is meant to cost more (a new font, a heavier hero), run

    python .github/scripts/perf_budget.py --report

read the measured column, raise only the numbers that change warrants,
by hand, and say in the commit which change needed the room and why it
was worth it. Never raise a budget to make an unexplained failure pass:
find what grew first (the failure names the heaviest files). A budget
that has headroom to spare after a deliberate slimming can come down the
same way.

    python .github/scripts/perf_budget.py            # check every budget
    python .github/scripts/perf_budget.py --report   # and print a Markdown table
    python .github/scripts/perf_budget.py --only gallery,blog

Exit status 0 when everything holds, 1 otherwise.
"""
import json
import statistics
import sys
import time
from collections import Counter
from hashlib import sha256
from pathlib import Path
from urllib.parse import urljoin, urlsplit

from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402
from generate_photo_dims import png_size  # noqa: E402
from harness import (ROOT, Reporter, block_third_parties, is_own,  # noqa: E402
                     serve, site_context, watch_console)

BUDGETS = ROOT / ".github" / "perf-budgets.json"

# 0 lets the OS pick a free port (see harness.serve).
PORT = 0

# The two sizes every template is measured at. The phone is a mid-range
# Android's CSS viewport, with touch and no hover, as a real phone reports
# them, so anything the site loads only for a mouse stays unloaded there.
VIEWPORTS = {
    "phone": {"viewport": {"width": 412, "height": 823}, "is_mobile": True, "has_touch": True},
    "desktop": {"viewport": {"width": 1440, "height": 900}},
}

# Playwright's resource types, grouped the way the budgets are written.
# Data files (fetch), the manifest and the document itself count towards
# the request budget only.
KINDS = {"script": "js", "stylesheet": "css", "font": "font", "image": "img"}
BYTE_KINDS = ("js", "css", "font", "img")

# How long to let late requests land before the load is measured. Not a
# failure when it runs out: a page may keep a connection busy.
IDLE_MS = 3000

# The scroll after load: a step of most of a screen at a time, with a
# pause for lazy images and view-timeline work to land, and a cap so a
# long page (the reading page) does not dominate the run.
SCROLL_STEP = 0.85
SCROLL_PAUSE_MS = 120
SCROLL_STEPS_MAX = 14

# Shifts that land just after the scroll still count.
SETTLE_MS = 400

# Started before any page script, so no shift is missed. The session
# windows follow web-vitals: a window closes after a 1s gap or at 5s.
CLS_OBSERVER = """(() => {
    let max = 0, cur = 0, first = 0, last = 0;
    const worst = [];
    const name = n => !n || n.nodeType !== 1 ? '(text)' :
        n.tagName.toLowerCase() + (n.id ? '#' + n.id : '') + [...n.classList].slice(0, 2).map(c => '.' + c).join('');
    try {
        new PerformanceObserver(list => {
            for (const e of list.getEntries()) {
                if (e.hadRecentInput) continue;
                if (cur && e.startTime - last < 1000 && e.startTime - first < 5000) {
                    cur += e.value; last = e.startTime;
                } else {
                    cur = e.value; first = last = e.startTime;
                }
                max = Math.max(max, cur);
                worst.push([e.value, (e.sources || []).map(s => name(s.node)).join(' ')]);
            }
        }).observe({type: 'layout-shift', buffered: true});
    } catch (e) {}
    window.__krLayoutShift = () => ({
        cls: max,
        worst: worst.sort((a, b) => b[0] - a[0]).slice(0, 3)
            .map(([v, who]) => v.toFixed(3) + ' ' + (who || '?')),
    });
})();"""

# <script src> elements in <head> that block the first paint.
BLOCKING_HEAD_SCRIPTS = """() => [...document.head.querySelectorAll('script[src]')]
    .filter(s => !s.defer && !s.async && s.type !== 'module')
    .map(s => s.getAttribute('src'))"""

# The service worker's caches, as offline.html reads them.
CACHES = """async () => {
    const out = {};
    for (const name of await caches.keys()) {
        const keys = await (await caches.open(name)).keys();
        out[name] = keys.map(r => new URL(r.url).pathname);
    }
    return out;
}"""

# Pages the offline scenario reads before going offline.
OFFLINE_POSTS = ("blog/rating-systems.html", "blog/frodo-sam-and-love.html")
# A page the scenario never opens, so offline it can only be the fallback.
OFFLINE_UNSEEN = "privacy.html"
# Gallery tiles to load so the image cache has to trim (sw.js IMG_LIMIT
# is 200); the grid loads 24 a batch.
OFFLINE_TILES = 240
OFFLINE_FALLBACK_TITLE = "Offline - Ken Reid"

MANIFEST_FIELDS = ("name", "short_name", "start_url", "scope", "display",
                   "background_color", "theme_color", "icons")


def load_budgets():
    """The budgets file, with its shape checked, so a hand edit that drops
    a number fails here with the key's name rather than as a KeyError
    halfway through a run."""
    budgets = json.loads(BUDGETS.read_text(encoding="utf-8"))
    problems = [k for k in ("cls", "runs", "templates") if k not in budgets]
    for name, spec in budgets.get("templates", {}).items():
        if not (ROOT / spec.get("page", "")).is_file():
            problems.append(f"{name}: page {spec.get('page')!r} is not a file")
        for size in VIEWPORTS:
            missing = [k for k in (*BYTE_KINDS, "requests") if not isinstance(spec.get(size, {}).get(k), int)]
            if missing:
                problems.append(f"{name} {size}: no whole-number {', '.join(missing)}")
    if problems:
        sys.exit(f"{BUDGETS.relative_to(ROOT)}: " + "; ".join(problems))
    return budgets


class Visit:
    """One page load in its own cold context: every first-party response,
    kept whole so font bodies can be compared after the fact.

    Construction only starts the navigation; settle() waits for the load.
    A template's runs are started together and settled in turn, so the
    later runs load while the first is being scrolled and measured.
    """

    def __init__(self, browser, base, path, size):
        self.base = base
        self.context = site_context(browser, base, None, None, **VIEWPORTS[size])
        self.context.add_init_script(CLS_OBSERVER)
        self.page = self.context.new_page()
        self.sink = []
        watch_console(self.page, self.sink, base)
        self.responses = []
        self.page.on("requestfinished", self._finished)
        self.at_load = None
        self.page.goto(f"{base}/{path}", wait_until="commit", timeout=45000)

    def settle(self):
        """Wait for the load event and a quiet network; what has arrived by
        then is what the page costs to open."""
        self.page.wait_for_load_state("load", timeout=45000)
        try:
            self.page.wait_for_load_state("networkidle", timeout=IDLE_MS)
        except PlaywrightTimeout:
            pass
        self.at_load = len(self.responses)

    def _finished(self, request):
        if not is_own(request.url, self.base):
            return
        response = request.response()
        if response is None:
            return
        try:
            size = request.sizes()["responseBodySize"]
        except Exception:  # noqa: BLE001 - a request torn down mid-flight
            size = 0
        self.responses.append((request.url, request.resource_type, max(size, 0), response))

    def weight(self):
        """Bytes per kind and the request count, at load."""
        out = Counter()
        for _url, kind, size, _resp in self.responses[:self.at_load]:
            out["requests"] += 1
            if kind in KINDS:
                out[KINDS[kind]] += size
        return out

    def heaviest(self, kind, n=3):
        rows = [(size, url) for url, k, size, _ in self.responses[:self.at_load] if KINDS.get(k) == kind]
        return ", ".join(f"{urlsplit(u).path} {s // 1024}KB" for s, u in sorted(rows, reverse=True)[:n])

    def scroll_through(self):
        for _ in range(SCROLL_STEPS_MAX):
            at_end = self.page.evaluate(
                f"""() => {{ window.scrollBy({{top: innerHeight * {SCROLL_STEP}, behavior: 'instant'}});
                    return innerHeight + scrollY >= document.documentElement.scrollHeight - 2; }}""")
            self.page.wait_for_timeout(SCROLL_PAUSE_MS)
            if at_end:
                break
        self.page.wait_for_timeout(SETTLE_MS)

    def layout_shift(self):
        return self.page.evaluate("window.__krLayoutShift ? window.__krLayoutShift() : null")

    def refetched(self):
        """Same-origin paths requested more than once, query ignored."""
        seen = Counter(urlsplit(url).path for url, *_ in self.responses)
        return sorted(p for p, n in seen.items() if n > 1)

    def font_twins(self):
        """Groups of font URLs whose bodies are byte-identical."""
        by_hash = {}
        for url, kind, _size, response in self.responses:
            if kind != "font":
                continue
            try:
                digest = sha256(response.body()).hexdigest()
            except Exception:  # noqa: BLE001 - a body the browser did not keep
                continue
            by_hash.setdefault(digest, set()).add(urlsplit(url).path)
        return [sorted(urls) for urls in by_hash.values() if len(urls) > 1]

    def close(self):
        self.context.close()


def check_template(browser, base, name, spec, budgets, rep, table):
    """Every run of one template at both sizes."""
    runs = budgets.get("runs", 3)
    for size in VIEWPORTS:
        scope = f"{name} {size}"
        budget = spec[size]
        shifts, first, visits = [], None, []
        try:
            for _ in range(runs):
                visits.append(Visit(browser, base, spec["page"], size))
        except Exception as e:  # noqa: BLE001 - reported, the other templates still run
            rep.check(scope, "loads", False, e)
            for visit in visits:
                visit.close()
            continue
        for i, visit in enumerate(visits):
            try:
                visit.settle()
            except Exception as e:  # noqa: BLE001
                rep.check(scope, f"run {i + 1} loads", False, e)
                visit.close()
                continue
            if i == 0:
                first = visit.weight()
                check_first_visit(visit, scope, first, budget, rep)
            visit.scroll_through()
            shifts.append(visit.layout_shift())
            if i == 0:
                rep.console_errors(scope, visit.sink)
            visit.close()
        if not shifts or any(s is None for s in shifts):
            rep.check(scope, "layout shift measured", False, "no layout-shift observer")
            continue
        median = statistics.median(s["cls"] for s in shifts)
        worst = max(shifts, key=lambda s: s["cls"])
        rep.check(scope, f"CLS {median:.3f} under {budgets['cls']} (median of {len(shifts)})",
                  median < budgets["cls"], "; ".join(worst["worst"]))
        if first is not None:
            table.append((name, size, median, first, budget))


def check_first_visit(visit, scope, weight, budget, rep):
    """The byte, request and markup budgets, on the first of the runs."""
    over = [f"{k} {weight[k]:,} > {budget[k]:,} ({visit.heaviest(k)})"
            for k in BYTE_KINDS if weight[k] > budget[k]]
    if weight["requests"] > budget["requests"]:
        over.append(f"requests {weight['requests']} > {budget['requests']}")
    rep.check(scope, "within its byte and request budget", not over, "; ".join(over))
    twice = visit.refetched()
    rep.check(scope, "no same-origin URL fetched twice", not twice, ", ".join(twice[:4]))
    twins = visit.font_twins()
    rep.check(scope, "no two font URLs with the same bytes", not twins,
              "; ".join(" = ".join(t) for t in twins))
    blocking = visit.page.evaluate(BLOCKING_HEAD_SCRIPTS)
    rep.check(scope, "no render-blocking script in <head>", not blocking, ", ".join(blocking))
    rep.check(scope, "no #preloader", not visit.page.evaluate("!!document.getElementById('preloader')"))


def check_offline(browser, base, rep):
    """The offline scenario (see the module docstring)."""
    scope = "offline"
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    block_third_parties(context, base)
    page = context.new_page()
    sink = []
    watch_console(page, sink, base)
    try:
        page.goto(f"{base}/index.html", wait_until="load")
        page.wait_for_function("() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)",
                               timeout=20000)
    except PlaywrightTimeout:
        rep.check(scope, "the service worker takes control", False)
        context.close()
        return
    titles = []
    for path in OFFLINE_POSTS:
        page.goto(f"{base}/{path}", wait_until="load")
        titles.append(page.evaluate("document.querySelector('.kr-opener__title, h1').textContent.trim()"))
    page.goto(f"{base}/gallery.html", wait_until="load")
    tiles = fill_gallery(page, OFFLINE_TILES)
    saved = page.evaluate(CACHES)
    core = next((v for k, v in saved.items() if k.endswith("-core")), [])
    images = next((v for k, v in saved.items() if k.endswith("-img")), [])
    rep.check(scope, f"{tiles} gallery tiles leave the shell cached",
              "/offline.html" in core and "/style.min.css" in core,
              f"core holds {len(core)}, img holds {len(images)}")

    context.set_offline(True)
    try:
        page.goto(f"{base}/{OFFLINE_UNSEEN}", wait_until="load")
        listed = page.evaluate("""() => { const s = document.getElementById('kr-offline-saved');
            return s && !s.hidden ? [...s.querySelectorAll('li a')].map(a => a.textContent.trim()) : []; }""")
        rep.check(scope, f"an unseen page answers with {OFFLINE_FALLBACK_TITLE!r}",
                  page.title() == OFFLINE_FALLBACK_TITLE, page.title())
        missing = [t for t in titles if t not in listed]
        rep.check(scope, "it lists the posts read", listed and not missing,
                  f"listed {listed[:4]}, missing {missing}")
        page.goto(f"{base}/{OFFLINE_POSTS[0]}", wait_until="load")
        opened = page.evaluate("(document.querySelector('.kr-opener__title, h1') || {}).textContent || ''").strip()
        rep.check(scope, "a saved post opens offline", opened == titles[0], opened[:60])
    finally:
        context.set_offline(False)
    # The one page that is supposed to be missing offline is the one the
    # scenario asked for; everything else should have come from the cache.
    rep.console_errors(scope, [e for e in sink if "net::ERR_INTERNET_DISCONNECTED" not in e])
    context.close()


def fill_gallery(page, want):
    """Load gallery tiles until `want` are in the grid (or the gallery runs
    out), walking down the page so each lazy thumbnail is requested."""
    count = "document.querySelectorAll('#gallery-grid .single_gallery_item').length"
    page.wait_for_function(f"() => {count} >= 12", timeout=15000)
    for _ in range(40):
        have = page.evaluate(count)
        if have >= want:
            break
        more = page.query_selector("#load-more-btn")
        if more and more.is_visible():
            more.click()
        else:
            page.evaluate("window.scrollTo({top: document.documentElement.scrollHeight, behavior: 'instant'})")
        page.wait_for_function(f"n => {count} > n", arg=have, timeout=5000)
    height = page.evaluate("document.documentElement.scrollHeight")
    for y in range(0, height, 700):
        page.evaluate(f"window.scrollTo({{top: {y}, behavior: 'instant'}})")
        page.wait_for_timeout(40)
    try:
        page.wait_for_load_state("networkidle", timeout=IDLE_MS)
    except PlaywrightTimeout:
        pass
    return page.evaluate(count)


# A URL's status and first bytes, fetched by the page (so it goes through
# the same server, and the same routes, as everything else here).
FETCH_HEAD_BYTES = """async url => {
    try {
        const r = await fetch(url, {cache: 'no-store'});
        const bytes = new Uint8Array(await r.arrayBuffer());
        return {status: r.status, head: [...bytes.slice(0, 24)], text: r.status === 200
            && (r.headers.get('content-type') || '').includes('json') ? new TextDecoder().decode(bytes) : null};
    } catch (e) { return {status: 0, head: [], text: null}; }
}"""


def check_manifest(browser, base, templates, rep):
    """The web app manifest (see the module docstring), read as a browser
    installing the site would: from the link on each template page."""
    scope = "manifest.json"
    context = site_context(browser, base, None, None)
    page = context.new_page()
    links = {}
    for spec in templates.values():
        page.goto(f"{base}/{spec['page']}", wait_until="domcontentloaded")
        links[spec["page"]] = page.evaluate("(document.querySelector('link[rel=manifest]') || {}).href || ''")
    unlinked = [f"{p} ({h or 'none'})" for p, h in links.items() if urlsplit(h).path != "/manifest.json"]
    rep.check(scope, f"all {len(templates)} templates link it", not unlinked, ", ".join(unlinked))

    url = f"{base}/manifest.json"
    got = page.evaluate(FETCH_HEAD_BYTES, url)
    try:
        manifest = json.loads(got["text"] or "")
    except ValueError:
        rep.check(scope, "answers 200 with JSON", False, got["status"])
        context.close()
        return
    missing = [f for f in MANIFEST_FIELDS if not manifest.get(f)]
    rep.check(scope, "has every field an install needs", not missing, ", ".join(missing))

    icons, bad = manifest.get("icons", []), []
    for icon in icons:
        fetched = page.evaluate(FETCH_HEAD_BYTES, urljoin(url, icon.get("src", "")))
        size = png_size(bytes(fetched["head"])) if fetched["status"] == 200 else None
        claimed = {tuple(int(v) for v in s.split("x")) for s in icon.get("sizes", "").split()}
        if size not in claimed:
            bad.append(f"{icon.get('src')} is {size or 'not a PNG'} (status {fetched['status']}),"
                       f" claims {icon.get('sizes')}")
    rep.check(scope, f"all {len(icons)} icons are PNGs of their stated size", icons and not bad, "; ".join(bad))
    sizes = {s for i in icons for s in i.get("sizes", "").split()}
    rep.check(scope, "a 192 and a 512 icon, and a maskable one",
              {"192x192", "512x512"} <= sizes and any("maskable" in i.get("purpose", "") for i in icons),
              sorted(sizes))
    start = page.evaluate(FETCH_HEAD_BYTES, urljoin(url, manifest.get("start_url", "/")))
    rep.check(scope, "start_url answers 200", start["status"] == 200, start["status"])
    context.close()


def kb(n):
    return f"{n / 1024:,.0f}"


def report(table, budgets):
    """The measured numbers against their budgets, as a Markdown table."""
    print(f"\n| Template | Viewport | CLS (< {budgets['cls']}) | JS KB | CSS KB | Font KB | Image KB | Requests |")
    print("|---|---|---|---|---|---|---|---|")
    for name, size, cls, got, budget in table:
        cells = [f"{kb(got[k])} / {kb(budget[k])}" for k in BYTE_KINDS]
        print(f"| {name} | {size} | {cls:.3f} | " + " | ".join(cells)
              + f" | {got['requests']} / {budget['requests']} |")
    print("\nEach cell is measured / budget, first-party only, uncompressed, at load.")


def main(argv=None):
    parser = sitelib.arg_parser(__doc__)
    parser.add_argument("--report", action="store_true",
                        help="print the measurements as a Markdown table as well")
    parser.add_argument("--only", metavar="NAME[,NAME]",
                        help="templates to measure (by their name in perf-budgets.json);"
                             " skips the offline and manifest checks")
    args = parser.parse_args(argv)

    budgets = load_budgets()
    templates = budgets["templates"]
    chosen = templates
    if args.only:
        names = [n.strip() for n in args.only.split(",") if n.strip()]
        unknown = [n for n in names if n not in templates]
        if unknown:
            parser.error(f"unknown template(s): {', '.join(unknown)}; choose from {', '.join(templates)}")
        chosen = {n: templates[n] for n in names}

    rep = Reporter()
    table = []
    started = time.monotonic()
    with serve(PORT) as base, sync_playwright() as pw:
        browser = pw.chromium.launch()
        for name, spec in chosen.items():
            check_template(browser, base, name, spec, budgets, rep, table)
        if not args.only:
            check_offline(browser, base, rep)
            check_manifest(browser, base, templates, rep)
        browser.close()
    if args.report:
        report(table, budgets)
    rep.note(f"\nran in {time.monotonic() - started:.0f}s")
    return rep.summary("performance")


if __name__ == "__main__":
    sys.exit(main())
