"""Structural rules in audit_site.py that are easy to get subtly wrong.

Each rule is checked against small inputs here (the attribute-name rule,
the service worker's install list, the retired preloader and analytics
snippet, title and description lengths, series pages and their slug,
KR_PAGES, what Jekyll would publish, the orphan scan's reading of a
mention), so a change to a parser or to the shape of a source file fails
in one obvious place instead of as a silent pass over the site.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import json
import re
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import audit_site  # noqa: E402


def bad_attributes(html):
    parser = audit_site.PageParser()
    parser.feed(html)
    return parser.bad_attrs


class MalformedAttributes(unittest.TestCase):
    """check_attributes: a quote inside a value spills out as attributes."""

    def test_unescaped_title_in_alt(self):
        # the related-posts card that shipped on three posts
        html = ('<img src="a.webp" alt="Why You Aren\'t a "Visual Learner"" '
                'loading="lazy">')
        (tag, names, _line), = bad_attributes(html)
        self.assertEqual(tag, "img")
        self.assertIn('learner""', names)

    def test_escaped_quotes_are_fine(self):
        html = '<img src="a.webp" alt="both labelled &quot;Path&quot;">'
        self.assertEqual(bad_attributes(html), [])

    def test_names_authors_write(self):
        html = ('<svg xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1 1">'
                '<use xlink:href="#a"/></svg>'
                '<div data-live-arg=\'{"lat": 1}\' aria-label="x" role="group"'
                ' data-wow-delay="100ms" hidden></div>'
                '<input type="range" aria-valuetext="0.5 degrees">')
        self.assertEqual(bad_attributes(html), [])

    def test_name_pattern(self):
        for name in ("alt", "data-x", "xlink:href", "_private", "data-a.b"):
            with self.subTest(name=name):
                self.assertTrue(audit_site.ATTR_NAME.fullmatch(name))
        for name in ('learner""', 'path",', "@click", "1st", "a/b"):
            with self.subTest(name=name):
                self.assertFalse(audit_site.ATTR_NAME.fullmatch(name))


class PrecacheList(unittest.TestCase):
    """precache_entries: sw.js's install list as repo paths."""

    def test_shapes(self):
        sw = """
        var VERSION = 'kr-v10';
        var PRECACHE = [
          './offline.html',
          "./js/site.js",
          '/data/posts.json',
          './style.min.css?v=3',
          './'
        ];
        """
        self.assertEqual(audit_site.precache_entries(sw), [
            "offline.html", "js/site.js", "data/posts.json",
            "style.min.css", "index.html"])

    def test_const_and_let(self):
        for keyword in ("const", "let"):
            with self.subTest(keyword=keyword):
                sw = f"{keyword} PRECACHE = ['./a.js'];"
                self.assertEqual(audit_site.precache_entries(sw), ["a.js"])

    def test_missing_list_is_not_an_empty_list(self):
        # an empty result would pass the check by finding nothing to check
        self.assertIsNone(audit_site.precache_entries("var CORE = ['./a.js'];"))

    def test_the_real_worker_parses(self):
        sw = (audit_site.ROOT / "sw.js").read_text(encoding="utf-8")
        entries = audit_site.precache_entries(sw)
        self.assertTrue(entries, "sw.js has no PRECACHE list the audit can read")


class ComponentPointers(unittest.TestCase):
    """The component messages name a style.css section; each must exist,
    or the pointer leads nowhere (they once named sections of a doc under
    headings that did not match)."""

    def test_every_named_section_is_a_banner(self):
        css = (audit_site.ROOT / audit_site.COMPONENT_DOC).read_text(encoding="utf-8")
        for key, name in audit_site.COMPONENT_SECTIONS.items():
            with self.subTest(section=name):
                self.assertRegex(css, r"/\* (?:---|==== ::) " + re.escape(name) + r" [-=]")

    def test_every_tag_maps_to_a_section(self):
        for tag, key in audit_site.COMPONENT_FOR_TAG.items():
            with self.subTest(tag=tag):
                self.assertIn(key, audit_site.COMPONENT_SECTIONS)


def run_page_checks(rel, html, checks, tracked=True):
    """Run page checks on one page; returns [(severity, code, message)]."""
    found = []
    parser = audit_site.PageParser()
    parser.feed(html)
    ctx = audit_site.PageCtx(rel, rel, html, parser, {rel} if tracked else set(),
                             lambda sev, _page, _line, code, msg: found.append((sev, code, msg)))
    audit_site.check_ids(ctx)
    for check in checks:
        check(ctx)
    return found


