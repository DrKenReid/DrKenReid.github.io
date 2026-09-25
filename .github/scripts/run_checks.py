#!/usr/bin/env python3
"""Run every check the site has, in one place, in dependency order.

    python .github/scripts/run_checks.py               # every static check
    python .github/scripts/run_checks.py --fix         # regenerate what is stale, then check
    python .github/scripts/run_checks.py --only feed   # one check (repeatable)
    python .github/scripts/run_checks.py --fast        # the pre-commit subset
    python .github/scripts/run_checks.py --browser     # add the browser suites
    python .github/scripts/run_checks.py --list        # print the plan, run nothing

Each check prints one line as it finishes, a failing check prints its own
output, and the run ends with a timing table. The exit status is 0 only
when everything that ran passed.

Why one ordered list. The site has a dozen generators, each with a
`--check` mode, and they were once listed in three places (the CI
workflow, the pre-commit hook, the publishing checklist) that drifted
apart. CHECKS below is the list. It is ordered by dependency, which does
two jobs: `--fix` can walk it top to bottom and every generator sees its
inputs already rebuilt (the opener shows the read time, the share card
draws the opener, the stylesheet pruner reads the HTML the others
wrote), and a plain run reports the root cause first. When a post's
word count changes, the read-time check fails, and so do the opener
and share-card checks downstream of it; reading from the top, the first
red line is the one to fix. `--ci-parity` (itself an entry) fails when
site-checks.yml stops running exactly this list, so the two cannot
quietly disagree again.

What --fix does. It walks the registry in order and, for each entry
with a generator, runs the check first and the generator only when the
check fails; then it runs every check again. Because of the order, each
check in the walk sees the upstream outputs already rebuilt, so one pass
is enough. A generator whose output is current is left alone, which is
what makes --fix on a clean tree change nothing: the colophon's commit
figures may lag by design (see generate_colophon.py), and rewriting them
on every run would leave a diff after every commit. To force one
generator, run its script directly.

Why the colophon runs last. colophon.html publishes measurements of the
repository: script counts, stylesheet bytes, image bytes, checks per
push. Every generator above it can move one of those figures (the share
cards are images, the min CSS is the served stylesheet), so measuring
before they have run records numbers that are about to be wrong.

Adding a check: give it a `--check` mode that exits non-zero without
writing, add a Check to CHECKS where its inputs are already current, and
add the same command as a named step in .github/workflows/site-checks.yml
(`--ci-parity` will remind you). Mark it `fast` only when it needs no
third-party package and runs in about a second: the tracked pre-commit
hook (.github/hooks/pre-commit) runs the fast subset on every commit,
and the whole subset should stay within a few seconds. A check that is
not a Python script names its program (`program="node"`); the parity
check compares commands word by word, so the workflow may quote an
argument (`node --test "tests/js/*.test.js"`) that the registry holds
bare.

Not in the registry: .github/workflows/links.yml, the weekly external
link report (check_external_links.py). It needs the network, its answer
changes with other people's servers rather than with a push, and it only
reports, so it has no place in a run that gates a commit.
"""
from __future__ import annotations

import argparse
import os
import shlex
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sitelib  # noqa: E402

ROOT = sitelib.ROOT
SCRIPTS = ".github/scripts/"
WORKFLOW = ROOT / ".github" / "workflows" / "site-checks.yml"

# A failing check's output is printed, but a runaway one (the audit on a
# broken tree) can run to thousands of lines; the tail is where the
# summary and the "run: ..." hint live.
TAIL_LINES = 60


@dataclass(frozen=True)
class Check:
    name: str                   # what --only takes
    what: str                   # one line for --list and the table
    check: tuple[str, ...]      # argv after the program
    fix: tuple[str, ...] | None = None   # the generator --fix runs, if any
    fast: bool = False          # part of the pre-commit subset
    browser: bool = False       # needs Playwright; only with --browser
    ci: bool = True             # site-checks.yml runs the same command
    program: str = "python"     # this interpreter, or another on PATH

    def command(self) -> tuple[str, ...]:
        """The check as site-checks.yml spells it: program, then argv."""
        return (self.program, *self.check)


