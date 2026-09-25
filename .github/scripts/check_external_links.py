#!/usr/bin/env python3
"""Weekly report of external links that have stopped answering.

    python .github/scripts/check_external_links.py            # check and report
    python .github/scripts/check_external_links.py --list     # the URLs, no requests
    python .github/scripts/check_external_links.py --limit 20 # a quick sample

Run by .github/workflows/links.yml every Monday and on demand. It reports
and never fails: the answer depends on other people's servers, not on
anything a push changed, so it has no place gating a commit (the audit
checks every internal link on every push instead).

What it reads. Every tracked page's <a href> that leaves the site, found
with the audit's own parser (audit_site.PageParser), so the two agree on
what a link is. One request per distinct URL, fragment removed; the
report lists every page and line that carries it.

How a URL is judged. A HEAD request first, redirects followed; when the
server refuses HEAD or answers it with an error, a GET, because plenty of
servers answer the two differently. Then:

  gone         404 or 410, or a host that no longer resolves. These are
               the broken links; they open the issue.
  no answer    401, 403, 429, a 5xx, a timeout or a TLS failure. Often a
               server turning away scripts rather than a dead page, so
               they are listed for a look but do not open the issue.
  fine         anything else that ends in a 2xx or 3xx.

doi.org is judged by its own answer, without following the redirect: a
DOI that resolves is a working citation even when the publisher's page
refuses scripts. SKIP_HOSTS are not requested at all (Google Scholar,
Goodreads and LinkedIn answer every script with a block page or a
challenge, whatever the link), and are counted in the report.

Politeness. Requests to one host go one at a time, at least
MIN_INTERVAL seconds apart; different hosts run in parallel, WORKERS at a
time. The User-Agent names the site.

Where the report goes. Always to stdout. In Actions, also to the job
summary ($GITHUB_STEP_SUMMARY), and to one issue titled ISSUE_TITLE, found
again each week by the marker in its body: opened when a link is gone,
updated while any is, and closed with a note when none is. That needs
GITHUB_TOKEN with issues: write; without it, the issue step is skipped.
"""
from __future__ import annotations

import json
import os
import socket
import ssl
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urldefrag, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402
from audit_site import SITE, PageParser  # noqa: E402

ROOT = sitelib.ROOT
USER_AGENT = ("Mozilla/5.0 (compatible; kenreid.co.uk link report; "
              "+https://www.kenreid.co.uk/colophon.html)")
TIMEOUT = 20            # seconds per request
MIN_INTERVAL = 1.0      # seconds between two requests to one host
WORKERS = 8             # hosts checked at once

# Hosts that answer any script with a block page or a challenge, so a
# request says nothing about the link. Matched with their subdomains.
SKIP_HOSTS = ("scholar.google.com", "goodreads.com", "linkedin.com")
# Hosts judged by their own redirect: a resolving DOI is a working link.
NO_FOLLOW_HOSTS = ("doi.org",)

GONE = "gone"
NO_ANSWER = "no answer"
FINE = "fine"

ISSUE_TITLE = "External link report"
ISSUE_MARKER = "<!-- kr-external-link-report -->"


def host_of(url: str) -> str:
    return (urlparse(url).hostname or "").lower()


def host_matches(host: str, domains) -> bool:
    return any(host == d or host.endswith("." + d) for d in domains)


# --- collecting --------------------------------------------------------------

def collect(pages=None) -> dict[str, list[str]]:
    """{url: ['page.html:line', ...]} for every external link on the
    tracked pages (or on `pages`, a list of (rel, html) for tests)."""
    if pages is None:
        pages = [(p.relative_to(ROOT).as_posix(),
                  p.read_text(encoding="utf-8", errors="replace"))
                 for p in sitelib.tracked("*.html")]
    found: dict[str, list[str]] = {}
    for rel, text in pages:
        if not sitelib.is_page(rel):
            continue
        parser = PageParser()
        parser.feed(text)
        for href, line in parser.links:
            href = href.strip()
            if not href.startswith(("http://", "https://")) or href.startswith(SITE):
                continue
            url = urldefrag(href)[0]
            found.setdefault(url, []).append(f"{rel}:{line}")
    return found


# --- requesting ----------------------------------------------------------------

