"""
Refresh data/books.json from a Goodreads library export.

Goodreads retired its RSS feeds in October 2026 (every account's
/review/list_rss/ address answers 404), so nothing fetches the shelf on
a schedule any more. Instead I download my library export (Goodreads, My
Books, Import and export) and run:

    python .github/scripts/refresh_books.py --export goodreads_library_export.csv
    python .github/scripts/refresh_books.py --export FILE --dry-run   # report, write nothing
    python .github/scripts/refresh_books.py --covers    # no export: only fetch the covers still missing

The export can be the plain one or one enhanced with
Enhance-GoodReads-Export: its extra read_dates column adds every finish
of a re-read, and its genres column feeds refresh_book_details.py.
Nothing private in it (the review text, private notes, owned copies,
other shelves) is read into any file: export_items() keeps the public
fields and nothing else.

One run does what the weekly refresh used to:

  1. merges the export's finished books into books.json (merge),
  2. finds a cover for each book it brings (Open Library: by ISBN, then
     title and author) and keeps the site's copies (keep_covers),
  3. writes books.json and reading.json (the homepage figures),
  4. gives every new book its first year and genres
     (refresh_book_details.refresh, with the same export),
  5. writes now.json's books in progress from the currently-reading
     shelf, through refresh_now.write_reading().

Record fields (data/schema/books.schema.json has the full descriptions):

    t  title                  a  author
    r  my rating (0 unrated)  i  ISBN, when Goodreads has one
    g  Goodreads book id      v  1 when I wrote a review
    w  Goodreads review id (goodreads.com/review/show/<w>), kept from the
       RSS years; the export has none, so a book added since has no w
    d  date last finished, or the date added when Goodreads has no date
    e  1 when d is only the date added (the calendar leaves it out)
    p  earlier finish dates, oldest first
    rc times read, when Goodreads counts more reads than d and p date
    n  pages                  y  the year first published
    gn genres (refresh_book_details.py)
    c  where the cover the site keeps was downloaded from: a path under
       GR_COVERS (the RSS years) or an Open Library cover address
    k  1 when the site has its own copy of that cover, for the pages
       to show; s the same for the small copy (see "Covers" below)

Stages, so the rules can be tested without a network:

    read_export(path)                  the CSV's rows, or ExportError
    export_items(rows)                 pure: the finished books, the books in progress
    merge(old_books, items, reading)   pure: the new books.json list
    summarise(books, today)            pure: the reading.json figures
    add_cover_sources(books, find)     the network: c for a book with none
    keep_covers(books)                 the network and img/: a copy of each new cover

Why history must never be lost. Goodreads keeps every reading session,
but the plain export gives one date a book (its "Date Read", which is the
first finish for most re-reads), and only the enhanced export lists them
all. So `p`, a book's earlier finishes, exists for most books nowhere but
in this file: merge() takes the union of the dates on file and the dates
in the export, and never drops one while the book is on file.

Merge rules (merge):

  1. A finished book is a row on the read shelf, or on currently-reading
     with a finish date (a re-read in progress). It is matched to the
     record on file by Goodreads book id, and failing that by title and
     author (an edition change gives a book a new id); a matched record
     keeps its own id, which names its cover files.
  2. The export wins for what I edit on Goodreads: the rating, whether
     there is a review. The record wins for the title and author (their
     spelling is what posts.json's shelf lists and the quotes match), the
     ISBN, the year, the genres, the cover and the review id; a new book
     takes the export's, cleaned (clean_text).
  3. Finishes: every date on file and every date in the export. The
     latest is d, the rest p. The export's Read Count, when it says more
     reads than that, is rc. No date anywhere: the date on file, or the
     date added, with e.
  4. A record the export no longer has as finished is kept when the book
     is on the currently-reading shelf (a re-read in progress), and
     otherwise dropped, its whole record printed, so a removal made in
     error can be put back from the run's output.

Guards (main): a file without the export's columns, an export with fewer
finished books than MIN_EXPORT_SHARE of those on file (the wrong file, or
one cut short), or a merge that loses an earlier finish date writes
nothing and exits 1.

Covers (keep_covers). The reading pages show each book's cover from the
site itself, so showing a book asks no other site for anything. The site
keeps two copies of each, both downloaded once from the address `c`
names, and a mark on the record for each:

    k  img/covers/shelf/<g>.jpg     COVER_HEIGHT tall: a review card,
                                    the slideshow's featured book
    s  img/covers/shelf/s/<g>.jpg   COVER_SMALL_HEIGHT tall: a tile on
                                    the wall, a thumbnail

`c` is a Goodreads path for the books the RSS brought, and Goodreads
resizes those for a size in the file name; for a book an export brings
it is Open Library's cover (add_cover_sources), whose large size is the
full copy and medium the small one (cover_source). A book Open Library
has no cover for has no `c` and no marks, and the pages set its cover in
type; the run names it. Goodreads' own pages are never scraped.

The pages ask only for the files a record's marks name, so a file that
is not there is never requested. Each use takes the copy that suits its
size and the other when that one is missing; a book with neither falls
back to Open Library's cover for its ISBN, then to a cover set in type
(coverAttrs in js/bookshelf.js).

  1. Only a missing copy is fetched: one whose mark is absent, or whose
     file is.
  2. What arrives is kept only if it is a JPEG of a sensible size
     (COVER_MAX_BYTES). Goodreads' answers are kept as they came. Open
     Library's come in fixed sizes taller than the site's copies, and
     about twice their weight, so one taller than asked for is shrunk to
     the height and saved again (fit_cover, with Pillow; without it, or
     for a file Pillow cannot read, it is kept as it came). An answer
     that redirects to Goodreads' "nophoto" placeholder is refused. A
     heavy Goodreads
     answer (COVER_HEAVY) is an upload passed through untouched; asked
     for a pixel shorter it comes back compressed, and the lighter of
     the two is kept (lighten).
  3. A copy that cannot be fetched is a warning, never a failure: the
     record goes without its mark and the next run tries again. After
     COVER_GIVE_UP failures in a row the rest wait for the next run, so a
     host that is down cannot hold the run up.
  4. Nothing is deleted. A book that leaves the shelf leaves its files
     behind; they are a few kilobytes, and a re-read brings the book
     back.

`--covers` runs this stage alone over the books.json on file: it is how
to fetch again after deleting a file by hand. It writes the marks every
COVER_SAVE_EVERY files, so a run that is cut short keeps what it fetched
and the next one starts where it stopped.

reading_cover() is the same store for a book in progress that is not on
file, so Reading Now shows the site's small copies too.
"""
from __future__ import annotations

