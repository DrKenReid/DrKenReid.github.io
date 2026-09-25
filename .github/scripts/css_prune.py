#!/usr/bin/env python3
"""Decide which CSS rules the site can use, so minify_css.py ships no others.

The corpus
----------
Only files git tracks are read (`git ls-files`, via sitelib.tracked):
every *.html, js/*.js and blog/*.md (a git pathspec's * crosses folders,
so the last is the download files under blog/downloads/; the developer
docs under .github/docs/ are not read). Untracked files are invisible,
drafts under blog/drafts/ included, so a build is the same on every
machine and in CI, and a class a draft needs survives only once the
draft is added to the index. From those files the scan collects:

  * class="...", id="..." and data-animation="..." values (active.js
    adds a data-animation name as a class on each hero slide change);
  * every identifier inside a string literal in JS, in inline <script>
    blocks (JSON-LD included) and in the Markdown: JS-built markup, classList calls
    and ternaries such as `(open ? ' is-open' : '')` all count. Double,
    single and backtick quotes are scanned separately, each with a
    linear pattern of its own (a backtick literal may span lines). One
    pattern for all three quote kinds pairs a ' with the next ", loses
    phase on any line that mixes them, and misses exactly the classes
    built that way; a back-referenced pattern that tracks the opening
    quote fixes that but backtracks for minutes on the minified vendor
    bundles;
  * prefixes: a literal that ends in a class-name fragment and is
    followed by `+` (`'count-' + n`, `'kr-spine--r' + rating`), or
    fragment text just before a `${` inside a template literal, keeps
    every stylesheet class that starts with the fragment. The fragment
    must be at least six characters long, must contain a hyphen or an
    underscore, and must not start with data-, js-, ms- or -webkit-, so
    'item' + i, 'data-' + key and jQuery's "offset" + name (a property
    name, offsetWidth, which would otherwise keep all 58 of Bootstrap's
    .offset-* rules) do not switch pruning off for whole families.

A rule is dropped only when none of its comma-separated selectors could
ever match, which means each names a class or id the corpus never
mentions. The test is deliberately conservative: pseudo-classes and
attribute tests are ignored (they narrow a match, never widen it), a
selector with no class or id (element, universal) always survives, and
at-rules other than the grouping ones (@media, @supports, @container,
@layer, @starting-style, nested to any depth) are kept whole.

@keyframes are pruned separately, after the rules, by prune_keyframes():
a keyframe name is not a selector, so the scan above never tests it.

The pruning contract
--------------------
Do:
  * write every class name whole in a literal somewhere:
    `el.classList.add('kr-foo--open')`, `(done ? ' kr-foo--done' : '')`,
    or a hyphenated stem of six or more characters directly followed by
    `+` (`'kr-meter--' + level`);
  * add a class that is only ever assembled from a variable, or from a
    stem the prefix rule refuses, to RUNTIME_TOKENS below, with a
    comment naming the code that builds it;
  * `git add -N <file>` a new page or script before building, so its
    classes are in the index;
  * rerun minify_css.py after publishing a post: a class the post uses
    for the first time was pruned until then.
Don't:
  * build a class from a variable alone (`'kr-' + kind`), or with
    .concat() or [].join(): the scanner cannot see it, and the rule that
    styles it is removed without a warning;
  * expect an untracked draft or a class that only appears in a code
    comment to keep a rule alive;
  * edit style.min.css to put a pruned rule back: the next build removes
    it again.

    python .github/scripts/css_prune.py --selftest   # run the fixtures below
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Iterable, NamedTuple

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402

ROOT = sitelib.ROOT

# What the scan reads. Pathspecs, so "*.html" includes blog/*.html.
CORPUS = ("*.html", "blog/*.md", "js/*.js")

SEL_TOKEN = re.compile(r"([.#])(-?[A-Za-z_][\w-]*)")
WORD = re.compile(r"-?[A-Za-z_][\w-]*")

# Class names that no source file spells out whole and that no prefix
# (see the module docstring) covers. Each needs a note on who builds it.
RUNTIME_TOKENS = {
    # Magnific Popup assembles these ('mfp-' + type + '-holder', ...).
    # Its own sheet ships unpruned (NO_PRUNE in minify_css.py); the names
    # are kept here for the site's overrides of them in style.css.
    "mfp-arrow-left", "mfp-arrow-right", "mfp-image-holder", "mfp-iframe-holder",
    "mfp-inline-holder", "mfp-ajax-holder", "mfp-s-ready", "mfp-s-error",
    "mfp-s-loading", "mfp-ready", "mfp-removing", "mfp-wrap", "mfp-container",
    "mfp-content", "mfp-figure", "mfp-img", "mfp-bg", "mfp-close", "mfp-counter",
    "mfp-title", "mfp-bottom-bar", "mfp-preloader", "mfp-arrow", "mfp-hide",
    "mfp-align-top", "mfp-auto-cursor", "mfp-prevent-close", "mfp-zoom",
    # Authoring helpers used by unpublished drafts: keep so drafts preview
    # correctly before their classes join the tracked corpus.
    "theme-img-light", "theme-img-dark", "latex-logo",
}

# ---------------------------------------------------------------------------
# Scanning the corpus
# ---------------------------------------------------------------------------

# One linear pattern per quote kind (unrolled loops, no back-reference):
# see the module docstring for why they are not one pattern.
_DOUBLE = re.compile(r'"([^"\\\n]*(?:\\.[^"\\\n]*)*)"')
_SINGLE = re.compile(r"'([^'\\\n]*(?:\\.[^'\\\n]*)*)'")
_BACKTICK = re.compile(r"`([^`\\]*(?:\\[\s\S][^`\\]*)*)`")
_FOLLOWED_BY_PLUS = re.compile(r"\s*\+(?![+=])")
_TRAILING_FRAGMENT = re.compile(r"(-?[A-Za-z_][\w-]*)$")
PREFIX_MIN = 6
PREFIX_EXCLUDED = ("data-", "js-", "ms-", "-webkit-")


def _attr(name: str) -> re.Pattern:
    """name="..." or name='...', each quote kind closed by its own kind.

    A hyphen may precede the name, so data-class="..." counts too: over-
    keeping costs a few bytes, under-keeping an unstyled element.
    """
    return re.compile(r"""(?<![A-Za-z0-9_])%s\s*=\s*(?:"([^"]*)"|'([^']*)')""" % re.escape(name),
                      re.IGNORECASE)


