#!/usr/bin/env python3
"""Render a share image for every blog post, in the site's own design.

Each post gets img/og/<slug>.jpg (1200x630): the post's opener photograph
under a dark scrim, the kicker (category, date, read time), the title in
Lora, the brand rule, and the site's name. The post's og:image,
twitter:image and JSON-LD image are pointed at it.

The inputs that shape a card (title, kicker, hero path and size) are
hashed into img/og/manifest.json, so `--check` can tell whether a card
is stale without re-encoding JPEGs (which differ byte for byte between
Pillow builds). Rendering is only needed when a post is added or its
title, date or hero changes.

    python .github/scripts/generate_og_images.py            # render stale
    python .github/scripts/generate_og_images.py --force    # render all
    python .github/scripts/generate_og_images.py --check    # CI
"""
from __future__ import annotations

import hashlib
import io
import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
POSTS = ROOT / "data" / "posts.json"
OUT = ROOT / "img" / "og"
MANIFEST = OUT / "manifest.json"
SITE = "https://www.kenreid.co.uk"
W, H = 1200, 630

# Brand tokens (dark theme values: the card is always dark).
INK = (255, 255, 255)
STONE = (168, 160, 153)          # --kr-eyebrow, dark
BRAND_FROM = (255, 150, 150)     # --kr-brand-from, dark
BRAND_TO = (255, 232, 158)       # --kr-brand-to, dark
BASE = (14, 14, 14)

FONTS = ROOT / "fonts" / "vendor"


def load_font(name: str, size: int):
    """Pillow reads TTF/OTF; the site ships woff2, so decompress in memory."""
    from fontTools.ttLib import TTFont
    from PIL import ImageFont
    f = TTFont(FONTS / name)
    f.flavor = None
    buf = io.BytesIO()
    f.save(buf)
    buf.seek(0)
    return ImageFont.truetype(buf, size)


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
    return "  ·  ".join(parts)


def slug_of(post: dict) -> str:
    return Path(post["url"]).stem


def signature(post: dict, hero: Path | None) -> str:
    h = hashlib.sha1()
    h.update(post["title"].encode())
    h.update(kicker_of(post).encode())
    if hero and hero.exists():
        # as_posix: the same signature from a Windows working copy and the
        # Linux runner, which would otherwise disagree on every separator.
        h.update(hero.relative_to(ROOT).as_posix().encode())
        h.update(str(hero.stat().st_size).encode())
    h.update(b"v1")
    return h.hexdigest()[:16]


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


def gradient_text(size, text, font, c0, c1):
    """Text filled with a horizontal gradient: a gradient strip masked by
    the glyphs, the same trick as background-clip: text."""
    from PIL import Image, ImageDraw
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).text((0, 0), text, font=font, fill=255)
    strip = Image.new("RGB", size, c0)
    px = strip.load()
    for x in range(size[0]):
        t = x / max(1, size[0] - 1)
        col = tuple(round(c0[i] + (c1[i] - c0[i]) * t) for i in range(3))
        for y in range(size[1]):
            px[x, y] = col
    out = Image.new("RGBA", size, (0, 0, 0, 0))
    out.paste(strip, (0, 0), mask)
    return out


