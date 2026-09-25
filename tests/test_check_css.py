"""check_css.py: the stylesheet rules, on inputs small enough to read.

Each rule is shown something it must catch and something it must let
through, so a change to the parser or the scanners fails here, in one
obvious place, rather than as a quiet pass over the whole of style.css.
The real file is checked by the CI step (check_css.py --check).

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import check_css  # noqa: E402


def usage_of(css="", html="", js=""):
    usage = check_css.Usage()
    if css:
        check_css.scan_sheet(check_css.parse_css(css), usage)
    if html:
        check_css.scan_html(html, "page.html", usage)
    if js:
        check_css.scan_js(js, "x.js", usage)
    return usage


class Parsing(unittest.TestCase):
    def test_rules_contexts_and_lines(self):
        css = ("/* a comment { with braces } */\n"
               ".a { color: red; }\n"
               "@media (min-width: 1px) {\n"
               "  .b { margin: 0 !important; }\n"
               "}\n")
        sheet = check_css.parse_css(css)
        a, b = sheet.rules
        self.assertEqual((a.selector, a.context, a.line), (".a", (), 2))
        self.assertEqual((b.selector, b.context, b.line), (".b", ("@media (min-width: 1px)",), 4))
        self.assertTrue(b.declarations[0].important)
        self.assertEqual(b.declarations[0].value, "0")

    def test_strings_and_urls_do_not_break_statements(self):
        css = ('.a { content: "}"; background: url(data:image/svg+xml;utf8,x); }\n'
               ".b { color: blue; }")
        sheet = check_css.parse_css(css)
        self.assertEqual([r.selector for r in sheet.rules], [".a", ".b"])
        self.assertEqual(sheet.rules[0].get("background"), "url(data:image/svg+xml;utf8,x)")

    def test_nested_rules_keep_their_parent_as_context(self):
        sheet = check_css.parse_css(".card { color: red; &:hover { color: blue; } }")
        outer, inner = sheet.rules
        self.assertEqual(outer.get("color"), "red")
        self.assertEqual((inner.selector, inner.context), ("&:hover", (".card",)))

    def test_resolve_follows_var_chains_and_fallbacks(self):
        props = {"--a": "var(--b)", "--b": "#123456"}
        self.assertEqual(check_css.resolve("var(--a)", props), "#123456")
        self.assertEqual(check_css.resolve("var(--missing, #fff)", props), "#fff")
        with self.assertRaises(KeyError):
            check_css.resolve("var(--missing)", props)


class UndefinedAndUnused(unittest.TestCase):
    def test_a_read_of_nothing_is_reported(self):
        usage = usage_of(css=".a { color: var(--kr-accent); }")
        (msg,) = check_css.undefined_properties(usage)
        self.assertIn("--kr-accent", msg)

    def test_a_fallback_does_not_excuse_it(self):
        usage = usage_of(css=".a { color: var(--nobody-sets-this, red); }")
        self.assertEqual(len(check_css.undefined_properties(usage)), 1)

    def test_set_and_read_in_css_is_clean(self):
        usage = usage_of(css=":root { --x: 1px; } .a { margin: var(--x); }")
        self.assertEqual(check_css.undefined_properties(usage), [])
        self.assertEqual(check_css.unused_properties(usage), [])

    def test_a_set_that_nothing_reads_is_reported(self):
        usage = usage_of(css=":root { --dead: 1px; }")
        (msg,) = check_css.unused_properties(usage)
        self.assertIn("--dead", msg)

    def test_style_attributes_and_style_blocks(self):
        html = ('<header class="kr-opener" style="--kr-opener-img: url(/a.webp)"></header>'
                '<style>.x { --local: 1; width: var(--local); }</style>'
                '<svg><rect fill="var(--kr-ink)"/></svg>'
                '<!-- <p style="color: var(--commented-out)"></p> -->'
                '<pre><code>.demo { color: var(--an-example); }</code></pre>')
        usage = usage_of(css=".kr-opener::before { background: var(--kr-opener-img); }"
                             ":root { --kr-ink: #000; }", html=html)
        self.assertEqual(check_css.undefined_properties(usage), [])
        self.assertEqual(check_css.unused_properties(usage), [])
        self.assertNotIn("--commented-out", usage.reads)
        self.assertNotIn("--an-example", usage.reads)

    def test_scripts_set_read_and_mention(self):
        js = ("el.style.setProperty('--kr-mx', x + 'px');\n"
              "var v = getComputedStyle(el).getPropertyValue('--viz-ink');\n"
              "html += '<span style=\"--kr-n:' + n + '\"></span>';\n"
              "var names = ['--kr-reveal-x', '--kr-reveal-y'];\n")
        usage = usage_of(js=js)
        self.assertIn("--kr-mx", usage.sets)
        self.assertIn("--viz-ink", usage.reads)
        self.assertIn("--kr-n", usage.sets)
        # A bare name in a list could be either; it counts as both.
        self.assertTrue(usage.is_defined("--kr-reveal-x") and usage.is_read("--kr-reveal-y"))

    def test_a_stem_plus_a_value_covers_the_family(self):
        usage = usage_of(js="var c = style.getPropertyValue('--viz-s' + i);\n"
                            "var d = `--viz-grid-${k}`;")
        self.assertTrue(usage.is_read("--viz-s1"))
        self.assertFalse(usage.is_read("--viz-ink"))
        self.assertTrue(usage.is_read("--viz-grid-major"))
        # 'kr-spine--r' + n is a class stem, not a property: the name must
        # start the literal or follow a non-name character.
        self.assertFalse(usage_of(js="el.className = 'kr-spine--r' + n;").prefixes)

    def test_vendor_definitions_satisfy_reads_but_are_never_unused(self):
        usage = usage_of(css=".a { color: var(--blue); }")
        check_css.scan_sheet(check_css.parse_css(":root { --blue: #00f; --pink: #f0f; }",
                                                 "css/bootstrap.min.css"), usage, vendor=True)
        self.assertEqual(check_css.undefined_properties(usage), [])
        self.assertEqual(check_css.unused_properties(usage), [])


class Duplicates(unittest.TestCase):
    def test_the_same_rule_twice_is_reported_once(self):
        css = ".a { color: red; }\n.b { x: 1; }\n.a {\n  color: red;\n}\n"
        (msg,) = check_css.duplicate_rules(check_css.parse_css(css))
        self.assertIn("style.css:3", msg)
        self.assertIn("line 1", msg)

    def test_a_different_context_or_body_is_not_a_duplicate(self):
        css = (".a { color: red; }\n@media print { .a { color: red; } }\n"
               ".a { color: blue; }\n")
        self.assertEqual(check_css.duplicate_rules(check_css.parse_css(css)), [])


class PrintBlocks(unittest.TestCase):
    def test_one_is_fine_two_are_not(self):
        one = check_css.parse_css("@media print { .a { x: 1; } }")
        two = check_css.parse_css("@media print { .a { x: 1; } }\n"
                                  "@media only print and (min-width: 1px) { .b { x: 1; } }")
        self.assertEqual(check_css.print_blocks(one), [])
        self.assertEqual(len(check_css.print_blocks(two)), 1)

    def test_a_query_that_only_mentions_the_word_is_not_print(self):
        sheet = check_css.parse_css("@media (min-width: 1px) { .print-only { x: 1; } }")
        self.assertEqual(check_css.print_blocks(sheet), [])


class Ratchets(unittest.TestCase):
    def counts(self, css):
        found = check_css.ratchet_instances(check_css.parse_css(css))
        return {k: len(v) for k, v in found.items()}

    def test_colours_outside_the_token_blocks(self):
        css = (':root { --a: #fff; } :root[data-theme="dark"] { --a: #000; }\n'
               ".x { color: #c53030; background: rgba(0, 0, 0, .5); }\n"
               '.y { background: url("icon.svg#fff") no-repeat; }\n'
               ":root .z { color: #123; }\n")
        self.assertEqual(self.counts(css)["rawColours"], 3)

    def test_important_everywhere(self):
        css = ":root { --a: 1px !important; } .x { color: red !important; }"
        self.assertEqual(self.counts(css)["important"], 2)

    def test_dark_twins_but_not_dark_token_blocks(self):
        css = (':root[data-theme="dark"] { --kr-ink: #eee; }\n'
               '[data-theme="dark"] .card { background: #222; }\n'
               '[data-theme=dark] .card p { color: #ccc; }\n'
               "@media (prefers-color-scheme: dark) { .card { color: #fff; } }\n")
        self.assertEqual(self.counts(css)["darkRules"], 3)

    def test_token_block_recognition(self):
        for selector, token in ((":root", True), (':root[data-theme="dark"]', True),
                                (':root:not([data-theme="light"])', True),
                                (":root .kr-btn", False), ("html", False)):
            with self.subTest(selector=selector):
                rule = check_css.parse_css(selector + " { --x: 1; }").rules[0]
                self.assertEqual(check_css.is_token_block(rule), token)

    def test_the_baseline_file_names_every_ratchet(self):
        baseline = check_css.load_baseline()
        for key in check_css.RATCHETS:
            with self.subTest(ratchet=key):
                self.assertIsInstance(baseline.get(key), int)


if __name__ == "__main__":
    unittest.main()
