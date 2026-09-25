"""
Precompute content facets into data/posts.json.

The blog filter bar lets readers narrow by more than tag: whether a post
carries a live demo, and whether it shows code. Both are properties of the
post's HTML rather than of its metadata, so they are detected here and
written onto the entry instead of being maintained by hand.

    interactive  the post mounts a demo on the engine (KRViz.mount)
    code         the post has at least one <pre><code> block

Flags are written only when true, so an ordinary post's entry is unchanged.
Run after adding or substantially editing a post:

    python .github/scripts/generate_post_facets.py
    python .github/scripts/generate_post_facets.py --check   # exit 1 if any are stale
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402

ROOT = sitelib.ROOT
POSTS_JSON = sitelib.POSTS_JSON

# A live demo is one the engine runs: the post calls KRViz.mount. Narrower
# than "<canvas", which also matches the static Chart.js figures in the
# infographic post, and narrower than the .kr-viz class, whose frame and
# tokens also host static figures (the flow chart in
# leading-a-horse-to-water.html), which the blog's "posts with a live
# demo" filter and the colophon's count should not include.
VIZ_RE = re.compile(r"\bKRViz\.mount\(")
# Code samples are always <pre><code>; a bare <pre> is used for other
# things (the BibTeX citation box, for one), so <code> is what counts.
CODE_RE = re.compile(r"<pre[^>]*>\s*<code")

FACETS = ("interactive", "code")


def detect(html: str) -> dict:
    return {
        "interactive": bool(VIZ_RE.search(html)),
        "code": bool(CODE_RE.search(html)),
    }


def main(argv=None):
    parser = sitelib.arg_parser(__doc__)
    parser.add_argument("--check", action="store_true",
                        help="exit 1 if a flag in posts.json is stale; write nothing")
    check_only = parser.parse_args(argv).check
    posts = sitelib.load_posts()
    drift = []
    totals = {f: 0 for f in FACETS}

    for post in posts:
        html_path = ROOT / post["url"]
        if not html_path.exists():
            print(f"MISSING {post['url']}")
            continue
        found = detect(html_path.read_text(encoding="utf-8", errors="replace"))
        for facet in FACETS:
            was = bool(post.get(facet))
            now = found[facet]
            if was != now:
                drift.append(f"{post['url']}: {facet} {was} -> {now}")
            if now:
                post[facet] = True
                totals[facet] += 1
            else:
                post.pop(facet, None)
        if not check_only:
            marks = " ".join(f for f in FACETS if found[f]) or "-"
            print(f"{marks:18s} {post['url']}")

    if check_only:
        if drift:
            print(f"data/posts.json facets are stale in {len(drift)} post(s):")
            for d in drift:
                print(f"  {d}")
            print("run: python .github/scripts/generate_post_facets.py")
            return 1
        print("data/posts.json facets are up to date.")
        return 0

    POSTS_JSON.write_text(
        json.dumps(posts, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    summary = ", ".join(f"{totals[f]} {f}" for f in FACETS)
    print(f"\nWrote {POSTS_JSON.relative_to(ROOT).as_posix()}: {summary} across {len(posts)} posts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
