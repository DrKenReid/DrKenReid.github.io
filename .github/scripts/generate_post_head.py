"""Render, check and repair the template-level markup of every blog post.

Posts used to be started by copying the head of a recent one and editing
it. That is how the corpus drifted: BreadcrumbList JSON-LD, the manifest
and apple-touch-icon links and <meta name="keywords"> each went missing
from whichever posts were copied from a head that lacked them, and every
later change to the template had to be made by hand in seventy files.

Everything the template needs is either in data/posts.json (title, date,
optional updated, excerpt, image, tags, category, series, words,
readMinutes) or already in the post (its opener's photograph, its
hand-trimmed description and keyword list). So this script owns the
template and a person owns the words:

    python .github/scripts/generate_post_head.py <slug>   # a new post's head
    python .github/scripts/generate_post_head.py --all    # every post's head
    python .github/scripts/generate_post_head.py --check  # exit 1 on drift
    python .github/scripts/generate_post_head.py --fix    # repair in place

WHAT --fix WRITES, AND --check REQUIRES

  lang="en-GB" on <html>
      The site is written in British English. The tag picks the screen
      reader's voice, the hyphenation and spell-check dictionaries, and
      the language search engines index the page under. Redirect stubs
      in blog/ get it too; nothing else in them is a template.
  no #preloader
      The spinner covered the page until window.load, so a post's opener,
      which is static markup, could not paint until every image and
      script had arrived. The one rule outside <head>: a post started
      from an old copy would otherwise bring it back.
  js/analytics.js in place of the inline gtag snippet
      The snippet requested gtag.js from every <head>, competing with the
      stylesheet and the hero for the first moments of a visit.
      analytics.js queues the config at once and loads the library after
      load and idle; it is idempotent, so a stray old snippet cannot
      count a visit twice.
  ?v= on the stylesheet and every first-party script, head and body
      ASSET_QUERY where a tag has no query at all (jQuery, js/vendor/
      and analytics.js excepted). The service worker before kr-v11 holds
      the unversioned URLs stale, and a new post's first view under it
      would run last deploy's shared-components.js (sw.js).
  og:image and twitter:image = https://www.kenreid.co.uk/img/og/<slug>.jpg
      The share card generate_og_images.py draws for the post. Never a
      photos-v1 release PNG: a release asset redirects to a signed,
      expiring URL served as application/octet-stream, which scrapers
      reject and replace with whatever image they find in the page.
  og:image:width 1200, og:image:height 630, og:image:alt
      With the size in the markup a scraper can lay out the large card on
      the first share instead of fetching the image to measure it (or
      falling back to the small card). The alt is the text the card
      carries, the post title, for anyone who cannot see it.
  og:url (the canonical URL) and og:type article
      Fully determined by posts.json, so rewritten if they drift.
  og:site_name "Ken Reid", og:locale en_GB
      The name a share card prints above the title, and the locale that
      matches lang.
  article:published_time, and article:modified_time only with "updated"
      Open Graph's copy of the dates below.
  fetchpriority="high" on the hero preload, whose href is the opener's
  photograph
      The opener paints the photograph as a CSS background, which the
      browser only finds once the stylesheet has been parsed and then
      fetches at low priority; it is the largest paint on every post. A
      preload that named a different file would spend the bandwidth on an
      image nothing shows, so the href is taken from the opener.
  the BlogPosting JSON-LD, rebuilt whole in one shape:
      mainEntityOfPage and url   the canonical URL
      headline                   posts.json title (the opener's title)
      description, keywords      kept from the post's own block: they are
                                 hand-written, and often differ from the
                                 excerpt and the tags on purpose
      image                      an ImageObject for the share card, 1200x630
      datePublished              posts.json date
      dateModified               posts.json "updated", else date
      author, publisher          the site's Person node by @id (PERSON_ID,
                                 defined on the homepage), with the name
                                 kept beside it for readers that do not
                                 follow references
      isPartOf                   the WebSite node by @id (WEBSITE_ID, also
                                 on the homepage), and a CreativeWorkSeries
                                 for each series the post belongs to, with
                                 the series page as its url
      inLanguage                 en-GB
      articleSection             posts.json category
      wordCount, timeRequired    posts.json words, and readMinutes as an
                                 ISO 8601 duration (PT5M)
  the BreadcrumbList JSON-LD, keywords, apple-touch-icon and manifest,
  when missing
      The four this script was first written to restore; inserted, never
      rewritten.

WHAT --check ALSO REPORTS, AND ONLY A PERSON CAN FIX

  * an element every post carries whose value is hand-written (<title>,
    the meta description, og:title and the rest of REQUIRED_PRESENT);
  * a value posts.json determines that disagrees with it: canonical,
    citation_public_url, citation_publication_date, citation_online_date,
    DC.date and the BreadcrumbList leaf (these sit among hand-written
    lines, so a mismatch is more likely a copied head than a stale date,
    and a person should look);
  * a JSON-LD block that is not valid JSON;
  * an "updated" that is not a YYYY-MM-DD date on or after "date";
  * a share card, series page or homepage @id that the head points at
    and that does not exist;
  * a tracked file in blog/ that is neither in posts.json nor a redirect.

dateModified. It comes from the optional posts.json field "updated"
(YYYY-MM-DD), falling back to "date"; the sitemap's lastmod reads the
same field. It is never derived from git. The post-commit hook moves a
weekday commit made before 17:00 to the previous evening, so commit
times are not when a change was made, and a commit that edits a post
cannot record its own date inside that post (the date would change the
commit). Set "updated" by hand when a post changes in substance, not for
a typo or a template change like the ones this script makes.

NEVER TOUCHED. The <title>, meta description and keywords (hand-trimmed),
og:title/og:description and the twitter and citation text, the Lora link,
MathJax and Prism includes, and each post's own <style> block.

FORMAT. --fix keeps each file's line endings, and writes every edited or
inserted line at the indentation of the line it replaces or follows (the
corpus mixes two spaces, one, a tab and none). The rebuilt JSON-LD sits
at its <script> tag's indentation and nests by the step the file's
BreadcrumbList uses. It is idempotent, and --check is exactly "--fix
would change nothing, and nothing a person must fix is wrong", so the two
cannot disagree. Run it after generate_read_times.py, whose words and
readMinutes it copies.
"""

