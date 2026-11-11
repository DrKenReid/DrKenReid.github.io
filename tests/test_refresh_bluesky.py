"""refresh_bluesky: which Bluesky post each blog post was shared in.

The replies under a post come from the Bluesky post data/bluesky.json
names for it, so a wrong entry shows a stranger's thread under the post
and a lost one takes the replies away. These cases pin the rules in the
module docstring of .github/scripts/refresh_bluesky.py with small
hand-built feed items, and run main() against a stand-in for the API (the
only network call, urllib's urlopen, is replaced), so nothing here leaves
the machine.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import contextlib
import io
import json
import sys
import tempfile
import unittest
import urllib.parse
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import refresh_bluesky as rb  # noqa: E402
import validate_data  # noqa: E402

SITE = "https://www.kenreid.co.uk/blog/%s.html"
OTHER = "did:plc:someoneelse000000000000"


def uri(rkey, did=rb.ACTOR):
    return "at://%s/app.bsky.feed.post/%s" % (did, rkey)


def item(rkey, when="2026-10-01T12:00:00.000Z", card=None, facets=(), did=rb.ACTOR,
         handle="kenreid.co.uk", reply=False, repost=False, quote_card=None):
    """One feed item as getAuthorFeed returns it, cut down to what is read."""
    record = {"$type": "app.bsky.feed.post", "createdAt": when, "text": "words"}
    if card:
        record["embed"] = {"$type": "app.bsky.embed.external", "external": {"uri": card}}
    if quote_card:
        record["embed"] = {"$type": "app.bsky.embed.recordWithMedia",
                           "media": {"$type": "app.bsky.embed.external",
                                     "external": {"uri": quote_card}}}
    if facets:
        record["facets"] = [{"index": {"byteStart": 0, "byteEnd": 5},
                             "features": [{"$type": "app.bsky.richtext.facet#link", "uri": u}]}
                            for u in facets]
    if reply:
        record["reply"] = {"parent": {"uri": uri("parent")}, "root": {"uri": uri("root")}}
    out = {"post": {"uri": uri(rkey, did), "author": {"did": did, "handle": handle},
                    "record": record, "indexedAt": when}}
    if repost:
        out["reason"] = {"$type": "app.bsky.feed.defs#reasonRepost"}
    return out


def entry(slug, rkey, posted="2026-10-01T12:00:00Z"):
    return {"slug": slug, "uri": uri(rkey),
            "url": "https://bsky.app/profile/kenreid.co.uk/post/%s" % rkey, "posted": posted}


class FakeApi:
    """Stands in for urllib.request.urlopen: serves feed pages and getPosts.

    `pages` is a list of lists of feed items; the cursor for page n is
    'c<n>'. `alive` is the URIs getPosts admits to. `fail` names what
    raises: a page number, or 'getPosts'.
    """

    def __init__(self, pages, alive=(), fail=()):
        self.pages, self.alive, self.fail = pages, set(alive), set(fail)
        self.requests = []

    def __call__(self, req, timeout=None):
        self.requests.append(req)
        url = urllib.parse.urlsplit(req.full_url)
        query = urllib.parse.parse_qs(url.query)
        method = url.path.rsplit("/", 1)[1]
        if method == "app.bsky.feed.getAuthorFeed":
            n = int(query.get("cursor", ["c0"])[0][1:])
            if n + 1 in self.fail:
                raise OSError("connection reset")
            body = {"feed": self.pages[n]}
            if n + 1 < len(self.pages):
                body["cursor"] = "c%d" % (n + 1)
        elif method == "app.bsky.feed.getPosts":
            if "getPosts" in self.fail:
                raise OSError("timed out")
            body = {"posts": [{"uri": u} for u in query["uris"] if u in self.alive]}
        else:
            raise AssertionError("unexpected call: " + method)
        return contextlib.closing(io.BytesIO(json.dumps(body).encode("utf-8")))

    def calls(self, method):
        return [r for r in self.requests if method in r.full_url]


class LinkToAPost(unittest.TestCase):
    def test_the_site_and_the_bare_domain_both_count(self):
        self.assertEqual(rb.slug_of("https://www.kenreid.co.uk/blog/sleep-science.html"), "sleep-science")
        self.assertEqual(rb.slug_of("https://kenreid.co.uk/blog/sleep-science.html"), "sleep-science")
        self.assertEqual(rb.slug_of("http://WWW.KENREID.CO.UK/blog/sleep-science.html"), "sleep-science")

    def test_a_query_a_fragment_or_no_extension_is_still_the_post(self):
        self.assertEqual(rb.slug_of(SITE % "sleep-science" + "?utm_source=bsky#faq"), "sleep-science")
        self.assertEqual(rb.slug_of("https://www.kenreid.co.uk/blog/sleep-science"), "sleep-science")

    def test_other_pages_and_other_sites_do_not(self):
        for url in ("https://www.kenreid.co.uk/gallery.html?photo=749",
                    "https://www.kenreid.co.uk/",
                    "https://www.kenreid.co.uk/blog.html",
                    "https://www.kenreid.co.uk/blog/drafts/sleep-science.html",
                    "https://www.kenreid.co.uk/blog/img/x/cover.html",
                    "https://example.org/blog/sleep-science.html",
                    "https://www.kenreid.co.uk.example.org/blog/sleep-science.html",
                    "javascript:alert(1)", "not a url", "", None):
            self.assertEqual(rb.slug_of(url), "", url)

    def test_links_are_the_card_then_the_link_facets(self):
        it = item("a", card=SITE % "one", facets=[SITE % "two", "https://example.org/"])
        self.assertEqual(rb.links(it["post"]["record"]),
                         [SITE % "one", SITE % "two", "https://example.org/"])
        quote = item("b", quote_card=SITE % "three")
        self.assertEqual(rb.links(quote["post"]["record"]), [SITE % "three"])

    def test_a_record_of_the_wrong_shape_has_no_links(self):
        for record in ({}, {"embed": "x", "facets": "y"}, {"embed": {"external": []}},
                       {"facets": [None, {"features": None}, {"features": [3, {"uri": 4}]}]},
                       {"facets": [{"features": [{"$type": "app.bsky.richtext.facet#tag",
                                                   "uri": SITE % "one"}]}]}):
            self.assertEqual(rb.links(record), [])


class Shares(unittest.TestCase):
    def test_a_card_or_a_facet_maps_the_post(self):
        found = rb.shares([item("a", card=SITE % "one"),
                           item("b", facets=["https://kenreid.co.uk/blog/two.html"])])
        self.assertEqual(found["one"], entry("one", "a"))
        self.assertEqual(found["two"], entry("two", "b"))

    def test_the_most_recent_share_wins_whatever_the_order(self):
        older = item("a", when="2026-08-07T09:00:00.000Z", card=SITE % "one")
        newer = item("b", when="2026-11-07T05:06:11.5Z", card=SITE % "one")
        for items in ([newer, older], [older, newer]):
            self.assertEqual(rb.shares(items)["one"], entry("one", "b", "2026-11-07T05:06:11Z"))

    def test_reposts_replies_and_other_authors_are_not_shares(self):
        items = [item("a", card=SITE % "one", repost=True),
                 item("b", card=SITE % "one", reply=True),
                 item("c", card=SITE % "one", did=OTHER, handle="someone.example"),
                 # A repost of my own post still carries a reason.
                 {"post": item("d", card=SITE % "one")["post"],
                  "reason": {"$type": "app.bsky.feed.defs#reasonRepost"}}]
        self.assertEqual(rb.shares(items), {})

    def test_a_slug_that_is_not_a_post_is_left_out(self):
        items = [item("a", card=SITE % "one"), item("b", card=SITE % "tpyo")]
        self.assertEqual(set(rb.shares(items, known={"one", "two"})), {"one"})
        self.assertEqual(set(rb.shares(items)), {"one", "tpyo"})

    def test_one_bluesky_post_can_share_two_posts(self):
        found = rb.shares([item("a", card=SITE % "one", facets=[SITE % "one", SITE % "two"])])
        self.assertEqual({s: e["uri"] for s, e in found.items()}, {"one": uri("a"), "two": uri("a")})

    def test_a_handle_that_cannot_be_used_falls_back_to_the_did(self):
        for handle in ("handle.invalid", None, "bad/handle"):
            (e,) = rb.shares([item("a", card=SITE % "one", handle=handle)]).values()
            self.assertEqual(e["url"], "https://bsky.app/profile/%s/post/a" % rb.ACTOR)

    def test_items_of_the_wrong_shape_are_skipped(self):
        broken = [None, 3, {}, {"post": None}, {"post": {"uri": uri("a")}},
                  {"post": {"uri": "at://nonsense", "author": {"did": rb.ACTOR}, "record": {}}},
                  item("b", when="yesterday", card=SITE % "one")]
        broken[-1]["post"]["indexedAt"] = None
        self.assertEqual(rb.shares(broken), {})

    def test_the_indexed_time_stands_in_for_a_bad_created_time(self):
        it = item("a", when="soon", card=SITE % "one")
        it["post"]["indexedAt"] = "2026-10-01T14:00:00+02:00"
        self.assertEqual(rb.shares([it])["one"]["posted"], "2026-10-01T12:00:00Z")


class Merge(unittest.TestCase):
    def test_an_entry_the_walk_did_not_see_is_kept(self):
        old = [entry("one", "a", "2025-01-01T00:00:00Z")]
        self.assertEqual(rb.merge(old, {"two": entry("two", "b")}),
                         [entry("two", "b"), entry("one", "a", "2025-01-01T00:00:00Z")])

    def test_a_newer_share_replaces_the_entry_and_an_older_one_does_not(self):
        old = [entry("one", "a", "2026-08-01T00:00:00Z")]
        newer, older = entry("one", "b", "2026-09-01T00:00:00Z"), entry("one", "c", "2026-07-01T00:00:00Z")
        self.assertEqual(rb.merge(old, {"one": newer}), [newer])
        self.assertEqual(rb.merge(old, {"one": older}), old)

    def test_a_deleted_post_gives_way_to_an_older_share_or_goes(self):
        old = [entry("one", "a", "2026-08-01T00:00:00Z"), entry("two", "b")]
        older = entry("one", "c", "2026-07-01T00:00:00Z")
        self.assertEqual(rb.merge(old, {"one": older}, {uri("a")}), [entry("two", "b"), older])
        self.assertEqual(rb.merge(old, {}, {uri("a")}), [entry("two", "b")])

    def test_newest_share_first_and_a_second_run_changes_nothing(self):
        found = {"one": entry("one", "a", "2026-01-01T00:00:00Z"),
                 "two": entry("two", "b", "2026-03-01T00:00:00Z"),
                 "six": entry("six", "c", "2026-03-01T00:00:00Z")}
        merged = rb.merge([], found)
        self.assertEqual([e["slug"] for e in merged], ["two", "six", "one"])
        self.assertEqual(rb.merge(merged, found), merged)


class Walk(unittest.TestCase):
    def test_pages_are_followed_by_cursor_to_the_end(self):
        api = FakeApi([[item("a")], [item("b")], [item("c")]])
        with mock.patch.object(rb.urllib.request, "urlopen", api):
            items, problem = rb.fetch_feed()
        self.assertEqual([i["post"]["uri"] for i in items], [uri("a"), uri("b"), uri("c")])
        self.assertEqual(problem, "")
        self.assertEqual(len(api.requests), 3)
        self.assertIn("filter=posts_no_replies", api.requests[0].full_url)

    def test_a_later_page_that_fails_keeps_the_pages_before_it(self):
        api = FakeApi([[item("a")], [item("b")], [item("c")]], fail={2})
        with mock.patch.object(rb.urllib.request, "urlopen", api):
            items, problem = rb.fetch_feed()
        self.assertEqual([i["post"]["uri"] for i in items], [uri("a")])
        self.assertIn("page 2", problem)

    def test_an_answer_of_the_wrong_shape_is_a_problem_not_a_crash(self):
        for body in (b"<html>busy</html>", b"[]", b'{"feed": "soon"}', b'{"error": "x"}'):
            items, problem = rb.fetch_feed(lambda url: body)
            self.assertEqual(items, [])
            self.assertIn("page 1", problem)

    def test_the_walk_stops_at_max_pages(self):
        calls = []

        def endless(url):
            calls.append(url)
            return json.dumps({"feed": [item("a")], "cursor": "more"}).encode()
        items, problem = rb.fetch_feed(endless)
        self.assertEqual(len(calls), rb.MAX_PAGES)
        self.assertEqual(problem, "")

    def test_the_request_says_nothing_about_me(self):
        api = FakeApi([[item("a")]])
        with mock.patch.object(rb.urllib.request, "urlopen", api):
            rb.fetch_feed()
        (req,) = api.requests
        self.assertTrue(req.full_url.startswith("https://public.api.bsky.app/xrpc/"))
        agent = req.get_header("User-agent")
        self.assertEqual(agent, rb.UA)
        for word in ("@", "ken", "reid", "mailto"):
            self.assertNotIn(word, agent.lower())
        self.assertFalse(req.has_header("Authorization"))
        self.assertFalse(req.has_header("Cookie"))


class Gone(unittest.TestCase):
    def test_a_post_the_api_leaves_out_is_gone(self):
        api = FakeApi([], alive={uri("a"), uri("c")})
        with mock.patch.object(rb.urllib.request, "urlopen", api):
            self.assertEqual(rb.gone([uri("a"), uri("b"), uri("c")]), ({uri("b")}, ""))

    def test_checks_go_out_in_batches(self):
        uris = [uri("p%d" % i) for i in range(rb.POSTS_PER_CHECK * 2 + 1)]
        api = FakeApi([], alive=uris)
        with mock.patch.object(rb.urllib.request, "urlopen", api):
            self.assertEqual(rb.gone(uris), (set(), ""))
        self.assertEqual(len(api.calls("getPosts")), 3)

    def test_no_answer_is_not_a_no(self):
        api = FakeApi([], fail={"getPosts"})
        with mock.patch.object(rb.urllib.request, "urlopen", api):
            missing, problem = rb.gone([uri("a")])
        self.assertEqual(missing, set())
        self.assertIn("timed out", problem)
        self.assertEqual(rb.gone([uri("a")], lambda url: b'{"posts": null}')[0], set())

    def test_nothing_to_check_asks_nothing(self):
        self.assertEqual(rb.gone([], lambda url: self.fail("asked")), (set(), ""))


class Main(unittest.TestCase):
    """main() against a stand-in API and a file in a temporary folder."""

    def run_main(self, api, old=None, argv=()):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / "bluesky.json"
            if old is not None:
                out.write_text(rb.dump(old), encoding="utf-8", newline="\n")
            before = out.read_bytes() if old is not None else None
            log = io.StringIO()
            with mock.patch.object(rb, "OUT", out), \
                    mock.patch.object(rb, "known_slugs", return_value=None), \
                    mock.patch.object(rb.urllib.request, "urlopen", api), \
                    contextlib.redirect_stdout(log):
                code = rb.main(list(argv))
            after = out.read_bytes() if out.exists() else None
            posts = json.loads(after)["posts"] if after else None
            return code, posts, before == after, log.getvalue()

    def test_a_first_run_writes_a_file_the_schema_accepts(self):
        api = FakeApi([[item("b", when="2026-11-01T10:00:00.000Z", card=SITE % "two"),
                        item("x", repost=True, card=SITE % "nine")],
                       [item("a", when="2026-10-01T10:00:00.000Z", facets=[SITE % "one"])]])
        code, posts, _, _ = self.run_main(api)
        self.assertEqual(code, 0)
        self.assertEqual(posts, [entry("two", "b", "2026-11-01T10:00:00Z"),
                                 entry("one", "a", "2026-10-01T10:00:00Z")])
        schema = json.loads(validate_data.schema_for(rb.OUT).read_text(encoding="utf-8"))
        errors = []
        validate_data.validate({"posts": posts}, schema, "bluesky.json", errors)
        self.assertEqual(errors, [])

    def test_a_feed_that_does_not_answer_leaves_the_file_alone(self):
        old = [entry("one", "a")]
        code, posts, untouched, log = self.run_main(FakeApi([[item("b", card=SITE % "two")]], fail={1}), old)
        self.assertEqual(code, 1)
        self.assertTrue(untouched)
        self.assertIn("leaving bluesky.json alone", log)

    def test_a_walk_cut_short_adds_what_it_saw_and_drops_nothing(self):
        old = [entry("one", "a", "2026-01-01T00:00:00Z")]
        api = FakeApi([[item("b", card=SITE % "two")], [item("a", card=SITE % "one")]],
                      alive={uri("a")}, fail={2})
        code, posts, _, log = self.run_main(api, old)
        self.assertEqual(code, 1)
        self.assertEqual([e["slug"] for e in posts], ["two", "one"])
        self.assertIn("partial refresh", log)

    def test_an_entry_out_of_the_feeds_reach_is_checked_and_kept(self):
        old = [entry("one", "a", "2024-01-01T00:00:00Z")]
        api = FakeApi([[item("b", card=SITE % "two")]], alive={uri("a")})
        code, posts, _, _ = self.run_main(api, old)
        self.assertEqual(code, 0)
        self.assertEqual([e["slug"] for e in posts], ["two", "one"])
        self.assertEqual(len(api.calls("getPosts")), 1)

    def test_a_deleted_share_is_dropped_or_replaced_by_an_older_one(self):
        old = [entry("one", "a", "2026-09-01T00:00:00Z"), entry("two", "b", "2026-09-02T00:00:00Z")]
        api = FakeApi([[item("c", when="2026-08-01T00:00:00.000Z", card=SITE % "one")]])
        code, posts, _, log = self.run_main(api, old)
        self.assertEqual(code, 0)
        self.assertEqual(posts, [entry("one", "c", "2026-08-01T00:00:00Z")])
        self.assertIn("two is gone", log)

    def test_a_check_that_fails_keeps_the_entry_and_reports(self):
        old = [entry("one", "a")]
        code, posts, untouched, _ = self.run_main(FakeApi([[item("z")]], fail={"getPosts"}), old)
        self.assertEqual(code, 1)
        self.assertTrue(untouched)

    def test_a_week_with_nothing_new_and_a_dry_run_write_nothing(self):
        old = [entry("one", "a")]
        api = FakeApi([[item("a", card=SITE % "one")]])
        code, _, untouched, _ = self.run_main(api, old)
        self.assertEqual((code, untouched), (0, True))
        self.assertEqual(api.calls("getPosts"), [])
        code, posts, _, log = self.run_main(FakeApi([[item("b", card=SITE % "two")]]), None, ["--dry-run"])
        self.assertEqual((code, posts), (0, None))
        self.assertIn("dry run", log)


class RealFile(unittest.TestCase):
    """The committed data/bluesky.json is what the script would write."""

    def test_round_trip(self):
        text = rb.OUT.read_text(encoding="utf-8")
        posts = rb.load(rb.OUT)
        self.assertEqual(rb.dump(posts), text)
        self.assertEqual(rb.merge(posts, {}), posts)
        self.assertEqual(len({e["slug"] for e in posts}), len(posts))

    def test_every_entry_is_a_post_of_mine_and_its_own_page(self):
        for e in rb.load(rb.OUT):
            m = rb.POST_URI.match(e["uri"])
            self.assertEqual(m.group(1), rb.ACTOR)
            self.assertTrue(e["url"].endswith("/post/" + m.group(2)))


if __name__ == "__main__":
    unittest.main()
