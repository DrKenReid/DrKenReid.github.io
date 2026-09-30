"""generate_photo_renditions.py: which sizes a frame should have, and the check.

The renditions are made from originals on the release, which a test
cannot fetch, so these cases pin the parts that decide what is right:
the hero size (never enlarged), the edge a small original allows, the
thumb list that must not count the @2x doubles as frames, and --check's
verdicts on a small tree of stand-in files. The stand-ins are bare WebP
headers (VP8X), which is all the size reader looks at, so the tests need
no image library.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import generate_photo_renditions as gpr  # noqa: E402
import sitelib  # noqa: E402


def fake_webp(path, w, h):
    """A WebP header the size reader accepts: RIFF, WEBP, a VP8X chunk
    whose canvas is w x h."""
    body = b"WEBPVP8X" + (10).to_bytes(4, "little") + b"\0\0\0\0"
    body += (w - 1).to_bytes(3, "little") + (h - 1).to_bytes(3, "little")
    path.write_bytes(b"RIFF" + len(body).to_bytes(4, "little") + body)


class Sizes(unittest.TestCase):
    def test_hero_long_edge_and_never_enlarged(self):
        self.assertEqual(gpr.hero_size((6000, 4000)), (gpr.HERO_EDGE, 1280))
        self.assertEqual(gpr.hero_size((3000, 4500)), (1280, gpr.HERO_EDGE))
        self.assertEqual(gpr.hero_size((1200, 800)), (1200, 800))

    def test_edge_follows_the_original(self):
        self.assertEqual(gpr.hero_edge_for("1", {"1": [1200, 800]}), 1200)
        self.assertEqual(gpr.hero_edge_for("2", {"2": [6000, 4000]}), gpr.HERO_EDGE)
        self.assertEqual(gpr.hero_edge_for("3", {}), gpr.HERO_EDGE)   # not read yet

    def test_thumb_list_leaves_out_the_doubles(self):
        stems = [p.stem for p in sitelib.thumb_files()]
        self.assertTrue(stems)
        self.assertFalse([s for s in stems if not s.isdigit()])
        self.assertEqual(stems, sorted(stems, key=int))


class Check(unittest.TestCase):
    """check() over a stand-in tree: frame 1 is shown large, frame 2 is not."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.thumbs, self.heroes = root / "thumb", root / "hero"
        self.thumbs.mkdir()
        self.heroes.mkdir()
        self.originals = root / "photo-originals.json"
        fake_webp(self.thumbs / "1.webp", 400, 266)
        fake_webp(self.thumbs / "1@2x.webp", 800, 532)
        fake_webp(self.thumbs / "2.webp", 400, 110)
        fake_webp(self.thumbs / "2@2x.webp", 800, 220)
        fake_webp(self.heroes / "1.webp", 1200, 798)
        self.originals.write_text(json.dumps({"1": [1200, 798], "2": [5000, 1375]}))
        tracked = list(self.thumbs.iterdir()) + list(self.heroes.iterdir())
        self.patches = [
            mock.patch.object(gpr, "THUMBS", self.thumbs),
            mock.patch.object(gpr, "HEROES", self.heroes),
            mock.patch.object(gpr, "ORIGINALS", self.originals),
            mock.patch.object(sitelib, "THUMBS", self.thumbs),
            mock.patch.object(gpr, "referenced_frames", lambda: ["1"]),
            mock.patch.object(gpr.sitelib, "tracked", lambda *a: tracked),
        ]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in reversed(self.patches):
            p.stop()
        self.tmp.cleanup()

    def test_a_complete_tree_passes(self):
        # Frame 1's original is only 1200px, so a 1200px hero is as sharp as it gets.
        self.assertEqual(gpr.check(), [])

    def test_a_double_of_the_wrong_size_fails(self):
        fake_webp(self.thumbs / "2@2x.webp", 800, 400)
        self.assertTrue(any("2@2x" in p for p in gpr.check()))

    def test_a_hero_smaller_than_its_original_allows_fails(self):
        self.originals.write_text(json.dumps({"1": [6000, 3990], "2": [5000, 1375]}))
        self.assertTrue(any("hero/1.webp" in p and "allows" in p for p in gpr.check()))

    def test_a_frame_with_no_recorded_original_fails(self):
        self.originals.write_text(json.dumps({"1": [1200, 798]}))
        self.assertTrue(any("no size for frame 2" in p for p in gpr.check()))


if __name__ == "__main__":
    unittest.main()
