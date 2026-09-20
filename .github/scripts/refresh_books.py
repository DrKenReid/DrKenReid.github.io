"""
Refresh data/books.json from the Goodreads read shelf (public RSS, no key).

The feed carries every book on the shelf with my rating, the ISBN when
Goodreads has one, the review text and the date I last finished it. It
runs weekly from the live-data workflow, so a book marked read on
Goodreads reaches the reading calendar, the shelf and the wall on its
own.

Re-reads: Goodreads keeps every reading session, but the feed reports
only the latest finish date and the session list needs a login. So the
previous date is kept: when a book's date moves later than the one on
file, the old date joins `p`, the book's earlier reads, and the calendar
counts both. The Goodreads export (scripts/export_bookwall.py) seeds the
first-read dates; from then on this script accumulates the rest.

    t  title                  a  author
    r  my rating (0 unrated)  i  ISBN, when Goodreads has one
    g  Goodreads book id      v  1 when I wrote a review
    w  Goodreads review id (goodreads.com/review/show/<w>: my rating and review)
    d  date last finished, or the date added when Goodreads has no date
    e  1 when d is only the date added (the calendar leaves it out)
    p  earlier finish dates, oldest first

Also writes data/reading.json, the three figures the homepage shows.

    python .github/scripts/refresh_books.py
"""
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BOOKS = ROOT / "data" / "books.json"
SUMMARY = ROOT / "data" / "reading.json"
USER = "42371562"
RSS = ("https://www.goodreads.com/review/list_rss/%s?shelf=read&sort=date_read"
       "&per_page=200&page=%d")
UA = "Mozilla/5.0 (kenreid.co.uk reading refresh)"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def text(item, tag):
    el = item.find(tag)
    return (el.text or "").strip() if el is not None else ""


def parse_date(s):
    """'Sat, 3 Jan 2026 00:00:00 +0000' -> '2026/01/03'; '' -> ''."""
    s = (s or "").strip()
    if not s:
        return ""
    try:
        return datetime.strptime(s.rsplit(" ", 1)[0], "%a, %d %b %Y %H:%M:%S").strftime("%Y/%m/%d")
    except ValueError:
        return ""


def clean_text(raw):
    """House style is straight quotes; Goodreads uses curly ones."""
    t = (raw or "").strip()
    for a, b in (("‘", "'"), ("’", "'"), ("�", "'"),
                 ("“", '"'), ("”", '"')):
        t = t.replace(a, b)
    return " ".join(t.split())


def fetch_shelf():
    items = []
    for page in range(1, 20):
        root = ET.fromstring(get(RSS % (USER, page)))
        got = root.findall("./channel/item")
        items.extend(got)
        if len(got) < 200:
            break
    return items


def sessions(b):
    out = [] if b.get("e") else [b["d"]]
    return out + list(b.get("p") or [])


def main(argv=None):
    old = {}
    if BOOKS.exists():
        old = {b["g"]: b for b in json.loads(BOOKS.read_text(encoding="utf-8")) if b.get("g")}

    items = fetch_shelf()
    if old and len(items) < 0.9 * len(old):
        print("only %d books in the feed against %d on file; leaving books.json alone" % (len(items), len(old)))
        return 1

    books = []
    for it in items:
        g = text(it, "book_id")
        prev = old.get(g, {})
        b = {
            "t": clean_text(text(it, "title")),
            "a": clean_text(text(it, "author_name")),
            "r": int(text(it, "user_rating") or 0),
        }
        if text(it, "user_review"):
            b["v"] = 1
        isbn = prev.get("i") or text(it, "isbn")
        if isbn:
            b["i"] = isbn
        b["g"] = g
        # The item's link is my review page for the book; the shelf, the
        # wall and the selected reviews link there rather than to the book.
        m = re.search(r"/review/show/(\d+)", text(it, "link"))
        if m:
            b["w"] = m.group(1)
        finished = parse_date(text(it, "user_read_at"))
        earlier = list(prev.get("p") or [])
        if finished:
            b["d"] = finished
            was = prev.get("d")
            if was and not prev.get("e") and was < finished and was not in earlier:
                earlier.append(was)
        elif prev.get("d") and not prev.get("e"):
            b["d"] = prev["d"]
        else:
            b["d"] = parse_date(text(it, "user_date_added")) or prev.get("d") or ""
            b["e"] = 1
        if earlier:
            b["p"] = sorted(set(earlier))
        books.append(b)

    books.sort(key=lambda b: b["d"], reverse=True)
    BOOKS.write_text(json.dumps(books, ensure_ascii=False, separators=(",", ":")) + "\n",
                     encoding="utf-8", newline="\n")

    year = str(date.today().year)
    summary = {
        "books": len(books),
        "reviews": sum(1 for b in books if b.get("v")),
        "thisYear": sum(1 for b in books for d in sessions(b) if d.startswith(year)),
        "rereads": sum(len(b.get("p") or []) for b in books),
        "updated": date.today().isoformat(),
    }
    SUMMARY.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8", newline="\n")
    print("%d books -> %s; %s" % (len(books), BOOKS.name, json.dumps(summary)))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