class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def request(method: str, url: str, follow: bool = True) -> int:
    """HTTP status for one request. Raises OSError (URLError, timeouts,
    TLS) when there is no HTTP answer at all."""
    handlers = [] if follow else [_NoRedirect()]
    opener = urllib.request.build_opener(*handlers)
    req = urllib.request.Request(url, method=method, headers={
        "User-Agent": USER_AGENT, "Accept": "text/html,*/*;q=0.8"})
    try:
        with opener.open(req, timeout=TIMEOUT) as res:
            if method == "GET":
                res.read(1024)
            return res.status
    except urllib.error.HTTPError as e:
        return e.code


class Throttle:
    """At least `interval` seconds between two requests to one host.
    Only one worker ever handles a given host, so no lock is needed per
    host; the clock and sleep are parameters so a test can run instantly."""

    def __init__(self, interval=MIN_INTERVAL, clock=time.monotonic, sleep=time.sleep):
        self.interval, self.clock, self.sleep = interval, clock, sleep
        self.last: dict[str, float] = {}
        self.lock = threading.Lock()

    def wait(self, host: str) -> None:
        with self.lock:
            last = self.last.get(host)
        if last is not None:
            gap = self.clock() - last
            if gap < self.interval:
                self.sleep(self.interval - gap)
        with self.lock:
            self.last[host] = self.clock()


@dataclass
class Result:
    url: str
    verdict: str
    detail: str                      # "404", "HEAD 405, GET 200", "timed out"
    where: list = field(default_factory=list)


def judge(status: int | None, error: str = "") -> str:
    if status is None:
        return GONE if error == "no such host" else NO_ANSWER
    if status in (404, 410):
        return GONE
    if status < 400:
        return FINE
    return NO_ANSWER


def describe(exc: BaseException) -> str:
    reason = getattr(exc, "reason", exc)
    if isinstance(reason, socket.gaierror):
        return "no such host"
    if isinstance(reason, (socket.timeout, TimeoutError)) or "timed out" in str(reason):
        return "timed out"
    if isinstance(reason, ssl.SSLError):
        return "TLS error"
    return str(reason)[:80] or type(exc).__name__


def check_url(url: str, throttle: Throttle, send=request) -> Result:
    """HEAD, then GET when HEAD did not come back fine."""
    host = host_of(url)
    follow = not host_matches(host, NO_FOLLOW_HOSTS)
    tried = []
    status, error = None, ""
    for method in ("HEAD", "GET"):
        throttle.wait(host)
        try:
            status, error = send(method, url, follow), ""
            tried.append(f"{method} {status}")
        except (OSError, ValueError) as e:        # URLError is an OSError
            status, error = None, describe(e)
            tried.append(f"{method} {error}")
        if judge(status, error) == FINE:
            break
    return Result(url, judge(status, error), ", ".join(tried))


def check_all(urls: dict[str, list[str]], send=request, throttle=None,
              workers=WORKERS) -> tuple[list[Result], list[str]]:
    """Every URL checked, hosts in parallel and each host's URLs in turn.
    Returns (results, skipped urls)."""
    throttle = throttle or Throttle()
    skipped = sorted(u for u in urls if host_matches(host_of(u), SKIP_HOSTS))
    by_host: dict[str, list[str]] = {}
    for url in sorted(urls):
        if url not in skipped:
            by_host.setdefault(host_of(url), []).append(url)

    def run_host(host_urls):
        out = []
        for url in host_urls:
            r = check_url(url, throttle, send)
            r.where = urls[url]
            out.append(r)
        return out

    results = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for batch in pool.map(run_host, by_host.values()):
            results.extend(batch)
    results.sort(key=lambda r: r.url)
    return results, skipped


# --- reporting -----------------------------------------------------------------

def _table(rows: list[Result]) -> list[str]:
    lines = ["| Link | Answer | Linked from |", "| --- | --- | --- |"]
    for r in rows:
        where = ", ".join(r.where[:3]) + (f" and {len(r.where) - 3} more" if len(r.where) > 3 else "")
        cells = (r.url, r.detail, where)
        lines.append("| " + " | ".join(c.replace("|", "\\|") for c in cells) + " |")
    return lines


