#!/usr/bin/env python3
"""The photographs' sharp renditions, made from the originals on the release.

A frame N has three sizes on the site:

  img/photography/thumb/N.webp      400px wide, the gallery tile and card
                                    (add-photographs makes it)
  the same folder, N@2x.webp        exactly twice the thumb's size, the
                                    same tile on a high-density screen
                                    (srcset "... 2x" / "800w")
  img/photography/hero/N.webp       HERO_EDGE on the long edge, for a
                                    photograph shown large: a page or post
                                    banner, a photo inside a post, a share
                                    image

The full-size frames are PNGs on the photos-v1 release (KR_RELEASE in
js/shared-components.js), 2.2 GB for 540 frames, which is why none of
them is in the repository: GitHub Pages caps a site at 1 GB. Before these
renditions every tile was drawn from the 400px thumb whatever the
screen's density, and 50 of the posts used that thumb as their banner
and share image, stretched to 1200 or 1440px: soft in all three places.

Which frames get what:
  @2x   every frame that has a thumb (the gallery can show any of them)
  hero  every frame a tracked page or data/posts.json refers to (as a
        thumb, a hero or a release PNG), so a photo that appears only in
        the gallery costs the repository nothing more than its @2x

Sizes are derived, never typed: the @2x is the thumb's own width and
height doubled, so the two are the same shape to the pixel and srcset
can swap them; a hero keeps the frame's aspect ratio and is never
enlarged, so a frame whose original is smaller than HERO_EDGE (126 of
the early ones are 1200px) gets a hero at the original's own size.
data/photo-originals.json records each original's size, read from the
PNG header with a ranged request rather than a download, so --check can
tell a hero that is as sharp as its original allows from a stale one. A file that exists
and is untracked is somebody's work in progress (a hero made for a
draft): it is never overwritten, and --check does not count it.

    python .github/scripts/generate_photo_renditions.py           # make what is missing
    python .github/scripts/generate_photo_renditions.py --heroes  # remake every hero at HERO_EDGE
    python .github/scripts/generate_photo_renditions.py --check   # CI: offline, exit 1 if any is missing or the wrong size

Making needs Pillow and the network (one original at a time, deleted as
soon as it is resized); --check needs only the standard library and the
files on disk, so it runs in the audit job. New frames: run it after
add-photographs has made their thumbs.
"""
from __future__ import annotations

import io
import re
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402
from generate_photo_dims import webp_size  # noqa: E402  (header reader, no Pillow)

ROOT = sitelib.ROOT
THUMBS = ROOT / "img" / "photography" / "thumb"
HEROES = ROOT / "img" / "photography" / "hero"
RELEASE = "https://github.com/DrKenReid/DrKenReid.github.io/releases/download/photos-v1/{n}.png"
ORIGINALS = ROOT / "data" / "photo-originals.json"

# Long edge of a hero. The banners run the width of the window, 1440 to
# 1920 CSS px on a desktop; 1920 keeps them sharp there at density 1 and
# keeps a photo inside a post (760px column) sharp at density 2.
HERO_EDGE = 1920
# The thumbs are WebP at quality 80 (add-photographs); the larger sizes
# can go a little lower for the same look, and the heroes are the bulk.
THUMB_QUALITY = 80
HERO_QUALITY = 78
WORKERS = 6

# Frames a published page shows whose hero exists only as someone's
# untracked file, made before this script for a post then in draft. They
# are not remade or required here until their owner tracks or drops them;
# until then the pages show the frame at thumb size, as they always have.
AWAITING_OWNER = {"90", "127", "149"}

REF_RE = re.compile(r"img/photography/(?:thumb|hero)/(\d+)(?:@2x)?\.webp|photos-v1/(\d+)\.png")


# --- which frames -------------------------------------------------------

def frames_with_thumbs() -> list[str]:
    return [p.stem for p in sitelib.thumb_files()]


def referenced_frames() -> list[str]:
    """Every frame a tracked page or posts.json points at."""
    found: set[str] = set()
    for path in sitelib.tracked("*.html", "blog/*.html", "data/posts.json"):
        for a, b in REF_RE.findall(path.read_text(encoding="utf-8", errors="ignore")):
            found.add(a or b)
    return sorted(found, key=int)


def untracked(paths: list[Path]) -> set[Path]:
    tracked = set(sitelib.tracked("img/photography/hero/*", "img/photography/thumb/*"))
    return {p for p in paths if p.exists() and p not in tracked}


