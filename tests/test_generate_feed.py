"""generate_feed.clean_for_feed: what a post's body becomes in feed.xml.

A feed reader prints each item's title and date itself, so the post's
own <h1> and its date-and-tags line (.blog-meta) at the top of the body
read twice there, and the tags came through as bare words; they are
dropped. A fragment link (a citation's href="#ref-3") resolves against
the reader's page, where there is no #ref-3, so it is tied to the post's
URL. Headings and meta lines further down, and links elsewhere, are left
alone.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import generate_feed  # noqa: E402

SITE = generate_feed.SITE
URL = f"{SITE}/blog/sleep-science.html"

BODY = """
 <h1>Sleep Science</h1>
 <div class="blog-meta">
 27 September 2026 &middot;
 <span class="blog-tag">science</span>
 </div>

<p>Sleep matters.<sup><a class="cite-ref" href="#ref-1">1</a></sup> See <a href="other-post.html">this</a>.</p>
<h1>A later heading</h1>
<ol class="references"><li id="ref-1">Walker, 2017.</li></ol>
"""


class CleanForFeed(unittest.TestCase):
    def setUp(self):
        self.out = generate_feed.clean_for_feed(BODY, URL)

    def test_title_and_meta_line_go(self):
        self.assertNotIn("<h1>Sleep Science</h1>", self.out)
        self.assertNotIn("blog-meta", self.out)
        self.assertNotIn("blog-tag", self.out)
        self.assertTrue(self.out.lstrip().startswith("<p>Sleep matters."))

    def test_only_the_opening_pair_goes(self):
        self.assertIn("<h1>A later heading</h1>", self.out)
        later = BODY.replace(" <h1>Sleep Science</h1>\n", "")
        kept = generate_feed.clean_for_feed("<p>Intro.</p>" + later, URL)
        self.assertIn('<div class="blog-meta">', kept)

    def test_fragment_links_point_into_the_post(self):
        self.assertIn(f'href="{URL}#ref-1"', self.out)
        self.assertNotIn('href="#', self.out)

    def test_relative_links_still_resolve_against_blog(self):
        self.assertIn(f'href="{SITE}/blog/other-post.html"', self.out)


if __name__ == "__main__":
    unittest.main()