def markdown(results: list[Result], skipped: list[str]) -> str:
    gone = [r for r in results if r.verdict == GONE]
    quiet = [r for r in results if r.verdict == NO_ANSWER]
    fine = len(results) - len(gone) - len(quiet)
    hosts = sorted({host_of(u) for u in skipped})
    out = [f"## {ISSUE_TITLE}", "",
           f"{len(results)} external links checked: {fine} fine, {len(gone)} gone, "
           f"{len(quiet)} with no clear answer. {len(skipped)} not checked "
           f"({', '.join(hosts) or 'none'}: those hosts turn away scripts).", ""]
    if gone:
        out += ["### Gone", "", "Fix or remove these: the page is not there any more.", ""]
        out += _table(gone) + [""]
    if quiet:
        out += ["### No clear answer", "",
                "Often a server refusing scripts rather than a dead page; worth a look "
                "in a browser.", ""]
        out += _table(quiet) + [""]
    if not gone and not quiet:
        out += ["Every checked link answered.", ""]
    return "\n".join(out)


# --- the issue -------------------------------------------------------------------

def github(method: str, path: str, token: str, body=None):
    api = os.environ.get("GITHUB_API_URL", "https://api.github.com")
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(api + path, data=data, method=method, headers={
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": USER_AGENT,
    })
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read() or b"null")


def find_issue(repo: str, token: str, api=github):
    """The open report issue, found by the marker in its body."""
    for page in range(1, 6):
        issues = api("GET", f"/repos/{repo}/issues?state=open&per_page=100&page={page}", token)
        for issue in issues or []:
            if ISSUE_MARKER in (issue.get("body") or "") and "pull_request" not in issue:
                return issue
        if not issues or len(issues) < 100:
            return None
    return None


def update_issue(report: str, any_gone: bool, repo: str, token: str, api=github) -> str:
    """Open, update or close the one report issue. Returns what it did."""
    run = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    run_id = os.environ.get("GITHUB_RUN_ID")
    footer = f"\n\n[This week's run]({run}/{repo}/actions/runs/{run_id})" if run_id else ""
    body = f"{ISSUE_MARKER}\n{report}{footer}"
    issue = find_issue(repo, token, api)
    if any_gone and issue is None:
        made = api("POST", f"/repos/{repo}/issues", token, {"title": ISSUE_TITLE, "body": body})
        return f"opened issue #{made['number']}"
    if issue is None:
        return "no issue needed"
    number = issue["number"]
    if any_gone:
        api("PATCH", f"/repos/{repo}/issues/{number}", token, {"body": body})
        return f"updated issue #{number}"
    api("PATCH", f"/repos/{repo}/issues/{number}", token, {"body": body, "state": "closed"})
    return f"closed issue #{number}: no link is gone this week"


# --- entry point -----------------------------------------------------------------

def main(argv=None) -> int:
    ap = sitelib.arg_parser(__doc__)
    ap.add_argument("--list", action="store_true",
                    help="print the URLs that would be checked, with where they are, and stop")
    ap.add_argument("--limit", type=int, metavar="N",
                    help="check only the first N URLs (for a quick local look)")
    ap.add_argument("--no-issue", action="store_true",
                    help="never touch the GitHub issue, even with a token")
    args = ap.parse_args(argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="backslashreplace")

    urls = collect()
    if args.limit:
        urls = dict(sorted(urls.items())[:args.limit])
    if args.list:
        for url, where in sorted(urls.items()):
            flag = "  (skipped)" if host_matches(host_of(url), SKIP_HOSTS) else ""
            print(f"{url}{flag}\n    {', '.join(where)}")
        print(f"\n{len(urls)} external URLs")
        return 0

    # Report only: whatever goes wrong below is printed as a warning and
    # the job still succeeds, so a flaky week never paints the repo red.
    try:
        results, skipped = check_all(urls)
        report = markdown(results, skipped)
        print(report)
        summary = os.environ.get("GITHUB_STEP_SUMMARY")
        if summary:
            with open(summary, "a", encoding="utf-8") as f:
                f.write(report + "\n")
        token, repo = os.environ.get("GITHUB_TOKEN"), os.environ.get("GITHUB_REPOSITORY")
        if token and repo and not args.no_issue:
            any_gone = any(r.verdict == GONE for r in results)
            print(update_issue(report, any_gone, repo, token))
    except Exception as e:  # noqa: BLE001 (report only, by design)
        print(f"::warning::external link report did not finish: {type(e).__name__}: {e}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
