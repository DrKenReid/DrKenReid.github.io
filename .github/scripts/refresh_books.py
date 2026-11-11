"""
Refresh data/books.json from the Goodreads read shelf (public RSS, no key).

The feed carries every book on the shelf with my rating, the ISBN when
Goodreads has one, the review text and the date I last finished it. It
runs weekly from the live-data workflow, so a book marked read on
Goodreads reaches the reading calendar, the shelf and the wall on its
own.

    python .github/scripts/refresh_books.py             # fetch, merge, write
    python .github/scripts/refresh_books.py --dry-run   # fetch and merge, write nothing
    python .github/scripts/refresh_books.py --covers    # no feed: only fetch the covers still missing

Record fields (data/schema/books.schema.json has the full descriptions):

    t  title                  a  author
    r  my rating (0 unrated)  i  ISBN, when Goodreads has one
    g  Goodreads book id      v  1 when I wrote a review
    w  Goodreads review id (goodreads.com/review/show/<w>: my rating and review)
    d  date last finished, or the date added when Goodreads has no date
    e  1 when d is only the date added (the calendar leaves it out)
    p  earlier finish dates, oldest first
    n  pages, from the feed's book/num_pages (kept when a week has none)
    c  the cover Goodreads shows, from the feed's book_large_image_url,
       less GR_COVERS (kept when a week has none or only a placeholder)
    k  1 when the site has its own copy of that cover, for the pages
       to show; s the same for the small copy (see "Covers" below)
    y  the year it was first published: the feed's book_published for a
       new book; the year on file is kept, since refresh_book_details.py
       sets the original year where it knows it
    gn its genres, one or two keys; kept from the record (the feed has
       none: refresh_book_details.py sets them)
    m  consecutive refreshes this book was missing from the feed

Also writes data/reading.json, the figures the homepage shows.

Four stages, so the rules can be tested without a network:

    fetch_items()             the network: every item on the shelf, as dicts
    merge(old_books, items)   pure: the new books.json list
    summarise(books, today)   pure: the reading.json figures
    keep_covers(books)        the network and img/: a copy of each new cover

Why history must never be lost. Goodreads keeps every reading session,
but the feed reports only the latest finish date and the session list
needs a login. So `p`, a book's earlier finishes, exists nowhere but in
this file: each time a book's date moves later, the old date joins `p`,
and the calendar, the year counts and the streak count every session.
A date that leaves books.json can come back only by digging through the
file's git history. A one-off import of the Goodreads CSV export, run
locally and not kept in the repository, seeded the first-read dates;
from then on this script is the only thing
that accumulates them, and merge() is written so that it cannot drop one.

Merge rules (merge):

  1. A feed item is matched to the record on file by Goodreads book id,
     and failing that by review id: Goodreads can move a review to
     another edition, which changes the book id but not the review.
  2. The feed wins for what I can edit on Goodreads: title, author,
     rating, the review flag, the review id. The ISBN on file wins over
     the feed's (the seeded ones are ISBN-13; the feed's may be empty).
  3. A finish date later than the one on file pushes the old date into
     `p`. An earlier one replaces it without doing so: that is a session
     deleted or corrected on Goodreads. `p` never holds the current `d`,
     so no session is counted twice.
  4. No finish date: the date on file is kept, or failing that the date
     added is used and `e` is set.
  5. A book on file but absent from this feed is carried forward
     unchanged, `p` included, with its miss counter `m` raised by one.
     It is dropped only when `m` would reach MISS_LIMIT (2): absent from
     two consecutive weekly feeds, which is a removal from the shelf,
     not a bad week. Seen again, its `m` goes. Until the counter existed,
     a feed short by fewer than one book in ten silently dropped the
     missing books and their re-read history with them.

Guards (main): a short page in the middle of the shelf, a feed with
fewer than 90% of the books on file, or a merge that loses an earlier
finish date writes nothing and exits 1, which the workflow reports.

Covers (keep_covers). The reading pages show each book's cover from the
site itself, so showing a book asks Goodreads for nothing. The site
keeps two copies of each, both downloaded once from the address `c`
names (Goodreads resizes a cover for a size in its file name and never
enlarges one), and a mark on the record for each:

    k  img/covers/shelf/<g>.jpg     COVER_HEIGHT tall: a review card,
                                    the slideshow's featured book
    s  img/covers/shelf/s/<g>.jpg   COVER_SMALL_HEIGHT tall: a tile on
                                    the wall, a thumbnail

The pages ask only for the files a record's marks name, so a file that
is not there is never requested. Each use takes the copy that suits its
size and the other when that one is missing; a book with neither falls
back to Open Library's cover for its ISBN, then to a cover set in type
(coverAttrs in js/bookshelf.js).

  1. Only a missing copy is fetched: one whose mark is absent, or whose
     file is. merge_one() carries the marks forward while `c` stays the
     same, so a cover Goodreads replaces is fetched again, over the old
     files.
  2. What arrives is kept as it is (standard library only: nothing here
     can decode or resize a picture), and only if it is a JPEG of a
     sensible size (COVER_MAX_BYTES). Goodreads' "nophoto" placeholder
     never becomes `c` (cover_path), and an answer that redirects to it
     is refused. A heavy answer (COVER_HEAVY) is an upload passed
     through untouched; asked for a pixel shorter it comes back
     compressed, and the lighter of the two is kept (lighten).
  3. A copy that cannot be fetched is a warning, never a failure: the
     record goes without its mark and next week tries again. After
     COVER_GIVE_UP failures in a row the rest wait for next week too,
     so a host that is down cannot use up the job's time.
  4. Nothing is deleted. A book that leaves the shelf leaves its files
     behind; they are a few kilobytes, and a re-read brings the book
     back.

The workflow commits the folder with the data files. `--covers` runs
this stage alone over the books.json on file, with no feed: it is how
the folder was first filled, and how to fetch again after deleting a
file by hand. It writes the marks every COVER_SAVE_EVERY files, so a
run that is cut short keeps what it fetched and the next one starts
where it stopped.

local_cover() is the same store for a cover that is not a book on this
shelf: refresh_now.py calls it for the books in progress, so Reading Now
shows the site's small copies too.
"""
from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402
from generate_photo_dims import image_size  # noqa: E402  (a JPEG's height from its header)

