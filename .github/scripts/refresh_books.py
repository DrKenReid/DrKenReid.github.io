"""
Refresh data/books.json from the Goodreads read shelf (public RSS, no key).

The feed carries every book on the shelf with my rating, the ISBN when
Goodreads has one, the review text and the date I last finished it. It
runs weekly from the live-data workflow, so a book marked read on
Goodreads reaches the reading calendar, the shelf and the wall on its
own.

    python .github/scripts/refresh_books.py             # fetch, merge, write
    python .github/scripts/refresh_books.py --dry-run   # fetch and merge, write nothing

Record fields (data/schema/books.schema.json has the full descriptions):

    t  title                  a  author
    r  my rating (0 unrated)  i  ISBN, when Goodreads has one
    g  Goodreads book id      v  1 when I wrote a review
    w  Goodreads review id (goodreads.com/review/show/<w>: my rating and review)
    d  date last finished, or the date added when Goodreads has no date
    e  1 when d is only the date added (the calendar leaves it out)
    p  earlier finish dates, oldest first
    m  consecutive refreshes this book was missing from the feed

Also writes data/reading.json, the figures the homepage shows.

Three stages, so the rules can be tested without a network:

    fetch_items()             the network: every item on the shelf, as dicts
    merge(old_books, items)   pure: the new books.json list
    summarise(books, today)   pure: the reading.json figures

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
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402

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
          "isbn", "link", "user_read_at", "user_date_added")


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


# --- entry point -----------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    ap = sitelib.arg_parser(__doc__)
    ap.add_argument("--dry-run", action="store_true",
                    help="fetch and merge, report what would change, write nothing")
    args = ap.parse_args(argv)
    # Titles go to the log; a Windows console's code page cannot print
    # every one of them, and a log line is not worth a crash.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="backslashreplace")

    old = json.loads(BOOKS.read_text(encoding="utf-8")) if BOOKS.exists() else []

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
        print("dry run: %d books (%d new, %d changed records); %s"
              % (len(books), added, changed, json.dumps(summary)))
        return 0

    BOOKS.write_text(json.dumps(books, ensure_ascii=False, separators=(",", ":")) + "\n",
                     encoding="utf-8", newline="\n")
    SUMMARY.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8", newline="\n")
    print("%d books (%d new) -> %s; %s" % (len(books), added, BOOKS.name, json.dumps(summary)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