import datetime
import html
import json
import posixpath
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402

ROOT = sitelib.ROOT
POSTS_PATH = sitelib.POSTS_JSON
SITE = sitelib.SITE

# The homepage's JSON-LD @graph defines both nodes (index.html; the Person
# is repeated in full on data_science.html, and tests/test_structured_data.py
# keeps the two in step). A post only points at them, so the facts about
# the author live in one place. --check fails if either id disappears.
PERSON_ID = f'{SITE}/#ken'
WEBSITE_ID = f'{SITE}/#website'
HOMEPAGE = ROOT / 'index.html'

AUTHOR_NAME = 'Ken Reid'
LANG = 'en-GB'
OG_LOCALE = 'en_GB'
# generate_og_images.py draws every card at this size (its W, H).
OG_CARD_SIZE = (1200, 630)

THEME_BOOT = (
    "<script>(function(){var t;try{t=localStorage.getItem('kr-theme');}"
    "catch(e){}if(!t)t='dark';document.documentElement.setAttribute("
    "'data-theme',t);})();</script>"
)

ICON_LINE = '<link rel="icon" href="../img/core-img/favicon.png">'
APPLE_LINE = '<link rel="apple-touch-icon" href="../img/core-img/apple-touch-icon.png">'
THEME_COLOR_LINE = '<meta name="theme-color" content="#1a1a1a">'
MANIFEST_LINE = '<link rel="manifest" href="../manifest.json">'
# The measurement id lives in js/analytics.js alone. `defer` rather than
# `async`: the file is tiny and only queues work for after load, so there
# is nothing to gain from running it before the document is parsed.
ANALYTICS_LINE = '<script defer src="../js/analytics.js"></script>'

# The version query every page puts on the stylesheet and the shared
# scripts. It exists for one handover: the service worker before kr-v11
# served scripts and styles from its cache by exact URL, so on the first
# view after the kr-v11 deploy a page without the query ran last week's
# shared-components.js against its new markup (sw.js has the detail).
# kr-v11 fetches code network first, so later deploys need no bump. A
# post's stylesheet and first-party scripts must carry a query
# (rule_asset_query writes this one where there is none); any ?v= value
# is accepted, so a single file can still be bumped on its own.
ASSET_QUERY = '?v=20260923a'
ASSET_QUERY_RE = r'(?:\?v=[\w.-]+)?'
# Left without the query: jQuery and js/vendor/ are vendored releases that
# never change under one name (an upgrade is a new file), and
# js/analytics.js came after the handover, so the old worker never cached
# it (its tag is ANALYTICS_LINE, written as is).
UNVERSIONED_ASSETS = {'js/jquery.min.js', 'js/analytics.js'}

THUMB_RE = re.compile(r'^img/photography/thumb/(\d+)\.webp$')


# --------------------------------------------------------------------------
# posts.json helpers
# --------------------------------------------------------------------------

def load_posts():
    return sitelib.load_posts(POSTS_PATH)


def slug_of(post):
    return post['url'].rsplit('/', 1)[-1].removesuffix('.html')


def public_url(post):
    return f'{SITE}/{post["url"]}'


def esc(text):
    """Escape for an HTML attribute, leaving apostrophes alone: the corpus
    writes them raw inside double-quoted attributes."""
    return html.escape(text or '', quote=True).replace('&#x27;', "'")


def og_image(post):
    """The post's share card, drawn by generate_og_images.py."""
    return f'{SITE}/img/og/{slug_of(post)}.jpg'


def modified_date(post):
    """posts.json "updated" when a person set one, else the publication
    date. Deliberately not the last commit's date: see the docstring."""
    return post.get('updated') or post['date']


def preload_image(post):
    """Hero to preload for a NEW post, relative to blog/: the rendition
    the opener will paint (a thumb's 1920px hero, not the thumb)."""
    image = post.get('image', '')
    thumb = THUMB_RE.match(image)
    if thumb:
        return f'../img/photography/hero/{thumb.group(1)}.webp'
    if image.startswith('http'):
        return image
    return f'../{image}'


