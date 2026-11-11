#!/usr/bin/env python3
"""
Name each photograph's main colour from its pixels, for the gallery's
colour filter (js/gallery.js): data/photo-colours.json lists the frames
of each colour family, and under "none" the frames with too little colour
to have one.

    python .github/scripts/generate_photo_colours.py            # rewrite the file
    python .github/scripts/generate_photo_colours.py --report   # list what would change; write nothing
    python .github/scripts/generate_photo_colours.py --check    # every thumbnail is in one family

The rule, in the order family_of applies it to the thumbnail's pixels
(shrunk to fit SIZE x SIZE first; a couple of thousand pixels decide as
the full frame would):

  1. A pixel has a colour when its chroma, max(r, g, b) - min(r, g, b) on
     0..1, is at least CHROMA_FLOOR. Greys, whites and near-blacks are
     left out: their hue is compression noise.
  2. Its hue angle puts it in one of eight families (HUES): red, orange,
     yellow, green, teal, blue, purple, pink.
  3. Brown is not a hue but a warm colour that is dark or washed out:
     wood, stone, sand, fur, skin. A pixel between WARM_FROM and WARM_TO
     degrees with a value under DARK or a saturation under DULL is brown.
     A dark yellow past WARM_TO is olive, which the eye files with the
     greens, so it counts as green.
  4. Every coloured pixel votes for its family with its chroma as the
     weight, so a vivid subject counts for more than its area alone and a
     pale haze for less. The family with the most weight is the frame's.
  5. A frame whose coloured pixels cover less than MIN_COVER of it has no
     family: every black and white frame (the "bw" tag,
     detect_monochrome.py), and a grey scene with a trace of tint.

So a blue sky over a green field is whichever of the two holds more of
the frame, weighed by how strong each is; a grey street with one red coat
has no family until the coat fills MIN_COVER of it. One family a frame,
by design: the filter answers "show me the blue ones", and a frame under
three colours would turn up in every answer.

--report shows what a change to a threshold would move before anything is
written. --check reads no pixels and needs only the standard library: it
fails when a thumbnail is in no family or in two, when the file names a
frame with no thumbnail, or when the file is not as this script writes
it. A thumbnail replaced in place keeps its old family until the script
is run again; frames are added far more often than they are replaced.
Writing and --report need Pillow.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402

ROOT = sitelib.ROOT
OUT = ROOT / "data" / "photo-colours.json"

# The families, in the order the file and the gallery's swatches list
# them: round the hue circle, then brown. COLOURS in js/gallery.js names
# the same nine.
FAMILIES = ("red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "brown")
NONE = "none"

# Where each hue family ends, in degrees; red also closes the circle.
HUES = (("red", 15), ("orange", 42), ("yellow", 68), ("green", 165), ("teal", 195),
        ("blue", 258), ("purple", 290), ("pink", 345), ("red", 360))

SIZE = 48               # the thumbnail is shrunk to fit this square
CHROMA_FLOOR = 0.12     # below it a pixel is a grey
MIN_COVER = 0.06        # the share of a frame its colour must cover
WARM_FROM, WARM_TO = 15, 55     # the hues that turn brown when dark or dull
DARK = 0.5              # value below which a warm pixel is brown
DULL = 0.4              # saturation below which a warm pixel is brown


def pixel_family(r: int, g: int, b: int) -> tuple[str | None, float]:
    """(family, weight) for one pixel: (None, 0.0) for a grey, otherwise
    its family and its chroma. Steps 1 to 3 of the rule."""
    top, low = max(r, g, b), min(r, g, b)
    chroma = (top - low) / 255.0
    if chroma < CHROMA_FLOOR:
        return None, 0.0
    span = top - low
    if top == r:
        hue = 60 * (((g - b) / span) % 6)
    elif top == g:
        hue = 60 * ((b - r) / span + 2)
    else:
        hue = 60 * ((r - g) / span + 4)
    family = next(name for name, end in HUES if hue < end)
    value, saturation = top / 255.0, span / top
    if WARM_FROM <= hue < WARM_TO and (value < DARK or saturation < DULL):
        family = "brown"
    elif family == "yellow" and value < DARK:
        family = "green"
    return family, chroma


def family_of(pixels) -> tuple[str, dict[str, float]]:
    """(family, {family: weight}) for a frame's (r, g, b) pixels. Steps 4
    and 5. A tie goes to the family listed first in FAMILIES."""
    weights = dict.fromkeys(FAMILIES, 0.0)
    coloured = total = 0
    for r, g, b in pixels:
        total += 1
        family, weight = pixel_family(r, g, b)
        if family:
            coloured += 1
            weights[family] += weight
    if not total or coloured / total < MIN_COVER:
        return NONE, weights
    return max(FAMILIES, key=lambda name: weights[name]), weights


def thumb_pixels(path: Path) -> list:
    """The thumbnail's pixels after shrinking, as (r, g, b)."""
    from PIL import Image   # only writing and --report read pixels

    with Image.open(path) as im:
        im = im.convert("RGB")
        im.thumbnail((SIZE, SIZE))
        # get_flattened_data replaces getdata, which Pillow 12 deprecates
        # and 14 removes; requirements.txt still allows Pillow 10.
        flat = getattr(im, "get_flattened_data", None) or im.getdata
        return list(flat())


