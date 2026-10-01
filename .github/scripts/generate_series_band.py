#!/usr/bin/env python3
"""The "Read in order" band under the blog listing, from data/posts.json.

blog.html lists every post, newest first, and a series is easy to miss
in it: one part turns up on page one, the next on page three. The band
sits under the grid and puts three series in front of a reader who has
come to the end of a page of posts, as cards that open each series'
own page (series-<slug>.html: an introduction and every part in order).
It is written into blog.html between two marker comments:

    <!-- BEGIN series-band ... -->
    <!-- END series-band -->

Which series. Those with at least MIN_PARTS parts, most recently updated
first (the newest part's date; ties by name), BAND_SIZE of them. A run of
one or two posts is barely a series yet, and "updated" keeps the band
turning over as parts are published. The choice depends on posts.json
alone, never on today's date, so --check gives the same answer on any
day until a post is published.

Each card is the series index's card (seriesCardHtml in
js/series-index.js): part one's cover and hover sketch, the part count
and the whole run's reading time on the photograph, when it was last
updated, the name, and a line on what the series is. That line is the series
page's own <meta name="description">, so a series is described in one
place. A series in the band needs a tracked page with a description;
without one this script stops and says so.

Why baked, not built in the browser. The band is below the fold and
changes only when a post is published, so there is nothing to compute
per visit. As HTML it is there without JavaScript and is a set of plain
links for a crawler, and it moves nothing on the page when posts.json
arrives. js/blog.js hides it while the list is searched or filtered.

    python .github/scripts/generate_series_band.py          # rewrite blog.html
    python .github/scripts/generate_series_band.py --check  # CI: exit 1 if stale

Idempotent, and it keeps blog.html's own newline style (CRLF in a
Windows working copy, LF in the repository); --check compares with
newlines normalised. Publishing a post can make the band stale with no
page edited, as it can the no-script listing, so run_checks.py --fix
runs this after the listing.
"""
from __future__ import annotations

import html
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402

ROOT = sitelib.ROOT
PAGE = ROOT / "blog.html"
MARKER = "series-band"
MARKER_NOTE = ("written by .github/scripts/generate_series_band.py from "
               "data/posts.json and the series pages; edits made here are overwritten.")

MIN_PARTS = 3
BAND_SIZE = 3

DESCRIPTION_RE = re.compile(r'<meta\s+name="description"\s+content="([^"]*)"', re.I)


# --- the data -----------------------------------------------------------

def series_records(posts: list[dict]) -> list[dict]:
    """Every series with its parts in order and its totals, most recently
    updated first (ties by name, so file order never decides)."""
    names = {e["name"] for p in posts for e in sitelib.series_list(p) if e.get("name")}
    records = []
    for name in names:
        parts = sitelib.series_parts(posts, name)
        records.append({
            "name": name,
            "parts": parts,
            "updated": max(p["date"] for p in parts),
            # As the series index sums it: the whole run, part by part.
            "minutes": sum(p.get("readMinutes") or 0 for p in parts),
        })
    records.sort(key=lambda r: r["name"])
    records.sort(key=lambda r: r["updated"], reverse=True)
    return records


def band_series(posts: list[dict]) -> list[dict]:
    return [r for r in series_records(posts) if len(r["parts"]) >= MIN_PARTS][:BAND_SIZE]


def description(name: str) -> str:
    """The series page's meta description, entities decoded."""
    page = ROOT / sitelib.series_page(name)
    if not page.is_file() or page not in set(sitelib.tracked("series-*.html")):
        raise SystemExit(f"series band: {name!r} has no tracked page {page.name}; make one "
                         "(.github/docs/ARCHITECTURE.md, \"Adding a series\") before it can be shown")
    found = DESCRIPTION_RE.search(page.read_text(encoding="utf-8"))
    if not found or not found.group(1).strip():
        raise SystemExit(f"series band: {page.name} has no <meta name=\"description\">; "
                         "the band shows it as the series' one-line summary")
    return html.unescape(found.group(1)).strip()


# --- the markup ---------------------------------------------------------

def text(value: str) -> str:
    return html.escape(value, quote=False)


