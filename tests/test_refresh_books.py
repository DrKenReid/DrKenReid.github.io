"""refresh_books.merge(): the weekly Goodreads refresh never loses a read.

Goodreads' feed reports only the latest finish of each book, so the
earlier finishes (`p`) exist nowhere but in data/books.json: once the
refresh drops one, the reading calendar, the year counts and the streak
lose that session for good. These cases pin the rules in the module
docstring of .github/scripts/refresh_books.py with small hand-built
records, plus one round trip over the real file.

keep_covers(): the reading pages show each book's cover from the site's
own copies, a full one and a small one for tiles, and ask only for the
files a record's marks (`k`, `s`) name. A mark with no file behind it is
a broken picture on the wall, and a cover that cannot be fetched must
never cost the week's reading data. local_cover() is the same store for
the books in progress, which refresh_now.py writes into now.json. The
cover cases run against a temporary folder and a stand-in for the
network.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import contextlib
import io
import json
import struct
import sys
import tempfile
import unittest
import urllib.error
from datetime import date, datetime
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import refresh_books as rb  # noqa: E402
import refresh_now as rn  # noqa: E402


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
        "book_large_image_url": rb.GR_COVERS + b["c"] if b.get("c") else "",
        "book_published": str(b["y"]) if b.get("y") else "",
    }


def by_id(books):
    return {b["g"]: b for b in books}


def jpeg(height, width=260, pad=0):
    """A JPEG as far as its header goes: the start-of-frame segment, which
    holds the size, then `pad` bytes for weight."""
    frame = struct.pack(">HBHHB", 11, 8, height, width, 1) + b"\x01\x11\x00"
    return b"\xff\xd8\xff\xc0" + frame + bytes(pad) + b"\xff\xd9"


# A light cover, as every address answers unless a test says otherwise.
JPEG = jpeg(400)


def no_network(url):
    raise AssertionError("a test reached for the network: %s" % url)


def run_main(old, items, argv=(), cover=no_network):
    """main() over a books.json in a temporary folder, with `items` for
    the feed and `cover` for fetch_cover(). Returns its exit status, the
    books.json it left, whether it wrote reading.json, what it printed
    and the cover files it wrote ({name: bytes}, a small copy as
    "s/<name>")."""
    with tempfile.TemporaryDirectory() as tmp:
        books = Path(tmp) / "books.json"
        summary = Path(tmp) / "reading.json"
        covers = Path(tmp) / "shelf"
        books.write_text(json.dumps(old), encoding="utf-8")
        out = io.StringIO()
        feed = (mock.patch.object(rb, "fetch_items", return_value=items) if items is not None
                else mock.patch.object(rb, "fetch_items", side_effect=AssertionError("no feed here")))
        with mock.patch.object(rb, "BOOKS", books), \
                mock.patch.object(rb, "SUMMARY", summary), \
                mock.patch.object(rb, "COVERS", covers), \
                mock.patch.object(rb, "COVER_PAUSE", 0), \
                mock.patch.object(rb, "fetch_cover", cover), \
                feed, contextlib.redirect_stdout(out):
            code = rb.main(list(argv))
        files = {p.relative_to(covers).as_posix(): p.read_bytes() for p in covers.rglob("*.jpg")}
        return code, json.loads(books.read_text(encoding="utf-8")), summary.exists(), out.getvalue(), files


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

    def test_pages_come_from_the_feed_and_are_kept_when_it_has_none(self):
        it = item("1", read="2024/02/01")
        it["book/num_pages"] = "320"
        b = rb.merge_one({}, it)
        self.assertEqual(b["n"], 320)
        it["book/num_pages"] = ""
        self.assertEqual(rb.merge_one(b, it)["n"], 320)
        it["book/num_pages"] = "0"
        self.assertNotIn("n", rb.merge_one({}, it))

    def test_the_year_published_comes_from_the_feed_and_is_kept_when_it_has_none(self):
        it = item("1", read="2024/02/01")
        it["book_published"] = "1945"
        b = rb.merge_one({}, it)
        self.assertEqual(b["y"], 1945)
        # A week with no year, or something that is not one, keeps the year on file.
        for week in ("", "unknown", "0"):
            it["book_published"] = week
            self.assertEqual(rb.merge_one(b, it)["y"], 1945)
        self.assertNotIn("y", rb.merge_one({}, it))

    def test_the_year_on_file_wins_over_the_feeds(self):
        # refresh_book_details.py writes the original year; the feed's may
        # be the edition's, and must not undo it every Monday.
        it = item("1", read="2024/02/01")
        it["book_published"] = "2004"
        self.assertEqual(rb.merge_one({"y": 1954}, it)["y"], 1954)

    def test_the_genres_stay_with_the_record(self):
        # The feed carries no genres: a week's merge keeps what
        # refresh_book_details.py set, in the place it writes them.
        it = item("1", read="2024/02/01")
        it["book_published"] = "1954"
        b = rb.merge_one({"y": 1954, "gn": ["fantasy"], "w": "701"}, it)
        self.assertEqual(b["gn"], ["fantasy"])
        self.assertEqual(list(b), ["t", "a", "r", "g", "y", "gn", "w", "d"])
        self.assertNotIn("gn", rb.merge_one({}, it))

    def test_the_cover_comes_from_the_feed_and_is_kept_when_it_has_none(self):
        it = item("1", read="2024/02/01")
        it["book_large_image_url"] = rb.GR_COVERS + "1670752670l/1._SY475_.jpg"
        b = rb.merge_one({}, it)
        self.assertEqual(b["c"], "1670752670l/1._SY475_.jpg")
        # A week with no cover, or Goodreads' placeholder, keeps the one on file.
        it["book_large_image_url"] = ""
        self.assertEqual(rb.merge_one(b, it)["c"], "1670752670l/1._SY475_.jpg")
        it["book_large_image_url"] = "https://s.gr-assets.com/assets/nophoto/book/111x148.png"
        self.assertEqual(rb.merge_one(b, it)["c"], "1670752670l/1._SY475_.jpg")
        self.assertNotIn("c", rb.merge_one({}, it))
        # A cover from anywhere else is kept whole.
        it["book_large_image_url"] = "https://images.example.org/cover.jpg"
        self.assertEqual(rb.merge_one({}, it)["c"], "https://images.example.org/cover.jpg")

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
        return run_main(old, items)[:4]

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


def shelved(g, cover=True, **more):
    """A record on file, with Goodreads' cover unless told otherwise."""
    b = {"t": "Book %s" % g, "a": "An Author", "r": 4, "g": g}
    if cover:
        b["c"] = "17000000%sl/%s._SY475_.jpg" % (g, g)
    b.update({"w": "70" + g, "d": "2025/01/01"})
    b.update(more)
    return b


