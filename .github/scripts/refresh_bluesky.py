#!/usr/bin/env python3
"""Refresh data/bluesky.json: the Bluesky post each blog post was shared in.

A post's comments have two doors: giscus, which needs a GitHub account,
and replies to the Bluesky post that shared it, which js/bluesky-replies.js
shows under the post. The browser has to know which Bluesky post that is,
and it is not left to guess: this script walks my public author feed,
finds my own top-level posts that link to a post on this site, and writes

    {"posts": [{"slug", "uri", "url", "posted"}, ...]}    newest share first

    slug    the post's file name without .html (blog/<slug>.html)
    uri     the Bluesky post's at:// URI, which getPostThread takes
    url     its page on bsky.app, where a reader replies
    posted  when it was posted, UTC, to the second

Where a post was shared more than once, the most recent share is kept.

    python .github/scripts/refresh_bluesky.py             # fetch, merge, write
    python .github/scripts/refresh_bluesky.py --dry-run   # fetch and merge, write nothing

It runs weekly from the live-data workflow. Everything is read from
Bluesky's public AppView (public.api.bsky.app): no key, no login, and a
User-Agent that says only what kind of client is asking.

Stages, so the rules can be tested without a network:

    fetch_feed()              the network: the author feed, page by page
    shares(items, known)      pure: slug -> the newest share among those items
    gone(uris)                the network: which of these posts Bluesky no longer has
    merge(old, found, gone)   pure: the new list

What counts as sharing a post (shares): a link card (the record's
embed.external.uri, or the media half of a quote post that carries a
card) or a link facet in the text, to www.kenreid.co.uk or the bare
domain, with the path /blog/<slug>.html. Reposts (someone else's post),
replies (my own included) and anything not posted by ACTOR are left out,
and so is a link to a slug data/posts.json does not list.

Merge rules (merge):

  1. The file is the record. The walk goes back MAX_PAGES pages at most
     and can fail part-way, so an entry it did not see is kept as it is.
  2. A share found for a slug replaces the entry on file when it is at
     least as recent.
  3. An entry is dropped only when Bluesky says its post is gone. The
     entries the walk did not see are asked for by URI (getPosts); one
     the API answers without has been deleted, and a share of the same
     slug found in the walk takes its place. A check that fails keeps
     the entry: no answer is not a "no".

Exit status: 0 when every request was answered, 1 when one was not. A
first page that fails writes nothing. A later one still merges the pages
that did arrive (the newest posts are on the first) and exits 1 so the
workflow reports it. The file is rewritten only when its contents change,
so a week with no new share is no commit.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402

ROOT = sitelib.ROOT
OUT = ROOT / "data" / "bluesky.json"

# The account's DID, which survives a change of handle (KR_BSKY_ACTOR in
# js/shared-components.js is the same value).
ACTOR = "did:plc:ks2rxbqomt6vsae6tepl6pcm"
API = "https://public.api.bsky.app/xrpc/"
UA = "site-data-refresh/1.0"

PER_PAGE = 100          # the API's maximum
MAX_PAGES = 30          # 3,000 posts back; older shares stay on file (rule 1)
POSTS_PER_CHECK = 25    # getPosts takes at most this many URIs

# A link to a post: either host, http or https, /blog/<slug>.html (GitHub
# Pages also serves the path without the extension).
HOSTS = ("www.kenreid.co.uk", "kenreid.co.uk")
POST_PATH = re.compile(r"^/blog/([a-z0-9][a-z0-9-]*)(?:\.html)?$")

POST_URI = re.compile(r"^at://(did:[a-z]+:[A-Za-z0-9._:%-]+)/app\.bsky\.feed\.post/([A-Za-z0-9._~:-]+)$")
HANDLE = re.compile(r"^[A-Za-z0-9.-]+$")


# --- the network -----------------------------------------------------------

def get(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def xrpc(method: str, params: list[tuple[str, str]], fetch=get) -> dict:
    """One call to the public AppView, as parsed JSON (always an object)."""
    data = json.loads(fetch(API + method + "?" + urllib.parse.urlencode(params)))
    if not isinstance(data, dict):
        raise ValueError("%s answered with %s, not an object" % (method, type(data).__name__))
    return data


def fetch_feed(fetch=get) -> tuple[list[dict], str]:
    """The author feed, newest first, and what went wrong ('' if nothing).

    Pages are followed by cursor until the feed ends or MAX_PAGES is
    reached (not a problem: older entries stay on file). A page that
    cannot be fetched or read ends the walk with the pages before it, so
    the caller decides what a partial walk is worth.
    """
    items: list[dict] = []
    cursor = ""
    for page in range(1, MAX_PAGES + 1):
        params = [("actor", ACTOR), ("limit", str(PER_PAGE)), ("filter", "posts_no_replies")]
        if cursor:
            params.append(("cursor", cursor))
        try:
            data = xrpc("app.bsky.feed.getAuthorFeed", params, fetch)
            feed = data["feed"]
            if not isinstance(feed, list):
                raise ValueError("feed is not a list")
        except Exception as e:  # network, HTTP status, JSON or shape: all end the walk
            return items, "page %d: %s" % (page, e)
        items.extend(i for i in feed if isinstance(i, dict))
        cursor = data.get("cursor") or ""
        if not cursor or not feed:
            break
    return items, ""


def gone(uris: list[str], fetch=get) -> tuple[set[str], str]:
    """Which of `uris` Bluesky no longer has, and what went wrong ('').

    getPosts returns the posts that exist and leaves the rest out. A
    batch that cannot be fetched or read reports nothing as gone.
    """
    missing: set[str] = set()
    problem = ""
    for start in range(0, len(uris), POSTS_PER_CHECK):
        batch = uris[start:start + POSTS_PER_CHECK]
        try:
            posts = xrpc("app.bsky.feed.getPosts", [("uris", u) for u in batch], fetch)["posts"]
            if not isinstance(posts, list):
                raise ValueError("posts is not a list")
        except Exception as e:
            problem = "checking %d post(s): %s" % (len(batch), e)
            continue
        alive = {p.get("uri") for p in posts if isinstance(p, dict)}
        missing.update(u for u in batch if u not in alive)
    return missing, problem


# --- the rules (pure) --------------------------------------------------------

def slug_of(url: str) -> str:
    """The post slug a link points at, or '' when it is not a link to a post."""
    try:
        parts = urllib.parse.urlsplit((url or "").strip())
    except ValueError:
        return ""
    if parts.scheme not in ("http", "https") or (parts.hostname or "").lower() not in HOSTS:
        return ""
    m = POST_PATH.match(parts.path)
    return m.group(1) if m else ""


def links(record: dict) -> list[str]:
    """Every address a post record links to: its card, then its link facets."""
    out = []
    embed = record.get("embed")
    if isinstance(embed, dict):
        media = embed.get("media")
        for holder in (embed, media if isinstance(media, dict) else {}):
            external = holder.get("external")
            if isinstance(external, dict) and isinstance(external.get("uri"), str):
                out.append(external["uri"])
    facets = record.get("facets")
    for facet in facets if isinstance(facets, list) else []:
        features = facet.get("features") if isinstance(facet, dict) else None
        for feature in features if isinstance(features, list) else []:
            if (isinstance(feature, dict) and feature.get("$type") == "app.bsky.richtext.facet#link"
                    and isinstance(feature.get("uri"), str)):
                out.append(feature["uri"])
    return out


def posted_at(*stamps) -> str:
    """The first of `stamps` that is a time, as 'YYYY-MM-DDTHH:MM:SSZ'; else ''."""
    for s in stamps:
        if not isinstance(s, str):
            continue
        try:
            t = datetime.fromisoformat(s.strip().replace("Z", "+00:00"))
        except ValueError:
            continue
        if t.tzinfo is None:
            t = t.replace(tzinfo=timezone.utc)
        return t.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return ""


def own_posts(items: list[dict]):
    """(uri, rkey, post) for each of my own top-level posts among feed items."""
    for item in items:
        if not isinstance(item, dict) or item.get("reason"):
            continue  # a repost carries someone else's post
        post = item.get("post")
        if not isinstance(post, dict):
            continue
        record, author = post.get("record"), post.get("author")
        if not isinstance(record, dict) or not isinstance(author, dict):
            continue
        m = POST_URI.match(post.get("uri") or "")
        if not m or m.group(1) != ACTOR or author.get("did") != ACTOR or record.get("reply"):
            continue
        yield post["uri"], m.group(2), post


def shares(items: list[dict], known: set[str] | None = None) -> dict[str, dict]:
    """slug -> the newest of my posts in `items` that links to that post.

    `known` is the slugs that exist (data/posts.json); None accepts any.
    """
    found: dict[str, dict] = {}
    for uri, rkey, post in own_posts(items):
        record = post["record"]
        posted = posted_at(record.get("createdAt"), post.get("indexedAt"))
        if not posted:
            continue
        handle = post["author"].get("handle")
        if not isinstance(handle, str) or not HANDLE.match(handle) or handle == "handle.invalid":
            handle = ACTOR  # bsky.app takes the DID in a handle's place
        entry = {"slug": "", "uri": uri,
                 "url": "https://bsky.app/profile/%s/post/%s" % (handle, rkey),
                 "posted": posted}
        for slug in {slug_of(u) for u in links(record)} - {""}:
            if known is not None and slug not in known:
                continue
            if slug not in found or posted > found[slug]["posted"]:
                found[slug] = dict(entry, slug=slug)
    return found


def merge(old: list[dict], found: dict[str, dict], deleted: set[str] = frozenset()) -> list[dict]:
    """The new list from the one on file, this walk's shares and the URIs
    Bluesky says are gone. Pure; the module docstring has the rules."""
    posts = {e["slug"]: e for e in old if e["uri"] not in deleted}
    for slug, entry in found.items():
        if slug not in posts or entry["posted"] >= posts[slug]["posted"]:
            posts[slug] = entry
    return sorted(posts.values(), key=lambda e: (e["posted"], e["slug"]), reverse=True)


# --- files -------------------------------------------------------------------

def load(path: Path) -> list[dict]:
    """The entries on file; [] when there is no file yet or it cannot be read."""
    try:
        posts = json.loads(path.read_text(encoding="utf-8"))["posts"]
    except (OSError, ValueError, KeyError, TypeError):
        return []
    return [e for e in posts if isinstance(e, dict)
            and all(isinstance(e.get(k), str) and e[k] for k in ("slug", "uri", "url", "posted"))]


def dump(posts: list[dict]) -> str:
    """One entry to a line, so a week's change reads as the lines it added."""
    lines = ",\n".join(json.dumps(p, ensure_ascii=False) for p in posts)
    return '{"posts": [\n' + lines + "\n]}\n"


