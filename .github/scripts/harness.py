#!/usr/bin/env python3
"""Shared plumbing for the browser-driven checks.

The browser checks (smoke_test.py, check_post_template.py, perf_budget.py
and viz_verify.py) all need the same few things: a local server rooted at
the repo, a browser pointed at it, and a way to tell our own breakage apart
from a third party having a bad day. smoke_test and viz_verify once each
kept their own copy, and the copies drifted: the noise filters were
sixteen entries and six, so viz_verify failed on a Last.fm hiccup that
smoke_test correctly ignored.

Anything a second checker would need belongs here. Anything specific to one
checker does not.

Not a test framework. It has no opinion about what a check is, only about
serving files, launching a browser, and counting results.

What is here, and why each piece is shaped the way it is:

serve(port=0, root=ROOT)
    A quiet static server on 127.0.0.1 that yields its real base URL. Port 0
    asks the OS for a free port, so CI, a local run and a second engineer's
    run never fight over a fixed number: they used to, because each checker
    hard-coded one and two of anything collided. Pass a port only when a
    person or another process has to find the server; everything that talks
    to it should build URLs from the yielded base. A missing path answers
    the way GitHub Pages does, with the root's 404.html and status 404, so
    the 404 page can be tested where readers meet it (at a URL it does not
    live at) and a missing file of ours still reads as a 404.

watch_console(page, sink, base=None)
    Collects our own errors as they happen. Two filters, deliberately
    different. A console line names no host, so it is judged by its text
    against NOISE. A failed response does name one, so it is judged by host:
    anything not served by the local server is somebody else's outage.
    The URL substring list used to do both jobs and was wrong both ways:
    every new third party (Esri's basemap replacing CARTO's) failed the
    suite until someone added it, and a noise word inside one of our own
    URLs ("github.com" in a post slug) would have excused our own 404.
    Uncaught exceptions arrive on "pageerror", not "console", and are
    collected too: a script that throws halfway through rendering is the
    most common way a page breaks without logging anything.

set_theme(context, theme)
    Opens every page of a browser context in the site's dark or light
    theme, by seeding the same localStorage key the toggle writes before
    any page script runs. One context per theme: init scripts accumulate.

block_third_parties(context, base)
    Aborts every request that the local server would not answer. For the
    checks that measure the site itself (bytes, layout shifts, the post
    template): a third party's latency or outage is not a regression, and
    waiting on analytics, embeds and cover images made those runs slow and
    their numbers noisy. Aborted loads log only "Failed to load resource",
    which watch_console already drops.

site_context(browser, base, theme="dark", size=(1280, 900), **kw)
    The context every check that measures the site starts from: the
    theme set, third parties blocked, and the service worker blocked, so
    a page is the page as served rather than whatever an earlier
    navigation left in a cache. Three suites built it inline, three ways.

OPENER_COLOURS
    The post opener's title and kicker colours, which are the same in
    both themes (style.css §06): two suites check them.

open_ahead(context, base, paths, ahead)
    Yields pages in order while the next few load, so a sweep over many
    pages spends its time measuring rather than waiting on navigations.

next_frames(page, frames=2)
    The honest version of a short sleep: two painted frames and one more
    task, which is when a redraw queued by the last input has landed and
    an IntersectionObserver has reported what that frame saw.

element_overflow(page)
    Content that runs off the right edge at phone width. The obvious
    measure, documentElement.scrollWidth, cannot see it here: html and body
    clip overflow-x (style.css §02, "Page"),
    so the page never grows a scrollbar and the overflowing text is simply
    cut off. This walks main and footer instead and reports the outermost
    boxes whose right edge passes the viewport, stopping at any box that
    clips or scrolls its own overflow (a code block, the filter row), since
    whatever overflows inside one of those is still reachable.

relative_luminance(rgb), contrast_ratio(a, b)
    WCAG 2.x arithmetic, shared by anything that judges colour so two
    checkers cannot round it differently.

Reporter
    Prints as it goes and remembers what failed.
"""

import sys
import threading
from collections import deque
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]

# Third parties failing is not this site breaking. One list, so a checker
# cannot quietly disagree with its sibling about what counts as noise. It
# applies to console text only (see watch_console): responses are judged by
# host, which needs no list.
NOISE = (
    "googletagmanager", "google-analytics", "fonts.g", "gstatic",
    "instagram", "bsky", "giscus", "arcgisonline", "openlibrary",
    "lastfm", "audioscrobbler", "wikimedia", "youtube", "tiktok",
    "goodreads", "gr-assets", "github.com", "githubassets",
)

