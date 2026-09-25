"""
Record image sizes where a layout needs them before the pixels arrive.

Two places need an image's shape before its file has loaded:

  * the gallery lays photographs out in justified rows, which needs each
    frame's aspect ratio up front. data/photo-dims.json records every
    thumbnail's pixel size, so the rows are right on the first paint
    instead of reflowing as thumbnails arrive;
  * a blog post's <img> without width and height is laid out zero pixels
    tall until its file arrives, then pushes everything below it down
    (layout shift, and a reader's place lost). With both attributes the
    browser reserves the box from their ratio, because the stylesheet's
    `img { width: 100%; height: auto }` sizes it by width.

    python .github/scripts/generate_photo_dims.py              # photo-dims.json
    python .github/scripts/generate_photo_dims.py --stamp-img  # and post images
    python .github/scripts/generate_photo_dims.py --check      # both current?

--check writes nothing and needs only the standard library (the CI job
that runs it installs nothing): it fails when photo-dims.json is missing
or stale, when an <img> in a tracked post lacks width or height, and when
an image's attributes give a shape more than RATIO_TOLERANCE away from
its file's (a replaced picture keeps its old box until someone notices).
--stamp-img fixes all of that: see stamp_post.

Sizes are read from the file headers (WebP, PNG, JPEG, GIF), so neither
mode needs an image library; Pillow is only a fallback for a format the
readers do not know.
"""
import json
import posixpath
import re
import struct
import sys
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402

ROOT = sitelib.ROOT
THUMBS = ROOT / "img" / "photography" / "thumb"
OUT = ROOT / "data" / "photo-dims.json"
THUMB_DIR = "img/photography/thumb/"

# How far an <img>'s width:height may sit from its file's before --check
# calls it wrong: 1% absorbs a thumbnail rounded to whole pixels (400x266
# for a 3:2 frame is 0.3% off) and still catches any real crop or swap.
RATIO_TOLERANCE = 0.01

# Ancestors whose images are not stamped, by one of their classes:
#   kr-viz         an interactive demo. Its images are sprites and icons
#                  sized by the demo's own CSS and script, and width/height
#                  there would fight that sizing.
#   related-posts  the cards generate_related_posts.py bakes into each post
#                  (in step with createBlogCardElement in
#                  js/shared-components.js; tests pin that markup). Their
#                  box is a fixed 200px crop set in CSS, so no attribute
#                  would reserve anything, and stamping them would make
#                  that generator's --check fail.
SKIP_INSIDE = ("kr-viz", "related-posts")


# --------------------------------------------------------------------------
# reading sizes from file headers
# --------------------------------------------------------------------------

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


def _jpeg_size(f):
    """Walk the JPEG markers to the first start-of-frame, which holds the
    size. Every other segment is skipped by its length."""
    f.seek(2)
    while True:
        byte = f.read(1)
        while byte and byte != b"\xff":
            byte = f.read(1)
        while byte == b"\xff":
            byte = f.read(1)
        if not byte:
            return None
        marker = byte[0]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            continue    # markers without a length
        length = struct.unpack(">H", f.read(2))[0]
        # SOF0-SOF15, except DHT (C4), JPG (C8) and DAC (CC)
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            h, w = struct.unpack(">xHH", f.read(5))
            return w, h
        f.seek(length - 2, 1)


