"""
Give every blog post the editorial opener.

Replaces a post's breadcrumb banner (a 300px strip with a centred title)
with a full-bleed opener: the hero photograph, breadcrumbs, a kicker of
category / date / read time, the title set large in Lora, the excerpt as
a standfirst, and a photo credit when the hero is one of Ken's frames.
Everything but the photograph comes from data/posts.json, so the opener
cannot disagree with the listing.

Idempotent: a post whose opener already says what posts.json says is
left alone; one that has drifted (a date or read time changed) is
rebuilt.

Drafts (blog/drafts/, not in posts.json) get the same opener from their
own head, so a preview looks like the published page: title from the
banner, date from citation_publication_date, category from the first
keyword (mapped the way posts.json maps tags), standfirst from the meta
description, read time from sitelib.read_minutes (220 wpm, rounded up
as posts.json's readMinutes is, so a draft's "4 min" does not publish
as 5). At publish the opener is rebuilt from posts.json, so nothing a
draft guessed survives.

    python .github/scripts/apply_post_opener.py            # all tracked posts
    python .github/scripts/apply_post_opener.py blog/x.html
    python .github/scripts/apply_post_opener.py --drafts   # every draft
    python .github/scripts/apply_post_opener.py --check    # CI: none missing or stale

A title longer than LONG_TITLE characters also gets kr-opener--long,
which sets it a step smaller (style.css §06, "Long titles"). The
kicker's date is a <time datetime="YYYY-MM-DD"> so it is machine
readable where it is shown, not only in the head's metadata.
"""
import html
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402
from generate_read_times import count_words  # noqa: E402

ROOT = sitelib.ROOT
POSTS = sitelib.POSTS_JSON
DRAFTS = ROOT / "blog" / "drafts"

BANNER_RE = re.compile(r"[ \t]*<section class=\"breadcrumb-area[\s\S]*?</section>\n?")
URL_RE = re.compile(r"url\(([^)]+)\)")
TITLE_RE = re.compile(r"class=\"(?:[^\"]* )?page-title\">([^<]+)<")
MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]

# Characters of title (as read, entities decoded) beyond which the opener
# sets it a step smaller. About fifteen characters fit a line of the
# title's 14ch measure, so 60 is four lines at full size; the titles well
# past it ran to five, six and seven lines and pushed the opener taller
# than a 1440x900 screen. The CSS side, with the numbers, is style.css §06
# Openers, "--- Long titles".
LONG_TITLE = 60


def tracked_posts():
    return sitelib.tracked("blog/*.html")


def nice_date(iso):
    y, m, d = iso.split("-")
    return "%d %s %s" % (int(d), MONTHS[int(m) - 1], y)


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build_opener(post, img, title, prefix="../"):
    kicker = " &middot; ".join(x for x in [
        esc(post.get("category", "")),
        '<time datetime="%s">%s</time>' % (post["date"], nice_date(post["date"])),
        "%d min read" % post["readMinutes"] if post.get("readMinutes") else "",
    ] if x)
    credit = ('      <p class="kr-opener__credit">Photograph &copy; Ken Reid</p>\n'
              if "img/photography/" in img else "")
    modifier = " kr-opener--long" if len(html.unescape(title)) > LONG_TITLE else ""
    return (
        '  <header class="kr-opener%s" style="--kr-opener-img: url(%s);">\n'
        '    <div class="kr-opener__media" aria-hidden="true"></div>\n'
        '    <div class="kr-opener__scrim" aria-hidden="true"></div>\n'
        '    <div class="container kr-opener__inner">\n'
        '      <nav aria-label="breadcrumb" class="kr-opener__crumbs"><ol class="breadcrumb">\n'
        '        <li class="breadcrumb-item"><a href="%sindex.html"><i class="icon_house_alt"></i> Home</a></li>\n'
        '        <li class="breadcrumb-item"><a href="%sblog.html">Blog</a></li>\n'
        '        <li class="breadcrumb-item active" aria-current="page">%s</li>\n'
        '      </ol></nav>\n'
        '      <p class="kr-opener__kicker">%s</p>\n'
        '      <p class="kr-opener__title page-title">%s</p>\n'
        '      <p class="kr-opener__standfirst">%s</p>\n'
        '%s'
        '    </div>\n'
        '    <a class="kr-opener__cue" href="#main-content-body" aria-label="Scroll to the article"><span></span></a>\n'
        '  </header>\n'
    ) % (modifier, img, prefix, prefix, title, kicker, title, esc(post.get("excerpt", "")), credit)


def absolute_img(url, page=None):
    """Site-absolute path for the hero.

    A relative url() inside a custom property is resolved by Chrome against
    the stylesheet that consumes the var(), not the page, so `img/x.webp`
    written from blog/ would be fetched from the site root and 404. The
    photography heroes only worked because `../img/...` from blog/ happens
    to land on the same path as `/img/...` from the root. Given the page,
    the path is resolved from where that page lives (a draft sits two
    folders deeper than the post it will become).
    """
    url = url.strip().strip("'\"")
    if url.startswith(("http://", "https://", "/")):
        return url
    if page is not None:
        target = (page.parent / url).resolve()
        try:
            return "/" + target.relative_to(ROOT).as_posix()
        except ValueError:
            pass
    if url.startswith("../"):
        return "/" + url[3:]
    return "/blog/" + url