class RetiredMarkup(unittest.TestCase):
    """check_retired_markup: the preloader and the pasted analytics snippet."""

    SNIPPET = ('<script async src="https://www.googletagmanager.com/gtag/js?id=G-X"></script>'
               "<script>window.dataLayer = window.dataLayer || [];"
               "function gtag(){dataLayer.push(arguments);}gtag('js', new Date());"
               "gtag('config', 'G-X');</script>")

    def codes(self, html, tracked=True):
        return [code for _s, code, _m in run_page_checks(
            "about.html", html, [audit_site.check_retired_markup], tracked)]

    def test_the_preloader_is_an_error(self):
        self.assertEqual(self.codes('<div id="preloader"><div class="loader"></div></div>'),
                         ["preloader"])

    def test_the_inline_snippet_is_one_error(self):
        self.assertEqual(self.codes(self.SNIPPET), ["inline-analytics"])
        # Either half alone is still the snippet.
        self.assertEqual(self.codes(self.SNIPPET.split("</script>")[0] + "</script>"),
                         ["inline-analytics"])

    def test_the_shared_loader_is_fine(self):
        html = ('<script src="js/analytics.js" defer></script>'
                '<script>document.title = "gtag is only a word here";</script>'
                "<script>btn.onclick = () => gtag('event', 'share');</script>")
        self.assertEqual(self.codes(html), [])

    def test_untracked_drafts_are_not_held_to_it(self):
        self.assertEqual(self.codes('<div id="preloader"></div>', tracked=False), [])


class MetaLength(unittest.TestCase):
    """check_meta_length: top-level titles and descriptions search can show."""

    def found(self, rel, title, desc):
        html = f"<title>{title}</title><meta name=\"description\" content=\"{desc}\">"
        return [(s, c) for s, c, _m in run_page_checks(rel, html, [audit_site.check_meta_length])]

    def test_limits(self):
        ok_t, ok_d = "t" * audit_site.TITLE_MAX, "d" * audit_site.DESCRIPTION_MAX
        self.assertEqual(self.found("music.html", ok_t, ok_d), [])
        self.assertEqual(self.found("music.html", ok_t + "t", ok_d), [("WARN", "long-title")])
        self.assertEqual(self.found("music.html", ok_t, ok_d + "d"), [("WARN", "long-desc")])

    def test_a_post_over_the_limits_is_a_note_not_a_warning(self):
        ok_t, ok_d = "t" * audit_site.TITLE_MAX, "d" * audit_site.DESCRIPTION_MAX
        self.assertEqual(self.found("blog/x.html", ok_t, ok_d), [])
        self.assertEqual(self.found("blog/x.html", ok_t + "t", ok_d + "d"),
                         [("INFO", "long-title"), ("INFO", "long-desc")])

    def test_the_pending_list_can_only_shrink(self):
        pending = sorted(audit_site.LONG_META_PENDING)[0]
        self.assertEqual(self.found(pending, "t", "d" * 200), [("INFO", "long-desc")])
        # Once it fits, the stale entry is a warning until it is removed.
        self.assertEqual(self.found(pending, "t", "d" * 100), [("WARN", "long-desc")])

    def test_an_svg_title_is_not_the_page_title(self):
        parser = audit_site.PageParser()
        parser.feed("<head><title>Colophon</title></head><body>"
                    "<svg><title>Commits per month</title></svg></body>")
        self.assertEqual(parser.title, "Colophon")


class SeriesPages(unittest.TestCase):
    """sitelib.series_slug and check_series_pages."""

    def test_slug_rule(self):
        for name, slug in (("Algorithms, Live", "algorithms-live"),
                           ("How This Site Is Built", "how-this-site-is-built"),
                           ("Ken's Picks ’n’ Quotes", "kens-picks-n-quotes"),
                           ("  --Odd__Name!! ", "odd-name")):
            with self.subTest(name=name):
                self.assertEqual(audit_site.sitelib.series_slug(name), slug)

    @unittest.skipUnless(shutil.which("node"), "node is not installed")
    def test_the_slug_is_the_one_the_links_use(self):
        # seriesPageHref in js/shared-components.js builds every link to a
        # series page; every generator (the audit, the post head's
        # JSON-LD, the no-script listings) uses sitelib's copy.
        names = audit_site.series_names(audit_site.sitelib.load_posts())
        names += ["Ken's “Best” Bits", "A/B & C"]
        js = ("const src = require('fs').readFileSync(process.argv[1], 'utf8');"
              "const m = src.match(/function seriesPageHref[\\s\\S]*?\\n}/);"
              "const f = new Function(m[0] + '; return seriesPageHref;')();"
              "process.stdout.write(JSON.stringify(JSON.parse(process.argv[2]).map(f)));")
        out = subprocess.run(
            [shutil.which("node"), "-e", js,
             str(audit_site.ROOT / "js" / "shared-components.js"), json.dumps(names)],
            capture_output=True, text=True, encoding="utf-8", check=True).stdout
        for name, href in zip(names, json.loads(out)):
            with self.subTest(name=name):
                self.assertEqual(href, "/" + audit_site.sitelib.series_page(name))

    def test_a_series_without_a_page_or_a_sitemap_entry(self):
        posts = [{"series": {"name": "Has Page", "part": 1}},
                 {"series": [{"name": "No Page", "part": 1}, {"name": "Unmapped", "part": 2}]}]
        tracked = {"series-has-page.html", "series-unmapped.html"}
        locs = {audit_site.SITE + "/series-has-page.html"}
        found = []
        audit_site.check_series_pages(posts, tracked, locs,
                                      lambda s, f, l, code, m: found.append((code, m)))
        codes = sorted(code for code, _m in found)
        self.assertEqual(codes, ["series-page", "series-sitemap"])
        self.assertIn("series-no-page.html", " ".join(m for _c, m in found))


