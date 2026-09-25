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

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402
from run_checks import check_steps  # noqa: E402  (one rule for "a check step")

ROOT = sitelib.ROOT
OUT = ROOT / "data" / "colophon.json"

# Fields read from git history, checked with tolerance (see --check).
HISTORY = ("commits", "commitsByMonth")
LAG = 25


TEXT = {".css", ".js", ".html", ".htm", ".json", ".xml", ".svg", ".txt",
        ".md", ".py", ".yml", ".yaml", ".webmanifest"}


def size(path):
    """Bytes as Pages serves them. The repository stores LF; a Windows
    working copy checks out CRLF, so a text file is counted with one byte
    per line end or the figure changes with the machine that measured it."""
    p = ROOT / path if not isinstance(path, Path) else path
    if not p.exists():
        return 0
    n = p.stat().st_size
    if p.suffix.lower() in TEXT:
        n -= p.read_bytes().count(b"\r\n")
    return n


def total(paths):
    return sum(size(f) for f in paths)


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
    total_bytes = size(src)
    for rel in re.findall(r"@import\s+url\(([^)]+)\)", text):
        total_bytes += size(ROOT / rel.strip().strip("\"'"))
    return total_bytes


def ci_checks():
    """Steps in the site-checks workflow that run a check.

    colophon.html calls this "checks per push", so it counts only the
    steps that can fail the build on a finding, not the ones that install
    packages, fetch a browser or check out the repository (the old count
    took every named step, installs included). The rule is
    run_checks.check_steps, the same one --ci-parity holds the workflow
    to, so this number is also the size of the registry CI runs.
    """
    wf = ROOT / ".github" / "workflows" / "site-checks.yml"
    if not wf.exists():
        return 0
    return len(check_steps(wf.read_text(encoding="utf-8")))


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
    # %aI keeps each author's own zone, so the month is the same whichever
    # zone the measuring machine runs in (CI is UTC; a late commit here is
    # already tomorrow there).
    raw = git_line(["git", "log", "--format=%aI"])
    if not raw:
        return []
    counts = {}
    for d in raw.split("\n"):
        m = d[:7]
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
    ap = sitelib.arg_parser(__doc__)
    ap.add_argument("--check", action="store_true",
                    help="exit 1 if data/colophon.json is stale; write nothing")
    check_only = ap.parse_args(argv).check

    posts = sitelib.load_posts()
    # sitelib.tracked raises when git fails; this script's own copy used
    # to return an empty list, and would have written a colophon claiming
    # no pages at all.
    html_pages = sitelib.tracked("*.html")
    blog_pages = sitelib.tracked("blog/*.html")
    js_files = [f for f in sitelib.tracked("js/*.js") if not f.name.endswith(".min.js")]
    scripts = sitelib.tracked(".github/scripts/*.py")

    css_src = size("style.css")
    css_min = size("style.min.css")

    images = sitelib.tracked("img/**/*.webp", "img/**/*.png", "img/**/*.jpg", "img/**/*.svg")
    web_fonts = sitelib.tracked("fonts/vendor/*.woff2")
    # The files the pages read. A git pathspec's * crosses directories,
    # so without the parent test data/schema/*.schema.json (validation
    # rules, not data) would join the count.
    data_files = [f for f in sitelib.tracked("data/*.json") if f.parent == ROOT / "data"]

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
        "series": len({s["name"] for p in posts
                       for s in sitelib.series_list(p) if s.get("name")}),
        "photos": len(json.loads(
            (ROOT / "data" / "photography-files.json").read_text(encoding="utf-8"))),
        # The homepage's quote count, read from here so the page does not
        # download all of quotes-all.json to learn its length.
        "quotes": len(json.loads(
            (ROOT / "data" / "quotes-all.json").read_text(encoding="utf-8"))),
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
            ["git", "log", "--reverse", "--format=%aI"]).split("\n")[0][:7],
    }

    if check_only:
        if not OUT.exists():
            print("data/colophon.json is missing")
            print("run: python .github/scripts/generate_colophon.py")
            return 1
        current = json.loads(OUT.read_text(encoding="utf-8"))
        # The history fields are measured before the commit that carries
        # them exists, and the live-data workflow commits without running
        # this, so the page is allowed to lag a little: never ahead of the
        # truth, never more than LAG commits behind it.
        drift = [k for k in data if k not in HISTORY and current.get(k) != data[k]]
        behind = data["commits"] - int(current.get("commits") or 0)
        recorded = dict(current.get("commitsByMonth") or [])
        actual = dict(data["commitsByMonth"])
        months_ok = all(actual.get(m, 0) >= n for m, n in recorded.items())
        if behind < 0 or behind > LAG or not months_ok:
            drift += list(HISTORY)
        if drift:
            print("data/colophon.json is stale in %d field(s):" % len(drift))
            for k in drift:
                print("  %s: %r -> %r" % (k, current.get(k), data[k]))
            if behind > LAG:
                print("  (the commit history is %d commits behind; %d allowed)" % (behind, LAG))
            print("run: python .github/scripts/generate_colophon.py")
            return 1
        print("data/colophon.json is up to date%s." % (
            " (%d commit%s behind, within %d)" % (behind, "" if behind == 1 else "s", LAG) if behind else ""))
        return 0

    OUT.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print("Wrote %s" % OUT)
    for k, v in data.items():
        print("  %-22s %s" % (k, v))
    return 0


if __name__ == "__main__":
    sys.exit(main())
