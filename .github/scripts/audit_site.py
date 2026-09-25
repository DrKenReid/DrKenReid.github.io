#!/usr/bin/env python3
"""Site-wide audit: links, metadata, accessibility, feed, sitemap, posts.json.

Audits only git-tracked HTML (published pages); untracked drafts are skipped.
Run from the repo root:

  python .github/scripts/audit_site.py [--include-drafts] [--strict]

Exits 1 on any ERROR. --strict also exits 1 on any WARN: zero warnings is
the baseline, and a warning nothing fails on is one nobody reads.

Checks:
  links      internal href/src targets exist; malformed URLs (double scheme etc.)
  meta       description, canonical, og:*, twitter:*, JSON-LD validity per post
  a11y       img alt, duplicate ids, heading order, single h1, landmark
             nesting (a landmark must not close over open containers),
             aria-label on a role-less div/span, img with no src
  markup     attribute names are well formed (an unescaped quote inside a
             value ends it early and spills the rest out as attributes)
  components published posts use the post components: no literal colour
             in a style attribute (WARN), no hand-coded back link, every
             a.cite-ref resolves to ol.references > li#ref-N, every
             pre > code names its language, no raw YouTube iframe
  sw         every sw.js PRECACHE entry is a tracked file
  feed       feed.xml well-formed, items resolve to real files
  sitemap    sitemap.xml covers all published indexable pages, no ghosts
  posts      posts.json urls/images exist, tags in allowed set, readMinutes
  scripts    blog post script includes match the canonical set
  head       blog post heads carry the canonical elements (keywords, icons,
             manifest, BlogPosting + BreadcrumbList JSON-LD)
  retired    no #preloader and no inline Google Analytics snippet on a
             tracked page (analytics loads from js/analytics.js)
  lengths    top-level pages: <title> at most 65 characters, meta
             description at most 160 (WARN), where search results cut them
  series     every series in posts.json has a tracked series-<slug>.html
             page and a sitemap entry
  site map   every tracked top-level page is in KR_PAGES
             (js/shared-components.js), which the footer and palette read
  jekyll     no tracked Markdown is published beside the site by Pages
             (see _config.yml); blog/downloads/ is published on purpose
  orphans    INFO only: tracked assets that nothing references
  jsonld-ref every bare {"@id": ...} in any page's JSON-LD lands on a node
             (one with a @type) that some audited page defines
"""

import fnmatch
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

import sitelib

ROOT = sitelib.ROOT
SITE = sitelib.SITE
ALLOWED_TAGS = {"data science", "personal", "photography", "books", "ai", "finance",
                "philosophy", "advice", "science", "technology", "television", "writing",
                "music"}

# Per-post opt-in scripts that are legitimate additions to the canonical include set.
OPTIONAL_POST_SCRIPTS = {"../js/nerd-mode.js", "../js/prism-loader.js",
                         "../js/kr-viz.js"}   # only the interactive demo posts

# Pages exempt from content/metadata checks (verification stubs etc.).
EXEMPT_PAGES = {"google1473b6928dc28ce6.html"}

# Top-level pages the site map (KR_PAGES) leaves out on purpose: the page
# served for every missing URL and the service worker's offline fallback.
# Neither is somewhere a reader chooses to go.
NOT_IN_SITE_MAP = {"404.html", "offline.html"}

# Where search results cut a top-level page's title and description. A
# longer one is shown truncated mid-word, usually losing the part that
# said what the page is.
TITLE_MAX = 65
DESCRIPTION_MAX = 160

# Top-level pages whose description is over DESCRIPTION_MAX and waiting on
# shorter copy. Each is reported as INFO rather than WARN until it is
# rewritten; once a listed page fits, its entry is a WARN until removed,
# so the list can only shrink. Add nothing here: write shorter copy.
LONG_META_PENDING = {
    "data_science.html",
    "series-algorithms-live.html",
    "series-feedback.html",
    "series-how-this-site-is-built.html",
    "series-optimizing-your-schedule.html",
}

# Pages whose prose is quoted from someone else, so the house style rules
# (banned words, em dashes, straight quotes) do not apply to it.
PROSE_EXEMPT_PAGES = {"quotes.html"}

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr"}

# Elements HTML lets you leave unclosed. Only a container outside this set
# still being open when a landmark closes is a real nesting error.
OPTIONAL_END = {"p", "li", "dt", "dd", "tr", "td", "th", "thead", "tbody",
                "tfoot", "option", "optgroup", "rt", "rp", "caption",
                "colgroup"}

LANDMARKS = {"main", "article", "section", "nav", "aside", "header", "footer"}

# aria-label is dropped on these unless a role is present, because their
# implicit role is generic. Screen readers then announce nothing at all.
GENERIC_TAGS = {"div", "span"}

# What an attribute name may look like: the XML Name production restricted
# to ASCII, which covers data-*, aria-* and the namespaced SVG names
# (xlink:href). A name outside it is almost always the tail of a value whose
# quotes were not escaped. See check_attributes.
ATTR_NAME = re.compile(r"[A-Za-z_:][-A-Za-z0-9_:.]*")

PROSE_EXCLUDED = {"blockquote", "cite", "footer", "code", "pre", "script",
                  "style", "h1", "h2", "h3", "h4", "h5", "h6", "title", "q"}


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = []
        self.links = []          # (href, line)
        self.images = []         # (src, alt_or_None, loading, line)
        self.metas = {}          # name/property -> content
        self.link_rels = set()   # rel values seen on <link>
        self.jsonld_types = set()  # @type values in ld+json blocks
        self.canonical = None
        self.title = None
        self.headings = []       # (level, line)
        self.jsonld = []         # (text, line)
        self.scripts = []        # src list
        self.noindex = False
        self.alts = []           # alt strings on real imgs
        self.ext_nodims = []     # (src, line) external imgs without width+height
        self.fig_in_list = []    # lines where <figure> is a direct child of ul/ol
        self.prose = []          # (text, line) outside PROSE_EXCLUDED tags
        # (text, line) for everything a reader can actually see: only script
        # and style are dropped. `prose` is narrower on purpose (citations and
        # fiction keep their own typography), which is why the placeholder in
        # a reference slot went unseen by the style checks.
        self.visible = []
        self.bad_nesting = []    # (landmark, [open tags], line)
        self.label_no_role = []  # (tag, label, line)
        self.img_no_src = []     # lines of <img> with neither src nor srcset
        self.bad_attrs = []      # (tag, [names failing ATTR_NAME], line)
        self._stack = []
        self._excl = 0
        self._in_title = False
        # The document's title is its first <title>. An inline SVG carries
        # titles of its own (the colophon's chart does), and appending
        # those made the page title "Colophon - Ken ReidCommits per month".
        self._title_done = False
        self._in_jsonld = False
        self._jsonld_buf = []
        self._jsonld_line = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        line = self.getpos()[0]
        bad = [name for name, _v in attrs if not ATTR_NAME.fullmatch(name)]
        if bad:
            self.bad_attrs.append((tag, bad, line))
        if tag == "figure" and self._stack and self._stack[-1][0] in ("ul", "ol"):
            self.fig_in_list.append(line)
        if tag not in VOID:
            cls = a.get("class") or ""
            # "story" marks fiction, where em dashes in dialogue and
            # words like "quiet" are craft, not style violations.
            excluded = (tag in PROSE_EXCLUDED or "references" in cls
                        or "figure-note" in cls
                        or "story" in cls.split()
                        # publication entries are citations: the em dash
                        # between venue and year is the citation's own
                        # punctuation, not house prose
                        or "ds-pub-" in cls
                        or (a.get("id") or "").startswith("ref-"))
            self._stack.append((tag, excluded))
            if excluded:
                self._excl += 1
        if "id" in a:
            self.ids.append((a["id"], line))
        if tag == "a" and a.get("href"):
            self.links.append((a["href"], line))
        if tag in GENERIC_TAGS and a.get("aria-label") and not a.get("role"):
            self.label_no_role.append((tag, a["aria-label"][:48], line))
        if tag == "img" and not (a.get("src") or a.get("srcset")):
            self.img_no_src.append(line)
        if tag in ("img", "source"):
            src = a.get("src") or a.get("srcset")
            if src:
                self.images.append((tag, src, a.get("alt"), a.get("loading"), line))
            if tag == "img":
                if a.get("alt"):
                    self.alts.append((a["alt"].strip(), line))
                if src and src.startswith(("http://", "https://")) and \
                        not (a.get("width") and a.get("height")):
                    self.ext_nodims.append((src, line))
        if tag == "link":
            self.link_rels.update((a.get("rel") or "").split())
            if a.get("rel") == "canonical":
                self.canonical = a.get("href")
            elif a.get("href") and not (a.get("href") or "").startswith("http"):
                self.links.append((a["href"], line))
        if tag == "meta":
            key = a.get("name") or a.get("property")
            if key:
                self.metas[key] = a.get("content", "")
                if key == "robots" and "noindex" in (a.get("content") or ""):
                    self.noindex = True
        if tag == "title" and not self._title_done:
            self._in_title = True
        if re.fullmatch(r"h[1-6]", tag):
            self.headings.append((int(tag[1]), line))
        if tag == "script":
            if a.get("type") == "application/ld+json":
                self._in_jsonld = True
                self._jsonld_buf = []
                self._jsonld_line = line
            elif a.get("src"):
                self.scripts.append(a["src"])

    def handle_endtag(self, tag):
        if tag == "title" and self._in_title:
            self._in_title = False
            self._title_done = True
        if tag == "script" and self._in_jsonld:
            self._in_jsonld = False
            self.jsonld.append(("".join(self._jsonld_buf), self._jsonld_line))
        if tag not in VOID and any(t == tag for t, _x in self._stack):
            forced = []
            while self._stack:
                popped, was_excl = self._stack.pop()
                if was_excl:
                    self._excl = max(0, self._excl - 1)
                if popped == tag:
                    break
                if popped not in OPTIONAL_END:
                    forced.append(popped)
            # A landmark closing over still-open containers means the parser
            # decides where they end, which moves content out of the landmark
            # and turns the author's own closing tags into stray ones.
            if forced and tag in LANDMARKS:
                self.bad_nesting.append((tag, forced, self.getpos()[0]))

    def handle_data(self, data):
        if self._in_title:
            self.title = (self.title or "") + data
        if self._in_jsonld:
            self._jsonld_buf.append(data)
        elif self._excl == 0 and data.strip():
            self.prose.append((data, self.getpos()[0]))
        if (data.strip() and not self._in_title and not self._in_jsonld
                and not any(t in ("script", "style") for t, _ in self._stack)):
            self.visible.append((data, self.getpos()[0]))