# --------------------------------------------------------------------------
# JSON-LD
# --------------------------------------------------------------------------

def person_ref():
    return {'@type': 'Person', '@id': PERSON_ID, 'name': AUTHOR_NAME, 'url': f'{SITE}/'}


def blogposting(post, description=None, keywords=None):
    """The BlogPosting node for `post`, as a dict in the order it is
    written. `description` and `keywords` are the post's own hand-written
    values when it has them; a new post starts from the excerpt and tags."""
    url = public_url(post)
    width, height = OG_CARD_SIZE
    part_of = [{'@id': WEBSITE_ID}]
    for entry in sitelib.series_list(post):
        page = f'{SITE}/{sitelib.series_page(entry["name"])}'
        part_of.append({
            '@type': 'CreativeWorkSeries',
            # One node per series across every post that names it, so a
            # reader of the graph sees one series with many parts.
            '@id': f'{page}#series',
            'name': entry['name'],
            'url': page,
        })
    node = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        'mainEntityOfPage': {'@type': 'WebPage', '@id': url},
        'url': url,
        'headline': post['title'],
        'description': post.get('excerpt', '') if description is None else description,
        'image': {
            '@type': 'ImageObject',
            'url': og_image(post),
            'width': width,
            'height': height,
        },
        'datePublished': post['date'],
        'dateModified': modified_date(post),
        'author': person_ref(),
        'publisher': person_ref(),
        'isPartOf': part_of[0] if len(part_of) == 1 else part_of,
        'inLanguage': LANG,
    }
    if post.get('category'):
        node['articleSection'] = post['category']
    if post.get('words'):
        node['wordCount'] = post['words']
    if post.get('readMinutes'):
        node['timeRequired'] = f'PT{post["readMinutes"]}M'
    node['keywords'] = list(post.get('tags', [])) if keywords is None else keywords
    return node


def _scalar(value):
    # "<" is written as < so no string can close the <script> element
    # it sits in ("</script") or open an HTML comment ("<!--"); JSON
    # readers decode it back to "<".
    return json.dumps(value, ensure_ascii=False).replace('<', '\\u003c')


def _is_scalar(value):
    return not isinstance(value, (dict, list))


def render_json(value, level=0):
    """JSON in the house layout, two spaces a level (indent_block turns
    that into the file's own step): objects one key a line, except a lone
    {"@id": ...} reference, which reads better inline; lists of plain
    values on one line, as the keyword lists always were."""
    pad = '  ' * (level + 1)
    if isinstance(value, dict):
        if len(value) == 1 and all(_is_scalar(v) for v in value.values()):
            (key, item), = value.items()
            return '{ %s: %s }' % (_scalar(key), _scalar(item))
        rows = [f'{pad}{_scalar(k)}: {render_json(v, level + 1)}' for k, v in value.items()]
        return '{\n' + ',\n'.join(rows) + '\n' + '  ' * level + '}'
    if isinstance(value, list):
        if all(_is_scalar(v) for v in value):
            return '[' + ', '.join(_scalar(v) for v in value) + ']'
        rows = [pad + render_json(v, level + 1) for v in value]
        return '[\n' + ',\n'.join(rows) + '\n' + '  ' * level + ']'
    return _scalar(value)


def indent_block(text, base, step):
    """Re-indent a block written with two-space nesting to a file that uses
    `base` for its head lines and `step` per nesting level."""
    out = []
    for line in text.split('\n'):
        stripped = line.lstrip(' ')
        levels = (len(line) - len(stripped)) // 2
        out.append(base + step * levels + stripped if stripped else '')
    return '\n'.join(out)


def ld_block(node, base='  ', step='  '):
    """A complete <script type="application/ld+json"> element."""
    return indent_block(
        '<script type="application/ld+json">\n' + render_json(node) + '\n</script>',
        base, step)


def breadcrumb_node(post):
    crumbs = [('Home', f'{SITE}/'), ('Blog', f'{SITE}/blog.html'),
              (post['title'], public_url(post))]
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
            {'@type': 'ListItem', 'position': i, 'name': name, 'item': item}
            for i, (name, item) in enumerate(crumbs, 1)
        ],
    }


# --------------------------------------------------------------------------
# rendering a new post's head
# --------------------------------------------------------------------------

def og_lines(post):
    """The Open Graph lines, in order, for a post (also the order --fix
    inserts missing ones in)."""
    width, height = OG_CARD_SIZE
    title = esc(post['title'])
    lines = [
        f'<meta property="og:image" content="{og_image(post)}">',
        f'<meta property="og:image:width" content="{width}">',
        f'<meta property="og:image:height" content="{height}">',
        f'<meta property="og:image:alt" content="{title}">',
        f'<meta property="og:url" content="{public_url(post)}">',
        '<meta property="og:type" content="article">',
        f'<meta property="og:site_name" content="{AUTHOR_NAME}">',
        f'<meta property="og:locale" content="{OG_LOCALE}">',
        f'<meta property="article:published_time" content="{post["date"]}">',
    ]
    if post.get('updated'):
        lines.append(f'<meta property="article:modified_time" content="{post["updated"]}">')
    return lines


