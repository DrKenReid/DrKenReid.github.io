"""
Precompute content facets into data/posts.json.

The blog filter bar lets readers narrow by more than tag: whether a post
carries a live demo, and whether it shows code. Both are properties of the
post's HTML rather than of its metadata, so they are detected here and
written onto the entry instead of being maintained by hand.

    interactive  the post embeds a .kr-viz widget (the demo engine)
    code         the post has at least one <pre><code> block

Flags are written only when true, so an ordinary post's entry is unchanged.
Run after adding or substantially editing a post:

    python .github/scripts/generate_post_facets.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
POSTS_JSON = ROOT / "data" / "posts.json"

# The demo engine's root element. Deliberately narrower than "<canvas",
# which also matches the static Chart.js figures in the infographic post.
VIZ_RE = re.compile(r'class="[^"]*\bkr-viz\b')
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
    check_only = "--check" in (argv if argv is not None else sys.argv[1:])
    posts = json.loads(POSTS_JSON.read_text(encoding="utf-8"))
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
    print(f"\nWrote {POSTS_JSON} — {summary} across {len(posts)} posts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
