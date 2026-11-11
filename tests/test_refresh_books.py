"""refresh_books: the shelf from a Goodreads library export, never losing a read.

Goodreads retired its RSS feeds in October 2026, so data/books.json is
refreshed from the library export I download. The plain export gives
one finish date a book, so the earlier finishes (`p`) exist for most
books nowhere but in books.json: once a run drops one, the reading
calendar, the year counts and the streak lose that session for good.
These cases pin the rules in the module docstring of
.github/scripts/refresh_books.py with small hand-built records and a
made-up export (tests/fixtures/goodreads_library_export.csv, the real
column names and no real data), plus one round trip over the real file.

keep_covers(): the reading pages show each book's cover from the site's
own copies, a full one and a small one for tiles, and ask only for the
files a record's marks (`k`, `s`) name. A mark with no file behind it is
a broken picture on the wall, and a cover that cannot be fetched must
never cost the reading data. A book an export brings has its cover found
at Open Library (add_cover_sources), and reading_cover() is the same
store for the books in progress, which refresh_now.write_reading() puts
in now.json. The cover cases run against a temporary folder and a
stand-in for the network.

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
from datetime import date
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import refresh_book_details as rbd  # noqa: E402
import refresh_books as rb  # noqa: E402
import refresh_now as rn  # noqa: E402
import validate_data  # noqa: E402

try:  # fit_cover's cases need Pillow; the rest run without it
    from PIL import Image
except ImportError:
    Image = None

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "goodreads_library_export.csv"


def item(g, title="A Book", author="An Author", rating=4, finishes=(), added="2024/01/01",
         count=None, shelf="read", **more):
    """One finished book, as export_items() returns it."""
    it = {"g": g, "t": title, "a": author, "r": rating, "v": False, "i": "", "n": None, "y": None,
          "finishes": sorted(finishes), "added": added,
          "count": len(finishes) if count is None else count, "shelf": shelf}
    it.update(more)
    return it


def item_for(b):
    """The export item that says exactly what record `b` says, as an
    enhanced export (every finish in read_dates) would."""
    return item(b["g"], b["t"], b["a"], b["r"], finishes=rb.sessions(b),
                added=b["d"] if b.get("e") else "2024/01/01",
                count=b.get("rc") or len(rb.sessions(b)), v=bool(b.get("v")), i=b.get("i", ""),
                n=b.get("n"), y=b.get("y"))


def merged(old, items, reading=()):
    return rb.merge(old, items, reading)[0]


def by_id(books):
    return {b["g"]: b for b in books}


def jpeg(height, width=260, pad=0):
    """A JPEG as far as its header goes: the start-of-frame segment, which
    holds the size, then `pad` bytes for weight."""
    frame = struct.pack(">HBHHB", 11, 8, height, width, 1) + b"\x01\x11\x00"
    return b"\xff\xd8\xff\xc0" + frame + bytes(pad) + b"\xff\xd9"


# A light cover, as every address answers unless a test says otherwise.
JPEG = jpeg(400)


def no_network(*args, **kwargs):
    raise AssertionError("a test reached for the network: %s" % (args,))


class Export(unittest.TestCase):
    """read_export() and export_items(): the columns a library export has,
    the public fields taken from them, and nothing private."""

    @classmethod
    def setUpClass(cls):
        cls.rows = rb.read_export(FIXTURE)
        cls.finished, cls.reading = rb.export_items(cls.rows)

    def test_the_finished_books_and_the_books_in_progress(self):
        # The read shelf, and a book being read again that has a finish.
        self.assertEqual([i["g"] for i in self.finished], ["101", "102", "103", "104", "105"])
        # Every book on currently-reading, in the export's order.
        self.assertEqual([i["g"] for i in self.reading], ["105", "106"])

    def test_the_fields_of_a_row(self):
        it = self.finished[0]
        self.assertEqual(
            {k: it[k] for k in ("g", "t", "a", "r", "v", "i", "n", "y", "finishes", "added", "count")},
            {"g": "101", "t": "The Lantern Road (The Lantern Cycle, #1)", "a": "Mara Quill", "r": 5, "v": True,
             "i": "9780441000001", "n": 412, "y": 1998, "finishes": ["2026/03/01"], "added": "2025/12/20",
             "count": 1})
        clock = by_id(self.finished)["104"]
        self.assertEqual((clock["t"], clock["r"]), ("The Clockmaker's Daughter", 0))
        bare = by_id(self.finished)["102"]
        self.assertEqual((bare["i"], bare["n"], bare["y"], bare["finishes"]), ("", None, 2021, []))

    def test_nothing_private_leaves_the_rows(self):
        text = json.dumps([self.finished, self.reading])
        for private in ("must never reach", "SECRET", "favourites", "Example Press", "Not for me"):
            self.assertNotIn(private, text)

    def test_the_cells_as_an_export_writes_them(self):
        self.assertEqual(rb.cell({"ISBN": '="0441013597"'}, "ISBN"), "0441013597")
        self.assertEqual(rb.export_isbn({"ISBN": '=""', "ISBN13": '=""'}), "")
        self.assertEqual(rb.export_isbn({"ISBN": '="044101359X"', "ISBN13": '=""'}), "044101359X")
        self.assertEqual(rb.export_number("765.0"), 765)
        for empty in ("", "0", "n/a", None):
            self.assertIsNone(rb.export_number(empty))
        self.assertEqual(rb.export_date("2026-10-24"), "2026/10/24")
        self.assertEqual(rb.export_date(""), "")

    def test_an_enhanced_export_gives_every_finish(self):
        row = dict(self.rows[2], read_dates="2015-01-01,2015-02-01;,2019-06-02;2026-01-01,")
        self.assertEqual(rb.export_finishes(row), ["2015/02/01", "2019/06/02"])

    def test_a_file_that_is_not_an_export_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "other.csv"
            path.write_text("Title,Author\nA,B\n", encoding="utf-8")
            with self.assertRaises(rb.ExportError):
                rb.read_export(path)
            with self.assertRaises(rb.ExportError):
                rb.read_export(Path(tmp) / "missing.csv")


class FirstRead(unittest.TestCase):
    def test_a_new_book_from_the_export(self):
        (b,) = merged([], [item("1", title="Dune", finishes=["2026/03/19"], i="9780441013593", n=412, y=1965)])
        self.assertEqual(b, {"t": "Dune", "a": "An Author", "r": 4, "i": "9780441013593", "g": "1",
                             "n": 412, "y": 1965, "d": "2026/03/19"})
        self.assertEqual(rb.sessions(b), ["2026/03/19"])


class ReRead(unittest.TestCase):
    def test_a_later_finish_moves_the_date_on_file_into_p(self):
        old = merged([], [item("1", finishes=["2021/05/01"])])
        new = by_id(merged(old, [item("1", finishes=["2026/09/01"])]))["1"]
        self.assertEqual((new["d"], new["p"]), ("2026/09/01", ["2021/05/01"]))

    def test_an_earlier_date_in_the_export_is_a_read_not_a_correction(self):
        # The plain export's Date Read is the first finish of most re-reads:
        # it joins p, and the latest stays d.
        old = [{"t": "A Book", "a": "An Author", "r": 4, "g": "1", "d": "2026/03/19", "p": ["2023/12/15"]}]
        new = by_id(merged(old, [item("1", finishes=["2023/12/15"], count=2)]))["1"]
        self.assertEqual((new["d"], new["p"]), ("2026/03/19", ["2023/12/15"]))
        self.assertNotIn("rc", new)
        self.assertEqual(rb.lost_history(old, [new]), [])

    def test_an_export_with_no_date_keeps_the_dates_on_file(self):
        old = [{"t": "A Book", "a": "An Author", "r": 4, "g": "1", "d": "2026/03/25", "p": ["2024/01/01"]}]
        new = by_id(merged(old, [item("1", finishes=[], count=2)]))["1"]
        self.assertEqual((new["d"], new["p"]), ("2026/03/25", ["2024/01/01"]))

    def test_a_read_count_above_the_dates_is_kept(self):
        (b,) = merged([], [item("1", finishes=["2022/03/29"], count=2)])
        self.assertEqual(b["rc"], 2)
        (b,) = merged([], [item("1", finishes=["2022/03/29", "2024/01/01"], count=2)])
        self.assertNotIn("rc", b)

    def test_the_same_export_again_changes_nothing(self):
        once = merged([], [item("1", finishes=["2019/01/01", "2026/09/01"], count=3), item("2")])
        self.assertEqual(merged(once, [item_for(b) for b in once]), once)


class DateAddedOnly(unittest.TestCase):
    def test_no_finish_date_uses_the_date_added_and_marks_it(self):
        (b,) = merged([], [item("1", added="2025/12/31")])
        self.assertEqual((b["d"], b["e"]), ("2025/12/31", 1))
        # The calendar and the year count leave a date-added book out.
        self.assertEqual(rb.sessions(b), [])

    def test_a_finish_replaces_the_date_added_without_counting_it(self):
        old = merged([], [item("1", added="2025/12/31")])
        new = by_id(merged(old, [item("1", finishes=["2026/02/01"])]))["1"]
        self.assertEqual(new["d"], "2026/02/01")
        self.assertNotIn("e", new)
        self.assertNotIn("p", new)


class WhatTheRecordKeeps(unittest.TestCase):
    def setUp(self):
        self.on_file = {"t": "The Path of Ascension (The Path of Ascension #1)", "a": "Karen Tang", "r": 3,
                        "v": 1, "i": "1416562591", "g": "1", "c": "1700000001l/1._SY475_.jpg", "k": 1, "s": 1,
                        "n": 570, "y": 1998, "gn": ["fantasy"], "w": "701", "d": "2025/01/01"}

    def test_the_export_wins_for_what_i_edit_the_record_for_the_rest(self):
        new = rb.merge_one(self.on_file, item("1", title="The Path of Ascension", author="Dr. Karen Tang MD MPH",
                                              rating=5, finishes=["2025/01/01"], i="9781416562597", n=440, y=2004,
                                              v=True))
        self.assertEqual(new, dict(self.on_file, r=5, n=440))
        # In the order the record was in: the file reads the same whoever wrote it.
        self.assertEqual(list(new), list(self.on_file))
        # A review deleted on Goodreads takes the mark with it.
        self.assertNotIn("v", rb.merge_one(self.on_file, item("1", finishes=["2025/01/01"])))

    def test_an_edition_change_keeps_the_record_and_its_history(self):
        old = [dict(self.on_file, p=["2020/01/01"]), {"t": "Other", "a": "An Author", "r": 3, "g": "2",
                                                      "d": "2024/06/01"}]
        moved = item("99", title=self.on_file["t"], author="Karen  Tang", finishes=["2025/01/01"])
        out, dropped = rb.merge(old, [moved, item_for(old[1])])
        new = by_id(out)["1"]   # its own id: it names the cover files
        self.assertEqual((new["p"], new["k"], new["s"], dropped), (["2020/01/01"], 1, 1, []))
        self.assertNotIn("99", by_id(out))

    def test_a_book_being_read_again_stays_on_the_shelf(self):
        old = [self.on_file]
        out, dropped = rb.merge(old, [], reading=[item("1", shelf="currently-reading")])
        self.assertEqual((out, dropped), ([self.on_file], []))

    def test_a_book_goodreads_no_longer_has_as_read_is_dropped(self):
        out, dropped = rb.merge([self.on_file], [item("2", finishes=["2026/01/01"])])
        self.assertEqual([b["g"] for b in out], ["2"])
        self.assertEqual(dropped, [self.on_file])

    def test_a_row_listed_twice_is_one_book(self):
        out = merged([], [item("1", finishes=["2026/01/01"]), item("1", finishes=["2020/01/01"])])
        self.assertEqual((len(out), out[0]["d"]), (1, "2026/01/01"))

    def test_the_log_says_what_changed(self):
        old = [dict(self.on_file)]
        new = merged(old, [item("1", rating=5, finishes=["2025/01/01", "2026/02/02"]),
                           item("2", title="New One", finishes=["2026/03/03"])])
        self.assertEqual(rb.changes(old, new), [
            "added: New One by An Author, 4/5, finished 2026/03/03",
            "rating: The Path of Ascension (The Path of Ascension #1), 3 -> 5",
            "finished again: The Path of Ascension (The Path of Ascension #1), 2026/02/02"])


class Summary(unittest.TestCase):
    def test_this_year_counts_every_session(self):
        books = [
            {"t": "A", "a": "x", "r": 5, "g": "1", "w": "1", "d": "2026/03/01",
             "p": ["2026/01/01", "2020/01/01"]},
            {"t": "B", "a": "x", "r": 4, "v": 1, "g": "2", "w": "2", "d": "2026/02/01", "e": 1},
            {"t": "C", "a": "x", "r": 3, "g": "3", "d": "2025/12/31", "rc": 2},
        ]
        self.assertEqual(rb.summarise(books, date(2026, 9, 23)), {
            "books": 3, "reviews": 1, "thisYear": 2, "rereads": 2, "updated": "2026-09-23"})


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

    def test_open_librarys_large_cover_is_the_full_copy_its_medium_the_small(self):
        c = rb.OL_COVER % 15270130
        self.assertEqual(c, "https://covers.openlibrary.org/b/id/15270130-L.jpg")
        self.assertEqual(rb.cover_source(c), c + "?default=false")
        self.assertEqual(rb.cover_source(c, rb.COVER_SMALL_HEIGHT),
                         "https://covers.openlibrary.org/b/id/15270130-M.jpg?default=false")

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

    def test_the_merge_keeps_the_cover_and_its_marks(self):
        on_file = shelved("1", k=1, s=1)
        self.assertEqual(marks([rb.merge_one(on_file, item_for(on_file))]), [[1, 1]])
        self.assertEqual(rb.merge_one(on_file, item_for(on_file))["c"], on_file["c"])

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
        # the cover; the next run clears it, since the folder is committed.
        (self.folder / "s" / "8.jpg.part").write_bytes(b"\xff\xd8")
        self.keep([])
        self.assertEqual(self.files(), ["s/9.jpg"])


class NewBookCovers(CoverStore):
    """add_cover_sources() and reading_cover(): a book an export brings has
    Open Library's cover, or none, and is never hotlinked."""

    def test_open_library_by_isbn_then_by_title_and_author(self):
        asked = []

        def search(url):
            asked.append(url)
            if "isbn=" in url:
                return {"docs": [{"title": "Babel", "author_name": ["R. F. Kuang"]}]}   # no cover
            return {"docs": [{"title": "Babel", "author_name": ["R.F. Kuang"], "cover_i": 12468631}]}
        b = {"t": "Babel", "a": "R.F. Kuang", "i": "9780063021426", "g": "57945316"}
        self.assertEqual(rb.find_cover(b, fetch=search, sleep=lambda s: None),
                         "https://covers.openlibrary.org/b/id/12468631-L.jpg")
        self.assertEqual(len(asked), 2)
        self.assertIn("isbn=9780063021426", asked[0])
        nothing = lambda url: {"docs": []}  # noqa: E731
        self.assertEqual(rb.find_cover(b, fetch=nothing, sleep=lambda s: None), "")

    def test_a_book_with_no_cover_anywhere_is_named_and_left_unmarked(self):
        books = [shelved("1"), shelved("2", cover=False), shelved("3", cover=False)]

        def find(b):
            if b["g"] == "3":
                raise rbd.AskError("HTTP 503")
            return ""
        out, found, missing = rb.add_cover_sources(books, find=find, sleep=lambda s: None)
        self.assertEqual((found, [b.get("c") for b in out]), (0, [books[0]["c"], None, None]))
        self.assertEqual(missing, ["Book 2 (2): Open Library has no cover for it; set in type",
                                   "Book 3 (3): AskError: HTTP 503; set in type"])
        books, fetched, problems = self.keep(out)
        self.assertEqual(marks(books), [[1, 1], [None, None], [None, None]])

    def test_a_found_cover_is_kept_like_any_other(self):
        books = [shelved("2", cover=False)]
        out, found, missing = rb.add_cover_sources(books, find=lambda b: rb.OL_COVER % 7, sleep=lambda s: None)
        self.assertEqual((found, missing, list(out[0])), (1, [], ["t", "a", "r", "g", "c", "w", "d"]))
        books, fetched, _ = self.keep(out)
        self.assertEqual(self.asked, [rb.cover_source(rb.OL_COVER % 7),
                                      rb.cover_source(rb.OL_COVER % 7, rb.COVER_SMALL_HEIGHT)])
        self.assertEqual((fetched, marks(books)), (2, [[1, 1]]))

    def test_the_books_in_progress_show_the_sites_copies(self):
        ours = "/img/covers/shelf/s/%s.jpg"
        on_file = shelved("1", k=1, s=1)
        rb.write_whole(rb.cover_file("1", "s"), JPEG)
        # On the shelf: its own small copy, asking nothing.
        self.assertEqual(rb.reading_cover("1", on_file, {}, find=no_network, fetch=no_network), ours % "1")
        # Not on the shelf: Open Library's, fetched once, then kept.
        got = rb.reading_cover("2", None, {"t": "x"}, find=lambda b: rb.OL_COVER % 9, fetch=self.network())
        self.assertEqual((got, self.asked), (ours % "2", [rb.cover_source(rb.OL_COVER % 9, rb.COVER_SMALL_HEIGHT)]))
        self.assertEqual(rb.reading_cover("2", None, {}, find=no_network, fetch=no_network), ours % "2")
        # None anywhere, or a host that is down: no picture, never an address elsewhere.
        self.assertEqual(rb.reading_cover("3", None, {}, find=lambda b: "", fetch=no_network), "")
        down = {rb.cover_source(rb.OL_COVER % 4, rb.COVER_SMALL_HEIGHT): rb.CoverError("HTTP 503")}
        self.assertEqual(rb.reading_cover("4", None, {}, find=lambda b: rb.OL_COVER % 4,
                                          fetch=self.network(down)), "")
        self.assertEqual(rb.reading_cover("../x", None, {}, find=no_network, fetch=no_network), "")


