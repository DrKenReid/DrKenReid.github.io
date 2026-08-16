#!/usr/bin/env python3
"""Site-wide audit: links, metadata, accessibility, feed, sitemap, posts.json.

Audits only git-tracked HTML (published pages); untracked drafts are skipped.
Run from the repo root:  python .github/scripts/audit_site.py [--include-drafts]

Checks:
  links      internal href/src targets exist; malformed URLs (double scheme etc.)
  meta       description, canonical, og:*, twitter:*, JSON-LD validity per post
  a11y       img alt, duplicate ids, heading order, single h1, landmark
             nesting (a landmark must not close over open containers),
             aria-label on a role-less div/span, img with no src
  feed       feed.xml well-formed, items resolve to real files
  sitemap    sitemap.xml covers all published indexable pages, no ghosts
  posts      posts.json urls/images exist, tags in allowed set, readMinutes
  scripts    blog post script includes match the canonical set
  head       blog post heads carry the canonical elements (keywords, icons,
             manifest, BlogPosting + BreadcrumbList JSON-LD)
"""

import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[2]
SITE = "https://www.kenreid.co.uk"
ALLOWED_TAGS = {"data science", "personal", "photography", "books", "ai", "finance",
                "philosophy", "advice", "science", "technology", "television", "writing",
                "music"}

# Per-post opt-in scripts that are legitimate additions to the canonical include set.
OPTIONAL_POST_SCRIPTS = {"../js/nerd-mode.js", "../js/prism-loader.js",
                         "../js/kr-viz.js"}   # only the interactive demo posts

# Pages exempt from content/metadata checks (verification stubs etc.).
EXEMPT_PAGES = {"google1473b6928dc28ce6.html"}

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
        self.bad_nesting = []    # (landmark, [open tags], line)
        self.label_no_role = []  # (tag, label, line)
        self.img_no_src = []     # lines of <img> with neither src nor srcset
        self._stack = []
        self._excl = 0
        self._in_title = False
        self._in_jsonld = False
        self._jsonld_buf = []
        self._jsonld_line = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        line = self.getpos()[0]
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
        if tag == "title":
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
        if tag == "title":
            self._in_title = False
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


def tracked_html():
    out = subprocess.run(["git", "ls-files", "*.html"], cwd=ROOT,
                         capture_output=True, text=True).stdout
    # skip tracked files deleted from the worktree (deletion not yet committed)
    return [f for f in (ROOT / p for p in out.split() if p) if f.exists()]


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
    out = subprocess.run(["git", "ls-files"], cwd=ROOT,
                         capture_output=True, text=True).stdout
    return set(out.split())


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



def check_references(c):
    # --- links / images resolve (and must be git-c.tracked: a file that
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
    # --- same-c.page fragments ---
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
    # --- duplicated alt c.text (screen readers hear it N times) ---
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
        elif len(desc) > 165:
            c.add("INFO", c.page, 0, "long-desc", f"description {len(desc)} chars")
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
        for node in (data if isinstance(data, list) else [data]):
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
            return (s or "").strip().replace("’", "'").replace("‘", "'")                     .replace("“", '"').replace("”", '"')
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
    check_references,
    check_fragments,
    check_img_alt,
    check_dup_alt,
    check_img_dims,
    check_figures,
    check_prose,
    check_headings,
    check_metadata,
    check_jsonld,
    check_consistency,
]


def main():
    include_drafts = "--include-drafts" in sys.argv
    pages = tracked_html()
    if include_drafts:
        pages = sorted(set(pages) | set(ROOT.glob("*.html")) | set((ROOT / "blog").glob("*.html")))
    tracked = tracked_files()

    problems = []           # (severity, file, line, code, message)
    page_info = {}

    def add(sev, page, line, code, msg):
        rel = str(page.relative_to(ROOT)) if isinstance(page, Path) else page
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
        if rel in EXEMPT_PAGES:
            continue
        if rel.startswith("blog/downloads/"):
            # download artifacts (standalone demo files), not site pages
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
        sigs = Counter()
        for pg in post_pages:
            sig = tuple(s for s in page_info[pg].scripts
                        if not s.startswith("http") and s not in OPTIONAL_POST_SCRIPTS)
            sigs[sig] += 1
        canonical_sig = sigs.most_common(1)[0][0]
        for pg in post_pages:
            sig = tuple(s for s in page_info[pg].scripts
                        if not s.startswith("http") and s not in OPTIONAL_POST_SCRIPTS)
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

    # --- posts.json ---
    posts_path = ROOT / "data" / "posts.json"
    posts = json.loads(posts_path.read_text(encoding="utf-8"))
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
            if rel in ("404.html", "google1473b6928dc28ce6.html"):
                continue
            if rel.startswith("blog/downloads/"):
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
    return 1 if counts["ERROR"] else 0


if __name__ == "__main__":
    sys.exit(main())
