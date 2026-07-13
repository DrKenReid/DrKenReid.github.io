#!/usr/bin/env python3
"""Refresh live-ish data for the site (runs daily in CI).

Writes:
  data/lastfm.json          — total scrobble count (homepage stat)
  data/now.json             — most recent track + Goodreads currently-reading
  data/lastfm-history.json  — daily scrobble counts (last 90 days, feeds
                              the homepage sparkline as it accumulates)
  data/topalbums.json       — Last.fm top albums, 3-month window (music
                              page album wall)

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
    xml = get(GOODREADS_RSS).decode("utf-8", errors="replace")
    books = []
    for item in re.findall(r"<item>(.*?)</item>", xml, re.DOTALL):
        def field(tag):
            m = re.search(rf"<{tag}>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</{tag}>", item, re.DOTALL)
            return (m.group(1).strip() if m else "")
        title = field("title")
        author = field("author_name")
        link = field("link")
        img = field("book_image_url") or field("book_medium_image_url")
        if title:
            book = {"title": title, "author": author, "link": link}
            if img:
                book["img"] = img
            books.append(book)
    return books[:3]


def fetch_top_albums(key):
    data = json.loads(get(
        "https://ws.audioscrobbler.com/2.0/"
        f"?method=user.gettopalbums&user={LASTFM_USER}&api_key={key}"
        "&format=json&period=3month&limit=24"))
    albums = []
    for a in data.get("topalbums", {}).get("album", []):
        images = {i.get("size"): i.get("#text") for i in a.get("image", [])}
        img = images.get("extralarge") or images.get("large") or ""
        if not img:
            continue
        albums.append({
            "name": a.get("name", ""),
            "artist": (a.get("artist") or {}).get("name", ""),
            "url": a.get("url", ""),
            "img": img,
            "plays": int(a.get("playcount") or 0),
        })
    return albums


def update_history(playcount, today):
    path = ROOT / "data" / "lastfm-history.json"
    history = []
    if path.exists():
        try:
            history = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            history = []
    history = [h for h in history if h.get("d") != today]
    history.append({"d": today, "n": playcount})
    history = sorted(history, key=lambda h: h["d"])[-90:]
    path.write_text(json.dumps(history, separators=(",", ":")) + "\n",
                    encoding="utf-8", newline="\n")
    return len(history)


def load_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def main():
    key = os.environ.get("LASTFM_API_KEY")
    if not key:
        keyfile = ROOT / "scripts-local" / "lastfm_api_key.txt"
        if keyfile.exists():
            key = keyfile.read_text(encoding="utf-8").strip()
    if not key:
        print("LASTFM_API_KEY not set — aborting without changes.")
        return 1

    data_dir = ROOT / "data"
    today = date.today().isoformat()
    failures = []

    # Each source fails independently: a failed fetch keeps that source's
    # previous values and never blocks the others from updating.
    prev_lastfm = load_json(data_dir / "lastfm.json", {})
    prev_now = load_json(data_dir / "now.json", {})

    lastfm_ok = True
    try:
        playcount, track = fetch_lastfm(key)
    except Exception as e:
        lastfm_ok = False
        failures.append(f"lastfm ({e})")
        print(f"::warning::Last.fm fetch failed ({e}) — keeping previous scrobbles/track")
        playcount = prev_lastfm.get("scrobbles")
        track = prev_now.get("track")

    try:
        books = fetch_goodreads()
    except Exception as e:
        failures.append(f"goodreads ({e})")
        print(f"::warning::Goodreads fetch failed ({e}) — keeping previous reading list")
        books = prev_now.get("reading") or []

    try:
        albums = fetch_top_albums(key)
    except Exception as e:
        failures.append(f"top albums ({e})")
        print(f"::warning::Top-albums fetch failed ({e}) — keeping previous file")
        albums = None

    if len(failures) == 3:
        print("Every source failed — leaving all files untouched.")
        return 1

    if playcount is not None:
        (data_dir / "lastfm.json").write_text(json.dumps(
            {"scrobbles": playcount, "user": LASTFM_USER, "updated": today},
            indent=2) + "\n", encoding="utf-8", newline="\n")

    (data_dir / "now.json").write_text(json.dumps(
        {"track": track, "reading": books, "updated": today},
        indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")

    if albums is not None:
        (data_dir / "topalbums.json").write_text(json.dumps(
            {"albums": albums, "period": "3month", "updated": today},
            indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")

    if lastfm_ok:
        days = update_history(playcount, today)
        print(f"scrobbles: {playcount:,} (history: {days} days)")
    print(f"recent track: {track}")
    print(f"reading: {[b['title'][:40] for b in books]}")
    print(f"top albums: {len(albums) if albums is not None else 'kept previous'}")
    if failures:
        print(f"partial refresh — failed: {', '.join(failures)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
