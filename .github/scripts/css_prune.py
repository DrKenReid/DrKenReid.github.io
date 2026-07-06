#!/usr/bin/env python3
"""Shared CSS pruning logic for minify_css.py and css_usage_report.py.

Collects every class/id token that appears anywhere in the site's HTML
(including untracked drafts), JS (string literals, so JS-injected markup
and plugin-toggled classes count), and blog/*.md component docs. A CSS
rule is dropped only when NONE of its comma-separated selectors could
ever match: every selector names a class or id absent from the corpus.

Deliberately conservative:
  - pseudo-classes/elements and attribute selectors are ignored when
    matching (they can only narrow, never widen, a match)
  - selectors with no class/id tokens (element/universal) always survive
  - @font-face / @keyframes / @page blocks always survive
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

HTML_ELEMENTS = set("""a abbr address area article aside audio b bdi bdo blockquote body br button
canvas caption cite code col colgroup datalist dd del details dfn dialog div dl dt em embed
fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hr html i iframe img input
ins jargon kbd label legend li link main map mark menu meta nav noscript object ol optgroup option
output p param picture pre progress q rp rt ruby s samp script section select small source span
strong style sub summary sup table tbody td template textarea tfoot th thead time title tr track
u ul var video wbr svg path circle rect line g text""".split())

SEL_TOKEN = re.compile(r"([.#])(-?[A-Za-z_][\w-]*)")

# Class names that JS libraries build by string concatenation at runtime
# ('mfp-arrow-' + direction, 'mfp-' + type + '-holder', ...) — they never
# appear as whole tokens in any source file, so the corpus scan cannot
# see them. Extend this list when styling runtime-generated classes.
RUNTIME_TOKENS = {
    "mfp-arrow-left", "mfp-arrow-right", "mfp-image-holder", "mfp-iframe-holder",
    "mfp-inline-holder", "mfp-ajax-holder", "mfp-s-ready", "mfp-s-error",
    "mfp-s-loading", "mfp-ready", "mfp-removing", "mfp-wrap", "mfp-container",
    "mfp-content", "mfp-figure", "mfp-img", "mfp-bg", "mfp-close", "mfp-counter",
    "mfp-title", "mfp-bottom-bar", "mfp-preloader", "mfp-arrow", "mfp-hide",
    "mfp-align-top", "mfp-auto-cursor", "mfp-prevent-close", "mfp-zoom",
}


def split_selectors(group):
    """Split a selector group on commas, ignoring commas inside quotes,
    [attribute] tests, or (functional) pseudo-class arguments."""
    parts = []
    buf = []
    depth = 0
    quote = None
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


def collect_usage():
    """Return (classes, ids) token sets from tracked site HTML, JS, and MD files.

    Uses git ls-files (the index) rather than a directory glob so the
    corpus is identical locally and in CI — untracked drafts do not
    influence the build. When a draft is staged for publishing, its
    classes join the corpus and the CSS sync check will demand a rebuild
    if it uses anything currently pruned.
    """
    import subprocess
    classes, ids = set(), set()
    out = subprocess.run(
        ["git", "ls-files", "*.html", "blog/*.md", "js/*.js"],
        cwd=ROOT, capture_output=True, text=True).stdout
    files = [ROOT / p for p in out.splitlines() if p]
    def scan_strings(text):
        """Every word token inside any string literal counts as a possible
        class/id — catches className assignments, classList calls, and
        concatenated innerHTML markup."""
        for m in re.finditer(r'''["'`]([^"'`\n]*)["'`]''', text):
            for tok in re.findall(r"-?[A-Za-z_][\w-]*", m.group(1)):
                classes.add(tok)
                ids.add(tok)

    for f in files:
        text = f.read_text(encoding="utf-8", errors="replace")
        for m in re.finditer(r'class=["\']([^"\']+)["\']', text):
            classes.update(m.group(1).split())
        for m in re.finditer(r'id=["\']([^"\']+)["\']', text):
            ids.add(m.group(1))
        if f.suffix in (".js", ".md"):
            scan_strings(text)
        elif f.suffix == ".html":
            # inline <script> blocks build markup via string concatenation
            for m in re.finditer(r"<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>",
                                 text, re.DOTALL | re.IGNORECASE):
                scan_strings(m.group(1))
    classes |= RUNTIME_TOKENS
    ids |= RUNTIME_TOKENS
    return classes, ids


def selector_can_match(sel, classes, ids):
    sel = re.sub(r"::?[\w-]+(\([^)]*\))?", "", sel)   # strip pseudos
    sel = re.sub(r"\[[^\]]*\]", "", sel)               # strip attribute tests
    tokens = SEL_TOKEN.findall(sel)
    for kind, name in tokens:
        if kind == "." and name not in classes:
            return False
        if kind == "#" and name not in ids:
            return False
    return True


def prune(css: str, classes, ids) -> str:
    """Remove unmatchable rules from a CSS string (comments must be gone).

    Handles one level of @media/@supports nesting; leaves all other
    at-rules untouched.
    """
    out = []
    pos = 0
    n = len(css)

    def read_block(start):
        """Return index just past the matching '}' for the '{' at start."""
        depth = 0
        k = start
        while k < n:
            c = css[k]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    return k + 1
            k += 1
        return n

    def prune_flat(chunk):
        result = []
        i, m = 0, len(chunk)
        while i < m:
            b = chunk.find("{", i)
            if b == -1:
                result.append(chunk[i:])
                break
            sel = chunk[i:b]
            e = b
            depth = 0
            while e < m:
                if chunk[e] == "{":
                    depth += 1
                elif chunk[e] == "}":
                    depth -= 1
                    if depth == 0:
                        break
                e += 1
            body = chunk[b:e + 1]
            stripped = sel.strip()
            if stripped.startswith("@") or not stripped:
                result.append(sel + body)
            else:
                selectors = split_selectors(stripped)
                keep = [s for s in selectors if selector_can_match(s, classes, ids)]
                if keep:
                    result.append(sel.replace(stripped, ",".join(keep)) + body)
            i = e + 1
        return "".join(result)

    while pos < n:
        b = css.find("{", pos)
        if b == -1:
            out.append(css[pos:])
            break
        sel = css[pos:b].strip()
        end = read_block(b)
        if sel.startswith(("@media", "@supports")):
            inner = css[b + 1:end - 1]
            pruned_inner = prune_flat(inner)
            if pruned_inner.strip():
                out.append(css[pos:b + 1] + pruned_inner + "}")
        elif sel.startswith("@") or not sel:
            out.append(css[pos:end])
        else:
            selectors = split_selectors(sel)
            keep = [s for s in selectors if selector_can_match(s, classes, ids)]
            if keep:
                out.append(",".join(keep) + css[b:end])
        pos = end
    return "".join(out)