def render_head(post):
    """The canonical head for a NEW post. Title, description and keywords
    are starting points that posts routinely hand-trim; the preload href is
    the hero posts.json names, which the opener will paint. The page's
    <html> tag takes lang="en-GB"."""
    url = public_url(post)
    title = esc(post['title'])
    desc = esc(post.get('excerpt', ''))
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
        *(f'  {line}' for line in og_lines(post)),
        '  <meta name="twitter:card" content="summary_large_image">',
        f'  <meta name="twitter:title" content="{title}">',
        f'  <meta name="twitter:description" content="{desc}">',
        f'  <meta name="twitter:image" content="{og_image(post)}">',
        f'  <meta name="citation_title" content="{title}">',
        '  <meta name="citation_author" content="Reid, Kenneth N.">',
        f'  <meta name="citation_publication_date" content="{slash_date}">',
        f'  <meta name="citation_online_date" content="{slash_date}">',
        f'  <meta name="citation_public_url" content="{url}">',
        f'  <meta name="DC.title" content="{title}">',
        '  <meta name="DC.creator" content="Kenneth N. Reid">',
        f'  <meta name="DC.date" content="{post["date"]}">',
        f'  {ANALYTICS_LINE}',
        f'  {ICON_LINE}',
        f'  {APPLE_LINE}',
        f'  {THEME_COLOR_LINE}',
        f'  {MANIFEST_LINE}',
        f'  <link rel="preload" as="image" href="{preload_image(post)}" fetchpriority="high">',
        f'  <link rel="stylesheet" href="../style.min.css{ASSET_QUERY}">',
        f'  <link rel="canonical" href="{url}">',
        ld_block(blogposting(post)),
        ld_block(breadcrumb_node(post)),
        f'  <script defer src="../js/theme.js{ASSET_QUERY}"></script>',
        f'  <script defer src="../js/palette.js{ASSET_QUERY}"></script>',
        '</head>',
    ]
    return '\n'.join(lines)


# --------------------------------------------------------------------------
# reading posts back
# --------------------------------------------------------------------------

def read_preserving_newlines(path):
    """Read without translating line endings, and report which the file
    uses, so a rewrite does not turn a three-line change into a whole-file
    diff."""
    with open(path, encoding='utf-8', newline='') as fh:
        raw = fh.read()
    crlf = raw.count('\r\n')
    lf = raw.count('\n') - crlf
    return raw, ('\r\n' if crlf and not lf else '\n')


def to_newline(text, newline):
    normalised = text.replace('\r\n', '\n')
    return normalised if newline == '\n' else normalised.replace('\n', '\r\n')


HEAD_RE = re.compile(r'(<head\b[^>]*>)(.*?)(</head>)', re.S | re.I)
# A JSON-LD element from the start of its first line to the end of its
# last: group 1 is its indent, group 2 the JSON (with its own newlines).
LD_BLOCK_RE = re.compile(
    r'^([ \t]*)<script type="application/ld\+json">(.*?)</script>[ \t]*$', re.M | re.S)


def head_of(content):
    match = HEAD_RE.search(content)
    return match.group(2) if match else ''


def is_redirect(content):
    return 'http-equiv="refresh"' in content or 'http-equiv=refresh' in content


def attr(head, kind, name):
    pattern = r'<meta %s="%s" content="([^"]*)"' % (kind, re.escape(name))
    match = re.search(pattern, head)
    return match.group(1) if match else None


def link_href(head, rel):
    match = re.search(r'<link rel="%s"[^>]*href="([^"]*)"' % re.escape(rel), head)
    return match.group(1) if match else None


def ld_blocks(head):
    """(match, parsed JSON or None) for each JSON-LD block in `head`."""
    found = []
    for match in LD_BLOCK_RE.finditer(head):
        try:
            data = json.loads(match.group(2))
        except json.JSONDecodeError:
            data = None
        found.append((match, data))
    return found


def ld_block_of_type(head, type_name):
    return next(((m, d) for m, d in ld_blocks(head)
                 if isinstance(d, dict) and d.get('@type') == type_name), (None, None))


def ld_step(head):
    """The step this file's JSON-LD nests by: the indent of a block's first
    key minus the indent of its opening brace. Measured on the
    BreadcrumbList first (in most posts an earlier --fix wrote it, so it is
    regular), then on any block; two spaces when every block is flat."""
    blocks = ld_blocks(head)
    blocks.sort(key=lambda b: not (isinstance(b[1], dict)
                                   and b[1].get('@type') == 'BreadcrumbList'))
    for match, _data in blocks:
        body = match.group(2).lstrip('\r\n')
        brace = re.match(r'([ \t]*)\{[ \t]*$', body, re.M)
        key = re.search(r'^([ \t]*)"@context"', body, re.M)
        if brace and key and key.group(1).startswith(brace.group(1)):
            step = key.group(1)[len(brace.group(1)):]
            if step:
                return step
    return '  '