import csv
import io
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402
from generate_photo_dims import image_size  # noqa: E402  (a JPEG's height from its header)

ROOT = sitelib.ROOT
BOOKS = ROOT / "data" / "books.json"
SUMMARY = ROOT / "data" / "reading.json"

# Below this share of the books on file, an export is the wrong file or
# one cut short, not a cull: nothing is written.
MIN_EXPORT_SHARE = 0.9

# The columns every Goodreads library export has and merge() needs. The
# enhanced export adds read_dates and genres, read where present.
EXPORT_COLUMNS = ("Book Id", "Title", "Author", "My Rating", "Exclusive Shelf",
                  "Date Read", "Date Added", "Read Count")

# Goodreads' covers all sit under this address; books.json keeps the rest
# of each (c), and cover_source() puts it back to download the site's own
# copy. Open Library's sit under OL_COVERS, kept whole.
GR_COVERS = "https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/"
OL_COVERS = "https://covers.openlibrary.org/b/"
# A book's Open Library cover, by the cover id its search result gives:
# the large size (about 500px tall); cover_source() asks for the medium
# one (about 270px) for the small copy.
OL_COVER = OL_COVERS + "id/%d-L.jpg"

# The site's copies: JPEGs named for the Goodreads book id. The full one
# is in this folder, the small one in s/ under it;
# SITE_COVERS is the folder as a page asks for it.
COVERS = ROOT / "img" / "covers" / "shelf"
SITE_COVERS = "/img/covers/shelf/"
# The full copy's height: a review card (220px tall) and the slideshow's
# featured book (up to 520px tall). 400 is sharp on a high-density screen
# for the first and close to the 475 Goodreads' own pages use for the
# second, at about 24 KB a cover where 475 is about 33 KB.
COVER_HEIGHT = 400
# The small copy's: a tile on the wall of books.html (about 100px wide),
# on the slideshow's wall, and a Reading Now thumbnail. About 10 KB a
# cover: a screenful of tiles is hundreds of them, and at the full
# copy's size the wall asked for 5 MB before anyone scrolled.
COVER_SMALL_HEIGHT = 240
# A Goodreads cover no taller than the height asked for comes back as it
# was uploaded, and some uploads are heavy: 185 KB for one 400px cover,
# where its neighbours are 24 KB. An answer over this is asked for again
# one pixel shorter than itself, which makes Goodreads compress it like
# the rest (that one came to 31 KB), and the lighter of the two is kept
# (lighten). It keeps one book from costing a page seven covers' worth.
COVER_HEAVY = 60_000
# A cover taller than the height asked for (Open Library's: about 500px
# for the full copy, 270 for the small) is shrunk to it and saved at
# this JPEG quality, which brings it to the weight of the shelf's
# Goodreads copies, about 24 KB and 10 KB (fit_cover).
COVER_QUALITY = 82
# Never kept, lightened or not: several times the heaviest cover the
# shelf has needed, so nothing that is not a cover-sized picture can
# reach the repository.
COVER_MAX_BYTES = 300_000
# Says what is asking and nothing about who.
COVER_UA = "Mozilla/5.0 (compatible; book-cover-fetch)"
COVER_TIMEOUT = 20          # seconds for one answer
COVER_TRIES = 3             # attempts at one cover, a longer wait before each
COVER_PAUSE = 0.3           # seconds between two downloads
COVER_GIVE_UP = 5           # failures in a row before the rest wait for the next run
COVER_SAVE_EVERY = 25       # files between two writes of the marks (--covers)