def attr(value: str) -> str:
    return html.escape(value, quote=True)


def srcset_attr(src: str) -> str:
    """' srcset="..."' for a thumbnail cover, as the series index's card
    has it (krSrcsetAttr), or ""."""
    srcset = sitelib.thumb_srcset(src)
    return ' srcset="%s"' % attr(srcset) if srcset else ""


def card_lines(record: dict, blurb: str) -> list[str]:
    """One series card: the markup seriesCardHtml() builds on series.html,
    with an h3 (the band's own heading is the h2) and the series' summary
    where the index shows its latest part."""
    first = record["parts"][0]
    cover = "/" + (first.get("image") or sitelib.DEFAULT_POST_IMAGE)
    count = len(record["parts"])
    return [
        # Site-absolute cover in --kr-cover: a relative url() in a custom
        # property would resolve against the stylesheet, not this page.
        "<div class=\"col-12 col-md-6 col-lg-4 mb-30 kr-glow-host\" style=\"--kr-cover: url('%s')\">"
        % attr(cover),
        '  <a href="/%s" class="blog-card kr-lit" data-live-href="%s">'
        % (attr(sitelib.series_page(record["name"])), attr(first["url"])),
        '    <span class="kr-lit__ring" aria-hidden="true"></span>',
        '    <div class="blog-card-img"><img src="%s"%s alt="" loading="lazy">'
        '<span class="kr-series-chip">%d %s &middot; %d min</span></div>'
        % (attr(cover), srcset_attr(cover), count, "part" if count == 1 else "parts", record["minutes"]),
        '    <div class="blog-card-body">',
        '      <div class="blog-card-date">Updated %s</div>' % sitelib.long_date(record["updated"]),
        '      <h3 class="blog-card-title">%s</h3>' % text(record["name"]),
        '      <p class="blog-card-excerpt">%s</p>' % text(blurb),
        '    </div>',
        '  </a>',
        '</div>',
    ]


def band_lines(posts: list[dict]) -> list[str]:
    chosen = band_series(posts)
    if not chosen:
        return []
    total = len(series_records(posts))
    lines = [
        '<section id="series-band" class="kr-series-band" aria-labelledby="series-band-title">',
        '  <div class="section-heading section-heading--sm text-center">',
        '    <span class="section-eyebrow">Series</span>',
        '    <h2 id="series-band-title">Read in order</h2>',
        '    <p class="section-heading__lede">Some ideas take more than one post. '
        'Each series page has every part in order, with an introduction.</p>',
        '  </div>',
        '  <div class="row justify-content-center">',
    ]
    for record in chosen:
        lines.extend("    " + ln for ln in card_lines(record, description(record["name"])))
    lines += [
        '  </div>',
        '  <div class="kr-btn-row">',
        '    <a href="/series.html" class="kr-btn kr-btn--ghost">All %d series</a>' % total,
        '  </div>',
        '</section>',
    ]
    return lines


# --- the page -----------------------------------------------------------

def main(argv=None) -> int:
    parser = sitelib.arg_parser(__doc__)
    parser.add_argument("--check", action="store_true",
                        help="exit 1 when blog.html's band differs from data/posts.json; write nothing")
    args = parser.parse_args(argv)

    posts = sitelib.load_posts()
    raw = PAGE.read_bytes().decode("utf-8")
    newline = "\r\n" if "\r\n" in raw else "\n"
    current = raw.replace("\r\n", "\n")
    fresh = sitelib.fill_block(current, MARKER, band_lines(posts), MARKER_NOTE, PAGE.name)
    names = ", ".join(r["name"] for r in band_series(posts)) or "none"

    if args.check:
        if fresh != current:
            print("blog.html: the Read in order band no longer matches data/posts.json.")
            print("run: python .github/scripts/generate_series_band.py")
            return 1
        print(f"blog.html series band is current ({names}).")
        return 0
    if fresh == current:
        print(f"blog.html series band already current ({names}).")
        return 0
    PAGE.write_bytes(fresh.replace("\n", newline).encode("utf-8"))
    print(f"blog.html: series band rewritten ({names}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