def opener_hero(content):
    """Site-absolute URL of the photograph the post's opener paints, or
    None for a page without an opener (apply_post_opener.py writes it)."""
    match = re.search(r'--kr-opener-img:\s*url\(([^)]+)\)', content)
    return match.group(1).strip().strip('\'"') if match else None


def resolve_from_blog(href):
    """Site-absolute form of an href written in a page under blog/."""
    if href.startswith(('http://', 'https://', '/')):
        return href
    return posixpath.normpath(posixpath.join('/blog', href))


def href_from_blog(url):
    """The relative href a page under blog/ uses for site-absolute `url`."""
    if url.startswith(('http://', 'https://')):
        return url
    return posixpath.relpath(url, '/blog')


# --------------------------------------------------------------------------
# the rules --fix applies (each idempotent; --check runs them and compares)
# --------------------------------------------------------------------------

class Page:
    """One post's text, line endings normalised to \\n, with its <head>
    addressable on its own. Rules edit `head` or `text` and say whether
    they changed anything."""

    def __init__(self, text, post):
        self.text = text
        self.post = post

    @property
    def head(self):
        return head_of(self.text)

    @head.setter
    def head(self, value):
        match = HEAD_RE.search(self.text)
        self.text = self.text[:match.start(2)] + value + self.text[match.end(2):]


def _line_re(tag_re):
    """A whole line holding exactly one element: group 1 is its indent."""
    return re.compile(r'^([ \t]*)' + tag_re + r'[ \t]*$', re.M)


def _meta_re(kind, name):
    return _line_re(r'<meta %s="%s" content="[^"]*">' % (kind, re.escape(name)))


def upsert_line(head, line_re, line, anchors):
    """Make `line` present: rewrite the line `line_re` matches if its text
    differs, else insert it after the first anchor (a compiled line regex)
    found, at that anchor's indentation. Returns the new head, or the same
    head when there was no anchor to insert after."""
    match = line_re.search(head)
    if match:
        if match.group(0).strip() == line:
            return head
        return head[:match.start()] + match.group(1) + line + head[match.end():]
    for anchor in anchors:
        found = anchor.search(head)
        if found:
            return head[:found.end()] + '\n' + found.group(1) + line + head[found.end():]
    return head


def remove_line(head, line_re):
    match = line_re.search(head)
    if not match:
        return head
    end = match.end() + 1 if head[match.end():match.end() + 1] == '\n' else match.end()
    return head[:match.start()] + head[end:]


def rule_lang(page):
    """lang="en-GB" on <html>."""
    match = re.search(r'<html\b[^>]*>', page.text, re.I)
    if not match:
        return False
    tag = match.group(0)
    if re.search(r'\slang="[^"]*"', tag):
        new = re.sub(r'(\slang=)"[^"]*"', r'\1"%s"' % LANG, tag, count=1)
    else:
        new = tag[:-1] + f' lang="{LANG}">'
    if new == tag:
        return False
    page.text = page.text[:match.start()] + new + page.text[match.end():]
    return True


PRELOADER_RE = re.compile(
    r'^[ \t]*<div id="preloader"[^>]*>(?:<div class="loader"></div>)?</div>[ \t]*\n(?:[ \t]*\n)?',
    re.M)


def rule_preloader(page):
    """Drop the #preloader div (and the blank line that followed it)."""
    new = PRELOADER_RE.sub('', page.text)
    changed = new != page.text
    page.text = new
    return changed


# The retired snippet: the gtag.js loader, the inline config, and the
# comment some pages put above them.
GTAG_LINES = [
    _line_re(r'<!--\s*Google Analytics[^>]*-->'),
    _line_re(r'<script async src="https://www\.googletagmanager\.com/gtag/js\?id=[^"]*"></script>'),
    _line_re(r'<script>[^<]*\bgtag\([^<]*</script>'),
]
# Either attribute order counts as the loader; --fix writes ANALYTICS_LINE.
ANALYTICS_TAG = (r'<script (?:defer src="\.\./js/analytics\.js"'
                 r'|src="\.\./js/analytics\.js" defer)></script>')
ANALYTICS_RE = _line_re(ANALYTICS_TAG)


def rule_analytics(page):
    """The inline gtag snippet out, one deferred js/analytics.js in, on the
    line where the snippet started (after DC.date in a head that had
    neither)."""
    head = page.head
    starts = [m.start() for m in (r.search(head) for r in GTAG_LINES) if m]
    if not starts:
        if ANALYTICS_RE.search(head):
            return False
        new = upsert_line(head, ANALYTICS_RE, ANALYTICS_LINE, [
            _meta_re('name', 'DC.date'), _line_re(r'<meta name="description" content="[^"]*">')])
        page.head = new
        return new != head
    # Every removed line starts at or after `first`, so removing them
    # leaves the text before it, and the offset, as they were.
    first = min(starts)
    indent = re.match(r'[ \t]*', head[first:]).group(0)
    new = head
    for line_re in GTAG_LINES:
        while line_re.search(new):
            new = remove_line(new, line_re)
    if not ANALYTICS_RE.search(new):
        new = new[:first] + indent + ANALYTICS_LINE + '\n' + new[first:]
    page.head = new
    return True


