#!/usr/bin/env python3
"""The publication list on data_science.html, from data/publications.json.

One file holds every paper; this script writes it into the page twice:

  * the visible list, with the citation pill above it that links to the
    Google Scholar profile, between
        <!-- BEGIN publications ... -->  and  <!-- END publications -->
  * the ItemList of ScholarlyArticle JSON-LD in the <head>, between
        <!-- BEGIN publications-jsonld ... -->  and  <!-- END publications-jsonld -->

Both used to be typed by hand, side by side, and nothing kept them in
step: a citation count refreshed in the list and not in the markup, or a
title corrected in one and not the other, would have gone unnoticed.
From one source they cannot disagree, and --check fails when the page no
longer says what the JSON says.

data/publications.json
----------------------
Its shape (every field, its type, and patterns such as a bare DOI) is
data/schema/publications.schema.json, checked by validate_data.py in CI
and by this script before it writes. This script adds the checks one
file cannot make about itself: ids unique and matching their Scholar URL,
firstAuthor agreeing with the author list, each sketch registered in
js/covers*.js, each post in posts.json, and the profile total at least
the papers' sum.

  scholar.profile   the Google Scholar profile URL (the citation pill's link)
  scholar.citations the profile's total citation count, as Scholar shows
                    it. Typed in, not summed: the total also counts the
                    thesis and anything not listed here, so it is at least
                    the sum of the papers' counts, and the script refuses a
                    total below that sum (a sign one side was refreshed
                    and the other forgotten).
  selected          which papers the default "Selected" view shows:
                    {"mostCited": n, "mostRecent": m} picks the n most-cited
                    and the m newest papers (their union; a paper that is
                    both counts once).

Each entry in "publications", in newest-first order (the order the
"All, by year" view and the JSON-LD use; ties keep file order):
  id           Scholar's citation_for_view value ("<user>:<paper>"); must
               appear in url, which is how an entry is matched to Scholar
               when the counts are refreshed
  title        as Scholar lists it
  authors      list of names as Scholar abbreviates them ("KN Reid");
               Ken's own name (KEN_NAMES below) is set in bold
  etAl         true when Scholar truncated the author list
  venue        the full venue line, taken from the publisher's record
               (Crossref, arXiv or the preprint server) rather than
               Scholar's, which is sometimes garbled
  venueShort   short label shown in the list ("GECCO"), with the full
               venue in its <abbr title>; null shows the venue itself.
               No year: the year is printed beside it
  year         publication year (int)
  citations    this paper's Scholar count (int; 0 hides the badge)
  url          the Scholar citation page the title links to
  doi          bare DOI ("10.1093/g3journal/jkab032") or null
  pdf          a full-text link or null
  firstAuthor  true when Ken is the first author; checked against authors
  live         the data-live key for the hover sketch: "pub:<name>" from
               js/covers-site.js, or a post slug from js/covers.js when a
               post already has a sketch for the paper. Written into the
               page exactly as given; the script checks the sketch exists.
  post         the blog post that runs the paper ("blog/x.html", as in
               posts.json) or null; adds a "Watch it run" link
  kind         optional: paper (the default), preprint, report, poster or
               thesis. Sets the JSON-LD type
  date         optional "YYYY", "YYYY-MM" or "YYYY-MM-DD": orders papers
               inside a year and decides which are the most recent

The Selected view is the most-cited papers plus the newest ones, so the
work the field uses and the work that is current both show without a
click. Within it papers go by citations (most first), then newest; the
rest of the list follows newest first. The page is written in that order
so a reader without script sees it. The script in data_science.html only
re-sorts to "All, by year" (data-pub-order) and hides the unselected
papers (data-pub-more) until that view is chosen.

Scholar also indexes two of the blog posts. They are left out on purpose:
they are posts, not publications, and have no citations, so the papers'
sum still matches the profile total.

Refreshing citations (before every push): open the Scholar profile, copy
the total into scholar.citations and each paper's count into its entry
(match on id), then run this script and commit the JSON and the page
together.

    python .github/scripts/generate_publications.py          # rewrite the page
    python .github/scripts/generate_publications.py --check  # CI: exit 1 if stale

Idempotent: a page that already says what the JSON says is not touched.
The page's own newline style is kept (CRLF in a Windows working copy, LF
on the runner and in the repository), and the comparison ignores it, so
--check gives the same answer on both.
"""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402
import validate_data  # noqa: E402

