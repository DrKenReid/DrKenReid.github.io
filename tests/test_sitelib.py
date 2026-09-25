"""The generators' shared helpers (sitelib.py).

Each sitelib helper replaced copies that had drifted apart, so the
inputs below are the cases the copies disagreed on: a word count that
sits just past a minute boundary, a mistyped flag, a download mistaken
for a post. post_body has a module of its own (test_post_body.py), and
the CSS pruner's cases are in test_css_prune.py.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import contextlib
import io
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import sitelib  # noqa: E402


class ReadMinutes(unittest.TestCase):
    """read_minutes: 220 words a minute, rounded up, at least one."""

    def test_boundaries(self):
        for words, minutes in ((0, 1), (1, 1), (220, 1), (221, 2), (950, 5), (2200, 10)):
            with self.subTest(words=words):
                self.assertEqual(sitelib.read_minutes(words), minutes)


class ArgParser(unittest.TestCase):
    """arg_parser: an unknown or abbreviated flag stops before any work."""

    def parse(self, *argv):
        parser = sitelib.arg_parser("doc")
        parser.add_argument("--drafts", action="store_true")
        with contextlib.redirect_stderr(io.StringIO()):
            return parser.parse_args(list(argv))

    def test_unknown_flag_exits_2(self):
        with self.assertRaises(SystemExit) as caught:
            self.parse("--no-such-flag")
        self.assertEqual(caught.exception.code, 2)

    def test_abbreviation_is_refused(self):
        with self.assertRaises(SystemExit) as caught:
            self.parse("--dr")
        self.assertEqual(caught.exception.code, 2)


class Tracked(unittest.TestCase):
    def test_lists_existing_tracked_files(self):
        files = sitelib.tracked("data/posts.json")
        self.assertEqual([f.name for f in files], ["posts.json"])
        self.assertTrue(all(f.is_file() for f in files))

    def test_downloads_are_not_pages(self):
        self.assertFalse(sitelib.is_page("blog/downloads/tsp-demo.html"))
        self.assertTrue(sitelib.is_page("blog/evolution-live.html"))
        self.assertTrue(sitelib.is_page("index.html"))

    def test_tracked_posts_cover_posts_json_and_skip_downloads(self):
        # Redirect stubs for renamed posts are tracked posts too, so the
        # set is a superset of posts.json rather than equal to it.
        posts = {p.relative_to(sitelib.ROOT).as_posix() for p in sitelib.tracked_posts()}
        listed = {e["url"] for e in sitelib.load_posts()}
        self.assertEqual(listed - posts, set())
        self.assertFalse({p for p in posts if p.startswith(("blog/downloads/", "blog/drafts/"))})


if __name__ == "__main__":
    unittest.main()
