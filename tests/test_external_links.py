"""check_external_links.py, offline: what counts as broken, and manners.

The weekly report is only useful if its "gone" list is short and true: a
link that 404s or whose host has vanished, not a server that turns away
scripts. These cases fix that line, the HEAD-then-GET retry, the hosts it
never asks, doi.org judged by its own answer, redirects that never arrive
or stop at a sign-in page, one request at a time per host, and the one
issue it keeps. No network: requests go to fakes, or to a server on
127.0.0.1 that plays Streamlit's sign-in hop.

Run from the repo root:
    python -m unittest discover -s tests -v
"""

import socket
import sys
import threading
import unittest
import urllib.error
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".github" / "scripts"))
import check_external_links as links  # noqa: E402


class FakeClock:
    def __init__(self):
        self.now, self.slept = 0.0, []

    def clock(self):
        return self.now

    def sleep(self, seconds):
        self.slept.append(round(seconds, 3))
        self.now += seconds


def server(answers):
    """A send() that answers from {(method, url): status, (status, final
    url) or exception}; a bare status answers from the URL asked for."""
    calls = []

    def send(method, url, follow=True):
        calls.append((method, url, follow))
        answer = answers.get((method, url), answers.get(url, 200))
        if isinstance(answer, BaseException):
            raise answer
        return answer if isinstance(answer, tuple) else (answer, url)
    return send, calls


class _SignInHop(BaseHTTPRequestHandler):
    """Streamlit's shape: the app redirects a visitor with no cookie to a
    sign-in hop, which sets the cookie and redirects back. /live answers
    200 once the cookie is there, /dead 404, and /private never lets the
    visitor past the sign-in page."""

    def log_message(self, *args):
        pass

    def do_HEAD(self):
        path = self.path.split("?")[0]
        signed_in = "hop=1" in (self.headers.get("Cookie") or "")
        if path == "/-/login":
            back = self.path.split("back=", 1)[-1]
            if back == "/private":
                return self.answer(200)
            return self.answer(303, {"Location": back, "Set-Cookie": "hop=1; Path=/"})
        if not signed_in:
            return self.answer(303, {"Location": "/-/login?back=" + path})
        self.answer(200 if path == "/live" else 404)

    do_GET = do_HEAD

    def answer(self, code, headers=None):
        self.send_response(code)
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.send_header("Content-Length", "0")
        self.end_headers()


def instant():
    fake = FakeClock()
    return links.Throttle(interval=1.0, clock=fake.clock, sleep=fake.sleep), fake


class Collect(unittest.TestCase):
    def test_external_links_with_their_places(self):
        page = ('<a href="https://example.org/a#part">x</a>\n'
                '<a href="https://example.org/a">again</a>\n'
                '<a href="https://www.kenreid.co.uk/blog.html">own site</a>\n'
                '<a href="/about.html">local</a><a href="mailto:x@y.z">mail</a>')
        found = links.collect([("about.html", page), ("blog/downloads/demo.html", page)])
        self.assertEqual(found, {"https://example.org/a": ["about.html:1", "about.html:2"]})


class Verdicts(unittest.TestCase):
    def check(self, answers, url="https://example.org/page"):
        send, calls = server(answers)
        throttle, _ = instant()
        return links.check_url(url, throttle, send), calls

    def test_a_working_head_is_one_request(self):
        result, calls = self.check({"https://example.org/page": 200})
        self.assertEqual(result.verdict, links.FINE)
        self.assertEqual([c[0] for c in calls], ["HEAD"])

    def test_a_refused_head_is_retried_as_get(self):
        result, _ = self.check({("HEAD", "https://example.org/page"): 405,
                                ("GET", "https://example.org/page"): 200})
        self.assertEqual((result.verdict, result.detail), (links.FINE, "HEAD 405, GET 200"))

    def test_gone_means_404_410_or_no_such_host(self):
        for answer in (404, 410, urllib.error.URLError(socket.gaierror(11001, "getaddrinfo"))):
            with self.subTest(answer=answer):
                self.assertEqual(self.check({"https://example.org/page": answer})[0].verdict,
                                 links.GONE)

    def test_refusals_and_timeouts_are_no_answer(self):
        for answer in (403, 429, 503, urllib.error.URLError(socket.timeout("timed out")),
                       TimeoutError("timed out")):
            with self.subTest(answer=answer):
                self.assertEqual(self.check({"https://example.org/page": answer})[0].verdict,
                                 links.NO_ANSWER)

    def test_doi_is_judged_by_its_own_redirect(self):
        result, calls = self.check({"https://doi.org/10.1/x": 302}, url="https://doi.org/10.1/x")
        self.assertEqual(result.verdict, links.FINE)
        self.assertFalse(calls[0][2], "doi.org redirects must not be followed")

    def test_a_redirect_that_never_arrives_is_gone(self):
        # The dead Streamlit app looped through its sign-in hop until
        # urllib gave up with the 303, which used to count as fine.
        result, calls = self.check({"https://example.org/page": 303})
        self.assertEqual(result.verdict, links.GONE)
        self.assertEqual([c[0] for c in calls], ["HEAD", "GET"])
        self.assertIn("never arrived", result.detail)

    def test_a_chain_ending_on_a_sign_in_page_is_gone(self):
        app = "https://someone-app.streamlit.app/"
        login = "https://someone-app.streamlit.app/-/login?payload=x"
        result, _ = self.check({app: (200, login)}, url=app)
        self.assertEqual((result.verdict, result.detail),
                         (links.GONE, "HEAD 200 (a sign-in page), GET 200 (a sign-in page)"))
        result, _ = self.check({app: (200, "https://share.streamlit.io/-/auth/app?x=1")}, url=app)
        self.assertEqual(result.verdict, links.GONE)

    def test_an_app_that_comes_back_from_sign_in_is_fine(self):
        app = "https://someone-app.streamlit.app/"
        self.assertEqual(self.check({app: (200, app)}, url=app)[0].verdict, links.FINE)
        # Another host's /-/login is its own business.
        other = "https://example.org/-/login"
        self.assertEqual(self.check({other: 200}, url=other)[0].verdict, links.FINE)