ROOT = sitelib.ROOT
DATA = ROOT / "data" / "publications.json"
SCHEMA = ROOT / "data" / "schema" / "publications.schema.json"
PAGE = ROOT / "data_science.html"
POSTS = sitelib.POSTS_JSON
SKETCH_SOURCES = [ROOT / "js" / "covers.js", ROOT / "js" / "covers-site.js"]
SITE = sitelib.SITE

# How Scholar abbreviates Ken; these are set in bold and decide firstAuthor.
KEN_NAMES = {"KN Reid", "K Reid"}
# The Person on the page's ProfilePage JSON-LD. Ken's author entries point
# at it, so a reader of the markup can tell which "KN Reid" is the page's
# subject rather than matching strings.
PERSON_ID = SITE + "/#ken"

# def('key', ...) in the sketch files; site keys carry a "pub:" style prefix.
SKETCH_DEF = re.compile(r"\bdef(?:ine)?\(\s*'([a-z0-9:-]+)'")

BLOCKS = {
    "publications": "the publication list",
    "publications-jsonld": "the ScholarlyArticle JSON-LD",
}

def block_re(name):
    """The generated region of one block: group 1 is the start marker line,
    group 2 its indentation, group 3 the body, group 4 the end marker line.
    Both markers are anchored on the exact name ((?![\\w-]), not \\b, which
    would let "publications" match the start of "publications-jsonld" and
    swallow everything between the two blocks)."""
    return re.compile(
        r"(^([ \t]*)<!-- BEGIN %s(?![\w-])[^\n]*-->\n)(.*?)(^[ \t]*<!-- END %s -->)"
        % (re.escape(name), re.escape(name)),
        re.M | re.S)


# --- data -------------------------------------------------------------

def load():
    data = json.loads(DATA.read_text(encoding="utf-8-sig"))
    pubs = data.get("publications") or []
    errors = validate(data, pubs)
    if errors:
        print("data/publications.json has %d problem(s):" % len(errors))
        for e in errors:
            print("  " + e)
        sys.exit(2)
    return data, pubs


def sketch_keys():
    keys = set()
    for src in SKETCH_SOURCES:
        if src.exists():
            keys.update(SKETCH_DEF.findall(src.read_text(encoding="utf-8")))
    return keys


def validate(data, pubs):
    """Every problem with the data, as printable lines; empty when valid.

    The shape first, against the file's own schema through validate_data.py
    (the check CI also runs on its own), so there is one statement of which
    fields exist and what they hold. The checks after it need other files
    or compare fields, which a schema cannot, and run only on a
    well-formed file, where they can read any field without guarding it."""
    schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
    validate_data.check_schema(schema)
    errors = []
    validate_data.validate(data, schema, DATA.name, errors)
    if errors:
        return errors
    if not pubs:
        return ["no publications"]
    for key in ("mostCited", "mostRecent"):
        if data["selected"][key] > len(pubs):
            errors.append("selected.%s (%d) is more than the %d papers listed"
                          % (key, data["selected"][key], len(pubs)))
    if not selected_ids(data, pubs):
        errors.append("selected picks no papers: raise mostCited or mostRecent")

    sketches = sketch_keys()
    post_urls = {p.get("url") for p in sitelib.load_posts(POSTS)}
    seen = set()
    for i, p in enumerate(pubs):
        where = "publications[%d] (%s)" % (i, p["id"])
        if p["id"] in seen:
            errors.append("%s: duplicate id" % where)
        seen.add(p["id"])
        if "citation_for_view=" + p["id"] not in p["url"]:
            errors.append("%s: url is not the Scholar page for this id" % where)
        # Scholar cuts long author lists short, sometimes before Ken's name
        # (the LLM outlook paper), so a truncated list may not show him.
        if not p["etAl"] and not any(a in KEN_NAMES for a in p["authors"]):
            errors.append("%s: no author matches %s" % (where, sorted(KEN_NAMES)))
        if p["firstAuthor"] != (p["authors"][:1] != [] and p["authors"][0] in KEN_NAMES):
            errors.append("%s: firstAuthor disagrees with the author list" % where)
        if p["live"] not in sketches:
            errors.append("%s: no sketch registered as '%s' in js/covers*.js" % (where, p["live"]))
        if p["post"] and p["post"] not in post_urls:
            errors.append("%s: post %s is not in data/posts.json" % (where, p["post"]))
    if not errors:
        total = sum(p["citations"] for p in pubs)
        if data["scholar"]["citations"] < total:
            errors.append("scholar.citations (%d) is below the papers' own sum (%d): "
                          "refresh both from the profile" % (data["scholar"]["citations"], total))
    return errors


def kind(p):
    return p.get("kind") or "paper"


