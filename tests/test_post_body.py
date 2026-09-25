"""sitelib.post_body: finding a post's article in its HTML.

The generators find a post's body through this one function (or its
span, post_body_span): the read times, the feed and the related-post
blocks. Before it existed each had its own way of finding the body, and
they disagreed. The
feed searched for the literal text <div class="blog-post">, so the
photography posts, whose body div also carries data-fullres, shipped in
feed.xml with no content at all while the read-time counter, which
matched the class token, counted them fine. The cases below are the
shapes that tripped the old copies: another attribute before or after
the class, a second class, nested divs, and look-alikes that must not
match.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import sitelib  # noqa: E402


class ExtraAttributes(unittest.TestCase):
    """The class is matched as a token, wherever it sits in the tag."""

    def test_data_fullres_after_the_class(self):
        # the photography posts, missing from the feed until this matched
        html = '<div class="blog-post" data-fullres="https://example.org/1.png"><p>a</p></div>'
        self.assertEqual(sitelib.post_body(html), "<p>a</p>")

    def test_attributes_before_the_class(self):
        for html in ('<div data-no-toc class="blog-post"><p>a</p></div>',
                     '<div id="article" data-fullres="x" class="blog-post"><p>a</p></div>',
                     '<div\n  data-fullres="x"\n  class="blog-post"\n><p>a</p></div>'):
            with self.subTest(html=html):
                self.assertEqual(sitelib.post_body(html), "<p>a</p>")

    def test_other_classes_and_quote_styles(self):
        for html in ("<div class='lead blog-post'><p>a</p></div>",
                     '<div class="blog-post kr-has-sidenotes"><p>a</p></div>',
                     '<div class = "x blog-post y"><p>a</p></div>',
                     '<DIV CLASS="blog-post"><p>a</p></DIV>'):
            with self.subTest(html=html):
                self.assertEqual(sitelib.post_body(html), "<p>a</p>")


class Nesting(unittest.TestCase):
    """The end is the div that closes the body, not the first </div>."""

    def test_nested_divs_are_kept_whole(self):
        html = ('<div class="blog-post"><p>a</p><div class="x"><div>y</div></div>'
                '<p>b</p></div><div>after</div>')
        self.assertEqual(sitelib.post_body(html),
                         '<p>a</p><div class="x"><div>y</div></div><p>b</p>')

    def test_a_baked_related_block_stays_inside(self):
        html = ('<div class="blog-post"><p>a</p>'
                '<div class="related-posts"><div class="row"><div>card</div></div></div>'
                '</div>')
        body = sitelib.post_body(html)
        self.assertTrue(body.endswith('<div>card</div></div></div>'))

    def test_an_unclosed_body_is_none_not_half(self):
        # A caller that publishes the result (the feed) must fail rather
        # than ship half an article.
        self.assertIsNone(sitelib.post_body('<div class="blog-post"><p>a</p><div>'))

    def test_span_brackets_the_element_and_its_content(self):
        # Upper-case and spaced closing tags count.
        html = 'x<div class="blog-post"><p>a</p><DIV>b</DIV></div >y'
        open_start, inner_start, inner_end, close_end = sitelib.post_body_span(html)
        self.assertEqual(html[open_start:close_end], html[1:-1])
        self.assertEqual(html[inner_start:inner_end], "<p>a</p><DIV>b</DIV>")


class LookAlikes(unittest.TestCase):
    def test_similar_classes_and_attributes_are_not_the_body(self):
        for html in ('<div class="blog-post-meta"><p>a</p></div>',
                     '<div class="kr-blog-post"><p>a</p></div>',
                     '<div data-class="blog-post"><p>a</p></div>',
                     '<section class="blog-post"><p>a</p></section>'):
            with self.subTest(html=html):
                self.assertIsNone(sitelib.post_body(html))

    def test_the_first_body_is_the_one(self):
        html = ('<div class="blog-post-meta">m</div>'
                '<div data-fullres="1" class="blog-post">real</div>')
        self.assertEqual(sitelib.post_body(html), "real")

    def test_div_span_finds_any_class_from_a_start(self):
        html = '<div class="related-posts">1</div><div class="related-posts">2</div>'
        first = sitelib.div_span(html, "related-posts")
        second = sitelib.div_span(html, "related-posts", first[3])
        self.assertEqual(html[second[1]:second[2]], "2")
        self.assertIsNone(sitelib.div_span(html, "related"))


class EveryPost(unittest.TestCase):
    """Every post in posts.json has a body the generators can find."""

    def test_posts_json_bodies(self):
        for post in sitelib.load_posts():
            path = sitelib.ROOT / post["url"]
            with self.subTest(post=post["url"]):
                body = sitelib.post_body(path.read_text(encoding="utf-8"))
                self.assertIsNotNone(body)
                self.assertGreater(len(body.strip()), 200)


if __name__ == "__main__":
    unittest.main()