def full(b):
    """Where a record's full copy is asked for."""
    return rb.cover_source(b["c"])


def small(b):
    """Where its small copy is."""
    return rb.cover_source(b["c"], rb.COVER_SMALL_HEIGHT)


def marks(books):
    return [[b.get(mark) for mark in rb.COVER_MARKS] for b in books]


class CoverStore(unittest.TestCase):
    """A temporary folder for the covers and a network that is a dict."""

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.folder = Path(tmp.name) / "shelf"
        patch = mock.patch.object(rb, "COVERS", self.folder)
        patch.start()
        self.addCleanup(patch.stop)
        self.asked = []

    def network(self, answers=None):
        """Answers every address with a JPEG, or with what `answers` holds
        for it (an exception is raised)."""
        def fetch(url):
            self.asked.append(url)
            answer = (answers or {}).get(url, JPEG)
            if isinstance(answer, Exception):
                raise answer
            return answer
        return fetch

    def keep(self, books, answers=None, **more):
        return rb.keep_covers(books, fetch=self.network(answers), sleep=lambda s: None, **more)

    def files(self):
        return sorted(p.relative_to(self.folder).as_posix() for p in self.folder.rglob("*") if p.is_file())


class Covers(CoverStore):
    """keep_covers(): two copies of each cover on the site, each fetched
    once, and a mark on exactly the records whose file is there."""

    def test_the_copies_come_from_goodreads_at_two_heights(self):
        for c, stem in (("1775316794l/250638183._SY475_.jpg", "1775316794l/250638183"),
                        ("1671161623l/68046804._SX318_.jpg", "1671161623l/68046804"),
                        ("1524349510l/39909963.jpg", "1524349510l/39909963")):
            self.assertEqual(rb.cover_source(c), rb.GR_COVERS + stem + "._SY%d_.jpg" % rb.COVER_HEIGHT)
            self.assertEqual(rb.cover_source(c, rb.COVER_SMALL_HEIGHT),
                             rb.GR_COVERS + stem + "._SY%d_.jpg" % rb.COVER_SMALL_HEIGHT)
        self.assertLess(rb.COVER_SMALL_HEIGHT, rb.COVER_HEIGHT)
        # A cover from anywhere else is asked for as it is.
        self.assertEqual(rb.cover_source("https://images.example.org/cover.jpg"),
                         "https://images.example.org/cover.jpg")

    def test_missing_copies_are_fetched_once_and_the_record_marked(self):
        shelf = [shelved("1"), shelved("2")]
        books, fetched, problems = self.keep(shelf)
        self.assertEqual((fetched, problems), (4, []))
        self.assertEqual(self.asked, [full(shelf[0]), small(shelf[0]), full(shelf[1]), small(shelf[1])])
        self.assertEqual(self.files(), ["1.jpg", "2.jpg", "s/1.jpg", "s/2.jpg"])
        self.assertEqual((self.folder / "s" / "1.jpg").read_bytes(), JPEG)
        self.assertEqual(marks(books), [[1, 1], [1, 1]])
        # The marks sit after c, where merge_one() puts them: the file's
        # text does not depend on which of the two wrote the record.
        self.assertEqual(list(books[0]), ["t", "a", "r", "g", "c", "k", "s", "w", "d"])
        self.assertEqual(list(rb.merge_one(books[0], item_for(books[0]))),
                         ["t", "a", "r", "g", "c", "k", "s", "w", "d"])
        # A second run has nothing to do and changes nothing.
        again, fetched, problems = self.keep(books)
        self.assertEqual((again, fetched, problems, len(self.asked)), (books, 0, [], 4))

    def test_only_the_copy_that_is_missing_is_fetched(self):
        # The store as it stood when the small copy was added: every book
        # with its full one.
        b = shelved("1", k=1)
        rb.write_whole(self.folder / "1.jpg", JPEG)
        books, fetched, _ = self.keep([b])
        self.assertEqual((self.asked, fetched, marks(books)), ([small(b)], 1, [[1, 1]]))

    def test_a_copy_that_cannot_be_fetched_is_tried_again_next_time(self):
        shelf = [shelved("1"), shelved("2")]
        books, fetched, problems = self.keep(shelf, {full(shelf[0]): rb.CoverError("HTTP 404")})
        self.assertEqual(fetched, 3)
        self.assertEqual(problems, ["Book 1 (1, %dpx): HTTP 404" % rb.COVER_HEIGHT])
        # The small copy came, so a tile still has the book's own cover.
        self.assertEqual(marks(books), [[None, 1], [1, 1]])
        self.assertEqual(self.files(), ["2.jpg", "s/1.jpg", "s/2.jpg"])
        books, fetched, problems = self.keep(books)
        self.assertEqual((fetched, problems, marks(books)), (1, [], [[1, 1], [1, 1]]))

    def test_only_a_jpeg_of_a_sensible_size_is_kept(self):
        b = shelved("1")
        for answer, why in ((b"GIF89a" + bytes(40), "not a JPEG"),
                            (b"<html>Not found</html>", "not a JPEG"),
                            (b"", "not a JPEG"),
                            (JPEG + bytes(rb.COVER_MAX_BYTES), "larger than")):
            books, fetched, problems = self.keep([b], {full(b): answer, small(b): answer})
            self.assertEqual(fetched, 0)
            self.assertIn(why, problems[0])
            self.assertEqual((marks(books), self.files()), ([[None, None]], []))

    def test_a_heavy_upload_is_asked_for_again_a_pixel_shorter(self):
        # A cover no taller than the height asked for comes back as it
        # was uploaded, sometimes at seven times a compressed one's size.
        b = shelved("1")
        heavy, light = jpeg(350, pad=rb.COVER_HEAVY), jpeg(349)
        books, fetched, problems = self.keep([b], {full(b): heavy, rb.cover_source(b["c"], 349): light})
        self.assertEqual(self.asked, [full(b), rb.cover_source(b["c"], 349), small(b)])
        self.assertEqual((self.folder / "1.jpg").read_bytes(), light)
        self.assertEqual((fetched, problems, marks(books)), (2, [], [[1, 1]]))

    def test_a_heavy_cover_with_nothing_lighter_is_kept_as_it_came(self):
        b = shelved("1")
        heavy = jpeg(400, pad=rb.COVER_HEAVY)
        for second in (rb.CoverError("HTTP 503"), heavy + b"\x00", b"<html>Not found</html>"):
            books, fetched, problems = self.keep([b], {full(b): heavy, rb.cover_source(b["c"], 399): second})
            self.assertEqual((self.folder / "1.jpg").read_bytes(), heavy)
            self.assertEqual((fetched, problems, marks(books)), (2, [], [[1, 1]]))
            (self.folder / "1.jpg").unlink()
            (self.folder / "s" / "1.jpg").unlink()

    def test_a_mark_with_no_file_behind_it_is_fetched_again(self):
        books, fetched, _ = self.keep([shelved("1", k=1, s=1)])
        self.assertEqual((fetched, marks(books)), (2, [[1, 1]]))
        self.assertEqual(self.files(), ["1.jpg", "s/1.jpg"])

    def test_a_record_with_no_cover_is_never_marked(self):
        books, fetched, problems = self.keep([shelved("1", cover=False, k=1, s=1)])
        self.assertEqual((fetched, problems, self.asked), (0, [], []))
        self.assertEqual(marks(books), [[None, None]])

    def test_an_id_that_is_not_a_number_names_no_file(self):
        books, fetched, _ = self.keep([shelved("../../index")])
        self.assertEqual((fetched, self.asked), (0, []))
        self.assertEqual(marks(books), [[None, None]])
        for mark in rb.COVER_MARKS:
            self.assertIsNone(rb.cover_file("../../index", mark))

    def test_a_host_that_is_down_is_left_alone_after_a_few_failures(self):
        n = rb.COVER_GIVE_UP + 3
        shelf = [shelved(str(i)) for i in range(1, n + 1)]
        down = {url: rb.CoverError("TimeoutError: timed out") for b in shelf for url in (full(b), small(b))}
        books, fetched, problems = self.keep(shelf, down)
        self.assertEqual((fetched, len(self.asked)), (0, rb.COVER_GIVE_UP))
        self.assertEqual(len(problems), rb.COVER_GIVE_UP + 1)
        self.assertIn("%d more left for the next run" % (2 * n - rb.COVER_GIVE_UP), problems[-1])
        self.assertEqual(marks(books), [[None, None]] * n)

    def test_a_cover_goodreads_replaces_loses_its_marks_in_the_merge(self):
        on_file = shelved("1", k=1, s=1)
        # The same cover, or a week with none: the marks stay with it.
        self.assertEqual(marks([rb.merge_one(on_file, item_for(on_file))]), [[1, 1]])
        self.assertEqual(marks([rb.merge_one(on_file, dict(item_for(on_file), book_large_image_url=""))]),
                         [[1, 1]])
        # Another cover: the copies on the site are of the old one.
        changed = dict(item_for(on_file), book_large_image_url=rb.GR_COVERS + "1800000001l/1.jpg")
        new = rb.merge_one(on_file, changed)
        self.assertEqual((new["c"], marks([new])), ("1800000001l/1.jpg", [[None, None]]))
        # keep_covers() then fetches the new one over the old files.
        for mark in rb.COVER_MARKS:
            rb.write_whole(rb.cover_file("1", mark), b"\xff\xd8\xff old")
        books, fetched, _ = self.keep([new])
        self.assertEqual((fetched, marks(books)), (2, [[1, 1]]))
        self.assertEqual([rb.cover_file("1", mark).read_bytes() for mark in rb.COVER_MARKS], [JPEG, JPEG])

    def test_a_book_missing_from_one_feed_keeps_its_marks(self):
        (carried,) = rb.merge([shelved("1", k=1, s=1)], [])
        self.assertEqual((marks([carried]), carried["m"]), ([[1, 1]], 1))

    def test_a_run_cut_short_has_saved_its_marks_and_the_next_starts_where_it_stopped(self):
        # Six hundred covers take ten minutes: a run stopped near the end
        # used to leave every file without its mark, to be fetched again.
        shelf = [shelved(str(i)) for i in range(1, 5)]
        saved, calls = [], []

        def fetch(url):
            calls.append(url)
            if len(calls) > 5:
                raise KeyboardInterrupt
            return JPEG
        with mock.patch.object(rb, "COVER_SAVE_EVERY", 2), self.assertRaises(KeyboardInterrupt):
            rb.keep_covers(shelf, fetch=fetch, sleep=lambda s: None,
                           save=lambda books: saved.append(json.loads(json.dumps(books))))
        # Saved after each of the first two books; the rest as they came.
        self.assertEqual(marks(saved[-1]), [[1, 1], [1, 1], [None, None], [None, None]])
        self.assertEqual(len(saved[-1]), len(shelf))
        books, fetched, _ = self.keep(saved[-1])
        self.assertEqual((fetched, marks(books)), (4, [[1, 1]] * 4))

    def test_a_file_is_never_left_half_written(self):
        path = self.folder / "s" / "9.jpg"
        rb.write_whole(path, JPEG)
        rb.write_whole(path, JPEG + b"more")
        self.assertEqual(path.read_bytes(), JPEG + b"more")
        self.assertEqual(self.files(), ["s/9.jpg"])
        # A write that was stopped before its move leaves a .part beside
        # the cover; the next run clears it, since the workflow commits
        # the whole folder.
        (self.folder / "s" / "8.jpg.part").write_bytes(b"\xff\xd8")
        self.keep([])
        self.assertEqual(self.files(), ["s/9.jpg"])


