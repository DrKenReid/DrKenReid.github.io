"""The homepage and the Data Science page describe the same person.

index.html carries the site's structured data as one @graph: a WebSite
whose publisher is a Person. data_science.html names that Person again, as
its ProfilePage's mainEntity, and its ScholarlyArticle authors point at the
same @id. A search engine merges every node that shares an @id into one, so
if the two pages disagreed about a job title it would publish both. These
tests keep the full descriptions of the node in step, and keep the
homepage's graph free of references to nodes that do not exist.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import audit_site  # noqa: E402
import sitelib  # noqa: E402

SITE = "https://www.kenreid.co.uk/"
PERSON = SITE + "#ken"
WEBSITE = SITE + "#website"

# Facts both full descriptions state, compared as plain values. Name-only
# stubs (the article bylines, "KN Reid") are not full descriptions and are
# left out: a byline is how the paper printed the name.
SHARED_FACTS = ("name", "honorificPrefix", "jobTitle")
SHARED_ORGS = ("worksFor", "alumniOf")


def blocks(page):
    """Every ld+json block on a page, parsed, via the audit's own parser."""
    parser = audit_site.PageParser()
    parser.feed((sitelib.ROOT / page).read_text(encoding="utf-8"))
    return [json.loads(raw) for raw, _line in parser.jsonld]


def nodes(data):
    """Every dict in a JSON-LD document, however deeply nested."""
    if isinstance(data, dict):
        yield data
        for value in data.values():
            yield from nodes(value)
    elif isinstance(data, list):
        for value in data:
            yield from nodes(value)


def full_person(page):
    """The page's full description of the site's Person: the node with the
    Person @id that says more than a name."""
    found = [n for b in blocks(page) for n in nodes(b)
             if n.get("@id") == PERSON and "jobTitle" in n]
    if len(found) != 1:
        raise AssertionError(f"{page}: expected one full Person node, found {len(found)}")
    return found[0]


class HomepageGraph(unittest.TestCase):
    """index.html: a WebSite and a Person, joined by @id."""

    def setUp(self):
        (self.doc,) = [b for b in blocks("index.html") if "@graph" in b]
        self.by_id = {n["@id"]: n for n in self.doc["@graph"]}

    def test_website_published_by_person(self):
        site = self.by_id[WEBSITE]
        self.assertEqual(site["@type"], "WebSite")
        self.assertEqual(site["url"], SITE)
        self.assertEqual(site["publisher"], {"@id": PERSON})
        self.assertEqual(self.by_id[PERSON]["@type"], "Person")

    def test_references_resolve(self):
        # A bare {"@id": ...} is a pointer; it has to land on a node here.
        for node in nodes(self.doc):
            if set(node) == {"@id"}:
                self.assertIn(node["@id"], self.by_id, f"dangling reference {node['@id']}")


class SamePersonEverywhere(unittest.TestCase):
    """The homepage's Person and data_science.html's mainEntity agree."""

    def setUp(self):
        self.home = full_person("index.html")
        self.research = full_person("data_science.html")

    def test_shared_facts(self):
        for key in SHARED_FACTS:
            self.assertEqual(self.home.get(key), self.research.get(key), key)
        for key in SHARED_ORGS:
            self.assertEqual(self.home[key]["name"], self.research[key]["name"], key)

    def test_url_is_the_site(self):
        for person in (self.home, self.research):
            self.assertEqual(person["url"].rstrip("/") + "/", SITE)

    def test_homepage_lists_every_research_profile(self):
        # The homepage is the complete node; the research page lists the
        # scholarly profiles, and each of them has to be on the homepage too.
        missing = set(self.research["sameAs"]) - set(self.home["sameAs"])
        self.assertEqual(missing, set())


if __name__ == "__main__":
    unittest.main()