ROOT = sitelib.ROOT
BOOKS = ROOT / "data" / "books.json"
SUMMARY = ROOT / "data" / "reading.json"
USER = "42371562"
PER_PAGE = 200
MAX_PAGES = 20
RSS = ("https://www.goodreads.com/review/list_rss/%s?shelf=read&sort=date_read"
       "&per_page=" + str(PER_PAGE) + "&page=%d")
UA = "Mozilla/5.0 (kenreid.co.uk reading refresh)"

# Weekly feeds a book may be missing from, in a row, before it is taken
# for a removal. Two: one bad week is carried, a second one is believed.
MISS_LIMIT = 2

# Below this share of the books on file, the feed is an outage, not a
# cull: nothing is written.
MIN_FEED_SHARE = 0.9

# The item fields merge() reads; fetch_items() returns dicts of exactly
# these, so a test can build items without any XML.
FIELDS = ("book_id", "title", "author_name", "user_rating", "user_review",
          "isbn", "link", "user_read_at", "user_date_added", "book/num_pages",
          "book_large_image_url", "book_published")

# Goodreads' covers all sit under this address; books.json keeps the rest
# of each (c), and cover_source() puts it back to download the site's own
# copy. A cover anywhere else is kept whole.
GR_COVERS = "https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/"

# The site's copies: JPEGs named for the Goodreads book id, as Goodreads
# sent them. The full one is in this folder, the small one in s/ under it;
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
# A cover no taller than the height asked for comes back as it was
# uploaded, and some uploads are heavy: 185 KB for one 400px cover, where
# its neighbours are 24 KB. An answer over this is asked for again one
# pixel shorter than itself, which makes Goodreads compress it like the
# rest (that one came to 31 KB), and the lighter of the two is kept
# (lighten). It keeps one book from costing a page seven covers' worth.
COVER_HEAVY = 60_000
# Never kept, lightened or not: several times the heaviest cover the
# shelf has needed, so nothing that is not a cover-sized picture can
# reach the repository.
COVER_MAX_BYTES = 300_000
# Says what is asking and nothing about who.
COVER_UA = "Mozilla/5.0 (compatible; book-cover-fetch)"
COVER_TIMEOUT = 20          # seconds for one answer
COVER_TRIES = 3             # attempts at one cover, a longer wait before each
COVER_PAUSE = 0.3           # seconds between two downloads
COVER_GIVE_UP = 5           # failures in a row before the rest wait a week
COVER_SAVE_EVERY = 25       # files between two writes of the marks (--covers)


class FeedError(RuntimeError):
    """The feed answered, but not with the whole shelf."""


def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def text(item, tag: str) -> str:
    el = item.find(tag)
    return (el.text or "").strip() if el is not None else ""