IMG_PROP_RE = re.compile(r'--kr-opener-img: url\(([^)]+)\)')
# The opener's own class list: "kr-opener" alone or with its modifiers.
OPENER_RE = re.compile(r"[ \t]*<header class=\"kr-opener(?: [^\"]*)?\"[\s\S]*?</header>\n?")
HAS_OPENER_RE = re.compile(r"<header class=\"kr-opener(?: [^\"]*)?\"")
CRUMB_PREFIX_RE = re.compile(r'href="((?:\.\./)+)index\.html"')
META_RE = {
    "description": re.compile(r'<meta name="description" content="([^"]*)"'),
    "keywords": re.compile(r'<meta name="keywords" content="([^"]*)"'),
    "date": re.compile(r'<meta name="citation_publication_date" content="(\d{4})/(\d{2})/(\d{2})"'),
}


def tag_categories(posts):
    """How posts.json maps a first tag to a category, for drafts."""
    out = {}
    for p in posts:
        tags = p.get("tags") or []
        if tags and p.get("category") and tags[0] not in out:
            out[tags[0]] = p["category"]
    return out


def draft_post(path, text, categories):
    """A posts.json-shaped entry built from a draft's own head."""
    desc = META_RE["description"].search(text)
    kw = META_RE["keywords"].search(text)
    date = META_RE["date"].search(text)
    if not date:
        return None
    first_tag = (kw.group(1).split(",")[0].strip().lower() if kw else "")
    words = count_words(path)
    return {
        "date": "%s-%s-%s" % date.groups(),
        "category": categories.get(first_tag, first_tag.title() if first_tag else ""),
        "excerpt": html.unescape(desc.group(1)) if desc else "",
        "readMinutes": sitelib.read_minutes(words) if words else 0,
    }


def wanted_opener(path, text, by_url, categories):
    """The opener this file should carry, or (None, reason)."""
    rel = path.relative_to(ROOT).as_posix()
    post = by_url.get(rel)
    is_draft = DRAFTS in path.parents
    if not post:
        if not is_draft:
            return None, "not in posts.json"
        post = draft_post(path, text, categories)
        if not post:
            return None, "draft without a date"
    block = OPENER_RE.search(text) or BANNER_RE.search(text)
    if not block:
        return None, "no banner"
    src = block.group(0)
    img_m = URL_RE.search(src)
    title_m = TITLE_RE.search(src)
    if not img_m or not title_m:
        return None, "banner unparsed"
    prefix_m = CRUMB_PREFIX_RE.search(src)
    prefix = prefix_m.group(1) if prefix_m else "../"
    return build_opener(post, absolute_img(img_m.group(1), path), title_m.group(1).strip(), prefix), block


def convert(path, by_url, categories, write=True):
    text = path.read_text(encoding="utf-8")
    opener, block = wanted_opener(path, text, by_url, categories)
    if opener is None:
        return block
    had = bool(HAS_OPENER_RE.search(text))
    if had and block.group(0) == opener:
        return "already"
    new = text[:block.start()] + opener + text[block.end():]
    # the scroll cue's target: the first content block after the opener
    new = re.sub(r'(<div class="about-us-area[^"]*")(?![^>]*\bid=)', r'\1 id="main-content-body"',
                 new, count=1)
    if write:
        path.write_text(new, encoding="utf-8", newline="")
    return "refreshed" if had else "converted"


def draft_files():
    return sorted(p for p in DRAFTS.rglob("*.html") if p.is_file())


def main(argv=None):
    parser = sitelib.arg_parser(__doc__)
    parser.add_argument("paths", nargs="*", metavar="blog/x.html",
                        help="posts or drafts to convert (default: every tracked post)")
    parser.add_argument("--check", action="store_true",
                        help="exit 1 if a post lacks the opener or it disagrees with posts.json; write nothing")
    parser.add_argument("--drafts", action="store_true",
                        help="also convert every draft under blog/drafts/")
    args = parser.parse_args(argv)
    check_only = args.check
    targets = [ROOT / a for a in args.paths]
    if args.drafts:
        targets += draft_files()
    targets = targets or tracked_posts()
    posts = sitelib.load_posts(POSTS)
    by_url = {p["url"]: p for p in posts}
    categories = tag_categories(posts)

    if check_only:
        missing, stale = [], []
        for p in targets:
            rel = p.relative_to(ROOT).as_posix()
            if rel not in by_url:
                continue
            t = p.read_text(encoding="utf-8")
            if not HAS_OPENER_RE.search(t) and BANNER_RE.search(t):
                missing.append(rel)
            elif convert(p, by_url, categories, write=False) == "refreshed":
                stale.append(rel)
        if missing or stale:
            if missing:
                print("%d post(s) still carry the old banner:" % len(missing))
                for m in missing:
                    print("  " + m)
            if stale:
                print("%d opener(s) no longer say what posts.json says:" % len(stale))
                for m in stale:
                    print("  " + m)
            print("run: python .github/scripts/apply_post_opener.py")
            return 1
        print("every post has the opener, and it agrees with posts.json.")
        return 0

    tally = {}
    for p in targets:
        r = convert(p, by_url, categories)
        tally[r] = tally.get(r, 0) + 1
        if r not in ("converted", "already", "refreshed"):
            print("  %-16s %s" % (r, p.relative_to(ROOT).as_posix()))
    for k, v in sorted(tally.items()):
        print("%-16s %d" % (k, v))
    return 0


if __name__ == "__main__":
    sys.exit(main())
