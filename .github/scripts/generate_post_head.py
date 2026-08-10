"""Render and verify the canonical <head> of a blog post.

PUBLISHING.md tells you to copy the head of a recent post and edit it.
That is how the corpus drifted: BreadcrumbList JSON-LD, the manifest and
apple-touch-icon links, and <meta name="keywords"> each went missing from
whichever posts happened to be copied from a head that lacked them.

Everything a head needs is already in data/posts.json (title, date,
excerpt, image, tags, url), so:

    python .github/scripts/generate_post_head.py <slug>   # print one head
    python .github/scripts/generate_post_head.py --all    # print them all
    python .github/scripts/generate_post_head.py --check  # report drift
    python .github/scripts/generate_post_head.py --fix    # add what's missing

What is canonical was measured against the 50 published posts, not
assumed. Plenty of the head legitimately varies per post and is NEVER
enforced or rewritten: the shortened <title> and meta description (which
are hand-trimmed, not verbatim posts.json), og:image and the preload
href (release PNG, in-post art, or a bespoke OG card), the Lora font
link, MathJax and Prism includes, and the hand-authored keyword lists.
The rendered head is a scaffold for a NEW post; --check enforces only
the invariants below.

--check enforces, per post:
  * presence of every element that all 50 posts share, plus the four
    elements this script exists to stop losing (BreadcrumbList,
    rel=manifest, apple-touch-icon, keywords);
  * the handful of values that are genuinely derivable from posts.json
    and already agree across all 50: canonical, og:url,
    citation_public_url, citation_publication_date, citation_online_date,
    DC.date, twitter:image == og:image, and the BreadcrumbList leaf.

--fix is deliberately narrow. It inserts only the missing elements, at
the anchor each one belongs after, reusing that file's own indentation
(the corpus mixes two-space, one-space, zero and tab heads). It never
reorders, reformats or rewrites anything already present, and it
preserves CRLF line endings.
"""

import html
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
POSTS_PATH = ROOT / 'data' / 'posts.json'
SITE = 'https://www.kenreid.co.uk'

THEME_BOOT = (
    "<script>(function(){var t;try{t=localStorage.getItem('kr-theme');}"
    "catch(e){}if(!t)t='dark';document.documentElement.setAttribute("
    "'data-theme',t);})();</script>"
)
GTAG_ID = 'G-PQK9NRXC9D'

ICON_LINE = '<link rel="icon" href="../img/core-img/favicon.png">'
APPLE_LINE = '<link rel="apple-touch-icon" href="../img/core-img/apple-touch-icon.png">'
THEME_COLOR_LINE = '<meta name="theme-color" content="#1a1a1a">'
MANIFEST_LINE = '<link rel="manifest" href="../manifest.json">'

THUMB_RE = re.compile(r'^img/photography/thumb/(\d+)\.webp$')
RELEASE = 'https://github.com/DrKenReid/DrKenReid.github.io/releases/download/photos-v1'


# --------------------------------------------------------------------------
# posts.json helpers
# --------------------------------------------------------------------------

def load_posts():
    return json.loads(POSTS_PATH.read_text(encoding='utf-8-sig'))


def slug_of(post):
    return post['url'].rsplit('/', 1)[-1].removesuffix('.html')


def public_url(post):
    return f'{SITE}/{post["url"]}'


def esc(text):
    """Escape for an HTML attribute, leaving apostrophes alone: the corpus
    writes them raw inside double-quoted attributes."""
    return html.escape(text or '', quote=True).replace('&#x27;', "'")


def og_image(post):
    """Social card image. Thumbs map to the full-size photo in the
    photos-v1 release; anything else is served from the site."""
    image = post.get('image', '')
    thumb = THUMB_RE.match(image)
    if thumb:
        return f'{RELEASE}/{thumb.group(1)}.png'
    if image.startswith('http'):
        return image
    return f'{SITE}/{image}'


