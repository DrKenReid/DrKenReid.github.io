#!/usr/bin/env python3
"""Generate feed.xml from data/posts.json with full post content.

Every post gets the usual title/link/guid/pubDate/description/category
item; the newest FULL_CONTENT_ITEMS additionally get a content:encoded
block carrying the full article HTML (scripts, canvases, and interactive
widgets stripped and replaced with a "view it live" note; relative URLs
absolutised) so feed readers can read whole posts without leaving.

Run after updating data/posts.json:
    python .github/scripts/generate_feed.py
Deterministic: dates come from posts.json, never from the clock.
"""
from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SITE = "https://www.kenreid.co.uk"
FULL_CONTENT_ITEMS = 20

CHANNEL_HEAD = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Ken Reid's Blog</title>
    <link>{site}/blog.html</link>
    <description>Data science, photography, books, and everything in between.</description>
    <language>en</language>
    <lastBuildDate>{build_date}</lastBuildDate>
    <pubDate>{build_date}</pubDate>
    <docs>https://www.rssboard.org/rss-specification</docs>
    <generator>Ken Reid static site feed</generator>
    <atom:link href="{site}/feed.xml" rel="self" type="application/rss+xml"/>
"""


def rfc822(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return dt.strftime("%a, %d %b %Y 00:00:00 +0000")


def extract_blog_post(html: str) -> str | None:
    """Inner HTML of <div class="blog-post">, via div-depth counting."""
    m = re.search(r'<div class="blog-post">', html)
    if not m:
        return None
    depth = 1
    pos = m.end()
    for tag in re.finditer(r"<div\b|</div>", html[pos:]):
        depth += 1 if tag.group().startswith("<div") else -1
        if depth == 0:
            return html[pos : pos + tag.start()]
    return None


def drop_balanced_divs(content: str, open_pattern: str) -> tuple[str, int]:
    """Remove every <div ...> block whose opening tag matches open_pattern."""
    removed = 0
    while True:
        m = re.search(open_pattern, content)
        if not m:
            return content, removed
        depth = 1
        pos = m.end()
        for tag in re.finditer(r"<div\b|</div>", content[pos:]):
            depth += 1 if tag.group().startswith("<div") else -1
            if depth == 0:
                content = content[: m.start()] + content[pos + tag.end() :]
                removed += 1
                break
        else:
            return content, removed


def clean_for_feed(content: str, post_url: str) -> str:
    had_interactive = bool(re.search(r"<canvas\b", content))

    # Interactive widget containers (their class ends in -viz by series
    # convention) and any stray canvases / scripts / noscript blocks.
    content, widgets = drop_balanced_divs(content, r'<div class="[a-z-]*-?viz"[^>]*>|<div class="[a-z]+-viz [^"]*"[^>]*>')
    content = re.sub(r"<script\b.*?</script>", "", content, flags=re.S)
    content = re.sub(r"<noscript\b.*?</noscript>", "", content, flags=re.S)
    content = re.sub(r"<canvas\b.*?</canvas>", "", content, flags=re.S)
    # Baked end-of-post chrome that only makes sense on the page.
    content, _ = drop_balanced_divs(content, r'<div class="related-posts">')
    content, _ = drop_balanced_divs(content, r'<div id="related-posts-section"[^>]*>')

    if had_interactive or widgets:
        note = (
            '<p><em>This post includes an interactive demo that runs live in the '
            'browser. <a href="{u}">View it on the site</a> to play with it.</em></p>'
        ).format(u=post_url)
        # Place the note where the first widget sat: after the first paragraph.
        content = note + content

    # Absolutise relative URLs (posts live one level deep in /blog/).
    content = re.sub(r'(src|href)="\.\./', r'\1="' + SITE + "/", content)
    content = re.sub(r'(src|href)="(?!https?://|#|mailto:|/)', r'\1="' + SITE + "/blog/", content)
    content = re.sub(r'(src|href)="/', r'\1="' + SITE + "/", content)

    # CDATA safety.
    return content.replace("]]>", "]]&gt;")


def main() -> int:
    posts = json.loads((ROOT / "data" / "posts.json").read_text(encoding="utf-8"))
    posts.sort(key=lambda p: p["date"], reverse=True)
    build_date = rfc822(posts[0]["date"])

    out = [CHANNEL_HEAD.format(site=SITE, build_date=build_date)]
    for i, p in enumerate(posts):
        url = f"{SITE}/{p['url']}"
        item = [
            "    <item>",
            f"      <title>{escape(p['title'])}</title>",
            f"      <link>{url}</link>",
            f"      <guid>{url}</guid>",
            f"      <pubDate>{rfc822(p['date'])}</pubDate>",
            f"      <description>{escape(p.get('excerpt', ''))}</description>",
        ]
        for tag in p.get("tags", []):
            item.append(f"      <category>{escape(tag)}</category>")
        if i < FULL_CONTENT_ITEMS:
            html = (ROOT / p["url"]).read_text(encoding="utf-8")
            inner = extract_blog_post(html)
            if inner:
                body = clean_for_feed(inner, url)
                item.append(f"      <content:encoded><![CDATA[{body}]]></content:encoded>")
        item.append("    </item>")
        out.append("\n".join(item) + "\n")
    out.append("  </channel>\n</rss>\n")

    feed = "".join(out)
    ET.fromstring(feed)  # dies loudly on malformed XML
    target = ROOT / "feed.xml"
    full = min(FULL_CONTENT_ITEMS, len(posts))

    # --check is the convention every other generator honours, and this one
    # did not: it wrote regardless, so "check the feed" silently rebuilt it and
    # the committed feed drifted for weeks behind a post's class renames.
    if "--check" in sys.argv:
        current = target.read_text(encoding="utf-8") if target.exists() else ""
        if current != feed:
            print("feed.xml is stale (regenerating would change it)")
            print("run: python .github/scripts/generate_feed.py")
            return 1
        print("feed.xml is up to date.")
        return 0

    target.write_text(feed, encoding="utf-8")
    print(f"Wrote feed.xml: {len(posts)} items, {full} with full content, {len(feed):,} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