class ReadingNow(unittest.TestCase):
    """refresh_now: the weekly run writes the track and keeps the books in
    progress; an export writes the books in progress and keeps the track.
    Either way now.json holds to its schema."""

    TRACK = {"name": "A", "artist": "B", "url": "", "nowPlaying": False}

    def schema_errors(self, now):
        schema = json.loads((validate_data.SCHEMAS / "now.schema.json").read_text(encoding="utf-8"))
        errors = []
        validate_data.validate(now, schema, "now.json", errors)
        return errors

    def test_an_export_writes_the_list_and_its_date_and_keeps_the_track(self):
        before = {"track": self.TRACK, "reading": [], "updated": "2026-11-09"}
        books = [rn.reading_entry("T%d" % i, "A", "https://www.goodreads.com/book/show/%d" % i,
                                  "/img/covers/shelf/s/%d.jpg" % i if i % 2 else "") for i in range(5)]
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "now.json").write_text(json.dumps(before), encoding="utf-8")
            with mock.patch.object(rn, "DATA", Path(tmp)), contextlib.redirect_stdout(io.StringIO()):
                rn.write_reading(books, "2026-11-06")
            now = json.loads((Path(tmp) / "now.json").read_text(encoding="utf-8"))
        self.assertEqual(now["track"], self.TRACK)
        self.assertEqual((now["updated"], now["readingUpdated"]), ("2026-11-09", "2026-11-06"))
        self.assertEqual([b["title"] for b in now["reading"]], ["T0", "T1", "T2"])
        self.assertNotIn("img", now["reading"][0])
        self.assertEqual(self.schema_errors(now), [])

    def test_the_weekly_run_keeps_the_list_and_its_date(self):
        before = {"track": None, "reading": [rn.reading_entry("T", "A", "L")], "updated": "2026-11-02",
                  "readingUpdated": "2026-11-06"}
        now = rn.now_with(before, track=self.TRACK, today="2026-11-16")
        self.assertEqual(now, {"track": self.TRACK, "reading": before["reading"], "updated": "2026-11-16",
                               "readingUpdated": "2026-11-06"})
        self.assertEqual(self.schema_errors(now), [])

    def test_the_weekly_run_asks_goodreads_nothing(self):
        # Last.fm answers; anything else would be a request the run should not make.
        def lastfm(method, key, **params):
            return {"user.getinfo": {"user": {"playcount": "10"}},
                    "user.getrecenttracks": {"recenttracks": {"track": []}},
                    "user.gettopalbums": {"topalbums": {"album": []}}}[method]
        before = {"track": None, "reading": [rn.reading_entry("T", "A", "L")], "updated": "2026-11-02"}
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "now.json").write_text(json.dumps(before), encoding="utf-8")
            with mock.patch.object(rn, "DATA", Path(tmp)), mock.patch.object(rn, "lastfm", lastfm), \
                    mock.patch.object(rn, "get", no_network), mock.patch.dict("os.environ", {"LASTFM_API_KEY": "k"}), \
                    contextlib.redirect_stdout(io.StringIO()):
                code = rn.main([])
            now = json.loads((Path(tmp) / "now.json").read_text(encoding="utf-8"))
        self.assertEqual((code, now["reading"]), (0, before["reading"]))