def preload_image(post):
    """Above-the-fold hero to preload, relative to blog/."""
    image = post.get('image', '')
    thumb = THUMB_RE.match(image)
    if thumb:
        return f'../img/photography/hero/{thumb.group(1)}.webp'
    if image.startswith('http'):
        return image
    return f'../{image}'


# --------------------------------------------------------------------------
# rendering
# --------------------------------------------------------------------------

def indent_block(text, base, step):
    """Re-indent a block written with two-space nesting to a file that uses
    `base` for its head lines and `step` per nesting level."""
    out = []
    for line in text.split('\n'):
        stripped = line.lstrip(' ')
        levels = (len(line) - len(stripped)) // 2
        out.append(base + step * levels + stripped if stripped else '')
    return '\n'.join(out)


def breadcrumb_block(post, base='  ', step='  '):
    """BreadcrumbList JSON-LD in the shape 30 of the 36 posts that have one
    already use."""
    block = (
        '<script type="application/ld+json">\n'
        '{\n'
        '  "@context": "https://schema.org",\n'
        '  "@type": "BreadcrumbList",\n'
        '  "itemListElement": [\n'
        '    {\n'
        '      "@type": "ListItem",\n'
        '      "position": 1,\n'
        '      "name": "Home",\n'
        f'      "item": "{SITE}/"\n'
        '    },\n'
        '    {\n'
        '      "@type": "ListItem",\n'
        '      "position": 2,\n'
        '      "name": "Blog",\n'
        f'      "item": "{SITE}/blog.html"\n'
        '    },\n'
        '    {\n'
        '      "@type": "ListItem",\n'
        '      "position": 3,\n'
        f'      "name": {json.dumps(post["title"], ensure_ascii=False)},\n'
        f'      "item": "{public_url(post)}"\n'
        '    }\n'
        '  ]\n'
        '}\n'
        '</script>'
    )
    return indent_block(block, base, step)


def blogposting_block(post, base='  ', step='  '):
    block = (
        '<script type="application/ld+json">\n'
        '{\n'
        '  "@context": "https://schema.org",\n'
        '  "@type": "BlogPosting",\n'
        f'  "mainEntityOfPage": "{public_url(post)}",\n'
        f'  "headline": {json.dumps(post["title"], ensure_ascii=False)},\n'
        f'  "description": {json.dumps(post.get("excerpt", ""), ensure_ascii=False)},\n'
        f'  "image": "{og_image(post)}",\n'
        '  "author": {\n'
        '    "@type": "Person",\n'
        '    "name": "Ken Reid",\n'
        f'    "url": "{SITE}"\n'
        '  },\n'
        f'  "datePublished": "{post["date"]}",\n'
        '  "publisher": {\n'
        '    "@type": "Person",\n'
        '    "name": "Ken Reid"\n'
        '  },\n'
        f'  "keywords": {json.dumps(post.get("tags", []), ensure_ascii=False)}\n'
        '}\n'
        '</script>'
    )
    return indent_block(block, base, step)