class LocalCover(CoverStore):
    """local_cover(): the store for a cover with no record on the shelf
    (the books in progress), by the address Goodreads gives it."""

    FEED = rb.GR_COVERS + "1552279563l/44327636._SY75_.jpg"
    OURS = "/img/covers/shelf/s/44327636.jpg"

    def local(self, url, answers=None):
        return rb.local_cover(url, fetch=self.network(answers))

    def test_a_goodreads_address_becomes_the_sites_small_copy(self):
        self.assertEqual(self.local(self.FEED), self.OURS)
        self.assertEqual(self.asked, [rb.GR_COVERS + "1552279563l/44327636._SY%d_.jpg" % rb.COVER_SMALL_HEIGHT])
        self.assertEqual(self.files(), ["s/44327636.jpg"])
        # The file is there now: no second request.
        self.assertEqual((self.local(self.FEED), len(self.asked)), (self.OURS, 1))

    def test_a_path_of_ours_is_kept_while_its_file_is_there(self):
        self.assertEqual(self.local(self.OURS), "")
        self.local(self.FEED)
        self.assertEqual(self.local(self.OURS), self.OURS)
        self.assertEqual(self.local("/img/covers/shelf/../../index.jpg"), "")
        self.assertEqual(len(self.asked), 1)

    def test_no_cover_to_be_had_is_no_address_at_all(self):
        for url in ("", None, "https://s.gr-assets.com/assets/nophoto/book/111x148.png",
                    "https://images.example.org/cover.jpg"):
            self.assertEqual(self.local(url), "")
        self.assertEqual(self.asked, [])
        gone = {rb.GR_COVERS + "1552279563l/44327636._SY%d_.jpg" % rb.COVER_SMALL_HEIGHT: rb.CoverError("HTTP 404")}
        self.assertEqual(self.local(self.FEED, gone), "")
        self.assertEqual(self.files(), [])


