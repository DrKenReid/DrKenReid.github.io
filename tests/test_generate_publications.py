"""generate_publications.py: the order, the markup and the refusals.

The publication list and its JSON-LD are both written from
data/publications.json. These cases pin the parts that are easy to break
without noticing: the Selected order, the marker regex (one block name is
a prefix of the other), the escaping, the newline style of the page, and
the validation that stops a half-refreshed JSON reaching the page.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import generate_publications as gp  # noqa: E402

SCHOLAR = "https://scholar.google.com/citations?view_op=view_citation&citation_for_view="


def paper(pid, year, citations, authors, **extra):
    """A valid entry; the live key and post are real ones so validate() passes."""
    p = {
        "id": "u:" + pid, "title": "Paper " + pid, "authors": authors, "etAl": False,
        "venue": "Venue " + pid, "venueShort": None, "year": year, "citations": citations,
        "url": SCHOLAR + "u:" + pid, "doi": None, "pdf": None,
        "firstAuthor": authors[0] in gp.KEN_NAMES, "live": "pub:hybrid", "post": None,
    }
    p.update(extra)
    return p


def dataset(pubs, total=None, selected=2):
    return {
        "scholar": {"profile": "https://scholar.google.com/citations?user=u",
                    "citations": sum(p["citations"] for p in pubs) if total is None else total},
        "selected": selected,
        "publications": pubs,
    }


PAGE = """<head>
  <!-- BEGIN publications-jsonld: generated -->
  <!-- END publications-jsonld -->
</head>
<body>
    <!-- BEGIN publications: generated -->
    stale
    <!-- END publications -->