def parse_date(s: str) -> str:
    """'Sat, 3 Jan 2026 00:00:00 +0000' -> '2026/01/03'; '' -> ''."""
    s = (s or "").strip()
    if not s:
        return ""
    try:
        return datetime.strptime(s.rsplit(" ", 1)[0], "%a, %d %b %Y %H:%M:%S").strftime("%Y/%m/%d")
    except ValueError:
        return ""


def clean_text(raw: str) -> str:
    """House style is straight quotes; Goodreads uses curly ones.

    U+FFFD, the replacement character, is mapped to an apostrophe too.
    It marks a character some decoder upstream could not read, so the
    original is gone and there is nothing to decode. It cannot come from
    this script's own parsing (ElementTree rejects bad UTF-8 outright
    rather than substituting), so one would be in Goodreads' stored text.
    The guess is the apostrophe because that is the likeliest casualty in
    an English title (the curly one is byte 0x92 in Windows-1252, the byte
    most often mis-read), and a wrong guess shows as a stray apostrophe on
    the shelf where leaving it would show the replacement glyph. The same
    mapping is in the export script that seeded books.json, so a title
    reads the same whichever of the two last wrote it. The read shelf's
    feed held none when last looked at (September 2026): this is a guard,
    not a fix for a known title.
    """
    t = (raw or "").strip()
    for a, b in (("‘", "'"), ("’", "'"), ("�", "'"),
                 ("“", '"'), ("”", '"')):
        t = t.replace(a, b)
    return " ".join(t.split())


def review_id(link: str) -> str:
    """The review id in an item's link, which is my review page for the book."""
    m = re.search(r"/review/show/(\d+)", link or "")
    return m.group(1) if m else ""


# --- the network -----------------------------------------------------------

def fetch_items(fetch=get) -> list[dict]:
    """Every item on the read shelf, as dicts of FIELDS.

    Pages hold PER_PAGE items, so a shorter page should be the last. That
    is confirmed rather than assumed: the page after a short one must be
    empty. If it is not, the short page was cut off mid-shelf, and
    stopping there (as this once did) would lose every book after it, so
    it is a FeedError instead.
    """
    items: list[dict] = []
    short = None
    for page in range(1, MAX_PAGES + 1):
        root = ET.fromstring(fetch(RSS % (USER, page)))
        got = [{f: text(it, f) for f in FIELDS} for it in root.findall("./channel/item")]
        if short is not None:
            if got:
                raise FeedError(
                    "page %d had %d of %d items, but page %d has %d more: "
                    "the feed was cut short mid-shelf" % (short[0], short[1], PER_PAGE, page, len(got)))
            return items
        if not got:
            return items
        items.extend(got)
        if len(got) < PER_PAGE:
            short = (page, len(got))
    raise FeedError("the shelf runs past %d pages; raise MAX_PAGES" % MAX_PAGES)


# --- the rules (pure) --------------------------------------------------------

def cover_path(url: str) -> str:
    """A feed cover as books.json keeps it: GR_COVERS taken off the front;
    '' for none, or for Goodreads' "nophoto" placeholder."""
    url = (url or "").strip()
    if not url.startswith("https://") or "nophoto" in url:
        return ""
    return url[len(GR_COVERS):] if url.startswith(GR_COVERS) else url


def merge_one(prev: dict, item: dict) -> dict:
    """One record from a feed item and the record on file ({} if new)."""
    b = {
        "t": clean_text(item["title"]),
        "a": clean_text(item["author_name"]),
        "r": int(item["user_rating"] or 0),
    }
    if item["user_review"]:
        b["v"] = 1
    isbn = prev.get("i") or item["isbn"]
    if isbn:
        b["i"] = isbn
    b["g"] = item["book_id"]
    c = cover_path(item.get("book_large_image_url", "")) or prev.get("c")
    if c:
        b["c"] = c
        # The site's copies are copies of the cover on file: with another
        # cover the marks go, and keep_covers() fetches the new one.
        for mark in COVER_MARKS:
            if prev.get(mark) and prev.get("c") == c:
                b[mark] = 1
    pages = item.get("book/num_pages") or ""
    n = int(pages) if pages.isdigit() and int(pages) > 0 else prev.get("n")
    if n:
        b["n"] = n
    # The year on file wins: refresh_book_details.py sets it from the
    # original publication year where it knows one, and the feed's may be
    # the edition's. The feed's is for a book with none yet.
    year = (item.get("book_published") or "").strip()
    y = prev.get("y") or (int(year) if year.isdigit() and 0 < int(year) <= 9999 else None)
    if y:
        b["y"] = y
    # The feed has no genres: refresh_book_details.py sets them, and they
    # stay with the record.
    if prev.get("gn"):
        b["gn"] = list(prev["gn"])
    w = review_id(item["link"]) or prev.get("w")
    if w:
        b["w"] = w

    earlier = set(prev.get("p") or [])
    was = prev.get("d") if not prev.get("e") else ""
    finished = parse_date(item["user_read_at"])
    if finished:
        b["d"] = finished
        if was and was < finished:
            earlier.add(was)
    elif was:
        b["d"] = was
    else:
        b["d"] = parse_date(item["user_date_added"]) or prev.get("d") or ""
        b["e"] = 1
    earlier.discard(b["d"])
    if earlier:
        b["p"] = sorted(earlier)
    return b


