#!/usr/bin/env python3
"""Helpers the site's generators share, so they cannot drift apart.

Each of these used to exist as a private copy inside one or more
generators, and the copies disagreed:

  * the feed found a post's body by searching for the literal string
    <div class="blog-post">, so a post whose body div carried another
    attribute (data-fullres on the photography posts) silently shipped in
    feed.xml with no content at all, while the read-time counter, which
    matched the class token, counted it fine;
  * the opener built for a draft rounded its read time to the nearest
    minute while generate_read_times.py rounded up, so a draft could
    promise "4 min read" and publish as 5;
  * three scripts each ran their own `git ls-files`;
  * four printed a date as "5 September 2026" four ways, one of them
    through strftime("%B"), which follows the machine's locale;
  * three found their generated region of a page with a regex each.

One definition each, imported by name. The module name has no leading
underscore on purpose: .gitignore ignores _*.py, and a helper that is
not committed breaks every generator in CI.

    import sitelib
    sitelib.post_body(html)     # inner HTML of the article, or None
    sitelib.post_body_span(html)  # where it sits, for a caller that edits
    sitelib.div_span(html, "related-posts")
    sitelib.read_minutes(words) # the read time every page shows
    sitelib.tracked("blog/*.html")
    sitelib.tracked_posts()     # the published posts, downloads left out
    sitelib.is_page(rel)        # False for blog/downloads/ demo files
    sitelib.load_posts()
    sitelib.SITE                # https://www.kenreid.co.uk, no slash
    sitelib.series_list(post)   # a post's series entries, always a list
    sitelib.series_parts(posts, name)  # a series' posts in part order
    sitelib.series_slug(name)   # "Algorithms, Live" -> "algorithms-live"
    sitelib.series_page(name)   # -> "series-algorithms-live.html"
    sitelib.long_date("2026-09-05")   # "5 September 2026"
    sitelib.DEFAULT_POST_IMAGE  # the cover a post without an image gets
    sitelib.thumb_files()       # the 400px gallery thumbs, by number, no @2x
    sitelib.thumb_srcset(src)   # "thumb 1x, double 2x" for a thumb, else ""
    sitelib.block_re("listing-fallback")  # a generated region of a page
    sitelib.fill_block(text, name, lines, note, where)
    sitelib.jargon_report(html)  # box terms the post never uses, stray <jargon> keys
    sitelib.jargon_aliases(label)  # "Gold OA (open access)" -> its names
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
POSTS_JSON = ROOT / "data" / "posts.json"

# The site's origin, as every absolute URL the generators write starts
# (canonical, og:image, the feed, the sitemap, JSON-LD ids). No trailing
# slash: callers join with "/".
SITE = "https://www.kenreid.co.uk"

# The cover a post without an image of its own is shown with, as
# DEFAULT_POST_IMAGE in js/shared-components.js: a baked card and a card
# the browser builds must fall back to the same photograph.
DEFAULT_POST_IMAGE = "img/photography/hero/97.webp"

MONTHS = ("January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December")

# Reading speed behind every read time on the site. 220 words a minute is
# the usual figure for adults reading prose on a screen.
WORDS_PER_MINUTE = 220

# A <div> by one of its classes. The class is matched as a token inside
# the attribute, so `<div class="blog-post" data-fullres>`,
# `<div data-no-toc class="blog-post">` and `class='x blog-post'` are all
# found; `blog-post-meta` and `data-class="blog-post"` are not.
_DIV_OPEN_TEMPLATE = (
    r"""<div\b(?=[^>]*?(?<![\w-])class\s*=\s*(["'])(?:(?!\1).)*?(?<![\w-]){token}(?![\w-]))[^>]*>"""
)
_DIV_OPEN_RES: dict[str, re.Pattern] = {}
_DIV_TAG_RE = re.compile(r"<div\b|</div\s*>", re.IGNORECASE)


def div_span(html: str, class_token: str, start: int = 0) -> tuple[int, int, int, int] | None:
    """Where the first <div> at or after `start` with `class_token` among
    its classes sits: (open_start, inner_start, inner_end, close_end), so
    html[open_start:close_end] is the whole element and
    html[inner_start:inner_end] its content. None when there is no such
    div, or when it never closes.

    The end is found by counting nested <div> tags until the one that
    closes this one, so figures, callouts and baked related-post blocks
    inside it are kept whole rather than cut at the first </div>. An
    unclosed div is None, not a partial span: a caller that publishes the
    result (the feed) should fail rather than ship half an article.
    """
    pattern = _DIV_OPEN_RES.get(class_token)
    if pattern is None:
        pattern = re.compile(_DIV_OPEN_TEMPLATE.format(token=re.escape(class_token)),
                             re.IGNORECASE | re.DOTALL)
        _DIV_OPEN_RES[class_token] = pattern
    m = pattern.search(html, start)
    if not m:
        return None
    depth = 1
    for tag in _DIV_TAG_RE.finditer(html, m.end()):
        depth += -1 if tag.group().startswith("</") else 1
        if depth == 0:
            return m.start(), m.end(), tag.start(), tag.end()
    return None


def post_body_span(html: str) -> tuple[int, int, int, int] | None:
    """div_span of a post's `.blog-post` article: for a caller that edits
    the file around the body (the related-posts block goes last inside
    it), where post_body only reads it."""
    return div_span(html, "blog-post")


def post_body(html: str) -> str | None:
    """Inner HTML of a post's `.blog-post` div, or None when there is none
    or it never closes (see div_span)."""
    span = post_body_span(html)
    return html[span[1]:span[2]] if span else None


def read_minutes(words: int) -> int:
    """Minutes to read `words` words: rounded up, never less than one.

    Rounded up, as generate_read_times.py always has, so a label never
    promises less time than the text takes: 950 words is 4.3 minutes and
    reads "5 min". This is the number data/posts.json stores as
    readMinutes, and the browser only
    displays it: postReadMinutes (card badges) and renderSeriesPage (a
    series' total) in js/shared-components.js, postLengthKey (the Length filter bands) and
    sortPosts in js/blog.js, and the series totals in js/series-index.js.
    The opener's kicker and the share images print it too. None of them
    recompute it, so this is the one place the rounding is decided.
    """
    return max(1, -(-int(words) // WORDS_PER_MINUTE))


def tracked(*patterns: str) -> list[Path]:
    """Files git tracks that match any of `patterns`, as paths that exist.

    Tracked rather than globbed so a build reads the same corpus locally
    as in CI, where untracked drafts do not exist. `-z` keeps filenames
    with spaces or non-ASCII characters intact (without it git quotes
    them). A file deleted from the working tree but not yet from the
    index is skipped, so an in-progress removal does not crash a build.
    Patterns are git pathspecs: `*` crosses directories, so "*.html"
    matches blog/x.html too.
    """
    out = subprocess.run(
        ["git", "ls-files", "-z", "--", *patterns],
        cwd=ROOT, capture_output=True, check=True,
    ).stdout.decode("utf-8")
    return [ROOT / p for p in out.split("\0") if p and (ROOT / p).is_file()]


# Tracked HTML under these folders is not a page of the site: blog/downloads/
# holds standalone demo files offered as downloads, so no header, no
# sitemap entry, no post checks. The question "is this a page" and "is this
# a post" was asked in four scripts with a copy of the prefix each, and a
# pathspec's `*` crosses directories, so every caller that forgot it read
# the downloads as posts.
NOT_PAGE_DIRS = ("blog/downloads/",)


def is_page(rel: str) -> bool:
    """Whether the tracked HTML file at repo-relative `rel` is a site page."""
    return not rel.startswith(NOT_PAGE_DIRS)


def tracked_posts() -> list[Path]:
    """The published posts: tracked blog/*.html that is a page.

    Drafts are untracked, but one added with `git add -N` (which the CSS
    pruner needs to see its classes) is still a draft, not a post.
    """
    return [p for p in tracked("blog/*.html")
            if is_page(rel := p.relative_to(ROOT).as_posix())
            and not rel.startswith("blog/drafts/")]


def load_posts(path: Path = POSTS_JSON) -> list[dict]:
    """data/posts.json (or `path`) as a list of post entries, in file order.

    `utf-8-sig` so a byte-order mark added by a Windows editor is ignored
    instead of failing the parse.
    """
    return json.loads(Path(path).read_text(encoding="utf-8-sig"))


# --- series -------------------------------------------------------------
# The browser builds the same things in js/shared-components.js
# (postSeriesList, seriesParts, seriesPageHref). A generator that disagreed
# would write a series link, a JSON-LD series url or a no-script list that
# the pages' own links do not match, so each rule lives here once and
# tests/test_audit_rules.py runs the JS slug rule against series_slug.

def series_list(post: dict) -> list[dict]:
    """posts.json "series" as a list: it is one {name, part} object, or a
    list of them for a post in two series (postSeriesList in JS)."""
    value = post.get("series")
    if not value:
        return []
    entries = value if isinstance(value, list) else [value]
    return [e for e in entries if isinstance(e, dict)]


def series_parts(posts: list[dict], name: str) -> list[dict]:
    """The posts in series `name`, in part order (seriesParts in JS). A
    stable sort, as Array.prototype.sort is, so equal parts keep
    posts.json order."""
    def part(post):
        for entry in series_list(post):
            if entry.get("name") == name:
                return entry.get("part") or 0
        return None
    return sorted((p for p in posts if part(p) is not None), key=part)


def series_slug(name: str) -> str:
    """seriesPageHref's slug rule: lower case, quotes dropped, every other
    run of characters outside a-z and 0-9 one hyphen, none at either end.
    'Algorithms, Live' is algorithms-live."""
    s = re.sub("['’\"“”]", "", (name or "").lower())
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def series_page(name: str) -> str:
    """The file of a series' index page, relative to the site root:
    series-<slug>.html."""
    return f"series-{series_slug(name)}.html"


THUMBS = ROOT / "img" / "photography" / "thumb"


def thumb_files() -> list[Path]:
    """Every gallery thumbnail, img/photography/thumb/N.webp, in frame
    order. The folder also holds each frame's N@2x.webp (the same tile
    for high-density screens, generate_photo_renditions.py); those are
    left out, so a script that walks the thumbs to find frames (the
    sizes, the B&W tags) never takes a double for a photograph of its own."""
    files = [p for p in THUMBS.glob("*.webp") if p.stem.isdigit()]
    return sorted(files, key=lambda p: int(p.stem))


THUMB_SRC_RE = re.compile(r"(^|/)img/photography/thumb/\d+\.webp$")


def thumb_srcset(src: str) -> str:
    """The srcset for a gallery thumbnail: the thumb at 1x and its 800px
    double at 2x (generate_photo_renditions.py), or "" for any other image.
    krThumbSrcset in js/shared-components.js is the same rule; the cards
    baked here must match the ones the browser builds."""
    if not THUMB_SRC_RE.search(src or ""):
        return ""
    return f"{src} 1x, {src[:-len('.webp')]}@2x.webp 2x"


def long_date(iso: str) -> str:
    """"5 September 2026" from "2026-09-05", as formatPostDate() prints a
    post date in the browser. The month names are spelled out here rather
    than taken from strftime("%B"), which follows the locale of whatever
    machine runs the generator."""
    year, month, day = (int(x) for x in iso[:10].split("-"))
    return f"{day} {MONTHS[month - 1]} {year}"


# --- generated regions ----------------------------------------------------
# A generator that writes part of a hand-edited page owns the lines
# between two marker comments, placed by hand once:
#     <!-- BEGIN name: what writes it; edits made here are overwritten. -->
#     <!-- END name -->
# The generator never guesses a place for them: a page without exactly one
# pair is an error, which --check reports.

def block_re(name: str) -> re.Pattern:
    """The generated region `name` of a page: group 1 is the BEGIN line,
    group 2 its indentation, group 3 the body, group 4 the END line. The
    name is anchored with (?![\\w-]), not \\b, so "publications" cannot
    match the start of "publications-jsonld" and swallow everything
    between the two blocks."""
    return re.compile(
        r"(^([ \t]*)<!-- BEGIN %s(?![\w-])[^\n]*-->\n)(.*?)(^[ \t]*<!-- END %s -->)"
        % (re.escape(name), re.escape(name)),
        re.M | re.S)


def fill_block(text: str, name: str, lines: list[str], note: str | None = None,
               where: str = "page") -> str:
    """`text` (newlines normalised to \\n) with block `name` holding
    `lines`, each indented to the BEGIN marker's depth. With `note`, the
    BEGIN line is rewritten to carry it, so a marker copied by hand from an
    older page states the current source. Raises SystemExit, naming
    `where`, unless the page has exactly one such block."""
    rx = block_re(name)
    found = rx.findall(text)
    if len(found) != 1:
        raise SystemExit(
            f"{where}: expected one <!-- BEGIN {name} --> ... <!-- END {name} --> pair, "
            f"found {len(found)}. Place the two marker lines by hand where the block "
            f"belongs (see the generator's docstring), then rerun.")

    def fill(m):
        pad = m.group(2)
        begin = f"{pad}<!-- BEGIN {name}: {note} -->\n" if note else m.group(1)
        body = "".join((pad + ln).rstrip() + "\n" for ln in lines)
        return begin + body + m.group(4)
    return rx.sub(fill, text, count=1)


# --- the jargon box -------------------------------------------------------
# A post's glossary and its prose must agree: every term in the box is one
# the post uses, in the post's own wording, and every <jargon key> marker
# names a term in the box. applyJargonTooltips (js/shared-components.js)
# underlines a box term only where those words appear, so a term the post
# never uses defines nothing, and a marker whose key matches no term loses
# its tooltip without a word. These helpers mirror that matcher for the
# audit (jargon-unused, jargon-marker) and the draft lint.

# Terms applyJargonTooltips knows on every post (GLOBAL_JARGON): a marker may
# name one of these without the post defining it.
GLOBAL_JARGON = ("ai", "ml", "llm", "genai", "open source", "api", "github",
                 "python", "json")

_JARGON_HEADING = re.compile(r"jargon|glossary|plain english", re.I)
_ALIAS_SPLIT = re.compile(r"\s*/\s*|\s+vs\.?\s+", re.I)
_VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
         "meta", "source", "track", "wbr"}
# Text that is not the post's prose: code, scripts, and the furniture the
# runtime adds or reads (the reference list, the end band, the pager).
_NOT_PROSE_TAGS = {"script", "style", "code", "pre", "textarea", "template"}
_NOT_PROSE_CLASSES = {"references", "related-posts", "kr-post-end", "post-pagination",
                      "kr-toc-mobile", "kr-share-rail", "blog-meta"}


def _jargon_norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").replace("’", "'").replace("‘", "'")).strip()


def jargon_aliases(label: str) -> list[str]:
    """The names a box label answers to, lower-cased: the label itself
    without its trailing colon, the two halves of "Term (ABBR)", and each
    side of "A / B" or "A vs B". krJargonAliases in shared-components.js
    returns the same list for the same label (tests pin both)."""
    base = re.sub(r"[:：]\s*$", "", _jargon_norm(label))
    if not base:
        return []
    out = [base]
    paren = re.match(r"^(.+?)\s*\(([^)]+)\)$", base)
    if paren:
        out += [paren.group(1), paren.group(2)]
    for name in list(out):
        parts = [p for p in _ALIAS_SPLIT.split(name) if p]
        if len(parts) > 1:
            out += parts
    seen, result = set(), []
    for name in out:
        key = _jargon_norm(name).lower()
        if key and key not in seen:
            seen.add(key)
            result.append(key)
    return result


def jargon_term_re(term: str) -> re.Pattern:
    """A box term as applyJargonTooltips finds it in prose: whole words,
    any case, an optional plural "s" or "es". ASCII word boundaries, as in
    JavaScript, so a term that starts or ends with punctuation ("@font-face")
    cannot match there and needs a <jargon> marker instead."""
    return re.compile(r"\b" + re.escape(term) + r"(?:s|es)?\b", re.I | re.A)


class _JargonParser(HTMLParser):
    """The jargon boxes, the <jargon> markers and the prose of a post's
    .blog-post, with line numbers."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, set[str], bool]] = []   # tag, classes, not prose
        self.post_depth = 0
        self.box_depth = 0
        self.boxes: list[tuple[str, list[tuple[str, int]]]] = []
        self._heading: list[str] | None = None
        self._box_heading = ""
        self._box_items: list[tuple[str, int]] = []
        self._li: list | None = None          # [label or None, line]
        self._strong: list[str] | None = None
        self.markers: list[tuple[str, int]] = []
        self.prose: list[str] = []
        self.not_prose = 0

    def handle_starttag(self, tag, attrs):
        if tag in _VOID:
            return
        a = dict(attrs)
        classes = set((a.get("class") or "").split())
        self.stack.append((tag, classes, False))
        depth = len(self.stack)
        if not self.post_depth:
            if "blog-post" in classes:
                self.post_depth = depth
            return
        if not self.box_depth and "plain-english-box" in classes:
            self.box_depth = depth
            self._box_heading, self._box_items = "", []
        if self.box_depth:
            if tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
                self._heading = []
            elif tag == "li":
                self._li = [None, self.getpos()[0]]
            elif tag == "strong" and self._li is not None and self._li[0] is None:
                self._strong = []
            return
        if tag == "jargon":
            self.markers.append((_jargon_norm(a.get("key", "")).lower(), self.getpos()[0]))
        if tag in _NOT_PROSE_TAGS or classes & _NOT_PROSE_CLASSES:
            self.not_prose += 1
            self.stack[-1] = (tag, classes, True)

    def handle_endtag(self, tag):
        if tag in _VOID:
            return
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] != tag:
                continue
            while len(self.stack) > i:
                name, _classes, skip = self.stack.pop()
                depth = len(self.stack) + 1
                if skip:
                    self.not_prose -= 1
                if self.box_depth:
                    if name in ("h1", "h2", "h3", "h4", "h5", "h6") and self._heading is not None:
                        self._box_heading = _jargon_norm("".join(self._heading))
                        self._heading = None
                    elif name == "strong" and self._strong is not None:
                        self._li[0] = _jargon_norm("".join(self._strong))
                        self._strong = None
                    elif name == "li" and self._li is not None:
                        if self._li[0]:
                            self._box_items.append((self._li[0], self._li[1]))
                        self._li = None
                    if depth == self.box_depth:
                        self.boxes.append((self._box_heading, self._box_items))
                        self.box_depth = 0
                if depth == self.post_depth:
                    self.post_depth = 0
            return

    def handle_data(self, data):
        if not self.post_depth:
            return
        if self.box_depth:
            if self._heading is not None:
                self._heading.append(data)
            if self._strong is not None:
                self._strong.append(data)
            return
        if not self.not_prose:
            self.prose.append(data)


def jargon_report(html: str) -> tuple[list[tuple[str, int]], list[tuple[str, int]]]:
    """What breaks the rule in one post: (box terms the post never uses,
    <jargon> markers that name no box term), each as (text, line). A box
    counts when its heading says jargon, glossary or plain English, or one
    of its list items has a <strong> term, as the runtime decides. A term is
    used when one of its aliases appears in the prose outside the box, or a
    marker names it."""
    parser = _JargonParser()
    parser.feed(html)
    parser.close()
    prose = _jargon_norm(" ".join(parser.prose))
    keys = {key for key, _line in parser.markers}
    defined: set[str] = set(GLOBAL_JARGON)
    unused = []
    for heading, items in parser.boxes:
        if not (_JARGON_HEADING.search(heading) or items):
            continue
        for label, line in items:
            names = jargon_aliases(label)
            defined.update(names)
            if not any(name in keys or jargon_term_re(name).search(prose) for name in names):
                unused.append((re.sub(r"[:：]\s*$", "", label), line))
    unresolved = [(key, line) for key, line in parser.markers if key not in defined]
    return unused, unresolved


def arg_parser(doc: str | None, **kwargs) -> argparse.ArgumentParser:
    """The command-line parser every generator uses.

    The module docstring becomes --help, and abbreviations are refused so
    a mistyped flag exits 2 before anything is read or written, instead of
    being taken for a flag that rewrites files (`--dr` for `--drafts`).
    """
    return argparse.ArgumentParser(
        description=doc,
        formatter_class=argparse.RawDescriptionHelpFormatter,
        allow_abbrev=False,
        **kwargs,
    )


if __name__ == "__main__":
    arg_parser(__doc__).parse_args()
    posts = load_posts()
    bodies = sum(1 for p in posts
                 if (ROOT / p["url"]).is_file()
                 and post_body((ROOT / p["url"]).read_text(encoding="utf-8")) is not None)
    print(f"sitelib: {len(posts)} posts in data/posts.json, {bodies} with a .blog-post body.")