def is_external(url):
    return url.startswith(("http://", "https://", "mailto:", "tel:", "//", "javascript:"))


def check_url_shape(url):
    """Return problem string for malformed URLs, else None."""
    if url.count("http://") + url.count("https://") > 1:
        # web.archive.org legitimately embeds the archived URL's scheme.
        if not url.startswith("https://web.archive.org/"):
            return "double scheme"
    if url.startswith("https://") or url.startswith("http://"):
        host = urlparse(url).netloc
        if not host or "." not in host:
            return "bad host"
    if " " in url.strip():
        return "contains space"
    return None


def resolve_local(page: Path, url: str):
    """Resolve a relative/site-absolute URL to a local path, or None if external."""
    if is_external(url) or url.startswith("#") or url.startswith("data:"):
        return None
    path = unquote(urlparse(url).path)
    if not path:
        return None
    if path.startswith("/"):
        return ROOT / path.lstrip("/")
    return (page.parent / path).resolve()


def tracked_files():
    """Every tracked file that exists, as repo-relative posix paths: what
    deploys, so what a link or a PRECACHE entry may point at."""
    return {p.relative_to(ROOT).as_posix() for p in sitelib.tracked()}


# Adverbs only for the last two. The adjectives earn their place: one post is
# about an embarrassing t-shirt, another discusses politeness as a subject, and
# aria-live="polite" is an attribute value rather than prose.
BANNED_PROSE = re.compile(
    r"\b(?:quiet(?:ly|er|est)?|honest(?:ly)?|embarrassingly|politely"
    # "I keep thinking about", "I keep coming back to": the habitual present
    # that presents a tic as a considered position. The past and perfect
    # forms are fine ("I kept thinking", "I've been thinking"), and so is
    # "keep" with an object ("I keep it in the repository").
    r"|I keep\s+\w+ing"
    # the world-weary concession, asserting settled authority by declining
    # to defend it
    r"|I no longer argue with"
    # "I have a soft spot for X": self-characterisation standing in for a
    # reason. Name what the thing does that earns the affection.
    r"|I(?:'ve| have)(?: got)? a soft spot for"
    # "the fix that stuck", "the name that stuck": implies a history of
    # rejected alternatives the reader is never shown. Only with "the", so a
    # literal use ("a paragraph that stuck" in the memory post) survives.
    r"|the \w+ that stuck"
    # "more times than I will admit to": a confession that confesses nothing.
    # Either give the number or cut the clause.
    r"|than I (?:will|would|care to|can|dare) admit"
    # Line counts as a measure of anything. They change with every edit and
    # they are not what makes a thing small or good. Matched with a following
    # unit word so "3 lines explaining yourself" (about email) survives.
    r"|[\d,]+ lines of (?:code|vanilla |JavaScript|CSS|Python|HTML|widget)"
    r"|(?:is|was|around|about|roughly|only|just|under)\s+(?:\w+\s+)?[~\d][\d,]* lines"
    r"|fits? in [~\d][\d,]* lines)\b",
    re.I)

# House style: straight ' and " in prose. Verbatim book passages
# (quotes.html, the quote-wall JSON) keep their original typography
# and are not audited here.
CURLY_PROSE = re.compile(r"[‘’“”]")

# The same four characters mapped to their straight forms, for comparing two
# copies of a title where only one was typed with curly quotes.
STRAIGHTEN = str.maketrans({"‘": "'", "’": "'",
                            "“": '"', "”": '"'})

# Scaffolding that must never be visible: a note-to-self left where the
# writing should be. Two shapes, both seen in the corpus. First, anything
# announcing itself (Placeholder:, TODO:, TBD, XXX, Lorem ipsum). Second, a
# whole visible sentence wrapped in square brackets, which is how the FAQ
# stubs and the empty reference slot were written. The second pattern needs
# the closing bracket to end the span and a verb-ish length to fire, so
# editorial insertions ("[sic]", "he [Popper] argued") stay legal.
# new-post-scaffolds.html is a sheet of outlines for posts not yet started;
# bracketed prompts are its content rather than something left behind in it.
# Nothing here is ever published, and it is the only file of its kind.
PLACEHOLDER_EXEMPT = {"new-post-scaffolds.html"}

PLACEHOLDER_PROSE = re.compile(
    r"\[\s*(?:placeholder|todo|tbd|tk|xxx|fixme|write|add|expand|fill)\b[^\]]*\]"
    r"|\blorem ipsum\b"
    r"|(?:^|(?<=[.!?]\s)|(?<=^\s))\[[A-Z][^\]]{24,}\]",
    re.I | re.M)


class PageCtx:
    """Everything a per-page check needs, in one object.

    Checks used to live inline in main() as a 200-line run of closures, which
    meant adding one involved threading state through an already long function.
    Now a check is a function of this context, and registering it is a line in
    PAGE_CHECKS.
    """

    def __init__(self, page, rel, text, parser, tracked, add):
        self.page = page
        self.rel = rel
        self.text = text
        self.p = parser
        self.tracked = tracked
        self.add = add
        self.is_post = rel.startswith("blog/") and not parser.noindex
        self.is_redirect = ('http-equiv="refresh"' in text
                            or "http-equiv='refresh'" in text)
        self.page_is_tracked = rel in tracked
        self.ids = {}                 # id -> first line seen
        self.idset = set()
        self.jsonld_headline = None
        self.jsonld_date = None


def check_ids(c):
    # --- ids ---
    c.ids = {}
    for i, line in c.p.ids:
        if i in c.ids:
            c.add("ERROR", c.page, line, "dup-id", f"duplicate id '{i}' (first at line {c.ids[i]})")
        else:
            c.ids[i] = line