# A post's stylesheet or first-party script tag with no query string: the
# attribute up to the path, the site-relative path, the closing quote.
ASSET_TAG_RE = re.compile(
    r'(<(?:script\b[^>]*?\ssrc|link\b[^>]*?\shref)="\.\./)'
    r'(style\.min\.css|js/[\w./-]+\.js)(")')


def rule_asset_query(page):
    """ASSET_QUERY on every stylesheet and first-party script tag that has
    no query, head and body alike. A post copied from a draft or an old
    post brings unversioned tags, and those are the URLs the pre-kr-v11
    worker holds stale."""
    def stamp(match):
        path = match.group(2)
        if path in UNVERSIONED_ASSETS or path.startswith('js/vendor/'):
            return match.group(0)
        return match.group(1) + path + ASSET_QUERY + match.group(3)
    new = ASSET_TAG_RE.sub(stamp, page.text)
    changed = new != page.text
    page.text = new
    return changed


def rule_open_graph(page):
    """og:image/twitter:image on the share card, its size and alt, the site
    name and locale, and the article dates, each after the line it follows
    in render_head."""
    post, head = page.post, page.head
    before = head
    lines = og_lines(post)
    anchors = [_meta_re('property', 'og:description'), _meta_re('property', 'og:title')]
    for line in lines:
        name = re.search(r'property="([^"]+)"', line).group(1)
        line_re = _meta_re('property', name)
        head = upsert_line(head, line_re, line, anchors)
        anchors = [line_re] + anchors
    if not post.get('updated'):
        head = remove_line(head, _meta_re('property', 'article:modified_time'))
    head = upsert_line(head, _meta_re('name', 'twitter:image'),
                       f'<meta name="twitter:image" content="{og_image(post)}">',
                       [_meta_re('name', 'twitter:description'), _meta_re('name', 'twitter:title')])
    page.head = head
    return head != before


PRELOAD_RE = _line_re(r'<link rel="preload" as="image"[^>]*>')


def rule_preload(page):
    """The hero preload names the opener's photograph and asks for it at
    high priority. A post without an opener keeps whatever it preloads."""
    head = page.head
    match = PRELOAD_RE.search(head)
    href = None
    if match:
        found = re.search(r'\shref="([^"]*)"', match.group(0))
        href = found.group(1) if found else None
    hero = opener_hero(page.text)
    if hero and (href is None or resolve_from_blog(href) != hero):
        href = href_from_blog(hero)
    if href is None:
        return False
    line = f'<link rel="preload" as="image" href="{href}" fetchpriority="high">'
    new = upsert_line(head, PRELOAD_RE, line, [_line_re(r'<link rel="manifest"[^>]*>'),
                                               _line_re(r'<link rel="icon"[^>]*>')])
    page.head = new
    return new != head


def _own_value(data, key, fallback):
    value = data.get(key) if isinstance(data, dict) else None
    return value if value else fallback


def rule_blogposting(page):
    """Rebuild the BlogPosting block in place (or add one after the
    canonical link), keeping the post's own description and keywords."""
    post, head = page.post, page.head
    match, data = ld_block_of_type(head, 'BlogPosting')
    meta_desc = attr(head, 'name', 'description')
    description = _own_value(data, 'description',
                             html.unescape(meta_desc) if meta_desc else post.get('excerpt', ''))
    keywords = _own_value(data, 'keywords', list(post.get('tags', [])))
    node = blogposting(post, description, keywords)
    step = ld_step(head)
    if match:
        new = head[:match.start()] + ld_block(node, match.group(1), step) + head[match.end():]
    elif re.search(r'"@type":\s*"BlogPosting"', head):
        # There is one, but it is not valid JSON: adding a second would
        # hide that. head_findings reports it for a person to repair.
        return False
    else:
        canonical = _line_re(r'<link rel="canonical"[^>]*>').search(head)
        if not canonical:
            return False
        new = (head[:canonical.end()] + '\n'
               + ld_block(node, canonical.group(1), step) + head[canonical.end():])
    page.head = new
    return new != head


def rule_breadcrumb(page):
    """A BreadcrumbList after the BlogPosting block, when there is none."""
    head = page.head
    if ld_block_of_type(head, 'BreadcrumbList')[0]:
        return False
    match, _data = ld_block_of_type(head, 'BlogPosting')
    if not match:
        return False
    block = ld_block(breadcrumb_node(page.post), match.group(1), ld_step(head))
    page.head = head[:match.end()] + '\n' + block + head[match.end():]
    return True


