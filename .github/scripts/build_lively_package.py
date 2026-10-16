#!/usr/bin/env python3
"""Build wallpaper/kenreid-slideshow-lively.zip, the slideshow as a Lively wallpaper.

Lively Wallpaper (Windows) imports a zip dropped into its window. This one
is a "web" wallpaper (LivelyInfo.json, Type 1): a local index.html that
shows https://www.kenreid.co.uk/slideshow.html in a frame, with the
controls off, and a Customise menu (LivelyProperties.json) for the
slideshow's settings: what to show (photographs, places, quotes, books or
albums), subject, place, which photographs, order, how long
each stays, framing, sound and volume, dimming, the slow zoom, the
caption, the clock and the details. Lively calls livelyPropertyListener in
index.html once for every property when the wallpaper starts and again
whenever one changes; the page turns them into the slideshow's address
(see the header of js/slideshow.js) and reloads the frame a moment after
the last call. The menu's lists come from the site itself, so they cannot
drift from the slideshow:

  shows     SHOWS in js/slideshow.js
  subjects  KR_PHOTO_CATEGORIES in js/shared-components.js
  places    data/photo-locations.json, every region with a photograph
  sounds, speeds, dimming
            SOUNDS, SPEEDS and DIMS in js/slideshow.js

The zip is the same on every machine (stored, not deflated, since zlib
builds differ; fixed timestamps, platform field and order), and --check
compares what is inside it, file by file, with a fresh build. The thumbnail Lively shows
in its library is the gallery's share card, img/og/page-gallery.jpg.

    python .github/scripts/build_lively_package.py           # write the zip
    python .github/scripts/build_lively_package.py --check   # exit 1 if it is stale

Lively's formats: https://github.com/rocksdanister/lively/wiki/Web-Guide-IV-:-Interaction
"""
from __future__ import annotations

import io
import json
import re
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402

ROOT = sitelib.ROOT
OUT = ROOT / "wallpaper" / "kenreid-slideshow-lively.zip"
SITE = "https://www.kenreid.co.uk/slideshow.html"
THUMB = ROOT / "img" / "og" / "page-gallery.jpg"
# Every file in the zip carries this date, so a rebuild is identical.
STAMP = (2026, 1, 1, 0, 0, 0)

ORDERS = [("shuffle", "Shuffled"), ("newest", "Newest first"), ("oldest", "Oldest first")]
FITS = [("whole", "Whole photograph"), ("fill", "Fill the screen")]
POOLS = [("selected", "My selection"), ("all", "Every photograph")]


def js_list(path: Path, name: str) -> str:
    text = path.read_text(encoding="utf-8")
    m = re.search(r"\b(?:const|var) %s = \[(.*?)\];" % re.escape(name), text, re.S)
    if not m:
        raise SystemExit(f"{name} not found in {path.relative_to(ROOT)}")
    return m.group(1)


def keyed(path: Path, name: str) -> list[tuple[str, str]]:
    return re.findall(r"\{\s*key:\s*'([^']+)',\s*label:\s*'((?:[^'\\]|\\.)*)'", js_list(path, name))


def numbers(path: Path, name: str) -> list[int]:
    return [int(n) for n in re.findall(r"\d+", js_list(path, name))]


def seconds_label(sec: int) -> str:
    if sec < 60:
        return f"{sec} seconds"
    m = round(sec / 60)
    return f"{m} minute" + ("" if m == 1 else "s")


def menus() -> dict:
    shared = ROOT / "js" / "shared-components.js"
    show = ROOT / "js" / "slideshow.js"
    regions = json.loads((ROOT / "data" / "photo-locations.json").read_text(encoding="utf-8"))["regions"]
    places = sorted({r["name"] for r in regions if r.get("photos")}, key=str.lower)
    return {
        "show": keyed(show, "SHOWS"),
        "tag": [("", "Any subject")] + keyed(shared, "KR_PHOTO_CATEGORIES"),
        "place": [("", "Anywhere")] + [(p, p) for p in places],
        "pool": POOLS,
        "order": ORDERS,
        "every": [(str(s), seconds_label(s)) for s in numbers(show, "SPEEDS")],
        "fit": FITS,
        "sound": keyed(show, "SOUNDS"),
        "dims": numbers(show, "DIMS"),
    }


def properties(m: dict) -> dict:
    def dropdown(text: str, items: list[tuple[str, str]], default: str) -> dict:
        return {"type": "dropdown", "value": [v for v, _ in items].index(default), "text": text,
                "items": [label for _, label in items]}

    return {
        "show": dropdown("Show", m["show"], "photos"),
        "tag": dropdown("Subject", m["tag"], ""),
        "place": dropdown("Place", m["place"], ""),
        "pool": dropdown("Photographs", m["pool"], "selected"),
        "order": dropdown("Order", m["order"], "shuffle"),
        "every": dropdown("Each photograph", m["every"], "20"),
        "fit": dropdown("Framing", m["fit"], "whole"),
        "sound": dropdown("Sound", m["sound"], "off"),
        "volume": {"max": 100, "min": 0, "step": 5, "text": "Volume", "type": "slider", "value": 50},
        "dim": {"max": max(m["dims"]), "min": 0, "step": 5, "text": "Dim the photographs (%)", "type": "slider",
                "value": 0},
        "drift": {"type": "checkbox", "value": True, "text": "Slow zoom"},
        "captions": {"type": "checkbox", "value": True, "text": "Show where each was taken"},
        "clock": {"type": "checkbox", "value": False, "text": "Show the time"},
        "info": {"type": "checkbox", "value": False, "text": "Show each photograph's details"},
    }


