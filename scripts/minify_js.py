"""Minify custom JS files, keeping originals as .src.js"""
from jsmin import jsmin
from pathlib import Path

JS_DIR = Path(r"C:\Users\Ken\DrKenReid.github.io\js")
CUSTOM_FILES = ["blog.js", "gallery.js", "literature.js", "lightbox.js"]

for fname in CUSTOM_FILES:
    src = JS_DIR / fname
    if not src.exists():
        continue
    original = src.read_text(encoding="utf-8")
    minified = jsmin(original)
    saved = len(original) - len(minified)
    pct = saved / len(original) * 100
    src.write_text(minified, encoding="utf-8")
    print(f"{fname}: {len(original)} -> {len(minified)} bytes ({pct:.0f}% smaller)")
