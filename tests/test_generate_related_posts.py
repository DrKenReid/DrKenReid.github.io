"""generate_related_posts.py: the baked card, and where the block lands.

The baked "Related posts" cards must stay the card createBlogCardElement()
builds in the browser (same hooks, same escaping), and the block must end
up inside the post's .blog-post, where the runtime chrome looks for it.
These cases pin both, plus the refusal to rank a post with no body.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import generate_related_posts as grp  # noqa: E402


def post(**extra):
    p = {
        "url": "blog/why-you-arent-a-visual-learner.html",
        "title": "Why You Aren't a \"Visual Learner\"",
        "excerpt": "Tags <b>and</b> 'quotes' & more",
        "image": "img/photography/thumb/366.webp",
        "date": "2026-07-04",
        "readMinutes": 7.5,
        "tags": ["science", "a\"b"],
    }
    p.update(extra)
    return p


class CardMarkup(unittest.TestCase):
    def test_every_field_is_escaped(self):
        card = grp.build_card_html(post())
        self.assertIn("Why You Aren&#x27;t a &quot;Visual Learner&quot;</h3>", card)
        self.assertIn("Tags &lt;b&gt;and&lt;/b&gt; &#x27;quotes&#x27; &amp; more", card)
        self.assertIn('<span class="blog-tag">a&quot;b</span>', card)
        self.assertNotIn("Visual Learner\"", card)

    def test_cover_is_decorative(self):
        # The title is the link's name; an alt repeating it was also where
        # the quotes in a title broke out of the attribute.
        card = grp.build_card_html(post())
        self.assertIn('alt=""', card)
        self.assertNotIn('alt="Why', card)

    def test_hooks_match_the_runtime_card(self):
        card = grp.build_card_html(post())
        self.assertIn('class="col-12 col-md-6 col-lg-4 mb-30 kr-glow-host"', card)
        self.assertIn('class="blog-card kr-lit"', card)
        self.assertIn('<span class="kr-lit__ring" aria-hidden="true"></span>', card)

    def test_paths(self):
        card = grp.build_card_html(post())
        self.assertIn('href="why-you-arent-a-visual-learner.html"', card)
        self.assertIn('src="../img/photography/thumb/366.webp"', card)
        # Site-absolute: a relative url() in a custom property resolves
        # against the stylesheet, not the page.
        self.assertIn("--kr-cover: url('/img/photography/thumb/366.webp')", card)

    def test_full_url_cover_passes_through(self):
        card = grp.build_card_html(post(image="https://example.org/a.jpg"))
        self.assertIn('src="https://example.org/a.jpg"', card)
        self.assertIn("url('https://example.org/a.jpg')", card)

    def test_date_and_read_time(self):
        self.assertEqual(grp.format_post_date("2026-09-05"), "5 September 2026")
        self.assertIn("4 July 2026 · 8 min read", grp.build_card_html(post()))
        self.assertIn('<div class="blog-card-date">4 July 2026</div>',
                      grp.build_card_html(post(readMinutes=None)))

    def test_display_minutes_rounds_like_the_browser(self):
        self.assertEqual(grp.display_minutes({"readMinutes": 4.5}), 5)   # Math.round, not banker's
        self.assertEqual(grp.display_minutes({"readMinutes": 0.2}), 1)
        self.assertIsNone(grp.display_minutes({}))
        self.assertIsNone(grp.display_minutes({"readMinutes": True}))


class FindBlock(unittest.TestCase):
    def test_matches_the_class_token_not_the_literal_tag(self):
        html = '<div class="x"><div data-fullres class="blog-post wide"><p>a</p></div></div>'
        start, end = grp.find_block(html, "blog-post")
        self.assertEqual(html[start:end], '<div data-fullres class="blog-post wide"><p>a</p></div>')

    def test_a_longer_class_is_not_a_match(self):
        self.assertIsNone(grp.find_block('<div class="blog-posts"></div>', "blog-post"))


BODY = """<html><body>
<div class="container">
      <div class="blog-post" data-no-toc>
        <p>Words about learning and memory and learning.</p>
{inside}      </div>
{outside}</div>
</body></html>
"""


class Placement(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / "blog").mkdir()
        self.saved_root = grp.ROOT
        grp.ROOT = self.root
        self.addCleanup(setattr, grp, "ROOT", self.saved_root)
        self.post = post(url="blog/p.html")
        self.block = grp.build_related_html([post()])

    def render(self, text):
        (self.root / "blog" / "p.html").write_text(text, encoding="utf-8")
        return grp.render_post_content(self.post, self.block)[1]

    def assert_inside_once(self, html):
        self.assertEqual(html.count('class="related-posts"'), 1)
        start, end = grp.find_block(html, "blog-post")
        self.assertIn('class="related-posts"', html[start:end])

    def test_placeholder_is_replaced_in_place(self):
        html = self.render(BODY.format(inside='        <div id="related-posts-section"></div>\n', outside=""))
        self.assert_inside_once(html)
        self.assertNotIn("related-posts-section", html)

    def test_a_block_outside_the_body_moves_inside(self):
        stale = '        <div class="related-posts"><h2>Related posts</h2></div>\n'
        html = self.render(BODY.format(inside="", outside=stale))
        self.assert_inside_once(html)

    def test_no_block_is_appended_as_the_last_child(self):
        html = self.render(BODY.format(inside="", outside=""))
        self.assert_inside_once(html)
        start, end = grp.find_block(html, "blog-post")
        body = html[start:end]
        _block_start, block_end = grp.find_block(body, "related-posts")
        self.assertEqual(body[block_end:].strip(), "</div>")

    def test_idempotent(self):
        once = self.render(BODY.format(inside="", outside=""))
        self.assertEqual(self.render(once), once)

    def test_a_post_without_a_body_is_refused(self):
        with self.assertRaises(grp.PostBodyMissing):
            self.render("<html><body><article>No body div</article></body></html>")


class UpNext(unittest.TestCase):
    """up_next mirrors postNeighbours (tests/js/post-runtime.test.js has
    the browser's side); the related cards leave both posts out."""

    def setUp(self):
        s = "Algorithms, Live"
        # posts.json order: newest first.
        self.posts = [
            {"url": "blog/new.html"},
            {"url": "blog/p3.html", "series": {"name": s, "part": 3}},
            {"url": "blog/mid.html"},
            {"url": "blog/p2.html", "series": [{"name": "Other", "part": 1}, {"name": s, "part": 2}]},
            {"url": "blog/p1.html", "series": {"name": s, "part": 1}},
            {"url": "blog/old.html"},
        ]
        self.by = {p["url"].split("/")[1][:-5]: p for p in self.posts}

    def urls(self, key):
        return [p["url"] for p in grp.up_next(self.posts, self.by[key])]

    def test_a_middle_part_gets_its_neighbouring_parts(self):
        self.assertEqual(self.urls("p2"), ["blog/p1.html", "blog/p3.html"])

    def test_the_ends_of_a_series_fall_back_to_chronology(self):
        self.assertEqual(self.urls("p1"), ["blog/old.html", "blog/p2.html"])
        self.assertEqual(self.urls("p3"), ["blog/p2.html", "blog/new.html"])

    def test_a_post_outside_a_series_gets_older_and_newer(self):
        self.assertEqual(self.urls("mid"), ["blog/p2.html", "blog/p3.html"])
        self.assertEqual(self.urls("new"), ["blog/p3.html"])

    def test_related_cards_skip_the_pager(self):
        vectors = {p["url"]: {"x": 1.0} for p in self.posts}
        related = grp.build_related_posts(self.posts, self.by["p2"], vectors)
        self.assertEqual(len(related), 3)
        self.assertFalse({"blog/p1.html", "blog/p3.html", "blog/p2.html"}
                         & {p["url"] for p in related})


if __name__ == "__main__":
    unittest.main()