def render_head(post):
    """The canonical head for a new post. Title, description, og:image and
    the preload href are starting points: posts routinely hand-trim the
    first two and point the last at bespoke art."""
    url = public_url(post)
    title = esc(post['title'])
    desc = esc(post.get('excerpt', ''))
    image = og_image(post)
    slash_date = post['date'].replace('-', '/')
    lines = [
        '<head>',
        '  <meta charset="UTF-8">',
        f'  {THEME_BOOT}',
        f'  <meta name="description" content="{desc}">',
        f'  <meta name="keywords" content="{esc(", ".join(post.get("tags", [])))}">',
        '  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">',
        f'  <title>{title} - Ken Reid</title>',
        f'  <meta property="og:title" content="{title}">',
        f'  <meta property="og:description" content="{desc}">',
        f'  <meta property="og:image" content="{image}">',
        f'  <meta property="og:url" content="{url}">',
        '  <meta property="og:type" content="article">',
        '  <meta name="twitter:card" content="summary_large_image">',
        f'  <meta name="twitter:title" content="{title}">',
        f'  <meta name="twitter:description" content="{desc}">',
        f'  <meta name="twitter:image" content="{image}">',
        f'  <meta name="citation_title" content="{title}">',
        '  <meta name="citation_author" content="Reid, Kenneth N.">',
        f'  <meta name="citation_publication_date" content="{slash_date}">',
        f'  <meta name="citation_online_date" content="{slash_date}">',
        f'  <meta name="citation_public_url" content="{url}">',
        f'  <meta name="DC.title" content="{title}">',
        '  <meta name="DC.creator" content="Kenneth N. Reid">',
        f'  <meta name="DC.date" content="{post["date"]}">',
        f'  <script async src="https://www.googletagmanager.com/gtag/js?id={GTAG_ID}"></script>',
        '  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}'
        f"gtag('js',new Date());gtag('config','{GTAG_ID}');</script>",
        f'  {ICON_LINE}',
        f'  {APPLE_LINE}',
        f'  {THEME_COLOR_LINE}',
        f'  {MANIFEST_LINE}',
        f'  <link rel="preload" as="image" href="{preload_image(post)}">',
        '  <link rel="stylesheet" href="../style.min.css">',
        f'  <link rel="canonical" href="{url}">',
        blogposting_block(post),
        breadcrumb_block(post),
        '  <script defer src="../js/theme.js"></script>',
        '  <script defer src="../js/palette.js"></script>',
        '</head>',
    ]
    return '\n'.join(lines)


# --------------------------------------------------------------------------
# reading posts back
# --------------------------------------------------------------------------

def read_preserving_newlines(path):
    """Read without translating line endings, and report which the file
    uses. The checkout is CRLF; writing LF back would turn a three-line
    insertion into a whole-file diff."""
    with open(path, encoding='utf-8', newline='') as fh:
        raw = fh.read()
    crlf = raw.count('\r\n')
    lf = raw.count('\n') - crlf
    return raw, ('\r\n' if crlf and not lf else '\n')


def to_newline(text, newline):
    normalised = text.replace('\r\n', '\n')
    return normalised if newline == '\n' else normalised.replace('\n', '\r\n')


def head_of(content):
    match = re.search(r'<head[^>]*>(.*?)</head>', content, re.S | re.I)
    return match.group(1) if match else ''


def is_redirect(content):
    return 'http-equiv="refresh"' in content or 'http-equiv=refresh' in content


def attr(head, kind, name):
    pattern = r'<meta %s="%s" content="([^"]*)"' % (kind, re.escape(name))
    match = re.search(pattern, head)
    return match.group(1) if match else None


def link_href(head, rel):
    match = re.search(r'<link rel="%s"[^>]*href="([^"]*)"' % re.escape(rel), head)
    return match.group(1) if match else None


# Elements every one of the 50 published posts carries (or must, in the case
# of the four this script was written to restore). Presence only: the values
# are hand-authored.
REQUIRED_PRESENT = [
    ('charset', r'<meta charset="UTF-8">'),
    ('theme-boot', r"localStorage\.getItem\('kr-theme'\)"),
    ('description', r'<meta name="description" content='),
    ('keywords', r'<meta name="keywords" content='),
    ('viewport', r'<meta name="viewport" content='),
    ('title', r'<title>'),
    ('og:title', r'<meta property="og:title" content='),
    ('og:description', r'<meta property="og:description" content='),
    ('og:image', r'<meta property="og:image" content='),
    ('og:url', r'<meta property="og:url" content='),
    ('og:type', r'<meta property="og:type" content="article">'),
    ('twitter:card', r'<meta name="twitter:card" content="summary_large_image">'),
    ('twitter:title', r'<meta name="twitter:title" content='),
    ('twitter:description', r'<meta name="twitter:description" content='),
    ('twitter:image', r'<meta name="twitter:image" content='),
    ('citation_title', r'<meta name="citation_title" content='),
    ('citation_author', r'<meta name="citation_author" content="Reid, Kenneth N.">'),
    ('citation_publication_date', r'<meta name="citation_publication_date" content='),
    ('citation_online_date', r'<meta name="citation_online_date" content='),
    ('citation_public_url', r'<meta name="citation_public_url" content='),
    ('DC.title', r'<meta name="DC.title" content='),
    ('DC.creator', r'<meta name="DC.creator" content="Kenneth N. Reid">'),
    ('DC.date', r'<meta name="DC.date" content='),
    ('analytics', r'googletagmanager\.com/gtag/js'),
    ('icon', r'<link rel="icon"'),
    ('apple-touch-icon', r'<link rel="apple-touch-icon"'),
    ('theme-color', r'<meta name="theme-color" content='),
    ('manifest', r'<link rel="manifest"'),
    ('stylesheet', r'<link rel="stylesheet" href="\.\./style\.min\.css">'),
    ('canonical', r'<link rel="canonical" href='),
    ('jsonld-BlogPosting', r'"@type":\s*"BlogPosting"'),
    ('jsonld-BreadcrumbList', r'"@type":\s*"BreadcrumbList"'),
    ('theme.js', r'<script defer src="\.\./js/theme\.js"></script>'),
    ('palette.js', r'<script defer src="\.\./js/palette\.js"></script>'),
]


