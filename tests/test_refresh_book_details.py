"""refresh_book_details: every book's first year (y) and genres (gn).

The wall on books.html filters by both, so a wrong genre table puts a
book in the wrong row, and a run that fails half way must never cost
the week's reading data. These cases pin the rules in the module
docstring of .github/scripts/refresh_book_details.py with small
hand-built records and a stand-in for Open Library, plus checks on the
real files: books.json says what the details and overrides say, every
key is one the page knows, and the page's genre list is the script's.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import contextlib
import io
import json
import re
import sys
import tempfile
import unittest
import urllib.error
from datetime import date
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import refresh_book_details as rbd  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
TODAY = date(2026, 11, 10)


def gr(*pairs):
    """Goodreads labels as the details file keeps them."""
    return [[label, votes] for label, votes in pairs]


def ol(*subjects):
    """Open Library subjects as the details file keeps them."""
    return [[s, 1] for s in subjects]


def book(g="1", **more):
    b = {"t": "A Book", "a": "An Author", "r": 4, "g": g, "w": "7" + g, "d": "2025/01/01"}
    b.update(more)
    return b


class Table(unittest.TestCase):
    def test_one_genre(self):
        self.assertEqual(rbd.genres_of(gr(("Horror", 20136), ("Stephen King", 7976), ("Fiction", 5941))),
                         ["horror"])

    def test_a_strong_runner_up_is_second(self):
        # I Am Legend: horror first, a real science fiction following
        # second (its two labels add up).
        labels = gr(("Horror", 4462), ("Science Fiction", 2115), ("Fiction", 1960), ("Sci Fi", 1778))
        self.assertEqual(rbd.genres_of(labels), ["horror", "scifi"])

    def test_a_weak_runner_up_is_not(self):
        labels = gr(("Fantasy", 13086), ("Sci Fi", 900), ("Fiction", 2600))
        self.assertEqual(rbd.genres_of(labels), ["fantasy"])

    def test_litrpg_leads_at_a_small_share_of_fantasy(self):
        # Cradle: shelved as Fantasy first, its own genre well below.
        labels = gr(("Fantasy", 1463), ("Audible", 176), ("Progression Fantasy", 159),
                    ("Fiction", 159), ("Litrpg", 151))
        self.assertEqual(rbd.genres_of(labels), ["litrpg", "fantasy"])

    def test_a_few_litrpg_votes_on_a_space_opera_do_not(self):
        labels = gr(("Fantasy", 95), ("Sci Fi", 68), ("Science Fiction", 62), ("Litrpg", 11))
        self.assertNotIn("litrpg", rbd.genres_of(labels))

    def test_stray_labels_under_the_minimum_share_do_not_count(self):
        labels = gr(("Science Fiction", 10000), ("Horror", 900), ("Horror Fiction", 50))
        self.assertEqual(rbd.genres_of(labels), ["scifi"])

    def test_weak_labels_place_only_a_book_nothing_else_places(self):
        self.assertEqual(rbd.genres_of(gr(("Classics", 41256), ("Fiction", 18357), ("School", 4345))),
                         ["literary"])
        self.assertEqual(rbd.genres_of(gr(("Classics", 50262), ("Horror", 17103), ("Fiction", 15747))),
                         ["horror"])

    def test_non_fiction_alone_places_nothing(self):
        self.assertEqual(rbd.genres_of(gr(("Non Fiction", 22), ("Audible", 13), ("Great Courses", 9))), [])
        self.assertEqual(rbd.genres_of([]), [])
        self.assertEqual(rbd.genres_of(None), [])

    def test_open_library_subjects_count_once_each(self):
        labels = ol("Fiction", "Fantasy fiction", "Fiction, fantasy, epic", "Imaginary places",
                    "History and criticism", "Juvenile fiction")
        self.assertEqual(rbd.genres_of(labels), ["fantasy"])

    def test_the_narrow_rules_come_first(self):
        cases = {
            "Progression Fantasy": "litrpg", "LitRPG": "litrpg", "Lit-RPG": "litrpg",
            "Cultivation": "litrpg", "Urban Fantasy": "fantasy", "Fiction, fantasy, epic": "fantasy",
            "Science Fiction": "scifi", "Fiction, science fiction, general": "scifi",
            "Space Opera": "scifi", "Political Science": "politics", "Cognitive Science": "psychology",
            "Self-Help": "psychology", "Natural History": "science", "World War II": "history",
            "Biography & Autobiography": "biography", "Memoir": "biography",
            "Historical Fiction": "literary", "Stoicism": "philosophy", "Mystery Thriller": "crime",
            "Fiction, mystery & detective, general": "crime", "Horror tales": "horror",
        }
        for label, genre in cases.items():
            self.assertEqual(rbd.genre_of_label(label)[0], genre, label)

    def test_labels_that_are_not_genres_place_nothing(self):
        for label in ("History and criticism", "Young Adult", "Juvenile fiction", "Historical",
                      "Science Fiction and Fantasy", "Books I Own", "Audible", "Kindle Unlimited",
                      # Babel's: a novel is never history for a heading about fiction.
                      "Fiction, alternative history", "Alternate history"):
            self.assertIsNone(rbd.genre_of_label(label)[0], label)

    def test_never_more_than_two(self):
        labels = gr(("Fantasy", 100), ("Horror", 90), ("Science Fiction", 80), ("Mystery", 70))
        self.assertEqual(len(rbd.genres_of(labels)), 2)


class Export(unittest.TestCase):
    def test_the_genres_cell(self):
        self.assertEqual(rbd.export_labels("Fantasy|311;Cultivation,Xianxia|98;Fiction|39;Stray|3"),
                         [["Fantasy", 311], ["Cultivation", 98], ["Fiction", 39]])
        self.assertEqual(rbd.export_labels(""), [])

    def test_years(self):
        self.assertEqual(rbd.year_of("1954"), 1954)
        self.assertEqual(rbd.year_of("1954.0"), 1954)
        for bad in ("", "n/a", "0", "-300", None, "12345"):
            self.assertIsNone(rbd.year_of(bad), bad)

    def test_the_original_year_wins_over_the_editions(self):
        rows = [
            {"Book Id": "1", "Original Publication Year": "1954", "Year Published": "2004",
             "genres": "Fantasy|10"},
            {"Book Id": "2", "Original Publication Year": "", "Year Published": "2021.0", "genres": ""},
            {"Book Id": "3", "Original Publication Year": "1999"},  # not on the shelf
        ]
        got = rbd.from_export(rows, [book("1"), book("2")])
        self.assertEqual(got["1"], {"g": "1", "year": 1954, "yearFrom": "export",
                                    "labels": [["Fantasy", 10]], "labelsFrom": "export"})
        self.assertEqual(got["2"], {"g": "2", "year": 2021, "yearFrom": "export"})
        self.assertNotIn("3", got)

    def test_an_export_keeps_what_it_lacks(self):
        old = {"2": {"g": "2", "labels": ol("Fantasy"), "labelsFrom": "openlibrary", "asked": "2026-11-10"}}
        new = {"2": {"g": "2", "year": 2021, "yearFrom": "export"}}
        self.assertEqual(rbd.merge_entries(old, new)["2"],
                         {"g": "2", "labels": ol("Fantasy"), "labelsFrom": "openlibrary",
                          "asked": "2026-11-10", "year": 2021, "yearFrom": "export"})


class Apply(unittest.TestCase):
    def test_the_sources_in_order(self):
        details = {
            "1": {"g": "1", "year": 1954, "yearFrom": "export", "labels": gr(("Fantasy", 9))},
            "2": {"g": "2", "year": 1999, "yearFrom": "openlibrary", "labels": ol("Horror")},
            "3": {"g": "3", "year": 1999, "yearFrom": "openlibrary"},
        }
        overrides = {"4": {"gn": ["crime"], "y": 1880}}
        books = [book("1", y=2004), book("2", y=2010), book("3"), book("4", y=2001), book("5", y=2020)]
        out = {b["g"]: b for b in rbd.apply(books, details, overrides)}
        self.assertEqual((out["1"]["y"], out["1"]["gn"]), (1954, ["fantasy"]))  # export beats the feed
        self.assertEqual((out["2"]["y"], out["2"]["gn"]), (2010, ["horror"]))   # the feed beats Open Library
        self.assertEqual(out["3"]["y"], 1999)                                  # Open Library fills a gap
        self.assertNotIn("gn", out["3"])
        self.assertEqual((out["4"]["y"], out["4"]["gn"]), (1880, ["crime"]))   # a hand correction beats all
        self.assertEqual(out["5"]["y"], 2020)                                  # nothing known: as it was
        self.assertNotIn("gn", out["5"])

    def test_keys_land_where_refresh_books_writes_them(self):
        b = {"t": "T", "a": "A", "r": 5, "g": "1", "c": "x.jpg", "k": 1, "s": 1, "n": 300,
             "w": "9", "d": "2025/01/01", "p": ["2020/01/01"]}
        (out,) = rbd.apply([b], {"1": {"g": "1", "year": 1990, "yearFrom": "export",
                                       "labels": gr(("Horror", 5))}}, {})
        self.assertEqual(list(out), ["t", "a", "r", "g", "c", "k", "s", "n", "y", "gn", "w", "d", "p"])

    def test_it_changes_nothing_else(self):
        b = book("1", v=1, i="9780000000000", p=["2020/01/01"], rc=3)
        (out,) = rbd.apply([b], {}, {})
        self.assertEqual(out, b)


class Asking(unittest.TestCase):
    def test_a_book_is_asked_about_once(self):
        self.assertTrue(rbd.needs_lookup(None, book(), TODAY))
        done = {"g": "1", "year": 1990, "labels": ol("Fantasy"), "asked": "2026-01-01"}
        self.assertFalse(rbd.needs_lookup(done, book(), TODAY))
        # An export entry with labels, and a year from the feed: nothing to ask.
        self.assertFalse(rbd.needs_lookup({"g": "1", "labels": gr(("Fantasy", 3))}, book(y=2001), TODAY))

    def test_one_open_library_could_not_place_waits_retry_days(self):
        miss = {"g": "1", "asked": "2026-11-01"}
        self.assertFalse(rbd.needs_lookup(miss, book(), TODAY))
        self.assertTrue(rbd.needs_lookup({"g": "1", "asked": "2026-08-01"}, book(), TODAY))

    def test_learning_never_overwrites_the_export(self):
        e = {"g": "1", "year": 1954, "yearFrom": "export"}
        got = rbd.learn(e, "1", {"year": 2004, "labels": ol("Fantasy")}, TODAY)
        self.assertEqual(got["year"], 1954)
        self.assertEqual(got["labels"], ol("Fantasy"))
        self.assertEqual(got["labelsFrom"], "openlibrary")
        self.assertEqual(got["asked"], "2026-11-10")
        self.assertEqual(rbd.learn(None, "2", {}, TODAY), {"g": "2", "asked": "2026-11-10"})

    def test_titles_and_names(self):
        self.assertEqual(rbd.plain_title("Death Masks (The Dresden Files, #5)"), "Death Masks")
        self.assertEqual(rbd.plain_title("12 Rules for Life: An Antidote to Chaos"), "12 Rules for Life")
        self.assertEqual(rbd.name_key("Ursula K. Le Guin"), "ursulakleguin")


class Lookup(unittest.TestCase):
    def test_by_isbn(self):
        asked = []

        def fetch(url):
            asked.append(url)
            return {"docs": [{"title": "Dune", "author_name": ["Frank Herbert"], "first_publish_year": 1965,
                              "subject": ["Science fiction", "Arrakis (imaginary place)"]}]}
        got = rbd.lookup(book(i="9780441013593", t="Dune", a="Frank Herbert"), fetch=fetch, sleep=lambda s: None)
        self.assertEqual(got["year"], 1965)
        self.assertEqual(got["labels"][0], ["Science fiction", 1])
        self.assertEqual(len(asked), 1)
        self.assertIn("isbn=9780441013593", asked[0])

    def test_by_title_needs_the_author_first(self):
        docs = [
            {"title": "1984 (adaptation)", "author_name": ["Michael Dean", "George Orwell"], "first_publish_year": 2003},
            {"title": "Nineteen Eighty-Four", "author_name": ["George Orwell"], "first_publish_year": 1949,
             "subject": ["Dystopias"]},
        ]
        got = rbd.lookup(book(t="1984", a="George Orwell"), fetch=lambda url: {"docs": docs}, sleep=lambda s: None)
        self.assertEqual(got, {"year": 1949, "labels": [["Dystopias", 1]]})

    def test_no_such_book_is_an_empty_answer(self):
        docs = [{"title": "Something Else", "author_name": ["Someone Else"], "first_publish_year": 2000}]
        self.assertEqual(rbd.lookup(book(), fetch=lambda url: {"docs": docs}, sleep=lambda s: None), {})

    def test_the_subjects_the_table_reads_are_kept_first(self):
        subjects = ["Place %d" % i for i in range(60)] + ["Fantasy fiction"]
        doc = {"title": "A Book", "author_name": ["An Author"], "subject": subjects}
        got = rbd.lookup(book(), fetch=lambda url: {"docs": [doc]}, sleep=lambda s: None)
        self.assertEqual(got["labels"][0], ["Fantasy fiction", 1])
        self.assertEqual(len(got["labels"]), rbd.KEEP_LABELS)

    def test_the_user_agent_says_nothing_about_who(self):
        self.assertNotRegex(rbd.OL_UA.lower(), r"ken|reid|@|\.uk|https?:")

    def test_a_server_error_is_tried_again_then_refused(self):
        calls = []

        def fail(req, timeout):
            calls.append(req.full_url)
            raise urllib.error.HTTPError(req.full_url, 503, "busy", {}, None)
        with mock.patch.object(rbd.urllib.request, "urlopen", fail):
            with self.assertRaises(rbd.AskError):
                rbd.fetch_json("https://openlibrary.org/search.json?q=x", sleep=lambda s: None)
        self.assertEqual(len(calls), rbd.OL_TRIES)

    def test_a_not_found_is_believed_at_once(self):
        calls = []

        def fail(req, timeout):
            calls.append(1)
            raise urllib.error.HTTPError(req.full_url, 404, "no", {}, None)
        with mock.patch.object(rbd.urllib.request, "urlopen", fail):
            with self.assertRaises(rbd.AskError):
                rbd.fetch_json("https://openlibrary.org/search.json?q=x", sleep=lambda s: None)
        self.assertEqual(len(calls), 1)


def run_main(books, details=None, overrides=None, argv=(), lookup=None):
    """main() over files in a temporary folder. Returns its exit status,
    the books.json and details it left, and what it printed."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        paths = {"books": tmp / "books.json", "details": tmp / "book-details.json",
                 "overrides": tmp / "book-overrides.json"}
        paths["books"].write_text(json.dumps(books), encoding="utf-8")
        if details is not None:
            paths["details"].write_text(rbd.dump_details(details), encoding="utf-8")
        if overrides is not None:
            paths["overrides"].write_text(json.dumps({"books": overrides}), encoding="utf-8")
        out = io.StringIO()
        ask = mock.patch.object(rbd, "lookup", lookup or mock.Mock(side_effect=AssertionError("no network")))
        with mock.patch.object(rbd, "BOOKS", paths["books"]), \
                mock.patch.object(rbd, "DETAILS", paths["details"]), \
                mock.patch.object(rbd, "OVERRIDES", paths["overrides"]), \
                mock.patch.object(rbd.refresh_books, "BOOKS", paths["books"]), \
                mock.patch.object(rbd, "OL_PAUSE", 0), ask, contextlib.redirect_stdout(out):
            code = rbd.main(list(argv))
        left = json.loads(paths["books"].read_text(encoding="utf-8"))
        kept = rbd.load_details(paths["details"])
        return code, left, kept, out.getvalue()


