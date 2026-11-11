#!/usr/bin/env python3
"""
Record how each photograph was taken, where its original still says: the
camera, the lens, the focal length, the aperture, the shutter speed and
the ISO. data/photo-exif.json holds them, for the line under a photograph
in the gallery's lightbox and the gallery's "by the numbers" figures
(js/gallery.js, js/lightbox.js).

The originals are not in the repository: they are assets of the photos
release (DATA.md, "Photographs"). So this is the one generator that reads
files outside it. Either a folder, wherever a copy of the originals is
kept as <n>.png (name it, or set KR_PHOTO_ORIGINALS to it), or the files
of a new set themselves, with the number of the first:

    python .github/scripts/generate_photo_exif.py <folder>            # merge into data/photo-exif.json
    python .github/scripts/generate_photo_exif.py --first 757 a.jpg b.jpg   # these are frames 757, 758
    python .github/scripts/generate_photo_exif.py <folder> --report   # coverage only; write nothing
    python .github/scripts/generate_photo_exif.py --check             # the file on disk, nothing else needed

--first is for a set as it goes up. A full-size frame re-saved for the
release (decoded, turned upright, written out again as a PNG) carries no
camera data at all, so by the time a frame is <n>.png there may be
nothing left to read: the export it was made from is the file that still
says how it was taken. Give those files in the order they were numbered
in, after the frames are in data/photography-files.json.

What is read. Seven tags and nothing else: the maker and model (joined as
the camera), the lens model, and the exposure time, f-number, ISO and
focal length. They are looked up by tag number in the file's EXIF block
and, for a value missing there, by name in its XMP packet.

What is never read. Everything else in the block stays in the original:
the GPS position, the body and lens serial numbers, the owner's name, the
artist and copyright fields, the software that wrote the file and every
date and time. The reader asks for the tags in WANTED and skips the rest
without decoding them, and the file's schema
(data/schema/photo-exif.schema.json) refuses any other field, so a later
edit cannot publish one by accident.

Merge, never replace. Many exports dropped their camera data, and a copy
of the originals can be partial, so a frame the folder cannot speak for
keeps the entry it has: the file only gains frames and values. A frame
read again has its values refreshed field by field. Only a frame that
has left data/photography-files.json is dropped.

Where the data sits. A PNG keeps EXIF in an eXIf chunk, or (ImageMagick
and darktable) hex-encoded in a text chunk called "Raw profile type exif"
or "... APP1"; XMP is an iTXt chunk called "XML:com.adobe.xmp". Some
originals are JPEGs under a .png name, where both ride in APP1 segments,
and a TIFF is an EXIF block from its first byte. The file's first bytes
decide which, never its name. Chunks and segments are walked by their
lengths, so the pixels are never decoded and a 17 MB original costs a
few kilobytes of reading (a TIFF is read whole: its tags can sit anywhere
in it).

--check needs no folder: it fails when the file is not as this script
writes it, names a frame the gallery does not list, or holds a field or a
value outside the public set. Standard library only.
"""
from __future__ import annotations

import json
import os
import re
import struct
import sys
import zlib
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402

ROOT = sitelib.ROOT
OUT = ROOT / "data" / "photo-exif.json"
FRAMES = ROOT / "data" / "photography-files.json"
FOLDER_ENV = "KR_PHOTO_ORIGINALS"

# The fields of an entry, in the order they are written. "n" is the frame.
FIELDS = ("camera", "lens", "focal", "aperture", "shutter", "iso")
# An entry is worth keeping when it says something about the exposure;
# a camera's name alone is already on the gallery page.
EXPOSURE = ("focal", "aperture", "shutter", "iso")

# TIFF tags, by the IFD they live in. Nothing outside these is decoded.
MAKE, MODEL, EXIF_IFD = 0x010F, 0x0110, 0x8769
EXPOSURE_TIME, F_NUMBER, ISO, FOCAL_LENGTH, LENS_MODEL = 0x829A, 0x829D, 0x8827, 0x920A, 0xA434
WANTED = {
    "ifd0": {MAKE: "make", MODEL: "model", EXIF_IFD: "exif"},
    "exif": {EXPOSURE_TIME: "shutter", F_NUMBER: "aperture", ISO: "iso",
             FOCAL_LENGTH: "focal", LENS_MODEL: "lens"},
}
# The same values by their XMP names, for a file whose EXIF block lacks one.
XMP_NAMES = {
    "make": ("tiff:Make",),
    "model": ("tiff:Model",),
    "lens": ("aux:Lens", "exifEX:LensModel"),
    "focal": ("exif:FocalLength",),
    "aperture": ("exif:FNumber",),
    "shutter": ("exif:ExposureTime",),
    "iso": ("exif:ISOSpeedRatings", "exifEX:PhotographicSensitivity"),
}

