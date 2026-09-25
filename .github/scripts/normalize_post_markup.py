#!/usr/bin/env python3
"""Move the house styling out of post markup and into components.

Posts were written by copying the last post, so the same inline styles
travelled from file to file: 57 hand-coded "Back to all posts" links, 158
figures sized and spaced by style attributes, reference lists styled by
hand, and code blocks nobody told the highlighter the language of. Each
copy was a place the design could drift, and none of it answered to a
theme: a colour written into a style attribute is the same colour in the
dark theme, where it was usually unreadable.

This rewrites that markup onto classes, one transform per pattern.
Idempotent: a second run changes nothing, and --check exits 1 when any
transform would still change a tracked post, so a post copied from an
old one is caught before it is published.

    python .github/scripts/normalize_post_markup.py              # every tracked post
    python .github/scripts/normalize_post_markup.py blog/x.html  # one file (a post being published)
    python .github/scripts/normalize_post_markup.py --check      # CI: exit 1 if anything would change

Each file keeps its own line endings. Only markup changes: text a reader
sees is never edited, so read times and the prose checks are unaffected
(except for the back link, whose four words leave the page with it).

THE TRANSFORMS, in the order they run

back-link
    Deletes the <hr> plus <p><a class="post-cta">Back to all posts</a></p>
    pair that closed every post. The end band that shared-components.js
    renders under every article (renderPostEnd) routes the reader onward
    now; a second, hand-coded exit below it was noise, and it sat at a
    different depth in every post (inside .blog-post in some, outside in
    others, before or after its rule). The audit fails if one comes back.

figures
    <figure style="..."> becomes <figure class="kr-figure--solo ...">.
    Consecutive plain figures pair up side by side on wide screens
    (style.css, "Consecutive plain figures pair up"), and that rule tells
    a plain figure from a deliberate one by figure:not([style]). A figure
    somebody had styled was therefore never paired, and stripping its style
    attribute alone would have paired it with its neighbour. So the opt-out
    is made explicit first: every figure that carried a style attribute
    gets .kr-figure--solo, whose CSS (style.css, "Post components") undoes
    the pairing for it and for the figure beside it, and only then is the
    style removed. A figure with neither a style attribute nor the class
    pairs exactly as before. Declarations map as follows:
      margin, 18px to 32px         -> the solo figure's margin, 24px auto
                                      (18px 0 4px inside a scene box, which
                                      style.css sets from the context)
      display:flex, column, centre -> .kr-figure--embed (a video facade,
                                      an iframe or a social card, centred
                                      with its caption under it)
      text-align:center            -> .kr-figure--center
      anything else (a max-width)  -> kept inline: it belongs to the picture

figure images
    An <img> inside a figure loses the house declarations (full width, 8px
    corners, block, centred, height auto) to .kr-figure-img; the old
    4px corners become the house 8px, and the 760px cap goes, so a
    photograph spans the column as its caption does. A portrait frame
    capped to a landscape frame's height (width:auto; max-height) becomes
    .kr-figure-img--portrait. What is particular to one picture (a smaller
    max-width for a screenshot, pixelated rendering, a faded cover, the
    extra space a few screenshots were given) stays inline.

figure captions
    Inline caption sizing (margin-top, font-size, a max-width matching the
    embed above it, italics, centring) becomes .kr-figcaption.

audio cards
    The dark "audio callout" (the old component doc's pattern: a #1a1a1a box
    with a red rule, a monospace label and an <audio> player) becomes
    .kr-audio-card with __label, __player and __note. The inline version
    was the same near-black box in both themes, so on the dark page it
    was a border and nothing else, and its red label was not a link.

references
    Every cited post uses ol.references > li#ref-N, the shape the
    sidenotes, citation previews and jargon skip-list look for. Three
    posts had an unclassed, inline-styled <ol> inside a collapsible
    <details id="references"> (now details.kr-references) and one used
    ol.references-list; neither got sidenotes. The li ids that a.cite-ref
    links point at are never touched.

code languages
    A <pre><code> with no language-* class gets one, so Prism highlights
    it and the audit can require it. The guess is deliberately small: a
    block that parses as JSON is json, anything else is text (Prism's
    plain grammar, styled like every other block). The run prints each
    guess; correct a wrong one by hand, and it is never revisited, since
    only blocks without a language are touched.

prism calls
    Deletes a post's own `loadPrism([...]);` statement and then, when
    nothing else on the page calls loadPrism, its prism-loader.js tag.
    initCodeHighlighting (shared-components.js) loads Prism for any
    classed code block, with the languages the classes name, and runs
    before a post's inline script, so the post's call was ignored while
    Prism loaded. Classing the code is the one way to highlight it.

WHAT IT DOES NOT DO

Colours that appeared once (two trigger warnings, a citation box, three
tables, the nerd-mode console, a book grid) were moved onto components by
hand when this first ran; a pattern that occurs once is cheaper to edit
than to teach a script. audit_site.py's inline-color rule is what keeps
new ones out, and its messages name the component to use.
"""
from __future__ import annotations