def check_structure(c):
    # --- structure a screen reader depends on ---
    for landmark, forced, line in c.p.bad_nesting:
        c.add("ERROR", c.page, line, "landmark-nesting",
              f"</{landmark}> closes with {len(forced)} element(s) still open "
              f"({', '.join(forced[:4])}); the parser will close them here and "
              f"push the rest of the content out of the landmark")
    for tag, label, line in c.p.label_no_role:
        c.add("ERROR", c.page, line, "label-no-role",
              f"<{tag} aria-label=\"{label}\"> has no role, so the name is "
              f"dropped; add role=\"group\" (or region/navigation as fits)")
    for line in c.p.img_no_src:
        c.add("ERROR", c.page, line, "img-no-src",
              "<img> has neither src nor srcset; use a placeholder data URI "
              "if a script fills it in later")


def check_attributes(c):
    """ERROR on an attribute name that no author would write.

    Incident: the related-posts block wrote a post title into an alt
    attribute without escaping its double quotes, so three posts carried
    alt="Why You Aren't a "Visual Learner"". The browser ends the value at
    the second quote: a screen reader hears "Why You Aren't a", and the
    rest becomes two attributes named visual and learner"". Nothing looks
    wrong on the page, which is why it shipped. A hand-written alt with
    "Path" in quotes did the same on what-was-i-made-for.html. The name
    check catches every variant of this without knowing which attribute
    the stray quote was in.
    """
    for tag, names, line in c.p.bad_attrs:
        shown = ", ".join(repr(n[:40]) for n in names[:3])
        c.add("ERROR", c.page, line, "bad-attribute",
              f"<{tag}> has malformed attribute name(s) {shown}; a quote "
              f"inside an earlier value probably ended it early (write &quot;)")


def check_references(c):
    # --- links / images resolve (and must be git-tracked: a file that
    # exists locally but is untracked 404s in production) ---
    c.page_is_tracked = c.rel in c.tracked

    def check_target(url, line, what="target"):
        local = resolve_local(c.page, url)
        if local is None:
            return
        if not local.exists():
            c.add("ERROR", c.page, line, "broken-link", f"missing {what}: {url}")
        elif c.page_is_tracked:
            try:
                relp = local.resolve().relative_to(ROOT).as_posix()
            except ValueError:
                relp = None
            if relp and relp not in c.tracked:
                c.add("ERROR", c.page, line, "untracked-ref",
                      f"{what} exists locally but is not tracked by git: {url}")

    for url, line in c.p.links + [(u, l) for (_t, u, _a, _lz, l) in c.p.images]:
        shape = check_url_shape(url)
        if shape:
            c.add("ERROR", c.page, line, "bad-url", f"{shape}: {url[:120]}")
            continue
        if url.startswith(SITE + "/"):
            url = urlparse(url).path
        check_target(url, line)

    # inline style backgrounds: url(...) references the parser can't see
    for m in re.finditer(r"url\((['\"]?)([^)'\"]+)\1\)", c.text):
        u = m.group(2)
        if is_external(u) or u.startswith("data:"):
            continue
        check_target(u, c.text[:m.start()].count("\n") + 1, what="background")


def check_fragments(c):
    # --- same-page fragments ---
    c.idset = set(c.ids)
    for url, line in c.p.links:
        if url.startswith("#") and len(url) > 1 and url[1:] not in c.idset:
            c.add("WARN", c.page, line, "bad-fragment", f"no element with id '{url[1:]}'")


def check_img_alt(c):
    # --- images alt (only real img elements; <source> has no alt) ---
    for tag, src, alt, loading, line in c.p.images:
        if tag == "img" and alt is None:
            c.add("WARN", c.page, line, "no-alt", f"img missing alt: {src[:80]}")


def check_dup_alt(c):
    # --- duplicated alt text (screen readers hear it N times) ---
    alt_first = {}
    alt_seen = {}
    for alt, line in c.p.alts:
        if len(alt) < 9:
            continue
        alt_seen[alt] = alt_seen.get(alt, 0) + 1
        alt_first.setdefault(alt, line)
    for alt, n in alt_seen.items():
        if n >= 3:
            c.add("WARN", c.page, alt_first[alt], "dup-alt",
                  f"alt text repeated {n}x: '{alt[:70]}'")


def check_img_dims(c):
    # --- external images without dimensions cause layout shift ---
    for src, line in c.p.ext_nodims:
        c.add("WARN", c.page, line, "ext-img-dims",
              f"external img without width/height: {src[:90]}")


def check_figures(c):
    # --- figures may not be direct children of lists ---
    for line in c.p.fig_in_list:
        c.add("ERROR", c.page, line, "figure-in-list",
              "figure is a direct child of ul/ol (invalid HTML)")


# --- post components ---------------------------------------------------------
# Posts were written by copying the last one, so a style attribute or a
# hand-built block travelled from post to post until
# normalize_post_markup.py moved them onto the components in style.css
# ("Post components"). These rules stop the old markup coming back with the
# next copy. Every message names the style.css section whose comment shows
# the markup to use instead, because the stylesheet travels with every
# checkout and its banner is one search away; .github/docs/COMPONENTS.md
# has the same components with fuller markup and the reasons. The names are
# the sections' banner titles exactly (tests/test_audit_rules.py checks),
# so a search for one lands on it.
COMPONENT_DOC = "style.css"
COMPONENT_SECTIONS = {
    "quote": "Pull quote",
    "table": "Table",
    "figure": "Figures",
    "audio": "Audio card",
    "code": "Code",
    "video": "Embeds (initEmbedFacades)",
    "note": "Muted note and end note",
    "warning": "Content warning",
    "end": "The end band (renderPostEnd)",
    "references": "References",
    "components": "Post components",
}

# Where an inline colour on each element is most likely to have come from.
COMPONENT_FOR_TAG = {
    "blockquote": "quote", "footer": "quote",
    "table": "table", "thead": "table", "tr": "table", "th": "table", "td": "table",
    "img": "figure", "figure": "figure", "figcaption": "figure",
    "audio": "audio", "pre": "code",
    "p": "note", "strong": "warning",
}

CSS_NAMED_COLOURS = frozenset("""
    aliceblue antiquewhite aqua aquamarine azure beige bisque black
    blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse
    chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan
    darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta
    darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
    darkslateblue darkslategray darkslategrey darkturquoise darkviolet
    deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite
    forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green
    greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender
    lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
    lightgoldenrodyellow lightgray lightgreen lightgrey lightpink
    lightsalmon lightseagreen lightskyblue lightslategray lightslategrey
    lightsteelblue lightyellow lime limegreen linen magenta maroon
    mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen
    mediumslateblue mediumspringgreen mediumturquoise mediumvioletred
    midnightblue mintcream mistyrose moccasin navajowhite navy oldlace
    olive olivedrab orange orangered orchid palegoldenrod palegreen
    paleturquoise palevioletred papayawhip peachpuff peru pink plum
    powderblue purple rebeccapurple red rosybrown royalblue saddlebrown
    salmon sandybrown seagreen seashell sienna silver skyblue slateblue
    slategray slategrey snow springgreen steelblue tan teal thistle tomato
    turquoise violet wheat white whitesmoke yellow yellowgreen
""".split())

# Properties that take a colour, custom properties included (an inline
# --accent: #hex is as fixed as a colour: #hex).
COLOUR_PROPERTY = re.compile(
    r"--[\w-]+|color|background(?:-color|-image)?|fill|stroke|accent-color"
    r"|caret-color|box-shadow|text-shadow|text-decoration(?:-color)?"
    r"|column-rule(?:-color)?|outline(?:-color)?"
    r"|border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?(?:-color)?")
COLOUR_LITERAL = re.compile(
    r"#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|\b[a-z]+\b", re.I)
# A token reference or a file name says nothing about colour, even when it
# contains a colour's name (var(--kr-red), url(red-door.jpg)).
NOT_A_COLOUR = re.compile(r"\b(?:var|url)\([^()]*\)")

YOUTUBE_SRC = re.compile(r"//(?:www\.)?(?:youtube(?:-nocookie)?\.com|youtu\.be)/", re.I)


def inline_colours(style):
    """The declarations in a style attribute that set a literal colour.

    A token (var(--kr-muted), var(--viz-s1)) follows the theme and passes.
    A hex, rgb()/hsl() or named colour is the same on the light page and
    the dark one, which is how an inline #555 quotation came to be 2.3:1
    in the dark theme."""
    found = []
    for decl in style.split(";"):
        prop, sep, value = decl.partition(":")
        prop = prop.strip().lower()
        if not sep or not COLOUR_PROPERTY.fullmatch(prop):
            continue
        for m in COLOUR_LITERAL.finditer(NOT_A_COLOUR.sub(" ", value)):
            word = m.group(0).lower()
            if word[0] == "#" or word[-1] == "(" or word in CSS_NAMED_COLOURS:
                found.append(f"{prop}: {value.strip()}")
                break
    return found