class ExportError(RuntimeError):
    """The file is not a Goodreads library export this script can read."""


def clean_text(raw: str) -> str:
    """House style is straight quotes; Goodreads uses curly ones.

    U+FFFD, the replacement character, is mapped to an apostrophe too.
    It marks a character some decoder upstream could not read, so the
    original is gone and there is nothing to decode. The guess is the
    apostrophe because that is the likeliest casualty in an English title
    (the curly one is byte 0x92 in Windows-1252, the byte most often
    mis-read), and a wrong guess shows as a stray apostrophe on the shelf
    where leaving it would show the replacement glyph. Runs of spaces,
    which the export has in many authors' names, become one.
    """
    t = (raw or "").strip()
    for a, b in (("‘", "'"), ("’", "'"), ("�", "'"),
                 ("“", '"'), ("”", '"')):
        t = t.replace(a, b)
    return " ".join(t.split())


# --- the export (pure) -------------------------------------------------------

def read_export(path: Path) -> list[dict]:
    """The rows of a Goodreads library export, as dicts by column name.
    ExportError for a file that is not one."""
    try:
        with open(path, encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f)
            missing = [c for c in EXPORT_COLUMNS if c not in (reader.fieldnames or [])]
            if missing:
                raise ExportError("%s has no %s column: is it a Goodreads library export?"
                                  % (Path(path).name, ", ".join(missing)))
            return list(reader)
    except (OSError, UnicodeDecodeError, csv.Error) as e:
        raise ExportError("%s: %s" % (Path(path).name, e)) from e


def cell(row: dict, column: str) -> str:
    """A cell without the export's spreadsheet wrapping: the ISBN columns
    hold ="0441013597" so a spreadsheet keeps the leading zero."""
    v = str(row.get(column) or "").strip()
    m = re.fullmatch(r'="(.*)"', v)
    return (m.group(1) if m else v).strip()


def export_number(value) -> int | None:
    """'765', '765.0' -> 765; '', '0' or anything else -> None."""
    m = re.fullmatch(r"(\d+)(\.0+)?", str(value or "").strip())
    n = int(m.group(1)) if m else 0
    return n if n > 0 else None


def export_date(value) -> str:
    """'2026/10/24' or '2026-10-24' -> '2026/10/24'; anything else -> ''."""
    m = re.fullmatch(r"(\d{4})[/-](\d{2})[/-](\d{2})", str(value or "").strip())
    return "%s/%s/%s" % m.groups() if m else ""


def export_isbn(row: dict) -> str:
    for column in ("ISBN13", "ISBN"):
        isbn = cell(row, column).upper()
        if re.fullmatch(r"[0-9]{9}[0-9X]([0-9]{3})?", isbn):
            return isbn
    return ""


def export_finishes(row: dict) -> list[str]:
    """Every finish date a row gives: Date Read, and in an enhanced
    export each session's end in read_dates ('start,end;start,end')."""
    dates = {export_date(row.get("Date Read"))}
    for session in str(row.get("read_dates") or "").split(";"):
        dates.add(export_date(session.split(",")[-1]))
    dates.discard("")
    return sorted(dates)


def export_item(row: dict) -> dict:
    """One row as merge() reads it: the public fields, nothing else. The
    review is a yes or no here; its text, the private notes, the owned
    copies and the other shelves never leave the row."""
    year = export_number(row.get("Original Publication Year")) or export_number(row.get("Year Published"))
    return {
        "g": cell(row, "Book Id"),
        "t": clean_text(row.get("Title")),
        "a": clean_text(row.get("Author")),
        "r": min(int(float(cell(row, "My Rating") or 0)), 5),
        "v": bool(str(row.get("My Review") or "").strip()),
        "i": export_isbn(row),
        "n": export_number(row.get("Number of Pages")),
        "y": year if year and year <= 9999 else None,
        "finishes": export_finishes(row),
        "added": export_date(row.get("Date Added")),
        "count": export_number(row.get("Read Count")) or 0,
        "shelf": cell(row, "Exclusive Shelf"),
    }