# Bytes per value of each TIFF type this reads: BYTE, ASCII, SHORT, LONG,
# RATIONAL, UNDEFINED, SLONG, SRATIONAL.
TYPE_SIZE = {1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8}

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
EXIF_PREFIX = b"Exif\0\0"
XMP_PREFIX = b"http://ns.adobe.com/xap/1.0/\0"
RAW_PROFILES = (b"Raw profile type exif", b"Raw profile type APP1")

# Values outside these are a camera's "unknown" (0) or a damaged block,
# and are left out rather than published. So is an ISO of ISO_ELSEWHERE,
# the tag's largest value, which a camera writes to say the real figure
# is in a tag this does not read.
FOCAL_RANGE = (1, 2000)         # mm
APERTURE_RANGE = (0.7, 64)      # f-number
SHUTTER_RANGE = (1 / 64000, 3600)   # seconds
ISO_RANGE = (25, 409600)
ISO_ELSEWHERE = 65535
# From this long, a shutter speed is written in seconds ("0.5", "30");
# shorter, as a fraction ("1/400"), the way a camera's dial reads.
SECONDS_FROM = 0.3


# --------------------------------------------------------------------------
# finding the metadata in a file
# --------------------------------------------------------------------------

def _raw_profile(text: bytes) -> bytes:
    """The bytes of an ImageMagick "Raw profile": a name line, a length
    line, then the block in hex."""
    lines = text.decode("latin-1").split()
    try:
        return bytes.fromhex("".join(lines[2:]))
    except ValueError:
        return b""


def _sort_blob(blob: bytes, found: dict) -> None:
    """File an APP1-style block as EXIF or XMP by its prefix."""
    if blob.startswith(EXIF_PREFIX):
        found.setdefault("exif", blob[len(EXIF_PREFIX):])
    elif blob.startswith(XMP_PREFIX):
        found.setdefault("xmp", blob[len(XMP_PREFIX):].decode("utf-8", "replace"))
    elif blob[:2] in (b"II", b"MM"):
        found.setdefault("exif", blob)


def _png_blocks(f) -> dict:
    found: dict = {}
    while True:
        head = f.read(8)
        if len(head) < 8:
            break
        size, kind = struct.unpack(">I4s", head)
        if kind == b"IEND":
            break
        if kind not in (b"eXIf", b"iTXt", b"zTXt", b"tEXt"):
            f.seek(size + 4, 1)         # the data and its CRC, unread
            continue
        data = f.read(size)
        f.seek(4, 1)
        if kind == b"eXIf":
            _sort_blob(data if data.startswith(EXIF_PREFIX) else EXIF_PREFIX + data, found)
            continue
        key, _, rest = data.partition(b"\0")
        try:
            if kind == b"iTXt":
                # compression flag, method, language\0, translated keyword\0, text
                packed, rest = rest[:1] == b"\x01", rest[2:]
                rest = rest.partition(b"\0")[2].partition(b"\0")[2]
                text = zlib.decompress(rest) if packed else rest
            elif kind == b"zTXt":
                text = zlib.decompress(rest[1:])
            else:
                text = rest
        except zlib.error:
            continue
        if key == b"XML:com.adobe.xmp":
            found.setdefault("xmp", text.decode("utf-8", "replace"))
        elif key in RAW_PROFILES:
            _sort_blob(_raw_profile(text), found)
    return found


def _jpeg_blocks(f) -> dict:
    found: dict = {}
    f.seek(2)
    while True:
        byte = f.read(1)
        while byte and byte != b"\xff":
            byte = f.read(1)
        while byte == b"\xff":
            byte = f.read(1)
        if not byte:
            break
        marker = byte[0]
        if marker in (0xD9, 0xDA):      # the end, or the scan: metadata comes before it
            break
        if marker == 0x01 or 0xD0 <= marker <= 0xD8:
            continue                    # markers without a length
        size = f.read(2)
        if len(size) < 2:
            break
        length = struct.unpack(">H", size)[0] - 2
        if marker == 0xE1:
            _sort_blob(f.read(length), found)
        else:
            f.seek(length, 1)
    return found


