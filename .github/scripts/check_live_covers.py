#!/usr/bin/env python3
"""Every post has a live cover: the sketch its card runs on hover.

Sketches are registered by slug, either as KINDS['<slug>'] in
js/live-covers.js or as def('<slug>', ...) in js/covers.js. A post in
data/posts.json without one fails the check, so a new post cannot be
committed until it has its own sketch (a card that does nothing on hover
would be the odd one out).

    python .github/scripts/check_live_covers.py          # report
    python .github/scripts/check_live_covers.py --check  # exit 1 if any missing
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
POSTS = ROOT / "data" / "posts.json"
SOURCES = [ROOT / "js" / "live-covers.js", ROOT / "js" / "covers.js"]

# KINDS['slug'] in the engine; def('slug', ...) or define('slug', ...) in covers.js.
DEFINITION = re.compile(r"(?:KINDS\[|\bdef(?:ine)?\()\s*'([a-z0-9-]+)'")


def defined_slugs() -> dict[str, list[str]]:
    found: dict[str, list[str]] = {}
    for src in SOURCES:
        if not src.exists():
            continue
        text = src.read_text(encoding="utf-8")
        for m in DEFINITION.finditer(text):
            found.setdefault(m.group(1), []).append(src.name)
    return found


def main(argv: list[str]) -> int:
    check = "--check" in argv
    posts = json.loads(POSTS.read_text(encoding="utf-8"))
    posts = posts["posts"] if isinstance(posts, dict) else posts
    slugs = [Path(p["url"]).stem for p in posts]
    found = defined_slugs()
    missing = [s for s in slugs if s not in found]
    twice = [s for s, where in found.items() if len(where) > 1]
    orphans = [s for s in found if s not in slugs]

    if missing:
        print(f"{len(missing)} post(s) have no live cover sketch:")
        for s in missing:
            print(f"  {s}   -> add krLiveCovers.define('{s}', ...) to js/covers.js")
    if twice:
        print("defined more than once: " + ", ".join(twice))
    if orphans:
        print("sketches with no post (fine for drafts): " + ", ".join(orphans))
    if not missing and not twice:
        print(f"Every post has a live cover ({len(slugs)} posts, {len(found)} sketches).")
        return 0
    return 1 if check else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
