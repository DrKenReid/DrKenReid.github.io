"""Bake "Related posts" sections into published posts.

Ranking is TF-IDF cosine similarity over each post's actual body text
(plus a small shared-tag boost), so recommendations reflect what a post
is about rather than only its tag overlap. No external dependencies.
The posts the end band's "Up next" pager already links to (up_next,
which mirrors postNeighbours in js/shared-components.js) are left out, so
the cards start where the pager stops instead of repeating it.

Run after adding a post to data/posts.json:
    .venv/Scripts/python.exe .github/scripts/generate_related_posts.py
    .venv/Scripts/python.exe .github/scripts/generate_related_posts.py --check

Where the block goes: always inside the post's .blog-post element, as its
last child unless it is already somewhere inside. The runtime chrome in
js/shared-components.js (disclaimer, thanks card, comments) positions
itself against a .related-posts it finds inside .blog-post, and a block
left outside it once got a second, runtime block rendered on top. An
existing block (inside or out) or a <div id="related-posts-section"></div>
placeholder is replaced, so the script is idempotent.

The cards are the stacked card that createBlogCardElement() in
js/shared-components.js builds, attribute for attribute: the .kr-glow-host
column with a site-absolute --kr-cover, the .kr-lit card with its
.kr-lit__ring, and a decorative cover (alt=""; the title is the link's
name). Change one and change the other. The runtime path there is only a
fallback for drafts, which are not in posts.json and so never baked.

Every published post must have a .blog-post body: one without fails the
run (and --check), rather than quietly ranking on its title alone.
"""

import html
import math
import re
import sys
from collections import Counter
from datetime import datetime

import sitelib


ROOT = sitelib.ROOT
POSTS_PATH = sitelib.POSTS_JSON

# Same fallback cover as DEFAULT_POST_IMAGE in js/shared-components.js.
DEFAULT_POST_IMAGE = 'img/photography/hero/97.webp'

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
PLACEHOLDER_RE = re.compile(r'[ \t]*<div id="related-posts-section"\s*></div>')


class PostBodyMissing(Exception):
    """A published post whose file has no .blog-post element."""


def esc(value):
    return html.escape(str(value), quote=True)


def format_post_date(date_str):
    """"15 July 2026", as formatPostDate() prints it in the browser."""
    date_value = datetime.strptime(date_str, '%Y-%m-%d')
    return f'{date_value.day} {date_value.strftime("%B %Y")}'


def display_minutes(post):
    """The read time a card prints: posts.json's readMinutes as
    postReadMinutes() in the browser shows it (Math.round), or None when
    absent, so the card shows no read time rather than a guess. Not
    sitelib.read_minutes, which turns a word count into the stored value;
    this only displays that value."""
    value = post.get('readMinutes')
    if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
        return None
    return max(1, int(math.floor(value + 0.5)))


def find_block(content, class_token, start=0):
    """(start, end) of the whole first <div> at or after `start` with
    `class_token` among its classes, or None when there is none or it
    never closes. sitelib.div_span finds it, the same finder the feed
    and the read times use for a post's body."""
    span = sitelib.div_span(content, class_token, start)
    return (span[0], span[3]) if span else None


def body_span(content, url):
    """sitelib.post_body_span of a published post, which must have one."""
    span = sitelib.post_body_span(content)
    if span is None:
        raise PostBodyMissing(f'{url}: no .blog-post element, or one that never closes; '
                              'every published post needs one')
    return span


def extract_body_text(post):
    """Visible prose of a post: its .blog-post element with markup
    stripped and any related-posts block cut out, so the cards a post
    recommends never feed back into what it is about."""
    content, _newline = read_preserving_newlines(ROOT / post['url'])
    content = content.replace('\r\n', '\n')
    _open, inner_start, inner_end, _close = body_span(content, post['url'])
    segment = content[inner_start:inner_end]
    related = find_block(segment, 'related-posts')
    if related:
        segment = segment[:related[0]] + segment[related[1]:]
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


def up_next(posts, current):
    """The posts the end band's "Up next" pager links to for `current`:
    postNeighbours() in js/shared-components.js, rule for rule, so a card
    here never repeats a link directly above it. The first series with a
    neighbour gives its adjacent parts; a side it cannot fill falls back
    to the chronological neighbour in posts.json (newest first) unless
    that post is already on the other side. Change one, change the other.
    """
    idx = posts.index(current) if current in posts else -1
    older = posts[idx + 1] if 0 <= idx < len(posts) - 1 else None
    newer = posts[idx - 1] if idx > 0 else None
    prev = nxt = None
    for entry in sitelib.series_list(current):
        if not entry or not entry.get('name'):
            continue
        parts = sitelib.series_parts(posts, entry['name'])
        at = parts.index(current) if current in parts else -1
        before = parts[at - 1] if at > 0 else None
        after = parts[at + 1] if 0 <= at < len(parts) - 1 else None
        if not before and not after:
            continue
        prev, nxt = before, after
        break
    if prev is None and older is not None and older is not nxt:
        prev = older
    if nxt is None and newer is not None and newer is not prev:
        nxt = newer
    return [p for p in (prev, nxt) if p is not None]