def script(name: str, *args: str) -> tuple[str, ...]:
    return (SCRIPTS + name, *args)


# The registry. Order is dependency order: a generator comes after
# everything it reads. See the module docstring for why that matters.
CHECKS: list[Check] = [
    # Every data/<name>.json that has a data/schema/<name>.schema.json: the
    # weekly live-data files (books, reading, now, lastfm, topalbums,
    # lastfm-history), which the workflow checks before it commits, plus
    # posts.json and publications.json. There is no fixer: a wrong shape
    # needs a person, and the generators that write fields of posts.json
    # (read-times, post-facets) come after this, so they read a file
    # already known to parse.
    Check("data-schemas", "data files match data/schema",
          script("validate_data.py"), fast=True),

    # Post markup on the components in style.css ("Post components"):
    # figure and audio classes instead of style attributes, one shape of
    # reference list, a language on every code block, no hand-made back
    # link. First among the post generators, because it rewrites post
    # bodies, and every one after it counts or copies a body.
    Check("post-markup", "posts use the post components, not inline markup",
          script("normalize_post_markup.py", "--check"),
          script("normalize_post_markup.py"), fast=True),

    # posts.json words/readMinutes, counted from each post's body. The
    # read-time badge, the Length filter and the opener's kicker read it.
    Check("read-times", "posts.json read times match the posts",
          script("generate_read_times.py", "--check"),
          script("generate_read_times.py"), fast=True),

    # posts.json interactive/code flags, detected from .kr-viz demos and
    # <pre><code> blocks; the blog filter's Format row reads them.
    Check("facets", "posts.json format flags match the posts",
          script("generate_post_facets.py", "--check"),
          script("generate_post_facets.py"), fast=True),

    # The editorial header on every post, built from posts.json. After
    # read-times, because the kicker prints the read time.
    Check("opener", "every post opens with a current opener",
          script("apply_post_opener.py", "--check"),
          script("apply_post_opener.py"), fast=True),

    # img/og/<slug>.jpg, drawn from the opener's hero, title and kicker,
    # and compared by input manifest rather than JPEG bytes. The fixer
    # needs Pillow and fontTools; the check needs neither.
    Check("og-images", "share images are current and referenced",
          script("generate_og_images.py", "--check"),
          script("generate_og_images.py"), fast=True),

    # Related-post cards baked into each post by TF-IDF over body text,
    # so editing one post can change what its neighbours recommend.
    Check("related", "baked related-post blocks match a fresh ranking",
          script("generate_related_posts.py", "--check"),
          script("generate_related_posts.py"), fast=True),

    # data/photo-dims.json, the recorded thumbnail sizes the justified
    # gallery lays out from (a frame without one is drawn at 3:2), and the
    # width and height on every post image outside .kr-viz and the baked
    # related cards. The fixer stamps those attributes into post bodies,
    # so it runs before the feed, which copies the bodies.
    Check("photo-dims", "every thumbnail and post image has recorded dimensions",
          script("generate_photo_dims.py", "--check"),
          script("generate_photo_dims.py", "--stamp-img"), fast=True),

    # feed.xml carries the full body of the twenty newest posts, so it
    # comes after every generator that writes into a post.
    Check("feed", "feed.xml matches posts.json and the posts",
          script("generate_feed.py", "--check"),
          script("generate_feed.py"), fast=True),

    # The next three bake data into a page's HTML, so they come before the
    # stylesheet pruner and the audit, which read it.
    # quotes.html carries every saved passage as HTML, so the wall reads
    # without its script and search engines see the quotations.
    Check("quote-wall", "quotes.html matches data/quotes-all.json",
          script("generate_quote_wall.py", "--check"),
          script("generate_quote_wall.py"), fast=True),

    # The publication list and its ScholarlyArticle JSON-LD on
    # data_science.html, both from data/publications.json.
    Check("publications", "data_science.html publications are current",
          script("generate_publications.py", "--check"),
          script("generate_publications.py"), fast=True),

    # The <noscript> list of every post in blog.html and series.html, from
    # posts.json, so a reader without JavaScript still finds the writing.
    # After read-times and the opener's inputs: it prints titles and dates.
    Check("listing", "blog and series pages list every post without JS",
          script("generate_listing_fallback.py", "--check"),
          script("generate_listing_fallback.py"), fast=True),

    # sitemap.xml: every indexable tracked page, with a post's lastmod
    # taken from posts.json.
    Check("sitemap", "sitemap.xml lists every indexable page",
          script("generate_sitemap.py", "--check"),
          script("generate_sitemap.py"), fast=True),

    # The gallery's bw tag, decided from pixels. Needs Pillow, which is
    # why CI runs it in the job that installs requirements.txt.
    Check("monochrome", "bw tags agree with the pixels",
          script("detect_monochrome.py", "--check"),
          script("detect_monochrome.py")),

    # Canonical <head> elements on every post, the JSON-LD included. Its
    # wordCount and timeRequired copy posts.json, so it follows read-times,
    # and it points og:image at the share card, so it follows og-images.
    # It comes before the stylesheet build because it rewrites HTML the
    # pruner reads: css_prune scans every inline <script>, JSON-LD
    # included. The fixer only rewrites template lines and is idempotent.
    # What it cannot derive (a missing share card, a bad 'updated' date)
    # stays a failure for a person to fix.
    Check("post-head", "every post head carries the canonical elements",
          script("generate_post_head.py", "--check"),
          script("generate_post_head.py", "--fix"), fast=True),

    # The pruner's own fixtures (mixed quotes, prefixes, keyframes), run
    # before the build that trusts it to keep every rule a page can use.
    Check("css-prune", "the CSS pruner passes its own cases",
          script("css_prune.py", "--selftest"), fast=True),

    # style.css against its own rules: no var() of a property nothing
    # sets, no property nothing reads, no duplicate rule, one print block,
    # and the ratchets in .github/css-baseline.json. The fixer only ever
    # lowers a ratchet (it refuses to raise one).
    Check("css-rules", "style.css tokens, duplicates and ratchets hold",
          script("check_css.py", "--check"),
          script("check_css.py", "--update-baseline"), fast=True),

    # style.min.css. The pruner keeps only rules whose selectors appear in
    # tracked HTML and JS, so it follows everything that writes HTML.
    Check("css", "style.min.css is a fresh build of style.css",
          script("minify_css.py", "--check"),
          script("minify_css.py"), fast=True),

    # A post in posts.json with no sketch in js/covers.js. No fixer: the
    # sketch is drawn by hand.
    Check("live-covers", "every post has its own hover sketch",
          script("check_live_covers.py", "--check"), fast=True),

    # The developer docs (.github/docs/), the README and the comments in
    # the site's own code send the next reader to files by path; a rename
    # that leaves one behind sends them nowhere. Also refuses a pointer to
    # a private file and a review label. No fixer: a stale reference needs
    # a person to say where the thing went.
    Check("docs", "docs and comments name files that exist",
          script("check_docs.py", "--check"), fast=True),

    # Unit tests for the scripts themselves (tests/, standard library).
    Check("unit-tests", "tests/ pass",
          ("-m", "unittest", "discover", "-s", "tests", "-v")),

    # The browser scripts' pure helpers (tests/js/), under Node's own test
    # runner: no package to install. The glob is Node's to expand (Node 21
    # and later), so the argument is the same on every shell; a bare
    # directory is read as one test file and matches nothing.
    Check("js-tests", "tests/js pass under node --test",
          ("--test", "tests/js/*.test.js"), program="node"),

    # This list and site-checks.yml run the same commands.
    Check("ci-parity", "site-checks.yml runs exactly this registry",
          script("run_checks.py", "--ci-parity"), fast=True),

    # Links, metadata, JSON-LD, accessibility basics, feed and sitemap
    # coverage. --strict fails on warnings as well as errors. It reads
    # nearly every output above, so it runs after all of them.
    Check("audit", "site audit: zero errors and zero warnings",
          script("audit_site.py", "--strict"), fast=True),

    # Headless Chromium over the key pages. Opt-in locally (--browser);
    # CI always runs it.
    Check("smoke", "pages render and behave in a real browser",
          script("smoke_test.py"), browser=True),

    # Every post in posts.json against the one post template, in Chromium
    # with third-party requests aborted: the end band's slots in order,
    # opener colours, sidenotes, reading progress, no overflow, a quiet
    # console. The smoke suite reads two posts closely; this reads them all.
    Check("template", "every post renders the post template",
          script("check_post_template.py"), browser=True),

    # Layout shift, first-party weight and requests per page template at a
    # phone and a desktop size (.github/perf-budgets.json), then the
    # offline scenario and the web app manifest.
    Check("perf", "page templates hold their performance budgets",
          script("perf_budget.py"), browser=True),

    # Last, always: see the module docstring.
    Check("colophon", "colophon.json measures the tree as it now is",
          script("generate_colophon.py", "--check"),
          script("generate_colophon.py"), fast=True),
]