def derivable_values(head, post):
    """Values posts.json fully determines, and which all 50 posts already
    agree on. Anything hand-trimmed per post is absent by design."""
    url = public_url(post)
    slash_date = post['date'].replace('-', '/')
    breadcrumb_leaf = re.search(
        r'"BreadcrumbList".*?"position":\s*3.*?"item":\s*"([^"]*)"', head, re.S)
    return {
        'canonical': (link_href(head, 'canonical'), url),
        'og:url': (attr(head, 'property', 'og:url'), url),
        'citation_public_url': (attr(head, 'name', 'citation_public_url'), url),
        'citation_publication_date': (
            attr(head, 'name', 'citation_publication_date'), slash_date),
        'citation_online_date': (attr(head, 'name', 'citation_online_date'), slash_date),
        'DC.date': (attr(head, 'name', 'DC.date'), post['date']),
        'twitter:image': (attr(head, 'name', 'twitter:image'),
                          attr(head, 'property', 'og:image')),
        'breadcrumb-url': (breadcrumb_leaf.group(1) if breadcrumb_leaf else None, url),
    }


def head_findings(head, post):
    """Every way this post's head deviates from canonical, as
    (field, message) pairs."""
    findings = []
    for field, pattern in REQUIRED_PRESENT:
        if not re.search(pattern, head):
            findings.append((field, 'missing'))
    for field, (got, want) in derivable_values(head, post).items():
        # A missing element is already reported above; don't say it twice.
        if got is None or want is None:
            continue
        if got != want:
            findings.append((field, f'{got!r} should be {want!r}'))
    return findings


# --------------------------------------------------------------------------
# surgical fix
# --------------------------------------------------------------------------

def _anchor(head, pattern):
    """(indent, end-of-line offset) for the line matching `pattern`."""
    match = re.search(r'^([ \t]*)' + pattern + r'[ \t]*$', head, re.M)
    if not match:
        return None
    return match.group(1), match.end()


def _nesting_step(head, base):
    """The whitespace this file adds per nesting level, read off its own
    BlogPosting block. Heads in the corpus use two spaces, one space, a
    tab, or nothing at all."""
    match = re.search(r'^([ \t]*)"@context": "https://schema\.org",[ \t]*$', head, re.M)
    if not match:
        return '  '
    inner = match.group(1)
    return inner[len(base):] if inner.startswith(base) and len(inner) > len(base) else '  '