def merge(old_books: list[dict], items: list[dict]) -> list[dict]:
    """The new books.json list from the one on file and this week's feed.

    Pure: no network, no clock, no files. See the module docstring for
    the rules; the short version is that a feed can add and correct, but
    one bad week cannot take anything away.
    """
    by_g = {b["g"]: b for b in old_books if b.get("g")}
    by_w = {b["w"]: b for b in old_books if b.get("w")}
    matched: set[int] = set()
    merged: set[str] = set()
    books = []
    for item in items:
        if item["book_id"] and item["book_id"] in merged:
            continue  # listed twice in one feed: the first (newest) wins
        merged.add(item["book_id"])
        prev = by_g.get(item["book_id"]) or by_w.get(review_id(item["link"])) or {}
        if prev and id(prev) in matched:
            prev = {}  # one record's history is never handed to two books
        if prev:
            matched.add(id(prev))
        books.append(merge_one(prev, item))

    for b in old_books:
        if id(b) in matched:
            continue
        misses = int(b.get("m") or 0) + 1
        if misses >= MISS_LIMIT:
            continue
        carried = dict(b)
        carried["m"] = misses
        books.append(carried)

    # Stable, so books finished the same day keep the feed's order.
    books.sort(key=lambda b: b["d"], reverse=True)
    return books


def sessions(b: dict) -> list[str]:
    """Every finish date a record stands for: d (unless only the date
    added) and each earlier one."""
    out = [] if b.get("e") else [b["d"]]
    return out + list(b.get("p") or [])


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
    new_w = {b["w"]: b for b in books if b.get("w")}
    out = []
    for b in old_books:
        nb = new_g.get(b.get("g")) or new_w.get(b.get("w"))
        if nb is None:
            continue  # dropped after MISS_LIMIT misses: main() names it
        kept = set(sessions(nb)) | set(nb.get("p") or [])
        for d in b.get("p") or []:
            if d not in kept:
                out.append("%s (%s): %s" % (b.get("t"), b.get("g"), d))
    return out


# --- covers ------------------------------------------------------------------

# A record's marks, in the order they are written: the full copy, the small.
COVER_MARKS = ("k", "s")


class CoverError(RuntimeError):
    """One cover could not be fetched, or what came back is not one."""


