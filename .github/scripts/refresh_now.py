#!/usr/bin/env python3
"""Refresh live-ish data for the site (runs daily in CI).

Writes:
  data/lastfm.json  — total scrobble count (homepage stat)
  data/now.json     — most recent track + Goodreads currently-reading,
                      rendered into the homepage "Now" strip

Requires LASTFM_API_KEY in the environment. Goodreads needs no key
(public RSS). The Bluesky item in the strip is fetched client-side from
the public API, so it is not baked here.
"""

import json
import os
import re
import sys
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LASTFM_USER = "GoheX"
GOODREADS_RSS = "https://www.goodreads.com/review/list_rss/42371562?shelf=currently-reading"
UA = "kenreid.co.uk site refresh (ken@kenreid.co.uk)"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=30).read()


def fetch_lastfm(key):
    info = json.loads(get(
        "https://ws.audioscrobbler.com/2.0/"
        f"?method=user.getinfo&user={LASTFM_USER}&api_key={key}&format=json"))
    playcount = int(info["user"]["playcount"])

    recent = json.loads(get(
        "https://ws.audioscrobbler.com/2.0/"
        f"?method=user.getrecenttracks&user={LASTFM_USER}&api_key={key}&format=json&limit=1"))
    tracks = recent.get("recenttracks", {}).get("track", [])
    track = None
    if tracks:
        t = tracks[0] if isinstance(tracks, list) else tracks
        track = {
            "name": t.get("name", ""),
            "artist": (t.get("artist") or {}).get("#text", ""),
            "url": t.get("url", ""),
            "nowPlaying": (t.get("@attr") or {}).get("nowplaying") == "true",
        }
    return playcount, track


def fetch_goodreads():
    try:
        xml = get(GOODREADS_RSS).decode("utf-8", errors="replace")
    except Exception as e:
        print(f"goodreads fetch failed ({e}) — keeping empty list")
        return []
    books = []
    for item in re.findall(r"<item>(.*?)</item>", xml, re.DOTALL):
        def field(tag):
            m = re.search(rf"<{tag}>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</{tag}>", item, re.DOTALL)
            return (m.group(1).strip() if m else "")
        title = field("title")
        author = field("author_name")
        link = field("link")
        if title:
            books.append({"title": title, "author": author, "link": link})
    return books[:3]


def main():
    key = os.environ.get("LASTFM_API_KEY")
    if not key:
        keyfile = ROOT / "scripts-local" / "lastfm_api_key.txt"
        if keyfile.exists():
            key = keyfile.read_text(encoding="utf-8").strip()
    if not key:
        print("LASTFM_API_KEY not set — aborting without changes.")
        return 1

    playcount, track = fetch_lastfm(key)
    books = fetch_goodreads()
    today = date.today().isoformat()

    (ROOT / "data" / "lastfm.json").write_text(json.dumps(
        {"scrobbles": playcount, "user": LASTFM_USER, "updated": today},
        indent=2) + "\n", encoding="utf-8", newline="\n")

    (ROOT / "data" / "now.json").write_text(json.dumps(
        {"track": track, "reading": books, "updated": today},
        indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")

    print(f"scrobbles: {playcount:,}")
    print(f"recent track: {track}")
    print(f"reading: {[b['title'][:40] for b in books]}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
