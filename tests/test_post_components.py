"""Post components: the markup migration and the audit rules that hold it.

normalize_post_markup.py rewrites 60-odd posts in place, so each transform
is pinned here on a small input, together with the property the whole run
depends on: a second pass changes nothing. The audit rules that stop the
old markup coming back (audit_site.check_post_components) are checked on
the same shapes, passing and failing.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import audit_site  # noqa: E402
import normalize_post_markup as npm  # noqa: E402


def normalise(html):
    text, _counts, _notes = npm.normalise(html)
    return text


class Idempotent(unittest.TestCase):
    """Every transform leaves nothing for a second pass to do."""

    SAMPLE = (
        '<div class="blog-post">\n'
        '  <figure style="margin: 24px auto;">\n'
        '    <img src="a.webp" alt="a" style="width:100%; max-width:760px; display:block; '
        'margin:0 auto; border-radius:8px;">\n'
        '    <figcaption class="figure-note" style="margin-top: 8px; font-size: 0.8em;">c</figcaption>\n'
        '  </figure>\n'
        '  <pre><code>{"a": 1}</code></pre>\n'
        '  <details class="faq-item" id="references" style="margin-top: 32px;">\n'
        '    <summary>References</summary>\n'
        '    <ol style="margin-top: 12px; padding-left: 20px;">\n'
        '      <li id="ref-1">A source.</li>\n'
        '    </ol>\n'
        '  </details>\n'
        '  <hr style="margin: 40px 0;">\n'
        '  <p style="text-align: center;"><a class="post-cta" href="../blog.html">Back to all posts</a></p>\n'
        '</div>\n')

    def test_second_pass_changes_nothing(self):
        once = normalise(self.SAMPLE)
        self.assertNotEqual(once, self.SAMPLE)
        self.assertEqual(normalise(once), once)

    def test_crlf_survives(self):
        crlf = self.SAMPLE.replace("\n", "\r\n")
        out = normalise(crlf)
        self.assertNotIn("\n", out.replace("\r\n", ""))


class BackLink(unittest.TestCase):
    """The rule and the link go together, in either order."""

    LINK = '<p style="text-align: center;"><a class="post-cta" href="../blog.html">Back to all posts</a></p>\n'

    def test_rule_first(self):
        html = '<p>End.</p>\n\n<hr style="margin: 40px 0;">\n' + self.LINK + '</div>\n'
        self.assertEqual(normalise(html), '<p>End.</p>\n</div>\n')

    def test_link_first(self):
        html = '<p>End.</p>\n' + self.LINK + '<hr>\n<div class="related-posts"></div>\n'
        self.assertEqual(normalise(html), '<p>End.</p>\n<div class="related-posts"></div>\n')

    def test_a_plain_rule_is_left_alone(self):
        html = '<p>One.</p>\n<hr>\n<p>Two.</p>\n'
        self.assertEqual(normalise(html), html)


class Figures(unittest.TestCase):
    """A styled figure becomes .kr-figure--solo before its style goes."""

    def test_house_margin_becomes_solo(self):
        out = normalise('<figure style="margin: 24px auto;"><img src="a" alt=""></figure>')
        self.assertEqual(out, '<figure class="kr-figure--solo"><img src="a" alt=""></figure>')

    def test_picture_specific_width_stays(self):
        out = normalise('<figure style="margin: 24px auto; max-width: 300px;"><img src="a" alt=""></figure>')
        self.assertIn('class="kr-figure--solo" style="max-width: 300px;"', out)

    def test_unusual_margin_stays(self):
        out = normalise('<figure style="margin: -40px auto 0;"><img src="a" alt=""></figure>')
        self.assertIn('style="margin: -40px auto 0;"', out)
        self.assertIn("kr-figure--solo", out)

    def test_embed_and_centre(self):
        embed = normalise('<figure style="margin: 24px auto; display: flex; flex-direction: column; '
                          'align-items: center; text-align: center;"><button class="kr-embed-facade">'
                          '</button></figure>')
        self.assertIn('class="kr-figure--solo kr-figure--embed"', embed)
        self.assertNotIn("style=", embed)
        centre = normalise('<figure style="margin: 24px 0; text-align: center;"><img src="a" alt=""></figure>')
        self.assertIn('class="kr-figure--solo kr-figure--center"', centre)

    def test_plain_figure_untouched(self):
        html = '<figure><img class="post-img" src="a" alt=""></figure>'
        self.assertEqual(normalise(html), html)

    def test_image_house_styles_become_the_class(self):
        out = normalise('<figure><img src="a" alt="" style="width:100%; border-radius:8px; max-width:700px;"></figure>')
        self.assertIn('class="kr-figure-img" style="max-width: 700px;"', out)

    def test_portrait(self):
        out = normalise('<figure><img src="a" alt="" style="width:auto; max-width:100%; max-height:507px; '
                        'display:block; margin:0 auto; border-radius:8px;"></figure>')
        self.assertIn('class="kr-figure-img kr-figure-img--portrait"', out)
        self.assertNotIn("style=", out)

    def test_caption(self):
        out = normalise('<figure><figcaption class="figure-note" style="margin-top: 8px; font-size: 0.8em; '
                        'max-width: 560px;">c</figcaption></figure>')
        self.assertIn('<figcaption class="figure-note kr-figcaption">', out)


class AudioCard(unittest.TestCase):
    def test_callout_becomes_card(self):
        html = ('<div style="margin: 24px 0; background: #1a1a1a; border-left: 3px solid #fc6060;">\n'
                '  <span style="font-family: monospace; color: #fc6060;">&#9654; <a href="x" '
                'style="color: #fc6060;">Song</a></span>\n'
                '  <audio controls style="width: 100%; accent-color: #fc6060;"><source src="s.mp3"></audio>\n'
                '</div>')
        out = normalise(html)
        self.assertTrue(out.startswith('<div class="kr-audio-card">'))
        self.assertIn('<span class="kr-audio-card__label">&#9654; <a href="x">Song</a>', out)
        self.assertIn('<audio controls class="kr-audio-card__player">', out)
        self.assertNotIn("#fc6060", out)

    def test_dark_div_without_audio_is_not_a_card(self):
        html = '<div style="background: #1a1a1a;"><p>Console</p></div>'
        self.assertEqual(normalise(html), html)


class References(unittest.TestCase):
    def test_list_class_and_ids(self):
        out = normalise('<ol class="references-list"><li id="ref-1">A</li></ol>')
        self.assertEqual(out, '<ol class="references"><li id="ref-1">A</li></ol>')

    def test_styled_list_in_details(self):
        out = normalise('<details class="faq-item" id="references" style="margin-top: 32px;">'
                        '<summary>References</summary><ol style="padding-left: 20px;">\n'
                        '<li id="ref-1">A</li></ol></details>')
        self.assertIn('<details class="faq-item kr-references" id="references">', out)
        self.assertIn('<ol class="references">', out)
        self.assertIn('<li id="ref-1">', out)


class CodeLanguages(unittest.TestCase):
    def test_json_and_text(self):
        self.assertIn('<code class="language-json">', normalise('<pre><code>{"a": [1, 2]}</code></pre>'))
        self.assertIn('<code class="language-text">', normalise('<pre><code>Status: Optimal</code></pre>'))

    def test_named_language_is_kept(self):
        html = '<pre><code class="language-python">x = 1</code></pre>'
        self.assertEqual(normalise(html), html)


class InlineColours(unittest.TestCase):
    """audit_site.inline_colours: literal colours fail, tokens pass."""

    def test_literals(self):
        for style in ("color:#b00020; font-weight:700;", "border-bottom: 1px solid #99999955",
                      "background: rgba(240,180,60,0.13)", "color: white", "--accent: #fff",
                      "box-shadow: 0 4px 12px rgba(0,0,0,0.15)"):
            with self.subTest(style=style):
                self.assertTrue(audit_site.inline_colours(style))

    def test_not_colours(self):
        for style in ("background:var(--viz-s1)", "color: var(--kr-red-ish)", "border: none",
                      "--kr-cover: url('/blog/img/red-door.webp')", "max-width: 300px;",
                      "font-style: italic; letter-spacing: 0.05em", "border-radius: 8px"):
            with self.subTest(style=style):
                self.assertEqual(audit_site.inline_colours(style), [])


def components(html):
    parser = audit_site.ComponentParser()
    parser.feed(html)
    return parser


class ComponentRules(unittest.TestCase):
    def test_citation_needs_the_reference_shape(self):
        good = components('<p>x<a class="cite-ref" href="#ref-1">[1]</a></p>'
                          '<ol class="references"><li id="ref-1">A</li></ol>')
        self.assertIn("ref-1", good.ref_items)
        bad = components('<p>x<a class="cite-ref" href="#ref-1">[1]</a></p>'
                         '<ol class="references-list"><li id="ref-1">A</li></ol>')
        self.assertNotIn("ref-1", bad.ref_items)
        nested = components('<ol class="references"><li id="ref-1">A<ul><li id="ref-2">B</li></ul></li></ol>')
        self.assertEqual(nested.ref_items, {"ref-1"})

    def test_code_language_on_code_or_pre(self):
        self.assertEqual(components('<pre class="language-python"><code>x</code></pre>').bare_code, [])
        self.assertEqual(components('<pre><code class="language-json">{}</code></pre>').bare_code, [])
        self.assertEqual(len(components('<pre>\n<code>x</code></pre>').bare_code), 1)
        self.assertEqual(components('<p><code>inline</code></p>').bare_code, [])

    def test_youtube_and_back_link(self):
        p = components('<iframe src="https://www.youtube-nocookie.com/embed/x"></iframe>'
                       '<iframe src="https://lastfmstats.com/user/x"></iframe>'
                       '<p><a class="post-cta" href="../blog.html">Back to all posts</a></p>')
        self.assertEqual(len(p.youtube), 1)
        self.assertEqual(len(p.back_links), 1)


if __name__ == "__main__":
    unittest.main()
