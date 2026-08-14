#!/usr/bin/env python3
"""Shared plumbing for the browser-driven checks.

smoke_test.py and viz_verify.py both need the same three things: a local
server rooted at the repo, a browser pointed at it, and a way to tell our own
breakage apart from a third party having a bad day. They each grew their own
copy, and the copies drifted: the noise filters were sixteen entries and six,
so viz_verify failed on a Last.fm hiccup that smoke_test correctly ignored.

Anything a second checker would need belongs here. Anything specific to one
checker does not.

Not a test framework. It has no opinion about what a check is, only about
serving files, launching a browser, and counting results.
"""

import threading
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Third parties failing is not this site breaking. One list, so a checker
# cannot quietly disagree with its sibling about what counts as noise.
NOISE = (
    "googletagmanager", "google-analytics", "fonts.g", "gstatic",
    "instagram", "bsky", "giscus", "cartocdn", "openlibrary",
    "lastfm", "audioscrobbler", "wikimedia", "youtube", "tiktok",
    "goodreads", "gr-assets", "github.com", "githubassets",
)


def is_noise(text):
    """True when a console line or URL comes from somewhere we do not control."""
    return any(n in (text or "") for n in NOISE)


class _QuietHandler(SimpleHTTPRequestHandler):
    """Serves without narrating. Silencing has to happen on the class: the
    callers used to assign log_message onto a functools.partial, which accepts
    the attribute and ignores it, so every request was still being logged.
    """

    def log_message(self, *args, **kwargs):
        pass


@contextmanager
def serve(port, root=ROOT):
    """A quiet static server on 127.0.0.1, shut down on the way out.

    Each caller picks its own port so two checkers can run side by side.
    """
    handler = partial(_QuietHandler, directory=str(root))
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        server.shutdown()
        server.server_close()


# A failed subresource logs a console line that names no URL, so the text
# cannot say whose it was: a third-party 404 and one of ours look identical
# here. Those lines are dropped and the same failure is caught on the response
# instead, where the URL is available to filter on. Dropping this prefix is not
# optional; without it every draft reports its own missing giscus thread.
RESOURCE_LINE = "Failed to load resource"


def watch_console(page, sink):
    """Collect real console errors, dropping third-party noise as it arrives."""
    page.on("console", lambda m: sink.append(m.text)
            if m.type == "error"
            and not m.text.startswith(RESOURCE_LINE)
            and not is_noise(m.text) else None)
    page.on("response", lambda r: sink.append(f"HTTP {r.status}: {r.url}")
            if r.status >= 400 and not is_noise(r.url) else None)


class Reporter:
    """Prints as it goes and remembers what failed.

    Checkers were each formatting their own "ok  "/"FAIL" lines and appending
    to their own list; this keeps the output identical while making a check a
    one-liner. `skip` exists because "this post is not on the engine" must not
    read as either a pass or a failure.
    """

    def __init__(self):
        self.failures = []

    def check(self, scope, name, ok, detail=""):
        suffix = "" if ok or detail == "" else f" -- {detail}"
        print(f"{'ok  ' if ok else 'FAIL'} {scope} :: {name}{suffix}")
        if not ok:
            self.failures.append(f"{scope}: {name}"
                                 + (f" ({detail})" if detail != "" else ""))
        return ok

    def skip(self, scope, name, why):
        print(f"skip {scope} :: {name} ({why})")

    def note(self, text):
        print(text)

    def console_errors(self, scope, sink, limit=3):
        """Report anything left in a console sink after noise filtering."""
        own = [e for e in sink if not is_noise(e)]
        for e in own[:limit]:
            print(f"FAIL {scope} :: console error: {e[:140]}")
        if own:
            self.failures.append(f"{scope}: console errors")
        return not own

    def summary(self, label):
        if self.failures:
            print(f"\n{len(self.failures)} {label} failure(s)")
            return 1
        print(f"\n{label}: all green")
        return 0