def export_items(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    """(finished, in progress): the books merge() puts on the shelf (the
    read shelf, and a book being read again that has a finish date), and
    every book on the currently-reading shelf, in the export's order (the
    most recently touched first)."""
    finished, reading = [], []
    for row in rows:
        item = export_item(row)
        if not re.fullmatch(r"[0-9]+", item["g"]) or not item["t"]:
            continue
        if item["shelf"] == "currently-reading":
            reading.append(item)
        if item["shelf"] == "read" or (item["shelf"] == "currently-reading" and item["finishes"]):
            finished.append(item)
    return finished, reading


# --- the rules (pure) --------------------------------------------------------

def book_key(title: str, author: str) -> str:
    """A title and author as one key, to find a book whose id changed:
    lower case, without accents, spaces or punctuation."""
    s = unicodedata.normalize("NFKD", "%s|%s" % (title or "", author or ""))
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9|]+", "", s)


def sessions(b: dict) -> list[str]:
    """Every finish date a record stands for: d (unless only the date
    added) and each earlier one."""
    out = [] if b.get("e") else [b["d"]]
    return out + list(b.get("p") or [])


def merge_one(prev: dict, item: dict) -> dict:
    """One record from an export item and the record on file ({} if new)."""
    b = {"t": prev.get("t") or item["t"], "a": prev.get("a") or item["a"], "r": item["r"]}
    if item["v"]:
        b["v"] = 1
    isbn = prev.get("i") or item["i"]
    if isbn:
        b["i"] = isbn
    b["g"] = prev.get("g") or item["g"]
    if prev.get("c"):
        b["c"] = prev["c"]
        for mark in COVER_MARKS:
            if prev.get(mark):
                b[mark] = 1
    n = item["n"] or prev.get("n")
    if n:
        b["n"] = n
    y = prev.get("y") or item["y"]
    if y:
        b["y"] = y
    if prev.get("gn"):
        b["gn"] = list(prev["gn"])
    if prev.get("w"):
        b["w"] = prev["w"]

    dates = set(prev.get("p") or [])
    if prev.get("d") and not prev.get("e"):
        dates.add(prev["d"])
    dates.update(item["finishes"])
    if dates:
        b["d"] = max(dates)
        dates.discard(b["d"])
        if dates:
            b["p"] = sorted(dates)
    else:
        b["d"] = prev.get("d") or item["added"]
        b["e"] = 1
    if item["count"] >= 2 and item["count"] > len(sessions(b)):
        b["rc"] = item["count"]
    return b


def merge(old_books: list[dict], items: list[dict], reading: list[dict] = ()) -> tuple[list[dict], list[dict]]:
    """(the new books.json list, the records it drops) from the list on
    file, an export's finished books and its books in progress.

    Pure: no network, no clock, no files. See the module docstring for
    the rules; the short version is that an export can add and correct,
    and a record goes only when Goodreads no longer has the book as read.
    """
    by_g = {b["g"]: b for b in old_books if b.get("g")}
    by_key = {}
    for b in old_books:
        by_key.setdefault(book_key(b.get("t"), b.get("a")), b)
    matched: set[int] = set()
    seen: set[str] = set()
    books = []
    for item in items:
        if item["g"] in seen:
            continue  # listed twice in one export: the first wins
        seen.add(item["g"])
        prev = by_g.get(item["g"]) or by_key.get(book_key(item["t"], item["a"])) or {}
        if prev and id(prev) in matched:
            prev = {}  # one record's history is never handed to two books
        if prev:
            matched.add(id(prev))
        books.append(merge_one(prev, item))

    in_progress = {r["g"] for r in reading}
    dropped = []
    for b in old_books:
        if id(b) in matched:
            continue
        if b.get("g") in in_progress:
            books.append(dict(b))
        else:
            dropped.append(b)

    # Stable, so books finished the same day keep the export's order.
    books.sort(key=lambda b: b["d"], reverse=True)
    return books, dropped


def summarise(books: list[dict], today: date) -> dict:
    """reading.json: the figures the homepage shows, for `today`'s year."""
    year = "%04d" % today.year
    return {
        "books": len(books),
        "reviews": sum(1 for b in books if b.get("v")),
        "thisYear": sum(1 for b in books for d in sessions(b) if d.startswith(year)),
        "rereads": sum(len(b.get("p") or []) for b in books),
        "updated": today.isoformat(),
    }