def render(post: dict, hero: Path | None, out: Path) -> None:
    from PIL import Image, ImageDraw, ImageFilter

    canvas = Image.new("RGB", (W, H), BASE)
    if hero and hero.exists():
        im = Image.open(hero).convert("RGB")
        scale = max(W / im.width, H / im.height)
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
        im = im.crop(((im.width - W) // 2, (im.height - H) // 2, (im.width - W) // 2 + W, (im.height - H) // 2 + H))
        if im.width < 900:
            im = im.filter(ImageFilter.GaussianBlur(1.2))
        canvas.paste(im, (0, 0))

    # Scrim: the opener's, bottom-heavy and stronger on the left where
    # the type sits.
    scrim = Image.new("L", (W, H), 0)
    sp = scrim.load()
    for y in range(H):
        vy = min(1.0, max(0.0, (y - H * 0.18) / (H * 0.82)))
        for x in range(W):
            vx = 1 - min(1.0, x / (W * 0.85))
            a = 0.30 + 0.62 * (vy ** 1.4) * (0.55 + 0.45 * vx) + 0.12 * vx
            sp[x, y] = round(255 * min(0.96, a))
    canvas.paste(Image.new("RGB", (W, H), BASE), (0, 0), scrim)

    draw = ImageDraw.Draw(canvas)
    pad = 72
    kicker_font = load_font("poppins-600.woff2", 22)
    title_font = load_font("lora-600.woff2", 64)
    site_font = load_font("poppins-600.woff2", 26)

    # Layout from the bottom up.
    y = H - pad
    # Site name, gradient, bottom left.
    name = "kenreid.co.uk"
    nw = int(draw.textlength(name, font=site_font)) + 4
    nh = site_font.size + 12
    canvas.paste(gradient_text((nw, nh), name, site_font, BRAND_FROM, BRAND_TO), (pad, y - nh + 4), gradient_text((nw, nh), name, site_font, BRAND_FROM, BRAND_TO))
    y -= nh + 26

    # Brand rule.
    rule = Image.new("RGB", (72, 4), BRAND_FROM)
    rp = rule.load()
    for x in range(72):
        t = x / 71
        rp[x, 0] = rp[x, 1] = rp[x, 2] = rp[x, 3] = tuple(round(BRAND_FROM[i] + (BRAND_TO[i] - BRAND_FROM[i]) * t) for i in range(3))
    canvas.paste(rule, (pad, y - 4))
    y -= 4 + 30

    # Title, up to three lines.
    lines = wrap(draw, post["title"], title_font, W - pad * 2 - 40, 3)
    line_h = int(title_font.size * 1.18)
    y -= line_h * len(lines)
    ty = y
    for ln in lines:
        draw.text((pad, ty), ln, font=title_font, fill=INK)
        ty += line_h
    y -= 22

    # Kicker.
    kick = kicker_of(post).upper()
    draw.text((pad, y - kicker_font.size), kick, font=kicker_font, fill=STONE)

    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, "JPEG", quality=82, optimize=True, progressive=True)


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


def main(argv: list[str]) -> int:
    check = "--check" in argv
    force = "--force" in argv
    posts = json.loads(POSTS.read_text(encoding="utf-8"))
    posts = posts["posts"] if isinstance(posts, dict) else posts
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {}
    stale: list[str] = []
    unpointed: list[str] = []
    fresh: dict[str, str] = {}

    for post in posts:
        slug = slug_of(post)
        post_path = ROOT / post["url"]
        html = post_path.read_text(encoding="utf-8")
        hero_rel = hero_of(html)
        hero = ROOT / hero_rel if hero_rel else None
        sig = signature(post, hero)
        fresh[slug] = sig
        out = OUT / f"{slug}.jpg"
        if force or manifest.get(slug) != sig or not out.exists():
            stale.append(slug)
        if f"/img/og/{slug}.jpg" not in html:
            unpointed.append(slug)
        if not check:
            if slug in stale:
                render(post, hero, out)
                print(f"  rendered {out.relative_to(ROOT)}")
            if repoint(post_path, slug):
                print(f"  repointed {post['url']}")

    if check:
        problems = [f"{s}: card is stale or missing" for s in stale] + \
                   [f"{s}: post does not reference its card" for s in unpointed]
        if problems:
            print("Share images are out of date. Run: python .github/scripts/generate_og_images.py")
            for p in problems:
                print("  " + p)
            return 1
        print(f"Share images are current ({len(posts)} posts).")
        return 0

    MANIFEST.write_text(json.dumps(fresh, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print(f"{len(stale)} rendered, {len(posts)} posts, manifest written.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
