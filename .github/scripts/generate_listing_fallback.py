#!/usr/bin/env python3
"""The post listings as plain HTML, for readers without JavaScript.

blog.html, series.html and the series landing pages (series-*.html) build
their listings in the browser from data/posts.json: js/blog.js,
js/series-index.js and renderSeriesPage() in js/shared-components.js.
With scripting off, or when a script fails to load, those pages showed a
search box over an empty grid. This script writes the same posts into
each page as a <noscript> list, between two marker comments:

    <!-- BEGIN listing-fallback ... -->
    <!-- END listing-fallback -->

  blog.html           every post, newest first: title (linked) and date
  series.html         every series, most recently updated first (the
                      index's own default sort), each with its parts in
                      part order; the series name links to its page when
                      that page is tracked
  series-<slug>.html  that page's series (its data-series attribute), in
                      part order

Why <noscript>. A browser with scripting on does not render its content
(the parser keeps it as text), so the lists cost a script reader
nothing: no layout shift under the grid, no second copy of every title
for a screen reader, no extra DOM. The markers sit after each grid, never
inside it: an element inside #blog-grid, #series-index-grid or
#series-grid would defeat the :empty rule that holds the grid's height
open while posts.json loads (style.css §09, "Listing body").

The markers are placed by hand, once, where a list belongs, and this
script never guesses a place for them: a target page without exactly one
pair is an error. A new series page copied from an existing one carries
its markers along; a page made from scratch has to add them, and
--check says so.

    python .github/scripts/generate_listing_fallback.py          # rewrite the pages
    python .github/scripts/generate_listing_fallback.py --check  # CI: exit 1 if stale

Idempotent: a page that already lists what posts.json holds is not
touched. Each page keeps its own newline style (CRLF in a Windows working
copy, LF in the repository), and --check compares with newlines
normalised, so it gives the same answer on both. Rerun it whenever
posts.json changes (a new post, a new title or date, a post joining a
series): publishing a post makes these lists stale with no page edited,
the same way it can make style.min.css stale, and --check (in
run_checks.py and CI) is what catches it.
"""
from __future__ import annotations

import html
import re
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402

ROOT = sitelib.ROOT

MARKER = "listing-fallback"
MARKER_NOTE = ("written by .github/scripts/generate_listing_fallback.py from "
               "data/posts.json; edits made here are overwritten.")

# The block between the markers: group 1 is the BEGIN line, group 2 its
# indentation (the list is indented from it), group 3 the generated body,
# group 4 the END line. (?![\w-]) anchors the name exactly, so a later
# block called listing-fallback-something could not be swallowed.
BLOCK_RE = re.compile(
    r"(^([ \t]*)<!-- BEGIN %s(?![\w-])[^\n]*-->\n)(.*?)(^[ \t]*<!-- END %s -->)"
    % (re.escape(MARKER), re.escape(MARKER)),
    re.M | re.S)

SERIES_ATTR_RE = re.compile(r'\bdata-series="([^"]+)"')

MONTHS = ("January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December")


# --- the data -----------------------------------------------------------

def series_names(posts: list[dict]) -> list[str]:
    """Every series, most recently updated first: the newest part's date
    decides, as the series index's default "Updated" sort does; ties go
    by name so the output never depends on file order."""
    latest: dict[str, str] = {}
    for post in posts:
        for entry in sitelib.series_list(post):
            name = entry.get("name")
            if name and post["date"] > latest.get(name, ""):
                latest[name] = post["date"]
    return sorted(latest, key=lambda n: (-_ordinal(latest[n]), n))


def _ordinal(iso: str) -> int:
    return date.fromisoformat(iso).toordinal()


# --- the markup ---------------------------------------------------------

def long_date(iso: str) -> str:
    """"20 September 2026", as formatPostDate() prints a post date."""
    d = date.fromisoformat(iso)
    return f"{d.day} {MONTHS[d.month - 1]} {d.year}"


def text(value: str) -> str:
    return html.escape(value, quote=False)


def attr(value: str) -> str:
    return html.escape(value, quote=True)


def post_item(post: dict) -> str:
    """One post as a list item. The list elements carry no class on
    purpose: the prose link rule in style.css ("Links in running text")
    styles links in an unclassed <ul>/<ol> in <main>, so the titles read
    as the site's links with nothing added to the stylesheet."""
    return ('<li><a href="/%s">%s</a>, <time class="kr-muted" datetime="%s">%s</time></li>'
            % (attr(post["url"]), text(post["title"]), attr(post["date"]),
               long_date(post["date"])))