def twice(thumb: Path) -> Path:
    return thumb.with_name(thumb.stem + "@2x.webp")


# --- sizes ------------------------------------------------------------------

def hero_size(original: tuple[int, int]) -> tuple[int, int]:
    """The frame scaled so its long edge is HERO_EDGE (never enlarged)."""
    w, h = original
    scale = min(1.0, HERO_EDGE / max(w, h))
    return max(1, round(w * scale)), max(1, round(h * scale))


# --- making ---------------------------------------------------------------

def fetch(n: str):
    from PIL import Image, ImageOps
    data = _get(RELEASE.format(n=n))
    im = Image.open(io.BytesIO(data))
    im = ImageOps.exif_transpose(im).convert("RGB")
    return im, len(data)


def make(n: str, want_2x: bool, want_hero: bool, skip: set[Path]) -> str:
    from PIL import Image
    im, nbytes = fetch(n)
    done = []
    thumb = THUMBS / f"{n}.webp"
    if want_2x and twice(thumb) not in skip:
        tw, th = webp_size(thumb)
        im.resize((tw * 2, th * 2), Image.LANCZOS).save(twice(thumb), "WEBP", quality=THUMB_QUALITY, method=6)
        done.append(f"@2x {tw * 2}x{th * 2}")
    hero = HEROES / f"{n}.webp"
    if want_hero and hero not in skip:
        size = hero_size(im.size)
        im.resize(size, Image.LANCZOS).save(hero, "WEBP", quality=HERO_QUALITY, method=6)
        done.append(f"hero {size[0]}x{size[1]}")
    return f"{n}: {', '.join(done) or 'nothing'} (from a {nbytes // 1024} KB original)"


def _get(url: str, headers: dict | None = None, tries: int = 4) -> bytes:
    """A GET with a few retries: the release's storage sometimes answers
    a burst of requests with a 5xx."""
    import time
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=120) as resp:
                return resp.read()
        except urllib.error.HTTPError as exc:
            if exc.code < 500 or attempt == tries - 1:
                raise
        except (urllib.error.URLError, TimeoutError):
            if attempt == tries - 1:
                raise
        time.sleep(2 ** attempt)
    raise RuntimeError("unreachable")


def original_size(n: str) -> tuple[int, int]:
    """An original's (width, height) from the start of the file, fetched
    with a Range request, so no frame is downloaded whole. The frames are
    named .png but a few are other formats inside, so Pillow reads the
    header rather than this script parsing PNG itself; the whole file is
    fetched only if the first 256 KB are not enough."""
    from PIL import ImageFile
    url = RELEASE.format(n=n)
    parser = ImageFile.Parser()
    parser.feed(_get(url, {"Range": "bytes=0-262143"}))
    if parser.image is None:
        parser = ImageFile.Parser()
        parser.feed(_get(url))
    return parser.image.size


def load_originals() -> dict[str, list[int]]:
    import json
    if not ORIGINALS.exists():
        return {}
    return json.loads(ORIGINALS.read_text(encoding="utf-8"))


def save_originals(sizes: dict[str, list[int]]) -> None:
    import json
    # One line, keys in frame order, as data/photo-dims.json is written.
    ordered = {k: sizes[k] for k in sorted(sizes, key=int)}
    ORIGINALS.write_text(json.dumps(ordered, separators=(",", ":")) + "\n", encoding="utf-8")


def hero_edge_for(n: str, originals: dict[str, list[int]]) -> int:
    """The long edge frame n's hero should have: HERO_EDGE, or the
    original's own when that is smaller."""
    if n not in originals:          # not read yet: assume a large original
        return HERO_EDGE
    return max(hero_size(tuple(originals[n])))


def record_originals() -> dict[str, list[int]]:
    """Fill data/photo-originals.json for every frame with a thumb. Three
    requests at a time (more and the release's storage starts answering
    500); a frame that still fails is reported and left for the next run,
    and what was read is saved either way."""
    sizes = load_originals()
    missing = [n for n in frames_with_thumbs() if n not in sizes]
    if not missing:
        return sizes
    print(f"reading {len(missing)} original size(s) from the release")
    failed = []
    with ThreadPoolExecutor(3) as pool:
        futures = {pool.submit(original_size, n): n for n in missing}
        for fut, n in futures.items():
            try:
                sizes[n] = list(fut.result())
            except Exception as exc:
                failed.append(n)
                print(f"{n}: size unreadable ({exc}); rerun to retry", flush=True)
    save_originals(sizes)
    if failed:
        print("sizes still missing: " + ", ".join(failed))
    return sizes