# Where serve() listens. A response from any other host is a third party's.
LOCAL_HOSTS = ("127.0.0.1", "localhost", "::1")


def is_noise(text):
    """True when a console line comes from somewhere we do not control."""
    return any(n in (text or "") for n in NOISE)


def is_own(url, base=None):
    """True when `url` was served by our local server.

    With `base` (what serve() yielded) the origin must match exactly, which
    is what a checker should pass. Without it, any loopback host counts,
    which is the same thing whenever there is only one local server.
    """
    parts = urlsplit(url or "")
    if base:
        own = urlsplit(base)
        return (parts.scheme, parts.netloc) == (own.scheme, own.netloc)
    return parts.hostname in LOCAL_HOSTS


class _QuietHandler(SimpleHTTPRequestHandler):
    """Serves without narrating, and misses the way GitHub Pages does.

    Silencing has to happen on the class: the callers used to assign
    log_message onto a functools.partial, which accepts the attribute and
    ignores it, so every request was still being logged.

    A missing file gets the root's 404.html with status 404, which is what
    Pages sends for any path it has no file for. Python's own error page
    would do for a missing image, but it cannot test 404.html itself, and
    that page only ever runs at somebody else's URL (/blog/typo.html), so
    its relative-path handling (data-kr-root) is exactly what needs a real
    wrong address to prove.
    """

    def log_message(self, *args, **kwargs):
        pass

    def send_error(self, code, message=None, explain=None):
        page = Path(self.directory) / "404.html"
        if code != 404 or self.command not in ("GET", "HEAD") or not page.is_file():
            super().send_error(code, message, explain)
            return
        body = page.read_bytes()
        self.send_response(404, message)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        if self.command == "GET":
            self.wfile.write(body)


class _QuietServer(ThreadingHTTPServer):
    """A browser that closes a page abandons its requests mid-response,
    which the stock server reports as a traceback per request. That is
    the client's choice, not a fault in the site, and a checker that closes
    pages as fast as it can triggers it constantly; anything else still
    prints."""

    def handle_error(self, request, client_address):
        if isinstance(sys.exc_info()[1], ConnectionError):
            return
        super().handle_error(request, client_address)


