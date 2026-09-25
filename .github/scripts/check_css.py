#!/usr/bin/env python3
"""Hold style.css to the rules its tokens depend on, and stop the habits
the token system replaced from growing back.

    python .github/scripts/check_css.py --check             # CI, run_checks, pre-commit
    python .github/scripts/check_css.py --report            # every counted instance, by line
    python .github/scripts/check_css.py --update-baseline   # lock in a lower count

Rules that fail outright
------------------------
undefined-property
    var(--x) where --x is defined nowhere. A custom property that is never
    set makes the whole declaration invalid at computed-value time, so
    `color: var(--kr-accent)` quietly becomes the inherited colour: no
    console error, no visual diff until someone notices the link is grey.
    Tokens have been removed before (--kr-accent went when the palette
    was cut down to one action colour); this is the rule that finds a
    reader left behind by a change like that. A fallback, var(--x, red),
    does not excuse it: a property nothing sets is a hook nobody uses, and
    the fallback is the only value it will ever have.

unused-property
    A custom property the site sets (style.css, a style attribute, a page's
    <style> block, a script's setProperty or style string) that nothing
    reads. Tokens are the site's vocabulary; one that nothing reads is a
    word nobody can tell is dead, and the next person copies it.

duplicate-rule
    The same selector with the same declarations twice in the same
    context. The later copy sets everything the earlier one does and wins,
    so the earlier changes nothing and only misleads the next edit (a
    change to it does nothing, which looks like a cascade bug).

print-blocks
    More than one @media print. Print rules scattered through the file
    each hide or show something the others do not know about, so what a
    printed post looks like can only be worked out by finding all of them.
    One block (§23 Print, after every section it overrides) reads top to
    bottom.

Ratchets (.github/css-baseline.json)
------------------------------------
Three counts over style.css that may only go down:

rawColours
    Hex and rgb()/rgba() literals outside the :root token blocks. A literal
    is the same colour in both themes, which is how dark-theme text ended
    up at 2.3:1: tokens follow the theme on their own.
important
    !important declarations. Each one is a specificity fight settled by
    force, and the next rule that has to win needs one too.
darkRules
    Hand-written theme twins: rules whose selector tests
    [data-theme="dark"] (or sit in a dark colour-scheme query) and are not
    token blocks. `:root:not([data-theme="dark"]) .x`, a light-only twin,
    counts as well: it is the same hand-painting for the other theme. Each
    repaints one component for one theme, where a token would have done
    it for both.

Why a ratchet rather than a rule. The file has hundreds of each today, and
most are correct in context (a photograph's scrim is rgba() on purpose).
Failing on every one would mean rewriting most of the file before the
check could run at all; ignoring them would let each edit add one more.
A ratchet fails only when a count rises, so new code has to use the
tokens while the old code is cleaned up as it is touched. It also fails
when a count falls and the baseline still has the old number, because a
baseline left high is headroom the next change can quietly spend:
--update-baseline writes the lower count (it refuses to raise one), and
`run_checks.py --fix` runs it for you. To raise a count on purpose, edit
the JSON by hand and say why in the commit.

The corpus
----------
Definitions and reads are collected from every tracked page and script,
the same corpus the CSS pruner reads (sitelib.tracked), so a check here
agrees with CI:

  * stylesheets: style.css, the vendor sheets it @imports (definitions
    only: Bootstrap's :root variables are available, but unused vendor
    variables are not this site's to delete), and each page's <style>;
  * style attributes (`style="--kr-opener-img: url(...)"` on an opener);
  * any var(--x) elsewhere in a page (an SVG fill="var(--x)"), leaving
    out comments and code samples (<pre>, <code>): a post that shows
    `color: var(--bg)` as an example is not using --bg;
  * string literals in js/*.js and inline <script> blocks:
    setProperty('--x') sets, getPropertyValue('--x') reads, 'var(--x)'
    reads, '--x: ...' in a style string sets, and a bare '--x' (a name in
    a list the code loops over) counts as both, because the scan cannot
    tell which. A literal ending in a name stem and followed by `+`, or a
    template literal with `--stem-${...}`, covers every property starting
    with the stem, as the pruner's prefix rule does for classes.

css/giscus-*.css are not read: they theme the comments iframe and define
the variables giscus's own stylesheet reads, which no file here can see.
"""
from __future__ import annotations