import html
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402

ROOT = sitelib.ROOT


# ---------------------------------------------------------------------------
# Small markup helpers. The corpus is regular enough (double-quoted
# attributes, one tag per match) that tag-level regexes are exact here, and
# unlike a parser round trip they leave every byte they do not rewrite alone.
# ---------------------------------------------------------------------------

ATTR_RE = r'\s{name}\s*=\s*(["\'])(.*?)\1'


def get_attr(tag: str, name: str) -> str | None:
    m = re.search(ATTR_RE.format(name=re.escape(name)), tag, re.S)
    return m.group(2) if m else None


def drop_attr(tag: str, name: str) -> str:
    return re.sub(ATTR_RE.format(name=re.escape(name)), "", tag, count=1, flags=re.S)


def set_attr(tag: str, name: str, value: str) -> str:
    """Replace the attribute in place, or add it after the tag name."""
    pattern = ATTR_RE.format(name=re.escape(name))
    new = ' %s="%s"' % (name, value)
    if re.search(pattern, tag, re.S):
        return re.sub(pattern, lambda _m: new, tag, count=1, flags=re.S)
    return re.sub(r"^<([a-zA-Z0-9]+)", lambda m: "<" + m.group(1) + new, tag, count=1)


def add_classes(tag: str, *names: str) -> str:
    have = (get_attr(tag, "class") or "").split()
    wanted = have + [n for n in names if n and n not in have]
    return tag if wanted == have else set_attr(tag, "class", " ".join(wanted))


def restyle(tag: str, classes: list[str], residual: list[tuple[str, str]]) -> str:
    """Swap a tag's style attribute for `classes`, keeping the `residual`
    declarations inline. When the tag had no class attribute, the new one
    takes the style attribute's place, so the diff reads as a swap."""
    style = re.search(ATTR_RE.format(name="style"), tag, re.S)
    if style and get_attr(tag, "class") is None:
        swap = ' class="%s"' % " ".join(dict.fromkeys(classes))
        if residual:
            swap += ' style="%s"' % render_style(residual)
        return tag[:style.start()] + swap + tag[style.end():]
    tag = add_classes(tag, *classes)
    return set_attr(tag, "style", render_style(residual)) if residual else drop_attr(tag, "style")


def parse_style(style: str) -> list[tuple[str, str]]:
    """Declarations in order, as (property, value) with the property
    lower-cased and the value's whitespace collapsed."""
    out = []
    for chunk in style.split(";"):
        if ":" not in chunk:
            continue
        prop, _, value = chunk.partition(":")
        out.append((prop.strip().lower(), " ".join(value.split())))
    return out


def render_style(decls: list[tuple[str, str]]) -> str:
    return "; ".join("%s: %s" % d for d in decls) + ";"


def balanced_end(text: str, tag: str, after: int) -> int | None:
    """Index just past the </tag> that closes an element whose start tag
    ends at `after`, counting nested elements of the same name."""
    depth = 1
    for m in re.finditer(r"<(/?)%s\b[^>]*>" % tag, text[after:]):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return after + m.end()
    return None


