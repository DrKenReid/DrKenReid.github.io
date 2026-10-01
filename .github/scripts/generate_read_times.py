"""
Precompute reading times and word counts into data/posts.json.

Counts the words inside each post's <div class="blog-post"> and writes
readMinutes (sitelib.read_minutes: 220 wpm, rounded up) and words fields
onto every entry. The browser only displays readMinutes, never
recomputes it; the homepage stats bar sums the words fields.

The two counts differ on purpose. `words` is everything in the article
(the JSON-LD wordCount, the homepage total). readMinutes leaves out the
code inside a folded listing, <details class="code-example"> without
`open`: a reader skims past it closed, and a 600-line listing counted as
prose made a seven-minute post read "27 min" and filed it as a deep dive
on the Length filter. A listing that opens by default, and a <pre> in the
flow of the text, still count.

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
        self.folded = 0         # <details> nesting from a closed code listing
        self.pre_depth = 0      # <pre> nesting inside that listing
        self.chunks = []
        self.folded_chunks = []  # the code in closed listings, counted apart

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
            elif tag == "details":
                a = dict(attrs)
                if self.folded:
                    self.folded += 1
                elif "code-example" in (a.get("class") or "").split() and "open" not in a:
                    self.folded = 1
            elif tag == "pre" and self.folded:
                self.pre_depth += 1
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
        elif tag == "details" and self.folded:
            self.folded -= 1
            if not self.folded:
                self.pre_depth = 0
        elif tag == "pre" and self.pre_depth:
            self.pre_depth -= 1

    def handle_data(self, data):
        if self.div_depth and not self.in_skip and not self.skip_depth:
            # Only the <pre> is set apart: the listing's summary line ("The
            # JavaScript (js/palette.js)") is read on the way past.
            (self.folded_chunks if self.pre_depth else self.chunks).append(data)


def _words(chunks) -> int:
    return len(re.findall(r"\S+", " ".join(chunks)))


def word_counts(text: str) -> tuple[int, int]:
    """(words, reading words) in a page's .blog-post div.

    `words` is the whole article; reading words leave out the code in
    folded listings (see the module docstring), and are what readMinutes
    is worked out from.

    A parser rather than sitelib.post_body: post_body returns the body's
    markup, and counting words needs its text without scripts, styles or
    the related-posts cards. Both find the same div (by class token, in
    any attribute order), so the feed and the read time agree on what
    the article is.
    """
    parser = BlogPostTextExtractor()
    parser.feed(text)
    reading = _words(parser.chunks)
    return reading + _words(parser.folded_chunks), reading


def count_words(html_path: Path) -> int:
    """Every word in the post's .blog-post div (posts.json `words`)."""
    return word_counts(html_path.read_text(encoding="utf-8"))[0]


def reading_minutes(html_path: Path) -> int:
    """The read time the post's pages print, from its reading words.
    0 when the body has no words at all."""
    words, reading = word_counts(html_path.read_text(encoding="utf-8"))
    return read_minutes(reading) if words else 0


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
        words, reading = word_counts(html_path.read_text(encoding="utf-8"))
        if not words:
            broken.append(f"{post['url']}: the .blog-post body has no words")
            continue
        minutes = read_minutes(reading)
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