class ReadingNowCovers(CoverStore):
    """refresh_now.with_local_covers(): now.json's books in progress show
    the site's copies, and never an address on Goodreads' image host."""

    def reading(self):
        return [{"title": "The First Step", "author": "Tao Wong", "link": "https://www.goodreads.com/review/show/1",
                 "img": LocalCover.FEED},
                {"title": "No Cover", "author": "A. N. Other", "link": "https://www.goodreads.com/review/show/2"}]

    def test_each_cover_becomes_a_path_on_the_site(self):
        before = self.reading()
        after = rn.with_local_covers(before, local=lambda url: rb.local_cover(url, fetch=self.network()))
        self.assertEqual(after[0], dict(before[0], img=LocalCover.OURS))
        self.assertEqual(after[1], before[1])
        self.assertEqual(before[0]["img"], LocalCover.FEED)   # the list handed in is not changed
        # A second pass (a week the feed failed, so last week's list is kept) changes nothing.
        again = rn.with_local_covers(after, local=lambda url: rb.local_cover(url, fetch=self.network()))
        self.assertEqual((again, len(self.asked)), (after, 1))

    def test_a_cover_that_cannot_be_had_is_left_out_not_hotlinked(self):
        down = {rb.cover_source("1552279563l/44327636.jpg", rb.COVER_SMALL_HEIGHT): rb.CoverError("HTTP 503")}
        after = rn.with_local_covers(self.reading(), local=lambda url: rb.local_cover(url, fetch=self.network(down)))
        self.assertNotIn("img", after[0])
        self.assertNotIn("gr-assets", json.dumps(after))

    def test_covers_alone_rewrites_now_json_and_nothing_else_in_it(self):
        now = {"track": {"name": "A", "artist": "B", "url": "", "nowPlaying": False},
               "reading": self.reading(), "updated": "2026-11-02"}
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "now.json"
            path.write_text(json.dumps(now), encoding="utf-8")
            out = io.StringIO()
            with mock.patch.object(rn, "DATA", Path(tmp)), \
                    mock.patch.object(rb, "fetch_cover", self.network()), \
                    mock.patch.object(rn, "get", no_network), contextlib.redirect_stdout(out):
                code = rn.main(["--covers"])
            written = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual(code, 0)
        self.assertEqual(written["reading"][0]["img"], LocalCover.OURS)
        self.assertEqual({k: v for k, v in written.items() if k != "reading"},
                         {k: v for k, v in now.items() if k != "reading"})