# ---------------------------------------------------------------------------
# back-link
# ---------------------------------------------------------------------------

BACK_P = r'[ \t]*<p\b[^>]*>\s*<a\b[^>]*\bclass="post-cta"[^>]*>[^<]*</a>\s*</p>[ \t]*\r?\n'
HR_LINE = r'[ \t]*<hr\b[^>]*>[ \t]*\r?\n'
# The rule and the link, whole lines, in either order: most posts put the
# rule first, six put it after. Ordered alternatives, so a rule on both
# sides costs only the one the pair was written with.
BACK_LINK_RE = re.compile(r"%s%s|%s(?:%s)?" % (HR_LINE, BACK_P, BACK_P, HR_LINE))


def back_link(text, _path, notes):
    out, pos, count = [], 0, 0
    for m in BACK_LINK_RE.finditer(text):
        before = text[pos:m.start()]
        if re.match(r"[ \t]*</", text[m.end():]):
            # The pair was the last thing in its container, so the blank
            # lines that set it apart would now sit before a closing tag.
            # Close the gap, as though the pair had never been written.
            before = re.sub(r"(\r?\n)(?:[ \t]*\r?\n)+$", r"\1", before)
        out.append(before)
        pos = m.end()
        count += 1
    out.append(text[pos:])
    return "".join(out), count


# ---------------------------------------------------------------------------
# figures, figure images, figure captions
# ---------------------------------------------------------------------------

FIGURE_RE = re.compile(r"<figure\b[^>]*>[\s\S]*?</figure>")
FLEX_STACK = {("display", "flex"), ("flex-direction", "column"), ("align-items", "center")}
# The vertical spacing figures were given by hand: 18px to 32px above and
# below, centred or flush. All of it becomes the solo figure's margin.
# Anything else (a negative margin, a side offset) was a decision about
# one picture and stays inline.
HOUSE_MARGIN = re.compile(r"^(1[89]|2\d|3[0-2])px (?:0|auto)(?: \d+px)?$")


def figure_tag(tag):
    decls = parse_style(get_attr(tag, "style") or "")
    classes, residual = ["kr-figure--solo"], []
    stack = FLEX_STACK <= set(decls)
    if stack:
        classes.append("kr-figure--embed")
    for prop, value in decls:
        if (prop == "margin" and HOUSE_MARGIN.match(value)) or \
                (stack and (prop, value) in FLEX_STACK):
            continue
        if prop == "text-align" and value == "center":
            if not stack:
                classes.append("kr-figure--center")
            continue
        residual.append((prop, value))
    return restyle(tag, classes, residual)


# What .kr-figure-img (with .blog-post figure img under it) already does.
# The 760px cap is the old column less 20px, which left every photograph
# 10px short of its caption's rule on either side; the image now fills the
# column like the caption does.
IMG_HOUSE = {
    ("width", "100%"), ("height", "auto"), ("display", "block"),
    ("margin", "0 auto"), ("max-width", "100%"), ("max-width", "760px"),
    ("border-radius", "8px"), ("border-radius", "4px"),
}


def figure_img(tag):
    decls = parse_style(get_attr(tag, "style") or "")
    classes, residual = ["kr-figure-img"], []
    portrait = ("width", "auto") in decls and any(p == "max-height" for p, _ in decls)
    if portrait:
        classes.append("kr-figure-img--portrait")
    for prop, value in decls:
        if (prop, value) in IMG_HOUSE:
            continue
        if portrait and (prop, value) == ("width", "auto"):
            continue
        if portrait and prop == "max-height" and value == "507px":
            continue
        residual.append((prop, value))
    return restyle(tag, classes, residual)


CAPTION_HOUSE = {"margin-top", "font-size", "max-width", "text-align", "font-style", "line-height"}


