"""
Measure the site and write data/colophon.json.

Everything colophon.html shows comes from here, so the page can never
drift into claiming numbers that stopped being true. Counts come from the
tracked worktree, byte sizes from the files as they are actually served.

Run before committing a colophon change, or whenever the build pipeline
changes shape:

    python .github/scripts/generate_colophon.py
    python .github/scripts/generate_colophon.py --check
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "colophon.json"


def tracked(pattern):
    """Git-tracked files matching a pathspec, as paths that still exist."""
    try:
        res = subprocess.run(
            ["git", "ls-files", pattern],
            cwd=ROOT, capture_output=True, text=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        return []
    out = []
    for line in res.stdout.splitlines():
        p = ROOT / line.strip()
        if line.strip() and p.exists():
            out.append(p)
    return out


def size(path):
    p = ROOT / path if not isinstance(path, Path) else path
    return p.stat().st_size if p.exists() else 0


def total(paths):
    return sum(f.stat().st_size for f in paths)


def css_input_bytes():
    """style.css plus every file it @imports.

    The served file is larger than style.css alone because the build
    inlines the vendor CSS, so measuring against style.css would make
    pruning look as though it costs bytes. This is the honest denominator.
    """
    src = ROOT / "style.css"
    if not src.exists():
        return 0
    text = src.read_text(encoding="utf-8", errors="replace")
    total_bytes = src.stat().st_size
    for rel in re.findall(r"@import\s+url\(([^)]+)\)", text):
        total_bytes += size(ROOT / rel.strip().strip("\"'"))
    return total_bytes


def ci_checks():
    """Named steps in the site-checks workflow."""
    wf = ROOT / ".github" / "workflows" / "site-checks.yml"
    if not wf.exists():
        return 0
    return len(re.findall(r"^\s*- name:", wf.read_text(encoding="utf-8"), re.M))


def lines(paths):
    n = 0
    for f in paths:
        try:
            n += sum(1 for _ in f.open(encoding="utf-8", errors="replace"))
        except OSError:
            pass
    return n


def git_line(args):
    try:
        res = subprocess.run(args, cwd=ROOT, capture_output=True, text=True, check=True)
        return res.stdout.strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return ""


def months_between(a, b):
    ay, am = int(a[:4]), int(a[5:7])
    by, bm = int(b[:4]), int(b[5:7])
    return max(1, (by - ay) * 12 + (bm - am) + 1)


def commits_by_month():
    """[[YYYY-MM, count], ...] for every month since the first commit,
    zeros included, so the chart shows silence as well as activity."""
    raw = git_line(["git", "log", "--format=%ad", "--date=format:%Y-%m"])
    if not raw:
        return []
    counts = {}
    for m in raw.split("\n"):
        if m:
            counts[m] = counts.get(m, 0) + 1
    first = min(counts)
    last = max(counts)
    y, mo = int(first[:4]), int(first[5:7])
    out = []
    while True:
        key = "%04d-%02d" % (y, mo)
        out.append([key, counts.get(key, 0)])
        if key == last:
            break
        mo += 1
        if mo > 12:
            mo = 1
            y += 1
    return out


def main(argv=None):
    argv = argv if argv is not None else sys.argv[1:]
    check_only = "--check" in argv

    posts = json.loads((ROOT / "data" / "posts.json").read_text(encoding="utf-8"))
    html_pages = tracked("*.html")
    blog_pages = tracked("blog/*.html")
    js_files = [f for f in tracked("js/*.js") if not f.name.endswith(".min.js")]
    scripts = tracked(".github/scripts/*.py")

    css_src = size("style.css")
    css_min = size("style.min.css")

    images = (tracked("img/**/*.webp") + tracked("img/**/*.png")
              + tracked("img/**/*.jpg") + tracked("img/**/*.svg"))
    web_fonts = tracked("fonts/vendor/*.woff2")
    data_files = tracked("data/*.json")

    dates = sorted(p["date"] for p in posts)
    word_counts = sorted(((p.get("words", 0), p["title"]) for p in posts), reverse=True)
    tags = {t for p in posts for t in p.get("tags", [])}

    # Icon fonts are subset at build time; report what that actually saved.
    font_pairs = [
        ("fontawesome-webfont.woff2", "fontawesome-subset.woff2"),
        ("themify.woff", "themify-subset.woff"),
        ("ElegantIcons.woff", "ElegantIcons-subset.woff"),
    ]
    icon_before = sum(size(Path("fonts") / a) for a, _ in font_pairs)
    icon_after = sum(size(Path("fonts") / b) for _, b in font_pairs)

    data = {
        "pages": len(html_pages),
        "posts": len(posts),
        "postPages": len(blog_pages),
        "words": sum(p.get("words", 0) for p in posts),
        "readMinutes": sum(p.get("readMinutes", 0) for p in posts),
        "interactivePosts": sum(1 for p in posts if p.get("interactive")),
        "codePosts": sum(1 for p in posts if p.get("code")),
        "series": len({
            s["name"]
            for p in posts
            for s in (p["series"] if isinstance(p.get("series"), list)
                      else ([p["series"]] if p.get("series") else []))
            if s.get("name")
        }),
        "photos": len(json.loads(
            (ROOT / "data" / "photography-files.json").read_text(encoding="utf-8"))),
        "cssSourceBytes": css_src,
        "cssInputBytes": css_input_bytes(),
        "cssServedBytes": css_min,
        "jsFiles": len(js_files),
        "jsBytes": total(js_files),
        "iconFontBeforeBytes": icon_before,
        "iconFontAfterBytes": icon_after,
        "buildScripts": len(scripts),
        "ciChecks": ci_checks(),
        "dependencies": 0,
        "buildStep": False,
        "htmlBytes": total(html_pages) + total(blog_pages),
        "imageCount": len(images),
        "imageBytes": total(images),
        "webFontCount": len(web_fonts),
        "webFontBytes": total(web_fonts),
        "cssLines": lines([ROOT / "style.css"]),
        "jsLines": lines(js_files),
        "dataFiles": len(data_files),
        "tags": len(tags),
        "firstPost": dates[0] if dates else "",
        "latestPost": dates[-1] if dates else "",
        "postsPerMonth": (round(len(posts) / months_between(dates[0], dates[-1]), 1)
                          if dates else 0),
        "longestPostWords": word_counts[0][0] if word_counts else 0,
        "longestPostTitle": word_counts[0][1] if word_counts else "",
        "shortestPostWords": word_counts[-1][0] if word_counts else 0,
        "shortestPostTitle": word_counts[-1][1] if word_counts else "",
        "averagePostWords": round(sum(w for w, _ in word_counts) / len(word_counts))
                            if word_counts else 0,
        "commits": int(git_line(["git", "rev-list", "--count", "HEAD"]) or 0),
        "commitsByMonth": commits_by_month(),
        "repoStart": git_line(
            ["git", "log", "--reverse", "--format=%ad", "--date=format:%Y-%m"]).split("\n")[0],
    }

    if check_only:
        if not OUT.exists():
            print("data/colophon.json is missing")
            print("run: python .github/scripts/generate_colophon.py")
            return 1
        current = json.loads(OUT.read_text(encoding="utf-8"))
        drift = [k for k in data if current.get(k) != data[k]]
        if drift:
            print("data/colophon.json is stale in %d field(s):" % len(drift))
            for k in drift:
                print("  %s: %r -> %r" % (k, current.get(k), data[k]))
            print("run: python .github/scripts/generate_colophon.py")
            return 1
        print("data/colophon.json is up to date.")
        return 0

    OUT.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print("Wrote %s" % OUT)
    for k, v in data.items():
        print("  %-22s %s" % (k, v))
    return 0


if __name__ == "__main__":
    sys.exit(main())
