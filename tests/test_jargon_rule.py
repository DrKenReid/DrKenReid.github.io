"""The jargon rule: a post's jargon box and its prose agree.

sitelib.jargon_report finds box terms the post never uses and <jargon>
markers that name no box term; audit_site.check_jargon reports them as
jargon-unused and jargon-marker. Both mirror applyJargonTooltips, which
underlines a box term only where the post uses its words, so the label
cases in tests/jargon_aliases.json are also run against krJargonAliases
(tests/js/jargon.test.js).

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import json
import sys
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".github" / "scripts"))
import audit_site  # noqa: E402
import sitelib  # noqa: E402


def post(box, body):
    """A post with a jargon box of `box` [(term, definition)] and `body` HTML."""
    items = "".join(f"<li><strong>{t}:</strong> {d}</li>" for t, d in box)
    return ('<div class="blog-post"><h1>T</h1><p>Opening.</p>'
            f'<div class="plain-english-box"><h2>Quick jargon guide</h2><ul>{items}</ul></div>'
            f'{body}<ol class="references"><li id="ref-1">Never counted: a box term here.</li></ol></div>')


def unused(html):
    return [t for t, _line in sitelib.jargon_report(html)[0]]


def markers(html):
    return [k for k, _line in sitelib.jargon_report(html)[1]]


class Aliases(unittest.TestCase):
    """The names a label answers to, shared with the browser's matcher."""

    def test_cases_shared_with_the_runtime(self):
        cases = json.loads((ROOT / "tests" / "jargon_aliases.json").read_text(encoding="utf-8"))["cases"]
        for label, expected in cases:
            with self.subTest(label=label):
                self.assertEqual(sitelib.jargon_aliases(label), expected)


class Report(unittest.TestCase):
    """What jargon_report counts as a use, and what it does not."""

    def test_a_term_the_post_uses_passes(self):
        self.assertEqual(unused(post([("Mission command", "d")], "<p>That is mission command.</p>")), [])

    def test_plurals_and_case_count(self):
        self.assertEqual(unused(post([("Heuristic", "d")], "<p>Two HEURISTICS here.</p>")), [])

    def test_a_term_only_in_the_box_fails(self):
        self.assertEqual(unused(post([("Haggis", "d")], "<p>Nothing about it.</p>")), ["Haggis"])

    def test_a_different_wording_fails(self):
        # the Culture post's box said Glanding; its prose says glands
        self.assertEqual(unused(post([("Glanding", "d")], "<p>engineered glands</p>")), ["Glanding"])

    def test_a_marker_counts_as_a_use(self):
        html = post([("Glanding", "d")], '<p>engineered <jargon key="glanding">glands</jargon></p>')
        self.assertEqual(unused(html), [])
        self.assertEqual(markers(html), [])

    def test_either_alias_counts(self):
        self.assertEqual(unused(post([("Integer programming (IP)", "d")], "<p>an IP solver</p>")), [])
        self.assertEqual(unused(post([("Canon / headcanon", "d")], "<p>my headcanon</p>")), [])

    def test_whole_words_only(self):
        self.assertEqual(unused(post([("Cron", "d")], "<p>a chronic problem, acronyms</p>")), ["Cron"])

    def test_the_reference_list_and_code_are_not_prose(self):
        html = post([("Cache invalidation", "d")],
                    "<pre><code>// cache invalidation</code></pre>")
        self.assertEqual(unused(html), ["Cache invalidation"])

    def test_a_marker_without_a_box_term_fails(self):
        html = post([("Mission command", "d")],
                    '<p>mission command and <jargon key="psychological safety">safety</jargon></p>')
        self.assertEqual(markers(html), ["psychological safety"])

    def test_a_marker_may_name_a_site_wide_term(self):
        self.assertEqual(markers(post([], '<p><jargon key="LLM">model</jargon></p>')), [])

    def test_a_box_without_terms_or_a_jargon_heading_is_not_a_glossary(self):
        html = ('<div class="blog-post"><div class="plain-english-box"><h2>Note</h2>'
                '<ul><li>plain item</li></ul></div><p>Body.</p></div>')
        self.assertEqual(sitelib.jargon_report(html), ([], []))


def run_jargon(rel, html, tracked=True):
    found = []
    parser = audit_site.PageParser()
    parser.feed(html)
    ctx = audit_site.PageCtx(rel, rel, html, parser, {rel} if tracked else set(),
                             lambda sev, _page, _line, code, _msg: found.append((sev, code)))
    audit_site.check_jargon(ctx)
    return found


class AuditRule(unittest.TestCase):
    """check_jargon: errors on new posts, INFO for the grandfathered list."""

    BAD = post([("Haggis", "d")], "<p>No mention.</p>")
    GOOD = post([("Haggis", "d")], "<p>Haggis for tea.</p>")

    def test_a_new_post_with_an_unused_term_errors(self):
        self.assertEqual(run_jargon("blog/new-post.html", self.BAD), [("ERROR", "jargon-unused")])

    def test_an_unresolved_marker_errors(self):
        html = post([("Haggis", "d")], '<p>Haggis and <jargon key="neeps">turnips</jargon></p>')
        self.assertEqual(run_jargon("blog/new-post.html", html), [("ERROR", "jargon-marker")])

    # The grandfather list is empty now; a stand-in entry keeps its two
    # paths tested for as long as the rule supports one.
    LISTED = "blog/listed-post.html"

    def test_a_listed_post_is_info_until_fixed(self):
        with mock.patch.object(audit_site, "JARGON_PENDING", {self.LISTED}):
            self.assertEqual(run_jargon(self.LISTED, self.BAD), [("INFO", "jargon-unused")])

    def test_a_listed_post_that_passes_asks_to_leave_the_list(self):
        with mock.patch.object(audit_site, "JARGON_PENDING", {self.LISTED}):
            self.assertEqual(run_jargon(self.LISTED, self.GOOD), [("WARN", "jargon-unused")])

    def test_drafts_and_pages_are_left_to_the_lint(self):
        self.assertEqual(run_jargon("blog/new-post.html", self.BAD, tracked=False), [])
        self.assertEqual(run_jargon("about.html", self.BAD), [])


if __name__ == "__main__":
    unittest.main()