PAGE = """<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<title>Ken Reid's photographs</title>
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #050505; }
  iframe { position: fixed; inset: 0; width: 100%; height: 100%; border: 0; }
</style>
</head>
<body>
<iframe id="show" title="Ken Reid's photographs" allow="autoplay; fullscreen; screen-wake-lock"></iframe>
<script>
// The slideshow at kenreid.co.uk, set up from Lively's Customise menu.
// Lively calls livelyPropertyListener for every property when the
// wallpaper starts and again whenever one changes; the frame is reloaded
// with the new address a moment after the last call. Built by
// build_lively_package.py; the address is explained at the top of
// https://www.kenreid.co.uk/js/slideshow.js
var SITE = __SITE__;
var CHOICES = __CHOICES__;
var picked = {};
var timer = 0;

function livelyPropertyListener(name, val) {
  picked[name] = CHOICES[name] ? CHOICES[name][val] : val;
  clearTimeout(timer);
  timer = setTimeout(load, 400);
}

function load() {
  var q = new URLSearchParams();
  ['show', 'tag', 'place', 'order', 'every', 'fit', 'sound'].forEach(function (k) {
    var v = picked[k], d = __DEFAULTS__[k];
    if (v != null && v !== d) q.set(k, v);
  });
  if (picked.pool === 'all') q.set('pool', 'all');
  if (picked.volume != null && +picked.volume !== 50) q.set('volume', String(Math.round(picked.volume)));
  if (+picked.dim > 0) q.set('dim', String(Math.round(picked.dim)));
  if (picked.drift === false) q.set('drift', '0');
  if (picked.captions === false) q.set('captions', '0');
  if (picked.clock === true) q.set('clock', '1');
  if (picked.info === true) q.set('info', '1');
  q.set('controls', 'off');
  var url = SITE + '?' + q.toString();
  var frame = document.getElementById('show');
  if (frame.src !== url) frame.src = url;
}

timer = setTimeout(load, 400);
</script>
</body>
</html>
"""


def page(m: dict) -> str:
    choices = {k: [v for v, _ in m[k]] for k in ("show", "tag", "place", "pool", "order", "every", "fit", "sound")}
    defaults = {"show": "photos", "tag": "", "place": "", "order": "shuffle", "every": "20", "fit": "whole", "sound": "off"}
    return (PAGE.replace("__SITE__", json.dumps(SITE))
            .replace("__CHOICES__", json.dumps(choices, ensure_ascii=False))
            .replace("__DEFAULTS__", json.dumps(defaults)))


INFO = {
    "AppVersion": "2.2.1.0",
    "Title": "Ken Reid's photographs",
    "Thumbnail": "thumbnail.jpg",
    "Preview": "thumbnail.jpg",
    "Desc": "Ken Reid's photographs one at a time, or a tour of the places, his quotes, his books or his albums, with a fire, rain, a river, a cafe or a city at night "
            "to listen to if you like. Right-click it in Lively and choose Customise to pick what to show "
            "and the sound.",
    "Author": "Ken Reid",
    "License": "Photographs (c) Ken Reid, all rights reserved. The sounds are other people's, credited at "
               "https://www.kenreid.co.uk/colophon.html#colo-sounds",
    "Contact": "https://www.kenreid.co.uk/slideshow.html",
    "Type": 1,
    "FileName": "index.html",
    "Arguments": "",
    "IsAbsolutePath": False,
    "Id": None,
    "Tags": ["photography", "slideshow", "ambient"],
    "Version": 1,
}


def build() -> bytes:
    m = menus()
    files = [
        ("LivelyInfo.json", (json.dumps(INFO, indent=2) + "\n").encode("utf-8")),
        ("LivelyProperties.json", (json.dumps(properties(m), indent=2, ensure_ascii=False) + "\n").encode("utf-8")),
        ("index.html", page(m).encode("utf-8")),
        ("thumbnail.jpg", THUMB.read_bytes()),
    ]
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        for name, data in files:
            info = zipfile.ZipInfo(name, date_time=STAMP)
            info.compress_type = zipfile.ZIP_STORED
            info.create_system = 3          # the same "made on" field whatever builds it
            info.external_attr = 0o644 << 16
            z.writestr(info, data)
    return buf.getvalue()


def contents(blob: bytes) -> list[tuple[str, bytes]]:
    """The files in a zip, in order, with their bytes."""
    try:
        with zipfile.ZipFile(io.BytesIO(blob)) as z:
            return [(i.filename, z.read(i)) for i in z.infolist()]
    except zipfile.BadZipFile:
        return []


def main(argv=None) -> int:
    ap = sitelib.arg_parser(__doc__)
    ap.add_argument("--check", action="store_true", help="exit 1 if the zip is missing or stale; write nothing")
    args = ap.parse_args(argv)
    data = build()
    rel = OUT.relative_to(ROOT).as_posix()
    if args.check:
        if not OUT.exists() or contents(OUT.read_bytes()) != contents(data):
            print(f"{rel} is stale. run: python .github/scripts/build_lively_package.py")
            return 1
        print(f"{rel} is current.")
        return 0
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if OUT.exists() and OUT.read_bytes() == data:
        print(f"{rel} already current.")
        return 0
    OUT.write_bytes(data)
    print(f"wrote {rel} ({len(data) // 1024} KB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
