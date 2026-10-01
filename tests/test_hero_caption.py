"""The homepage's evolved headline says what it does, in both motion settings.

Slide 2's caption describes the canvas above it: how many triangles
js/hero-evolve.js evolves, and, for a reader who asked for reduced
motion, that the words are drawn as type instead. It once said "a
hundred and ten" while the script drew 78, and told readers with reduced
motion that the type in front of them was not a font. The script now
writes SHAPES into the caption; these checks hold the markup's own copy
(what a reader sees before the script runs) to the same number, and keep
both wordings present. Static: no browser.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def slide_two():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    at = html.index('class="kr-hero-evolve"')
    return html[at:html.index("</div>", at)]


class CaptionMatchesTheCanvas(unittest.TestCase):
    def test_the_stated_count_is_shapes(self):
        script = (ROOT / "js" / "hero-evolve.js").read_text(encoding="utf-8")
        shapes = re.search(r"\bvar SHAPES = (\d+);", script)
        self.assertIsNotNone(shapes, "SHAPES not found in js/hero-evolve.js")
        counts = re.findall(r"<span data-kr-evolve-shapes>(\d+)</span>", slide_two())
        self.assertEqual(len(counts), 2, "each wording carries the count")
        self.assertEqual(set(counts), {shapes.group(1)})

    def test_reduced_motion_has_its_own_wording(self):
        caption = slide_two()
        motion = re.search(r'<span class="kr-for-motion">(.*?)(?=<span class="kr-for-still">)', caption, re.S)
        still = re.search(r'<span class="kr-for-still">(.*?)</p>', caption, re.S)
        self.assertTrue(motion and still, "the caption needs both wordings, motion first")
        self.assertIn("not a font", motion.group(1))
        self.assertNotIn("not a font", still.group(1))
        self.assertIn("reduced motion", still.group(1))


if __name__ == "__main__":
    unittest.main()