def metadata_blocks(path: Path) -> dict:
    """{"exif": TIFF bytes, "xmp": text}, whichever the file carries. The
    container is told by the file's first bytes; anything else is {}."""
    with path.open("rb") as f:
        magic = f.read(8)
        if magic == PNG_MAGIC:
            return _png_blocks(f)
        if magic[:2] == b"\xff\xd8":
            return _jpeg_blocks(f)
        if magic[:4] in (b"II*\0", b"MM\0*"):
            f.seek(0)
            return {"exif": f.read()}
    return {}


# --------------------------------------------------------------------------
# reading the wanted values
# --------------------------------------------------------------------------

def _ifd(blob: bytes, offset: int, order: str, wanted: dict) -> dict:
    """{name: value} for the wanted tags of the IFD at `offset`. A tag not
    in `wanted` is stepped over undecoded; a truncated block gives what
    was readable."""
    out: dict = {}
    try:
        (count,) = struct.unpack_from(order + "H", blob, offset)
    except struct.error:
        return out
    for i in range(count):
        try:
            tag, kind, n, raw = struct.unpack_from(order + "HHI4s", blob, offset + 2 + 12 * i)
        except struct.error:
            break
        if tag not in wanted or kind not in TYPE_SIZE or not n:
            continue
        size = TYPE_SIZE[kind] * n
        if size > 4:
            (where,) = struct.unpack(order + "I", raw)
            raw = blob[where:where + size]
        if len(raw) < size:
            continue
        if kind == 2:
            value = raw[:size].split(b"\0", 1)[0].decode("utf-8", "replace").strip()
        elif kind in (5, 10):
            num, den = struct.unpack_from(order + ("II" if kind == 5 else "ii"), raw)
            value = num / den if den else None
        else:
            (value,) = struct.unpack_from(order + {1: "B", 3: "H", 4: "I", 7: "B", 9: "i"}[kind], raw)
        if value not in (None, ""):
            out[wanted[tag]] = value
    return out


def read_exif(blob: bytes) -> dict:
    """The wanted values of a TIFF-structured EXIF block, raw: make,
    model, lens (text); focal, aperture, shutter (numbers); iso."""
    if blob[:2] == b"II":
        order = "<"
    elif blob[:2] == b"MM":
        order = ">"
    else:
        return {}
    try:
        magic, first = struct.unpack_from(order + "HI", blob, 2)
    except struct.error:
        return {}
    if magic != 42:
        return {}
    values = _ifd(blob, first, order, WANTED["ifd0"])
    sub = values.pop("exif", None)
    if isinstance(sub, int):
        values.update(_ifd(blob, sub, order, WANTED["exif"]))
    return values


def _number(text: str):
    """An XMP number: "250", "6.3" or the rational "63/10"."""
    try:
        num, _, den = text.strip().partition("/")
        return float(num) / float(den) if den else float(num)
    except (ValueError, ZeroDivisionError):
        return None


def read_xmp(xmp: str) -> dict:
    """The same raw values from an XMP packet, where it names them, as an
    attribute (tiff:Model="...") or an element, a one-item list included."""
    out: dict = {}
    for field, names in XMP_NAMES.items():
        for name in names:
            tag = re.escape(name)
            m = (re.search(r'\b%s\s*=\s*"([^"]*)"' % tag, xmp)
                 or re.search(r"<%s>\s*(?:<rdf:\w+>\s*<rdf:li[^>]*>)?([^<]*)<" % tag, xmp))
            if not m or not m.group(1).strip():
                continue
            text = m.group(1).strip()
            value = text if field in ("make", "model", "lens") else _number(text)
            if value is not None:
                out[field] = value
                break
    return out


# --------------------------------------------------------------------------
# from raw values to an entry
# --------------------------------------------------------------------------

def _between(value, bounds):
    return isinstance(value, (int, float)) and bounds[0] <= value <= bounds[1]


def _tidy(number: float):
    """One decimal, and a whole number as an integer: 250, 6.3, 8."""
    number = round(number, 1)
    return int(number) if number == int(number) else number


def camera_name(make: str, model: str) -> str:
    """The camera as one name. Most models already open with their maker
    ("Canon EOS 60D"); one that does not ("Nexus 6") gets it in front,
    with a capital when the maker wrote itself in lower case."""
    make, model = " ".join(make.split()), " ".join(model.split())
    if not model:
        return ""
    first = make.split(" ")[0] if make else ""
    if first and first.lower() not in model.lower():
        return "%s %s" % (first.capitalize() if first.islower() else first, model)
    return model


# Canon writes a lens's mount against its focal length ("EF-S55-250mm").
MOUNT_RE = re.compile(r"^(EF-S|EF-M|EF|RF-S|RF)(?=\d)")