class ComponentParser(HTMLParser):
    """The markup the post-component rules read, with enough nesting to
    tell a list item in ol.references from one anywhere else."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.inline_colours = []   # (line, tag, [declarations])
        self.back_links = []       # lines of a.post-cta
        self.cite_refs = []        # (target id, line) of a.cite-ref
        self.ref_items = set()     # ids of li that are children of ol.references
        self.bare_code = []        # lines of pre > code with no language-*
        self.youtube = []          # (src, line) of YouTube iframes
        self._stack = []           # open (tag, classes)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        line = self.getpos()[0]
        classes = (a.get("class") or "").split()
        # <li> and <p> may be left unclosed; the next one closes them.
        if tag in ("li", "p") and self._stack and self._stack[-1][0] == tag:
            self._stack.pop()
        parent, parent_classes = self._stack[-1] if self._stack else ("", [])
        found = inline_colours(a.get("style") or "")
        if found:
            self.inline_colours.append((line, tag, found))
        if tag == "a" and "post-cta" in classes:
            self.back_links.append(line)
        if tag == "a" and "cite-ref" in classes and (a.get("href") or "").startswith("#"):
            self.cite_refs.append((a["href"][1:], line))
        if tag == "li" and parent == "ol" and "references" in parent_classes and a.get("id"):
            self.ref_items.add(a["id"])
        # Prism reads the language from the code element or from its pre.
        if tag == "code" and parent == "pre" and not any(
                c.startswith("language-") for c in classes + parent_classes):
            self.bare_code.append(line)
        if tag == "iframe" and YOUTUBE_SRC.search(a.get("src") or ""):
            self.youtube.append((a["src"], line))
        if tag not in VOID:
            self._stack.append((tag, classes))

    def handle_endtag(self, tag):
        if any(t == tag for t, _c in self._stack):
            while self._stack and self._stack.pop()[0] != tag:
                pass


def check_post_components(c):
    # --- published posts use the post components, not their inline forms ---
    if not (c.is_post and c.page_is_tracked) or c.is_redirect:
        return
    p = ComponentParser()
    p.feed(c.text)

    def doc(key):
        return f"see {COMPONENT_DOC}, '{COMPONENT_SECTIONS[key]}'"

    for line, tag, decls in p.inline_colours:
        c.add("WARN", c.page, line, "inline-color",
              f"<{tag}> sets {decls[0]} in its style attribute: the same colour in "
              f"both themes; use the component or a --kr-* token instead "
              f"({doc(COMPONENT_FOR_TAG.get(tag, 'components'))})")
    for line in p.back_links:
        c.add("ERROR", c.page, line, "back-link",
              "hand-coded 'Back to all posts' link: the end band under every post "
              "routes the reader on; delete this <p> and the <hr> beside it "
              f"({doc('end')})")
    reported = set()
    for ref, line in p.cite_refs:
        if ref not in p.ref_items and ref not in reported:
            reported.add(ref)
            c.add("ERROR", c.page, line, "references",
                  f"a.cite-ref points at #{ref}, which is not an ol.references > "
                  f"li#{ref}: sidenotes and citation previews read only that "
                  f"shape ({doc('references')})")
    for line in p.bare_code:
        c.add("ERROR", c.page, line, "code-language",
              "pre > code without a language-* class: Prism leaves it plain; "
              "name the language (language-python, language-json), or "
              f"language-text for program output ({doc('code')})")
    for src, line in p.youtube:
        c.add("ERROR", c.page, line, "youtube-iframe",
              f"YouTube iframe in the markup ({src[:60]}): it loads the player "
              "and its cookies before anyone presses play; use a "
              f"button.kr-embed-facade ({doc('video')})")


def check_placeholders(c):
    # --- unwritten scaffolding that escaped into the page ---
    # A reference slot reading "[Placeholder: a general operational research
    # reference]" shipped in factorio-live.html, and the FAQ stubs in the same
    # draft were the same shape. Both are visible text, so this reads the
    # visible stream rather than the raw file: bracketed spans are everywhere
    # in the script blocks (arr[i + 1], [data-theme="dark"]) and none of those
    # are prose. It cannot use `prose`, which drops the reference list, since
    # that is exactly where the shipped one was. Runs on drafts too, which is
    # where these are supposed to die.
    if Path(c.rel).name in PLACEHOLDER_EXEMPT:
        return
    for chunk, line in c.p.visible:
        for m in PLACEHOLDER_PROSE.finditer(chunk):
            c.add("ERROR", c.page, line, "placeholder",
                  f"unwritten placeholder in prose: {m.group(0)[:80]}")


def is_top_level(rel):
    """A page at the site root (index.html, about.html, series-x.html)."""
    return "/" not in rel


# The Google Analytics snippet as it was pasted into every page: the
# loader <script src=".../gtag/js?id=..."> and an inline block calling
# gtag('config', ...). js/analytics.js replaced both.
GTAG_LOADER = re.compile(r"<script\b[^>]*\bsrc=[\"'][^\"']*googletagmanager\.com", re.I)
INLINE_SCRIPT = re.compile(r"<script\b(?![^>]*\bsrc=)[^>]*>(.*?)</script>", re.I | re.S)
# The set-up calls, not gtag('event', ...): a page may still send an event
# through the gtag() that analytics.js defines.
GTAG_CALL = re.compile(
    r"\bgtag\s*\(\s*['\"](?:config|js)['\"]|\bfunction\s+gtag\s*\(|googletagmanager\.com")


def check_retired_markup(c):
    """ERROR on two pieces of markup the site retired, on tracked pages.

    #preloader: a full-screen cover that a script took away once the DOM
    was ready, so every page, the homepage included, showed nothing until
    JavaScript had run, and with the script blocked or failing it stayed up
    until a four-second CSS failsafe gave up on it. The analytics snippet:
    pasted into every page, it fetched gtag.js in the <head> ahead of the
    page's own scripts; js/analytics.js now queues the config and loads
    gtag.js once, after load, from one place. Both travelled into every new
    page copied from an old one, which is what this rule stops.
    """
    if not c.page_is_tracked:
        return
    if "preloader" in c.ids:
        c.add("ERROR", c.page, c.ids["preloader"], "preloader",
              "id=\"preloader\": the preloader was retired (it hid the page until a "
              "script removed it); delete the element")
    loader = GTAG_LOADER.search(c.text)
    inline = next((m for m in INLINE_SCRIPT.finditer(c.text)
                   if GTAG_CALL.search(m.group(1))), None)
    for m in (loader, inline):
        if m:
            c.add("ERROR", c.page, c.text.count("\n", 0, m.start()) + 1, "inline-analytics",
                  "inline Google Analytics snippet: load analytics with "
                  "<script defer src=\".../js/analytics.js\"></script> instead")
            break


def check_meta_length(c):
    """Report a title or description that search results would cut off
    (TITLE_MAX, DESCRIPTION_MAX). On a top-level page it is a WARN. On a
    post it is INFO: a post's <title> and description are its own copy,
    written with the post, and generate_post_head.py never rewrites them,
    so the length is a note for the next edit rather than a failure.
    noindex pages and redirects are never shown in results."""
    if c.p.noindex or c.is_redirect or not c.page_is_tracked:
        return
    title = " ".join((c.p.title or "").split())
    desc = c.p.metas.get("description", "")
    long_title = len(title) > TITLE_MAX
    long_desc = len(desc) > DESCRIPTION_MAX
    if not is_top_level(c.rel):
        if long_title:
            c.add("INFO", c.page, 0, "long-title",
                  f"<title> is {len(title)} characters (at most {TITLE_MAX})")
        if long_desc:
            c.add("INFO", c.page, 0, "long-desc",
                  f"meta description is {len(desc)} characters (at most {DESCRIPTION_MAX})")
        return
    pending = c.rel in LONG_META_PENDING
    if long_title:
        c.add("WARN", c.page, 0, "long-title",
              f"<title> is {len(title)} characters (at most {TITLE_MAX}): {title[:70]!r}")
    if long_desc:
        c.add("INFO" if pending else "WARN", c.page, 0, "long-desc",
              f"meta description is {len(desc)} characters (at most {DESCRIPTION_MAX})"
              + ("; listed in LONG_META_PENDING, awaiting shorter copy" if pending else ""))
    elif pending:
        c.add("WARN", c.page, 0, "long-desc",
              f"description now fits ({len(desc)} characters): remove {c.rel} "
              f"from LONG_META_PENDING in audit_site.py")


def check_prose(c):
    # --- prose style rules (banned words, em dashes, curly quotes) ---
    # Posts plus the top-level pages. The check used to be posts-only, which
    # let "Three playlists I keep coming back to" sit on music.html
    # indefinitely. Widening it costs nothing: the only non-post prose that
    # trips these rules is quotes.html, and that is verbatim book passages
    # keeping their author's own wording and typography.
    if c.rel in PROSE_EXEMPT_PAGES or c.is_redirect or c.p.noindex:
        return
    for chunk, line in c.p.prose:
        # Banned words and straight quotes are house rules everywhere public,
        # which is why "Three playlists I keep coming back to" sat unnoticed
        # on music.html while the check was posts-only.
        for m in BANNED_PROSE.finditer(chunk):
            c.add("WARN", c.page, line, "banned-word",
                  f"'{m.group(0)}' in prose (banned word)")
        if CURLY_PROSE.search(chunk):
            c.add("WARN", c.page, line, "curly-quote",
                  f"curly quote/apostrophe in prose (use straight ' \"): ...{chunk.strip()[:60]}...")
        # The em dash rule is written for blog prose. The top-level pages use
        # dashes in project and publication lines, which is a different
        # register, so widening this one is a decision rather than a fix.
        if c.is_post and "—" in chunk:
            c.add("WARN", c.page, line, "em-dash",
                  f"em dash in prose: ...{chunk.strip()[:60]}...")


def check_headings(c):
    # --- headings ---
    if not c.is_redirect:
        h1s = [l for (lv, l) in c.p.headings if lv == 1]
        if c.is_post and len(h1s) == 0:
            c.add("WARN", c.page, 0, "no-h1", "post has no h1")
        if len(h1s) > 1:
            c.add("WARN", c.page, h1s[1], "multi-h1", f"{len(h1s)} h1 elements")
        prev = 0
        for lv, line in c.p.headings:
            if prev and lv > prev + 1:
                c.add("INFO", c.page, line, "heading-skip", f"h{prev} -> h{lv}")
            prev = lv


def check_metadata(c):
    # --- metadata (posts + top-level pages, not redirects) ---
    if not c.is_redirect and not c.p.noindex:
        desc = c.p.metas.get("description", "")
        if not desc:
            c.add("ERROR", c.page, 0, "no-desc", "missing meta description")
        elif CURLY_PROSE.search(desc):
            c.add("WARN", c.page, 0, "curly-quote",
                  "curly quote/apostrophe in meta description (use straight ' \")")
        elif len(desc) < 50:
            c.add("WARN", c.page, 0, "short-desc", f"description only {len(desc)} chars")
        # The upper limit is check_meta_length's, for posts and pages alike.
        expected_canonical = f"{SITE}/{c.rel}".replace("/index.html", "/")
        if not c.p.canonical:
            c.add("WARN", c.page, 0, "no-canonical", "missing canonical link")
        elif c.p.canonical.rstrip("/") not in (expected_canonical.rstrip("/"), f"{SITE}/{c.rel}"):
            c.add("WARN", c.page, 0, "canonical-mismatch",
                  f"canonical {c.p.canonical} != {expected_canonical}")
        for k in ("og:title", "og:description", "og:image", "og:url"):
            if k not in c.p.metas:
                c.add("WARN", c.page, 0, "no-og", f"missing {k}")
        if "twitter:card" not in c.p.metas:
            c.add("INFO", c.page, 0, "no-twitter", "missing twitter:card")
        og_img = c.p.metas.get("og:image", "")
        if og_img:
            shape = check_url_shape(og_img)
            if shape:
                c.add("ERROR", c.page, 0, "bad-og-image", f"{shape}: {og_img[:120]}")
            elif og_img.startswith(SITE):
                local = ROOT / unquote(urlparse(og_img).path.lstrip("/"))
                if not local.exists():
                    c.add("ERROR", c.page, 0, "bad-og-image", f"og:image file missing: {og_img}")


def check_jsonld(c):
    # --- JSON-LD ---
    c.jsonld_headline = None
    c.jsonld_date = None
    for raw, line in c.p.jsonld:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            c.add("ERROR", c.page, line, "jsonld-parse", f"invalid JSON-LD: {e}")
            continue
        # Top-level nodes: a bare node, a list of them, or an @graph (the
        # homepage's WebSite + Person), whose members count as top level.
        top = data if isinstance(data, list) else [data]
        if isinstance(data, dict) and isinstance(data.get("@graph"), list):
            top = data["@graph"]
        for node in top:
            if isinstance(node, dict) and isinstance(node.get("@type"), str):
                c.p.jsonld_types.add(node["@type"])
        if isinstance(data, dict):
            c.jsonld_headline = data.get("headline") or c.jsonld_headline
            c.jsonld_date = data.get("datePublished") or c.jsonld_date

        def walk(node):
            if isinstance(node, dict):
                for k, v in node.items():
                    if isinstance(v, str) and ("http://" in v or "https://" in v):
                        shape = check_url_shape(v)
                        if shape:
                            c.add("ERROR", c.page, line, "jsonld-url", f"{k}: {shape}: {v[:120]}")
                        elif v.startswith(SITE + "/"):
                            lp = ROOT / unquote(urlparse(v).path.lstrip("/"))
                            if "." in lp.name and not lp.exists():
                                c.add("ERROR", c.page, line, "jsonld-url", f"{k}: missing file {v}")
                    else:
                        walk(v)
            elif isinstance(node, list):
                for v in node:
                    walk(v)
        walk(data)


def check_consistency(c):
    # --- one fact, many places: dates and headlines must agree ---
    if c.is_post and not c.is_redirect:
        cit = (c.p.metas.get("citation_publication_date") or "").replace("/", "-")
        dc = c.p.metas.get("DC.date") or ""
        dates = {k: v for k, v in
                 (("citation", cit), ("DC.date", dc), ("JSON-LD", c.jsonld_date or ""))
                 if v}
        if len(set(dates.values())) > 1:
            c.add("WARN", c.page, 0, "date-mismatch",
                  "publication dates disagree: " +
                  ", ".join(f"{k}={v}" for k, v in dates.items()))
        c.p.page_date = next(iter(set(dates.values())), None) \
            if len(set(dates.values())) == 1 else None

        def _norm_title(s):
            return (s or "").strip().translate(STRAIGHTEN)

        cit_title = _norm_title(c.p.metas.get("citation_title"))
        if c.jsonld_headline and cit_title and _norm_title(c.jsonld_headline) != cit_title:
            c.add("WARN", c.page, 0, "headline-mismatch",
                  f"JSON-LD headline '{c.jsonld_headline[:50]}' != title '{cit_title[:50]}'")


# Order is the contract: check_ids fills the id map that check_fragments reads,
# and check_jsonld fills the headline and date that check_consistency compares.
# Append a new check here and it runs against every audited page.
PAGE_CHECKS = [
    check_ids,
    check_structure,
    check_attributes,
    check_references,
    check_fragments,
    check_img_alt,
    check_dup_alt,
    check_img_dims,
    check_figures,
    check_post_components,
    check_placeholders,
    check_retired_markup,
    check_prose,
    check_headings,
    check_metadata,
    check_meta_length,
    check_jsonld,
    check_consistency,
]


# The service worker's install list: `var PRECACHE = [ './a', './b' ];`.
PRECACHE_LIST = re.compile(r"\b(?:var|let|const)\s+PRECACHE\s*=\s*\[(.*?)\]", re.S)
PRECACHE_ENTRY = re.compile(r"""(['"])(.*?)\1""")


def precache_entries(sw_text):
    """The PRECACHE URLs in sw.js as repo-relative paths, or None when the
    list cannot be found (which the caller must treat as a failure, or the
    check would pass by finding nothing to check)."""
    m = PRECACHE_LIST.search(sw_text)
    if not m:
        return None
    out = []
    for _q, url in PRECACHE_ENTRY.findall(m.group(1)):
        path = unquote(urlparse(url).path)
        path = path[2:] if path.startswith("./") else path.lstrip("/")
        out.append(path + "index.html" if path == "" or path.endswith("/") else path)
    return out


def check_precache(tracked, add):
    """ERROR when a sw.js PRECACHE entry is not a tracked file.

    cache.addAll() is all or nothing: one entry that 404s rejects the whole
    install, the new worker never activates, and offline reading stops for
    every visitor while every page still works online. Nothing on screen
    or in the console of a normal visit says so. The list is kept by hand
    and has already had to change whenever the bundles did (site.js
    replaced popper and bootstrap in it), and a file that exists only in a
    working copy passes a local test and 404s on Pages. Tracked is the bar
    because tracked is what deploys.
    """
    sw = ROOT / "sw.js"
    if not sw.exists():
        return
    entries = precache_entries(sw.read_text(encoding="utf-8"))
    if entries is None:
        add("ERROR", "sw.js", 0, "precache",
            "no PRECACHE list found; this check needs updating to match sw.js")
        return
    for path in entries:
        if path not in tracked or not (ROOT / path).exists():
            add("ERROR", "sw.js", 0, "precache",
                f"PRECACHE entry {path} is not a tracked file, so the service "
                f"worker install fails and offline reading stops")


# --- site-level structure ------------------------------------------------------

SITEMAP_NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def sitemap_locs():
    """The <loc> URLs in sitemap.xml, or None when it does not parse (the
    sitemap check reports that on its own)."""
    try:
        root = ET.parse(ROOT / "sitemap.xml").getroot()
    except (ET.ParseError, OSError):
        return None
    return {el.text.strip() for el in root.findall(".//s:loc", SITEMAP_NS) if el.text}


def series_names(posts):
    """Every series name in posts.json, sorted."""
    return sorted({entry["name"] for post in posts
                   for entry in sitelib.series_list(post) if entry.get("name")})


def check_series_pages(posts, tracked, locs, add):
    """ERROR when a series in posts.json has no page or no sitemap entry.

    A post's series line, the series chip on its card and the palette all
    link to seriesPageHref(name), which nobody checks until a reader
    follows it: a series created in posts.json before its page is written,
    or renamed there alone, is a live link to a 404 on every post in it.
    The page is found by the same slug rule the links use.
    """
    for name in series_names(posts):
        rel = sitelib.series_page(name)
        if rel not in tracked:
            add("ERROR", "posts.json", 0, "series-page",
                f"series '{name}' has no tracked {rel}, which every post in it "
                f"links to (copy an existing series page)")
        elif locs is not None and f"{SITE}/{rel}" not in locs:
            add("ERROR", "sitemap.xml", 0, "series-sitemap",
                f"series page {rel} is not in the sitemap; run "
                f"python .github/scripts/generate_sitemap.py")


SITE_MAP_SOURCE = "js/shared-components.js"
KR_PAGES_START = re.compile(r"\bKR_PAGES\s*=\s*\[")
JS_STRING = re.compile(r"""(['"`])((?:\\.|(?!\1).)*)\1""", re.S)
# '/about.html', 'about.html', './', '/', 'https://www.kenreid.co.uk/x.html'
PAGE_HREF = re.compile(r"^(?:https://www\.kenreid\.co\.uk)?(?:\./|/)?(?:[\w-]+\.html)?(?:[?#]\S*)?$")


def page_path(href):
    """A page href as the repo-relative file it serves: '/about.html' and
    './about.html' are about.html, '/' is index.html."""
    path = urlparse(href.replace(SITE, "", 1)).path.lstrip("./").lstrip("/")
    return path or "index.html"


def kr_pages(js_text):
    """The page files KR_PAGES lists, or None when there is no KR_PAGES.

    Every quoted string in the array that looks like a page href counts,
    rather than only `href: '...'`, so an entry that builds its link as
    `root + 'about.html'` is still seen."""
    m = KR_PAGES_START.search(js_text)
    if not m:
        return None
    strings, depth, i = [], 0, m.end() - 1
    while i < len(js_text):
        ch = js_text[i]
        if ch in "'\"`":
            s = JS_STRING.match(js_text, i)
            if s:
                strings.append(s.group(2))
            i = s.end() if s else i + 1
            continue
        if js_text.startswith(("//", "/*"), i):
            # A commented-out entry is not a listed page.
            end = js_text.find("\n" if js_text[i + 1] == "/" else "*/", i + 2)
            i = len(js_text) if end < 0 else end + (0 if js_text[i + 1] == "/" else 2)
            continue
        depth += {"[": 1, "]": -1}.get(ch, 0)
        i += 1
        if depth == 0:
            break
    return {page_path(s) for s in strings
            if s and PAGE_HREF.match(s) and (".html" in s or s in ("/", "./"))}


def check_site_map(pages_rel, posts, add):
    """ERROR when a tracked top-level page is missing from KR_PAGES.

    KR_PAGES is the one list of the site's pages: the footer and the
    command palette are drawn from it (the header is written by hand). A
    page left out of it has no way in except a link someone remembered to
    write, which is how the Series index was missing from the footer and
    the palette before the list existed. Series pages may be listed there
    or not: their links come from posts.json, and check_series_pages holds
    those.
    """
    source = ROOT / SITE_MAP_SOURCE
    listed = kr_pages(source.read_text(encoding="utf-8")) if source.exists() else None
    if listed is None:
        add("ERROR", SITE_MAP_SOURCE, 0, "site-map",
            "no KR_PAGES array found; this check reads the site's page list from it")
        return
    series_pages = {sitelib.series_page(n) for n in series_names(posts)}
    for rel in sorted(pages_rel):
        if (is_top_level(rel) and rel not in listed and rel not in EXEMPT_PAGES
                and rel not in NOT_IN_SITE_MAP and rel not in series_pages):
            add("ERROR", rel, 0, "site-map",
                f"{rel} is not in KR_PAGES ({SITE_MAP_SOURCE}), so neither the footer "
                f"nor the command palette leads to it")


# The one Markdown file published beside the site on purpose, besides the
# downloads: the repository's front page. Pages serves it raw at
# /README.md, which says nothing the public repository does not.
PUBLISHED_MARKDOWN_OK = {"README.md"}

# Internal docs waiting to move under .github/docs/. Each is INFO until it
# moves; once the file has gone, its entry is a WARN until removed, so the
# list can only shrink. The component and demo-engine docs were the last
# two (now .github/docs/COMPONENTS.md and VIZ-ENGINE.md). Add nothing here.
PUBLISHED_MARKDOWN_PENDING = set()


def jekyll_excludes(config_text):
    """The `exclude:` patterns in _config.yml, block or inline list."""
    out, in_block = [], False
    for raw in config_text.splitlines():
        line = raw.split("#", 1)[0].rstrip()
        if not line.strip():
            continue
        m = re.match(r"exclude\s*:\s*(.*)$", line)
        if m:
            inline = m.group(1).strip()
            if inline.startswith("["):
                out += [p.strip().strip("'\"") for p in inline.strip("[]").split(",") if p.strip()]
            in_block = not inline
            continue
        if in_block and re.match(r"\s+-\s*", line):
            out.append(line.split("-", 1)[1].strip().strip("'\""))
        elif not line.startswith((" ", "\t")):
            in_block = False
    return out


def jekyll_publishes(rel, excludes):
    """Whether Jekyll on Pages would copy tracked file `rel` into the site.

    Jekyll leaves out any path with a part starting with '.', '_' or '#' or
    ending in '~' (which keeps .github/ private), and whatever _config.yml
    excludes. Markdown without front matter is not rendered (the config's
    require_front_matter) but is still copied, raw, as a static file."""
    parts = rel.split("/")
    if any(p.startswith((".", "_", "#")) or p.endswith("~") for p in parts):
        return False
    prefixes = ["/".join(parts[:i]) for i in range(1, len(parts) + 1)]
    return not any(fnmatch.fnmatch(p, pat.rstrip("/")) for p in prefixes for pat in excludes)


def check_published_markdown(tracked, add):
    """ERROR when Pages would publish a tracked Markdown file it should not.

    The component and viz-engine docs were kept in blog/, where Pages
    published them with the site for anyone to read. Internal docs live
    under .github/docs/, which Jekyll never publishes. blog/downloads/*.md
    are published on purpose: they are the files offered as downloads
    (_config.yml keeps them raw)."""
    config = ROOT / "_config.yml"
    excludes = jekyll_excludes(config.read_text(encoding="utf-8")) if config.exists() else []
    for rel in sorted(tracked):
        if (rel.lower().endswith(".md") and not rel.startswith("blog/downloads/")
                and rel not in PUBLISHED_MARKDOWN_OK and jekyll_publishes(rel, excludes)):
            pending = rel in PUBLISHED_MARKDOWN_PENDING
            add("INFO" if pending else "ERROR", rel, 0, "published-markdown",
                f"GitHub Pages would publish {rel} at {SITE}/{rel}; move internal docs "
                f"under .github/docs/ or exclude the file in _config.yml"
                + (" (listed in PUBLISHED_MARKDOWN_PENDING, due to move)" if pending else ""))
    for rel in sorted(PUBLISHED_MARKDOWN_PENDING - set(tracked)):
        add("WARN", "audit_site.py", 0, "published-markdown",
            f"{rel} has moved: remove it from PUBLISHED_MARKDOWN_PENDING")


# --- orphaned assets (INFO) ----------------------------------------------------
# A picture or script nothing points at still deploys, still counts in the
# colophon's byte totals, and reads to the next person as something in use.
# The report is informational and never fails: some files are kept for a
# reason the scan cannot see, and drafts that will use a file are untracked.

ASSET_SUFFIXES = {".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".avif",
                  ".pdf", ".woff", ".woff2", ".ttf", ".eot", ".otf", ".mp3", ".m4a",
                  ".ogg", ".mp4", ".webm", ".json", ".css", ".js", ".tex", ".zip"}
REFERENCE_SUFFIXES = {".html", ".css", ".js", ".json", ".xml", ".md", ".py", ".yml",
                      ".yaml", ".webmanifest", ".txt", ".tex"}
# Not assets: the build's own inputs and the files at the root, which the
# host or the browser asks for by name (sw.js, manifest.json, robots.txt).
ORPHAN_SKIP = (".github/", "tests/", "data/schema/")
# Read when they exist locally, so a file only a draft uses is not called an
# orphan: drafts, the unpublished Writing section, the old reading page.
LOCAL_REFERENCES = ("blog/drafts", "writing", "writing.html", "reading.html")
# Runs of characters a path can hold, tested for an asset suffix after the
# match: one pattern with the suffixes in it backtracks through every long
# word in the corpus and took seconds, this one reads it once.
PATH_RUN = re.compile(r"[\w%./-]{5,}")
# Photograph thumbnails are addressed by number from data files
# (thumb/<n>.webp from photography-files.json's "<n>.png"), never by name.
NUMBERED = re.compile(r"\d+")


def referenced_names(texts):
    """Every file name and 'parent/name' tail a text mentions."""
    names, tails = set(), set()
    suffixes = tuple(ASSET_SUFFIXES)
    for text in texts:
        for run in PATH_RUN.findall(text):
            run = run.rstrip(".").lower()
            if not run.endswith(suffixes):
                continue
            parts = unquote(run).split("/")
            names.add(parts[-1])
            if len(parts) > 1:
                tails.add("/".join(parts[-2:]))
    return names, tails


def orphan_assets(tracked_rel):
    """Tracked assets no page, script, stylesheet, data file or build
    script mentions, drafts included when they are present locally."""
    texts = []
    for rel in tracked_rel:
        if Path(rel).suffix.lower() in REFERENCE_SUFFIXES:
            texts.append((ROOT / rel).read_text(encoding="utf-8", errors="replace"))
    for extra in LOCAL_REFERENCES:
        p = ROOT / extra
        files = [p] if p.is_file() else (sorted(p.rglob("*")) if p.is_dir() else [])
        texts += [f.read_text(encoding="utf-8", errors="replace") for f in files
                  if f.suffix.lower() in REFERENCE_SUFFIXES]
    names, tails = referenced_names(texts)
    photos = set()
    listing = ROOT / "data" / "photography-files.json"
    if listing.exists():
        photos = {Path(n).stem for n in json.loads(listing.read_text(encoding="utf-8"))}
    out = []
    for rel in sorted(tracked_rel):
        p = Path(rel)
        if (p.suffix.lower() not in ASSET_SUFFIXES or "/" not in rel
                or rel.startswith(ORPHAN_SKIP)):
            continue
        name, tail = p.name.lower(), "/".join(rel.split("/")[-2:]).lower()
        if p.parent.name == "thumb" and p.stem in photos:
            continue
        if tail in tails or (not NUMBERED.fullmatch(p.stem) and name in names):
            continue
        out.append(rel)
    return out


def main(argv=None):
    parser = sitelib.arg_parser(__doc__)
    parser.add_argument("--include-drafts", action="store_true",
                        help="also audit untracked pages and every draft")
    # Without --strict only an ERROR fails, so a new WARN (a banned word, a
    # missing og: tag, a post left out of the feed) goes green in CI and
    # stays until somebody next reads the whole report. Zero warnings is the
    # baseline; --strict is how CI and the check runner hold it there. A
    # parser rather than a look in sys.argv, so a misspelt --strict exits 2
    # instead of quietly running the lenient audit and passing.
    parser.add_argument("--strict", action="store_true",
                        help="exit 1 on any WARN as well as any ERROR")
    args = parser.parse_args(argv)
    include_drafts, strict = args.include_drafts, args.strict
    pages = sitelib.tracked("*.html")
    if include_drafts:
        # untracked pages sitting alongside published ones, plus the drafts
        # folders themselves (blog/drafts/, its per-series subfolders, and
        # writing/drafts/). Drafts were outside this glob, which is backwards:
        # a placeholder is cheapest to catch before the post is published.
        pages = sorted(set(pages) | set(ROOT.glob("*.html"))
                       | set((ROOT / "blog").glob("*.html"))
                       | set((ROOT / "blog" / "drafts").rglob("*.html"))
                       | set((ROOT / "writing").rglob("*.html")))
    tracked = tracked_files()

    problems = []           # (severity, file, line, code, message)
    page_info = {}

    def add(sev, page, line, code, msg):
        rel = page.relative_to(ROOT).as_posix() if isinstance(page, Path) else page
        problems.append((sev, rel, line, code, msg))

    for page in pages:
        text = page.read_text(encoding="utf-8", errors="replace")
        p = PageParser()
        try:
            p.feed(text)
        except Exception as e:
            add("ERROR", page, 0, "parse", f"HTML parse failure: {e}")
            continue
        page_info[page] = p
        rel = page.relative_to(ROOT).as_posix()
        if rel in EXEMPT_PAGES or not sitelib.is_page(rel):
            continue

        c = PageCtx(page, rel, text, p, tracked, add)
        for check in PAGE_CHECKS:
            check(c)
        if c.is_post and not c.is_redirect:
            page_info[page].is_post = True

    # --- script include drift across posts ---
    post_pages = [pg for pg in pages if pg.parent.name == "blog" and pg in page_info
                  and getattr(page_info[pg], "is_post", False)]
    if post_pages:
        # Compared without the query: a ?v= cache-buster is the same script,
        # and a post whose copy was bumped (or not) has not drifted.
        def script_sig(pg):
            paths = (s.split("?", 1)[0] for s in page_info[pg].scripts)
            return tuple(s for s in paths
                         if not s.startswith("http") and s not in OPTIONAL_POST_SCRIPTS)

        sigs = Counter(script_sig(pg) for pg in post_pages)
        canonical_sig = sigs.most_common(1)[0][0]
        for pg in post_pages:
            sig = script_sig(pg)
            if sig != canonical_sig:
                missing = set(canonical_sig) - set(sig)
                extra = set(sig) - set(canonical_sig)
                bits = []
                if missing:
                    bits.append("missing: " + ", ".join(sorted(missing)))
                if extra:
                    bits.append("extra: " + ", ".join(sorted(extra)))
                add("WARN", pg, 0, "script-drift", "; ".join(bits))

    # --- head element drift across posts ---
    # Post heads are hand-copied from whichever post was open at the time,
    # so elements get silently dropped (BreadcrumbList, the manifest and
    # apple-touch-icon links and keywords all went missing this way). Only
    # features that are the same for every post are compared; per-post
    # values (title, description, og:image, canonical, citation_*, preload,
    # the Lora link, MathJax/Prism) are deliberately not in the signature.
    # python .github/scripts/generate_post_head.py --fix inserts what's missing.
    if post_pages:
        for pg in post_pages:
            info = page_info[pg]
            sig = tuple(name for name, present in (
                ("keywords", "keywords" in info.metas),
                ("theme-color", "theme-color" in info.metas),
                ("icon", "icon" in info.link_rels),
                ("apple-touch-icon", "apple-touch-icon" in info.link_rels),
                ("manifest", "manifest" in info.link_rels),
                ("jsonld-BlogPosting", "BlogPosting" in info.jsonld_types),
                ("jsonld-BreadcrumbList", "BreadcrumbList" in info.jsonld_types),
            ) if present)
            page_info[pg].head_sig = sig
        head_sigs = Counter(page_info[pg].head_sig for pg in post_pages)
        canonical_head = head_sigs.most_common(1)[0][0]
        for pg in post_pages:
            missing = set(canonical_head) - set(page_info[pg].head_sig)
            if missing:
                add("WARN", pg, 0, "head-drift",
                    "missing: " + ", ".join(sorted(missing)))

    # --- JSON-LD references across pages ---
    # Nodes are shared across pages by @id: every post's isPartOf is a bare
    # {"@id": ".../#website"} (generate_post_head.py), and the homepage's
    # WebSite names its publisher the same way. A search engine merges
    # every node that shares an @id across the site, so a bare reference is
    # only as good as the node it lands on: renaming the homepage's WebSite
    # id would leave every post pointing at nothing, with each page still
    # valid on its own. (A post's author and publisher carry @type and name
    # beside the @id, so they are nodes in their own right; that the
    # homepage still defines them is generate_post_head.py --check's job.)
    defined_ids, id_refs = set(), []
    for pg, info in page_info.items():
        for raw, line in info.jsonld:
            try:
                stack = [json.loads(raw)]
            except json.JSONDecodeError:
                continue    # jsonld-parse has reported it
            while stack:
                node = stack.pop()
                if isinstance(node, dict):
                    if isinstance(node.get("@id"), str):
                        if set(node) == {"@id"}:
                            id_refs.append((pg, line, node["@id"]))
                        elif "@type" in node:
                            defined_ids.add(node["@id"])
                    stack.extend(node.values())
                elif isinstance(node, list):
                    stack.extend(node)
    for pg, line, ref in id_refs:
        if ref not in defined_ids:
            add("ERROR", pg, line, "jsonld-ref", f"@id {ref} is not defined on any audited page")

    # --- posts.json ---
    posts = sitelib.load_posts()
    seen_urls = set()
    for i, post in enumerate(posts):
        loc = f"posts.json[{i}]"
        url = post.get("url", "")
        if url in seen_urls:
            add("ERROR", loc, 0, "posts-dup", f"duplicate url {url}")
        seen_urls.add(url)
        if not (ROOT / url).exists():
            add("ERROR", loc, 0, "posts-url", f"file missing: {url}")
        img = post.get("image", "")
        if img and not img.startswith("http") and not (ROOT / img).exists():
            add("ERROR", loc, 0, "posts-img", f"image missing: {img}")
        for t in post.get("tags", []):
            if t not in ALLOWED_TAGS:
                add("WARN", loc, 0, "posts-tag", f"tag '{t}' not in allowed set ({url})")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", post.get("date", "")):
            add("ERROR", loc, 0, "posts-date", f"bad date '{post.get('date')}' ({url})")
        if "readMinutes" not in post:
            add("WARN", loc, 0, "posts-readtime", f"missing readMinutes ({url})")
        page_date = getattr(page_info.get(ROOT / url), "page_date", None)
        if page_date and post.get("date") and page_date != post["date"]:
            add("WARN", loc, 0, "posts-date-mismatch",
                f"posts.json date {post['date']} != page date {page_date} ({url})")

    # --- feed.xml ---
    feed_path = ROOT / "feed.xml"
    try:
        feed = ET.parse(feed_path)
        items = feed.getroot().findall(".//item")
        for item in items:
            link = (item.findtext("link") or "").strip()
            if link.startswith(SITE):
                lp = ROOT / unquote(urlparse(link).path.lstrip("/"))
                if not lp.exists():
                    add("ERROR", "feed.xml", 0, "feed-link", f"item file missing: {link}")
            guid = (item.findtext("guid") or "").strip()
            if guid and guid != link:
                add("INFO", "feed.xml", 0, "feed-guid", f"guid != link for {link}")
        feed_links = {(item.findtext("link") or "").strip() for item in items}
        for post in posts:
            expected = f"{SITE}/{post['url']}"
            if expected not in feed_links:
                add("WARN", "feed.xml", 0, "feed-missing", f"post not in feed: {post['url']}")
    except ET.ParseError as e:
        add("ERROR", "feed.xml", 0, "feed-parse", f"XML parse error: {e}")

    # --- sitemap.xml ---
    try:
        sm = ET.parse(ROOT / "sitemap.xml")
        ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        locs = {el.text.strip() for el in sm.getroot().findall(".//s:loc", ns)}
        for loc in locs:
            lp = unquote(urlparse(loc).path.lstrip("/"))
            fp = ROOT / (lp or "index.html")
            if lp.endswith("/") or lp == "":
                fp = ROOT / lp / "index.html"
            if not fp.exists():
                add("ERROR", "sitemap.xml", 0, "sitemap-ghost", f"missing file: {loc}")
        for page in pages:
            rel = page.relative_to(ROOT).as_posix()
            info = page_info.get(page)
            if info is None or info.noindex:
                continue
            # 404.html is served for every missing URL and linked from none.
            if rel in EXEMPT_PAGES or rel == "404.html" or not sitelib.is_page(rel):
                continue
            candidates = {f"{SITE}/{rel}"}
            if rel == "index.html":
                candidates |= {SITE, SITE + "/"}
            if not (candidates & locs):
                add("WARN", "sitemap.xml", 0, "sitemap-missing", f"not in sitemap: {rel}")
    except ET.ParseError as e:
        add("ERROR", "sitemap.xml", 0, "sitemap-parse", f"XML parse error: {e}")

    # --- style.css: raw icon codepoints in content ---
    # The icon subsetter keys on fa-*/ti-*/icon_* class names; a bare
    # PUA codepoint in a content property bypasses it, so the glyph is
    # missing from the subset font and renders as nothing (this is how
    # the breadcrumb separators silently vanished).
    css_path = ROOT / "style.css"
    if css_path.exists():
        for i, line in enumerate(css_path.read_text(encoding="utf-8").splitlines(), 1):
            if re.search(r"content:\s*['\"]\\[efEF][0-9a-fA-F]{3}", line):
                add("ERROR", "style.css", i, "raw-icon-codepoint",
                    "icon glyph referenced by codepoint in CSS content — "
                    "the subset font won't include it; use an icon class "
                    "or a plain text character")

    # --- sw.js: the offline install list ---
    check_precache(tracked, add)

    # --- the site's structure: series pages, the page list, Jekyll ---
    tracked_pages = {p.relative_to(ROOT).as_posix() for p in sitelib.tracked("*.html")}
    check_series_pages(posts, tracked, sitemap_locs(), add)
    check_site_map(tracked_pages, posts, add)
    check_published_markdown(tracked, add)

    # --- assets nothing references (INFO, never fails) ---
    for rel in orphan_assets(tracked):
        add("INFO", rel, 0, "orphan-asset",
            "tracked, but no page, script, stylesheet, data file or build script "
            "mentions it (drafts and writing/ included when present)")

    # --- report ---
    order = {"ERROR": 0, "WARN": 1, "INFO": 2}
    problems.sort(key=lambda x: (order[x[0]], x[1], x[2]))
    counts = {"ERROR": 0, "WARN": 0, "INFO": 0}
    for sev, f, line, code, msg in problems:
        counts[sev] += 1
        loc = f"{f}:{line}" if line else f
        print(f"{sev:5} [{code}] {loc} — {msg}")
    print(f"\n{len(pages)} pages audited. "
          f"{counts['ERROR']} errors, {counts['WARN']} warnings, {counts['INFO']} info.")
    if counts["ERROR"]:
        return 1
    if strict and counts["WARN"]:
        print("--strict: warnings fail the run")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