import bisect
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402
from css_prune import split_selectors  # noqa: E402

ROOT = sitelib.ROOT
STYLE = ROOT / "style.css"
BASELINE = ROOT / ".github" / "css-baseline.json"

# The corpus the definitions and reads come from (git pathspecs).
PAGES = ("*.html",)
SCRIPTS = ("js/*.js",)

# The ratchets, in the order they are reported, with the phrase each count
# is reported as.
RATCHETS = {
    "rawColours": "hex and rgb() colours outside the :root token blocks",
    "important": "!important declarations",
    "darkRules": "hand-written dark-theme rules (not token blocks)",
}


# ---------------------------------------------------------------------------
# Parsing CSS
# ---------------------------------------------------------------------------
# Not a full CSS parser: enough structure for these rules and for the tests
# that read the token blocks (tests/test_contrast.py, test_decisions.py).
# Comments are blanked in place (newlines kept), so every offset in the
# blanked text is an offset in the file and a line number is a bisect away.

_COMMENT_OR_STRING = re.compile(
    r"/\*.*?\*/|\"(?:[^\"\\\n]|\\.)*\"|'(?:[^'\\\n]|\\.)*'", re.DOTALL)
_STRUCTURE = re.compile(r"\"(?:[^\"\\\n]|\\.)*\"|'(?:[^'\\\n]|\\.)*'|[{};()]")
GROUPING = ("@media", "@supports", "@container", "@layer", "@document",
            "@starting-style", "@scope")


def blank_comments(css: str) -> str:
    """css with every comment replaced by spaces (newlines kept)."""
    def repl(m):
        s = m.group(0)
        return re.sub(r"[^\n]", " ", s) if s.startswith("/*") else s
    return _COMMENT_OR_STRING.sub(repl, css)


@dataclass
class Declaration:
    prop: str            # lower-cased, custom properties as written
    value: str           # whitespace-collapsed
    line: int
    important: bool = False


@dataclass
class Rule:
    """A block with declarations: a style rule, a keyframe step, or an
    at-rule with a body (@font-face, @property, @page)."""
    selector: str                    # the prelude, whitespace-collapsed
    context: tuple                   # enclosing at-rule preludes, outermost first
    line: int
    body: str                        # declaration text, whitespace-collapsed
    declarations: list = field(default_factory=list)

    @property
    def selectors(self) -> list[str]:
        """The selector list split on its top-level commas (the pruner's
        own splitter, so the two read a selector list the same way)."""
        return split_selectors(self.selector)

    def get(self, prop: str) -> str | None:
        """The last value this rule gives `prop`, or None."""
        found = None
        for d in self.declarations:
            if d.prop == prop:
                found = d.value
        return found


@dataclass
class Sheet:
    source: str                      # repo-relative name, for messages
    rules: list                      # Rule, in source order
    at_rules: list                   # (prelude, context, line) for every block at-rule


class _Lines:
    def __init__(self, text: str, first_line: int = 1):
        self.starts = [0] + [m.end() for m in re.finditer(r"\n", text)]
        self.first = first_line

    def __call__(self, offset: int) -> int:
        return bisect.bisect_right(self.starts, offset) - 1 + self.first


def _squash(s: str) -> str:
    return " ".join(s.split())


def _split_declarations(text: str, offset: int, lines: _Lines) -> list[Declaration]:
    """Declarations in a block body (nested blocks already removed).
    `offset` is where `text` starts in the file, for line numbers."""
    out, pieces, depth, start = [], [], 0, 0
    for m in _STRUCTURE.finditer(text):
        ch = m.group(0)
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        elif ch == ";" and depth == 0:
            pieces.append((start, m.start()))
            start = m.end()
    pieces.append((start, len(text)))
    for a, b in pieces:
        chunk = text[a:b]
        if not chunk.strip():
            continue
        prop, sep, value = chunk.partition(":")
        if not sep:
            continue
        lead = len(chunk) - len(chunk.lstrip())
        prop = prop.strip()
        important = False
        value = _squash(value)
        m = re.search(r"!\s*important\s*$", value, re.I)
        if m:
            important = True
            value = value[:m.start()].rstrip()
        out.append(Declaration(prop if prop.startswith("--") else prop.lower(),
                               value, lines(offset + a + lead), important))
    return out