def rule_missing_links(page):
    """keywords, apple-touch-icon and manifest when missing; never rewritten,
    since their values are hand-written or fixed."""
    post, head = page.post, page.head
    before = head
    if not re.search(r'<meta name="keywords" content=', head):
        keywords = esc(', '.join(post.get('tags', [])))
        head = upsert_line(head, _meta_re('name', 'keywords'),
                           f'<meta name="keywords" content="{keywords}">',
                           [_line_re(r'<meta name="description" content="[^"]*">')])
    if not re.search(r'<link rel="apple-touch-icon"', head):
        head = upsert_line(head, _line_re(r'<link rel="apple-touch-icon"[^>]*>'), APPLE_LINE,
                           [_line_re(r'<link rel="icon" href="[^"]*">')])
    if not re.search(r'<link rel="manifest"', head):
        head = upsert_line(head, _line_re(r'<link rel="manifest"[^>]*>'), MANIFEST_LINE,
                           [_meta_re('name', 'theme-color')])
    page.head = head
    return head != before


# Order matters only where one rule anchors on another's output: the
# breadcrumb goes after the BlogPosting block, and reads its nesting step.
POST_RULES = [
    ('lang', rule_lang),
    ('preloader', rule_preloader),
    ('analytics', rule_analytics),
    ('asset-query', rule_asset_query),
    ('open-graph', rule_open_graph),
    ('preload', rule_preload),
    ('keywords/icons/manifest', rule_missing_links),
    ('jsonld-BlogPosting', rule_blogposting),
    ('jsonld-BreadcrumbList', rule_breadcrumb),
]
# A redirect stub (a moved post) is a page with no template to speak of.
REDIRECT_RULES = [('lang', rule_lang)]


def canonicalise(text, post, rules=None):
    """(text with every rule applied, names of the rules that changed it).
    `text` uses \\n line endings."""
    page = Page(text, post)
    if not HEAD_RE.search(text):
        return text, []
    changed = [name for name, rule in (POST_RULES if rules is None else rules) if rule(page)]
    return page.text, changed


# --------------------------------------------------------------------------
# what only a person can fix
# --------------------------------------------------------------------------

# Elements every post carries. Presence only: the values are hand-written,
# or checked separately below. After --fix, anything still missing here
# has no anchor to be inserted after, or no value a script can supply.
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
    ('og:image:width', r'<meta property="og:image:width" content='),
    ('og:image:height', r'<meta property="og:image:height" content='),
    ('og:image:alt', r'<meta property="og:image:alt" content='),
    ('og:url', r'<meta property="og:url" content='),
    ('og:type', r'<meta property="og:type" content="article">'),
    ('og:site_name', r'<meta property="og:site_name" content='),
    ('og:locale', r'<meta property="og:locale" content='),
    ('article:published_time', r'<meta property="article:published_time" content='),
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
    ('analytics', ANALYTICS_TAG),
    ('icon', r'<link rel="icon"'),
    ('apple-touch-icon', r'<link rel="apple-touch-icon"'),
    ('theme-color', r'<meta name="theme-color" content='),
    ('manifest', r'<link rel="manifest"'),
    ('hero-preload', r'<link rel="preload" as="image" href="[^"]+" fetchpriority="high">'),
    ('stylesheet', r'<link rel="stylesheet" href="\.\./style\.min\.css' + ASSET_QUERY_RE + '">'),
    ('canonical', r'<link rel="canonical" href='),
    ('jsonld-BlogPosting', r'"@type":\s*"BlogPosting"'),
    ('jsonld-BreadcrumbList', r'"@type":\s*"BreadcrumbList"'),
    ('theme.js', r'<script defer src="\.\./js/theme\.js' + ASSET_QUERY_RE + '"></script>'),
    ('palette.js', r'<script defer src="\.\./js/palette\.js' + ASSET_QUERY_RE + '"></script>'),
]


def derivable_values(head, post):
    """Values posts.json fully determines, and which every published post
    already agrees on. Anything hand-trimmed per post is absent by design."""
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
        'breadcrumb-url': (breadcrumb_leaf.group(1) if breadcrumb_leaf else None, url),
    }


def is_iso_date(value):
    """A real calendar date written YYYY-MM-DD (2026-02-30 is not)."""
    try:
        return (isinstance(value, str) and len(value) == 10
                and datetime.date.fromisoformat(value).isoformat() == value)
    except ValueError:
        return False


def post_findings(post):
    """Problems in posts.json's own entry that the head would repeat."""
    findings = []
    updated = post.get('updated')
    if updated is not None:
        if not is_iso_date(updated):
            findings.append(('updated', f'{updated!r} is not a YYYY-MM-DD date'))
        elif updated < post['date']:
            findings.append(('updated', f'{updated} is before the publication date {post["date"]}'))
    if not (ROOT / 'img' / 'og' / f'{slug_of(post)}.jpg').is_file():
        findings.append(('og:image', f'img/og/{slug_of(post)}.jpg does not exist '
                                     '(run generate_og_images.py)'))
    for entry in sitelib.series_list(post):
        page = sitelib.series_page(entry.get('name', ''))
        if not (ROOT / page).is_file():
            findings.append(('isPartOf', f'series {entry.get("name")!r} has no page {page}'))
    return findings