_CLASS_ATTR = _attr("class")
_ID_ATTR = _attr("id")
_ANIMATION_ATTR = _attr("data-animation")
_STYLE_ATTR = _attr("style")
_INLINE_SCRIPT = re.compile(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>", re.DOTALL | re.IGNORECASE)
_INLINE_STYLE = re.compile(r"<style[^>]*>(.*?)</style>", re.DOTALL | re.IGNORECASE)


class Usage(NamedTuple):
    """What the tracked corpus can put on an element."""

    classes: frozenset   # class names seen whole, plus RUNTIME_TOKENS
    ids: frozenset
    prefixes: tuple      # stems completed at runtime ('count-' + n)
    words: frozenset     # every identifier in a literal, attribute or <style>

    def has_class(self, name: str) -> bool:
        return name in self.classes or name.startswith(self.prefixes)

    def used(self, names: Iterable[str]) -> set:
        """The subset of `names` (classes a stylesheet defines) in use."""
        return {n for n in names if self.has_class(n)}


def _prefix_of(literal: str) -> str | None:
    m = _TRAILING_FRAGMENT.search(literal)
    if not m:
        return None
    frag = m.group(1)
    if len(frag) < PREFIX_MIN or frag.startswith(PREFIX_EXCLUDED):
        return None
    # A class stem is kebab or BEM shaped; a bare word is an event or a
    # property name being assembled ("scroll" + "Top").
    if "-" not in frag.lstrip("-") and "_" not in frag:
        return None
    return frag


def scan_strings(code: str, words: set, prefixes: set) -> None:
    """Every identifier inside a string literal, and every prefix."""
    for pattern in (_DOUBLE, _SINGLE):
        for m in pattern.finditer(code):
            words.update(WORD.findall(m.group(1)))
            if _FOLLOWED_BY_PLUS.match(code, m.end()):
                frag = _prefix_of(m.group(1))
                if frag:
                    prefixes.add(frag)
    for m in _BACKTICK.finditer(code):
        body = m.group(1)
        words.update(WORD.findall(body))
        # `count-${n}` is 'count-' + n written the other way.
        pieces = body.split("${")
        stems = pieces[:-1]
        if _FOLLOWED_BY_PLUS.match(code, m.end()):
            stems.append(pieces[-1].rsplit("}", 1)[-1])
        for piece in stems:
            frag = _prefix_of(piece)
            if frag:
                prefixes.add(frag)


def usage_from_sources(sources: Iterable[tuple[str, str]]) -> Usage:
    """Usage from (suffix, text) pairs; collect_usage() feeds it files and
    the self-test feeds it fixtures."""
    classes, ids, words, prefixes = set(), set(), set(), set()
    for suffix, text in sources:
        for pattern, target in ((_CLASS_ATTR, classes), (_ANIMATION_ATTR, classes)):
            for m in pattern.finditer(text):
                target.update((m.group(1) or m.group(2) or "").split())
        for m in _ID_ATTR.finditer(text):
            ids.add((m.group(1) or m.group(2) or "").strip())
        for m in _STYLE_ATTR.finditer(text):
            words.update(WORD.findall(m.group(1) or m.group(2) or ""))
        if suffix in (".js", ".md"):
            scan_strings(text, words, prefixes)
        elif suffix == ".html":
            for m in _INLINE_SCRIPT.finditer(text):
                scan_strings(m.group(1), words, prefixes)
            for m in _INLINE_STYLE.finditer(text):
                words.update(WORD.findall(m.group(1)))
    # A literal can hold an id or a class; the scan cannot tell which.
    string_words = set(words)
    classes |= string_words | RUNTIME_TOKENS
    ids |= string_words | RUNTIME_TOKENS
    words |= classes
    return Usage(frozenset(classes), frozenset(ids),
                 tuple(sorted(prefixes)), frozenset(words))


def collect_usage(files: Iterable[Path] | None = None) -> Usage:
    """Usage of the tracked corpus (or of `files`, for measurements)."""
    if files is None:
        files = sitelib.tracked(*CORPUS)
    return usage_from_sources(
        (f.suffix, f.read_text(encoding="utf-8", errors="replace")) for f in files)


# ---------------------------------------------------------------------------
# Walking CSS
# ---------------------------------------------------------------------------

_STRUCTURE = re.compile(r"""["'{};]""")
_BRACES = re.compile(r"""["'{}]""")
GROUPING_AT_RULES = ("@media", "@supports", "@container", "@layer", "@starting-style")


def _string_end(css: str, i: int) -> int:
    """Index just past the quoted string opening at css[i]."""
    quote, i, n = css[i], i + 1, len(css)
    while i < n:
        c = css[i]
        if c == "\\":
            i += 2
            continue
        if c == quote or c == "\n":
            return i + 1
        i += 1
    return n


def _next(css: str, i: int, pattern: re.Pattern) -> int:
    """Next structural character at or after i, outside quoted strings."""
    while True:
        m = pattern.search(css, i)
        if not m:
            return len(css)
        if m.group() in "\"'":
            i = _string_end(css, m.start())
            continue
        return m.start()


def _block_end(css: str, open_at: int) -> int:
    """Index just past the '}' that closes the '{' at open_at."""
    depth, i, n = 0, open_at, len(css)
    while i < n:
        i = _next(css, i, _BRACES)
        if i >= n:
            break
        depth += 1 if css[i] == "{" else -1
        i += 1
        if depth == 0:
            return i
    return n


def _rules(css: str):
    """Top-level statements of a comment-free stylesheet, in order.

    Yields (prelude, body, text): body is the block's inside without its
    braces, or None for a statement with no block (@import, @charset,
    @layer a, b;), whose text ends at its ';'.
    """
    i, n = 0, len(css)
    while i < n:
        j = _next(css, i, _STRUCTURE)
        if j >= n:
            if css[i:].strip():
                yield css[i:], None, css[i:]
            return
        if css[j] != "{":
            yield css[i:j], None, css[i:j + 1]
            i = j + 1
            continue
        end = _block_end(css, j)
        yield css[i:j], css[j + 1:end - 1], css[i:end]
        i = end


def split_selectors(group: str) -> list[str]:
    """Split a selector group on commas, ignoring commas inside quotes,
    [attribute] tests, or (functional) pseudo-class arguments."""
    parts, buf, depth, quote = [], [], 0, None
    for ch in group:
        if quote:
            buf.append(ch)
            if ch == quote:
                quote = None
        elif ch in "\"'":
            quote = ch
            buf.append(ch)
        elif ch in "[(":
            depth += 1
            buf.append(ch)
        elif ch in "])":
            depth -= 1
            buf.append(ch)
        elif ch == "," and depth == 0:
            parts.append("".join(buf).strip())
            buf = []
        else:
            buf.append(ch)
    if buf:
        parts.append("".join(buf).strip())
    return [p for p in parts if p]


_ATTRIBUTE_TEST = re.compile(r"""\[(?:[^\]"']|"[^"]*"|'[^']*')*\]""")
_PSEUDO = re.compile(r"::?[A-Za-z_-][\w-]*")


def _strip_pseudos(sel: str) -> str:
    """Drop pseudo-classes and elements with their (balanced) arguments.

    Balanced, because `:is(:not(.a), .b)` cut at its first ')' would leave
    `.b` behind as if the selector required it.
    """
    out, i, n = [], 0, len(sel)
    while True:
        m = _PSEUDO.search(sel, i)
        if not m:
            out.append(sel[i:])
            return "".join(out)
        out.append(sel[i:m.start()])
        k = m.end()
        if k < n and sel[k] == "(":
            depth = 0
            while k < n:
                depth += {"(": 1, ")": -1}.get(sel[k], 0)
                k += 1
                if depth == 0:
                    break
        i = k


def selector_can_match(sel: str, usage: Usage) -> bool:
    sel = _strip_pseudos(_ATTRIBUTE_TEST.sub("", sel))
    for kind, name in SEL_TOKEN.findall(sel):
        if kind == "." and not usage.has_class(name):
            return False
        if kind == "#" and name not in usage.ids:
            return False
    return True


def prune(css: str, usage: Usage) -> str:
    """Remove the rules no page can match from comment-free CSS.

    Recurses into grouping at-rules to any depth and drops a group left
    empty; every other at-rule (@font-face, @keyframes, @page, @property)
    is kept as written.
    """
    out = []
    for prelude, body, text in _rules(css):
        head = prelude.strip()
        if body is None or not head:
            out.append(text)
        elif head.startswith(GROUPING_AT_RULES):
            inner = prune(body, usage)
            if inner.strip():
                out.append(prelude + "{" + inner + "}")
        elif head.startswith("@"):
            out.append(text)
        else:
            keep = [s for s in split_selectors(head) if selector_can_match(s, usage)]
            if keep:
                out.append(",".join(keep) + "{" + body + "}")
    return "".join(out)


# ---------------------------------------------------------------------------
# Keyframes
# ---------------------------------------------------------------------------
# Keyframe names are not selectors, so rule pruning never tests them: a
# @keyframes block survives it even when every rule that ran the animation
# was removed. Vendor sheets carry dozens of those (animate.css defines one
# per effect). prune_keyframes() runs after prune() and keeps a block only
# when something can still start it: an animation or animation-name value
# in the CSS that survived (a custom property counts, since
# `animation: var(--x)` names it indirectly), or any word the corpus
# mentions in a literal, attribute or inline <style> (JS that sets
# style.animationName, a style="animation: ..." attribute). Prefixed
# @-webkit-keyframes are dropped outright: every browser the site
# supports reads the unprefixed form.

_ANIMATION_VALUE = re.compile(
    r"(?<![\w-])(?:-webkit-|-moz-)?animation(?:-name)?\s*:([^;{}]*)"
    r"|(?<![\w-])--[\w-]+\s*:([^;{}]*)", re.IGNORECASE)
_KEYFRAMES = re.compile(r"@keyframes\s+(\"[^\"]*\"|'[^']*'|[^\s{]+)\s*$", re.IGNORECASE)
_PREFIXED_KEYFRAMES = re.compile(r"@-(?:webkit|moz|o|ms)-keyframes\b", re.IGNORECASE)


def keyframe_references(css: str) -> set:
    """Every identifier an animation value (or custom property) names."""
    names = set()
    for m in _ANIMATION_VALUE.finditer(css):
        names.update(WORD.findall(m.group(1) or m.group(2) or ""))
    return names


def prune_keyframes(css: str, keep: set) -> str:
    """Drop @keyframes whose name is not in `keep`, and every prefixed
    @-webkit-keyframes, at any nesting depth."""
    out = []
    for prelude, body, text in _rules(css):
        head = prelude.strip()
        if body is None or not head:
            out.append(text)
        elif _PREFIXED_KEYFRAMES.match(head):
            continue
        elif (m := _KEYFRAMES.match(head)):
            if m.group(1).strip("\"'") in keep:
                out.append(text)
        elif head.startswith(GROUPING_AT_RULES):
            inner = prune_keyframes(body, keep)
            if inner.strip():
                out.append(prelude + "{" + inner + "}")
        else:
            out.append(text)
    return "".join(out)


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------

_FIXTURE_JS = r"""
// mixed quotes on one line: the single-pattern scan lost phase here
html += '<span class="kr-cal__cell' + (future ? ' kr-cal__cell--future' : '') + '" data-l="0"></span>';
// a class appended by a ternary
var eq = '<span class="kr-eq' + (now.playing ? ' is-playing' : '') + '" aria-hidden="true">';
// a stem plus a number
imagesHtml = '<div class="bsky-post-images count-' + Math.min(imgs.length, 4) + '">';
row += "<a class=\"kr-spine kr-spine--r" + (b.r || 0) + "\">";
// stems the prefix rule must refuse: too short, or an attribute
cell.className = 'kr-g-' + n; el.setAttribute('data-kind-' + k, 1);
var w = el["offset" + dim];
// a template literal over two lines, and one completed by ${}
const card = `<div class="kr-tpl-card
  kr-tpl-card--wide">${title}</div>`;
const bar = `kr-tpl-bar--${level}`;
el.style.animationName = 'kr-js-anim';
"""

_FIXTURE_HTML = """
<h2 data-animation="bounceInDown">Hi</h2>
<p style="animation: kr-inline-anim 1s">x</p>
<div id="kr-main"></div>
<style>.local { animation: kr-style-block-anim 2s; }</style>
"""

_FIXTURE_CSS = (
    ".kr-cal__cell{a:1}.kr-cal__cell--future{a:2}"
    ".kr-eq span{a:3}.kr-eq.is-playing span{a:4}"
    ".bsky-post-images.count-1{a:5}.bsky-post-images.count-4{a:6}"
    ".kr-spine--r0{a:7}.kr-spine--r5{a:8}"
    ".kr-g-1{a:9}.kr-tpl-card--wide{a:10}.kr-tpl-bar--3{a:11}.offset-md-2{a:20}"
    ".bounceInDown{animation-name:bounceInDown}"
    ".gone{animation:kr-gone-anim 1s}"
    "#kr-main{a:12}#kr-missing{a:13}"
    "a:not(.kr-never){a:14}.kr-cal__cell:is(:not(.kr-never),.kr-nothing){a:15}"
    "[data-x=\"}\"] .kr-eq{a:16}"
    "@supports (x:y){@media (min-width:1px){.kr-eq{a:17}.kr-unused{a:18}}"
    "@media (max-width:1px){.kr-unused{a:19}}}"
    "@keyframes bounceInDown{to{opacity:1}}"
    "@-webkit-keyframes bounceInDown{to{opacity:1}}"
    "@keyframes kr-gone-anim{to{opacity:0}}"
    "@keyframes kr-js-anim{to{opacity:0}}"
    "@keyframes kr-inline-anim{to{opacity:0}}"
    "@keyframes kr-style-block-anim{to{opacity:0}}"
    "@media (prefers-reduced-motion:no-preference){@keyframes kr-orphan{to{opacity:0}}}"
)


def selftest() -> int:
    usage = usage_from_sources([(".js", _FIXTURE_JS), (".html", _FIXTURE_HTML)])
    pruned = prune(_FIXTURE_CSS, usage)
    keep = keyframe_references(pruned) | usage.words
    final = prune_keyframes(pruned, keep)

    checks = [
        ("mixed quotes: ternary class inside a '...\"...' line",
         ".kr-cal__cell--future{" in final),
        ("ternary-appended class", ".kr-eq.is-playing span{" in final),
        ("prefix + n keeps count-1..4", ".count-1{" in final and ".count-4{" in final),
        ("prefix + n in double quotes (kr-spine--r)",
         ".kr-spine--r0{" in final and ".kr-spine--r5{" in final),
        ("a stem under six characters is not a prefix", ".kr-g-1{" not in final),
        ("data- is never a prefix", "data-kind-" not in usage.prefixes),
        ("a bare word + name is a property, not a class stem", ".offset-md-2" not in final),
        ("template literal across lines", ".kr-tpl-card--wide{" in final),
        ("template literal stem before ${", ".kr-tpl-bar--3{" in final),
        ("data-animation keeps its rule", ".bounceInDown{" in final),
        ("id kept only when used", "#kr-main{" in final and "#kr-missing" not in final),
        (":not() of an unknown class survives", "a:not(.kr-never){" in final),
        ("nested pseudo arguments do not leak", ":is(:not(.kr-never),.kr-nothing){" in final),
        ("a brace inside an attribute string", "[data-x=\"}\"] .kr-eq{a:16}" in final),
        ("nested @supports/@media: used rule kept",
         "@supports (x:y){@media (min-width:1px){.kr-eq{a:17}}}" in final),
        ("nested @media: unused rule and emptied group dropped",
         ".kr-unused" not in final and "max-width:1px" not in final),
        ("keyframes run by a surviving rule are kept", "@keyframes bounceInDown{" in final),
        ("keyframes of a pruned rule are dropped", "kr-gone-anim" not in final),
        ("keyframes named from JS are kept", "@keyframes kr-js-anim{" in final),
        ("keyframes named in a style attribute are kept", "@keyframes kr-inline-anim{" in final),
        ("keyframes named in an inline <style> are kept",
         "@keyframes kr-style-block-anim{" in final),
        ("an orphan inside @media is dropped with its group",
         "kr-orphan" not in final and "prefers-reduced-motion" not in final),
        ("@-webkit-keyframes are dropped", "@-webkit-keyframes" not in final),
    ]
    failed = 0
    for name, ok in checks:
        print(f"  {'ok  ' if ok else 'FAIL'}  {name}")
        failed += not ok
    if failed:
        print(f"\n{failed} of {len(checks)} checks failed. Pruned fixture:\n{final}")
        return 1
    print(f"\ncss_prune self-test: all {len(checks)} checks passed.")
    return 0


def main(argv=None) -> int:
    parser = sitelib.arg_parser(__doc__)
    parser.add_argument("--selftest", action="store_true",
                        help="run the inline fixtures and exit 1 on any failure")
    args = parser.parse_args(argv)
    if args.selftest:
        return selftest()
    usage = collect_usage()
    print(f"{len(usage.classes):,} class tokens, {len(usage.ids):,} id tokens, "
          f"{len(usage.prefixes)} prefixes: {', '.join(usage.prefixes)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