def png_size(head):
    """(width, height) from the first 24 bytes of a PNG (its IHDR chunk), or
    None when `head` does not start one. Bytes rather than a path, so a
    check that holds only a fetched response's first bytes (perf_budget.py
    and the manifest icons) reads them with the same parser."""
    if head[:8] != b"\x89PNG\r\n\x1a\n" or head[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", head[16:24])


def image_size(path):
    """(width, height) of an image file in pixels."""
    if path.suffix.lower() == ".webp":
        return webp_size(path)
    with path.open("rb") as f:
        head = f.read(26)
        size = png_size(head)
        if size:
            return size
        if head[:6] in (b"GIF87a", b"GIF89a"):
            return struct.unpack("<HH", head[6:10])
        if head[:2] == b"\xff\xd8":
            size = _jpeg_size(f)
            if size:
                return size
    return _pillow_size(path)


def _pillow_size(path):
    from PIL import Image  # noqa: WPS433 - optional fallback
    with Image.open(path) as im:
        return im.size


def thumb_dims():
    """{stem: [width, height]} for every gallery thumbnail, in the order
    photo-dims.json is written (by number)."""
    dims = {}
    for f in sorted(THUMBS.glob("*.webp"), key=lambda p: (len(p.stem), p.stem)):
        try:
            w, h = webp_size(f)
        except Exception as exc:  # noqa: BLE001 - report and carry on
            print("skip %s: %s" % (f.name, exc))
            continue
        dims[f.stem] = [int(w), int(h)]
    return dims


# --------------------------------------------------------------------------
# <img> tags in posts
# --------------------------------------------------------------------------

class ImgTag:
    """One <img> start tag: where it sits in the page text, its source
    text and attributes, and the class of the ancestor that exempts it
    (None when it must carry dimensions)."""

    def __init__(self, start, raw, attrs, skip):
        self.start, self.raw, self.attrs, self.skip = start, raw, attrs, skip

    @property
    def has_dims(self):
        return bool(self.attrs.get("width")) and bool(self.attrs.get("height"))


class _ImgScanner(HTMLParser):
    VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
            "meta", "param", "source", "track", "wbr"}

    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.text = text
        self.line_starts = [0]
        for i, ch in enumerate(text):
            if ch == "\n":
                self.line_starts.append(i + 1)
        self.stack = []     # (tag, exempting class or None)
        self.images = []

    def _skip(self):
        return next((cls for _tag, cls in reversed(self.stack) if cls), None)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "img":
            line, col = self.getpos()
            start = self.line_starts[line - 1] + col
            raw = self.get_starttag_text()
            if not self.text.startswith(raw, start):
                # Never expected; stamping at a wrong offset would corrupt
                # the page, so stop rather than guess.
                raise RuntimeError("cannot locate <img> at line %d, column %d" % (line, col))
            self.images.append(ImgTag(start, raw, attrs, self._skip()))
            return
        if tag in self.VOID:
            return
        classes = (attrs.get("class") or "").split()
        own = next((c for c in SKIP_INSIDE if c in classes), None)
        self.stack.append((tag, own))

    def handle_startendtag(self, tag, attrs):
        if tag == "img":
            self.handle_starttag(tag, attrs)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                return


def post_images(text):
    """Every <img> start tag in a page, in document order. Markup inside
    <script> and <style> is text to the parser, so a template string that
    builds an image is not counted."""
    scanner = _ImgScanner(text)
    scanner.feed(text)
    scanner.close()
    return scanner.images


def local_file(src, page):
    """The file an <img src> in `page` loads, or None when it is remote,
    inline data, or missing."""
    src = (src or "").split("#", 1)[0].split("?", 1)[0]
    if not src or src.startswith(("http://", "https://", "//", "data:")):
        return None
    if src.startswith("/"):
        path = ROOT / src.lstrip("/")
    else:
        rel = posixpath.normpath(posixpath.join(page.parent.relative_to(ROOT).as_posix(), src))
        path = ROOT / rel
    return path if path.is_file() else None


def file_size(path, dims):
    """A file's (width, height): a gallery thumbnail's from the recorded
    sizes (what photo-dims.json holds), anything else from its header."""
    rel = path.relative_to(ROOT).as_posix()
    if rel.startswith(THUMB_DIR) and path.stem in dims:
        return tuple(dims[path.stem])
    return image_size(path)


def _int(value):
    try:
        return int(str(value).strip().removesuffix("px"))
    except (TypeError, ValueError):
        return None


def ratio_off(width, height, size):
    """How far width:height is from the file's shape, as a fraction."""
    w, h = size
    if not (width and height and w and h):
        return 0.0
    return abs((width / height) / (w / h) - 1)


# One attribute of a start tag: its name, and the value with its quotes.
# Walking attributes one at a time is what keeps a "width" inside another
# attribute's value (alt="the width = 3") from being taken for one.
ATTR_RE = re.compile(r'(\s+)([^\s=/>"\']+)(?:\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>"\']+))?')


def with_dims(raw, width, height):
    """`raw` <img ...> with width and height set. Missing attributes go at
    the end of the tag, where the posts that had them already put them;
    one that is present keeps its place and gets the new value."""
    out = raw
    for name, value in (("width", width), ("height", height)):
        found = next((m for m in ATTR_RE.finditer(out, len("<img"))
                      if m.group(2).lower() == name), None)
        if found:
            out = (out[:found.start()] + found.group(1) + '%s="%d"' % (name, value)
                   + out[found.end():])
        else:
            end = len(out) - (2 if out.endswith("/>") else 1)
            body = out[:end].rstrip()
            out = body + ' %s="%d"' % (name, value) + out[len(body):]
    return out


def examine_post(page, dims):
    """(missing, mismatched, unmeasurable) for one post's images outside
    SKIP_INSIDE: tags with no width or height, tags whose shape is wrong
    for the file (with the file's size), and tags whose file cannot be
    read locally."""
    text = page.read_text(encoding="utf-8")
    missing, mismatched, unmeasurable = [], [], []
    for img in post_images(text):
        if img.skip:
            continue
        path = local_file(img.attrs.get("src"), page)
        size = file_size(path, dims) if path else None
        if not img.has_dims:
            (missing if size else unmeasurable).append((img, size))
        elif size and ratio_off(_int(img.attrs["width"]), _int(img.attrs["height"]),
                                size) > RATIO_TOLERANCE:
            mismatched.append((img, size))
    return missing, mismatched, unmeasurable