@contextmanager
def serve(port=0, root=ROOT):
    """A quiet static server on 127.0.0.1, shut down on the way out.

    Yields the base URL, including the port the OS actually assigned when
    `port` is 0. `root` serves another tree, such as a pristine checkout to
    compare against.
    """
    handler = partial(_QuietHandler, directory=str(root))
    server = _QuietServer(("127.0.0.1", port), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown()
        server.server_close()


# A failed subresource logs a console line that names no URL, so the text
# cannot say whose it was: a third-party 404 and one of ours look identical
# here. Those lines are dropped and the same failure is caught on the response
# instead, where the URL is available to filter on. Dropping this prefix is not
# optional; without it every draft reports its own missing giscus thread.
RESOURCE_LINE = "Failed to load resource"

# Prefix on sink entries that came from a response rather than the console,
# so Reporter.console_errors knows not to run them past the text filter again.
HTTP_PREFIX = "HTTP "


def watch_console(page, sink, base=None):
    """Collect our own console errors, uncaught exceptions and failed
    responses into `sink` as they arrive. See the module docstring for why
    console text and responses are filtered differently."""
    page.on("console", lambda m: sink.append(m.text)
            if m.type == "error"
            and not m.text.startswith(RESOURCE_LINE)
            and not is_noise(m.text) else None)
    page.on("pageerror", lambda e: sink.append(f"uncaught: {e}")
            if not is_noise(f"{e} {getattr(e, 'stack', '') or ''}") else None)
    page.on("response", lambda r: sink.append(f"{HTTP_PREFIX}{r.status}: {r.url}")
            if r.status >= 400 and is_own(r.url, base) else None)


THEMES = ("dark", "light")


def set_theme(context, theme):
    """Open every page in `context` in the site's `theme` ("dark" or "light").

    Seeds localStorage['kr-theme'], the key js/theme.js and the inline boot
    script in every page head read, before any page script runs, so the
    first paint is already in that theme. The site ignores
    prefers-color-scheme (dark is its default), so color_scheme on the
    context is not a substitute. Init scripts accumulate on a context, so
    use one context per theme rather than switching one back and forth.
    """
    if theme not in THEMES:
        raise ValueError(f"theme must be one of {THEMES}, not {theme!r}")
    context.add_init_script(
        f"try {{ localStorage.setItem('kr-theme', '{theme}'); }} catch (e) {{}}")


def block_third_parties(context, base):
    """Abort every request in `context` that `base` would not serve.

    Only for checks that measure the site itself; see the module docstring.
    A route handler runs for every request, so this is one closure with no
    work beyond the origin test. Our own requests fall back rather than
    continue, so any other route on the context (a test that rewrites a
    response to break a fix on purpose) still gets them, whichever of the
    two was registered first.
    """
    def route(r):
        if is_own(r.request.url, base):
            r.fallback()
        else:
            r.abort()
    context.route("**/*", route)


def site_context(browser, base, theme="dark", size=(1280, 900), **kw):
    """A browser context for measuring the site: `theme` set (None leaves
    the site's default), third parties aborted, the service worker
    blocked. `size` is (width, height); None leaves the viewport to `kw`
    (a device profile with viewport, is_mobile and has_touch together) or
    to Playwright's default. Other keywords go to browser.new_context."""
    if size is not None:
        kw.setdefault("viewport", {"width": size[0], "height": size[1]})
    context = browser.new_context(service_workers="block", **kw)
    if theme:
        set_theme(context, theme)
    block_third_parties(context, base)
    return context


# The post opener's type sits on a photograph under a scrim, so its colours
# are the same in both themes (style.css §06, "Editorial post opener"). The dark
# theme's paragraph default once repainted the title and the gold kicker
# grey; the smoke pins and the template check both hold them.
OPENER_COLOURS = {"title": "rgb(255, 255, 255)", "kicker": "rgb(255, 232, 158)"}


def open_ahead(context, base, paths, ahead):
    """Yield (path, page, sink) in order while `ahead` more pages load.

    Loading overlaps; measuring does not. Each page is only navigated to
    the point of a response ("commit") before the next one starts, and the
    caller measures and closes them one at a time, so a report stays in
    page order. Each page gets its own console sink (watch_console).
    """
    queue = deque()
    for path in paths:
        page = context.new_page()
        sink = []
        watch_console(page, sink, base)
        try:
            page.goto(f"{base}/{path}", wait_until="commit", timeout=30000)
        except Exception as e:  # noqa: BLE001 - reported with the page
            sink.append(f"navigation failed: {e}")
        queue.append((path, page, sink))
        if len(queue) > ahead:
            yield queue.popleft()
    while queue:
        yield queue.popleft()


def next_frames(page, frames=2):
    """Let the page paint `frames` times, then run one more task.

    Two frames guarantee a redraw queued by the last input has painted, and
    the trailing task is where IntersectionObserver delivers what that frame
    saw. This is the whole of what a 150-300ms sleep used to wait for.
    """
    page.evaluate("""n => new Promise(done => {
        const tick = k => k ? requestAnimationFrame(() => tick(k - 1))
                            : setTimeout(done, 0);
        tick(n);
    })""", frames)


def relative_luminance(rgb):
    """WCAG 2.x relative luminance of an (r, g, b) triple of 0-255 values.

    The sRGB threshold is 0.04045 where WCAG's text prints 0.03928; no
    8-bit channel value falls between them (10/255 is under both, 11/255
    over), so the two give the same ratio for every CSS colour. One copy,
    used by the browser checks and tests/test_contrast.py alike."""
    def channel(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = rgb[:3]
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast_ratio(a, b):
    """WCAG contrast between two colours, each an (r, g, b) triple or a
    relative luminance already worked out (a float)."""
    la = a if isinstance(a, (int, float)) else relative_luminance(a)
    lb = b if isinstance(b, (int, float)) else relative_luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


# Runs in the page. Walks down from each outermost main and footer, checking
# a box before its children: once a box is reported its descendants are not
# (they are the same problem), and once a box clips or scrolls on x its
# descendants cannot push the page, so the walk stops there too. Boxes of a
# pixel or less are visually-hidden text, and visibility:hidden boxes are
# tooltips waiting to be shown; neither is content a reader loses. Not
# modelled: a fixed or absolute box escaping a clipping ancestor that is not
# its containing block. The walk stops at that ancestor and misses it.
_OVERFLOW_JS = """({slack, known}) => {
    const limit = window.innerWidth + slack;
    const found = [];
    const name = el => el.tagName.toLowerCase()
        + (el.id ? '#' + el.id : '')
        + [...el.classList].slice(0, 2).map(c => '.' + c).join('');
    // A bare "a" says nothing about where to look, so an element with no id
    // or class is named from its nearest ancestor that has one (two up).
    const label = (el, up = 2) => {
        const own = name(el);
        const parent = el.parentElement;
        return own.includes('.') || own.includes('#') || !up || !parent
            ? own : label(parent, up - 1) + ' > ' + own;
    };
    const clips = cs => cs.overflowX !== 'visible'
        || /paint|strict|content/.test(cs.contain || '');
    const visit = el => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none') return;
        const r = el.getBoundingClientRect();
        if (cs.visibility !== 'hidden' && r.width > 1 && r.height > 1
                && r.right > limit) {
            found.push({el: label(el), right: Math.round(r.right),
                        width: Math.round(r.width),
                        known: !!(known && el.closest(known))});
            return;
        }
        if (clips(cs)) return;
        for (const child of el.children) visit(child);
    };
    const roots = [...document.querySelectorAll('main, footer')];
    roots.filter(r => !roots.some(o => o !== r && o.contains(r))).forEach(visit);
    return found;
}"""


def element_overflow(page, slack=1, known=None):
    """Outermost visible boxes in main/footer that run past the right edge.

    Returns a list of {"el": "div#id.class" or "li#ref-1 > a", "right": px,
    "width": px, "known": bool}, empty when nothing overflows. An element
    with no id or class is named from the nearest ancestor that has one, so
    the report says where to look. `slack` absorbs sub-pixel
    rounding. `known` is a CSS selector for overflow already owned by a
    planned fix: offenders inside it come back with known=True, so a caller
    can let them pass without going blind to everything else on the page.
    Use this, not documentElement.scrollWidth, which the clipped html and
    body keep equal to the viewport whatever the content does.
    """
    return page.evaluate(_OVERFLOW_JS, {"slack": slack, "known": known})


def describe_overflow(found, limit=3):
    """One line for a report: the first few offenders and how far out."""
    return ", ".join(f"{f['el']} to {f['right']}px" for f in found[:limit])


def own_errors(sink):
    """The entries in a watch_console sink that are ours.

    Response entries were already judged by host on arrival; running them
    past the text filter again would let a noise word in one of our own URLs
    excuse our own 404. Anything else (a sink a checker filled itself) still
    goes through the text filter.
    """
    return [e for e in sink if e.startswith(HTTP_PREFIX) or not is_noise(e)]


class Reporter:
    """Prints as it goes and remembers what failed.

    Checkers were each formatting their own "ok  "/"FAIL" lines and appending
    to their own list; this keeps the output identical while making a check a
    one-liner. `skip` exists because "this post is not on the engine" must not
    read as either a pass or a failure, and `known` because a fault with an
    owner and a planned fix must stay visible without failing every run.
    """

    def __init__(self):
        self.failures = []
        # A failure quotes the page (a link reading "tags were generated
        # ->" with a real arrow), and a Windows console or redirect in a
        # legacy code page cannot encode that: the print raised and took
        # the whole run down with it. Unencodable characters print as
        # escapes instead.
        for stream in (sys.stdout, sys.stderr):
            try:
                stream.reconfigure(errors="backslashreplace")
            except (AttributeError, ValueError):
                pass

    def check(self, scope, name, ok, detail=""):
        suffix = "" if ok or detail == "" else f" -- {detail}"
        print(f"{'ok  ' if ok else 'FAIL'} {scope} :: {name}{suffix}")
        if not ok:
            self.failures.append(f"{scope}: {name}"
                                 + (f" ({detail})" if detail != "" else ""))
        return ok

    def skip(self, scope, name, why):
        print(f"skip {scope} :: {name} ({why})")

    def known(self, scope, name, detail):
        print(f"known {scope} :: {name} ({detail})")

    def note(self, text):
        print(text)

    def console_errors(self, scope, sink, limit=3):
        """Report anything left in a console sink after noise filtering."""
        own = own_errors(sink)
        for e in own[:limit]:
            print(f"FAIL {scope} :: console error: {e[:140]}")
        if own:
            self.failures.append(f"{scope}: console errors")
        return not own

    def summary(self, label):
        if self.failures:
            print(f"\n{len(self.failures)} {label} failure(s)")
            return 1
        print(f"\n{label}: all green")
        return 0