class RealRequests(unittest.TestCase):
    """request() itself, against a sign-in hop on 127.0.0.1: without the
    cookie jar every one of these loops and comes back as a 303."""

    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), _SignInHop)
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()
        cls.base = "http://127.0.0.1:%d" % cls.httpd.server_address[1]

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def verdict(self, path):
        throttle, _ = instant()
        saved = links.LOGIN_WALLS
        links.LOGIN_WALLS = {"127.0.0.1": ("/-/login",)}
        try:
            return links.check_url(self.base + path, throttle).verdict
        finally:
            links.LOGIN_WALLS = saved

    def test_the_cookie_carries_a_visitor_through_the_hop(self):
        status, final = links.request("HEAD", self.base + "/live")
        self.assertEqual((status, final), (200, self.base + "/live"))
        self.assertEqual(self.verdict("/live"), links.FINE)

    def test_a_missing_app_behind_the_hop_is_gone(self):
        self.assertEqual(links.request("GET", self.base + "/dead")[0], 404)
        self.assertEqual(self.verdict("/dead"), links.GONE)

    def test_an_app_that_stops_at_sign_in_is_gone(self):
        status, final = links.request("HEAD", self.base + "/private")
        self.assertEqual(status, 200)
        self.assertTrue(final.startswith(self.base + "/-/login"), final)
        self.assertEqual(self.verdict("/private"), links.GONE)

    def test_an_unfollowed_redirect_is_its_own_answer(self):
        self.assertEqual(links.request("HEAD", self.base + "/live", follow=False)[0], 303)


class Politeness(unittest.TestCase):
    def test_skipped_hosts_are_never_requested(self):
        urls = {"https://scholar.google.com/citations?user=x": ["a.html:1"],
                "https://www.goodreads.com/review/show/1": ["a.html:2"],
                "https://uk.linkedin.com/in/x": ["a.html:3"],
                "https://example.org/": ["a.html:4"]}
        send, calls = server({})
        throttle, _ = instant()
        results, skipped = links.check_all(urls, send, throttle, workers=2)
        self.assertEqual([r.url for r in results], ["https://example.org/"])
        self.assertEqual(len(skipped), 3)
        self.assertEqual({c[1] for c in calls}, {"https://example.org/"})

    def test_one_host_waits_between_requests(self):
        throttle, fake = instant()
        for _ in range(3):
            throttle.wait("example.org")
            fake.now += 0.25            # the request itself took a quarter second
        throttle.wait("other.org")      # another host does not wait
        self.assertEqual(fake.slept, [0.75, 0.75])


class Report(unittest.TestCase):
    def results(self):
        return [links.Result("https://a.org/x", links.GONE, "HEAD 404, GET 404", ["p.html:3"]),
                links.Result("https://b.org/y|z", links.NO_ANSWER, "HEAD 403, GET 403",
                             ["p.html:%d" % n for n in range(5)]),
                links.Result("https://c.org/", links.FINE, "HEAD 200", ["p.html:9"])]

    def test_markdown(self):
        text = links.markdown(self.results(), ["https://scholar.google.com/x"])
        self.assertIn("3 external links checked: 1 fine, 1 gone, 1 with no clear answer", text)
        self.assertIn("| https://a.org/x | HEAD 404, GET 404 | p.html:3 |", text)
        self.assertIn("https://b.org/y\\|z", text)          # a pipe cannot end the cell
        self.assertIn("and 2 more", text)
        self.assertNotIn("https://c.org/", text)

    def test_the_issue_opens_updates_and_closes(self):
        calls, open_issues = [], []

        def api(method, path, token, body=None):
            calls.append((method, path, body))
            if method == "GET":
                return list(open_issues)
            if method == "POST":
                return {"number": 7}
            return {}

        report = links.markdown(self.results(), [])
        self.assertEqual(links.update_issue(report, True, "o/r", "t", api), "opened issue #7")
        self.assertIn(links.ISSUE_MARKER, calls[-1][2]["body"])
        open_issues.append({"number": 7, "body": links.ISSUE_MARKER + "\nold"})
        self.assertEqual(links.update_issue(report, True, "o/r", "t", api), "updated issue #7")
        self.assertTrue(links.update_issue(report, False, "o/r", "t", api).startswith("closed"))
        self.assertEqual(calls[-1][2]["state"], "closed")
        open_issues.clear()
        self.assertEqual(links.update_issue(report, False, "o/r", "t", api), "no issue needed")


if __name__ == "__main__":
    unittest.main()
