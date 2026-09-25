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
  * three scripts each ran their own `git ls-files`.

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
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
POSTS_JSON = ROOT / "data" / "posts.json"

# The site's origin, as every absolute URL the generators write starts
# (canonical, og:image, the feed, the sitemap, JSON-LD ids). No trailing
# slash: callers join with "/".
SITE = "https://www.kenreid.co.uk"

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