class SiteMap(unittest.TestCase):
    """kr_pages and check_site_map: KR_PAGES lists every top-level page."""

    def test_parsing_the_array(self):
        js = """
        var OTHER = ['nope.html'];
        var KR_PAGES = [
            { key: 'home', href: 'index.html', blurb: 'Intro, and [brackets]' },
            { key: 'about', href: "/about.html" },
            // { key: 'old', href: 'old.html' },
            { key: 'map', href: root + 'map.html#top' },
            { key: 'site', href: 'https://www.kenreid.co.uk/music.html' }
        ];
        var AFTER = ['after.html'];
        """
        self.assertEqual(audit_site.kr_pages(js),
                         {"index.html", "about.html", "map.html", "music.html"})
        self.assertIsNone(audit_site.kr_pages("var PAGES = [];"))

    def test_a_missing_page_is_an_error(self):
        found = []
        add = lambda s, f, l, code, m: found.append((f, code))  # noqa: E731
        pages = set(audit_site.kr_pages(
            (audit_site.ROOT / audit_site.SITE_MAP_SOURCE).read_text(encoding="utf-8")))
        audit_site.check_site_map(pages | {"new-page.html", "404.html", "blog/x.html"}, [], add)
        self.assertEqual(found, [("new-page.html", "site-map")])


class PublishedMarkdown(unittest.TestCase):
    """jekyll_publishes: which tracked files Pages would serve."""

    def test_what_jekyll_leaves_out(self):
        for rel, published in (("README.md", True), ("blog/NOTES.md", True),
                               (".github/docs/COMPONENTS.md", False), ("_drafts/x.md", False),
                               ("blog/#scratch.md", False), ("notes.md~", False)):
            with self.subTest(rel=rel):
                self.assertEqual(audit_site.jekyll_publishes(rel, []), published)

    def test_config_excludes(self):
        block = "require_front_matter: true\nexclude:\n  - README.md\n  - 'notes/'\nother: 1\n"
        inline = "exclude: [README.md, docs]\n"
        self.assertEqual(audit_site.jekyll_excludes(block), ["README.md", "notes/"])
        self.assertEqual(audit_site.jekyll_excludes(inline), ["README.md", "docs"])
        self.assertFalse(audit_site.jekyll_publishes("notes/a.md", ["notes/"]))
        self.assertFalse(audit_site.jekyll_publishes("README.md", ["*.md"]))

    def check(self, tracked):
        found = []
        audit_site.check_published_markdown(
            tracked, lambda sev, f, _l, _code, _m: found.append((sev, f)))
        return found

    def test_the_rule(self):
        pending = set(audit_site.PUBLISHED_MARKDOWN_PENDING)
        found = self.check({"README.md", "blog/downloads/x.md", ".github/docs/A.md",
                            "blog/B.md", "index.html"} | pending)
        self.assertEqual([f for sev, f in found if sev == "ERROR"], ["blog/B.md"])

    def test_the_pending_list_can_only_shrink(self):
        pending = sorted(audit_site.PUBLISHED_MARKDOWN_PENDING)
        if not pending:
            self.skipTest("nothing is waiting to move")
        found = self.check(set(pending[1:]))
        self.assertIn(("INFO", pending[-1]), found)
        # The one that has gone is a stale entry: a warning until removed.
        self.assertIn(("WARN", "audit_site.py"), found)


class OrphanNames(unittest.TestCase):
    """referenced_names: how the orphan report reads a mention."""

    def test_names_and_tails(self):
        names, tails = audit_site.referenced_names([
            '<img src="../img/bg-img/a.webp"> url(/img/core-img/b.png)',
            '"hero": "img/photography/hero/12.webp", "x": "fonts/v.woff2?v=3"'])
        self.assertTrue({"a.webp", "b.png", "12.webp", "v.woff2"} <= names)
        self.assertIn("hero/12.webp", tails)


if __name__ == "__main__":
    unittest.main()
