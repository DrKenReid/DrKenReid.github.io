"""
Decide which photographs are monotone from their pixels, and keep the
"bw" tag in data/photo-tags.json honest about it.

The CLIP tagger called a lot of colour frames black and white. Pixels do
not have that problem. A frame counts as B&W only when it is greyscale:
the 99th-percentile chroma across its pixels is below a small floor, so a
faint cast or a single coloured detail is enough to keep it out. A
single-hue rule for toned prints was tried and dropped: warm skin, sand
and wood all share one hue and were being let through.

The thumbnail is enough; a 96px-wide copy decides the same way the full
frame would.

    python .github/scripts/detect_monochrome.py            # rewrite tags
    python .github/scripts/detect_monochrome.py --report   # list changes only
    python .github/scripts/detect_monochrome.py --check    # CI: tags agree with pixels
"""
import json
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
THUMBS = ROOT / "img" / "photography" / "thumb"
TAGS = ROOT / "data" / "photo-tags.json"

# Chroma is max(r,g,b) - min(r,g,b) on 0..1. Two tests, both required:
#   p99  - the frame overall: compression noise in a true greyscale sits
#          under 0.02, a visible cast starts around 0.05.
#   p999 - a coloured accent: a selective-colour shot (grey street, one
#          pink coat) is under 1% of pixels and sails past p99 alone.
# --report shows what a change here would do before anything is written.
GREYSCALE_P99 = 0.03
ACCENT_P999 = 0.10


def is_monotone(path):
    with Image.open(path) as im:
        im = im.convert("RGB")
        im.thumbnail((96, 96))
        px = list(im.getdata())
    chromas = sorted((max(p) - min(p)) / 255.0 for p in px)
    p99 = chromas[int(len(chromas) * 0.99)]
    p999 = chromas[min(len(chromas) - 1, int(len(chromas) * 0.999))]
    if p99 <= GREYSCALE_P99 and p999 <= ACCENT_P999:
        return True, "greyscale (p99 %.3f, p999 %.3f)" % (p99, p999)
    if p99 <= GREYSCALE_P99:
        return False, "colour accent (p99 %.3f, p999 %.3f)" % (p99, p999)
    return False, "colour (p99 %.3f)" % p99


def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    report = "--report" in argv
    check = "--check" in argv
    tags = json.loads(TAGS.read_text(encoding="utf-8"))

    add, drop, kept = [], [], 0
    for f in sorted(THUMBS.glob("*.webp"), key=lambda p: (len(p.stem), p.stem)):
        stem = f.stem
        mono, why = is_monotone(f)
        current = tags.setdefault(stem, [])
        has = "bw" in current
        if mono and not has:
            add.append((stem, why))
        elif has and not mono:
            drop.append((stem, why))
        else:
            kept += 1

    print("unchanged %d, add bw %d, drop bw %d" % (kept, len(add), len(drop)))
    for stem, why in add:
        print("  + %-5s %s" % (stem, why))
    for stem, why in drop:
        print("  - %-5s %s" % (stem, why))

    if check:
        if add or drop:
            print("data/photo-tags.json disagrees with the pixels on %d photo(s)." % (len(add) + len(drop)))
            print("run: python .github/scripts/detect_monochrome.py")
            return 1
        print("bw tags agree with the pixels.")
        return 0
    if report:
        return 0

    for stem, _ in add:
        tags[stem].append("bw")
    for stem, _ in drop:
        tags[stem] = [t for t in tags[stem] if t != "bw"]
    TAGS.write_text(json.dumps(tags, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Wrote %s" % TAGS)
    return 0


if __name__ == "__main__":
    sys.exit(main())