def blog_lines(posts: list[dict]) -> list[str]:
    newest = sorted(posts, key=lambda p: p["date"], reverse=True)
    return ["<ul>", *("  " + post_item(p) for p in newest), "</ul>"]


def series_index_lines(posts: list[dict], linkable: set[str]) -> list[str]:
    lines: list[str] = []
    for name in series_names(posts):
        href = "/" + sitelib.series_page(name)
        # .h5 (Bootstrap) keeps a series name at list scale: the site's
        # bare h2 is a display size meant for section headings. A link in
        # a heading takes the heading's ink, so .kr-accent-link marks it
        # as one in the action red.
        label = ('<a class="kr-accent-link" href="%s">%s</a>' % (attr(href), text(name))
                 if href.lstrip("/") in linkable else text(name))
        lines.append('<h2 class="h5">%s</h2>' % label)
        lines.append("<ol>")
        lines.extend("  " + post_item(p) for p in sitelib.series_parts(posts, name))
        lines.append("</ol>")
    return lines


def series_page_lines(posts: list[dict], name: str) -> list[str]:
    parts = sitelib.series_parts(posts, name)
    if not parts:
        raise SystemExit(f"no post in data/posts.json is in the series {name!r}")
    return ["<ol>", *("  " + post_item(p) for p in parts), "</ol>"]


def wrap(lines: list[str]) -> list[str]:
    return ["<noscript>", *("  " + ln for ln in lines), "</noscript>"]


# --- the pages ----------------------------------------------------------

def targets(posts: list[dict]) -> dict[Path, list[str]]:
    """Every page this script writes, with the lines it should hold."""
    series_pages = sitelib.tracked("series-*.html")
    linkable = {p.name for p in series_pages}
    wanted = {
        ROOT / "blog.html": blog_lines(posts),
        ROOT / "series.html": series_index_lines(posts, linkable),
    }
    for page in series_pages:
        if page.parent != ROOT:
            continue
        found = SERIES_ATTR_RE.search(page.read_text(encoding="utf-8"))
        if not found:
            raise SystemExit(f"{page.name}: no data-series attribute names its series")
        wanted[page] = series_page_lines(posts, html.unescape(found.group(1)))
    return wanted


def render(page: Path, text_: str, lines: list[str]) -> str:
    """`text_` with its listing-fallback block rewritten to `lines`."""
    found = BLOCK_RE.findall(text_)
    if len(found) != 1:
        raise SystemExit(
            f"{page.name}: expected one <!-- BEGIN {MARKER} --> ... <!-- END {MARKER} --> pair, "
            f"found {len(found)}. Add the two marker lines after the page's grid (see this "
            f"script's docstring), then rerun.")

    def fill(m):
        pad = m.group(2)
        body = "".join((pad + ln).rstrip() + "\n" for ln in wrap(lines))
        begin = f"{pad}<!-- BEGIN {MARKER}: {MARKER_NOTE} -->\n"
        return begin + body + m.group(4)
    return BLOCK_RE.sub(fill, text_, count=1)


def main(argv=None) -> int:
    parser = sitelib.arg_parser(__doc__)
    parser.add_argument("--check", action="store_true",
                        help="exit 1 when a page's list differs from data/posts.json; write nothing")
    args = parser.parse_args(argv)

    posts = sitelib.load_posts()
    stale = []
    for page, lines in targets(posts).items():
        raw = page.read_bytes().decode("utf-8")
        newline = "\r\n" if "\r\n" in raw else "\n"
        current = raw.replace("\r\n", "\n")
        fresh = render(page, current, lines)
        if fresh == current:
            continue
        stale.append(page.name)
        if not args.check:
            page.write_bytes(fresh.replace("\n", newline).encode("utf-8"))
            print(f"{page.name}: no-script listing rewritten")

    if args.check:
        if stale:
            print("the no-script listings no longer match data/posts.json: " + ", ".join(stale))
            print("run: python .github/scripts/generate_listing_fallback.py")
            return 1
        print(f"no-script listings agree with data/posts.json ({len(posts)} posts).")
        return 0
    if not stale:
        print("no-script listings already current.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