def _next(text: str, i: int, end: int) -> re.Match | None:
    """The next '{', '}' or ';' in text[i:end] outside strings and
    parentheses (a data: URI in url() may hold a ';')."""
    depth = 0
    for m in _STRUCTURE.finditer(text, i, end):
        ch = m.group(0)
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth = max(0, depth - 1)
        elif ch in "{};" and depth == 0:
            return m
    return None


def _block_end(text: str, open_at: int) -> int:
    """Offset just past the '}' closing the '{' at open_at."""
    depth = 0
    for m in _STRUCTURE.finditer(text, open_at):
        ch = m.group(0)
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return m.end()
    return len(text)


def _holds_block(text: str, start: int, end: int) -> bool:
    """Whether text[start:end] has a '{' of its own (strings aside)."""
    i = start
    while (m := _next(text, i, end)) is not None:
        if m.group(0) == "{":
            return True
        i = m.end()
    return False


_KEYFRAMES = re.compile(r"@(-\w+-)?keyframes\b", re.I)


def _walk(text: str, start: int, end: int, context: tuple, lines: _Lines,
          rules: list, at_rules: list) -> list[tuple[int, int]]:
    """Collect the statements of text[start:end] into `rules` and
    `at_rules`. Returns the spans of loose declaration text between the
    blocks, which is a rule's own declarations when CSS nesting puts rules
    inside it."""
    loose, i = [], start
    while i < end:
        m = _next(text, i, end)
        if m is None:
            loose.append((i, end))
            break
        ch = m.group(0)
        if ch == "}":            # a stray closer: step over it
            i = m.end()
            continue
        if ch == ";":
            loose.append((i, m.end()))
            i = m.end()
            continue
        close = min(_block_end(text, m.start()), end)
        raw = text[i:m.start()]
        prelude = _squash(raw)
        line = lines(i + len(raw) - len(raw.lstrip()))
        inner_start, inner_end = m.end(), close - 1
        if prelude.startswith("@"):
            at_rules.append((prelude, context, line))
        if prelude.lower().startswith(GROUPING) or _KEYFRAMES.match(prelude):
            _walk(text, inner_start, inner_end, context + (prelude,), lines, rules, at_rules)
        elif _holds_block(text, inner_start, inner_end):
            # CSS nesting: the rules inside go in with this one as context,
            # and its own declarations are the text between them.
            nested: list = []
            spans = _walk(text, inner_start, inner_end, context + (prelude,),
                          lines, nested, at_rules)
            decls = [d for a, b in spans
                     for d in _split_declarations(text[a:b], a, lines)]
            body = _squash(" ".join(text[a:b] for a, b in spans))
            rules.append(Rule(prelude, context, line, body, decls))
            rules.extend(nested)
        else:
            body = text[inner_start:inner_end]
            rules.append(Rule(prelude, context, line, _squash(body),
                              _split_declarations(body, inner_start, lines)))
        i = close
    return loose


def parse_css(css: str, source: str = "style.css", first_line: int = 1) -> Sheet:
    """Rules and block at-rules of a stylesheet, with line numbers."""
    text = blank_comments(css)
    lines = _Lines(text, first_line)
    rules, at_rules = [], []
    _walk(text, 0, len(text), (), lines, rules, at_rules)
    return Sheet(source, rules, at_rules)


def custom_property_values(sheet: Sheet, selector: str) -> dict[str, str]:
    """Every custom property the top-level rules for exactly `selector`
    declare, later declarations winning: the cascade for one element and
    one theme, as far as unconditional rules go. The contrast and decision
    tests read the token blocks through this."""
    out = {}
    for rule in sheet.rules:
        if rule.context or selector not in rule.selectors:
            continue
        for d in rule.declarations:
            if d.prop.startswith("--"):
                out[d.prop] = d.value
    return out