def plan_insertions(head, post):
    """(offset, text, field) for each missing element, at the anchor it
    belongs after. Nothing already present is touched."""
    plans = []

    if not re.search(r'<meta name="keywords" content=', head):
        anchor = _anchor(head, r'<meta name="description" content="[^"]*">')
        if anchor:
            indent, end = anchor
            keywords = esc(', '.join(post.get('tags', [])))
            plans.append((end, f'\n{indent}<meta name="keywords" content="{keywords}">',
                          'keywords'))

    if not re.search(r'<link rel="apple-touch-icon"', head):
        anchor = _anchor(head, r'<link rel="icon" href="[^"]*">')
        if anchor:
            indent, end = anchor
            plans.append((end, f'\n{indent}{APPLE_LINE}', 'apple-touch-icon'))

    if not re.search(r'<link rel="manifest"', head):
        anchor = _anchor(head, r'<meta name="theme-color" content="[^"]*">')
        if anchor:
            indent, end = anchor
            plans.append((end, f'\n{indent}{MANIFEST_LINE}', 'manifest'))

    if not re.search(r'"@type":\s*"BreadcrumbList"', head):
        # after the BlogPosting JSON-LD block, which is where all 36 posts
        # that already have a breadcrumb put theirs
        match = re.search(
            r'^([ \t]*)<script type="application/ld\+json">\s*\{.*?"@type":\s*"BlogPosting"'
            r'.*?^[ \t]*</script>[ \t]*$', head, re.M | re.S)
        if match:
            base = match.group(1)
            block = breadcrumb_block(post, base, _nesting_step(head, base))
            plans.append((match.end(), '\n' + block, 'jsonld-BreadcrumbList'))

    return plans


def fix_post(post, write=True):
    """Insert whatever is missing from this post's head. Returns the list of
    fields added."""
    path = ROOT / post['url']
    raw, newline = read_preserving_newlines(path)
    content = raw.replace('\r\n', '\n')
    match = re.search(r'<head[^>]*>(.*?)</head>', content, re.S | re.I)
    if not match:
        return []
    head_start = match.start(1)
    head = match.group(1)

    plans = plan_insertions(head, post)
    if not plans:
        return []
    for offset, text, _field in sorted(plans, reverse=True):
        cut = head_start + offset
        content = content[:cut] + text + content[cut:]
    if write:
        with open(path, 'w', encoding='utf-8', newline='') as fh:
            fh.write(to_newline(content, newline))
    return [field for _o, _t, field in plans]


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------

def run_check(posts):
    drift = []
    for post in posts:
        path = ROOT / post['url']
        if not path.exists():
            print(f'MISSING {post["url"]}')
            continue
        content = path.read_text(encoding='utf-8')
        if is_redirect(content):
            continue
        findings = head_findings(head_of(content), post)
        if findings:
            drift.append((post['url'], findings))
    if drift:
        print(f'post <head> has drifted in {len(drift)} post(s):')
        for url, findings in drift:
            print(f'  {url}')
            for field, message in findings:
                print(f'      {field}: {message}')
        print('run: python .github/scripts/generate_post_head.py --fix')
        return 1
    print(f'post <head> is canonical in all {len(posts)} posts.')
    return 0


def run_fix(posts):
    fixed = 0
    for post in posts:
        if not (ROOT / post['url']).exists():
            continue
        added = fix_post(post)
        if added:
            fixed += 1
            print(f'{post["url"]}: added {", ".join(added)}')
    if not fixed:
        print('nothing to add — every head already has the canonical elements.')
    else:
        print(f'\nUpdated {fixed} post(s).')
    return 0


def main(argv=None):
    args = list(argv if argv is not None else sys.argv[1:])
    posts = load_posts()

    if '--check' in args:
        return run_check(posts)
    if '--fix' in args:
        return run_fix(posts)
    if '--all' in args:
        for post in posts:
            print(f'<!-- {post["url"]} -->')
            print(render_head(post))
            print()
        return 0

    slugs = [a for a in args if not a.startswith('-')]
    if len(slugs) != 1:
        print('usage: generate_post_head.py <slug> | --all | --check | --fix')
        return 2
    wanted = slugs[0].removesuffix('.html').rsplit('/', 1)[-1]
    for post in posts:
        if slug_of(post) == wanted:
            print(render_head(post))
            return 0
    print(f'no post with slug {wanted!r} in data/posts.json')
    return 1


if __name__ == '__main__':
    sys.exit(main())