def lens_name(lens: str) -> str:
    """The lens model with its spaces tidied and the mount set apart, or
    "" for the row of dashes or zeros a body writes when it cannot tell."""
    lens = " ".join(lens.split())
    if not (re.search(r"[A-Za-z]", lens) and re.search(r"[1-9]", lens)):
        return ""
    return MOUNT_RE.sub(r"\1 ", lens)


def shutter_text(seconds: float) -> str:
    """A shutter speed as a camera shows it: "1/400" for a fraction of a
    second, "0.5", "2.5" or "30" from SECONDS_FROM up."""
    if seconds >= SECONDS_FROM:
        return str(_tidy(seconds))
    return "1/%d" % round(1 / seconds)


def entry_from(raw: dict) -> dict:
    """The public entry for one frame's raw values, in FIELDS order, or
    {} when nothing about the exposure survives."""
    entry: dict = {}
    camera = camera_name(str(raw.get("make") or ""), str(raw.get("model") or ""))
    if camera:
        entry["camera"] = camera
    lens = lens_name(str(raw.get("lens") or ""))
    if lens:
        entry["lens"] = lens
    if _between(raw.get("focal"), FOCAL_RANGE):
        entry["focal"] = _tidy(raw["focal"])
    if _between(raw.get("aperture"), APERTURE_RANGE):
        entry["aperture"] = _tidy(raw["aperture"])
    if _between(raw.get("shutter"), SHUTTER_RANGE):
        entry["shutter"] = shutter_text(raw["shutter"])
    if _between(raw.get("iso"), ISO_RANGE) and raw["iso"] != ISO_ELSEWHERE:
        entry["iso"] = int(raw["iso"])
    return entry if any(k in entry for k in EXPOSURE) else {}


def read_frame(path: Path) -> dict:
    """The entry for one original, or {} when it carries no camera data.
    EXIF first; XMP fills only what EXIF does not say."""
    blocks = metadata_blocks(path)
    raw = read_xmp(blocks["xmp"]) if blocks.get("xmp") else {}
    raw.update(read_exif(blocks.get("exif") or b""))
    return entry_from(raw)


# --------------------------------------------------------------------------
# the file
# --------------------------------------------------------------------------

def listed_frames() -> list[int]:
    """Every frame the gallery lists, by number."""
    names = json.loads(FRAMES.read_text(encoding="utf-8"))
    return sorted(int(Path(n).stem) for n in names if Path(n).stem.isdigit())


def load(path: Path | None = None) -> dict[int, dict]:
    """{frame: entry} from the file (OUT unless given), {} when there is
    none yet."""
    path = path or OUT
    if not path.exists():
        return {}
    frames = json.loads(path.read_text(encoding="utf-8")).get("frames", [])
    return {int(f["n"]): {k: f[k] for k in FIELDS if k in f} for f in frames}


def dump(entries: dict[int, dict]) -> str:
    """The file's text: one frame a line, by number, so a new set adds
    lines at the end and a diff shows which frames changed."""
    lines = [json.dumps({"n": n, **{k: entries[n][k] for k in FIELDS if k in entries[n]}},
                        ensure_ascii=False)
             for n in sorted(entries)]
    return '{"frames": [\n' + ",\n".join(lines) + "\n]}\n"


def merge(current: dict[int, dict], found: dict[int, dict], listed: list[int]) -> dict[int, dict]:
    """`current` with what the folder gave laid over it, field by field,
    for the frames the gallery lists (see "Merge, never replace")."""
    out = {}
    for n in listed:
        entry = {**current.get(n, {}), **found.get(n, {})}
        if entry:
            out[n] = {k: entry[k] for k in FIELDS if k in entry}
    return out


def folder_frames(folder: Path) -> list[tuple[int, Path]]:
    """(frame, file) for every file in `folder` named for a frame."""
    return [(int(path.stem), path) for path in sorted(folder.iterdir())
            if path.is_file() and path.stem.isdigit()]


def read_frames(pairs: list[tuple[int, Path]], listed: list[int]) -> tuple[dict[int, dict], list[int]]:
    """({frame: entry} for the listed frames whose file has camera data,
    the listed frames there was a file for at all). A file for a frame the
    gallery does not list is not opened."""
    found, present = {}, []
    wanted = set(listed)
    for n, path in pairs:
        if n not in wanted:
            continue
        present.append(n)
        try:
            entry = read_frame(path)
        except OSError as exc:
            print("skip %s: %s" % (path.name, exc))
            continue
        if entry:
            found[n] = entry
    return found, sorted(set(present))