def recency(p):
    """A sortable (year, month, day) from `date`, or the year alone.
    Missing parts count as 0, so newest first puts a paper dated only by
    its year after the dated papers of that year."""
    parts = [int(x) for x in (p.get("date") or str(p["year"])).split("-")]
    return tuple(parts + [0] * (3 - len(parts)))


def selected_ids(data, pubs):
    """The ids of the papers the default view shows: the `mostCited` papers
    with the most citations (newer first on a tie) plus the `mostRecent`
    newest (more cited first on a tie)."""
    cfg = data["selected"]
    cited = sorted(pubs, key=lambda p: (-p["citations"], tuple(-x for x in recency(p))))
    recent = sorted(pubs, key=lambda p: (tuple(-x for x in recency(p)), -p["citations"]))
    return {p["id"] for p in cited[:cfg["mostCited"]] + recent[:cfg["mostRecent"]]}


def selected_order(data, pubs):
    """The selected papers by citations (most first, then newest), then
    everything else newest first. Returns (ordered list, number selected)."""
    chosen = selected_ids(data, pubs)
    head = sorted((p for p in pubs if p["id"] in chosen),
                  key=lambda p: (-p["citations"], tuple(-x for x in recency(p))))
    tail = [p for p in year_order(pubs) if p["id"] not in chosen]
    return head + tail, len(head)


def year_order(pubs):
    """Newest first by date where given; equal dates keep their file order."""
    return sorted(pubs, key=lambda p: tuple(-x for x in recency(p)))


# --- the visible list -------------------------------------------------

def text(s):
    """Escaped for element content. Apostrophes stay as typed: "Ken's"
    reads better in the source than "Ken&#x27;s"."""
    return html.escape(s, quote=False)


def attr(s):
    """Escaped for a double-quoted attribute value."""
    return text(s).replace('"', "&quot;")


def plural(n, word):
    return "%d %s%s" % (n, word, "" if n == 1 else "s")


def authors_html(p):
    names = [("<strong>%s</strong>" % text(a)) if a in KEN_NAMES else text(a) for a in p["authors"]]
    # A no-break space keeps "et al." from splitting over two lines.
    return ", ".join(names) + (", et&nbsp;al." if p["etAl"] else "")


def meta_html(p):
    """Venue, year, citations, then the reader's ways in. Each item is its
    own element; the separators are drawn by CSS so they stay out of the
    text a screen reader or a copy-paste picks up."""
    items = []
    if p.get("venueShort") and p["venueShort"] != p["venue"]:
        items.append('<abbr class="ds-pub-venue" title="%s">%s</abbr>' % (attr(p["venue"]), text(p["venueShort"])))
    else:
        items.append('<span class="ds-pub-venue">%s</span>' % text(p["venue"]))
    items.append('<span class="ds-pub-year">%d</span>' % p["year"])
    if p["citations"]:
        items.append('<span class="ds-citation-badge">%s</span>' % plural(p["citations"], "citation"))
    if p.get("doi"):
        items.append('<a class="ds-pub-link" href="https://doi.org/%s" target="_blank" rel="noopener">DOI</a>'
                     % attr(p["doi"]))
    if p.get("pdf"):
        items.append('<a class="ds-pub-link" href="%s" target="_blank" rel="noopener">PDF</a>' % attr(p["pdf"]))
    if p.get("post"):
        items.append('<a class="ds-pub-link ds-pub-watch" href="/%s">Watch it run <span aria-hidden="true">&rarr;</span></a>'
                     % attr(p["post"]))
    # A space between items keeps copied text readable ("GECCO 2021");
    # the CSS dot sits after it.
    return " ".join(items)


def list_lines(data, pubs):
    order = {p["id"]: i + 1 for i, p in enumerate(year_order(pubs))}
    ordered, shown = selected_order(data, pubs)
    total = data["scholar"]["citations"]
    lines = [
        '<div class="ds-pub-toolbar">',
        '  <a href="%s" target="_blank" rel="noopener" class="ds-cite-pill">%s on Google Scholar</a>'
        % (attr(data["scholar"]["profile"]), plural(total, "citation")),
        '  <div class="ds-pub-sort" role="group" aria-label="Which papers to show" hidden>',
        '    <button type="button" class="gallery-filter-btn active" data-pub-sort="selected" '
        'aria-pressed="true" aria-controls="ds-pub-list">Selected</button>',
        '    <button type="button" class="gallery-filter-btn" data-pub-sort="year" '
        'aria-pressed="false" aria-controls="ds-pub-list">All, by year</button>',
        '  </div>',
        '</div>',
        '<ol class="ds-pub-list" id="ds-pub-list" role="list">',
    ]
    for rank, p in enumerate(ordered):
        more = " data-pub-more" if rank >= shown else ""
        lines += [
            '  <li data-live="%s" class="ds-pub-entry" data-pub-order="%d"%s>'
            % (attr(p["live"]), order[p["id"]], more),
            '    <span class="kr-pub-stage" data-live-host aria-hidden="true"></span>',
            '    <h3 class="ds-pub-title"><a href="%s" target="_blank" rel="noopener">%s</a></h3>'
            % (attr(p["url"]), text(p["title"])),
            '    <p class="ds-pub-authors">%s</p>' % authors_html(p),
            '    <p class="ds-pub-meta">%s</p>' % meta_html(p),
            '  </li>',
        ]
    lines.append('</ol>')
    return lines


