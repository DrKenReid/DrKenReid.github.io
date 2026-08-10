"""Bake "Related posts" sections into published posts.

Ranking is TF-IDF cosine similarity over each post's actual body text
(plus a small shared-tag boost), so recommendations reflect what a post
is about rather than only its tag overlap. No external dependencies.

Run after adding a post to data/posts.json:
    .venv/Scripts/python.exe .github/scripts/generate_related_posts.py

Replaces either the <div id="related-posts-section"></div> placeholder
or a previously baked <div class="related-posts"> block.
"""

import json
import math
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
POSTS_PATH = ROOT / 'data' / 'posts.json'

TAG_BOOST = 0.06          # per shared tag, on top of cosine similarity
STOPWORDS = set("""a about above after again against all also am an and any are as at be because been
before being below between both but by can did do does doing down during each few for from further had
has have having he her here hers herself him himself his how i if in into is it its itself just like me
more most my myself no nor not now of off on once only or other our ours ourselves out over own same she
should so some such than that the their theirs them themselves then there these they this those through
to too under until up very was we were what when where which while who whom why will with you your yours
yourself yourselves ve ll re dont didnt doesnt isnt wasnt arent im ive id youre thats theres its lets
one two three get got make made really thing things way years year day days time times post posts blog
""".split())

TOKEN_RE = re.compile(r"[a-z][a-z']{2,}")
TAG_STRIP_RE = re.compile(r'<(script|style)[^>]*>.*?</\1>|<[^>]+>', re.DOTALL)


