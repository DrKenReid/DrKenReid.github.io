#!/usr/bin/env python3
"""Every published post renders the one post template, checked in a browser.

The smoke suite reads two posts closely. This reads all of them, less
closely: each post in data/posts.json at 1440x900 in the dark theme, and a
spread of LIGHT_SAMPLE of them in the light theme, with every third-party
request aborted (harness.block_third_parties), so a slow embed or an
analytics outage cannot fail a post and nothing here waits on one. 1440 is
wide enough for every piece of the template to be on screen at once: the
contents rail (from 1240px) and the sidenotes (from 1360px).

What each post must show, and the bug each assertion pins:

  one end band        Exactly one footer.kr-post-end, holding its slots in
                      the documented order: the end mark, the sign-off, Up
                      next, related posts, comments (renderPostEnd in
                      js/shared-components.js). The band replaced five
                      functions that each placed one piece relative to
                      whichever of the others existed yet, so the order
                      changed with network timing, and one post got two
                      related-posts blocks.
  no back link        No p.post-cta. Posts used to end on a hand-coded
                      "Back to all posts" pair copied from post to post;
                      the end band routes the reader on now.
  opener colours      Title #fff and kicker #ffe89e in either theme. The
                      dark theme's paragraph default once painted both grey.
  no stray tooltips   No <abbr> inside the meta line, a <summary>, the
                      reference list or a sidenote. Jargon tooltips belong
                      in the prose; in chrome they are noise, and inside
                      a sidenote they doubled up with the note itself.
  sidenotes           One sidenote per distinct reference cited, and every
                      first citation marked data-kr-note="beside" or "far"
                      (the fallback: a note that would have landed too far
                      from its sentence is hidden, and its citation keeps
                      the hover card instead). A reference list in a shape
                      the sidenotes cannot read loses its notes silently.
  progress            With the end mark (.kr-fin) fully in view, the reading
                      bar reads at least PROGRESS_AT_END. It used to measure
                      to the bottom of the comments, so a reader who had
                      finished saw 60%.
  related cards lit   Every related-posts card carries .kr-lit, the hook
                      for the cursor-lit border. The block is baked into
                      each post by generate_related_posts.py and mirrors
                      createBlogCardElement; one builder drifting from the
                      other loses the hover light on one kind of card.
  contents rail       A post with MIN_TOC_HEADINGS or more of its own h2s
                      (and no data-no-toc) gets the rail.
  no overflow         Nothing in main or the footer runs past the right edge
                      (harness.element_overflow).
  no console errors   None of our own: errors, uncaught exceptions, failed
                      requests to the local server.

Adding an assertion: compute the fact in POST_FACTS (one evaluate per
post keeps the run fast), judge it in judge(), and name the regression
here. Prove it bites before trusting it: break the fix in one post's
response with a Playwright route and watch the post fail.

    python .github/scripts/check_post_template.py                 # every post
    python .github/scripts/check_post_template.py blog/x.html     # just these

Exit status 0 when every post passes, 1 otherwise.
"""
import sys
import time
from collections import Counter
from pathlib import Path

from playwright.sync_api import TimeoutError as PlaywrightTimeout
from playwright.sync_api import sync_playwright

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402
from harness import (OPENER_COLOURS, Reporter,  # noqa: E402
                     describe_overflow, element_overflow, next_frames,
                     open_ahead, own_errors, serve, site_context)

# 0 lets the OS pick a free port (see harness.serve).
PORT = 0

VIEWPORT = (1440, 900)

# How many posts the light pass reads, picked evenly across posts.json
# (newest to oldest), so the sample covers old and new markup alike.
LIGHT_SAMPLE = 5

# Posts loading behind the one being measured (harness.open_ahead).
AHEAD = 3

# How long a post may take to finish building its template. The end band
# fills in once posts.json arrives; with third parties aborted that is
# well under a second locally.
READY_MS = 8000

# The end band's slots, in renderPostEnd's order.
SLOTS = ("mark", "signoff", "upnext", "related", "comments")

# The reading bar with the end mark fully in view. Not exactly 1: the bar
# is written on the next animation frame after a scroll, from positions
# rounded to the pixel.
PROGRESS_AT_END = 0.98

# Section headings a post needs before it gets the contents rail
# (renderPostToc).
MIN_TOC_HEADINGS = 4