def lost_history(old_books: list[dict], books: list[dict]) -> list[str]:
    """Earlier finish dates on file that the new list no longer has, for
    books it still has. merge() is built never to produce one; this is
    the guard that proves it on every run before anything is written."""
    new_g = {b["g"]: b for b in books if b.get("g")}
    out = []
    for b in old_books:
        nb = new_g.get(b.get("g"))
        if nb is None:
            continue  # dropped: main() prints it
        kept = set(sessions(nb)) | set(nb.get("p") or [])
        for d in sessions(b):
            if d not in kept:
                out.append("%s (%s): %s" % (b.get("t"), b.get("g"), d))
    return out


def changes(old_books: list[dict], books: list[dict]) -> list[str]:
    """What a run changed, in lines for the log: books added, ratings
    changed, finishes added."""
    old = {b["g"]: b for b in old_books if b.get("g")}
    out = []
    for b in books:
        was = old.get(b["g"])
        if was is None:
            out.append("added: %s by %s, %s/5, finished %s" % (b["t"], b["a"], b["r"], "never dated" if b.get("e") else b["d"]))
            continue
        if was.get("r") != b["r"]:
            out.append("rating: %s, %s -> %s" % (b["t"], was.get("r"), b["r"]))
        new_dates = sorted(set(sessions(b)) - set(sessions(was)))
        if new_dates:
            out.append("finished again: %s, %s" % (b["t"], ", ".join(new_dates)))
    return out


# --- covers ------------------------------------------------------------------

# A record's marks, in the order they are written: the full copy, the small.
COVER_MARKS = ("k", "s")


class CoverError(RuntimeError):
    """One cover could not be fetched, or what came back is not one."""


def cover_source(c: str, height: int = COVER_HEIGHT) -> str:
    """Where the site's copy of cover `c` comes from at `height`.

    A Goodreads path: Goodreads' address with the size in the file name,
    in place of the one `c` has or before the extension of a name with
    none. An Open Library cover: its large size for the full copy, its
    medium one for the small, and a 404 rather than a blank placeholder
    when there is none (default=false). Any other address: as it is."""
    if c.startswith(OL_COVERS):
        size = "M" if height <= COVER_SMALL_HEIGHT else "L"
        return re.sub(r"-[SML]\.jpg$", "-%s.jpg" % size, c.split("?")[0]) + "?default=false"
    if c.startswith("https://"):
        return c
    size = "._SY%d_." % height
    return GR_COVERS + re.sub(r"(\._S[XY]\d+_)?\.(\w+)$", lambda m: size + m.group(2), c)


def cover_file(g, mark: str = "k") -> Path | None:
    """The file a mark stands for, for a Goodreads book id: the full copy
    img/covers/shelf/<g>.jpg (k) or the small img/covers/shelf/s/<g>.jpg
    (s). None for anything that is not an id, so nothing else can name a
    path."""
    if not (isinstance(g, str) and re.fullmatch(r"[0-9]+", g)):
        return None
    return (COVERS / "s" if mark == "s" else COVERS) / (g + ".jpg")


def cover_height(mark: str) -> int:
    return COVER_SMALL_HEIGHT if mark == "s" else COVER_HEIGHT


def fetch_cover(url: str, sleep=time.sleep) -> bytes:
    """What `url` answers with, or CoverError.

    Up to COVER_TRIES attempts, with a longer wait before each, at an
    answer that may differ next time: a timeout, a dropped connection, a
    server error, a 429. Any other refusal (a 404, a 403) is believed at
    once. No more than a byte over COVER_MAX_BYTES is read.
    """
    why = "no answer"
    for attempt in range(COVER_TRIES):
        if attempt:
            sleep(2 ** attempt)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": COVER_UA})
            with urllib.request.urlopen(req, timeout=COVER_TIMEOUT) as r:
                if "nophoto" in r.geturl():
                    raise CoverError("Goodreads answered with its placeholder")
                return r.read(COVER_MAX_BYTES + 1)
        except CoverError:
            raise
        except urllib.error.HTTPError as e:
            why = "HTTP %d" % e.code
            if e.code < 500 and e.code != 429:
                break
        except Exception as e:  # noqa: BLE001 - a timeout, a reset, a short read
            why = "%s: %s" % (type(e).__name__, e)
    raise CoverError(why)


def check_cover(data: bytes) -> None:
    """CoverError unless `data` is a JPEG small enough to keep: the file
    is served as it arrived, under a .jpg name."""
    if data[:3] != b"\xff\xd8\xff":
        raise CoverError("not a JPEG")
    if len(data) > COVER_MAX_BYTES:
        raise CoverError("larger than %d bytes" % COVER_MAX_BYTES)