def resolve(value: str, props: dict[str, str], depth: int = 0) -> str:
    """value with each var(--x[, fallback]) replaced from `props`."""
    if depth > 20:
        raise ValueError("var() cycle: " + value)

    def repl(m):
        name, fallback = m.group(1), m.group(2)
        if name in props:
            return resolve(props[name], props, depth + 1)
        if fallback is not None:
            return resolve(fallback.strip(), props, depth + 1)
        raise KeyError(name)
    return re.sub(r"var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)", repl, value)


# ---------------------------------------------------------------------------
# Custom properties across the corpus
# ---------------------------------------------------------------------------

VAR_READ = re.compile(r"var\(\s*(--[A-Za-z_][\w-]*)")
STYLE_QUERY = re.compile(r"style\(\s*(--[A-Za-z_][\w-]*)")
CUSTOM_DECL = re.compile(r"(?<![\w-])(--[A-Za-z_][\w-]*)\s*:")
CUSTOM_NAME = re.compile(r"(?<![\w-])(--[A-Za-z_][\w-]*)")
PROPERTY_AT = re.compile(r"@property\s+(--[A-Za-z_][\w-]*)")

# One linear pattern per quote kind, as in css_prune.py, whose module
# docstring explains why a single pattern for all three loses its place.
_JS_DOUBLE = re.compile(r'"([^"\\\n]*(?:\\.[^"\\\n]*)*)"')
_JS_SINGLE = re.compile(r"'([^'\\\n]*(?:\\.[^'\\\n]*)*)'")
_JS_BACKTICK = re.compile(r"`([^`\\]*(?:\\[\s\S][^`\\]*)*)`")
_FOLLOWED_BY_PLUS = re.compile(r"\s*\+(?![+=])")
_STEM_AT_END = re.compile(r"(?<![\w-])(--[A-Za-z_][\w-]*)$")
_SETS = re.compile(r"setProperty\(\s*$")
_READS = re.compile(r"getPropertyValue\(\s*$")

_HTML_COMMENT = re.compile(r"<!--.*?-->", re.DOTALL)
_HTML_CODE = re.compile(r"<(pre|code)\b[^>]*>.*?</\1>", re.DOTALL | re.I)
_HTML_SCRIPT = re.compile(r"(<script\b[^>]*>)(.*?)</script>", re.DOTALL | re.I)
_HTML_STYLE = re.compile(r"<style\b[^>]*>(.*?)</style>", re.DOTALL | re.I)
_STYLE_ATTR = re.compile(r"""(?<![\w-])style\s*=\s*(?:"([^"]*)"|'([^']*)')""", re.I)


@dataclass
class Where:
    source: str
    line: int

    def __str__(self):
        return f"{self.source}:{self.line}"


class Usage:
    """Where each custom property is set and read."""

    def __init__(self):
        self.sets: dict[str, list[Where]] = {}
        self.reads: dict[str, list[Where]] = {}
        self.vendor: set[str] = set()      # defined by a vendor sheet
        self.either: set[str] = set()      # a bare mention in a script
        self.prefixes: set[str] = set()    # '--stem-' + n in a script

    def set(self, name, where):
        self.sets.setdefault(name, []).append(where)

    def read(self, name, where):
        self.reads.setdefault(name, []).append(where)

    def is_defined(self, name: str) -> bool:
        return (name in self.sets or name in self.vendor or name in self.either
                or name.startswith(tuple(self.prefixes)))

    def is_read(self, name: str) -> bool:
        return (name in self.reads or name in self.either
                or name.startswith(tuple(self.prefixes)))


def _line_at(text: str, offset: int, first: int = 1) -> int:
    return text.count("\n", 0, offset) + first


def scan_sheet(sheet: Sheet, usage: Usage, vendor: bool = False) -> None:
    """Custom properties a stylesheet sets and reads. A vendor sheet's
    settings count only as available (Usage.vendor): nothing here reads
    most of Bootstrap's variables, and they are not ours to delete."""
    for rule in sheet.rules:
        for d in rule.declarations:
            where = Where(sheet.source, d.line)
            if d.prop.startswith("--"):
                if vendor:
                    usage.vendor.add(d.prop)
                else:
                    usage.set(d.prop, where)
            if not vendor:
                for name in VAR_READ.findall(d.value):
                    usage.read(name, where)
        if not vendor:
            for name in PROPERTY_AT.findall(rule.selector):
                usage.set(name, Where(sheet.source, rule.line))
    if not vendor:
        for prelude, _ctx, line in sheet.at_rules:
            for name in STYLE_QUERY.findall(prelude):
                usage.read(name, Where(sheet.source, line))


