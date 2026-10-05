"""The newsletter pop-up's words: data/invites.json against data/posts.json.

Every published post gets its own invitation at the end (renderNewsletterPopup
in js/shared-components.js). A post without an entry still gets one, in its
category's words, so a missing entry breaks nothing on the page; this test is
what keeps each post's own words from being forgotten at publish time, the
way check_live_covers.py keeps its sketch. The words are public prose, so the
audit's house rules apply to them as they do to a post.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".github" / "scripts"))
import audit_site  # noqa: E402

# Long enough for a question and a sentence or two; past these the card
# grows a scroll on a phone.
TITLE_MAX = 60
LINE_MAX = 220


def load(name):
    return json.loads((ROOT / "data" / name).read_text(encoding="utf-8"))


class InvitesTest(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.invites = load("invites.json")["invites"]
        cls.slugs = [p["url"].split("/")[-1].removesuffix(".html") for p in load("posts.json")]

    def test_every_post_has_its_own(self):
        missing = [s for s in self.slugs if s not in self.invites]
        self.assertEqual(missing, [], "add an entry to data/invites.json for each")

    def test_entries_are_whole(self):
        for slug, entry in self.invites.items():
            with self.subTest(slug=slug):
                self.assertEqual(set(entry), {"title", "line"})
                self.assertTrue(entry["title"].strip() and entry["line"].strip())
                self.assertLessEqual(len(entry["title"]), TITLE_MAX)
                self.assertLessEqual(len(entry["line"]), LINE_MAX)

    def test_house_style(self):
        for slug, entry in self.invites.items():
            for field in ("title", "line"):
                text = entry[field]
                with self.subTest(slug=slug, field=field):
                    self.assertNotIn("—", text, "em dash")
                    self.assertIsNone(audit_site.CURLY_PROSE.search(text), "curly quote")
                    found = audit_site.BANNED_PROSE.search(text)
                    self.assertIsNone(found, found and f"banned: {found.group(0)!r}")


if __name__ == "__main__":
    unittest.main()