def figure_caption(tag):
    decls = parse_style(get_attr(tag, "style") or "")
    residual = [d for d in decls if d[0] not in CAPTION_HOUSE]
    return restyle(tag, ["kr-figcaption"], residual)


def figures(text, path, notes):
    count = 0

    def one(m):
        nonlocal count
        block = m.group(0)
        if block.count("<figure") > 1:
            notes.append("nested <figure> left alone")
            return block
        head_end = block.index(">") + 1
        head, body = block[:head_end], block[head_end:]
        if get_attr(head, "style") is not None:
            head = figure_tag(head)

        def img(im):
            return figure_img(im.group(0)) if get_attr(im.group(0), "style") is not None else im.group(0)

        def cap(cm):
            return figure_caption(cm.group(0)) if get_attr(cm.group(0), "style") is not None else cm.group(0)

        body = re.sub(r"<img\b[^>]*>", img, body)
        body = re.sub(r"<figcaption\b[^>]*>", cap, body)
        new = head + body
        if new != block:
            count += 1
        return new

    return FIGURE_RE.sub(one, text), count


# ---------------------------------------------------------------------------
# audio cards
# ---------------------------------------------------------------------------

AUDIO_CARD_OPEN = re.compile(r'<div\b[^>]*\bstyle="[^"]*background:\s*#1a1a1a[^"]*"[^>]*>')


def audio_cards(text, _path, notes):
    count, pos, out = 0, 0, []
    for m in AUDIO_CARD_OPEN.finditer(text):
        if m.start() < pos:
            continue
        end = balanced_end(text, "div", m.end())
        inner = text[m.end():end - len("</div>")] if end else ""
        if not end or "<audio" not in inner:
            continue
        # The label is the monospace span, the player the <audio>, and a
        # paragraph after it (the transcript note the snippet asks for) the note.
        inner = re.sub(r'<span\b[^>]*\bstyle="[^"]*monospace[^"]*"[^>]*>',
                       lambda s: restyle(s.group(0), ["kr-audio-card__label"], []), inner, count=1)
        inner = re.sub(r'(<a\b[^>]*?)\s+style="\s*color:[^";]*;?\s*"', r"\1", inner)
        inner = re.sub(r"<audio\b[^>]*>", lambda a: restyle(a.group(0), ["kr-audio-card__player"], []), inner)
        inner = re.sub(r'<p\b[^>]*\bstyle="[^"]*"[^>]*>', lambda p: restyle(p.group(0), ["kr-audio-card__note"], []), inner)
        out.append(text[pos:m.start()])
        out.append(restyle(m.group(0), ["kr-audio-card"], []) + inner + "</div>")
        pos = end
        count += 1
    out.append(text[pos:])
    return "".join(out), count


# ---------------------------------------------------------------------------
# references
# ---------------------------------------------------------------------------

def references(text, _path, notes):
    count = 0

    def ol_list(m):
        nonlocal count
        count += 1
        return m.group(1) + "references" + m.group(2)

    text = re.sub(r'(<ol\b[^>]*\bclass=")references-list(")', ol_list, text)

    def styled_ol(m):
        nonlocal count
        count += 1
        return restyle(m.group(1), ["references"], []) + m.group(2)

    # An inline-styled list whose first item is a reference.
    text = re.sub(r'(<ol\b[^>]*\bstyle="[^"]*"[^>]*>)(\s*<li id="ref-)', styled_ol, text)

    def details(m):
        nonlocal count
        tag = m.group(0)
        decls = parse_style(get_attr(tag, "style") or "")
        residual = [d for d in decls if d[0] != "margin-top"]
        new = restyle(tag, ["kr-references"], residual) if get_attr(tag, "style") is not None \
            else add_classes(tag, "kr-references")
        count += new != tag
        return new

    text = re.sub(r'<details\b[^>]*\bid="references"[^>]*>', details, text)
    return text, count


# ---------------------------------------------------------------------------
# code languages
# ---------------------------------------------------------------------------

BARE_CODE_RE = re.compile(r"(<pre\b(?P<pre>[^>]*)>\s*<code)(?P<code>\b[^>]*)>(?P<body>[\s\S]*?)</code>")