def cover_source(c: str, height: int = COVER_HEIGHT) -> str:
    """Where the site's copy of cover `c` comes from: Goodreads' address
    for it at `height`, or `c` itself for a cover kept whole. The size
    goes in the file name, in place of the one `c` has or before the
    extension of a name with none."""
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
    --covers run writes it many times) and for a cover local_cover() will
    take on trust. Where the move is refused (Windows, while another
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
    """Swap a heavy cover file for a lighter answer, when there is one
    (COVER_HEAVY): the same cover asked for one pixel shorter than the
    file is. Whatever goes wrong the file stays, since a heavy cover is
    still the cover."""
    if c.startswith("https://"):
        return  # kept whole: there is no other size to ask for
    try:
        data = fetch(cover_source(c, image_size(path)[1] - 1))
        check_cover(data)
    except Exception:  # noqa: BLE001 - no height in the header, or no answer
        return
    if len(data) < path.stat().st_size:
        write_whole(path, data)


def save_cover(c: str, path: Path, height: int, fetch) -> None:
    """Download cover `c` at `height` to `path`, or raise CoverError or
    OSError and leave `path` as it was."""
    data = fetch(cover_source(c, height))
    check_cover(data)
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
    # (write_whole): the workflow commits everything in the folder.
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


def local_cover(url: str, fetch=None) -> str:
    """The site's small copy of the cover at Goodreads' address `url`, as
    the path a page asks for it by (SITE_COVERS + "s/<id>.jpg"), fetched
    now if it is not on disk; '' when it cannot be had.

    For a cover that is not a book on this shelf (the books in progress,
    refresh_now.py), which has no record to carry a mark: the file on
    disk is taken on trust, and is named for the id in the cover's own
    file name, which is the book's id for every book the shelf has held.
    A path that is already one of the site's is kept while its file is
    there, so a list written last week can be passed through again.
    """
    url = (url or "").strip()
    if url.startswith(SITE_COVERS):
        ours = re.fullmatch(r"(s/)?([0-9]+)\.jpg", url[len(SITE_COVERS):])
        path = cover_file(ours.group(2), "s" if ours.group(1) else "k") if ours else None
        return url if path and path.is_file() else ""
    c = cover_path(url)
    named = re.search(r"(?:^|/)([0-9]+)\.(?:_S[XY]\d+_\.)?\w+$", c)
    if not named or c.startswith("https://"):
        return ""
    path = cover_file(named.group(1), "s")
    if not path.is_file():
        try:
            save_cover(c, path, COVER_SMALL_HEIGHT, fetch or fetch_cover)
        except (CoverError, OSError):
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


# --- entry point -----------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    ap = sitelib.arg_parser(__doc__)
    ap.add_argument("--dry-run", action="store_true",
                    help="fetch and merge, report what would change, write nothing")
    ap.add_argument("--covers", action="store_true",
                    help="no feed: fetch the covers books.json has no copy of, and mark them")
    args = ap.parse_args(argv)
    # Titles go to the log; a Windows console's code page cannot print
    # every one of them, and a log line is not worth a crash.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="backslashreplace")

    old = json.loads(BOOKS.read_text(encoding="utf-8")) if BOOKS.exists() else []

    if args.covers:
        if args.dry_run:
            print("dry run: %d cover files to fetch for %d books" % (covers_wanted(old), len(old)))
            return 0
        if not old:
            return 0
        # The marks go to the file as the run goes, so one that is cut
        # short is not fetched over again. Only the marks can change,
        # and reading.json has none.
        books, fetched, problems = keep_covers(old, save=write_books)
        report_covers(books, fetched, problems)
        if dump_books(books) != BOOKS.read_text(encoding="utf-8"):
            write_books(books)
        return 0

    try:
        items = fetch_items()
    except FeedError as e:
        print("::error::Goodreads read shelf: %s; leaving books.json alone" % e)
        return 1
    distinct = len({it["book_id"] for it in items})
    if old and distinct < MIN_FEED_SHARE * len(old):
        print("::error::only %d books in the feed against %d on file; leaving books.json alone"
              % (distinct, len(old)))
        return 1

    books = merge(old, items)
    lost = lost_history(old, books)
    if lost:
        print("::error::the merge would lose %d earlier finish date(s); writing nothing:" % len(lost))
        for line in lost:
            print("  " + line)
        return 1

    def keys(b):
        return {("g", b.get("g")), ("w", b.get("w"))} - {("g", None), ("w", None)}

    old_keys = set().union(*map(keys, old)) if old else set()
    new_keys = set().union(*map(keys, books)) if books else set()
    for b in books:
        if b.get("m"):
            print("::warning::not in this week's feed, kept (miss %d of %d): %s"
                  % (b["m"], MISS_LIMIT, b["t"]))
    for b in old:
        if not keys(b) & new_keys:
            # The whole record goes to the log, so a removal made in
            # error can be put back by hand from the run's output.
            print("::warning::missing from %d feeds in a row, dropped: %s"
                  % (MISS_LIMIT, json.dumps(b, ensure_ascii=False)))
    added = sum(1 for b in books if not keys(b) & old_keys)

    summary = summarise(books, date.today())
    if args.dry_run:
        changed = sum(1 for b in books if b not in old)
        print("dry run: %d books (%d new, %d changed records, %d cover files to fetch); %s"
              % (len(books), added, changed, covers_wanted(books), json.dumps(summary)))
        return 0

    # After every guard, and before the write, so a record's marks and
    # its files reach the repository in one commit. Whatever goes wrong here
    # costs a cover, never the week's reading.
    try:
        books, fetched, problems = keep_covers(books)
        report_covers(books, fetched, problems)
    except Exception as e:  # noqa: BLE001
        print("::warning::covers: %s: %s; books.json is written without this week's"
              % (type(e).__name__, e))

    write_books(books)
    SUMMARY.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8", newline="\n")
    print("%d books (%d new) -> %s; %s" % (len(books), added, BOOKS.name, json.dumps(summary)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
