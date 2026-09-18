"""
Record every gallery thumbnail's pixel size in data/photo-dims.json.

The gallery lays photographs out in justified rows, which needs each
frame's aspect ratio before its image has loaded. Reading the sizes at
build time means the layout is right on the first paint instead of
reflowing as thumbnails arrive.

    python .github/scripts/generate_photo_dims.py
    python .github/scripts/generate_photo_dims.py --check
"""
import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
THUMBS = ROOT / "img" / "photography" / "thumb"
OUT = ROOT / "data" / "photo-dims.json"


def webp_size(path):
    """Width and height from a WebP header without a decoder.

    Handles the three container variants (VP8, VP8L, VP8X). Falls back to
    Pillow only if the header is unfamiliar, so the script has no hard
    dependency for the common case.
    """
    with path.open("rb") as f:
        head = f.read(30)
    if head[:4] != b"RIFF" or head[8:12] != b"WEBP":
        return _pillow_size(path)
    chunk = head[12:16]
    if chunk == b"VP8 ":
        w, h = struct.unpack("<HH", head[26:30])
        return w & 0x3FFF, h & 0x3FFF
    if chunk == b"VP8L":
        b0, b1, b2, b3 = head[21:25]
        w = 1 + (((b1 & 0x3F) << 8) | b0)
        h = 1 + (((b3 & 0x0F) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6))
        return w, h
    if chunk == b"VP8X":
        w = 1 + int.from_bytes(head[24:27], "little")
        h = 1 + int.from_bytes(head[27:30], "little")
        return w, h
    return _pillow_size(path)


def _pillow_size(path):
    from PIL import Image  # noqa: WPS433 - optional fallback
    with Image.open(path) as im:
        return im.size


def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    check_only = "--check" in argv
    dims = {}
    for f in sorted(THUMBS.glob("*.webp"), key=lambda p: (len(p.stem), p.stem)):
        try:
            w, h = webp_size(f)
        except Exception as exc:  # noqa: BLE001 - report and carry on
            print("skip %s: %s" % (f.name, exc))
            continue
        dims[f.stem] = [int(w), int(h)]

    if check_only:
        if not OUT.exists():
            print("data/photo-dims.json is missing")
            print("run: python .github/scripts/generate_photo_dims.py")
            return 1
        current = json.loads(OUT.read_text(encoding="utf-8"))
        if current != dims:
            changed = [k for k in set(current) | set(dims) if current.get(k) != dims.get(k)]
            print("data/photo-dims.json is stale for %d photo(s): %s"
                  % (len(changed), ", ".join(sorted(changed)[:8])))
            print("run: python .github/scripts/generate_photo_dims.py")
            return 1
        print("data/photo-dims.json is up to date.")
        return 0

    OUT.write_text(json.dumps(dims, separators=(",", ":")) + "\n", encoding="utf-8")
    print("Wrote %s (%d photos)" % (OUT, len(dims)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