def classify(thumbs: list[Path]) -> dict[str, list[int]]:
    """{family: [frame, ...]} over the thumbnails, "none" included."""
    families: dict[str, list[int]] = {name: [] for name in FAMILIES + (NONE,)}
    for path in thumbs:
        family, _weights = family_of(thumb_pixels(path))
        families[family].append(int(path.stem))
    return families


def dump(families: dict[str, list[int]]) -> str:
    """The file's text: a family a line, frames by number."""
    lines = ['"%s": %s' % (name, json.dumps(sorted(families.get(name, []))))
             for name in FAMILIES + (NONE,)]
    return "{\n" + ",\n".join(lines) + "\n}\n"


def by_frame(families: dict[str, list[int]]) -> dict[int, str]:
    """{frame: family}, the first family that lists it."""
    out: dict[int, str] = {}
    for name, frames in families.items():
        for n in frames:
            out.setdefault(n, name)
    return out


def problems(text: str, frames: list[int]) -> list[str]:
    """What --check finds wrong with the file's text, given the frames
    that have a thumbnail."""
    try:
        families = json.loads(text)
        listed = [n for name in families for n in families[name]]
    except (ValueError, TypeError) as exc:
        return ["data/photo-colours.json cannot be read: %r" % exc]
    out = []
    missing = sorted(set(frames) - set(listed))
    if missing:
        out.append("%d thumbnail(s) in no colour family: %s"
                   % (len(missing), ", ".join(map(str, missing[:8]))))
    gone = sorted(set(listed) - set(frames))
    if gone:
        out.append("%d frame(s) with no thumbnail: %s"
                   % (len(gone), ", ".join(map(str, gone[:8]))))
    twice = sorted(n for n in set(listed) if listed.count(n) > 1)
    if twice:
        out.append("%d frame(s) in two families: %s"
                   % (len(twice), ", ".join(map(str, twice[:8]))))
    if not out and text.replace("\r\n", "\n") != dump(families):
        out.append("data/photo-colours.json is not as the generator writes it "
                   "(an unknown family, frames out of order, or a hand edit)")
    return out


def main(argv=None):
    parser = sitelib.arg_parser(__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--report", action="store_true",
                      help="list what would change; write nothing")
    mode.add_argument("--check", action="store_true",
                      help="exit 1 unless every thumbnail is in one family; reads no pixels")
    args = parser.parse_args(argv)
    thumbs = sitelib.thumb_files()

    if args.check:
        if not OUT.exists():
            print("data/photo-colours.json is missing")
            print("run: python .github/scripts/generate_photo_colours.py")
            return 1
        with open(OUT, encoding="utf-8", newline="") as fh:
            found = problems(fh.read(), [int(p.stem) for p in thumbs])
        for line in found:
            print(line)
        if found:
            print("run: python .github/scripts/generate_photo_colours.py")
            return 1
        print("every thumbnail has its colour family (%d frames)." % len(thumbs))
        return 0

    families = classify(thumbs)
    print(", ".join("%s %d" % (name, len(families[name])) for name in FAMILIES + (NONE,)))
    before = by_frame(json.loads(OUT.read_text(encoding="utf-8"))) if OUT.exists() else {}
    after = by_frame(families)
    moved = [(n, before.get(n), after.get(n)) for n in sorted(set(before) | set(after))
             if before.get(n) != after.get(n)]
    print("%d frame(s) change." % len(moved))
    for n, old, new in moved:
        print("  %-5d %s -> %s" % (n, old or "(new)", new or "(gone)"))
    if args.report:
        return 0

    text = dump(families)
    # The working copy's own line endings, LF for a new file.
    if OUT.exists() and b"\r\n" in OUT.read_bytes():
        text = text.replace("\n", "\r\n")
    with open(OUT, "w", encoding="utf-8", newline="") as fh:
        fh.write(text)
    print("Wrote data/%s" % OUT.name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