def guess_language(body: str) -> str:
    try:
        json.loads(html.unescape(body))
        return "json"
    except ValueError:
        return "text"


def code_languages(text, path, notes):
    count = 0

    def one(m):
        nonlocal count
        if "language-" in m.group("pre") or "language-" in m.group("code"):
            return m.group(0)
        lang = guess_language(m.group("body"))
        notes.append("code block guessed as language-%s: %s"
                     % (lang, " ".join(m.group("body").split())[:50]))
        count += 1
        code_tag = add_classes("<code" + m.group("code") + ">", "language-" + lang)
        return m.group(1)[:-len("<code")] + code_tag + m.group("body") + "</code>"

    return BARE_CODE_RE.sub(one, text), count


# ---------------------------------------------------------------------------
# prism calls
# ---------------------------------------------------------------------------

# A statement on a line of its own, as every post that called it wrote it.
PRISM_CALL_RE = re.compile(r"^[ \t]*loadPrism\((?:\[[^\]\n]*\])?\);[ \t]*(\r?\n)?", re.M)
PRISM_TAG_RE = re.compile(r'^[ \t]*<script src="(?:\.\./)+js/prism-loader\.js"></script>[ \t]*\r?\n', re.M)


def prism_calls(text, _path, _notes):
    # A call that closed its <script> on the same line leaves the closing
    # tag where it was.
    text, count = PRISM_CALL_RE.subn("", text)
    # The loader tag goes only once nothing on the page calls it: a post
    # that re-highlights from a handler of its own (the nerd-mode toggle
    # on the schedule posts) still needs loadPrism defined before
    # initCodeHighlighting has fetched it.
    if "loadPrism" not in text:
        text, n = PRISM_TAG_RE.subn("", text)
        count += n
    return text, count


TRANSFORMS = [
    ("back-link", back_link),
    ("figures", figures),
    ("audio-cards", audio_cards),
    ("references", references),
    ("code-languages", code_languages),
    ("prism-calls", prism_calls),
]


def normalise(text: str, path: Path | None = None) -> tuple[str, dict, list]:
    """(new text, {transform: changes}, notes) for one file's markup."""
    counts, notes = {}, []
    for name, fn in TRANSFORMS:
        text, n = fn(text, path, notes)
        if n:
            counts[name] = n
    return text, counts, notes


def read(path: Path) -> str:
    # newline="" keeps \r\n where a file has it, so a CRLF post stays CRLF.
    with open(path, encoding="utf-8", newline="") as fh:
        return fh.read()


def write(path: Path, text: str) -> None:
    with open(path, "w", encoding="utf-8", newline="") as fh:
        fh.write(text)


def targets(paths: list[str]) -> list[Path]:
    if paths:
        return [ROOT / p for p in paths]
    return sitelib.tracked_posts()


def main(argv=None) -> int:
    parser = sitelib.arg_parser(__doc__)
    parser.add_argument("paths", nargs="*", metavar="blog/x.html",
                        help="files to normalise (default: every tracked post)")
    parser.add_argument("--check", action="store_true",
                        help="exit 1 if any transform would change a file; write nothing")
    args = parser.parse_args(argv)

    changed = []
    for path in targets(args.paths):
        before = read(path)
        after, counts, notes = normalise(before, path)
        rel = path.relative_to(ROOT).as_posix()
        if after == before:
            continue
        changed.append(rel)
        summary = ", ".join("%s %d" % kv for kv in counts.items())
        print("%s %s (%s)" % ("would change" if args.check else "normalised", rel, summary))
        for note in notes:
            print("    " + note)
        if not args.check:
            write(path, after)

    if args.check:
        if changed:
            print("%d post(s) carry markup the components replace.\n"
                  "run: python .github/scripts/normalize_post_markup.py" % len(changed))
            return 1
        print("post markup is normalised.")
        return 0
    print("%d file(s) normalised." % len(changed) if changed else "nothing to normalise.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