# The template has finished building: the end band exists, and Up next has
# its links (or removed itself, which the slot check then reports).
READY = """() => document.readyState === 'complete'
    && !!document.querySelector('.kr-post-end')
    && (!document.querySelector('.kr-upnext')
        || !!document.querySelector('.kr-upnext .post-pagination a'))
    && (!document.querySelector('.kr-post-end__related')
        || !!document.querySelector('.kr-post-end__related .related-posts'))
    && document.fonts.status === 'loaded'"""

# Everything judge() needs, in one evaluate. The h2 furniture list mirrors
# the template's own (collectSectionHeadings): headings that belong to the
# end band, the FAQ, the jargon box or a demo are not the post's sections.
POST_FACTS = """() => {
    const post = document.querySelector('.blog-post');
    const end = document.querySelectorAll('.kr-post-end');
    const slot = el => el.classList.contains('kr-post-end__mark') ? 'mark'
        : el.classList.contains('kr-signoff') ? 'signoff'
        : el.classList.contains('kr-upnext') ? 'upnext'
        : el.classList.contains('kr-post-end__related') ? 'related'
        : el.id === 'giscus-comments' ? 'comments'
        : el.tagName.toLowerCase() + '.' + [...el.classList].join('.');
    const colour = s => { const e = document.querySelector(s); return e && getComputedStyle(e).color; };

    const stray = ['.blog-meta', '.blog-post summary', 'ol.references', '#references', '.kr-sidenote']
        .filter(s => document.querySelector(s + ' abbr'));

    const firsts = new Map();
    for (const a of document.querySelectorAll('.blog-post a.cite-ref[href^="#"]')) {
        const id = a.getAttribute('href').slice(1);
        const target = document.getElementById(id);
        if (target && target.closest('ol.references') && !firsts.has(id)) firsts.set(id, a);
    }
    const marks = [...firsts.values()].map(a => a.getAttribute('data-kr-note'));

    const furniture = '.kr-post-end, .related-posts, .faq-section, .plain-english-box,'
        + ' .giscus-comments, .blog-thanks-cta, .post-pagination, .kr-viz';
    const h2s = post ? [...post.querySelectorAll('h2')].filter(h => !h.closest(furniture)
        && (h.textContent || '').trim() && h.textContent.trim() !== 'Common questions').length : 0;

    const cards = [...document.querySelectorAll('.kr-post-end__related .related-posts .blog-card')];
    return {
        ends: end.length,
        slots: end.length ? [...end[0].children].map(slot) : [],
        backLinks: document.querySelectorAll('.post-cta').length,
        opener: {title: colour('.kr-opener .kr-opener__title'), kicker: colour('.kr-opener .kr-opener__kicker')},
        stray,
        cited: firsts.size,
        notes: document.querySelectorAll('.blog-post .kr-sidenote').length,
        far: document.querySelectorAll('.blog-post .kr-sidenote.is-far').length,
        beside: marks.filter(m => m === 'beside').length,
        farMarked: marks.filter(m => m === 'far').length,
        cards: cards.length,
        unlit: cards.filter(c => !c.classList.contains('kr-lit')).length,
        h2s,
        noToc: !!(post && post.hasAttribute('data-no-toc')),
        toc: document.querySelectorAll('nav.kr-toc a').length,
    };
}"""

# Scroll the end mark fully into view, instantly (the site scrolls
# smoothly).
SHOW_END = """() => {
    const fin = document.querySelector('.kr-fin');
    if (fin) fin.scrollIntoView({block: 'end', behavior: 'instant'});
}"""

# Whether the end mark is in view (to within a pixel of rounding), and the
# bar's own scale as renderReadingProgress wrote it.
PROGRESS = """() => {
    const fin = document.querySelector('.kr-fin');
    const r = fin && fin.getBoundingClientRect();
    const bar = document.querySelector('.kr-progress-bar');
    const m = bar && /scaleX\\(([\\d.]+)\\)/.exec(bar.style.transform);
    return [!!r && r.top >= -1 && r.bottom <= innerHeight + 1, m ? parseFloat(m[1]) : null];
}"""


def light_sample(urls, n=LIGHT_SAMPLE):
    """`n` posts spread evenly over `urls`, first and last included."""
    if len(urls) <= n:
        return list(urls)
    step = (len(urls) - 1) / (n - 1)
    return [urls[round(i * step)] for i in range(n)]