def head_findings(head, post):
    """Every way this (already fixed) head still deviates from canonical,
    as (field, message) pairs."""
    findings = []
    for field, pattern in REQUIRED_PRESENT:
        if not re.search(pattern, head):
            findings.append((field, 'missing'))
    for _match, data in ld_blocks(head):
        if data is None:
            findings.append(('jsonld', 'a JSON-LD block is not valid JSON'))
    for field, (got, want) in derivable_values(head, post).items():
        # A missing element is already reported above; don't say it twice.
        if got is None or want is None:
            continue
        if got != want:
            findings.append((field, f'{got!r} should be {want!r}'))
    return findings


def homepage_ids(path=HOMEPAGE):
    """@ids the homepage defines: nodes with a type, not bare references."""
    ids = set()

    def walk(node):
        if isinstance(node, dict):
            if '@id' in node and '@type' in node:
                ids.add(node['@id'])
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)

    text = path.read_text(encoding='utf-8') if path.is_file() else ''
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', text, re.S):
        try:
            walk(json.loads(block))
        except json.JSONDecodeError:
            continue
    return ids


# --------------------------------------------------------------------------
# the corpus
# --------------------------------------------------------------------------

def corpus(posts):
    """(path, post) for every posts.json entry (path None when its file is
    missing; a post being published may not be tracked yet), then
    (path, None) for each tracked file in blog/ that no entry names: a
    redirect stub, or a mistake. Downloads and drafts are not posts
    (sitelib.tracked_posts)."""
    urls = set()
    for post in posts:
        urls.add(post['url'])
        path = ROOT / post['url']
        yield (path if path.is_file() else None), post
    for path in sitelib.tracked_posts():
        if path.relative_to(ROOT).as_posix() not in urls:
            yield path, None


def examine(path, post):
    """(new text or None, newline, rule names --fix would apply, findings)
    for one file. New text is None when nothing would change."""
    raw, newline = read_preserving_newlines(path)
    text = raw.replace('\r\n', '\n')
    if post is None:
        if not is_redirect(text):
            return None, newline, [], [('posts.json', 'no entry for this post and not a redirect')]
        new, changed = canonicalise(text, None, REDIRECT_RULES)
        return (new if changed else None), newline, changed, []
    new, changed = canonicalise(text, post)
    findings = head_findings(head_of(new), post) + post_findings(post)
    return (new if changed else None), newline, changed, findings


def run_check(posts):
    problems = []
    for path, post in corpus(posts):
        if path is None:
            problems.append((post['url'], [], [('file', 'missing')]))
            continue
        _new, _nl, changed, findings = examine(path, post)
        if changed or findings:
            problems.append((path.relative_to(ROOT).as_posix(), changed, findings))
    missing_ids = {PERSON_ID, WEBSITE_ID} - homepage_ids()
    if problems or missing_ids:
        if problems:
            print(f'post template has drifted in {len(problems)} file(s):')
        for rel, changed, findings in problems:
            print(f'  {rel}')
            if changed:
                print(f'      --fix would update: {", ".join(changed)}')
            for field, message in findings:
                print(f'      {field}: {message}')
        for missing in sorted(missing_ids):
            print(f'  index.html: no JSON-LD node with "@id": "{missing}", '
                  'which every post points at')
        if any(changed for _rel, changed, _f in problems):
            print('run: python .github/scripts/generate_post_head.py --fix')
        return 1
    print(f'post template is canonical in all {len(posts)} posts.')
    return 0


def run_fix(posts):
    fixed = 0
    unfixable = 0
    for path, post in corpus(posts):
        if path is None:
            continue
        new, newline, changed, findings = examine(path, post)
        rel = path.relative_to(ROOT).as_posix()
        if new is not None:
            with open(path, 'w', encoding='utf-8', newline='') as fh:
                fh.write(to_newline(new, newline))
            fixed += 1
            print(f'{rel}: {", ".join(changed)}')
        for field, message in findings:
            unfixable += 1
            print(f'{rel}: needs a person: {field}: {message}')
    print(f'\nUpdated {fixed} file(s).' if fixed else 'Nothing to update.')
    return 1 if unfixable else 0


def main(argv=None):
    parser = sitelib.arg_parser(__doc__)
    parser.add_argument('slug', nargs='?',
                        help="print this post's canonical head (a slug, or blog/<slug>.html)")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--all', action='store_true', help="print every post's head")
    mode.add_argument('--check', action='store_true',
                      help='exit 1 if any post has drifted from the template; write nothing')
    mode.add_argument('--fix', action='store_true',
                      help='bring every post to the template in place (idempotent)')
    args = parser.parse_args(argv)
    if bool(args.slug) == (args.all or args.check or args.fix):
        parser.error('give one slug, or one of --all, --check, --fix')
    posts = load_posts()

    if args.check:
        return run_check(posts)
    if args.fix:
        return run_fix(posts)
    if args.all:
        for post in posts:
            print(f'<!-- {post["url"]} -->')
            print(render_head(post))
            print()
        return 0

    wanted = args.slug.removesuffix('.html').rsplit('/', 1)[-1]
    for post in posts:
        if slug_of(post) == wanted:
            print(render_head(post))
            return 0
    print(f'no post with slug {wanted!r} in data/posts.json')
    return 1


if __name__ == '__main__':
    sys.exit(main())