class CoversInMain(unittest.TestCase):
    """main(): a new book's cover arrives with it, and a cover is never
    the reason the week's reading is not written."""

    def test_the_weekly_run_writes_a_new_books_covers_and_its_marks_together(self):
        old = [shelved("1")]
        new = shelved("2", d="2026/03/01")
        code, written, wrote_summary, out, files = run_main(
            old, [item_for(new), item_for(old[0])], cover=lambda url: JPEG)
        self.assertEqual(code, 0)
        self.assertTrue(wrote_summary)
        self.assertEqual({b["g"]: marks([b])[0] for b in written}, {"1": [1, 1], "2": [1, 1]})
        self.assertEqual(files, {"1.jpg": JPEG, "2.jpg": JPEG, "s/1.jpg": JPEG, "s/2.jpg": JPEG})
        self.assertIn("covers: of 2 books, 2 have the full copy on the site and 2 the small one (4 files fetched)", out)

    def test_a_cover_that_fails_is_a_warning_and_the_books_are_still_written(self):
        def refused(url):
            raise rb.CoverError("HTTP 404")
        old = [shelved("1")]
        code, written, wrote_summary, out, files = run_main(
            old, [item_for(shelved("2")), item_for(old[0])], cover=refused)
        self.assertEqual((code, wrote_summary, files), (0, True, {}))
        self.assertEqual(sorted(b["g"] for b in written), ["1", "2"])
        self.assertEqual(marks(written), [[None, None]] * 2)
        self.assertIn("::warning::cover not fetched: Book 2 (2, %dpx): HTTP 404" % rb.COVER_HEIGHT, out)

    def test_even_a_fault_in_the_cover_stage_leaves_the_books_written(self):
        def broken(url):
            raise ValueError("something nobody planned for")
        code, written, wrote_summary, out, _ = run_main([], [item_for(shelved("2"))], cover=broken)
        self.assertEqual((code, wrote_summary, len(written)), (0, True, 1))
        self.assertIn("::warning::covers: ValueError", out)

    def test_a_dry_run_fetches_no_cover(self):
        old = [shelved("1")]
        code, written, wrote_summary, out, files = run_main(old, [item_for(old[0])], ["--dry-run"])
        self.assertEqual((code, written, wrote_summary, files), (0, old, False, {}))
        self.assertIn("2 cover files to fetch", out)

    def test_covers_alone_reads_no_feed_and_writes_only_the_marks(self):
        old = [shelved("1"), shelved("2", cover=False), shelved("3", p=["2019/01/01"])]
        code, written, wrote_summary, _, files = run_main(old, None, ["--covers"], cover=lambda url: JPEG)
        self.assertEqual((code, wrote_summary), (0, False))
        self.assertEqual(sorted(files), ["1.jpg", "3.jpg", "s/1.jpg", "s/3.jpg"])
        self.assertEqual([{k: v for k, v in b.items() if k not in rb.COVER_MARKS} for b in written], old)
        self.assertEqual(marks(written), [[1, 1], [None, None], [1, 1]])

    def test_covers_alone_writes_the_marks_as_it_goes(self):
        # What books.json holds each time the network is asked: a run
        # stopped at any of these moments has lost two files' marks at most.
        on_file = []

        def cover(url):
            books = json.loads(rb.BOOKS.read_text(encoding="utf-8"))
            on_file.append(sum(1 for b in books for mark in rb.COVER_MARKS if b.get(mark)))
            return JPEG
        with mock.patch.object(rb, "COVER_SAVE_EVERY", 2):
            code, written, _, _, _ = run_main([shelved("1"), shelved("2"), shelved("3")], None,
                                              ["--covers"], cover=cover)
        self.assertEqual((code, on_file), (0, [0, 0, 2, 2, 4, 4]))
        self.assertEqual(marks(written), [[1, 1]] * 3)