def scan_js(code: str, source: str, usage: Usage, first_line: int = 1) -> None:
    """Custom properties set and read in a script's string literals.

    Only literals are read, never comments or identifiers, so a note that
    mentions a retired property is not taken for a use of it. What a
    literal means comes from the literal and the call just before it: see
    the module docstring's corpus notes."""
    def literal(body: str, start: int, end: int, template: bool):
        where = Where(source, _line_at(code, start, first_line))
        before = code[max(0, start - 40):start - 1]
        # Stems first: a name completed by `+ value` or `${value}` is a
        # family, not one property ('--viz-' + token, `--kr-cal-${n}`).
        pieces = body.split("${")[:-1] if template else []
        if _FOLLOWED_BY_PLUS.match(code, end):
            pieces.append(body.rsplit("}", 1)[-1] if template else body)
        claimed = set()
        for piece in pieces:
            m = _STEM_AT_END.search(piece)
            if m:
                usage.prefixes.add(m.group(1))
                claimed.add(m.group(1))
        for name in VAR_READ.findall(body):
            if name not in claimed:
                usage.read(name, where)
                claimed.add(name)
        for name in CUSTOM_DECL.findall(body):
            if name not in claimed:
                usage.set(name, where)
                claimed.add(name)
        for name in CUSTOM_NAME.findall(body):
            if name in claimed:
                continue
            if _SETS.search(before):
                usage.set(name, where)
            elif _READS.search(before):
                usage.read(name, where)
            else:
                usage.either.add(name)

    for pattern, template in ((_JS_DOUBLE, False), (_JS_SINGLE, False), (_JS_BACKTICK, True)):
        for m in pattern.finditer(code):
            if "--" in m.group(1):
                literal(m.group(1), m.start() + 1, m.end(), template)


def _blank(pattern: re.Pattern, text: str) -> str:
    """text with every match of pattern turned to spaces (newlines kept,
    so line numbers still count from the top of the file)."""
    return pattern.sub(lambda m: re.sub(r"[^\n]", " ", m.group(0)), text)


def scan_html(text: str, source: str, usage: Usage) -> None:
    """Style attributes, <style> blocks, inline scripts and stray var()s.

    Comments and code samples (<pre>, <code>) are blanked first: a post
    that shows `color: var(--bg)` as an example is not using --bg, and a
    commented-out block is not in use at all."""
    text = _blank(_HTML_COMMENT, text)
    for m in _HTML_SCRIPT.finditer(text):
        if "json" not in m.group(1).lower():
            scan_js(m.group(2), source, usage, _line_at(text, m.start(2)))
    for m in _HTML_STYLE.finditer(text):
        sheet = parse_css(m.group(1), source, _line_at(text, m.start(1)))
        scan_sheet(sheet, usage)
    # Code samples last: a script may hold '<code>' in a string.
    rest = _blank(_HTML_CODE, _blank(_HTML_STYLE, _blank(_HTML_SCRIPT, text)))
    for m in _STYLE_ATTR.finditer(rest):
        value = m.group(1) if m.group(1) is not None else m.group(2)
        where = Where(source, _line_at(rest, m.start()))
        for name in CUSTOM_DECL.findall(value):
            usage.set(name, where)
    for m in VAR_READ.finditer(rest):
        usage.read(m.group(1), Where(source, _line_at(rest, m.start())))


def vendor_sheets(style_text: str) -> list[Path]:
    """The files style.css @imports, which the build inlines."""
    out = []
    for rel in re.findall(r"@import\s+url\(\s*['\"]?([^'\")]+)", style_text):
        p = ROOT / rel.strip()
        if p.exists():
            out.append(p)
    return out