class Main(unittest.TestCase):
    def test_offline_applies_what_is_on_file(self):
        details = {"1": {"g": "1", "year": 1954, "yearFrom": "export", "labels": gr(("Fantasy", 9))}}
        code, left, _, _ = run_main([book("1")], details, argv=["--offline"])
        self.assertEqual(code, 0)
        self.assertEqual((left[0]["y"], left[0]["gn"]), (1954, ["fantasy"]))

    def test_new_books_are_asked_about_and_remembered(self):
        lookup = mock.Mock(return_value={"year": 2020, "labels": ol("Fantasy")})
        code, left, kept, _ = run_main([book("1"), book("2")],
                                       {"2": {"g": "2", "year": 1990, "yearFrom": "export",
                                              "labels": gr(("Horror", 3))}}, lookup=lookup)
        self.assertEqual(code, 0)
        self.assertEqual(lookup.call_count, 1)  # only the book with no entry
        self.assertEqual(kept["1"]["labelsFrom"], "openlibrary")
        self.assertEqual(left[0]["gn"], ["fantasy"])

    def test_a_failure_is_a_warning_and_the_book_waits(self):
        lookup = mock.Mock(side_effect=rbd.AskError("HTTP 503"))
        code, left, kept, printed = run_main([book(str(g)) for g in range(1, 7)], {}, lookup=lookup)
        self.assertEqual(code, 0)
        self.assertEqual(kept, {})
        self.assertIn("::warning::", printed)
        # A host that is down is given up on after a few, not asked about every book.
        self.assertEqual(lookup.call_count, rbd.OL_GIVE_UP)

    def test_a_book_with_an_override_is_not_asked_about(self):
        code, left, _, _ = run_main([book("1", y=2001)], {}, [{"g": "1", "gn": ["horror"]}])
        self.assertEqual((code, left[0]["gn"]), (0, ["horror"]))

    def test_an_unknown_genre_in_the_overrides_is_dropped(self):
        code, left, _, printed = run_main([book("1", y=2001)], {}, [{"g": "1", "gn": ["romance", "crime"]}],
                                          argv=["--offline"])
        self.assertEqual(left[0]["gn"], ["crime"])
        self.assertIn("romance", printed)


