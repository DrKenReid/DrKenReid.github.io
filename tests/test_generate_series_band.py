"""generate_series_band.py: which series the blog's band shows, and its markup.

The band is baked into blog.html from posts.json, so these cases pin the
choice (three parts or more, most recently updated, three of them, ties
by name so file order never decides), the card it writes (the series
index's card, escaped, with the page's own description) and the refusal
to show a series whose page has nothing to say about it.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import generate_series_band as gsb  # noqa: E402


def post(url, date, series, part, minutes=5, image="img/a.webp"):
    return {"url": "blog/%s.html" % url, "title": url, "date": date, "image": image,
            "readMinutes": minutes, "series": {"name": series, "part": part}}


def run(name, count, last, start=1):
    """`count` parts of `name`, the newest dated `last`."""
    return [post("%s-%d" % (name.lower().replace(" ", "-"), i), last if i == count else "2026-01-0%d" % i,
                 name, i) for i in range(start, start + count)]


class Choice(unittest.TestCase):
    def test_three_parts_or_more_newest_first_three_of_them(self):
        posts = (run("Long Old", 9, "2026-02-01") + run("Short New", 2, "2026-09-01")
                 + run("Mid", 3, "2026-08-01") + run("Big", 18, "2026-09-02")
                 + run("Also", 4, "2026-07-01"))
        self.assertEqual([r["name"] for r in gsb.band_series(posts)], ["Big", "Mid", "Also"])

    def test_ties_go_by_name(self):
        posts = run("Zeta", 3, "2026-09-01") + run("Alpha", 3, "2026-09-01")
        self.assertEqual([r["name"] for r in gsb.band_series(posts)], ["Alpha", "Zeta"])

    def test_totals(self):
        posts = run("Big", 3, "2026-09-02")
        record = gsb.band_series(posts)[0]
        self.assertEqual((record["updated"], record["minutes"], len(record["parts"])), ("2026-09-02", 15, 3))
        self.assertEqual(record["parts"][0]["url"], "blog/big-1.html")

    def test_no_series_long_enough_writes_nothing(self):
        self.assertEqual(gsb.band_lines(run("Short", 2, "2026-09-01")), [])


class Card(unittest.TestCase):
    def setUp(self):
        self.record = gsb.band_series(run("Q & A <b>", 3, "2026-09-05"))[0]

    def test_markup_is_escaped_and_links_the_series_page(self):
        card = "\n".join(gsb.card_lines(self.record, 'Say "why" & <how>'))
        self.assertIn('<h3 class="blog-card-title">Q &amp; A &lt;b&gt;</h3>', card)
        self.assertIn('<p class="blog-card-excerpt">Say "why" &amp; &lt;how&gt;</p>', card)
        self.assertIn('href="/series-q-a-b.html"', card)
        self.assertIn('data-live-href="blog/q-&amp;-a-&lt;b&gt;-1.html"', card)
        self.assertIn('<div class="blog-card-date">Updated 5 September 2026</div>', card)
        self.assertIn('<span class="kr-series-chip">3 parts &middot; 15 min</span>', card)
        # Site-absolute: a relative url() in a custom property resolves
        # against the stylesheet, not the page.
        self.assertIn("--kr-cover: url('/img/a.webp')", card)

    def test_a_post_without_an_image_gets_the_default_cover(self):
        self.record["parts"][0]["image"] = ""
        card = "\n".join(gsb.card_lines(self.record, "x"))
        self.assertIn('src="/%s"' % gsb.sitelib.DEFAULT_POST_IMAGE, card)


class Band(unittest.TestCase):
    posts = run("Big", 3, "2026-09-02") + run("Small", 1, "2026-09-03")

    def test_band_counts_every_series_for_its_button(self):
        with mock.patch.object(gsb, "description", return_value="About it."):
            lines = gsb.band_lines(self.posts)
        text = "\n".join(lines)
        self.assertIn('<section id="series-band"', lines[0])
        self.assertIn(">All 2 series</a>", text)
        self.assertEqual(text.count('class="blog-card kr-lit"'), 1)
        self.assertEqual(sum(1 for ln in lines if ln.startswith("    <div class=\"col-12")), 1)

    def test_an_untracked_page_is_refused(self):
        # The page exists on disk, so only the tracked test can refuse it.
        self.assertTrue((gsb.ROOT / "series-algorithms-live.html").is_file())
        with mock.patch.object(gsb.sitelib, "tracked", return_value=[]):
            with self.assertRaisesRegex(SystemExit, "no tracked page"):
                gsb.description("Algorithms, Live")

    def test_a_page_without_a_description_is_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            page = Path(tmp) / "series-big.html"
            page.write_text('<head><meta name="viewport" content="x"></head>', encoding="utf-8")
            with mock.patch.object(gsb, "ROOT", Path(tmp)),                     mock.patch.object(gsb.sitelib, "tracked", return_value=[page]):
                with self.assertRaisesRegex(SystemExit, "no <meta"):
                    gsb.description("Big")
            page.write_text('<meta name="description" content="Tom &amp; Jerry, in order.">', encoding="utf-8")
            with mock.patch.object(gsb, "ROOT", Path(tmp)),                     mock.patch.object(gsb.sitelib, "tracked", return_value=[page]):
                self.assertEqual(gsb.description("Big"), "Tom & Jerry, in order.")

    def test_real_pages_have_descriptions(self):
        # Every series the band shows today must have a page that says what
        # it is; this is the check a new series meets at its third part.
        for record in gsb.band_series(gsb.sitelib.load_posts()):
            with self.subTest(series=record["name"]):
                self.assertTrue(gsb.description(record["name"]))


if __name__ == "__main__":
    unittest.main()