def collect(style_text: str | None = None) -> tuple[Sheet, Usage]:
    """style.css parsed, and custom-property usage across the corpus."""
    if style_text is None:
        style_text = STYLE.read_text(encoding="utf-8")
    sheet = parse_css(style_text, "style.css")
    usage = Usage()
    scan_sheet(sheet, usage)
    for path in vendor_sheets(style_text):
        rel = path.relative_to(ROOT).as_posix()
        scan_sheet(parse_css(path.read_text(encoding="utf-8", errors="replace"), rel),
                   usage, vendor=True)
    for path in sitelib.tracked(*PAGES):
        scan_html(path.read_text(encoding="utf-8", errors="replace"),
                  path.relative_to(ROOT).as_posix(), usage)
    for path in sitelib.tracked(*SCRIPTS):
        scan_js(path.read_text(encoding="utf-8", errors="replace"),
                path.relative_to(ROOT).as_posix(), usage)
    return sheet, usage


# ---------------------------------------------------------------------------
# The rules
# ---------------------------------------------------------------------------

ROOT_SELECTOR = re.compile(r":root(?:\[[^\]]*\]|:not\([^()]*(?:\([^()]*\))?[^()]*\))*")
DARK_SELECTOR = re.compile(r"\[\s*data-theme\s*=\s*[\"']?dark[\"']?\s*\]")
DARK_QUERY = re.compile(r"prefers-color-scheme\s*:\s*dark", re.I)
PRINT_QUERY = re.compile(r"@media\b[^{]*\bprint\b", re.I)
RAW_COLOUR = re.compile(r"#[0-9a-fA-F]{3,8}\b|\brgba?\(", re.I)
_URL_OR_STRING = re.compile(r"url\([^)]*\)|\"(?:[^\"\\]|\\.)*\"|'(?:[^'\\]|\\.)*'", re.I)


def is_token_block(rule: Rule) -> bool:
    """A rule whose every selector is :root, optionally qualified by an
    attribute or :not() (`:root[data-theme="dark"]`): where tokens live."""
    sels = rule.selectors
    return bool(sels) and all(ROOT_SELECTOR.fullmatch(s) for s in sels)


def is_style_rule(rule: Rule) -> bool:
    return not rule.selector.startswith("@") and not any(
        re.match(r"@(-\w+-)?keyframes\b", c, re.I) for c in rule.context)


def undefined_properties(usage: Usage) -> list[str]:
    out = []
    for name in sorted(usage.reads):
        if not usage.is_defined(name):
            places = usage.reads[name]
            shown = ", ".join(str(w) for w in places[:4])
            more = f" and {len(places) - 4} more" if len(places) > 4 else ""
            out.append(f"var({name}) is read at {shown}{more}, but nothing sets {name}: "
                       f"the declaration computes to its inherited or initial value")
    return out


def unused_properties(usage: Usage) -> list[str]:
    out = []
    for name in sorted(usage.sets):
        if not usage.is_read(name):
            places = usage.sets[name]
            shown = ", ".join(str(w) for w in places[:4])
            more = f" and {len(places) - 4} more" if len(places) > 4 else ""
            out.append(f"{name} is set at {shown}{more}, and nothing reads it")
    return out


def duplicate_rules(sheet: Sheet) -> list[str]:
    seen, out = {}, []
    for rule in sheet.rules:
        if not rule.body:
            continue
        key = (rule.context, rule.selector, rule.body.rstrip("; "))
        if key in seen:
            first = seen[key]
            out.append(f"{sheet.source}:{rule.line} repeats {rule.selector[:70]!r} from line "
                       f"{first.line} with the same declarations; the earlier copy changes "
                       f"nothing, delete one")
        else:
            seen[key] = rule
    return out


def print_blocks(sheet: Sheet) -> list[str]:
    found = [(p, line) for p, _c, line in sheet.at_rules if PRINT_QUERY.match(p)]
    if len(found) <= 1:
        return []
    lines = ", ".join(str(line) for _p, line in found)
    return [f"{sheet.source} has {len(found)} @media print blocks (lines {lines}); "
            f"keep the one in §23 Print, after every section it overrides"]


