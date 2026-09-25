"""check_docs.py: which words count as paths, and what may never be named.

The checker reads prose and comments, where a path sits among ordinary
words, so the risk is in both directions: a rule that misses a stale path
(the first version stripped the leading dot from every .github/ path and
checked none of them), and one that fails on words that were never paths
(a URL a comment quotes on purpose, a query string, an example name).
Each case below is run against a small made-up tree, not the repository,
so it says the same thing on every checkout. The real tree is checked by
the CI step (check_docs.py --check).

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import check_docs  # noqa: E402

TREE = check_docs.Tree([
    ".github/docs/README.md", ".github/docs/TESTING.md", ".github/scripts/run_checks.py",
    "README.md", "blog/rating-systems.html", "blog/img/cover.webp", "data/posts.json",
    "js/site.js", "js/default-assets/active.js", "style.css",
])


def doc_findings(text, rel=".github/docs/README.md"):
    return [f.rule for f in check_docs.check_doc(rel, text + "\n", TREE)]


def comment_findings(text, lang="js"):
    src = {"js": "// ", "css": "/* ", "py": "# ", "hash": "# "}[lang] + text
    if lang == "css":
        src += " */"
    return [f.rule for f in check_docs.check_comments("js/x.js", src + "\n", lang, TREE)]


class PathsInTheDocs(unittest.TestCase):
    def test_a_tracked_path_passes_and_an_untracked_one_fails(self):
        self.assertEqual(doc_findings("run `.github/scripts/run_checks.py --fix`"), [])
        self.assertEqual(doc_findings("run `.github/scripts/run_all.py`"), ["missing-path"])
        self.assertEqual(doc_findings("see `js/site.js`, then `js/nav.js`"), ["missing-path"])

    def test_a_bare_file_name_must_be_some_tracked_file(self):
        self.assertEqual(doc_findings("`posts.json`"), [])
        self.assertEqual(doc_findings("`postz.json`"), ["missing-path"])

    def test_queries_fragments_and_line_numbers_are_not_the_path(self):
        for text in ("`../js/site.js?v=<stamp>`", "`js/site.js?v=20260923a`",
                     "`style.css#L10`", "`js/site.js:12`", "`/js/site.js`"):
            with self.subTest(text=text):
                self.assertEqual(doc_findings(text), [])

    def test_patterns_and_examples_are_skipped(self):
        for text in ("`img/og/<slug>.jpg`", "`blog/x.html`", "`blog/*.html`"):
            with self.subTest(text=text):
                self.assertEqual(doc_findings(text), [])
        self.assertEqual(doc_findings("`blog/*.md`"), ["missing-path"])

    def test_words_under_an_untracked_top_folder_are_not_paths(self):
        self.assertEqual(doc_findings("`and/or`, `n/a`, `https://example.com/x.js`"), [])

    def test_links_resolve_from_the_documents_folder(self):
        self.assertEqual(doc_findings("[t](TESTING.md#adding-a-check)"), [])
        self.assertEqual(doc_findings("[r](../../README.md)"), [])
        self.assertEqual(doc_findings("[x](DATA.md)"), ["broken-link"])
        self.assertEqual(doc_findings("[x](https://example.com/DATA.md)"), [])


class PathsInComments(unittest.TestCase):
    def test_a_stale_path_fails(self):
        self.assertEqual(comment_findings("started in js/active.js"), ["missing-path"])
        self.assertEqual(comment_findings("started in js/default-assets/active.js"), [])

    def test_a_site_absolute_url_is_what_a_browser_asks_for(self):
        self.assertEqual(comment_findings("the 404 page answers /blog/no-such-post.html"), [])

    def test_every_comment_language(self):
        for lang in ("js", "css", "py", "hash"):
            with self.subTest(lang=lang):
                self.assertEqual(comment_findings("see js/nav.js", lang), ["missing-path"])

    def test_code_is_not_read(self):
        src = "var u = '//cdn.example/js/nav.js'; var r = /js\\/nav.js/;\n"
        self.assertEqual(check_docs.check_comments("js/x.js", src, "js", TREE), [])

    def test_python_docstrings_are_comments(self):
        src = 'def f():\n    """Reads js/nav.js."""\n'
        rules = [f.rule for f in check_docs.check_comments("a.py", src, "py", TREE)]
        self.assertEqual(rules, ["missing-path"])


class NeverNamed(unittest.TestCase):
    def test_review_labels(self):
        for text in ("as site review 5a asked", "fixed (9a/10b)", "see (12c)"):
            with self.subTest(text=text):
                self.assertEqual(comment_findings(text), ["review-id"])
        self.assertEqual(comment_findings("review 5 of 9, a 2x zoom, (ES5) syntax"), [])

    def test_the_local_tools_folder(self):
        self.assertEqual(comment_findings("the key lives in scripts-local/key.txt"), ["private"])

    def test_drafts_as_a_folder_in_code_but_never_a_file(self):
        self.assertEqual(comment_findings("previews under blog/drafts/ use the root"), [])
        self.assertEqual(comment_findings("as blog/drafts/some-post.html shows"), ["private"])
        self.assertEqual(doc_findings("previews under blog/drafts/"), ["private"])

    def test_the_exclude_file_supplies_the_other_names(self):
        rules = check_docs.exclude_rules(
            "# comment\nNOTES.md\nprivate/\n/rooted.txt\n*.log\n!keep.md\n**/deep/x\n")
        patterns = [p for p, _ in rules]
        self.assertEqual(len(patterns), 3)

        def hit(text):
            return any(p.search(text) for p in patterns)
        self.assertTrue(hit("see NOTES.md"))
        self.assertTrue(hit("under private/ there"))
        self.assertTrue(hit("the rooted.txt file"))
        self.assertFalse(hit("MY-NOTES.md and privately/ and keep.md"))


if __name__ == "__main__":
    unittest.main()