def run_main(old, argv, export=FIXTURE, cover=no_network, find=no_network, now=None):
    """main() over a books.json in a temporary folder, with `cover` for
    fetch_cover() and `find` for Open Library's covers. The years and
    genres step is replaced with a stand-in. Returns its exit status, the
    books.json it left, the reading.json and now.json it wrote (or None),
    what it printed, the cover files it wrote and the calls the details
    step had."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        books, summary, covers = tmp / "books.json", tmp / "reading.json", tmp / "shelf"
        books.write_text(json.dumps(old), encoding="utf-8")
        if now is not None:
            (tmp / "now.json").write_text(json.dumps(now), encoding="utf-8")
        args = [a if a != "EXPORT" else str(export) for a in argv]
        details = mock.Mock(return_value=0)
        out = io.StringIO()
        with mock.patch.object(rb, "BOOKS", books), mock.patch.object(rb, "SUMMARY", summary), \
                mock.patch.object(rb, "COVERS", covers), mock.patch.object(rb, "COVER_PAUSE", 0), \
                mock.patch.object(rb, "fetch_cover", cover), mock.patch.object(rb, "find_cover", find), \
                mock.patch.object(rbd, "refresh", details), mock.patch.object(rn, "DATA", tmp), \
                contextlib.redirect_stdout(out):
            code = rb.main(args)
        files = {p.relative_to(covers).as_posix(): p.read_bytes() for p in covers.rglob("*.jpg")}

        def read(path):
            return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None
        return (code, read(books), read(summary), read(tmp / "now.json"), out.getvalue(), files,
                details.call_args_list)


class ExportMain(unittest.TestCase):
    """main() --export: one run does what the weekly refresh used to."""

    def test_the_export_reaches_every_file(self):
        old = [shelved("103", t="Second Winter (The Lantern Cycle, #2)", a="Mara Quill", d="2019/06/02",
                       p=["2012/01/01"], k=1, s=1)]
        code, books, summary, now, out, files, details = run_main(
            old, ["--export", "EXPORT"], cover=lambda url: JPEG, find=lambda b: rb.OL_COVER % int(b["g"]),
            now={"track": None, "reading": [], "updated": "2026-11-09"})
        self.assertEqual(code, 0)
        self.assertEqual([b["g"] for b in books], ["101", "104", "102", "105", "103"])
        second = by_id(books)["103"]
        self.assertEqual((second["p"], second["r"], second["c"]), (["2012/01/01"], 4, old[0]["c"]))
        self.assertEqual(by_id(books)["105"]["rc"], 2)
        self.assertEqual(summary["books"], 5)
        # A cover for each new book, and the one on file fetched again only where its files are missing.
        self.assertEqual(by_id(books)["101"]["c"], rb.OL_COVER % 101)
        self.assertIn("s/101.jpg", files)
        # The years and genres from the same export, then the books in progress.
        self.assertEqual(len(details), 1)
        self.assertEqual([b["title"] for b in now["reading"]], ["An Atlas of Small Rivers", "Fieldwork for Beginners"])
        self.assertEqual(now["reading"][1]["link"], "https://www.goodreads.com/book/show/106")
        self.assertIn("readingUpdated", now)
        self.assertIn("added: The Lantern Road (The Lantern Cycle, #1) by Mara Quill, 5/5, finished 2026/03/01", out)
        for private in ("must never reach", "SECRET"):
            self.assertNotIn(private, json.dumps([books, now]) + out)

    def test_a_cover_that_cannot_be_had_never_costs_the_books(self):
        code, books, summary, _, out, files, _ = run_main([], ["--export", "EXPORT"], find=lambda b: "")
        self.assertEqual((code, len(books), files), (0, 5, {}))
        self.assertIsNotNone(summary)
        self.assertEqual(marks(books), [[None, None]] * 5)
        self.assertIn("::warning::cover not found: The Lantern Road", out)

    def test_a_dry_run_writes_nothing_and_asks_no_one(self):
        old = [shelved("1")]
        code, books, summary, now, out, files, details = run_main(old, ["--export", "EXPORT", "--dry-run"])
        self.assertEqual((code, books, summary, now, files, details), (0, old, None, None, {}, []))
        self.assertIn("dry run: 5 books (1 dropped)", out)

    def test_an_export_much_shorter_than_the_shelf_writes_nothing(self):
        old = [shelved(str(i)) for i in range(1, 21)]
        code, books, summary, _, out, _, _ = run_main(old, ["--export", "EXPORT"])
        self.assertEqual((code, books, summary), (1, old, None))
        self.assertIn("is it the whole export? writing nothing", out)

    def test_a_file_that_is_not_an_export_writes_nothing(self):
        with tempfile.TemporaryDirectory() as tmp:
            other = Path(tmp) / "other.csv"
            other.write_text("a,b\n1,2\n", encoding="utf-8")
            code, books, _, _, out, _, _ = run_main([shelved("1")], ["--export", "EXPORT"], export=other)
        self.assertEqual((code, books), (1, [shelved("1")]))
        self.assertIn("is it a Goodreads library export?", out)

    def test_without_an_export_there_is_nothing_to_do(self):
        with self.assertRaises(SystemExit) as stop, contextlib.redirect_stderr(io.StringIO()) as err:
            rb.main([])
        self.assertEqual(stop.exception.code, 2)
        self.assertIn("--export", err.getvalue())

    def test_covers_alone_reads_no_export_and_writes_only_the_marks(self):
        old = [shelved("1"), shelved("2", cover=False), shelved("3", p=["2019/01/01"])]
        code, books, summary, _, _, files, _ = run_main(old, ["--covers"], cover=lambda url: JPEG)
        self.assertEqual((code, summary), (0, None))
        self.assertEqual(sorted(files), ["1.jpg", "3.jpg", "s/1.jpg", "s/3.jpg"])
        self.assertEqual([{k: v for k, v in b.items() if k not in rb.COVER_MARKS} for b in books], old)
        self.assertEqual(marks(books), [[1, 1], [None, None], [1, 1]])

    def test_covers_alone_writes_the_marks_as_it_goes(self):
        # What books.json holds each time the network is asked: a run
        # stopped at any of these moments has lost two files' marks at most.
        on_file = []

        def cover(url):
            books = json.loads(rb.BOOKS.read_text(encoding="utf-8"))
            on_file.append(sum(1 for b in books for mark in rb.COVER_MARKS if b.get(mark)))
            return JPEG
        with mock.patch.object(rb, "COVER_SAVE_EVERY", 2):
            code, books, _, _, _, _, _ = run_main([shelved("1"), shelved("2"), shelved("3")], ["--covers"],
                                                  cover=cover)
        self.assertEqual((code, on_file), (0, [0, 0, 2, 2, 4, 4]))
        self.assertEqual(marks(books), [[1, 1]] * 3)


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


def real_jpeg(width, height):
    """A JPEG Pillow can decode, of the given size."""
    buf = io.BytesIO()
    Image.new("RGB", (width, height), (200, 60, 40)).save(buf, "JPEG", quality=95)
    return buf.getvalue()


class FitCover(CoverStore):
    """fit_cover(): Open Library's covers come taller than the shelf's
    copies and about twice their weight, so one taller than asked for is
    shrunk to the height; anything else is kept byte for byte."""

    @unittest.skipUnless(Image, "Pillow is not installed")
    def test_open_librarys_covers_are_kept_at_the_shelfs_heights(self):
        b = shelved("1", c=rb.OL_COVER % 15270130)
        books, fetched, problems = self.keep([b], {full(b): real_jpeg(314, 500),
                                                   small(b): real_jpeg(180, 286)})
        self.assertEqual((fetched, problems, marks(books)), (2, [], [[1, 1]]))
        for path, size in ((self.folder / "1.jpg", (251, rb.COVER_HEIGHT)),
                           (self.folder / "s" / "1.jpg", (151, rb.COVER_SMALL_HEIGHT))):
            with Image.open(path) as im:
                self.assertEqual((im.format, im.size), ("JPEG", size))

    @unittest.skipUnless(Image, "Pillow is not installed")
    def test_a_cover_no_taller_than_asked_is_kept_as_it_came(self):
        data = real_jpeg(156, rb.COVER_SMALL_HEIGHT)
        self.assertEqual(rb.fit_cover(data, rb.COVER_SMALL_HEIGHT), data)

    def test_what_cannot_be_read_is_kept_as_it_came(self):
        # A header with no picture behind it, with Pillow or without.
        for data in (JPEG, jpeg(500, pad=40)):
            self.assertEqual(rb.fit_cover(data, rb.COVER_SMALL_HEIGHT), data)


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
    """The committed books.json, fed back as the export that describes it,
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
        now = json.loads((rb.ROOT / "data" / "now.json").read_text(encoding="utf-8"))
        for book in now.get("reading") or []:
            img = book.get("img", "")
            if img:
                self.assertTrue(img.startswith(rb.SITE_COVERS + "s/"), book["title"])
                self.assertTrue((rb.ROOT / img.lstrip("/")).is_file(), book["title"])

    def test_round_trip(self):
        books = json.loads(rb.BOOKS.read_text(encoding="utf-8"))
        out, dropped = rb.merge(books, [item_for(b) for b in books])
        self.assertEqual((out, dropped), (books, []))
        self.assertEqual(rb.lost_history(books, out), [])


if __name__ == "__main__":
    unittest.main()
