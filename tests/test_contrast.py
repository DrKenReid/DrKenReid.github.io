"""Text and focus tokens clear WCAG AA against the surfaces they sit on.

The token blocks in style.css ("Brand system" and the later :root blocks)
quote a measured ratio beside each colour. Those comments were measured
once, by hand; this measures them again from the file on every run, so a
token nudged for taste without re-measuring fails here instead of on a
reader's screen. The bar is 4.5:1, the WCAG 2 minimum for body-size text,
for all of them, the focus ring included (3:1 would do for a non-text
indicator, but the ring shares its colour with link text).

The theme values are the cascade the page actually gets: every top-level
`:root` block in file order for light, then every
`:root[data-theme="dark"]` block over that for dark, with var() resolved.
The surfaces are each theme's page and card tokens (--kr-surface-warm,
--kr-surface-card), any further surface step the dark block declares,
and the page itself: the `body` background, from the dark theme's own
body rule where it has one.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import check_css  # noqa: E402
from harness import contrast_ratio as contrast  # noqa: E402  (the browser checks' WCAG maths)

STYLE = check_css.STYLE
AA = 4.5

# Colours that set text (or the ring around a focused control).
TEXT_TOKENS = ("--kr-eyebrow", "--kr-action", "--kr-action-hover", "--kr-muted",
               "--kr-ink", "--site-focus-ring", "--kr-caution")

DARK = ':root[data-theme="dark"]'


def parse_colour(value):
    """(r, g, b) in 0-255 from #rgb, #rrggbb or rgb()/rgba() (alpha ignored:
    no text token is translucent, and one that became so should fail)."""
    v = value.strip().lower()
    m = re.fullmatch(r"#([0-9a-f]{3}|[0-9a-f]{6})", v)
    if m:
        h = m.group(1)
        if len(h) == 3:
            h = "".join(ch * 2 for ch in h)
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    m = re.fullmatch(r"rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,/]+[\d.]+%?)?\s*\)", v)
    if m:
        return tuple(int(x) for x in m.groups())
    raise ValueError(f"not a plain colour: {value!r}")


def page_background(sheet, selectors, props):
    """The page colour: the last unconditional background on a rule for the
    first of `selectors` that has one, resolved with this theme's tokens.
    Listing the dark theme's own body rule first and plain `body` after it
    follows the cascade: a dark twin wins where there is one, and a body
    painted with a token follows the theme without one."""
    for selector in selectors:
        found = None
        for rule in sheet.rules:
            if rule.context or selector not in rule.selectors:
                continue
            for d in rule.declarations:
                if d.prop in ("background-color", "background"):
                    found = d.value
        if found is not None:
            return check_css.resolve(found, props)
    return None


class TokenContrast(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        sheet = check_css.parse_css(STYLE.read_text(encoding="utf-8"))
        light = check_css.custom_property_values(sheet, ":root")
        dark_block = check_css.custom_property_values(sheet, DARK)
        dark = dict(light, **dark_block)
        dark_body = ('[data-theme="dark"] body', ':root[data-theme="dark"] body',
                     'html[data-theme="dark"] body', "body")
        # The surfaces text sits on in each theme: the page and card tokens,
        # plus, for dark, any surface step the dark block declares. A surface
        # ramp declared once for both themes is a dark-only palette, so it
        # is not a light surface.
        light_surfaces = {"--kr-surface-warm", "--kr-surface-card"}
        dark_surfaces = light_surfaces | {k for k in dark_block if k.startswith("--kr-surface")}
        cls.themes = {}
        for name, props, body, names in (("light", light, ("body",), light_surfaces),
                                         ("dark", dark, dark_body, dark_surfaces)):
            surfaces = {k: props[k] for k in names if k in props}
            page = page_background(sheet, body, props)
            if page:
                surfaces["page"] = page
            cls.themes[name] = (props, surfaces)

    def test_every_theme_has_surfaces(self):
        for name, (_props, surfaces) in self.themes.items():
            with self.subTest(theme=name):
                self.assertIn("--kr-surface-warm", surfaces)
                self.assertIn("page", surfaces,
                              "no body background found for this theme; the test "
                              "needs to know where the page colour is set")

    def test_text_tokens_clear_aa(self):
        for name, (props, surfaces) in self.themes.items():
            for token in TEXT_TOKENS:
                if token not in props:
                    continue
                fg = parse_colour(check_css.resolve(props[token], props))
                for surface, value in surfaces.items():
                    try:
                        bg = parse_colour(check_css.resolve(value, props))
                    except ValueError:
                        continue    # a gradient or color-mix() surface token
                    with self.subTest(theme=name, token=token, on=surface):
                        ratio = contrast(fg, bg)
                        self.assertGreaterEqual(
                            round(ratio, 2), AA,
                            f"{token} is {ratio:.2f}:1 on {surface} in the {name} theme")

    def test_the_brief_tokens_are_all_present(self):
        # A rename would otherwise skip a token silently above.
        for name, (props, _surfaces) in self.themes.items():
            for token in ("--kr-eyebrow", "--kr-action", "--kr-muted", "--site-focus-ring"):
                with self.subTest(theme=name, token=token):
                    self.assertIn(token, props)

    def test_contrast_arithmetic(self):
        # Reference values: black on white is 21:1, and #767676 on white
        # is the well-known 4.54:1.
        self.assertAlmostEqual(contrast((0, 0, 0), (255, 255, 255)), 21.0, places=2)
        self.assertAlmostEqual(contrast(parse_colour("#767676"), parse_colour("#fff")),
                               4.54, places=2)


if __name__ == "__main__":
    unittest.main()