class Answer:
    """What urlopen() hands back, as far as fetch_cover() looks at it."""

    def __init__(self, body=JPEG, url="https://covers.example.org/1.jpg"):
        self.body, self.url = body, url

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def geturl(self):
        return self.url

    def read(self, n=-1):
        return self.body if n < 0 else self.body[:n]


def http_error(code):
    return urllib.error.HTTPError("https://covers.example.org/1.jpg", code, "", {}, None)


class FetchCover(unittest.TestCase):
    """fetch_cover(): patient with an answer that may change, quick to
    believe one that will not, and anonymous."""

    def fetch(self, *answers):
        """(the bytes or the CoverError, the requests made, the waits)."""
        queue, requests, waits = list(answers), [], []

        def urlopen(request, timeout=None):
            requests.append(request)
            answer = queue.pop(0)
            if isinstance(answer, Exception):
                raise answer
            return answer
        with mock.patch.object(rb.urllib.request, "urlopen", urlopen):
            try:
                got = rb.fetch_cover("https://covers.example.org/1.jpg", sleep=waits.append)
            except rb.CoverError as e:
                got = e
        return got, requests, waits

    def test_a_server_error_or_a_dropped_connection_is_tried_again(self):
        got, requests, waits = self.fetch(http_error(503), TimeoutError("timed out"), Answer())
        self.assertEqual((got, len(requests)), (JPEG, 3))
        self.assertEqual(waits, sorted(waits))
        self.assertEqual(len(waits), 2)

    def test_it_gives_up_after_its_tries(self):
        got, requests, _ = self.fetch(*[http_error(500)] * rb.COVER_TRIES)
        self.assertIsInstance(got, rb.CoverError)
        self.assertEqual((str(got), len(requests)), ("HTTP 500", rb.COVER_TRIES))

    def test_a_404_is_believed_the_first_time(self):
        got, requests, waits = self.fetch(http_error(404), Answer())
        self.assertEqual((str(got), len(requests), waits), ("HTTP 404", 1, []))

    def test_a_redirect_to_the_placeholder_is_not_a_cover(self):
        placeholder = Answer(url="https://s.gr-assets.com/assets/nophoto/book/111x148.png")
        got, requests, _ = self.fetch(placeholder, Answer())
        self.assertIsInstance(got, rb.CoverError)
        self.assertEqual(len(requests), 1)

    def test_no_more_than_a_byte_over_the_limit_is_read(self):
        got, _, _ = self.fetch(Answer(JPEG + bytes(2 * rb.COVER_MAX_BYTES)))
        self.assertEqual(len(got), rb.COVER_MAX_BYTES + 1)
        with self.assertRaises(rb.CoverError):
            rb.check_cover(got)

    def test_the_request_says_what_is_asking_and_not_who(self):
        _, requests, _ = self.fetch(Answer())
        agent = requests[0].get_header("User-agent")
        self.assertEqual(agent, rb.COVER_UA)
        self.assertNotRegex(agent.lower(), r"ken|reid|@|\.uk|https?:")


