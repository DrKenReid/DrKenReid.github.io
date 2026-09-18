"""
Give every blog post the editorial opener.

Replaces a post's breadcrumb banner (a 300px strip with a centred title)
with a full-bleed opener: the hero photograph, breadcrumbs, a kicker of
category / date / read time, the title set large in Lora, the excerpt as
a standfirst, and a photo credit when the hero is one of Ken's frames.
Everything but the photograph comes from data/posts.json, so the opener
cannot disagree with the listing.

Idempotent: a post that already has an opener is left alone.

    python .github/scripts/apply_post_opener.py            # all tracked posts
    python .github/scripts/apply_post_opener.py blog/x.html
    python .github/scripts/apply_post_opener.py --check    # CI: none missing
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
POSTS = ROOT / "data" / "posts.json"

BANNER_RE = re.compile(r"[ \t]*<section class=\"breadcrumb-area[\s\S]*?</section>\n?")
URL_RE = re.compile(r"url\(([^)]+)\)")
TITLE_RE = re.compile(r"class=\"page-title\">([^<]+)<")
MONTHS = ["January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December"]


def tracked_posts():
    out = subprocess.run(["git", "ls-files", "blog/*.html"], cwd=ROOT,
                         capture_output=True, text=True).stdout
    return [ROOT / p for p in out.splitlines() if p and (ROOT / p).exists()]


def nice_date(iso):
    y, m, d = iso.split("-")
    return "%d %s %s" % (int(d), MONTHS[int(m) - 1], y)


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build_opener(post, img, title):
    kicker = " &middot; ".join(x for x in [
        esc(post.get("category", "")),
        nice_date(post["date"]),
        "%d min read" % post["readMinutes"] if post.get("readMinutes") else "",
    ] if x)
    credit = ('      <p class="kr-opener__credit">Photograph &copy; Ken Reid</p>\n'
              if "img/photography/" in img else "")
    return (
        '  <header class="kr-opener" style="--kr-opener-img: url(%s);">\n'
        '    <div class="kr-opener__media" aria-hidden="true"></div>\n'
        '    <div class="kr-opener__scrim" aria-hidden="true"></div>\n'
        '    <div class="container kr-opener__inner">\n'
        '      <nav aria-label="breadcrumb" class="kr-opener__crumbs"><ol class="breadcrumb">\n'
        '        <li class="breadcrumb-item"><a href="../index.html"><i class="icon_house_alt"></i> Home</a></li>\n'
        '        <li class="breadcrumb-item"><a href="../blog.html">Blog</a></li>\n'
        '        <li class="breadcrumb-item active" aria-current="page">%s</li>\n'
        '      </ol></nav>\n'
        '      <p class="kr-opener__kicker">%s</p>\n'
        '      <p class="kr-opener__title page-title">%s</p>\n'
        '      <p class="kr-opener__standfirst">%s</p>\n'
        '%s'
        '    </div>\n'
        '    <a class="kr-opener__cue" href="#main-content-body" aria-label="Scroll to the article"><span></span></a>\n'
        '  </header>\n'
    ) % (img, title, kicker, title, esc(post.get("excerpt", "")), credit)


def absolute_img(url):
    """Site-absolute path for the hero.

    A relative url() inside a custom property is resolved by Chrome against
    the stylesheet that consumes the var(), not the page, so `img/x.webp`
    written from blog/ would be fetched from the site root and 404. The
    photography heroes only worked because `../img/...` from blog/ happens
    to land on the same path as `/img/...` from the root.
    """
    url = url.strip().strip("'\"")
    if url.startswith(("http://", "https://", "/")):
        return url
    if url.startswith("../"):
        return "/" + url[3:]
    return "/blog/" + url


IMG_PROP_RE = re.compile(r'--kr-opener-img: url\(([^)]+)\)')


def convert(path, by_url):
    text = path.read_text(encoding="utf-8")
    if 'class="kr-opener"' in text:
        fixed = IMG_PROP_RE.sub(lambda m: "--kr-opener-img: url(%s)" % absolute_img(m.group(1)), text)
        if fixed != text:
            path.write_text(fixed, encoding="utf-8", newline="")
            return "path fixed"
        return "already"
    m = BANNER_RE.search(text)
    if not m:
        return "no banner"
    rel = path.relative_to(ROOT).as_posix()
    post = by_url.get(rel)
    if not post:
        return "not in posts.json"
    banner = m.group(0)
    img_m = URL_RE.search(banner)
    title_m = TITLE_RE.search(banner)
    if not img_m or not title_m:
        return "banner unparsed"
    opener = build_opener(post, absolute_img(img_m.group(1)), title_m.group(1).strip())
    text = text[:m.start()] + opener + text[m.end():]
    # the scroll cue's target: the first content block after the opener
    text = re.sub(r'(<div class="about-us-area[^"]*")(?![^>]*\bid=)', r'\1 id="main-content-body"',
                  text, count=1)
    path.write_text(text, encoding="utf-8", newline="")
    return "converted"


def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    check_only = "--check" in argv
    targets = [ROOT / a for a in argv if not a.startswith("--")] or tracked_posts()
    posts = json.loads(POSTS.read_text(encoding="utf-8"))
    by_url = {p["url"]: p for p in posts}

    if check_only:
        missing = []
        for p in targets:
            t = p.read_text(encoding="utf-8")
            if 'class="kr-opener"' not in t and BANNER_RE.search(t) and \
                    p.relative_to(ROOT).as_posix() in by_url:
                missing.append(p.relative_to(ROOT).as_posix())
        if missing:
            print("%d post(s) still carry the old banner:" % len(missing))
            for m in missing:
                print("  " + m)
            print("run: python .github/scripts/apply_post_opener.py")
            return 1
        print("every post has the opener.")
        return 0

    tally = {}
    for p in targets:
        r = convert(p, by_url)
        tally[r] = tally.get(r, 0) + 1
        if r not in ("converted", "already"):
            print("  %-16s %s" % (r, p.relative_to(ROOT).as_posix()))
    for k, v in sorted(tally.items()):
        print("%-16s %d" % (k, v))
    return 0


if __name__ == "__main__":
    sys.exit(main())