def build_related_posts(posts, current_post, vectors):
    current_url = current_post.get('url', '')
    current_tags = set(current_post.get('tags', []))
    # The pager above the cards already offers these two; a card for
    # either repeated a link the reader had just passed.
    skip = {current_url} | {p.get('url', '') for p in up_next(posts, current_post)}
    ranked = []
    for post in posts:
        url = post.get('url', '')
        if url in skip:
            continue
        sim = cosine(vectors[current_url], vectors[url])
        shared = len(current_tags.intersection(post.get('tags', [])))
        ranked.append((sim + TAG_BOOST * shared, post.get('date', ''), post))
    ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return [post for _score, _date, post in ranked[:3]]


def build_card_html(post):
    """One stacked card, as createBlogCardElement(post) renders it from a
    post page. Paths: the link and the <img> are relative to blog/, where
    every published post lives; --kr-cover is site-absolute because a
    relative url() inside a custom property resolves against the
    stylesheet, not the page."""
    image = post.get('image') or DEFAULT_POST_IMAGE
    if image.startswith(('http://', 'https://', '//', '/')):
        image_src = cover = image
    else:
        image_src, cover = '../' + image, '/' + image
    url = post.get('url', '')
    href = url[len('blog/'):] if url.startswith('blog/') else '../' + url
    minutes = display_minutes(post)
    date_line = format_post_date(post.get('date', '1970-01-01'))
    if minutes:
        date_line += f' · {minutes} min read'
    tags_html = ''.join(f'<span class="blog-tag">{esc(tag)}</span>' for tag in post.get('tags', []))
    return (
        f'            <div class="col-12 col-md-6 col-lg-4 mb-30 kr-glow-host" style="--kr-cover: url(\'{esc(cover)}\')">\n'
        f'              <a href="{esc(href)}" class="blog-card kr-lit">\n'
        '                <span class="kr-lit__ring" aria-hidden="true"></span>\n'
        f'                <div class="blog-card-img"><img src="{esc(image_src)}" alt="" loading="lazy"></div>\n'
        '                <div class="blog-card-body">\n'
        f'                  <div class="blog-card-date">{esc(date_line)}</div>\n'
        f'                  <h3 class="blog-card-title">{esc(post.get("title", ""))}</h3>\n'
        f'                  <p class="blog-card-excerpt">{esc(post.get("excerpt", ""))}</p>\n'
        f'                  <div class="blog-card-tags">{tags_html}</div>\n'
        '                </div>\n'
        '              </a>\n'
        '            </div>'
    )


def build_related_html(related_posts):
    return (
        '        <div class="related-posts">\n'
        '          <h2>Related posts</h2>\n'
        '          <div class="row related-posts-grid">\n'
        + '\n'.join(build_card_html(post) for post in related_posts)
        + '\n          </div>\n'
        '        </div>'
    )


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
    """(what the post's file holds now, what it should hold), both with LF
    line endings, or (None, None) when the file is missing. Split out from
    update_post_file so --check can compare without writing. Raises
    PostBodyMissing for a post with no .blog-post element."""
    file_path = ROOT / post['url']
    if not file_path.exists():
        return None, None
    content, _newline = read_preserving_newlines(file_path)
    content = content.replace('\r\n', '\n')
    original = content

    body_start, _inner, _close, body_end = body_span(content, post['url'])
    target = find_block(content, 'related-posts')
    if target is None:
        placeholder = PLACEHOLDER_RE.search(content)
        target = placeholder.span() if placeholder else None

    if target and body_start < target[0] < body_end:
        # Already inside the body: replace it where it stands.
        start, end = target
        line_start = content.rfind('\n', 0, start) + 1
        if not content[line_start:start].strip():
            start = line_start
        return original, content[:start] + related_html + content[end:]

    if target:
        # Outside the body: take it out, with the blank lines in front of it.
        start, end = target
        while start > 0 and content[start - 1] in ' \t\n':
            start -= 1
        content = content[:start] + content[end:]

    # Last thing in the body, on its own lines before the closing tag.
    close = body_span(content, post['url'])[2]
    line_start = content.rfind('\n', 0, close) + 1
    if content[line_start:close].strip():
        content = content[:close] + '\n' + related_html + '\n' + content[close:]
    else:
        content = content[:line_start] + related_html + '\n\n' + content[line_start:]
    return original, content


def update_post_file(post, related_html):
    file_path = ROOT / post['url']
    _raw, newline = read_preserving_newlines(file_path)
    original, content = render_post_content(post, related_html)
    if content is None:
        print(f'  ! {post["url"]} is listed in posts.json but missing; skipped')
        return
    if content == original:
        return
    with open(file_path, 'w', encoding='utf-8', newline='') as fh:
        fh.write(to_newline(content, newline))


def main(argv=None):
    parser = sitelib.arg_parser(__doc__)
    parser.add_argument('--check', action='store_true',
                        help='report stale blocks and exit 1, writing nothing')
    check_only = parser.parse_args(argv).check
    posts = sitelib.load_posts(POSTS_PATH)
    try:
        vectors = build_vectors(posts)
        drift = []
        for post in posts:
            related = build_related_posts(posts, post, vectors)
            related_html = build_related_html(related)
            if check_only:
                original, wanted = render_post_content(post, related_html)
                if original is not None and original != wanted:
                    drift.append(post['url'])
                continue
            update_post_file(post, related_html)
            titles = ' | '.join(p['title'][:34] for p in related)
            print(f'{post["url"].split("/")[-1][:44]:44} -> {titles}')
    except PostBodyMissing as err:
        print(f'error: {err}')
        return 1

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


if __name__ == '__main__':
    sys.exit(main())
