#!/usr/bin/env python3
"""Refresh the listening data (runs weekly in CI), and write the books in
progress for refresh_books.py.

Writes:
  data/lastfm.json          all-time scrobble count (the homepage figure)
  data/now.json             most recent track (the Now strip); its books
                            in progress (literature.html's Reading Now)
                            come from my Goodreads export, written by
                            refresh_books.py --export through
                            write_reading(), and a weekly run keeps them
  data/lastfm-history.json  the scrobble count at each refresh, one row
                            per date, the latest 90 rows kept; no page
                            reads it yet, it is the record of how the
                            count has moved
  data/topalbums.json       Last.fm top albums over three months (the
                            record crate on music.html)

data/schema/ describes every field, and the workflow validates all four
files before it commits.

Requires LASTFM_API_KEY in the environment (the workflow passes the
repository secret; a local run without it falls back to a key file kept
outside the repository, see main()). The Bluesky item in the Now strip
is fetched in the browser, so it is not baked here.

Goodreads retired its RSS feeds in October 2026, and with them the
currently-reading feed this used to read, so it asks Goodreads nothing.

Each source fails on its own: a failed fetch keeps that source's previous
values and never stops the others from updating. The exit status is 1
when any source failed, after writing what did refresh, so the workflow
commits the partial refresh and still reports the failure.

    python .github/scripts/refresh_now.py

Network calls (get, lastfm) are kept apart from the functions that turn
responses into the files' shapes (track_from, albums_from, history_with,
reading_entry, now_with), which take plain data and can be tested
without one.
"""

import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402

ROOT = sitelib.ROOT
DATA = ROOT / "data"
LASTFM_USER = "GoheX"
LASTFM_API = "https://ws.audioscrobbler.com/2.0/"
UA = "kenreid.co.uk site refresh (ken@kenreid.co.uk)"

HISTORY_ROWS = 90
READING_LIMIT = 3
ALBUM_LIMIT = 24
ALBUM_PERIOD = "3month"


# --- the network -----------------------------------------------------------

def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def lastfm(method, key, **params):
    """One Last.fm API call, as parsed JSON."""
    query = urllib.parse.urlencode(dict(
        method=method, user=LASTFM_USER, api_key=key, format="json", **params))
    return json.loads(get(LASTFM_API + "?" + query))


# --- responses to file shapes (pure) -----------------------------------------

def track_from(recent):
    """user.getrecenttracks -> now.json's track, or None if there is none."""
    tracks = (recent.get("recenttracks") or {}).get("track") or []
    if not tracks:
        return None
    t = tracks[0] if isinstance(tracks, list) else tracks
    return {
        "name": t.get("name", ""),
        "artist": (t.get("artist") or {}).get("#text", ""),
        "url": t.get("url", ""),
        "nowPlaying": (t.get("@attr") or {}).get("nowplaying") == "true",
    }


def reading_entry(title, author, link, img=""):
    """One book in progress as now.json holds it. `img` is the site's
    small copy of its cover (a path refresh_books.reading_cover gives),
    left out when there is none, so Reading Now asks no other site for a
    picture."""
    book = {"title": title, "author": author, "link": link}
    if img:
        book["img"] = img
    return book


def now_with(now, track=None, reading=None, as_of=None, today=None):
    """now.json with a new track (a weekly run, `today` its date) or a new
    reading list (an export, `as_of` the day it was downloaded); the rest
    as it was. readingUpdated dates the list, updated the file."""
    now = dict(now or {})
    out = {
        "track": track if today else now.get("track"),
        "reading": reading if reading is not None else (now.get("reading") or []),
        "updated": today or now.get("updated") or as_of,
    }
    reading_as_of = as_of if reading is not None else now.get("readingUpdated")
    if reading_as_of:
        out["readingUpdated"] = reading_as_of
    return out


def albums_from(data):
    """user.gettopalbums -> topalbums.json's albums. An album with no
    sleeve art is left out: the crate is made of sleeves."""
    albums = []
    for a in (data.get("topalbums") or {}).get("album", []):
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


def history_with(history, playcount, today, keep=HISTORY_ROWS):
    """History rows with today's count in place of any earlier row for
    today, sorted by date, the latest `keep` kept."""
    rows = [h for h in history if h.get("d") != today]
    rows.append({"d": today, "n": playcount})
    return sorted(rows, key=lambda h: h["d"])[-keep:]


# --- files -------------------------------------------------------------------

def load_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def write_json(path, value, **dump):
    path.write_text(json.dumps(value, **dump) + "\n", encoding="utf-8", newline="\n")


def write_reading(reading, as_of):
    """now.json's books in progress, from refresh_books.py --export:
    `reading` is a list of reading_entry() dicts, `as_of` the export's
    date. The track and the file's date stay as the weekly run left
    them."""
    path = DATA / "now.json"
    now = now_with(load_json(path, {}), reading=list(reading)[:READING_LIMIT], as_of=as_of)
    write_json(path, now, indent=2, ensure_ascii=False)
    print(f"reading (as of {as_of}): {[b['title'][:40] for b in now['reading']]}")


def main(argv=None):
    # --help (or a stray flag) must not set off a live fetch and a write.
    sitelib.arg_parser(__doc__).parse_args(argv)
    key = os.environ.get("LASTFM_API_KEY")
    if not key:
        keyfile = ROOT / "scripts-local" / "lastfm_api_key.txt"
        if keyfile.exists():
            key = keyfile.read_text(encoding="utf-8").strip()
    if not key:
        print("::error::LASTFM_API_KEY not set; aborting without changes.")
        return 1

    today = date.today().isoformat()
    failures = []
    prev_lastfm = load_json(DATA / "lastfm.json", {})
    prev_now = load_json(DATA / "now.json", {})

    lastfm_ok = True
    try:
        playcount = int(lastfm("user.getinfo", key)["user"]["playcount"])
        track = track_from(lastfm("user.getrecenttracks", key, limit=1))
    except Exception as e:  # any failure of this source keeps its old values
        lastfm_ok = False
        failures.append(f"lastfm ({e})")
        print(f"::warning::Last.fm fetch failed ({e}); keeping the previous scrobbles and track")
        playcount = prev_lastfm.get("scrobbles")
        track = prev_now.get("track")

    try:
        albums = albums_from(lastfm("user.gettopalbums", key,
                                    period=ALBUM_PERIOD, limit=ALBUM_LIMIT))
    except Exception as e:
        failures.append(f"top albums ({e})")
        print(f"::warning::Top-albums fetch failed ({e}); keeping the previous file")
        albums = None

    if len(failures) == 2:
        print("::error::every source failed; leaving all files untouched.")
        return 1

    if playcount is not None:
        write_json(DATA / "lastfm.json",
                   {"scrobbles": playcount, "user": LASTFM_USER, "updated": today}, indent=2)
    write_json(DATA / "now.json", now_with(prev_now, track=track, today=today),
               indent=2, ensure_ascii=False)
    if albums is not None:
        write_json(DATA / "topalbums.json",
                   {"albums": albums, "period": ALBUM_PERIOD, "updated": today},
                   indent=2, ensure_ascii=False)
    if lastfm_ok:
        history = history_with(load_json(DATA / "lastfm-history.json", []), playcount, today)
        write_json(DATA / "lastfm-history.json", history, separators=(",", ":"))
        print(f"scrobbles: {playcount:,} (history: {len(history)} rows)")

    print(f"recent track: {track}")
    print(f"top albums: {len(albums) if albums is not None else 'kept previous'}")
    if failures:
        print(f"::error::partial refresh; failed: {', '.join(failures)}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