class RealShelf(unittest.TestCase):
    """The committed books.json, fed back as the feed that describes it,
    merges to itself: whatever the file holds, the rules keep it."""

    def test_every_marked_cover_is_a_file_on_the_site(self):
        # The pages ask for a record's cover files (the full copy for k,
        # the small one under s/ for s) whenever it has the mark, with no
        # check of their own: a mark without its file is a failed request
        # and a broken picture.
        books = json.loads(rb.BOOKS.read_text(encoding="utf-8"))
        for mark in rb.COVER_MARKS:
            missing = [b["g"] for b in books if b.get(mark) and not rb.has_cover(b, mark)]
            self.assertEqual(missing, [], mark)
            for b in books:
                if b.get(mark):
                    with open(rb.cover_file(b["g"], mark), "rb") as f:
                        self.assertEqual(f.read(3), b"\xff\xd8\xff", (mark, b["g"]))

    def test_the_books_in_progress_show_only_files_that_are_there(self):
        # now.json's img is a path into the same store once the weekly
        # refresh has run; Reading Now asks for it as it is.
        now = json.loads((rb.ROOT / "data" / "now.json").read_text(encoding="utf-8"))
        for book in now.get("reading") or []:
            img = book.get("img", "")
            if img.startswith(rb.SITE_COVERS):
                self.assertEqual(rb.local_cover(img, fetch=no_network), img, book["title"])

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
