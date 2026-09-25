#!/usr/bin/env python3
"""Render the site's share images, in the site's own design.

Every blog post gets img/og/<slug>.jpg (1200x630): the post's opener
photograph under a dark scrim, the kicker (category, date, read time), the
title in Lora, the brand rule, and the site's name. The post's og:image,
twitter:image and JSON-LD image are pointed at it.

The top-level pages in PAGES get img/og/page-<name>.jpg in the same design,
with a kicker of their own. Those are rendered and checked here but pointed
at by hand in each page's head: this script never edits a top-level page.

The inputs that shape a card (title, kicker, hero path and size, the font
files, RENDERER) are hashed into img/og/manifest.json, so `--check` can tell
whether a card is stale without re-encoding JPEGs (which differ byte for
byte between Pillow builds). --check needs only the standard library, so
it runs in the audit job with nothing installed; rendering needs Pillow and
fontTools (.github/scripts/requirements.txt).

    python .github/scripts/generate_og_images.py            # render stale
    python .github/scripts/generate_og_images.py --force    # render all
    python .github/scripts/generate_og_images.py --check    # CI
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
from dataclasses import dataclass
from datetime import date
from functools import lru_cache
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402

ROOT = sitelib.ROOT
POSTS = sitelib.POSTS_JSON
OUT = ROOT / "img" / "og"
MANIFEST = OUT / "manifest.json"
SITE = sitelib.SITE
W, H = 1200, 630

# Bump when render() changes what a card looks like, so every card is
# re-rendered and --check fails until they are. 2: titles set at weight 600
# (Lora is a variable font; version 1 read the file at its default, 400).
RENDERER = 2

# Brand tokens (dark theme values: the card is always dark).
INK = (255, 255, 255)
STONE = (168, 160, 153)          # --kr-eyebrow, dark
BRAND_FROM = (255, 150, 150)     # --kr-brand-from, dark
BRAND_TO = (255, 232, 158)       # --kr-brand-to, dark
BASE = (14, 14, 14)

FONTS = ROOT / "fonts" / "vendor"
TITLE_FONT = ("lora-var.woff2", 600)      # the opener's title weight
LABEL_FONT = ("poppins-600.woff2", None)  # static file, weight is baked in

KICKER_SEP = "  ·  "

# Top-level pages: title, kicker parts, hero. Titles are the pages' own
# headings; kickers are taken from each page's meta description; heroes are
# the page's banner photograph (the homepage uses its hero). A page uses its
# card by pointing og:image and twitter:image at
# {SITE}/img/og/page-<name>.jpg (1200x630).
PAGES: dict[str, tuple[str, tuple[str, ...], str]] = {
    "index": ("Ken Reid", ("Data scientist", "Photographer", "Writer"),
              "img/bg-img/ken-hero.webp"),
    "about": ("About Me", ("Pets", "Music", "Cooking", "Homelab"),
              "img/photography/hero/203.webp"),
    "blog": ("Blog", ("Data science", "Photography", "Books"),
             "img/photography/hero/97.webp"),
    "data_science": ("Data Science", ("Publications", "Projects", "Thesis"),
                     "img/photography/hero/16.webp"),
    "gallery": ("Photography", ("Landscape", "Urban", "Wildlife", "Abandoned"),
                "img/photography/hero/108.webp"),
    "literature": ("Literature", ("Reading now", "The shelf", "Reviews"),
                   "img/photography/hero/207.webp"),
    "books": ("Every Book", ("Every book rated on Goodreads",),
              "img/photography/hero/230.webp"),
    "music": ("Music", ("Last.fm", "Playlists", "Fingerstyle guitar"),
              "img/photography/hero/13.webp"),
    "map": ("Photo Map", ("Where the photographs were taken",),
            "img/photography/hero/100.webp"),
    "quotes": ("Quote Wall", ("Every quote saved while reading",),
               "img/photography/hero/13.webp"),
    "series": ("Series", ("Every blog series in one place",),
               "img/photography/hero/290.webp"),
    "colophon": ("Colophon", ("How the site is built", "What it weighs"),
                 "img/photography/hero/141.webp"),
    "contact": ("Contact", ("Email", "Social media"),
                "img/photography/hero/117.webp"),
}


@dataclass(frozen=True)
class Card:
    """One share image: where it goes and everything drawn on it."""
    key: str                 # manifest key, and the file name without .jpg
    title: str
    kicker: str
    hero: Path | None
    post_path: Path | None = None   # set for posts, which get repointed

    @property
    def out(self) -> Path:
        return OUT / f"{self.key}.jpg"


# ---- inputs ---------------------------------------------------------------

def hero_of(post_html: str) -> str | None:
    m = re.search(r"--kr-opener-img:\s*url\(([^)]+)\)", post_html)
    if not m:
        return None
    return m.group(1).strip("'\"").lstrip("/")


def kicker_of(post: dict) -> str:
    d = date.fromisoformat(post["date"])
    parts = [post.get("category") or (post.get("tags") or ["Blog"])[0].title(),
             f"{d.day} {d.strftime('%B %Y')}"]
    if post.get("readMinutes"):
        parts.append(f"{post['readMinutes']} min read")
    return KICKER_SEP.join(parts)


def slug_of(post: dict) -> str:
    return Path(post["url"]).stem


def post_cards() -> list[Card]:
    posts = sitelib.load_posts(POSTS)
    posts = posts["posts"] if isinstance(posts, dict) else posts
    cards = []
    for post in posts:
        post_path = ROOT / post["url"]
        hero_rel = hero_of(post_path.read_text(encoding="utf-8"))
        cards.append(Card(key=slug_of(post), title=post["title"],
                          kicker=kicker_of(post),
                          hero=ROOT / hero_rel if hero_rel else None,
                          post_path=post_path))
    return cards


def page_cards() -> list[Card]:
    return [Card(key=f"page-{name}", title=title, kicker=KICKER_SEP.join(kicker),
                 hero=ROOT / hero)
            for name, (title, kicker, hero) in PAGES.items()]


def signature(card: Card) -> str:
    h = hashlib.sha1()
    h.update(card.title.encode())
    h.update(card.kicker.encode())
    if card.hero and card.hero.exists():
        # as_posix: the same signature from a Windows working copy and the
        # Linux runner, which would otherwise disagree on every separator.
        h.update(card.hero.relative_to(ROOT).as_posix().encode())
        h.update(str(card.hero.stat().st_size).encode())
    # A replaced font file changes every card without any code changing.
    for name, _ in (TITLE_FONT, LABEL_FONT):
        f = FONTS / name
        h.update(f"{name}:{f.stat().st_size if f.exists() else 0}".encode())
    h.update(f"renderer {RENDERER}".encode())
    return h.hexdigest()[:16]


# ---- drawing --------------------------------------------------------------

@lru_cache(maxsize=None)
def load_font(name: str, size: int, weight: int | None = None):
    """Pillow reads TTF/OTF; the site ships woff2, so decompress in memory.

    weight selects an instance of a variable font. Without it Pillow draws
    the font's default instance, which for Lora is 400: every card before
    RENDERER 2 set its title at 400 while the opener it copies uses 600.
    """
    from fontTools.ttLib import TTFont
    from PIL import ImageFont
    f = TTFont(FONTS / name)
    f.flavor = None
    buf = io.BytesIO()
    f.save(buf)
    buf.seek(0)
    font = ImageFont.truetype(buf, size)
    if weight is not None:
        font.set_variation_by_axes([weight])
    return font


def wrap(draw, text: str, font, max_w: int, max_lines: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    cur = ""
    for w in words:
        trial = (cur + " " + w).strip()
        if draw.textlength(trial, font=font) <= max_w or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    if len(lines) > max_lines:
        lines = lines[:max_lines]
        last = lines[-1]
        while draw.textlength(last + "…", font=font) > max_w and " " in last:
            last = last.rsplit(" ", 1)[0]
        lines[-1] = last + "…"
    return lines


def gradient_strip(size, c0, c1):
    """A horizontal gradient, built one row wide and stretched down."""
    from PIL import Image
    w, h = size
    row = Image.new("RGB", (w, 1))
    row.putdata([tuple(round(c0[i] + (c1[i] - c0[i]) * x / max(1, w - 1))
                       for i in range(3)) for x in range(w)])
    return row.resize((w, h), Image.NEAREST)


def gradient_text(size, text, font, c0, c1):
    """Text filled with a horizontal gradient: a gradient strip masked by
    the glyphs, the same trick as background-clip: text."""
    from PIL import Image, ImageDraw
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).text((0, 0), text, font=font, fill=255)
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.paste(gradient_strip(size, c0, c1), (0, 0), mask)
    return out


@lru_cache(maxsize=1)
def scrim():
    """The opener's scrim, bottom-heavy and stronger on the left where the
    type sits. The same for every card, so it is computed once."""
    from PIL import Image
    mask = Image.new("L", (W, H), 0)
    sp = mask.load()
    for y in range(H):
        vy = min(1.0, max(0.0, (y - H * 0.18) / (H * 0.82)))
        for x in range(W):
            vx = 1 - min(1.0, x / (W * 0.85))
            a = 0.30 + 0.62 * (vy ** 1.4) * (0.55 + 0.45 * vx) + 0.12 * vx
            sp[x, y] = round(255 * min(0.96, a))
    return mask


def render(card: Card) -> None:
    from PIL import Image, ImageDraw, ImageFilter

    canvas = Image.new("RGB", (W, H), BASE)
    hero = card.hero
    if hero and hero.exists():
        im = Image.open(hero).convert("RGB")
        scale = max(W / im.width, H / im.height)
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        im = im.crop(((im.width - W) // 2, (im.height - H) // 2, (im.width - W) // 2 + W, (im.height - H) // 2 + H))
        if im.width < 900:
            im = im.filter(ImageFilter.GaussianBlur(1.2))
        canvas.paste(im, (0, 0))

    canvas.paste(Image.new("RGB", (W, H), BASE), (0, 0), scrim())

    draw = ImageDraw.Draw(canvas)
    pad = 72
    kicker_font = load_font(LABEL_FONT[0], 22, LABEL_FONT[1])
    title_font = load_font(TITLE_FONT[0], 64, TITLE_FONT[1])
    site_font = load_font(LABEL_FONT[0], 26, LABEL_FONT[1])

    # Layout from the bottom up.
    y = H - pad
    # Site name, gradient, bottom left.
    name = "kenreid.co.uk"
    nw = int(draw.textlength(name, font=site_font)) + 4
    nh = site_font.size + 12
    mark = gradient_text((nw, nh), name, site_font, BRAND_FROM, BRAND_TO)
    canvas.paste(mark, (pad, y - nh + 4), mark)
    y -= nh + 26

    # Brand rule.
    canvas.paste(gradient_strip((72, 4), BRAND_FROM, BRAND_TO), (pad, y - 4))
    y -= 4 + 30

    # Title, up to three lines.
    lines = wrap(draw, card.title, title_font, W - pad * 2 - 40, 3)
    line_h = int(title_font.size * 1.18)
    y -= line_h * len(lines)
    ty = y
    for ln in lines:
        draw.text((pad, ty), ln, font=title_font, fill=INK)
        ty += line_h
    y -= 22

    # Kicker.
    draw.text((pad, y - kicker_font.size), card.kicker.upper(), font=kicker_font, fill=STONE)

    card.out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(card.out, "JPEG", quality=82, optimize=True, progressive=True)


def repoint(post_path: Path, slug: str) -> bool:
    html = post_path.read_text(encoding="utf-8")
    url = f"{SITE}/img/og/{slug}.jpg"
    new = re.sub(r'(<meta property="og:image" content=")[^"]*(")', rf"\g<1>{url}\g<2>", html)
    new = re.sub(r'(<meta name="twitter:image" content=")[^"]*(")', rf"\g<1>{url}\g<2>", new)
    new = re.sub(r'("image":\s*")[^"]*(")', rf"\g<1>{url}\g<2>", new, count=1)
    if new != html:
        post_path.write_text(new, encoding="utf-8")
        return True
    return False


# ---- entry point ----------------------------------------------------------

def parse_args(argv: list[str]) -> argparse.Namespace:
    ap = sitelib.arg_parser(
        "Render share images for every post and the top-level pages, and "
        "point each post's head at its card.",
        prog="generate_og_images.py")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true",
                      help="render nothing; exit 1 if a card is stale or "
                           "missing, or a post does not reference its card")
    mode.add_argument("--force", action="store_true",
                      help="render every card, stale or not")
    return ap.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    posts = post_cards()
    cards = posts + page_cards()
    stale: list[str] = []
    unpointed: list[str] = []
    fresh: dict[str, str] = {}

    for card in cards:
        sig = signature(card)
        fresh[card.key] = sig
        if args.force or manifest.get(card.key) != sig or not card.out.exists():
            stale.append(card.key)
        if card.post_path and f"/img/og/{card.key}.jpg" not in card.post_path.read_text(encoding="utf-8"):
            unpointed.append(card.key)
        if args.check:
            continue
        if card.key in stale:
            render(card)
            print(f"  rendered {card.out.relative_to(ROOT).as_posix()}")
        if card.post_path and repoint(card.post_path, card.key):
            print(f"  repointed {card.post_path.relative_to(ROOT).as_posix()}")

    if args.check:
        problems = [f"{s}: card is stale or missing" for s in stale] + \
                   [f"{s}: post does not reference its card" for s in unpointed]
        if problems:
            print("Share images are out of date. Run: python .github/scripts/generate_og_images.py")
            for p in problems:
                print("  " + p)
            return 1
        print(f"Share images are current ({len(posts)} posts, {len(PAGES)} pages).")
        return 0

    MANIFEST.write_text(json.dumps(fresh, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"{len(stale)} rendered, {len(posts)} posts and {len(PAGES)} pages, manifest written.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