def plan(remake_heroes: bool, originals: dict[str, list[int]]):
    thumbs = frames_with_thumbs()
    refs = [n for n in referenced_frames() if (THUMBS / f"{n}.webp").exists()]
    skip = untracked([HEROES / f"{n}.webp" for n in refs] + [twice(THUMBS / f"{n}.webp") for n in thumbs])
    jobs = {}
    for n in thumbs:
        if not twice(THUMBS / f"{n}.webp").exists():
            jobs.setdefault(n, [False, False])[0] = True
    for n in refs:
        hero = HEROES / f"{n}.webp"
        if hero in skip:
            continue
        if remake_heroes or not hero.exists() or max(webp_size(hero)) < hero_edge_for(n, originals) - 1:
            jobs.setdefault(n, [False, False])[1] = True
    return jobs, skip


# --- checking -------------------------------------------------------------

def check() -> list[str]:
    problems = []
    tracked = set(sitelib.tracked("img/photography/hero/*", "img/photography/thumb/*"))
    originals = load_originals()
    for n in frames_with_thumbs():
        if n not in originals:
            problems.append(f"data/photo-originals.json has no size for frame {n}")
        thumb = THUMBS / f"{n}.webp"
        dbl = twice(thumb)
        if dbl not in tracked:
            problems.append(f"thumb/{n}@2x.webp is missing or untracked")
            continue
        tw, th = webp_size(thumb)
        if webp_size(dbl) != (tw * 2, th * 2):
            problems.append(f"thumb/{n}@2x.webp is {webp_size(dbl)}, not twice the thumb ({tw * 2}, {th * 2})")
    for n in referenced_frames():
        if not (THUMBS / f"{n}.webp").exists() or n in AWAITING_OWNER:
            continue
        hero = HEROES / f"{n}.webp"
        if hero not in tracked:
            problems.append(f"hero/{n}.webp is missing or untracked (a tracked page shows frame {n})")
            continue
        tw, th = webp_size(THUMBS / f"{n}.webp")
        hw, hh = webp_size(hero)
        # Same shape, to within the thumb's own rounding: one thumb pixel,
        # scaled up, is the most a short panorama's thumb can be off by.
        if abs(hh - hw * th / tw) > hw / tw + 1:
            problems.append(f"hero/{n}.webp is not the thumb's shape ({hw}x{hh} vs {tw}x{th})")
        elif n in originals and max(hw, hh) < hero_edge_for(n, originals) - 1:
            problems.append(f"hero/{n}.webp is {hw}x{hh}; its original allows "
                            f"{hero_edge_for(n, originals)}px on the long edge")
    return problems


def main(argv=None) -> int:
    ap = sitelib.arg_parser(__doc__)
    ap.add_argument("--check", action="store_true", help="report missing or wrong-sized renditions; write nothing")
    ap.add_argument("--heroes", action="store_true", help=f"remake every referenced hero at {HERO_EDGE}px")
    args = ap.parse_args(argv)

    if args.check:
        problems = check()
        for p in problems[:40]:
            print("  " + p)
        if problems:
            print(f"{len(problems)} rendition problem(s). run: python .github/scripts/generate_photo_renditions.py")
            return 1
        print(f"photo renditions are current ({len(frames_with_thumbs())} @2x thumbs, "
              f"{len(referenced_frames())} referenced frames).")
        return 0

    originals = record_originals()
    jobs, skip = plan(args.heroes, originals)
    if skip:
        heroes = sorted(p.name for p in skip if p.parent == HEROES)
        print(f"leaving {len(skip)} untracked file(s) alone (work in progress)"
              + (": heroes " + ", ".join(heroes) if heroes else ""))
    if not jobs:
        print("photo renditions already current.")
        return 0
    print(f"{len(jobs)} frame(s) to fetch from the release")
    failed = []
    with ThreadPoolExecutor(WORKERS) as pool:
        futures = {pool.submit(make, n, a, b, skip): n for n, (a, b) in sorted(jobs.items(), key=lambda kv: int(kv[0]))}
        for fut, n in futures.items():
            try:
                print(fut.result(), flush=True)
            except Exception as exc:  # a missing or unreadable original
                failed.append(n)
                print(f"{n}: FAILED ({exc})", flush=True)
    if failed:
        print("failed: " + ", ".join(failed))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
