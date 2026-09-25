"""
Precompute reading times and word counts into data/posts.json.

Counts the words inside each post's <div class="blog-post"> and writes
readMinutes (sitelib.read_minutes: 220 wpm, rounded up) and words fields
onto every entry. The browser only displays readMinutes, never
recomputes it; the homepage stats bar sums the words fields.
Run after adding or substantially editing a post:

    python .github/scripts/generate_read_times.py
    python .github/scripts/generate_read_times.py --check   # exit 1 if any are stale
"""
import json
import sys
import re
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402
from sitelib import WORDS_PER_MINUTE, read_minutes  # noqa: E402,F401  (re-exported)

ROOT = sitelib.ROOT
POSTS_JSON = sitelib.POSTS_JSON


class BlogPostTextExtractor(HTMLParser):
    """Collects text inside the first element with class 'blog-post'.

    Only <div> nesting is tracked, so stray or unclosed inline tags
    (a common hand-authoring slip) can't end the region early.
    """

    # Blocks nested inside .blog-post that are navigation furniture rather
    # than the article. Counting the related-posts cards also made this
    # generator circular with generate_related_posts.py: the cards embed
    # readMinutes from posts.json, so each run invalidated the other.
    SKIP_CLASSES = ("related-posts",)

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.div_depth = 0      # <div> nesting inside .blog-post (0 = outside)
        self.in_skip = None     # script/style tag we're currently inside
        self.skip_depth = 0     # <div> nesting inside a skipped block
        self.chunks = []

    def handle_starttag(self, tag, attrs):
        if self.div_depth:
            if tag == "div":
                self.div_depth += 1
                classes = dict(attrs).get("class", "").split()
                if self.skip_depth:
                    self.skip_depth += 1
                elif any(c in classes for c in self.SKIP_CLASSES):
                    self.skip_depth = 1
            elif tag in ("script", "style"):
                self.in_skip = tag
        elif tag == "div" and "blog-post" in dict(attrs).get("class", "").split():
            self.div_depth = 1

    def handle_endtag(self, tag):
        if not self.div_depth:
            return
        if tag == "div":
            self.div_depth -= 1
            if self.skip_depth:
                self.skip_depth -= 1
        elif tag == self.in_skip:
            self.in_skip = None

    def handle_data(self, data):
        if self.div_depth and not self.in_skip and not self.skip_depth:
            self.chunks.append(data)


def count_words(html_path: Path) -> int:
    """Words a reader reads in the post's .blog-post div.

    A parser rather than sitelib.post_body: post_body returns the body's
    markup, and counting words needs its text without scripts, styles or
    the related-posts cards. Both find the same div (by class token, in
    any attribute order), so the feed and the read time agree on what
    the article is.
    """
    parser = BlogPostTextExtractor()
    parser.feed(html_path.read_text(encoding="utf-8"))
    return len(re.findall(r"\S+", " ".join(parser.chunks)))


def main(argv=None):
    parser = sitelib.arg_parser(__doc__)
    parser.add_argument("--check", action="store_true",
                        help="exit 1 if posts.json disagrees with the posts; write nothing")
    check_only = parser.parse_args(argv).check
    posts = sitelib.load_posts()
    total = 0
    drift = []
    # A post with no file or no body fails the run, in both modes, and
    # nothing is written. It used to be printed and passed over, while the
    # feed and the related-posts generator failed on the same post, so the
    # first red line in a check run named a symptom downstream instead of
    # this, the cause.
    broken = []
    for post in posts:
        html_path = ROOT / post["url"]
        if not html_path.exists():
            broken.append(f"{post['url']}: listed in posts.json but the file is missing")
            continue
        if sitelib.post_body(html_path.read_text(encoding="utf-8")) is None:
            broken.append(f"{post['url']}: no .blog-post body, or one that never closes")
            continue
        words = count_words(html_path)
        if not words:
            broken.append(f"{post['url']}: the .blog-post body has no words")
            continue
        minutes = read_minutes(words)
        if post.get("words") != words or post.get("readMinutes") != minutes:
            drift.append(
                f"{post['url']}: words {post.get('words')} -> {words}, "
                f"readMinutes {post.get('readMinutes')} -> {minutes}"
            )
        post["readMinutes"] = minutes
        post["words"] = words
        total += words
        if not check_only:
            print(f"{minutes:3d} min  {words:6d} words  {post['url']}")

    if broken:
        print(f"error: {len(broken)} post(s) have no body to count:")
        for b in broken:
            print(f"  {b}")
        return 1

    if check_only:
        if drift:
            print(f"data/posts.json is stale in {len(drift)} post(s):")
            for d in drift:
                print(f"  {d}")
            print("run: python .github/scripts/generate_read_times.py")
            return 1
        print("data/posts.json read times are up to date.")
        return 0

    POSTS_JSON.write_text(
        json.dumps(posts, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(f"\nWrote {POSTS_JSON.relative_to(ROOT).as_posix()}: "
          f"{total:,} words across {len(posts)} posts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
