"""The CSS pruner: selector splitting and the classes it must never drop.

style.min.css keeps only the rules whose selectors can match something
in the tracked pages and scripts (.github/scripts/css_prune.py). A
mistake here is silent: the rule vanishes from the served stylesheet and
the element renders unstyled, with nothing in the console. It has
happened: the hero headline's `bounceInDown` class is added by active.js
from a data-animation attribute, which the scan did not read, so the
headline lost its animation while its @keyframes survived. The shelf's
rating colours are the other shape of the trap, built as
'kr-spine--r' + n, which no file spells whole. These tests hold both,
the selector splitter every rule goes through, and RUNTIME_TOKENS, the
list for classes no scan can see.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import contextlib
import io
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import css_prune  # noqa: E402


class SplitSelectors(unittest.TestCase):
    """split_selectors: only the commas that separate selectors count."""

    def test_plain_list(self):
        self.assertEqual(css_prune.split_selectors(".a, .b ,\n.c"), [".a", ".b", ".c"])

    def test_commas_inside_functional_pseudo_classes(self):
        self.assertEqual(
            css_prune.split_selectors(".a:is(.b, .c), :where(p, li) > .d, .e:not(.f, .g)"),
            [".a:is(.b, .c)", ":where(p, li) > .d", ".e:not(.f, .g)"])

    def test_nested_arguments(self):
        self.assertEqual(css_prune.split_selectors(":is(:not(.a, .b), .c), .d"),
                         [":is(:not(.a, .b), .c)", ".d"])

    def test_commas_inside_attribute_tests_and_strings(self):
        self.assertEqual(
            css_prune.split_selectors('[style*="color: rgb(99, 99, 99)"], a[title=\'x, y\'], .z'),
            ['[style*="color: rgb(99, 99, 99)"]', "a[title='x, y']", ".z"])

    def test_empty_parts_are_dropped(self):
        self.assertEqual(css_prune.split_selectors(".a,, .b,"), [".a", ".b"])

    def test_a_rule_with_one_live_selector_keeps_only_that_one(self):
        usage = css_prune.usage_from_sources([(".html", '<p class="live"></p>')])
        self.assertEqual(css_prune.prune(".dead, .live:is(.x, .y), .gone{a:1}", usage),
                         ".live:is(.x, .y){a:1}")


class RuntimeTokens(unittest.TestCase):
    """RUNTIME_TOKENS: classes assembled where the scan cannot read them."""

    @classmethod
    def setUpClass(cls):
        cls.corpus = css_prune.collect_usage()     # the tracked pages and scripts

    def test_tokens_survive_with_no_source_mentioning_them(self):
        usage = css_prune.usage_from_sources([])
        for token in sorted(css_prune.RUNTIME_TOKENS):
            with self.subTest(token=token):
                self.assertTrue(usage.has_class(token))
                self.assertTrue(css_prune.selector_can_match("." + token, usage))

    def test_tokens_are_bare_class_names(self):
        # A leading dot or a space would make an entry that matches nothing.
        for token in css_prune.RUNTIME_TOKENS:
            with self.subTest(token=token):
                self.assertRegex(token, r"^-?[A-Za-z_][\w-]*$")

    def test_a_class_built_from_a_variable_needs_a_token(self):
        # 'kr-' + kind: too short a stem for the prefix rule, so without an
        # entry in RUNTIME_TOKENS the rule is pruned. This is the contract
        # the set exists for.
        js = "el.className = 'kr-' + kind;"
        usage = css_prune.usage_from_sources([(".js", js)])
        self.assertEqual(css_prune.prune(".kr-hobby{a:1}", usage), "")

    def test_the_real_corpus_keeps_the_rating_colours(self):
        # 'kr-spine--r' + n in js/bookshelf.js, kept by the prefix rule.
        for n in range(6):
            with self.subTest(rating=n):
                self.assertTrue(self.corpus.has_class("kr-spine--r%d" % n))

    def test_the_real_corpus_keeps_the_hero_animation(self):
        # active.js adds each slide's data-animation value as a class.
        index = (css_prune.ROOT / "index.html").read_text(encoding="utf-8")
        names = set(re.findall(r'data-animation="([^"]+)"', index))
        self.assertTrue(names, "no data-animation on the homepage slides")
        for name in names:
            with self.subTest(animation=name):
                self.assertTrue(self.corpus.has_class(name))


class SelfTest(unittest.TestCase):
    """css_prune.py --selftest, so its fixtures run with the rest."""

    def test_fixtures(self):
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = css_prune.selftest()
        self.assertEqual(code, 0, out.getvalue())


if __name__ == "__main__":
    unittest.main()