def write_whole(path: Path, data: bytes) -> None:
    """Write `path` so that it is never seen half written: beside it
    first, then moved into place. A run stopped at the wrong moment
    leaves the old file or the new one, which matters for books.json (a
    --covers run writes it many times) and for a cover reading_cover()
    will take on trust. Where the move is refused (Windows, while another
    program has the file open) it is written in place."""
    path.parent.mkdir(parents=True, exist_ok=True)
    part = path.with_name(path.name + ".part")
    part.write_bytes(data)
    try:
        os.replace(part, path)
    except OSError:
        path.write_bytes(data)
        part.unlink(missing_ok=True)


def lighten(c: str, path: Path, fetch) -> None:
    """Swap a heavy Goodreads cover file for a lighter answer, when there
    is one (COVER_HEAVY): the same cover asked for one pixel shorter than
    the file is. Whatever goes wrong the file stays, since a heavy cover
    is still the cover."""
    if c.startswith("https://"):
        return  # not Goodreads': there is no other size to ask for
    try:
        data = fetch(cover_source(c, image_size(path)[1] - 1))
        check_cover(data)
    except Exception:  # noqa: BLE001 - no height in the header, or no answer
        return
    if len(data) < path.stat().st_size:
        write_whole(path, data)


def fit_cover(data: bytes, height: int) -> bytes:
    """JPEG `data` no taller than `height`: shrunk to it, its width in
    proportion, and saved again at COVER_QUALITY. `data` as it came when
    it is no taller, when Pillow is not installed, or when Pillow cannot
    read it: a cover a little heavy is still the cover."""
    try:
        from PIL import Image
    except ImportError:
        return data
    try:
        with Image.open(io.BytesIO(data)) as im:
            if im.height <= height:
                return data
            width = max(1, round(im.width * height / im.height))
            small = im.convert("RGB").resize((width, height), Image.LANCZOS)
        out = io.BytesIO()
        small.save(out, "JPEG", quality=COVER_QUALITY, optimize=True, progressive=True)
        return out.getvalue()
    except Exception:  # noqa: BLE001 - not a picture Pillow can read
        return data


def save_cover(c: str, path: Path, height: int, fetch) -> None:
    """Download cover `c` at `height` to `path`, shrunk to `height` when
    it came taller (fit_cover), or raise CoverError or OSError and leave
    `path` as it was."""
    data = fetch(cover_source(c, height))
    check_cover(data)
    data = fit_cover(data, height)
    write_whole(path, data)
    if len(data) > COVER_HEAVY:
        lighten(c, path, fetch)


def has_cover(b: dict, mark: str = "k") -> bool:
    """True when the record has the mark and the mark's file is on disk."""
    path = cover_file(b.get("g"), mark)
    return bool(b.get("c") and b.get(mark) and path and path.is_file())


def wants_cover(b: dict, mark: str = "k") -> bool:
    """True when keep_covers() would fetch this copy for the record."""
    return bool(b.get("c") and cover_file(b.get("g"), mark) and not has_cover(b, mark))


def covers_wanted(books: list[dict]) -> int:
    """How many files keep_covers() would fetch."""
    return sum(wants_cover(b, mark) for b in books for mark in COVER_MARKS)


def with_cover_marks(b: dict, kept: dict) -> dict:
    """`b` with each mark set or gone, as `kept` says. The marks sit
    after `c`, where merge_one() puts them, so a record reads the same
    whichever of the two wrote it."""
    out = {}
    for key, value in b.items():
        if key in COVER_MARKS:
            continue
        out[key] = value
        if key == "c":
            out.update((mark, 1) for mark in COVER_MARKS if kept.get(mark))
    return out


def keep_covers(books: list[dict], fetch=None, sleep=time.sleep, save=None):
    """Fetch the copies of each cover the site lacks, and mark the records.

    Returns (books, fetched, problems): each record with a mark when, and
    only when, that mark's file is on disk as a copy of `c`; how many
    files were written; and a line for each that could not be had. It
    never raises for a cover: see "Covers" in the module docstring.

    `save`, when given, is called with the whole list as it stands every
    COVER_SAVE_EVERY files (the records still to come as they came), so a
    run that is stopped has its marks on file up to the last call.
    """
    fetch = fetch or fetch_cover
    # What a run stopped in the middle of a write left beside a cover
    # (write_whole): the folder is committed whole.
    for part in COVERS.rglob("*.part"):
        part.unlink(missing_ok=True)
    out, fetched, problems = [], 0, []
    failed_in_a_row = left = unsaved = 0
    for b in books:
        kept = {}
        for mark in COVER_MARKS:
            kept[mark] = has_cover(b, mark)
            if not wants_cover(b, mark):
                continue
            if failed_in_a_row >= COVER_GIVE_UP:
                left += 1
                continue
            if fetched or problems:
                sleep(COVER_PAUSE)
            try:
                save_cover(b["c"], cover_file(b["g"], mark), cover_height(mark), fetch)
                kept[mark], fetched, failed_in_a_row, unsaved = True, fetched + 1, 0, unsaved + 1
            except (CoverError, OSError) as e:
                failed_in_a_row += 1
                problems.append("%s (%s, %dpx): %s" % (b.get("t"), b.get("g"), cover_height(mark), e))
        out.append(with_cover_marks(b, kept))
        if save and unsaved >= COVER_SAVE_EVERY:
            save(out + books[len(out):])
            unsaved = 0
    if left:
        problems.append("%d more left for the next run, after %d failures in a row"
                        % (left, COVER_GIVE_UP))
    return out, fetched, problems


