"""The quote wall baked into quotes.html (generate_quote_wall.py).

The lede's count used to be written only by the page's script, so a
reader without scripts saw "passages worth keeping" with no number. It is
baked with the cards now, and these pin that it follows the collection
rather than whatever the page said before, and that the #q-N ids shared
links point at stay positional.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import generate_quote_wall as gen  # noqa: E402

PAGE = (
    '<p class="section-heading__lede"><span id="quote-count">{count}</span> passages</p>\n'
    f"{gen.START}\nold cards\n{gen.END}\n"
)
QUOTES = [{"q": "First", "a": "Ursula K. Le Guin", "b": "The Dispossessed"},
          {"q": "Second <b>", "a": "Iain M. Banks"}]


class Render(unittest.TestCase):

    def test_count_follows_the_collection(self):
        for before in ("", "571", "3"):
            with self.subTest(before=before):
                out = gen.render(PAGE.format(count=before), QUOTES)
                self.assertIn('<span id="quote-count">2</span>', out)

    def test_cards_replace_the_old_ones_in_order(self):
        out = gen.render(PAGE.format(count=""), QUOTES)
        self.assertNotIn("old cards", out)
        self.assertLess(out.index('id="q-0"'), out.index('id="q-1"'))
        self.assertIn('data-a="ursula k. le guin"', out)
        self.assertIn("Second &lt;b&gt;", out)

    def test_a_fresh_bake_is_stable(self):
        once = gen.render(PAGE.format(count="9"), QUOTES)
        self.assertEqual(gen.render(once, QUOTES), once)


if __name__ == "__main__":
    unittest.main()