</body>
"""


class Order(unittest.TestCase):
    pubs = [
        paper("a", 2026, 1, ["X Other", "KN Reid"]),
        paper("b", 2023, 66, ["X Other", "K Reid"]),
        paper("c", 2019, 11, ["KN Reid", "X Other"]),
        paper("d", 2021, 9, ["KN Reid"]),
        paper("e", 2016, 9, ["KN Reid"]),
    ]

    def test_selected_puts_first_authored_papers_first(self):
        # first-authored by citations (d and e tie on 9: newer first), then the rest
        order = [p["id"][2:] for p in gp.selected_order(self.pubs)]
        self.assertEqual(order, ["c", "d", "e", "b", "a"])

    def test_year_order_is_stable(self):
        same = [paper("x", 2022, 1, ["KN Reid"]), paper("y", 2022, 5, ["KN Reid"])]
        self.assertEqual([p["id"] for p in gp.year_order(same)], ["u:x", "u:y"])


class Markup(unittest.TestCase):
    def test_ken_is_bold_and_et_al_does_not_break(self):
        p = paper("a", 2020, 0, ["J Han", "K Reid"], etAl=True)
        self.assertEqual(gp.authors_html(p), "J Han, <strong>K Reid</strong>, et&nbsp;al.")

    def test_meta_links_and_badge(self):
        p = paper("a", 2021, 1, ["KN Reid"], venueShort="GECCO '21", doi="10.1/x",
                  post="blog/factorio-live.html")
        meta = gp.meta_html(p)
        self.assertIn('<abbr class="ds-pub-venue" title="Venue a">GECCO \'21</abbr>', meta)
        self.assertIn(">1 citation<", meta)
        self.assertIn('href="https://doi.org/10.1/x"', meta)
        self.assertIn('href="/blog/factorio-live.html">Watch it run', meta)
        self.assertNotIn("PDF", meta)

    def test_no_badge_for_an_uncited_paper(self):
        self.assertNotIn("ds-citation-badge", gp.meta_html(paper("a", 2026, 0, ["KN Reid"])))

    def test_papers_past_the_selection_are_marked(self):
        pubs = Order.pubs
        lines = gp.list_lines(dataset(pubs, selected=2), pubs)
        rows = [ln for ln in lines if "<li " in ln]
        self.assertEqual(len(rows), 5)
        self.assertEqual(sum("data-pub-more" in r for r in rows), 3)
        self.assertIn('data-live="pub:hybrid"', rows[0])

    def test_jsonld_parses_and_names_ken(self):
        p = paper("a", 2020, 0, ["X Other", "KN Reid"], title="A </script> title")
        lines = gp.jsonld_lines([p])
        body = "\n".join(lines[1:-1])
        self.assertNotIn("</script>", body)
        doc = json.loads(body)
        authors = doc["itemListElement"][0]["item"]["author"]
        self.assertEqual(authors[1], {"@type": "Person", "name": "KN Reid", "@id": gp.PERSON_ID})
        self.assertNotIn("@id", authors[0])
        self.assertEqual(doc["itemListElement"][0]["item"]["headline"], "A </script> title")


class Blocks(unittest.TestCase):
    def test_short_name_does_not_match_the_longer_one(self):
        self.assertEqual(len(gp.block_re("publications").findall(PAGE)), 1)
        self.assertEqual(len(gp.block_re("publications-jsonld").findall(PAGE)), 1)

    def test_render_is_idempotent_and_keeps_indentation(self):
        pubs = Order.pubs
        once = gp.render(PAGE, dataset(pubs), pubs)
        self.assertEqual(gp.render(once, dataset(pubs), pubs), once)
        self.assertNotIn("stale", once)
        self.assertIn('\n    <ol class="ds-pub-list"', once)
        self.assertIn('\n  <script type="application/ld+json">', once)

    def test_missing_marker_is_an_error(self):
        pubs = Order.pubs
        with self.assertRaises(SystemExit):
            gp.render(PAGE.replace("<!-- END publications -->", ""), dataset(pubs), pubs)


class Validation(unittest.TestCase):
    def errors(self, pubs, **kw):
        return gp.validate(dataset(pubs, **kw), pubs)

    def test_valid(self):
        self.assertEqual(self.errors(Order.pubs), [])

    def test_first_author_flag_must_match_the_list(self):
        errs = self.errors([paper("a", 2020, 0, ["X Other", "KN Reid"], firstAuthor=True)], selected=1)
        self.assertTrue(any("firstAuthor" in e for e in errs), errs)

    def test_unknown_sketch_and_post(self):
        errs = self.errors([paper("a", 2020, 0, ["KN Reid"], live="pub:nope",
                                  post="blog/nope.html")], selected=1)
        self.assertTrue(any("no sketch" in e for e in errs), errs)
        self.assertTrue(any("not in data/posts.json" in e for e in errs), errs)

    def test_url_must_be_the_papers_own(self):
        errs = self.errors([paper("a", 2020, 0, ["KN Reid"], url=SCHOLAR + "u:zzz")], selected=1)
        self.assertTrue(any("url" in e for e in errs), errs)

    def test_total_below_the_papers_sum(self):
        errs = self.errors([paper("a", 2020, 10, ["KN Reid"])], total=5, selected=1)
        self.assertTrue(any("below the papers' own sum" in e for e in errs), errs)

    def test_a_boolean_is_not_a_count(self):
        errs = self.errors([paper("a", 2020, True, ["KN Reid"])], total=1, selected=1)
        self.assertTrue(any("citations: expected integer" in e for e in errs), errs)

    def test_venue_label_carries_no_year(self):
        # The year is printed beside it: "GECCO '21 · 2021" said it twice.
        for label in ("GECCO '21", "CEEC 2018"):
            with self.subTest(label=label):
                errs = self.errors([paper("a", 2020, 0, ["KN Reid"], venueShort=label)], selected=1)
                self.assertTrue(any("venueShort" in e for e in errs), errs)
        self.assertEqual(self.errors([paper("a", 2020, 0, ["KN Reid"], venueShort="GECCO")],
                                     selected=1), [])

    def test_doi_must_be_bare(self):
        errs = self.errors([paper("a", 2020, 0, ["KN Reid"], doi="https://doi.org/10.1/x")], selected=1)
        self.assertTrue(any("doi" in e for e in errs), errs)


class NewlineStyle(unittest.TestCase):
    """main() keeps the page's own newlines, and --check ignores them."""

    def test_crlf_page_stays_crlf(self):
        pubs = Order.pubs
        with tempfile.TemporaryDirectory() as tmp:
            page, data = Path(tmp) / "page.html", Path(tmp) / "pubs.json"
            page.write_bytes(PAGE.replace("\n", "\r\n").encode("utf-8"))
            data.write_text(json.dumps(dataset(pubs)), encoding="utf-8")
            saved = gp.PAGE, gp.DATA
            gp.PAGE, gp.DATA = page, data
            try:
                with contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(gp.main(["--check"]), 1)
                    self.assertEqual(gp.main([]), 0)
                    self.assertEqual(gp.main(["--check"]), 0)
            finally:
                gp.PAGE, gp.DATA = saved
            raw = page.read_bytes()
            self.assertNotIn(b"\n", raw.replace(b"\r\n", b""))


if __name__ == "__main__":
    unittest.main()
