"""refresh_books.merge(): the weekly Goodreads refresh never loses a read.

Goodreads' feed reports only the latest finish of each book, so the
earlier finishes (`p`) exist nowhere but in data/books.json: once the
refresh drops one, the reading calendar, the year counts and the streak
lose that session for good. These cases pin the rules in the module
docstring of .github/scripts/refresh_books.py with small hand-built
records, plus one round trip over the real file.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import contextlib
import io
import json
import sys
import tempfile
import unittest
from datetime import date, datetime
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import refresh_books as rb  # noqa: E402


def rss_date(d):
    """'2026/03/19' as the feed writes it: 'Thu, 19 Mar 2026 00:00:00 +0000'."""
    return datetime.strptime(d, "%Y/%m/%d").strftime("%a, %d %b %Y 00:00:00 +0000")


def item(book_id, title="A Book", read="", added="2024/01/01", rating=4,
         review_id=None, isbn=""):
    """One feed item, as fetch_items() returns it."""
    return {
        "book_id": book_id,
        "title": title,
        "author_name": "An Author",
        "user_rating": str(rating),
        "user_review": "",
        "isbn": isbn,
        "link": "https://www.goodreads.com/review/show/%s?utm_medium=api"
                % (review_id or "70" + book_id),
        "user_read_at": rss_date(read) if read else "",
        "user_date_added": rss_date(added) if added else "",
    }


def item_for(b):
    """The feed item that says exactly what record `b` says."""
    return {
        "book_id": b["g"], "title": b["t"], "author_name": b["a"],
        "user_rating": str(b["r"]), "user_review": "A review." if b.get("v") else "",
        "isbn": b.get("i", ""),
        "link": "https://www.goodreads.com/review/show/%s" % b["w"],
        "user_read_at": "" if b.get("e") else rss_date(b["d"]),
        "user_date_added": rss_date(b["d"]) if b.get("e") else rss_date("2024/01/01"),
    }


def by_id(books):
    return {b["g"]: b for b in books}


class FirstRead(unittest.TestCase):
    def test_a_new_book_with_a_finish_date(self):
        (b,) = rb.merge([], [item("1", title="Dune", read="2026/03/19", isbn="9780441013593")])
        self.assertEqual(b, {"t": "Dune", "a": "An Author", "r": 4, "i": "9780441013593",
                             "g": "1", "w": "701", "d": "2026/03/19"})
        self.assertEqual(rb.sessions(b), ["2026/03/19"])


class ReRead(unittest.TestCase):
    def test_a_later_finish_moves_the_old_date_into_p(self):
        old = rb.merge([], [item("1", read="2021/05/01")])
        new = by_id(rb.merge(old, [item("1", read="2026/09/01")]))["1"]
        self.assertEqual(new["d"], "2026/09/01")
        self.assertEqual(new["p"], ["2021/05/01"])
        self.assertEqual(sorted(rb.sessions(new)), ["2021/05/01", "2026/09/01"])

    def test_a_third_read_keeps_both_earlier_ones_in_order(self):
        books = rb.merge([], [item("1", read="2019/01/01")])
        books = rb.merge(books, [item("1", read="2022/01/01")])
        books = rb.merge(books, [item("1", read="2026/01/01")])
        self.assertEqual(by_id(books)["1"]["p"], ["2019/01/01", "2022/01/01"])

    def test_an_earlier_finish_is_a_correction_not_a_read(self):
        # The latest session was deleted on Goodreads: the date goes back
        # and nothing is counted twice.
        old = [{"t": "A Book", "a": "An Author", "r": 4, "g": "1", "w": "701",
                "d": "2026/09/01", "p": ["2021/05/01"]}]
        new = by_id(rb.merge(old, [item("1", read="2021/05/01")]))["1"]
        self.assertEqual(new["d"], "2021/05/01")
        self.assertNotIn("p", new)
        self.assertEqual(rb.lost_history(old, [new]), [])

    def test_the_same_date_again_changes_nothing(self):
        old = rb.merge([], [item("1", read="2026/09/01")])
        self.assertEqual(rb.merge(old, [item("1", read="2026/09/01")]), old)


class DateAddedOnly(unittest.TestCase):
    def test_no_finish_date_uses_the_date_added_and_marks_it(self):
        (b,) = rb.merge([], [item("1", read="", added="2025/12/31")])
        self.assertEqual(b["d"], "2025/12/31")
        self.assertEqual(b["e"], 1)
        # The calendar and the year count leave a date-added book out.
        self.assertEqual(rb.sessions(b), [])

    def test_a_later_finish_replaces_the_date_added_without_counting_it(self):
        old = rb.merge([], [item("1", read="", added="2025/12/31")])
        new = by_id(rb.merge(old, [item("1", read="2026/02/01")]))["1"]
        self.assertEqual(new["d"], "2026/02/01")
        self.assertNotIn("e", new)
        self.assertNotIn("p", new)

    def test_a_finish_date_that_disappears_is_kept(self):
        old = rb.merge([], [item("1", read="2026/02/01")])
        new = by_id(rb.merge(old, [item("1", read="")]))["1"]
        self.assertEqual(new["d"], "2026/02/01")
        self.assertNotIn("e", new)


class AbsentForOneRun(unittest.TestCase):
    def setUp(self):
        self.old = [{"t": "Kept", "a": "An Author", "r": 5, "g": "1", "w": "701",
                     "d": "2026/01/01", "p": ["2020/01/01", "2023/01/01"]},
                    {"t": "Other", "a": "An Author", "r": 3, "g": "2", "w": "702",
                     "d": "2025/06/01"}]

    def test_one_missing_week_carries_the_book_and_its_history(self):
        week1 = by_id(rb.merge(self.old, [item_for(self.old[1])]))
        kept = week1["1"]
        self.assertEqual(kept["m"], 1)
        self.assertEqual(kept["p"], ["2020/01/01", "2023/01/01"])
        self.assertEqual({k: v for k, v in kept.items() if k != "m"}, self.old[0])

    def test_back_the_next_week_the_counter_goes(self):
        week1 = rb.merge(self.old, [item_for(self.old[1])])
        week2 = by_id(rb.merge(week1, [item_for(b) for b in self.old]))
        self.assertNotIn("m", week2["1"])
        self.assertEqual(week2["1"]["p"], ["2020/01/01", "2023/01/01"])

    def test_missing_twice_in_a_row_is_a_removal(self):
        week1 = rb.merge(self.old, [item_for(self.old[1])])
        week2 = rb.merge(week1, [item_for(self.old[1])])
        self.assertEqual(list(by_id(week2)), ["2"])

    def test_an_edition_change_keeps_the_history_through_the_review_id(self):
        moved = dict(item_for(self.old[0]), book_id="99")
        out = by_id(rb.merge(self.old, [moved, item_for(self.old[1])]))
        self.assertEqual(out["99"]["p"], ["2020/01/01", "2023/01/01"])
        self.assertNotIn("1", out)


class ShrinkingFeed(unittest.TestCase):
    """main(): a feed with fewer than MIN_FEED_SHARE of the books on file
    is an outage, not a cull, and nothing is written."""

    def run_main(self, old, items):
        with tempfile.TemporaryDirectory() as tmp:
            books = Path(tmp) / "books.json"
            summary = Path(tmp) / "reading.json"
            books.write_text(json.dumps(old), encoding="utf-8")
            out = io.StringIO()
            with mock.patch.object(rb, "BOOKS", books), \
                    mock.patch.object(rb, "SUMMARY", summary), \
                    mock.patch.object(rb, "fetch_items", return_value=items), \
                    contextlib.redirect_stdout(out):
                code = rb.main([])
            return code, json.loads(books.read_text(encoding="utf-8")), summary.exists(), out.getvalue()

    def shelf(self, n):
        return [{"t": "Book %d" % i, "a": "An Author", "r": 3, "g": str(i), "w": "7%d" % i,
                 "d": "2025/01/%02d" % (i % 28 + 1)} for i in range(n)]

    def test_a_short_feed_writes_nothing(self):
        old = self.shelf(20)
        code, written, wrote_summary, out = self.run_main(old, [item_for(b) for b in old[:17]])
        self.assertEqual(code, 1)
        self.assertEqual(written, old)
        self.assertFalse(wrote_summary)
        self.assertIn("leaving books.json alone", out)

    def test_one_book_short_is_carried_not_dropped(self):
        old = self.shelf(20)
        code, written, _, _ = self.run_main(old, [item_for(b) for b in old[1:]])
        self.assertEqual(code, 0)
        self.assertEqual(len(written), 20)
        self.assertEqual(by_id(written)["0"]["m"], 1)


class Summary(unittest.TestCase):
    def test_this_year_counts_every_session(self):
        books = [
            {"t": "A", "a": "x", "r": 5, "g": "1", "w": "1", "d": "2026/03/01",
             "p": ["2026/01/01", "2020/01/01"]},
            {"t": "B", "a": "x", "r": 4, "v": 1, "g": "2", "w": "2", "d": "2026/02/01", "e": 1},
            {"t": "C", "a": "x", "r": 3, "g": "3", "w": "3", "d": "2025/12/31"},
        ]
        self.assertEqual(rb.summarise(books, date(2026, 9, 23)), {
            "books": 3, "reviews": 1, "thisYear": 2, "rereads": 2, "updated": "2026-09-23"})


class Paging(unittest.TestCase):
    """fetch_items(): a short page ends the shelf only when the next is
    empty. Stopping at a page cut off mid-shelf once lost every book after
    it."""

    @staticmethod
    def pages(*sizes):
        def xml(n, start):
            items = "".join("<item><book_id>%d</book_id></item>" % (start + i) for i in range(n))
            return ("<rss><channel>%s</channel></rss>" % items).encode()
        served = []

        def fetch(url):
            page = int(url.rsplit("=", 1)[1])
            served.append(page)
            n = sizes[page - 1] if page <= len(sizes) else 0
            return xml(n, sum(sizes[:page - 1]))
        return fetch, served

    def test_a_short_last_page_is_confirmed_by_an_empty_next_one(self):
        fetch, served = self.pages(rb.PER_PAGE, rb.PER_PAGE, 1)
        self.assertEqual(len(rb.fetch_items(fetch)), 2 * rb.PER_PAGE + 1)
        self.assertEqual(served, [1, 2, 3, 4])

    def test_a_short_page_in_the_middle_is_a_failure(self):
        fetch, _ = self.pages(rb.PER_PAGE, 150, rb.PER_PAGE, 51)
        with self.assertRaises(rb.FeedError):
            rb.fetch_items(fetch)


class RealShelf(unittest.TestCase):
    """The committed books.json, fed back as the feed that describes it,
    merges to itself: whatever the file holds, the rules keep it."""

    def test_round_trip(self):
        path = rb.BOOKS
        books = json.loads(path.read_text(encoding="utf-8"))
        # A book already missing once carries its counter; the feed below
        # has every book, so the counter would rightly go.
        settled = [{k: v for k, v in b.items() if k != "m"} for b in books]
        merged = rb.merge(books, [item_for(b) for b in books])
        self.assertEqual(merged, settled)
        self.assertEqual(rb.lost_history(books, merged), [])


if __name__ == "__main__":
    unittest.main()
