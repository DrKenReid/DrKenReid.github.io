"""Design decisions that look like mistakes, pinned so nobody "fixes" them.

Each class here is one decision the site depends on and that a tidy-up
would plausibly undo, because the code that carries it looks arbitrary
without the story. The docstring is the story. All static: they read the
source files, so they run in a second and need no browser.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import check_css  # noqa: E402

ROOT = check_css.ROOT
SHEET = check_css.parse_css(check_css.STYLE.read_text(encoding="utf-8"))


def js_function(source, name):
    """The text of `function name(...) {...}` in a script, braces matched
    (strings and comments are not special-cased: the functions read here
    hold no unbalanced brace in either)."""
    m = re.search(r"\bfunction\s+%s\s*\(" % re.escape(name), source)
    if not m:
        return None
    i = source.index("{", m.end())
    depth = 0
    for j in range(i, len(source)):
        depth += {"{": 1, "}": -1}.get(source[j], 0)
        if depth == 0:
            return source[m.start():j + 1]
    return None


class OpenerClipsRatherThanHides(unittest.TestCase):
    """.kr-opener is `overflow: clip`, never hidden, auto or scroll.

    Any of those makes the opener a scroll container, and every view()
    timeline inside it (the photograph's drift, the title's lift, the
    scrim deepening) then measures scroll progress against the opener,
    which never scrolls. The drift sat on frame zero for exactly this
    reason until the value changed. clip crops the same way without
    creating a scroll container.
    """

    def test_overflow_is_clip(self):
        values = [(r.line, d.prop, d.value) for r in SHEET.rules
                  if ".kr-opener" in r.selectors
                  for d in r.declarations if d.prop.startswith("overflow")]
        self.assertTrue(values, "no overflow rule for .kr-opener")
        for line, prop, value in values:
            with self.subTest(line=line):
                self.assertNotIn(value, ("hidden", "auto", "scroll"),
                                 f"style.css:{line} sets {prop}: {value} on .kr-opener")
        self.assertIn("clip", [v for _l, _p, v in values])


class GradientTextHasAFallback(unittest.TestCase):
    """Every background-clip: text sits inside @supports for it.

    Gradient type is transparent text over a gradient background, clipped
    to the glyphs. Where the clip is unsupported, the gradient fills the
    box and the transparent text is invisible text. .kr-gradient-text
    carries the pattern (a solid colour outside, the gradient inside
    @supports); anything else that clips to text must do the same.
    """

    def test_clip_is_guarded(self):
        for rule in SHEET.rules:
            for d in rule.declarations:
                if d.prop in ("background-clip", "-webkit-background-clip") and "text" in d.value:
                    with self.subTest(line=d.line, selector=rule.selector[:60]):
                        self.assertTrue(
                            any(c.startswith("@supports") and "background-clip" in c
                                for c in rule.context),
                            f"style.css:{d.line}: {rule.selector} clips to text outside "
                            f"@supports ((-webkit-background-clip: text) or "
                            f"(background-clip: text))")


class DerivedTokensAreRestated(unittest.TestCase):
    """A rule that overrides a token another token is built from restates
    the built one too.

    A custom property whose value holds var() is resolved where it is
    declared, so --kr-brand-gradient inherits already computed from the
    :root colours: setting only --kr-brand-from on a wrapper (or in the
    dark block) changes nothing. Both theme blocks therefore declare the
    gradient in full, and so must anything else that sets its inputs.
    """

    def test_both_theme_blocks_declare_the_brand_gradient(self):
        for selector in (":root", ':root[data-theme="dark"]'):
            with self.subTest(block=selector):
                value = check_css.custom_property_values(SHEET, selector).get(
                    "--kr-brand-gradient", "")
                self.assertIn("linear-gradient(", value)
                self.assertIn("var(--kr-brand-from)", value)
                self.assertIn("var(--kr-brand-to)", value)

    def test_every_override_restates_what_reads_it(self):
        light = check_css.custom_property_values(SHEET, ":root")
        derived = {name: set(re.findall(r"var\((--[\w-]+)", value))
                   for name, value in light.items() if "var(" in value}
        self.assertIn("--kr-brand-gradient", derived)
        groups = {}
        for rule in SHEET.rules:
            if not rule.selector.startswith("@"):
                groups.setdefault((rule.context, rule.selector), []).extend(rule.declarations)
        for (context, selector), decls in groups.items():
            if selector == ":root" and not context:
                continue
            names = {d.prop for d in decls}
            for token, inputs in derived.items():
                if names & inputs:
                    with self.subTest(selector=selector[:60], token=token):
                        self.assertIn(token, names,
                                      f"{selector} sets {sorted(names & inputs)} but not "
                                      f"{token}, which is built from it")


class CardsCarryNoScrollReveal(unittest.TestCase):
    """createBlogCardElement emits no `wow` class.

    WOW.js keeps an element invisible until it scrolls into view, then
    animates it in. On a grid of cards, a reader scrolling quickly meets
    empty boxes waiting for their turn, and a full-page capture records
    them empty. Reveals belong to section headings only.
    """

    def test_no_wow_in_the_card_builder(self):
        source = (ROOT / "js" / "shared-components.js").read_text(encoding="utf-8")
        body = js_function(source, "createBlogCardElement")
        self.assertIsNotNone(body, "createBlogCardElement not found")
        self.assertNotRegex(body, r"\bwow\b")


class DataIsNetworkFirst(unittest.TestCase):
    """sw.js answers /data/ requests network first.

    The data files change on a schedule (Goodreads, Last.fm). Served
    stale-while-revalidate, the first visit after a refresh showed last
    week's shelf and the right one only on the next load. Network first,
    with the cache as the offline fallback, shows the current file.
    """

    def test_data_branch_uses_network_first(self):
        sw = (ROOT / "sw.js").read_text(encoding="utf-8")
        start = sw.index("addEventListener('fetch'")
        handler = sw[start:sw.index("\n});", start)]
        at = handler.find("'/data/'")
        self.assertNotEqual(at, -1, "the fetch handler no longer tests for /data/")
        branch = handler[at:handler.find("} else", at)]
        self.assertIn("networkFirst(", branch)
        self.assertNotIn("staleWhileRevalidate(", branch)
        # Nothing ahead of it may catch a data file first.
        self.assertNotIn("staleWhileRevalidate(", handler[:at])


if __name__ == "__main__":
    unittest.main()
