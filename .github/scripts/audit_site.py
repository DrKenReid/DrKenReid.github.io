#!/usr/bin/env python3
"""Site-wide audit: links, metadata, accessibility, feed, sitemap, posts.json.

Audits only git-tracked HTML (published pages); untracked drafts are skipped.
Run from the repo root:  python .github/scripts/audit_site.py [--include-drafts]

Checks:
  links      internal href/src targets exist; malformed URLs (double scheme etc.)
  meta       description, canonical, og:*, twitter:*, JSON-LD validity per post
  a11y       img alt, duplicate ids, heading order, single h1
  feed       feed.xml well-formed, items resolve to real files
  sitemap    sitemap.xml covers all published indexable pages, no ghosts
  posts      posts.json urls/images exist, tags in allowed set, readMinutes
  scripts    blog post script includes match the canonical set
"""

import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parents[2]
SITE = "https://www.kenreid.co.uk"
ALLOWED_TAGS = {"data science", "personal", "photography", "books", "ai", "finance",
                "philosophy", "advice", "science", "technology", "television", "writing"}

# Per-post opt-in scripts that are legitimate additions to the canonical include set.
OPTIONAL_POST_SCRIPTS = {"../js/nerd-mode.js", "../js/prism-loader.js"}

# Pages exempt from content/metadata checks (verification stubs etc.).
EXEMPT_PAGES = {"google1473b6928dc28ce6.html"}

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr"}


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids = []
        self.links = []          # (href, line)
        self.images = []         # (src, alt_or_None, loading, line)
        self.metas = {}          # name/property -> content
        self.canonical = None
        self.title = None
        self.headings = []       # (level, line)
        self.jsonld = []         # (text, line)
        self.scripts = []        # src list
        self.noindex = False
        self._in_title = False
        self._in_jsonld = False
        self._jsonld_buf = []
        self._jsonld_line = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        line = self.getpos()[0]
        if "id" in a:
            self.ids.append((a["id"], line))
        if tag == "a" and a.get("href"):
            self.links.append((a["href"], line))
        if tag in ("img", "source"):
            src = a.get("src") or a.get("srcset")
            if src:
                self.images.append((tag, src, a.get("alt"), a.get("loading"), line))
        if tag == "link":
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

    def handle_data(self, data):
        if self._in_title:
            self.title = (self.title or "") + data
        if self._in_jsonld:
            self._jsonld_buf.append(data)


def tracked_html():
    out = subprocess.run(["git", "ls-files", "*.html"], cwd=ROOT,
                         capture_output=True, text=True).stdout
    return [ROOT / p for p in out.split() if p]


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


