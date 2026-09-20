#!/usr/bin/env python3
"""Every post has a live cover: the sketch its card runs on hover.

Sketches are registered by slug with def('<slug>', ...) in js/covers.js
(the interactive posts' miniatures open the file; js/live-covers.js is
only the engine). A post in data/posts.json without one fails the check,
so a new post cannot be committed until it has its own sketch (a card
that does nothing on hover would be the odd one out). The smoke suite
separately runs every registered sketch to check it draws.

    python .github/scripts/check_live_covers.py          # report
    python .github/scripts/check_live_covers.py --check  # exit 1 if any missing
    python .github/scripts/check_live_covers.py --drafts # which drafts still need one

The pre-commit hook and CI run --check, so the requirement bites the
moment a post enters posts.json; --drafts is the look-ahead, listing
the drafts whose publish slug (the NN- work prefix stripped) has no
sketch yet, so it can be written before publish day.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
POSTS = ROOT / "data" / "posts.json"
DRAFTS = ROOT / "blog" / "drafts"
SOURCES = [ROOT / "js" / "covers.js"]

# def('slug', ...) or define('slug', ...) in covers.js.
DEFINITION = re.compile(r"\bdef(?:ine)?\(\s*'([a-z0-9-]+)'")


def defined_slugs() -> dict[str, list[str]]:
    found: dict[str, list[str]] = {}
    for src in SOURCES:
        if not src.exists():
            continue
        text = src.read_text(encoding="utf-8")
        for m in DEFINITION.finditer(text):
            found.setdefault(m.group(1), []).append(src.name)
    return found


def draft_slugs() -> list[tuple[str, str]]:
    """(publish slug, draft path) for every draft; the NN- prefix is work order."""
    if not DRAFTS.exists():
        return []
    return [(re.sub(r"^\d{2}-", "", p.stem), p.relative_to(ROOT).as_posix())
            for p in sorted(DRAFTS.rglob("*.html"))]


def main(argv: list[str]) -> int:
    check = "--check" in argv
    posts = json.loads(POSTS.read_text(encoding="utf-8"))
    posts = posts["posts"] if isinstance(posts, dict) else posts
    slugs = [Path(p["url"]).stem for p in posts]
    found = defined_slugs()
    missing = [s for s in slugs if s not in found]
    twice = [s for s, where in found.items() if len(where) > 1]
    orphans = [s for s in found if s not in slugs]

    if "--drafts" in argv:
        drafts = draft_slugs()
        ready = [(s, p) for s, p in drafts if s in found]
        todo = [(s, p) for s, p in drafts if s not in found]
        print(f"{len(ready)} of {len(drafts)} drafts already have a sketch"
              + (": " + ", ".join(s for s, _ in ready) if ready else "."))
        if todo:
            print(f"{len(todo)} draft(s) still need one before they publish:")
            for s, p in todo:
                print(f"  {s:44s} {p}")
        return 0

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
