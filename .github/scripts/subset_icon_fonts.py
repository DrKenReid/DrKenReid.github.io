#!/usr/bin/env python3
"""Subset the icon fonts (Font Awesome, Themify, ElegantIcons) to the
glyphs the site actually uses.

Used icon classes come from the same corpus the CSS pruner scans (all
HTML including drafts, JS string literals, inline scripts, blog/*.md).
Class -> codepoint mapping comes from each font's vendor CSS. Subset
files are written next to the originals with a -subset suffix;
.github/scripts/minify_css.py swaps the @font-face src to the subset files at
build time, so the vendor CSS on disk stays untouched.

Rerun when a new icon class is introduced, then rebuild the min CSS.
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from css_prune import collect_usage  # noqa: E402

from fontTools.subset import Subsetter, Options, load_font, save_font

ROOT = Path(__file__).resolve().parents[2]

FONTS = [
    {
        "name": "FontAwesome",
        "class_re": r'\.(fa-[\w-]+):+before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"',
        "css": ROOT / "css" / "font-awesome.min.css",
        "sources": [ROOT / "fonts" / "fontawesome-webfont.woff2",
                    ROOT / "fonts" / "fontawesome-webfont.woff"],
        "out_stem": "fontawesome-subset",
        "out_dir": ROOT / "fonts",
    },
    {
        "name": "themify",
        "class_re": r'\.(ti-[\w-]+):+before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"',
        "css": ROOT / "css" / "default-assets" / "themify-icons.css",
        "sources": [ROOT / "fonts" / "themify.woff",
                    ROOT / "fonts" / "themify.ttf"],
        "out_stem": "themify-subset",
        "out_dir": ROOT / "fonts",
    },
    {
        "name": "ElegantIcons",
        "class_re": r'\.((?:icon|arrow|social)_[\w-]+):+before\s*\{\s*content:\s*"\\([0-9a-fA-F]+)"',
        "css": ROOT / "css" / "style.css",
        "sources": [ROOT / "css" / "fonts" / "ElegantIcons.woff",
                    ROOT / "css" / "fonts" / "ElegantIcons.ttf"],
        "out_stem": "ElegantIcons-subset",
        "out_dir": ROOT / "css" / "fonts",
    },
]


def main():
    classes, _ids = collect_usage()
    manifest = {}
    for spec in FONTS:
        defined = {}
        for m in re.finditer(spec["class_re"], spec["css"].read_text(encoding="utf-8")):
            defined[m.group(1)] = int(m.group(2), 16)
        used = sorted(c for c in classes if c in defined)
        manifest[spec["name"]] = used
        codepoints = {defined[c] for c in used}
        print(f"{spec['name']}: {len(used)} used of {len(defined)} defined -> {used}")
        if not codepoints:
            print("  nothing used — no subset written")
            continue
        for src in spec["sources"]:
            if not src.exists():
                print(f"  skip missing {src.name}")
                continue
            options = Options()
            options.flavor = "woff2" if src.suffix == ".woff2" else (
                "woff" if src.suffix == ".woff" else None)
            options.desubroutinize = True
            font = load_font(str(src), options)
            ss = Subsetter(options)
            ss.populate(unicodes=codepoints)
            ss.subset(font)
            out = spec["out_dir"] / (spec["out_stem"] + src.suffix)
            save_font(font, str(out), options)
            print(f"  {src.name}: {src.stat().st_size:,} -> {out.name}: {out.stat().st_size:,} bytes")

    # Manifest of subsetted classes — minify_css.py --check compares the
    # tracked corpus against this and fails when a used icon is missing
    # from the subsets (which would render as an empty box).
    import json
    manifest_path = ROOT / "fonts" / "subset-manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n",
                             encoding="utf-8", newline="\n")
    print(f"wrote {manifest_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