# --- the JSON-LD ------------------------------------------------------

# schema.org types by kind; a preprint is still a ScholarlyArticle, and
# schema.org has no poster type, so a poster is a plain CreativeWork.
JSONLD_TYPE = {"paper": "ScholarlyArticle", "preprint": "ScholarlyArticle", "report": "Report",
               "poster": "CreativeWork", "thesis": "Thesis"}


def author_node(name):
    node = {"@type": "Person", "name": name}
    if name in KEN_NAMES:
        node["@id"] = PERSON_ID
    return node


def jsonld_lines(pubs):
    items = []
    for pos, p in enumerate(year_order(pubs), 1):
        art = {
            "@type": JSONLD_TYPE[kind(p)],
            "headline": p["title"],
            "url": p["url"],
            "author": [author_node(a) for a in p["authors"]],
            "datePublished": p.get("date") or str(p["year"]),
            "isPartOf": p["venue"],
        }
        if p.get("doi"):
            art["sameAs"] = "https://doi.org/" + p["doi"]
        items.append({"@type": "ListItem", "position": pos, "item": art})
    doc = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Publications by Kenneth N. Reid",
        "numberOfItems": len(items),
        "itemListElement": items,
    }
    text = json.dumps(doc, indent=2, ensure_ascii=False)
    # One author per line: the default indent spends four lines on each.
    text = re.sub(r'\{\s*("@type": "Person",)\s*("name": "[^"]*")(,)?\s*("@id": "[^"]*")?\s*\}',
                  lambda m: "{%s %s%s}" % (m.group(1), m.group(2),
                                           ", " + m.group(4) if m.group(4) else ""), text)
    # A title containing "</script>" must not end the element early.
    text = text.replace("</", "<\\/")
    return (['<script type="application/ld+json">']
            + ["  " + line for line in text.split("\n")]
            + ['</script>'])


# --- the page ---------------------------------------------------------

def render(text, data, pubs):
    """The page with both blocks regenerated, or raise if a marker is missing."""
    wanted = {"publications": list_lines(data, pubs), "publications-jsonld": jsonld_lines(pubs)}
    for name, lines in wanted.items():
        rx = block_re(name)
        found = rx.findall(text)
        if len(found) != 1:
            raise SystemExit("data_science.html: expected one '%s' block (%s), found %d"
                             % (name, BLOCKS[name], len(found)))

        def fill(m, lines=lines):
            pad = m.group(2)
            body = "".join((pad + ln).rstrip() + "\n" for ln in lines)
            return m.group(1) + body + m.group(4)
        text = rx.sub(fill, text, count=1)
    return text


def main(argv=None):
    ap = sitelib.arg_parser(__doc__)
    ap.add_argument("--check", action="store_true",
                    help="exit 1 when data_science.html is not what the JSON produces; write nothing")
    args = ap.parse_args(argv)

    data, pubs = load()
    raw = PAGE.read_bytes().decode("utf-8")
    newline = "\r\n" if "\r\n" in raw else "\n"
    current = raw.replace("\r\n", "\n")
    fresh = render(current, data, pubs)

    if args.check:
        if fresh != current:
            print("data_science.html: the publication list or its JSON-LD no longer "
                  "matches data/publications.json.")
            print("run: python .github/scripts/generate_publications.py")
            return 1
        print("data_science.html publications agree with data/publications.json "
              "(%d papers, %d citations)." % (len(pubs), data["scholar"]["citations"]))
        return 0

    if fresh == current:
        print("data_science.html already current (%d papers)." % len(pubs))
        return 0
    PAGE.write_bytes(fresh.replace("\n", newline).encode("utf-8"))
    print("data_science.html: publications rewritten (%d papers, %d citations)."
          % (len(pubs), data["scholar"]["citations"]))
    return 0


if __name__ == "__main__":
    sys.exit(main())