def by_name() -> dict[str, Check]:
    return {c.name: c for c in CHECKS}


# --- running -------------------------------------------------------------

def run(argv: tuple[str, ...], program: str = "python") -> tuple[int, str, float]:
    """Run one command from the repo root: a Python script with this
    interpreter (so the venv's packages are there), anything else with
    `program` from PATH.

    PYTHONIOENCODING, not PYTHONUTF8: the children print em dashes and
    arrows, which a Windows pipe would otherwise encode as cp1252 and
    choke on, but PYTHONUTF8 would also change what open() defaults to,
    and a generator must write the same bytes under this runner as it
    does when run by hand.
    """
    exe = sys.executable if program == "python" else shutil.which(program)
    if exe is None:
        return 1, "%s is not on PATH; this check needs it" % program, 0.0
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    start = time.perf_counter()
    proc = subprocess.run([exe, *argv], cwd=ROOT, env=env,
                          capture_output=True, text=True,
                          encoding="utf-8", errors="replace")
    took = time.perf_counter() - start
    return proc.returncode, (proc.stdout + proc.stderr).rstrip(), took


def show_output(text: str, name: str) -> None:
    lines = text.splitlines()
    if len(lines) > TAIL_LINES:
        print("      ... %d earlier lines; rerun with --only %s for all of them"
              % (len(lines) - TAIL_LINES, name))
        lines = lines[-TAIL_LINES:]
    for line in lines:
        print("      " + line)


