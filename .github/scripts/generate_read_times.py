"""
Precompute reading times and word counts into data/posts.json.

Counts the words inside each post's <div class="blog-post"> and writes
readMinutes (220 wpm, matching the JS estimate) and words fields onto
every entry. The homepage stats bar sums the words fields.
Run after adding or substantially editing a post:

    python .github/scripts/generate_read_times.py
"""
import json
import sys
import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
POSTS_JSON = ROOT / "data" / "posts.json"
WORDS_PER_MINUTE = 220


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
    parser = BlogPostTextExtractor()
    parser.feed(html_path.read_text(encoding="utf-8"))
    return len(re.findall(r"\S+", " ".join(parser.chunks)))


def main(argv=None):
    check_only = "--check" in (argv if argv is not None else sys.argv[1:])
    posts = json.loads(POSTS_JSON.read_text(encoding="utf-8"))
    total = 0
    drift = []
    for post in posts:
        html_path = ROOT / post["url"]
        if not html_path.exists():
            print(f"MISSING {post['url']}")
            continue
        words = count_words(html_path)
        if not words:
            print(f"NO .blog-post CONTENT in {post['url']}")
            continue
        minutes = max(1, -(-words // WORDS_PER_MINUTE))  # ceil division
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
    print(f"\nWrote {POSTS_JSON} — {total:,} words across {len(posts)} posts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