def estimate_reading_minutes(post):
    text = f"{post.get('title', '')} {post.get('excerpt', '')}".strip()
    word_count = len(text.split()) if text else 0
    return max(1, (word_count + 219) // 220)


def format_post_date(date_str):
    date_value = datetime.strptime(date_str, '%Y-%m-%d')
    return f'{date_value.day} {date_value.strftime("%B %Y")}'


def extract_body_text(post):
    """Visible prose of a post: the .blog-post region with markup
    stripped, cut before any previously baked related-posts block."""
    path = ROOT / post['url']
    html = path.read_text(encoding='utf-8')
    start = html.find('<div class="blog-post">')
    if start == -1:
        return post.get('title', '') + ' ' + post.get('excerpt', '')
    segment = html[start:]
    cut = segment.find('<div class="related-posts">')
    if cut != -1:
        segment = segment[:cut]
    text = TAG_STRIP_RE.sub(' ', segment)
    # title counts double: it is the strongest topical signal
    return f"{post.get('title', '')} {post.get('title', '')} {text}"


def tokenize(text):
    return [t for t in TOKEN_RE.findall(text.lower()) if t not in STOPWORDS]


def build_vectors(posts):
    docs = {p['url']: Counter(tokenize(extract_body_text(p))) for p in posts}
    df = Counter()
    for counts in docs.values():
        df.update(counts.keys())
    n = len(docs)
    vectors = {}
    for url, counts in docs.items():
        vec = {}
        for term, tf in counts.items():
            if df[term] < 2 and n > 4:
                continue  # appears in one document only: noise
            if df[term] >= n:
                continue  # appears everywhere: no signal
            vec[term] = (1 + math.log(tf)) * math.log(n / df[term])
        norm = math.sqrt(sum(w * w for w in vec.values())) or 1.0
        vectors[url] = {t: w / norm for t, w in vec.items()}
    return vectors


def cosine(a, b):
    if len(b) < len(a):
        a, b = b, a
    return sum(w * b.get(t, 0.0) for t, w in a.items())


def build_related_posts(posts, current_post, vectors):
    current_url = current_post.get('url', '')
    current_tags = set(current_post.get('tags', []))
    ranked = []
    for post in posts:
        url = post.get('url', '')
        if url == current_url:
            continue
        sim = cosine(vectors[current_url], vectors[url])
        shared = len(current_tags.intersection(post.get('tags', [])))
        ranked.append((sim + TAG_BOOST * shared, post.get('date', ''), post))
    ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [post for _score, _date, post in ranked[:3]]


def build_related_html(related_posts):
    cards = []
    for post in related_posts:
        tags_html = ''.join(
            f'<span class="blog-tag">{tag}</span>' for tag in post.get('tags', [])
        )
        image = post.get('image', 'img/bg-img/2.png')
        image_src = image if image.startswith('http') else '../' + image
        href = post.get('url', '').replace('blog/', '')
        read_minutes = post.get('readMinutes', estimate_reading_minutes(post))
        card = (
            '            <div class="col-12 col-md-6 col-lg-4 mb-30">\n'
            f'              <a href="{href}" class="blog-card">\n'
            f'                <div class="blog-card-img"><img src="{image_src}" alt="{post.get("title", "")}" loading="lazy"></div>\n'
            '                <div class="blog-card-body">\n'
            f'                  <div class="blog-card-date">{format_post_date(post.get("date", "1970-01-01"))} · {read_minutes} min read</div>\n'
            f'                  <h3 class="blog-card-title">{post.get("title", "")}</h3>\n'
            f'                  <p class="blog-card-excerpt">{post.get("excerpt", "")}</p>\n'
            f'                  <div class="blog-card-tags">{tags_html}</div>\n'
            '                </div>\n'
            '              </a>\n'
            '            </div>'
        )
        cards.append(card)

    return (
        '        <div class="related-posts">\n'
        '          <h2>Related posts</h2>\n'
        '          <div class="row related-posts-grid">\n'
        + '\n'.join(cards)
        + '\n          </div>\n'
        '        </div>'
    )


def find_block_end(content, start):
    """Index just past the </div> closing the div that starts at `start`."""
    depth = 0
    for m in re.finditer(r'<div\b|</div>', content[start:]):
        depth += 1 if m.group(0) != '</div>' else -1
        if depth == 0:
            return start + m.end()
    raise ValueError('unbalanced divs')


def read_preserving_newlines(path):
    """Read a file without translating line endings, and report which ending
    it uses. The checkout is CRLF; writing LF back would show up as a
    whole-file diff on every post the generator touches."""
    with open(path, encoding='utf-8', newline='') as fh:
        raw = fh.read()
    crlf = raw.count('\r\n')
    lf = raw.count('\n') - crlf
    return raw, ('\r\n' if crlf and not lf else '\n')


def to_newline(text, newline):
    normalised = text.replace('\r\n', '\n')
    return normalised if newline == '\n' else normalised.replace('\n', '\r\n')


def render_post_content(post, related_html):
    """Return what this post's file should contain, or None if there is no
    insertion point. Split out from update_post_file so --check can compare
    without writing."""
    file_path = ROOT / post['url']
    if not file_path.exists():
        return None, None
    content, _newline = read_preserving_newlines(file_path)
    content = content.replace('\r\n', '\n')
    original = content

    placeholder_re = re.compile(r'[ \t]*<div id="related-posts-section"></div>')
    start = content.find('<div class="related-posts">')

    if placeholder_re.search(content):
        content = placeholder_re.sub(lambda _m: related_html, content, count=1)
    elif start != -1:
        line_start = content.rfind('\n', 0, start) + 1
        end = find_block_end(content, start)
        content = content[:line_start] + related_html + content[end:]
    else:
        anchor = content.rfind('<hr style="margin: 40px 0;">')
        if anchor == -1:
            return original, None
        line_start = content.rfind('\n', 0, anchor) + 1
        content = content[:line_start] + related_html + '\n\n' + content[line_start:]
    return original, content


def update_post_file(post, related_html):
    file_path = ROOT / post['url']
    _raw, newline = read_preserving_newlines(file_path)
    _original, content = render_post_content(post, related_html)
    if content is None:
        print(f'  ! no insertion point in {post["url"]} — skipped')
        return
    with open(file_path, 'w', encoding='utf-8', newline='') as fh:
        fh.write(to_newline(content, newline))


def main(argv=None):
    check_only = '--check' in (argv if argv is not None else sys.argv[1:])
    posts = json.loads(POSTS_PATH.read_text(encoding='utf-8-sig'))
    vectors = build_vectors(posts)
    drift = []
    for post in posts:
        related = build_related_posts(posts, post, vectors)
        html = build_related_html(related)
        if check_only:
            original, wanted = render_post_content(post, html)
            if original is None or wanted is None:
                continue
            # Normalise line endings: the generator writes LF, the checkout is
            # CRLF, so a raw comparison would flag every file.
            if original.replace('\r\n', '\n') != wanted.replace('\r\n', '\n'):
                drift.append(post['url'])
            continue
        update_post_file(post, html)
        titles = ' | '.join(p['title'][:34] for p in related)
        print(f'{post["url"].split("/")[-1][:44]:44} -> {titles}')

    if check_only:
        if drift:
            print(f'related-posts blocks are stale in {len(drift)} post(s):')
            for d in drift[:12]:
                print(f'  {d}')
            if len(drift) > 12:
                print(f'  ...and {len(drift) - 12} more')
            print('run: python .github/scripts/generate_related_posts.py')
            return 1
        print('related-posts blocks are up to date.')
        return 0
    return 0


if __name__ == '__main__':
    sys.exit(main())