def run_checks(plan: list[Check]) -> list[tuple[Check, str, float]]:
    results = []
    for c in plan:
        code, out, took = run(c.check, c.program)
        status = "pass" if code == 0 else "FAIL"
        print("  %-4s  %-12s %6.1fs  %s" % (status, c.name, took, c.what), flush=True)
        if code:
            show_output(out, c.name)
        results.append((c, status, took))
    return results


def run_fixers(plan: list[Check]) -> list[tuple[Check, str, float]]:
    """Regenerate each stale output once, in registry order.

    Each entry's check runs first and its generator only when that check
    fails (see "What --fix does" above). The time shown covers both. A
    failing generator does not stop the walk: the checks that follow will
    say which outputs are still stale, which is more useful than stopping
    at the first error with the rest unknown.
    """
    results = []
    for c in plan:
        if not c.fix:
            continue
        code, _, took = run(c.check, c.program)
        if code == 0:
            status, out = "ok", ""
        else:
            code, out, fix_took = run(c.fix, c.program)
            took += fix_took
            status = "fixed" if code == 0 else "FAIL"
        what = "already current" if status == "ok" else " ".join(c.fix)
        print("  %-5s %-12s %6.1fs  %s" % (status, c.name, took, what), flush=True)
        if code:
            show_output(out, c.name)
        results.append((c, status, took))
    return results


