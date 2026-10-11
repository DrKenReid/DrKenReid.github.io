#!/usr/bin/env python3
"""Build feed-photos.xml, the photography feed, from data/photosets.json.

The blog feed (feed.xml) carries posts only; this one carries a short item
per photoset: "28 new photographs from Holland and Ann Arbor, Michigan",
dated the day the set went up, with up to THUMBS_PER_ITEM of its frames as
thumbnails, each linking to that frame in the gallery. Readers who follow
the photographs subscribe here without the blog's posts, and the reverse.

It also writes the newest set into KR_NEW_PHOTOS in
js/shared-components.js (its first frame and its place), which marks those
frames New in the gallery and on the homepage. data/photosets.json is the
one thing edited by hand when a set is added; this script carries it to
the feed and to the badge.

Run after adding a set to data/photosets.json:
    python .github/scripts/generate_photo_feed.py
    python .github/scripts/generate_photo_feed.py --check   # exit 1 if either is stale
Deterministic: dates come from photosets.json, never from the clock.

Fails, and writes nothing, when the sets disagree with the gallery: not
newest first, overlapping, a set with no frame in photography-files.json,
or frames numbered past the newest set's last (a set added to the gallery
but not to photosets.json).
"""
from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from html import escape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402

ROOT = sitelib.ROOT
SITE = sitelib.SITE
SETS_JSON = ROOT / "data" / "photosets.json"
FILES_JSON = ROOT / "data" / "photography-files.json"
SHARED_JS = ROOT / "js" / "shared-components.js"
FEED = ROOT / "feed-photos.xml"
THUMBS_PER_ITEM = 8
MARKER = re.compile(r"^var KR_NEW_PHOTOS = \{.*\};$", re.M)

CHANNEL_HEAD = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Ken Reid's Photographs</title>
    <link>{site}/gallery.html</link>
    <description>New photosets in Ken Reid's gallery.</description>
    <language>en</language>
    <lastBuildDate>{build_date}</lastBuildDate>
    <pubDate>{build_date}</pubDate>
    <docs>https://www.rssboard.org/rss-specification</docs>
    <generator>Ken Reid static site feed</generator>
    <atom:link href="{site}/feed-photos.xml" rel="self" type="application/rss+xml"/>
"""


def rfc822(date_str: str) -> str:
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return dt.strftime("%a, %d %b %Y 00:00:00 +0000")


def headline(count: int, place: str) -> str:
    return f"{count} new photograph{'' if count == 1 else 's'} from {place}"


def problems(sets: list[dict], frames: set[int]) -> list[str]:
    found = []
    for i, s in enumerate(sets):
        if s["from"] > s["to"]:
            found.append(f"set {i + 1} ({s['date']}): from {s['from']} is after to {s['to']}")
        if not any(s["from"] <= n <= s["to"] for n in frames):
            found.append(f"set {i + 1} ({s['date']}): no frame between {s['from']} and {s['to']} in photography-files.json")
        if i and (s["date"] > sets[i - 1]["date"] or s["to"] >= sets[i - 1]["from"]):
            found.append(f"set {i + 1} ({s['date']}): not older than, or overlaps, the set before it (newest first)")
    newest = sets[0]["to"]
    past = sorted(n for n in frames if n > newest)
    if past:
        found.append(f"frames {past[0]}-{past[-1]} are past the newest set (to {newest}): "
                     "add their set to the top of data/photosets.json")
    return found


def item(s: dict, frames: list[int]) -> str:
    nums = [n for n in frames if s["from"] <= n <= s["to"]]
    title = headline(len(nums), s["place"])
    link = f"{SITE}/gallery.html?photo={nums[0]}"
    thumbs = "".join(
        f'<a href="{SITE}/gallery.html?photo={n}"><img src="{SITE}/img/photography/thumb/{n}@2x.webp" '
        f'width="400" alt="Photograph {n}"></a> '
        for n in nums[:THUMBS_PER_ITEM])
    more = len(nums) - THUMBS_PER_ITEM
    body = (f"<p>{escape(title)}, added to the gallery on {sitelib.long_date(s['date'])}.</p>"
            f"<p>{thumbs.strip()}</p>"
            f'<p><a href="{SITE}/gallery.html">See {"all " + str(len(nums)) if more > 0 else "them"} in the gallery</a></p>')
    return "\n".join([
        "    <item>",
        f"      <title>{escape(title)}</title>",
        f"      <link>{link}</link>",
        f'      <guid isPermaLink="false">kenreid.co.uk-photoset-{s["from"]}-{s["to"]}</guid>',
        f"      <pubDate>{rfc822(s['date'])}</pubDate>",
        f"      <description>{escape(title)}: frames {s['from']} to {s['to']}.</description>",
        "      <category>photography</category>",
        f"      <content:encoded><![CDATA[{body}]]></content:encoded>",
        "    </item>",
    ]) + "\n"


def marker_line(newest: dict) -> str:
    place = newest["place"].replace("\\", "\\\\").replace("'", "\\'")
    return f"var KR_NEW_PHOTOS = {{ from: {newest['from']}, place: '{place}' }};"


def main(argv=None) -> int:
    parser = sitelib.arg_parser(__doc__)
    parser.add_argument("--check", action="store_true",
                        help="exit 1 if feed-photos.xml or KR_NEW_PHOTOS is stale; write nothing")
    args = parser.parse_args(argv)

    sets = json.loads(SETS_JSON.read_text(encoding="utf-8"))["sets"]
    frames = sorted((int(f.split(".")[0]) for f in json.loads(FILES_JSON.read_text(encoding="utf-8"))),
                    reverse=True)
    found = problems(sets, set(frames))
    if found:
        print("data/photosets.json disagrees with the gallery; nothing written:")
        for p in found:
            print(f"  {p}")
        return 1

    feed = CHANNEL_HEAD.format(site=SITE, build_date=rfc822(sets[0]["date"]))
    feed += "".join(item(s, frames) for s in sets) + "  </channel>\n</rss>\n"
    ET.fromstring(feed)  # dies loudly on malformed XML

    js = SHARED_JS.read_text(encoding="utf-8")
    if not MARKER.search(js):
        print("js/shared-components.js has no `var KR_NEW_PHOTOS = {...};` line to update")
        return 1
    new_js = MARKER.sub(marker_line(sets[0]), js, count=1)

    if args.check:
        stale = []
        if not FEED.exists() or FEED.read_text(encoding="utf-8") != feed:
            stale.append("feed-photos.xml")
        if new_js != js:
            stale.append("KR_NEW_PHOTOS in js/shared-components.js")
        if stale:
            print(" and ".join(stale) + " stale (regenerating would change it)")
            print("run: python .github/scripts/generate_photo_feed.py")
            return 1
        print("feed-photos.xml and KR_NEW_PHOTOS are up to date.")
        return 0

    FEED.write_text(feed, encoding="utf-8", newline="\n")
    if new_js != js:
        SHARED_JS.write_text(new_js, encoding="utf-8", newline="\n")
    print(f"Wrote feed-photos.xml: {len(sets)} sets; KR_NEW_PHOTOS from {sets[0]['from']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