class RealFiles(unittest.TestCase):
    """The committed files agree with each other and with the page."""

    @classmethod
    def setUpClass(cls):
        cls.books = json.loads(rbd.BOOKS.read_text(encoding="utf-8"))
        cls.details = rbd.load_details()
        cls.overrides = rbd.load_overrides()

    def test_books_json_says_what_the_sources_say(self):
        # A hand edit to y or gn in books.json, or a change to the table
        # with no run after it, shows here.
        self.assertEqual(rbd.apply(self.books, self.details, self.overrides), self.books)

    def test_every_genre_is_one_the_page_knows_and_never_more_than_two(self):
        for b in self.books:
            gn = b.get("gn") or []
            self.assertLessEqual(len(gn), 2, b["t"])
            self.assertEqual(len(set(gn)), len(gn), b["t"])
            for g in gn:
                self.assertIn(g, rbd.GENRE_KEYS, b["t"])

    def test_every_override_names_a_book_on_the_shelf(self):
        on_file = {b["g"] for b in self.books}
        raw = json.loads(rbd.OVERRIDES.read_text(encoding="utf-8"))
        for o in raw["books"]:
            self.assertIn(o["g"], on_file, o.get("t"))
            self.assertLessEqual(len(o.get("gn") or []), 2, o.get("t"))
            for g in o.get("gn") or []:
                self.assertIn(g, rbd.GENRE_KEYS, o.get("t"))

    def test_the_page_lists_the_same_genres_in_the_same_order(self):
        source = (ROOT / "js" / "bookwall.js").read_text(encoding="utf-8")
        block = re.search(r"var GENRES = \[(.*?)\];", source, re.S)
        self.assertIsNotNone(block, "GENRES not found in js/bookwall.js")
        page = re.findall(r"\{ key: '([a-z]+)', label: '([^']+)'", block.group(1))
        self.assertEqual(page, list(rbd.GENRES))

    def test_the_schemas_list_the_same_genres(self):
        for name, path in (("books", ("items", "properties", "gn", "items", "enum")),
                           ("book-overrides", ("properties", "books", "items", "properties", "gn", "items", "enum"))):
            node = json.loads((ROOT / "data" / "schema" / (name + ".schema.json")).read_text(encoding="utf-8"))
            for key in path:
                node = node[key]
            self.assertEqual(node, list(rbd.GENRE_KEYS), name)

    def test_the_details_file_is_as_the_script_writes_it(self):
        self.assertEqual(rbd.DETAILS.read_text(encoding="utf-8"), rbd.dump_details(self.details))


if __name__ == "__main__":
    unittest.main()