def table(rows: list[tuple[Check, str, float]], heading: str) -> None:
    if not rows:
        return
    total = sum(t for _, _, t in rows)
    print("\n%s" % heading)
    print("  %-12s %-6s %8s" % ("check", "result", "seconds"))
    print("  %-12s %-6s %8s" % ("-" * 12, "-" * 6, "-" * 8))
    for c, status, took in sorted(rows, key=lambda r: -r[2]):
        print("  %-12s %-6s %8.1f" % (c.name, status, took))
    print("  %-12s %-6s %8.1f" % ("total", "", total))


# --- CI parity -------------------------------------------------------------

# Step names that are plumbing rather than a check: installing packages
# and browsers, and working out a cache key.
NOT_A_CHECK = ("Install", "Set up")


def workflow_steps(text: str) -> list[dict[str, str]]:
    """Each step of a workflow as a dict of its top-level keys.

    Not a YAML parser, and it does not need to be (CI has no PyYAML, and
    this file's steps are plain `key: value` lines and `|` blocks): a step
    starts at a `- ` under a `steps:` key, and its keys are the lines one
    level in. A block scalar (`run: |`) is collected as its lines joined
    by newlines. Comment lines are skipped, so a placeholder step written
    as a comment is not a step.
    """
    steps: list[dict[str, str]] = []
    step = None
    steps_indent = item_indent = block_key = None
    block: list[str] = []

    def close_block():
        nonlocal block_key
        if block_key is not None and step is not None:
            step[block_key] = "\n".join(block)
        block_key = None

    for raw in text.splitlines():
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip())
        if block_key is not None:
            if indent > item_indent + 2:
                block.append(stripped)
                continue
            close_block()
        if stripped == "steps:":
            steps_indent, item_indent, step = indent, None, None
            continue
        if steps_indent is None:
            continue
        if indent <= steps_indent:
            steps_indent = step = None
            continue
        if stripped.startswith("- ") and indent == (item_indent or indent):
            item_indent = indent
            step = {}
            steps.append(step)
            stripped, indent = stripped[2:].lstrip(), indent + 2
        if step is not None and indent == item_indent + 2:
            key, _, value = stripped.partition(":")
            key, value = key.strip(), value.strip()
            if value in ("|", "|-", ">", ">-"):
                block_key, block = key, []
            else:
                step[key] = value
    close_block()
    return steps


def check_steps(text: str) -> list[dict[str, str]]:
    """The steps of a workflow that run a check.

    A `run:` step whose name does not begin with Install or Set up.
    Checkout, setup-python and the browser cache are `uses:` steps and do
    not count. generate_colophon.py counts these for colophon.html's
    "checks per push", and --ci-parity compares their commands with the
    registry, so the two numbers cannot tell different stories.
    """
    return [s for s in workflow_steps(text)
            if "run" in s and "uses" not in s
            and not s.get("name", "").startswith(NOT_A_CHECK)]


def words(line: str) -> tuple[str, ...]:
    """A shell command line as its words, quotes removed, so that
    `node --test "tests/js/*.test.js"` in the workflow and the registry's
    bare argument compare equal. A line shlex cannot split (an unclosed
    quote) is compared by whitespace instead of crashing the check."""
    try:
        return tuple(shlex.split(line))
    except ValueError:
        return tuple(line.split())