def ratchet_instances(sheet: Sheet) -> dict[str, list[tuple[int, str]]]:
    """Every instance each ratchet counts, as (line, what)."""
    found = {k: [] for k in RATCHETS}
    for rule in sheet.rules:
        token_block = is_token_block(rule)
        for d in rule.declarations:
            if d.important:
                found["important"].append((d.line, f"{rule.selector[:50]} {{ {d.prop} }}"))
            if not token_block:
                value = _URL_OR_STRING.sub(" ", d.value)
                for m in RAW_COLOUR.finditer(value):
                    found["rawColours"].append(
                        (d.line, f"{rule.selector[:50]} {{ {d.prop}: {m.group(0)}... }}"))
        if is_style_rule(rule) and not token_block and (
                DARK_SELECTOR.search(rule.selector)
                or any(DARK_QUERY.search(c) for c in rule.context)):
            found["darkRules"].append((rule.line, rule.selector[:70]))
    return found


def load_baseline() -> dict:
    if not BASELINE.exists():
        return {}
    return json.loads(BASELINE.read_text(encoding="utf-8"))


def write_baseline(counts: dict, previous: dict) -> None:
    data = {"about": previous.get("about") or (
        "Counts .github/scripts/check_css.py holds style.css to. Each may only go "
        "down: --update-baseline writes a lower count and refuses a higher one. To "
        "raise one on purpose, edit this file and say why in the commit.")}
    data.update({k: counts[k] for k in RATCHETS})
    BASELINE.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8", newline="\n")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main(argv=None) -> int:
    ap = sitelib.arg_parser(__doc__)
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true",
                      help="fail on any rule, or on a count that differs from the baseline")
    mode.add_argument("--report", action="store_true",
                      help="list every instance each ratchet counts; always exits 0")
    mode.add_argument("--update-baseline", action="store_true",
                      help="write counts that fell; refuse any that rose")
    args = ap.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="backslashreplace")

    sheet, usage = collect()
    instances = ratchet_instances(sheet)
    counts = {k: len(v) for k, v in instances.items()}
    baseline = load_baseline()

    if args.report:
        for key, what in RATCHETS.items():
            print(f"{what}: {counts[key]} (baseline {baseline.get(key, 'none')})")
            for line, text in instances[key]:
                print(f"  style.css:{line}  {text}")
            print()
        return 0

    if args.update_baseline:
        rose = [k for k in RATCHETS if k in baseline and counts[k] > baseline[k]]
        if rose:
            for k in rose:
                print(f"{RATCHETS[k]} rose from {baseline[k]} to {counts[k]}; "
                      f"not writing a higher baseline (edit {BASELINE.name} by hand, "
                      f"with a reason, if it has to rise)")
            return 1
        if all(baseline.get(k) == counts[k] for k in RATCHETS):
            print(f"{BASELINE.relative_to(ROOT).as_posix()} is already current.")
            return 0
        write_baseline(counts, baseline)
        for k in RATCHETS:
            print(f"  {k:<11} {baseline.get(k, '-')!s:>5} -> {counts[k]}")
        print(f"Wrote {BASELINE.relative_to(ROOT).as_posix()}")
        return 0

    failures = []
    for code, found in (("undefined-property", undefined_properties(usage)),
                        ("unused-property", unused_properties(usage)),
                        ("duplicate-rule", duplicate_rules(sheet)),
                        ("print-blocks", print_blocks(sheet))):
        failures += [f"[{code}] {msg}" for msg in found]
    if not baseline:
        failures.append(f"[ratchet] {BASELINE.relative_to(ROOT).as_posix()} is missing; "
                        f"create it with --update-baseline")
    for key, what in RATCHETS.items():
        if key not in baseline:
            continue
        if counts[key] > baseline[key]:
            failures.append(
                f"[ratchet] {what}: {counts[key]}, up from {baseline[key]}. Use a token or "
                f"a more specific selector instead; `check_css.py --report` lists them by line")
        elif counts[key] < baseline[key]:
            failures.append(
                f"[ratchet] {what}: {counts[key]}, down from {baseline[key]}. Lock the lower "
                f"number in: python .github/scripts/check_css.py --update-baseline")

    for line in failures:
        print(line)
    summary = ", ".join(f"{counts[k]} {k}" for k in RATCHETS)
    if failures:
        print(f"\ncheck_css: {len(failures)} problem(s). Ratchets now: {summary}.")
        return 1
    print(f"style.css: {len(sheet.rules)} rules, {len(usage.sets)} custom properties set, "
          f"none undefined or unused, no duplicate rules, at most one print block. "
          f"Ratchets: {summary}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