def find_cover(b: dict, fetch=None, sleep=time.sleep) -> str:
    """Open Library's cover for book `b` as a `c`: by ISBN first, then by
    title and author (refresh_book_details.find_doc, the search the year
    and genres come from), or '' when neither finds one with a cover.
    Raises refresh_book_details.AskError when Open Library could not be
    asked."""
    import refresh_book_details  # noqa: PLC0415  (it imports this module)
    doc = refresh_book_details.find_doc(b, fetch=fetch, sleep=sleep,
                                        want=lambda d: isinstance(d.get("cover_i"), int) and d["cover_i"] > 0)
    return OL_COVER % doc["cover_i"] if doc else ""


def add_cover_sources(books: list[dict], find=None, sleep=time.sleep):
    """Each record with no `c` (a book an export brought) with Open
    Library's cover as its `c`, where there is one. Returns (books, found,
    missing): missing names the books left without, which the pages set
    in type; a failed search is one of them, and the next run asks
    again."""
    find = find or find_cover
    out, found, missing = [], 0, []
    asked = 0
    for b in books:
        if b.get("c") or not cover_file(b.get("g"), "k"):
            out.append(b)
            continue
        if asked:
            sleep(COVER_PAUSE)
        asked += 1
        try:
            c = find(b)
        except Exception as e:  # noqa: BLE001 - a cover never costs the run
            c, why = "", "%s: %s" % (type(e).__name__, e)
        else:
            why = "Open Library has no cover for it"
        if c:
            found += 1
            out.append(_with_c(b, c))
        else:
            missing.append("%s (%s): %s; set in type" % (b.get("t"), b.get("g"), why))
            out.append(b)
    return out, found, missing


def _with_c(b: dict, c: str) -> dict:
    """`b` with cover `c`, where merge_one() puts it: after the id."""
    out = {}
    for key, value in b.items():
        if key == "c":
            continue
        out[key] = value
        if key == "g":
            out["c"] = c
    return out


def reading_cover(g: str, record: dict | None, b: dict, find=None, fetch=None) -> str:
    """The site's small copy of the cover of a book in progress, as the
    path a page asks for it by (SITE_COVERS + "s/<g>.jpg"), or ''.

    The shelf's own copy when the book is on file with one; a copy kept
    before (the file is taken on trust); else Open Library's cover,
    fetched now. `record` is the book on file, `b` the export's item."""
    path = cover_file(g, "s")
    if path is None:
        return ""
    if path.is_file():
        return SITE_COVERS + "s/" + path.name
    c = (record or {}).get("c")
    try:
        c = c or (find or find_cover)(b)
        if not c:
            return ""
        save_cover(c, path, COVER_SMALL_HEIGHT, fetch or fetch_cover)
    except Exception:  # noqa: BLE001 - the book is listed without a cover
        return ""
    return SITE_COVERS + "s/" + path.name


def report_covers(books: list[dict], fetched: int, problems: list[str]) -> None:
    for line in problems:
        print("::warning::cover not fetched: " + line)
    print("covers: of %d books, %d have the full copy on the site and %d the small one (%d files fetched)"
          % (len(books), sum(1 for b in books if b.get("k")), sum(1 for b in books if b.get("s")), fetched))


def dump_books(books: list[dict]) -> str:
    """books.json's text: one line, no spaces, the titles as they are."""
    return json.dumps(books, ensure_ascii=False, separators=(",", ":")) + "\n"


def write_books(books: list[dict]) -> None:
    write_whole(BOOKS, dump_books(books).encode("utf-8"))


# --- the books in progress --------------------------------------------------------