def ci_parity() -> int:
    if not WORKFLOW.exists():
        print("%s is missing" % WORKFLOW.relative_to(ROOT).as_posix())
        return 1
    ran = {words(line)
           for s in check_steps(WORKFLOW.read_text(encoding="utf-8"))
           for line in s["run"].splitlines() if line.strip()}
    want = {c.command() for c in CHECKS if c.ci}
    missing = sorted(shlex.join(cmd) for cmd in want - ran)
    extra = sorted(shlex.join(cmd) for cmd in ran - want)
    if missing or extra:
        print("site-checks.yml and run_checks.py disagree:")
        for cmd in missing:
            print("  in the registry, not in CI: " + cmd)
        for cmd in extra:
            print("  in CI, not in the registry: " + cmd)
        print("add the check to both, or mark it ci=False in CHECKS")
        return 1
    print("site-checks.yml runs the same %d checks as run_checks.py." % len(want))
    return 0


# --- entry point -----------------------------------------------------------

def select(args: argparse.Namespace) -> list[Check]:
    if args.only:
        names = [n for arg in args.only for n in arg.split(",") if n]
        known = by_name()
        unknown = [n for n in names if n not in known]
        if unknown:
            raise ValueError("unknown check(s): %s (known: %s)"
                             % (", ".join(unknown), ", ".join(known)))
        # Registry order even when named out of order, so --fix still
        # regenerates inputs before outputs.
        return [c for c in CHECKS if c.name in names]
    plan = [c for c in CHECKS if args.browser or not c.browser]
    if args.fast:
        plan = [c for c in plan if c.fast]
    return plan


def main(argv: list[str] | None = None) -> int:
    # No abbreviations (sitelib.arg_parser refuses them): `--f` must not be
    # taken for --fix, which rewrites files.
    ap = sitelib.arg_parser(
        __doc__, epilog="Checks, in order: " + ", ".join(c.name for c in CHECKS))
    ap.add_argument("--fix", action="store_true",
                    help="regenerate stale outputs in dependency order, then check")
    ap.add_argument("--only", action="append", metavar="NAME",
                    help="run only this check (repeat, or comma-separate)")
    ap.add_argument("--fast", action="store_true",
                    help="only the quick checks (the pre-commit hook's subset)")
    ap.add_argument("--browser", action="store_true",
                    help="include the Playwright suites (smoke, post template, budgets)")
    ap.add_argument("--list", action="store_true",
                    help="print what would run, in order, and exit")
    ap.add_argument("--ci-parity", action="store_true",
                    help="fail if site-checks.yml does not run this registry")
    args = ap.parse_args(argv)
    # A failing check's output is echoed, and it can hold characters a
    # Windows console's code page cannot print (the generators' arrows);
    # a report is not worth a crash, so those print as escapes instead.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="backslashreplace")

    if args.ci_parity:
        return ci_parity()

    try:
        plan = select(args)
    except ValueError as e:
        ap.error(str(e))
    if args.list:
        for c in plan:
            flags = [f for f, on in (("fast", c.fast), ("browser", c.browser),
                                     ("fixes", bool(c.fix)), ("local only", not c.ci),
                                     ("needs " + c.program, c.program != "python")) if on]
            print("%-12s %-50s %s" % (c.name, c.what, ", ".join(flags)))
        return 0

    fixed = []
    if args.fix:
        print("Regenerating what is stale (%d generators):" % sum(1 for c in plan if c.fix))
        fixed = run_fixers(plan)
        print()
    print("Checking (%d checks):" % len(plan))
    checked = run_checks(plan)

    table(fixed, "Generators")
    table(checked, "Checks")
    failed = [c.name for c, s, _ in fixed + checked if s == "FAIL"]
    if failed:
        print("\nFAILED: " + ", ".join(dict.fromkeys(failed)))
        return 1
    print("\nAll %d checks passed." % len(checked))
    return 0


if __name__ == "__main__":
    sys.exit(main())