def main():
    include_drafts = "--include-drafts" in sys.argv
    pages = tracked_html()
    if include_drafts:
        pages = sorted(set(pages) | set(ROOT.glob("*.html")) | set((ROOT / "blog").glob("*.html")))

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
        is_post = rel.startswith("blog/") and not p.noindex
        is_redirect = "http-equiv=\"refresh\"" in text or "http-equiv='refresh'" in text

        # --- ids ---
        seen = {}
        for i, line in p.ids:
            if i in seen:
                add("ERROR", page, line, "dup-id", f"duplicate id '{i}' (first at line {seen[i]})")
            else:
                seen[i] = line

        # --- links / images resolve ---
        for url, line in p.links + [(u, l) for (_t, u, _a, _lz, l) in p.images]:
            shape = check_url_shape(url)
            if shape:
                add("ERROR", page, line, "bad-url", f"{shape}: {url[:120]}")
                continue
            local = resolve_local(page, url)
            if local is not None and not local.exists():
                add("ERROR", page, line, "broken-link", f"missing target: {url}")

        # --- same-page fragments ---
        idset = set(seen)
        for url, line in p.links:
            if url.startswith("#") and len(url) > 1 and url[1:] not in idset:
                add("WARN", page, line, "bad-fragment", f"no element with id '{url[1:]}'")

        # --- images alt (only real img elements; <source> has no alt) ---
        for tag, src, alt, loading, line in p.images:
            if tag == "img" and alt is None:
                add("WARN", page, line, "no-alt", f"img missing alt: {src[:80]}")

        # --- headings ---
        if not is_redirect:
            h1s = [l for (lv, l) in p.headings if lv == 1]
            if is_post and len(h1s) == 0:
                add("WARN", page, 0, "no-h1", "post has no h1")
            if len(h1s) > 1:
                add("WARN", page, h1s[1], "multi-h1", f"{len(h1s)} h1 elements")
            prev = 0
            for lv, line in p.headings:
                if prev and lv > prev + 1:
                    add("INFO", page, line, "heading-skip", f"h{prev} -> h{lv}")
                prev = lv

        # --- metadata (posts + top-level pages, not redirects) ---
        if not is_redirect and not p.noindex:
            desc = p.metas.get("description", "")
            if not desc:
                add("ERROR", page, 0, "no-desc", "missing meta description")
            elif len(desc) < 50:
                add("WARN", page, 0, "short-desc", f"description only {len(desc)} chars")
            elif len(desc) > 165:
                add("INFO", page, 0, "long-desc", f"description {len(desc)} chars")
            expected_canonical = f"{SITE}/{rel}".replace("/index.html", "/")
            if not p.canonical:
                add("WARN", page, 0, "no-canonical", "missing canonical link")
            elif p.canonical.rstrip("/") not in (expected_canonical.rstrip("/"), f"{SITE}/{rel}"):
                add("WARN", page, 0, "canonical-mismatch",
                    f"canonical {p.canonical} != {expected_canonical}")
            for k in ("og:title", "og:description", "og:image", "og:url"):
                if k not in p.metas:
                    add("WARN", page, 0, "no-og", f"missing {k}")
            if "twitter:card" not in p.metas:
                add("INFO", page, 0, "no-twitter", "missing twitter:card")
            og_img = p.metas.get("og:image", "")
            if og_img:
                shape = check_url_shape(og_img)
                if shape:
                    add("ERROR", page, 0, "bad-og-image", f"{shape}: {og_img[:120]}")
                elif og_img.startswith(SITE):
                    local = ROOT / unquote(urlparse(og_img).path.lstrip("/"))
                    if not local.exists():
                        add("ERROR", page, 0, "bad-og-image", f"og:image file missing: {og_img}")

        # --- JSON-LD ---
        for raw, line in p.jsonld:
            try:
                data = json.loads(raw)
            except json.JSONDecodeError as e:
                add("ERROR", page, line, "jsonld-parse", f"invalid JSON-LD: {e}")
                continue
            def walk(node):
                if isinstance(node, dict):
                    for k, v in node.items():
                        if isinstance(v, str) and ("http://" in v or "https://" in v):
                            shape = check_url_shape(v)
                            if shape:
                                add("ERROR", page, line, "jsonld-url", f"{k}: {shape}: {v[:120]}")
                            elif v.startswith(SITE + "/"):
                                lp = ROOT / unquote(urlparse(v).path.lstrip("/"))
                                if "." in lp.name and not lp.exists():
                                    add("ERROR", page, line, "jsonld-url", f"{k}: missing file {v}")
                        else:
                            walk(v)
                elif isinstance(node, list):
                    for v in node:
                        walk(v)
            walk(data)

        # --- blog post script includes ---
        if is_post and not is_redirect:
            page_info[page].is_post = True

    # --- script include drift across posts ---
    post_pages = [pg for pg in pages if pg.parent.name == "blog" and pg in page_info
                  and getattr(page_info[pg], "is_post", False)]
    if post_pages:
        from collections import Counter
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
            candidates = {f"{SITE}/{rel}"}
            if rel == "index.html":
                candidates |= {SITE, SITE + "/"}
            if not (candidates & locs):
                add("WARN", "sitemap.xml", 0, "sitemap-missing", f"not in sitemap: {rel}")
    except ET.ParseError as e:
        add("ERROR", "sitemap.xml", 0, "sitemap-parse", f"XML parse error: {e}")

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