def reading_list(reading: list[dict], books: list[dict], find=None, fetch=None) -> list[dict]:
    """now.json's books in progress from the export's currently-reading
    shelf (refresh_now.reading_entry gives each its shape): my review
    page when the book is on file with one, else the book's page, and the
    site's small copy of its cover."""
    import refresh_now  # noqa: PLC0415  (it imports this module)
    on_file = {b["g"]: b for b in books if b.get("g")}
    out = []
    for item in reading[:refresh_now.READING_LIMIT]:
        record = on_file.get(item["g"])
        link = ("https://www.goodreads.com/review/show/%s" % record["w"] if record and record.get("w")
                else "https://www.goodreads.com/book/show/%s" % item["g"])
        img = reading_cover(item["g"], record, item, find=find, fetch=fetch)
        if not img:
            print("::warning::no cover for %s (%s), in progress; set in type" % (item["t"], item["g"]))
        out.append(refresh_now.reading_entry(item["t"], item["a"], link, img))
    return out


# --- entry point -----------------------------------------------------------

def covers_main(dry_run: bool) -> int:
    old = json.loads(BOOKS.read_text(encoding="utf-8")) if BOOKS.exists() else []
    if dry_run:
        print("dry run: %d cover files to fetch for %d books" % (covers_wanted(old), len(old)))
        return 0
    if not old:
        return 0
    # The marks go to the file as the run goes, so one that is cut short
    # is not fetched over again. Only the marks can change, and
    # reading.json has none.
    books, fetched, problems = keep_covers(old, save=write_books)
    report_covers(books, fetched, problems)
    if dump_books(books) != BOOKS.read_text(encoding="utf-8"):
        write_books(books)
    return 0


def export_main(path: Path, dry_run: bool) -> int:
    try:
        rows = read_export(path)
    except ExportError as e:
        print("::error::%s; writing nothing" % e)
        return 1
    old = json.loads(BOOKS.read_text(encoding="utf-8")) if BOOKS.exists() else []
    items, reading = export_items(rows)
    if old and len(items) < MIN_EXPORT_SHARE * len(old):
        print("::error::only %d finished books in the export against %d on file; is it the whole "
              "export? writing nothing" % (len(items), len(old)))
        return 1
    books, dropped = merge(old, items, reading)
    lost = lost_history(old, books)
    if lost:
        print("::error::the merge would lose %d finish date(s); writing nothing:" % len(lost))
        for line in lost:
            print("  " + line)
        return 1

    for b in dropped:
        # The whole record, so a removal made in error can be put back.
        print("::warning::no longer read on Goodreads, dropped: %s" % json.dumps(b, ensure_ascii=False))
    for line in changes(old, books):
        print(line)
    summary = summarise(books, date.today())
    if dry_run:
        print("dry run: %d books (%d dropped), %d currently reading, %d without a cover; %s"
              % (len(books), len(dropped), len(reading), sum(1 for b in books if not b.get("c")),
                 json.dumps(summary)))
        return 0

    # Whatever goes wrong with a cover costs that cover, never the reading.
    try:
        books, found, missing = add_cover_sources(books)
        for line in missing:
            print("::warning::cover not found: " + line)
        books, fetched, problems = keep_covers(books)
        report_covers(books, fetched, problems)
    except Exception as e:  # noqa: BLE001
        print("::warning::covers: %s: %s; books.json is written without the new ones"
              % (type(e).__name__, e))

    write_books(books)
    SUMMARY.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8", newline="\n")
    print("%d books -> %s; %s" % (len(books), BOOKS.name, json.dumps(summary)))

    status = 0
    try:
        import refresh_book_details  # noqa: PLC0415
        status = refresh_book_details.refresh(rows)
    except Exception as e:  # noqa: BLE001
        print("::warning::years and genres: %s: %s; run refresh_book_details.py again" % (type(e).__name__, e))
    try:
        import refresh_now  # noqa: PLC0415
        as_of = date.fromtimestamp(Path(path).stat().st_mtime).isoformat()
        refresh_now.write_reading(reading_list(reading, books), as_of)
    except Exception as e:  # noqa: BLE001
        print("::warning::books in progress: %s: %s; now.json is unchanged" % (type(e).__name__, e))
    return status


def main(argv: list[str] | None = None) -> int:
    ap = sitelib.arg_parser(__doc__)
    ap.add_argument("--export", type=Path, metavar="CSV",
                    help="a Goodreads library export (plain or enhanced) to refresh the shelf from")
    ap.add_argument("--dry-run", action="store_true",
                    help="report what would change, write nothing, ask no one")
    ap.add_argument("--covers", action="store_true",
                    help="no export: fetch the covers books.json has no copy of, and mark them")
    args = ap.parse_args(argv)
    # Titles go to the log; a Windows console's code page cannot print
    # every one of them, and a log line is not worth a crash.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="backslashreplace")
    if args.covers:
        return covers_main(args.dry_run)
    if args.export:
        return export_main(args.export, args.dry_run)
    ap.error("nothing to do: Goodreads retired its RSS feeds, so the shelf comes from a library "
             "export now (--export FILE), or use --covers")
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
