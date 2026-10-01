"""What generate_read_times.py counts as the article, and what it reads.

`words` is every word in the .blog-post div (the JSON-LD wordCount and
the homepage total); readMinutes comes from the reading words, which
leave out the code in a folded listing (<details class="code-example">
without `open`). Before the split, a post with one long listing tucked
away read "27 min" for seven minutes of prose. The cases below pin
which code counts: a closed listing's <pre> does not, its summary line
does, an open listing does, and so does a <pre> in the flow of the text.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import generate_read_times as grt  # noqa: E402


def page(body):
    return ('<html><body><p>outside the article</p>'
            '<div class="blog-post">%s</div><p>after it</p></body></html>' % body)


CODE = "<pre><code>%s</code></pre>" % " ".join(["tok"] * 500)


class WordCounts(unittest.TestCase):

    def test_plain_prose_counts_the_same_both_ways(self):
        self.assertEqual(grt.word_counts(page("<p>one two three</p>")), (3, 3))

    def test_closed_listing_code_is_left_out_of_reading_words(self):
        body = ('<p>one two three</p>'
                '<details class="code-example"><summary>The script</summary>%s</details>'
                % CODE)
        words, reading = grt.word_counts(page(body))
        self.assertEqual(words, 3 + 2 + 500)
        # The summary is read on the way past; the folded code is not.
        self.assertEqual(reading, 3 + 2)

    def test_open_listing_counts(self):
        body = '<details class="code-example" open><summary>Shown</summary>%s</details>' % CODE
        self.assertEqual(grt.word_counts(page(body)), (501, 501))

    def test_inline_pre_counts(self):
        body = '<p>see</p>%s' % CODE
        self.assertEqual(grt.word_counts(page(body)), (501, 501))

    def test_other_details_count(self):
        # A FAQ answer or a glossary is prose, even though it starts closed.
        body = '<details class="faq-item"><summary>Why?</summary><pre>a b c</pre></details>'
        self.assertEqual(grt.word_counts(page(body)), (4, 4))

    def test_text_after_a_listing_counts_again(self):
        body = ('<details class="code-example"><summary>S</summary>%s</details>'
                '<p>back to prose here</p>' % CODE)
        words, reading = grt.word_counts(page(body))
        self.assertEqual(reading, 1 + 4)
        self.assertEqual(words, 1 + 500 + 4)

    def test_related_cards_and_scripts_still_skipped(self):
        body = ('<p>a b</p><script>var x = 1;</script>'
                '<div class="related-posts"><p>not counted</p></div>')
        self.assertEqual(grt.word_counts(page(body)), (2, 2))


class ReadingMinutes(unittest.TestCase):

    def test_minutes_follow_reading_words(self):
        prose = "<p>%s</p>" % " ".join(["w"] * 440)   # two minutes of prose
        big = "<pre><code>%s</code></pre>" % " ".join(["t"] * 4400)
        body = prose + '<details class="code-example"><summary>x</summary>%s</details>' % big
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "post.html"
            path.write_text(page(body), encoding="utf-8")
            self.assertEqual(grt.reading_minutes(path), 3)   # 441 reading words
            self.assertEqual(grt.count_words(path), 440 + 1 + 4400)

    def test_empty_body_is_zero(self):
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / "post.html"
            path.write_text(page(""), encoding="utf-8")
            self.assertEqual(grt.reading_minutes(path), 0)


if __name__ == "__main__":
    unittest.main()
