"""generate_post_head.py: the post template --fix writes and --check holds.

A post written from an old copy (inline gtag, #preloader, lang="en", the
flat BlogPosting of 2025) must come out of one --fix pass with the
current template, keep everything a person wrote, keep the file's own
indentation, and be left alone by a second pass. These cases pin that,
plus the rules a head cannot check itself: dateModified comes from
posts.json "updated" and never from anything else, a series links to its
page, and nothing in a string can close the JSON-LD's <script>.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import json
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import generate_post_head as gph  # noqa: E402

SITE = gph.SITE


def post(**extra):
    p = {
        "title": "Ant Colony, Live",
        "date": "2026-07-19",
        "tags": ["ai"],
        "category": "Data & AI",
        "excerpt": "An interactive ant colony optimiser.",
        "url": "blog/ant-colony-live.html",
        "image": "blog/img/antcolony/antcolony-hero.webp",
        "series": {"name": "Algorithms, Live", "part": 3},
        "readMinutes": 6,
        "words": 1172,
    }
    p.update(extra)
    return p


# The head of a post as the corpus had it before this template: one-space
# indent, a flat BlogPosting whose description and keywords are
# hand-written (and differ from the excerpt and tags on purpose).
OLD_POST = """<!DOCTYPE html>
<html lang="en">
<head>
 <meta charset="UTF-8">
 <meta name="description" content="Hand-trimmed description.">
 <meta name="keywords" content="ai">
 <title>Ant Colony, Live - Ken Reid</title>
 <meta property="og:title" content="Ant Colony, Live">
 <meta property="og:description" content="Hand-trimmed description.">
 <meta property="og:image" content="https://www.kenreid.co.uk/img/og/ant-colony-live.jpg">
 <meta property="og:url" content="https://www.kenreid.co.uk/blog/ant-colony-live.html">
 <meta property="og:type" content="article">
 <meta name="twitter:description" content="Hand-trimmed description.">
 <meta name="twitter:image" content="https://www.kenreid.co.uk/img/og/ant-colony-live.jpg">
 <meta name="DC.date" content="2026-07-19">
 <script async src="https://www.googletagmanager.com/gtag/js?id=G-PQK9NRXC9D"></script>
 <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-PQK9NRXC9D');</script>
 <link rel="icon" href="../img/core-img/favicon.png">
 <link rel="manifest" href="../manifest.json">
 <link rel="preload" as="image" href="img/antcolony/antcolony-hero.webp">
 <link rel="stylesheet" href="../style.min.css">
 <link rel="canonical" href="https://www.kenreid.co.uk/blog/ant-colony-live.html">
 <script type="application/ld+json">
 {
 "@context": "https://schema.org",
 "@type": "BlogPosting",
 "headline": "Ant Colony, Live",
 "description": "The JSON-LD's own description.",
 "keywords": ["ant colony optimization", "stigmergy"]
 }
 </script>
</head>
<body>
 <div id="preloader"><div class="loader"></div></div>

 <div id="header-section"></div>
 <main id="main-content">
  <header class="kr-opener" style="--kr-opener-img: url(/blog/img/antcolony/antcolony-hero.webp);">
  </header>
 </main>
 <script src="../js/jquery.min.js"></script>
 <script src="../js/shared-components.js"></script>
 <script src="../js/kr-viz.js?v=20260101a"></script>