def judge(facts, progress, in_view):
    """The failures for one post, as (assertion, detail) pairs."""
    bad = []
    if facts["ends"] != 1 or tuple(facts["slots"]) != SLOTS:
        bad.append(("one end band, slots in order",
                    f"{facts['ends']} bands; slots {facts['slots']}, want {list(SLOTS)}"))
    if facts["backLinks"]:
        bad.append(("no hand-coded back link", f"{facts['backLinks']} .post-cta"))
    if facts["opener"] != OPENER_COLOURS:
        bad.append(("opener title #fff, kicker #ffe89e", facts["opener"]))
    if facts["stray"]:
        bad.append(("no <abbr> in chrome", ", ".join(facts["stray"])))
    if facts["cited"]:
        if facts["notes"] != facts["cited"]:
            bad.append(("a sidenote per cited reference",
                        f"{facts['notes']} notes for {facts['cited']} references"))
        if facts["beside"] + facts["farMarked"] != facts["cited"] or facts["farMarked"] != facts["far"]:
            bad.append(("each first citation marked beside or far",
                        f"{facts['beside']} beside + {facts['farMarked']} far of {facts['cited']};"
                        f" {facts['far']} notes hidden as far"))
    if not in_view or progress is None or progress < PROGRESS_AT_END:
        bad.append((f"progress at least {PROGRESS_AT_END} at the end mark",
                    f"bar {progress}, end mark {'in' if in_view else 'not in'} view"))
    if not facts["cards"] or facts["unlit"]:
        bad.append(("related cards carry .kr-lit", f"{facts['unlit']} of {facts['cards']} without it"))
    if facts["h2s"] >= MIN_TOC_HEADINGS and not facts["noToc"] and facts["toc"] < MIN_TOC_HEADINGS:
        bad.append(("contents rail", f"{facts['h2s']} sections, {facts['toc']} rail links"))
    return bad


def check_post(page, path, theme, sink, rep, seen):
    """Wait for one post's template, then judge it. Returns True on a pass.
    `seen` (a Counter) tallies what the post gave the checks to read, so the
    summary can say how much of each assertion actually ran."""
    scope = f"{path} {theme}"
    try:
        page.wait_for_function(READY, timeout=READY_MS)
    except PlaywrightTimeout:
        rep.check(scope, f"template built within {READY_MS / 1000:g}s", False)
        rep.console_errors(scope, sink)
        return False
    facts = page.evaluate(POST_FACTS)
    seen["posts"] += 1
    seen["with sidenotes"] += facts["cited"] > 0
    seen["sidenotes"] += facts["notes"]
    seen["with a contents rail"] += facts["toc"] > 0
    seen["related cards"] += facts["cards"]
    page.evaluate(SHOW_END)
    next_frames(page, 3)
    in_view, progress = page.evaluate(PROGRESS)
    bad = judge(facts, progress, in_view)
    page.evaluate("window.scrollTo({top: 0, behavior: 'instant'})")
    spill = element_overflow(page)
    if spill:
        bad.append(("no element overflow", describe_overflow(spill)))
    if not bad and not own_errors(sink):
        rep.check(scope, "template holds", True)
        return True
    for name, detail in bad:
        rep.check(scope, name, False, detail)
    rep.console_errors(scope, sink)
    return False


def run(browser, base, theme, paths, rep, seen):
    """Every post in `paths` in one theme. Returns the number that passed."""
    context = site_context(browser, base, theme, VIEWPORT)
    passed = 0
    for path, page, sink in open_ahead(context, base, paths, AHEAD):
        passed += check_post(page, path, theme, sink, rep, seen)
        page.close()
    context.close()
    return passed


def main(argv=None):
    parser = sitelib.arg_parser(__doc__)
    parser.add_argument("posts", nargs="*", metavar="blog/POST.html",
                        help="check only these posts (default: every post in posts.json)")
    args = parser.parse_args(argv)

    urls = [p["url"] for p in sitelib.load_posts()]
    if args.posts:
        unknown = [p for p in args.posts if p not in urls]
        if unknown:
            parser.error(f"not in posts.json: {', '.join(unknown)}")
        urls = args.posts

    rep = Reporter()
    seen = Counter()
    started = time.monotonic()
    with serve(PORT) as base, sync_playwright() as pw:
        browser = pw.chromium.launch()
        dark = run(browser, base, "dark", urls, rep, seen)
        sample = light_sample(urls)
        light = run(browser, base, "light", sample, rep, seen)
        browser.close()
    rep.note(f"\n{dark} of {len(urls)} posts pass in dark, {light} of {len(sample)} in light;"
             f" ran in {time.monotonic() - started:.0f}s")
    rep.note("read: " + ", ".join(f"{n} {what}" for what, n in seen.items()))
    return rep.summary("post template")


if __name__ == "__main__":
    sys.exit(main())