def problems(text: str, listed: list[int]) -> list[str]:
    """What is wrong with the file's text, as printable lines: a frame the
    gallery does not list, an entry with nothing about the exposure, or
    text that is not what dump() writes (a field outside FIELDS, frames
    out of order, a hand edit). The values' own shapes are the schema's
    to hold (validate_data.py)."""
    try:
        frames = json.loads(text)["frames"]
        entries = {int(f["n"]): {k: f[k] for k in FIELDS if k in f} for f in frames}
    except (ValueError, KeyError, TypeError) as exc:
        return ["data/photo-exif.json cannot be read: %r" % exc]
    out = []
    unlisted = sorted(set(entries) - set(listed))
    if unlisted:
        out.append("%d frame(s) the gallery does not list: %s"
                   % (len(unlisted), ", ".join(map(str, unlisted[:8]))))
    bare = sorted(n for n, e in entries.items() if not any(k in e for k in EXPOSURE))
    if bare:
        out.append("%d frame(s) with nothing about the exposure: %s"
                   % (len(bare), ", ".join(map(str, bare[:8]))))
    if text.replace("\r\n", "\n") != dump(entries):
        out.append("data/photo-exif.json is not as the generator writes it "
                   "(a field it does not write, frames out of order, or a hand edit)")
    return out


def main(argv=None):
    parser = sitelib.arg_parser(__doc__)
    parser.add_argument("sources", nargs="*", type=Path, metavar="folder",
                        help="where the originals are kept as <n>.png (default: the %s "
                             "environment variable); with --first, the files themselves" % FOLDER_ENV)
    parser.add_argument("--first", type=int, metavar="N",
                        help="the sources are files, in the order they were numbered: "
                             "the first is frame N, the next N+1, and so on")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--report", action="store_true",
                      help="say what the sources would add; write nothing")
    mode.add_argument("--check", action="store_true",
                      help="exit 1 if the file on disk is not as this script writes it; "
                           "needs no folder")
    args = parser.parse_args(argv)
    listed = listed_frames()

    if args.check:
        if not OUT.exists():
            print("data/photo-exif.json is missing")
            return 1
        with open(OUT, encoding="utf-8", newline="") as fh:
            found = problems(fh.read(), listed)
        for line in found:
            print(line)
        if found:
            return 1
        print("data/photo-exif.json: %d of %d frames, public fields only."
              % (len(load()), len(listed)))
        return 0

    if args.first is not None:
        if not args.sources:
            parser.error("--first needs the files, in the order they were numbered")
        pairs = [(args.first + i, path) for i, path in enumerate(args.sources)]
        missing = [str(path) for _n, path in pairs if not path.is_file()]
        unlisted = [n for n, _path in pairs if n not in listed]
        if missing:
            parser.error("not a file: %s" % ", ".join(missing))
        if unlisted:
            parser.error("frame %s is not in data/photography-files.json yet: list the "
                         "frames first, then run this" % ", ".join(map(str, unlisted)))
    else:
        if len(args.sources) > 1:
            parser.error("one folder, or --first N and the files of a set")
        folder = (args.sources[0] if args.sources
                  else Path(os.environ[FOLDER_ENV]) if os.environ.get(FOLDER_ENV) else None)
        if folder is None:
            parser.error("name the folder of originals, or set %s" % FOLDER_ENV)
        if not folder.is_dir():
            parser.error("%s is not a folder" % folder)
        pairs = folder_frames(folder)

    current = load()
    found, present = read_frames(pairs, listed)
    merged = merge(current, found, listed)
    kept = sorted(n for n in merged if n not in found)
    new = sorted(n for n in found if n not in current)
    changed = sorted(n for n in found if n in current and merged[n] != current[n])
    print("%d listed frames; the sources hold %d of them, %d with camera data."
          % (len(listed), len(present), len(found)))
    print("new %d, refreshed %d, kept from the file %d, dropped %d."
          % (len(new), len(changed), len(kept), len(set(current) - set(merged))))
    print("coverage: %d of %d frames (%.0f%%)."
          % (len(merged), len(listed), 100 * len(merged) / max(1, len(listed))))
    if args.report:
        return 0

    text = dump(merged)
    # The working copy's own line endings, LF for a new file.
    if OUT.exists() and b"\r\n" in OUT.read_bytes():
        text = text.replace("\n", "\r\n")
    with open(OUT, "w", encoding="utf-8", newline="") as fh:
        fh.write(text)
    print("Wrote data/%s" % OUT.name)
    return 0


if __name__ == "__main__":
    sys.exit(main())