</body>
</html>
"""


def blogposting(text):
    head = gph.head_of(text)
    _match, data = gph.ld_block_of_type(head, "BlogPosting")
    return data


class FixOldPost(unittest.TestCase):
    def setUp(self):
        self.new, self.changed = gph.canonicalise(OLD_POST, post())
        self.head = gph.head_of(self.new)

    def test_every_rule_applies_once(self):
        self.assertEqual(self.changed, ["lang", "preloader", "analytics", "asset-query",
                                        "open-graph", "preload",
                                        "keywords/icons/manifest", "jsonld-BlogPosting",
                                        "jsonld-BreadcrumbList"])

    def test_second_pass_changes_nothing(self):
        again, changed = gph.canonicalise(self.new, post())
        self.assertEqual(changed, [])
        self.assertEqual(again, self.new)

    def test_language(self):
        self.assertIn('<html lang="en-GB">', self.new)
        self.assertEqual(blogposting(self.new)["inLanguage"], "en-GB")

    def test_preloader_and_its_blank_line_go(self):
        self.assertNotIn("preloader", self.new)
        self.assertIn('<body>\n <div id="header-section"></div>', self.new)

    def test_analytics_replaces_the_snippet_in_place(self):
        self.assertNotIn("googletagmanager", self.new)
        self.assertNotIn("gtag(", self.new)
        self.assertIn(' <meta name="DC.date" content="2026-07-19">\n'
                      ' <script defer src="../js/analytics.js"></script>\n'
                      ' <link rel="icon"', self.head)

    def test_shared_assets_get_the_version_query(self):
        q = gph.ASSET_QUERY
        self.assertIn(f' <link rel="stylesheet" href="../style.min.css{q}">', self.head)
        self.assertIn(f' <script src="../js/shared-components.js{q}"></script>', self.new)
        # A vendored release keeps its bare name; a query already there,
        # whatever its value, is left alone.
        self.assertIn(' <script src="../js/jquery.min.js"></script>', self.new)
        self.assertIn(' <script src="../js/kr-viz.js?v=20260101a"></script>', self.new)
        self.assertIn(' <script defer src="../js/analytics.js"></script>', self.new)

    def test_open_graph_lines_in_order(self):
        props = re.findall(r'<meta property="([^"]+)"', self.head)
        self.assertEqual(props, [
            "og:title", "og:description", "og:image", "og:image:width", "og:image:height",
            "og:image:alt", "og:url", "og:type", "og:site_name", "og:locale",
            "article:published_time"])
        self.assertIn('<meta property="og:image:alt" content="Ant Colony, Live">', self.head)
        self.assertIn('<meta property="og:locale" content="en_GB">', self.head)

    def test_hero_preload_is_high_priority(self):
        self.assertIn(' <link rel="preload" as="image" href="img/antcolony/antcolony-hero.webp"'
                      ' fetchpriority="high">', self.head)

    def test_preload_follows_the_opener(self):
        stale = OLD_POST.replace('href="img/antcolony/antcolony-hero.webp"',
                                 'href="../img/photography/hero/1.webp"')
        new, _changed = gph.canonicalise(stale, post())
        self.assertIn('href="img/antcolony/antcolony-hero.webp" fetchpriority="high"', new)

    def test_hand_written_values_survive(self):
        data = blogposting(self.new)
        self.assertEqual(data["description"], "The JSON-LD's own description.")
        self.assertEqual(data["keywords"], ["ant colony optimization", "stigmergy"])
        self.assertIn('<meta name="description" content="Hand-trimmed description.">', self.head)

    def test_blogposting_links_the_site_graph(self):
        data = blogposting(self.new)
        person = {"@type": "Person", "@id": f"{SITE}/#ken", "name": "Ken Reid", "url": f"{SITE}/"}
        self.assertEqual(data["author"], person)
        self.assertEqual(data["publisher"], person)
        self.assertEqual(data["isPartOf"][0], {"@id": f"{SITE}/#website"})
        self.assertEqual(data["isPartOf"][1], {
            "@type": "CreativeWorkSeries",
            "@id": f"{SITE}/series-algorithms-live.html#series",
            "name": "Algorithms, Live",
            "url": f"{SITE}/series-algorithms-live.html",
        })
        self.assertEqual(data["image"], {"@type": "ImageObject",
                                         "url": f"{SITE}/img/og/ant-colony-live.jpg",
                                         "width": 1200, "height": 630})
        self.assertEqual((data["wordCount"], data["timeRequired"]), (1172, "PT6M"))
        self.assertEqual(data["articleSection"], "Data & AI")
        self.assertEqual(data["mainEntityOfPage"],
                         {"@type": "WebPage", "@id": f"{SITE}/blog/ant-colony-live.html"})

    def test_block_keeps_the_files_indentation(self):
        self.assertIn(' <script type="application/ld+json">\n {\n   "@context"', self.head)

    def test_breadcrumb_is_added_after_it(self):
        head = self.head
        self.assertLess(head.index('"BlogPosting"'), head.index('"BreadcrumbList"'))

    def test_nothing_left_for_a_person_but_the_absent_elements(self):
        missing = {field for field, _msg in gph.head_findings(self.head, post())}
        # The fixture leaves out lines only a person writes.
        self.assertNotIn("og:image:width", missing)
        self.assertNotIn("hero-preload", missing)
        self.assertNotIn("analytics", missing)
        self.assertIn("twitter:title", missing)


class TabIndentedHead(unittest.TestCase):
    def test_inserted_lines_take_the_anchor_indent(self):
        tabbed = OLD_POST.replace("\n <meta", "\n\t<meta")
        new, _changed = gph.canonicalise(tabbed, post())
        self.assertIn('\t<meta property="og:image:width" content="1200">', new)
        self.assertIn('\t<meta property="og:site_name" content="Ken Reid">', new)


class DateModified(unittest.TestCase):
    def test_falls_back_to_the_publication_date(self):
        new, _changed = gph.canonicalise(OLD_POST, post())
        self.assertEqual(blogposting(new)["dateModified"], "2026-07-19")
        self.assertNotIn("article:modified_time", new)

    def test_comes_from_updated_and_goes_when_it_does(self):
        updated = post(updated="2026-09-01")
        new, _changed = gph.canonicalise(OLD_POST, updated)
        self.assertEqual(blogposting(new)["dateModified"], "2026-09-01")
        self.assertIn('<meta property="article:modified_time" content="2026-09-01">', new)
        again, changed = gph.canonicalise(new, post())
        self.assertIn("open-graph", changed)
        self.assertNotIn("article:modified_time", again)

    def test_bad_updated_is_reported(self):
        for value, words in (("2026-9-1", "not a YYYY-MM-DD"), ("2026-07-01", "before")):
            found = dict(gph.post_findings(post(updated=value)))
            self.assertIn(words, found.get("updated", ""), value)


class Helpers(unittest.TestCase):
    def test_series_slug_matches_the_runtime(self):
        # seriesPageHref() in js/shared-components.js: quotes dropped, runs
        # of anything else collapse to one hyphen.
        self.assertEqual(gph.sitelib.series_page("Algorithms, Live"), "series-algorithms-live.html")
        self.assertEqual(gph.sitelib.series_page("Ken’s \"Best\" Bits!"), "series-kens-best-bits.html")

    def test_no_string_can_close_the_script(self):
        block = gph.ld_block({"headline": "a </script><script>alert(1)"})
        self.assertNotIn("</script><script>", block)
        self.assertEqual(json.loads(block.split("\n", 1)[1].rsplit("\n", 1)[0])["headline"],
                         "a </script><script>alert(1)")

    def test_a_new_posts_head_is_already_canonical(self):
        # The scaffold a new post starts from is a fixed point of --fix.
        page = ('<!DOCTYPE html>\n<html lang="en-GB">\n' + gph.render_head(post())
                + '\n<body>\n<header class="kr-opener" style="--kr-opener-img: '
                'url(/blog/img/antcolony/antcolony-hero.webp);"></header>\n</body>\n</html>\n')
        new, changed = gph.canonicalise(page, post())
        self.assertEqual(changed, [])
        self.assertEqual(gph.head_findings(gph.head_of(new), post()), [])

    def test_homepage_defines_what_posts_point_at(self):
        self.assertLessEqual({gph.PERSON_ID, gph.WEBSITE_ID}, gph.homepage_ids())


if __name__ == "__main__":
    unittest.main()