def known_slugs() -> set[str] | None:
    """The slugs in data/posts.json, or None when it cannot be read."""
    try:
        return {Path(p["url"]).stem for p in sitelib.load_posts()}
    except (OSError, ValueError, KeyError, TypeError):
        return None


# --- entry point -----------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    ap = sitelib.arg_parser(__doc__)
    ap.add_argument("--dry-run", action="store_true",
                    help="fetch and merge, report what would change, write nothing")
    args = ap.parse_args(argv)

    old = load(OUT)
    items, problem = fetch_feed()
    if problem and not items:
        print("::error::Bluesky author feed: %s; leaving %s alone" % (problem, OUT.name))
        return 1
    if problem:
        print("::warning::Bluesky author feed stopped early (%s); merging the %d items before it"
              % (problem, len(items)))

    found = shares(items, known_slugs())
    seen = {uri for uri, _, _ in own_posts(items)}
    deleted, check_problem = gone([e["uri"] for e in old if e["uri"] not in seen])
    if check_problem:
        print("::warning::could not confirm some older posts still exist (%s); keeping them"
              % check_problem)

    posts = merge(old, found, deleted)
    before = {e["slug"]: e["uri"] for e in old}
    after = {e["slug"]: e["uri"] for e in posts}
    for slug in sorted(set(before) - set(after)):
        print("::warning::the Bluesky post for %s is gone and the feed has no other; dropped" % slug)
    added = len(set(after) - set(before))
    moved = sum(1 for s in after if s in before and after[s] != before[s])
    print("%s%d posts shared on Bluesky (%d new, %d moved to another share) from %d feed items"
          % ("dry run: " if args.dry_run else "", len(posts), added, moved, len(items)))

    text = dump(posts)
    if not args.dry_run and (not OUT.exists() or OUT.read_text(encoding="utf-8") != text):
        OUT.write_text(text, encoding="utf-8", newline="\n")
    if problem or check_problem:
        print("::error::partial refresh: %s" % "; ".join(p for p in (problem, check_problem) if p))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