def stamp_post(page, dims):
    """Write width and height on the post's images that lack them (the
    file's own pixel size) or whose shape disagrees with their file. A tag
    that has a width but no height keeps its width and gets the height
    the file's shape implies, and the same the other way round, so a
    picture deliberately shown smaller stays that size. Returns how many
    tags changed. Everything else in the file is left byte for byte."""
    with open(page, encoding="utf-8", newline="") as fh:
        raw_text = fh.read()
    missing, mismatched, _unreadable = examine_post(page, dims)
    edits = []
    for img, (w, h) in missing + mismatched:
        width, height = _int(img.attrs.get("width")), _int(img.attrs.get("height"))
        if width:           # a width someone chose: keep it, fix the height
            height = round(width * h / w)
        elif height:
            width = round(height * w / h)
        else:
            width, height = w, h
        edits.append((img.start, img.raw, with_dims(img.raw, width, height)))
    if not edits:
        return 0
    # Offsets come from the \n text the parser saw; the file may be CRLF.
    text = raw_text.replace("\r\n", "\n")
    for start, old, new in sorted(edits, reverse=True):
        assert text.startswith(old, start), (page, start)
        text = text[:start] + new + text[start + len(old):]
    if "\r\n" in raw_text:
        text = text.replace("\n", "\r\n")
    with open(page, "w", encoding="utf-8", newline="") as fh:
        fh.write(text)
    return len(edits)


def post_pages():
    return sitelib.tracked_posts()


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def check_photo_dims(dims):
    if not OUT.exists():
        print("data/photo-dims.json is missing")
        return False
    current = json.loads(OUT.read_text(encoding="utf-8"))
    if current != dims:
        changed = [k for k in set(current) | set(dims) if current.get(k) != dims.get(k)]
        print("data/photo-dims.json is stale for %d photo(s): %s"
              % (len(changed), ", ".join(sorted(changed)[:8])))
        return False
    return True


def check_post_images(dims):
    """Print every post image without usable dimensions; True when none."""
    bad = 0
    for page in post_pages():
        rel = page.relative_to(ROOT).as_posix()
        text = page.read_text(encoding="utf-8")
        line_of = lambda img: text.count("\n", 0, img.start) + 1  # noqa: E731
        missing, mismatched, unmeasurable = examine_post(page, dims)
        for img, size in missing:
            print("%s:%d: <img src=%s> has no width/height (file is %dx%d)"
                  % (rel, line_of(img), img.attrs.get("src"), *size))
        for img, size in mismatched:
            print("%s:%d: <img src=%s> is %sx%s but the file is %dx%d"
                  % (rel, line_of(img), img.attrs.get("src"), img.attrs.get("width"),
                     img.attrs.get("height"), *size))
        for img, _size in unmeasurable:
            print("%s:%d: <img src=%s> has no width/height and its file cannot be read "
                  "here (remote or missing): add them by hand"
                  % (rel, line_of(img), img.attrs.get("src")))
        bad += len(missing) + len(mismatched) + len(unmeasurable)
    return bad == 0


def main(argv=None):
    parser = sitelib.arg_parser(__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true",
                      help="exit 1 if photo-dims.json is stale or a post image lacks "
                           "width/height; write nothing")
    mode.add_argument("--stamp-img", action="store_true",
                      help="write photo-dims.json, then width/height on every post "
                           "image that lacks them or has the wrong shape")
    args = parser.parse_args(argv)
    dims = thumb_dims()

    if args.check:
        ok = check_photo_dims(dims)
        if not ok:
            print("run: python .github/scripts/generate_photo_dims.py")
        images_ok = check_post_images(dims)
        if not images_ok:
            print("run: python .github/scripts/generate_photo_dims.py --stamp-img")
        if ok and images_ok:
            print("data/photo-dims.json is up to date, and every post image has "
                  "width and height.")
        return 0 if ok and images_ok else 1

    OUT.write_text(json.dumps(dims, separators=(",", ":")) + "\n", encoding="utf-8")
    print("Wrote %s (%d photos)" % (OUT.relative_to(ROOT).as_posix(), len(dims)))
    if args.stamp_img:
        total = pages = 0
        for page in post_pages():
            count = stamp_post(page, dims)
            if count:
                pages += 1
                total += count
                print("  %s: %d image(s)" % (page.relative_to(ROOT).as_posix(), count))
        print("Stamped %d image(s) in %d post(s)." % (total, pages) if total
              else "Every post image already has width and height.")
        if not check_post_images(dims):
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
