# Testing

The site has no build server, so everything a build would guarantee is a
check instead: a script that reads the tree and fails when something is
stale, broken or missing. They run in one order from one list,
`CHECKS` in `.github/scripts/run_checks.py`, and the same list runs in
CI on every push to `master` and every pull request
(`.github/workflows/site-checks.yml`). (The essay:
[My Website Has a Test Suite](https://www.kenreid.co.uk/blog/my-website-has-a-test-suite.html).)

## Running them

```sh
python .github/scripts/run_checks.py               # every static check
python .github/scripts/run_checks.py --fix         # regenerate what is stale, then check
python .github/scripts/run_checks.py --browser     # add the three browser suites
python .github/scripts/run_checks.py --only feed   # one check (comma-separate, or repeat)
python .github/scripts/run_checks.py --fast        # the pre-commit subset
python .github/scripts/run_checks.py --list        # the plan, with each check's flags
```

Each check prints one line as it finishes, a failing one prints the tail
of its own output, and the run ends with a timing table. Every check is
also a script you can run on its own; the command is in the table below.

**Read a failure from the top.** The list is in dependency order, so one
cause fails every check downstream of it: an edited post fails
`read-times`, then `opener` (the kicker prints the read time), then
`post-head` (the JSON-LD carries the word count). The first red line is
the one to fix, and `--fix` usually is the fix.

**What `--fix` does.** It walks the list once, top to bottom. For each
check with a generator it runs the check, and runs the generator only if
the check fails; then it runs every check again. A current output is
never rewritten, so `--fix` on a clean tree changes nothing. To force one
generator, run its script directly.

**Before every commit.** The tracked hook `.github/hooks/pre-commit` runs
`run_checks.py --fast`: every check that needs no third-party package and
takes about a second, a few seconds together. Install it once per clone:

```sh
python .github/hooks/install.py           # copies the hook into .git/hooks
python .github/hooks/install.py --check   # exit 1 if the installed one differs
```

It reads the working tree, not the staged snapshot. It fails when an
output is stale on disk, but it cannot see a regenerated file you forgot
to stage: the commit goes in without it and CI, which reads only what was
committed, fails. Check `git status` for generated files before you
commit. What it leaves to CI is the monochrome check (Pillow), the Python
and JavaScript unit tests and the browser suites.

**Setting up.** The static checks need Python 3.12 or later (CI runs
3.12) and git, and the JavaScript tests need Node 21 or later. The browser
suites, the monochrome check and three generators (the share cards, the
icon font subsets, the monochrome tags) need the packages in
`.github/scripts/requirements.txt`:

```sh
python -m venv .venv
.venv/Scripts/pip install -r .github/scripts/requirements.txt   # .venv/bin/pip elsewhere
.venv/Scripts/python -m playwright install chromium
```

## Every check

In registry order. "Fixer" is what `--fix` runs when the check fails.
"Fast" checks are in the pre-commit subset.

| Check | Command | Fixer | What breaks without it |
|---|---|---|---|
| `data-schemas` | `validate_data.py` | none | A data file the pages parse with no fallback changes shape (a weekly refresh, a hand edit, a typo'd key in `posts.json`) and a page renders blank. Every `data/<name>.json` with a `data/schema/<name>.schema.json` is checked. Fast. |
| `post-markup` | `normalize_post_markup.py --check` | the script | A post copied from an old one brings back style attributes, a second shape of reference list, a bare code block or a hand-made back link. First of the post checks, because it rewrites bodies the others count. Fast. |
| `read-times` | `generate_read_times.py --check` | the script | `words` and `readMinutes` in `posts.json` drift from the post after an edit; the badge, the Length filter and the homepage total lie. Fast. |
| `facets` | `generate_post_facets.py --check` | the script | A post gains a demo or a code block and the blog's Format filter does not find it. Fast. |
| `opener` | `apply_post_opener.py --check` | the script | A post keeps an old banner, or its opener disagrees with `posts.json` (title, kicker, read time). Fast. |
| `og-images` | `generate_og_images.py --check` | the script (needs Pillow and fontTools) | A post has no share card, or a card drawn from an old title. Compares an input manifest, not JPEG bytes, so the check needs no package. Fast. |
| `related` | `generate_related_posts.py --check` | the script | The related-post cards baked into each post fall behind: publishing a post changes what its neighbours should recommend. Fast. |
| `photo-dims` | `generate_photo_dims.py --check` | `--stamp-img` | A new photograph has no recorded size (the gallery lays it out at 3:2 and the row jumps), or a post image has no `width` and `height` and shifts the page as it loads. Fast. |
| `feed` | `generate_feed.py --check` | the script | `feed.xml` carries the full body of the twenty newest posts, so any post edit makes it stale. Fast. |
| `quote-wall` | `generate_quote_wall.py --check` | the script | A quotation added to `data/quotes-all.json` is missing from the static `quotes.html`. Fast. |
| `publications` | `generate_publications.py --check` | the script | The publication list on `data_science.html` and its JSON-LD disagree with `data/publications.json`. Fast. |
| `listing` | `generate_listing_fallback.py --check` | the script | A reader without JavaScript cannot find a new post: the `<noscript>` lists on `blog.html`, `series.html` and the series pages are stale. Fast. |
| `sitemap` | `generate_sitemap.py --check` | the script | A new page or post is missing from `sitemap.xml`, a deleted one stays, or a `lastmod` is wrong. Fast. |
| `monochrome` | `detect_monochrome.py --check` | the script | The gallery's B&W filter disagrees with the pixels. Needs Pillow, so CI runs it in the browser job. |
| `post-head` | `generate_post_head.py --check` | `--fix` | A post's head is missing a canonical element (share card, BreadcrumbList, manifest, asset stamps) or its JSON-LD disagrees with `posts.json`. What it cannot derive (a missing share card, a bad `updated` date) stays a failure for a person. Before the stylesheet build, because the pruner reads the JSON-LD it rewrites. Fast. |
| `css-prune` | `css_prune.py --selftest` | none | The pruner loses a pattern (mixed quotes, a `'stem-' + n` class) and the build silently drops live rules. Fast. |
| `css-rules` | `check_css.py --check` | `--update-baseline` | A `var()` of a property nothing sets, a property nothing reads, a duplicate rule, a second print block, or a rise in the raw-colour, `!important` or hand-written dark-rule counts (`.github/css-baseline.json`). Fast. |
| `css` | `minify_css.py --check` | the script | `style.min.css` is not a fresh build of `style.css`, including when new HTML uses a class the last build pruned. After every generator that writes HTML. Fast. |
| `live-covers` | `check_live_covers.py --check` | none | A post in `posts.json` has no hover sketch in `js/covers.js`. Fast. |
| `docs` | `check_docs.py --check` | none | These docs, the README or a code comment name a path under a tracked top-level folder that git does not track (a rename left a pointer behind), name a private file, or carry a review label. A path into an ignored folder is not seen at all. Fast. |
| `unit-tests` | `python -m unittest discover -s tests -v` | none | See [The unit tests](#the-unit-tests). |
| `js-tests` | `node --test "tests/js/*.test.js"` | none | The browser scripts' pure helpers, under Node's own runner. Keep the quotes: Node expands the glob, and a bare directory is read as one file. |
| `ci-parity` | `run_checks.py --ci-parity` | none | A check added to the registry and not to CI, or the reverse, and so never run where it counts. Fast. |
| `audit` | `audit_site.py --strict` | none | Broken links, missing metadata, invalid JSON-LD, accessibility basics, feed and sitemap coverage, post component rules, retired markup (`#preloader`, an inline analytics snippet), a page missing from `KR_PAGES`, a series without a page, a Markdown file Pages would publish, and the house-style prose rules (banned words and curly quotes in posts and pages, em dashes in posts). `--strict` fails on warnings too: the baseline is zero of both. Fast. |
| `smoke` | `smoke_test.py` | browser | See [The browser suites](#the-browser-suites). |
| `template` | `check_post_template.py` | browser | Every post against the one post template. |
| `perf` | `perf_budget.py` | browser | Layout shift, weight and requests per template, the offline scenario, the manifest. |
| `colophon` | `generate_colophon.py --check` | the script | `colophon.html` publishes measurements of the repository; any change to what it measures makes a figure false. Always last. Fast. |

**The colophon moves with almost everything.** It counts and weighs the
tracked HTML, CSS, JavaScript, images, fonts, data files and build
scripts, and the check steps in `site-checks.yml`. So any edit to one of
those needs `python .github/scripts/generate_colophon.py` (or
`run_checks.py --fix`, which runs it last) before the commit. Commit
counts may lag by `LAG` in `generate_colophon.py`, because the weekly
workflow commits without regenerating it.

## The browser suites

All three use Playwright's Chromium through `.github/scripts/harness.py`,
which serves the tree the way Pages does (a missing path gets `404.html`
with status 404), watches the console, and aborts third-party requests
where a suite asks it to.

- **`smoke_test.py`** loads the pages whose interface is built by script
  and checks that it appears, fits a phone and stays quiet in the
  console; sweeps every top-level page at 360 and 1280 pixels; checks
  every canvas post for fit, progress, reproducibility, keyboard
  operation and reduced motion; runs every hover sketch for 120 frames;
  and runs the regression pins, one per bug that shipped and was fixed
  (its docstring lists each with its bug). `--only` runs one part:
  `pages`, `sweep`, `canvas`, `sketches`, `pins` or `classes`.
- **`check_post_template.py`** reads every post in `posts.json` at
  1440x900 in dark (and five spread through the list in light): one end
  band with its slots in order, opener colours, no tooltip in the
  chrome, one sidenote per cited reference, reading progress reaching
  the end mark, the cursor-lit ring (`.kr-lit`) on every related card, a
  contents rail where
  there are four or more sections, no overflow, a quiet console. Give it
  paths to check only those posts:
  `check_post_template.py blog/<slug>.html`.
- **`perf_budget.py`** measures six templates at a phone and a desktop
  size against `.github/perf-budgets.json`: median layout shift, first-party
  bytes and requests at load, nothing fetched twice, no font twice under
  two names, no blocking script in the head. Then the offline scenario
  (the service worker must still answer after the gallery overfills its
  image cache) and the web app manifest. `--report` prints a table,
  `--only gallery,blog` runs some templates.

For one interactive demo while you build it,
`python .github/scripts/viz_verify.py blog/tabu-search-live.html "#tabu-demo"`
drives it through its handle; see [VIZ-ENGINE.md](VIZ-ENGINE.md#checking-a-demo).

## The unit tests

`tests/` holds standard-library `unittest` cases for the scripts, each
module's docstring naming the decision or incident it pins; `tests/js/`
holds Node tests for the browser scripts' pure helpers, which load the
real files in a `vm` (`tests/js/runtime.js` is the shared loader).

| Module | Pins |
|---|---|
| `test_audit_rules.py` | the audit's structural rules on small inputs |
| `test_prose_rules.py` | the audit's house-style rules, by example |
| `test_check_css.py` | each stylesheet rule on something it must catch and something it must pass |
| `test_check_docs.py` | which words in the docs and comments count as paths, and what may never be named |
| `test_css_prune.py` | selector splitting, and the classes the pruner must never drop |
| `test_contrast.py` | every text token and the focus ring clear AA on every surface, in both themes |
| `test_decisions.py` | decisions that look like mistakes (`overflow: clip` on the opener, gradient text inside `@supports`, derived tokens restated in the dark block) |
| `test_generate_post_head.py` | the post head template, one `--fix` pass from an old post, idempotence |
| `test_generate_publications.py` | the publication list's order, markup and refusals |
| `test_generate_related_posts.py` | the baked card stays `createBlogCardElement`'s card |
| `test_photo_dims.py` | the image header readers and the `--stamp-img` scanner |
| `test_post_body.py` | finding a post's article in its HTML |
| `test_post_components.py` | each markup transform, and the audit rules that hold them |
| `test_reading_parity.py` | `refresh_books.py` (`reading.json`'s `thisYear`) and `js/bookshelf.js` (the reading page's "this year" and calendar) count reading sessions the same way (needs Node) |
| `test_refresh_books.py` | the weekly Goodreads merge never loses a re-read |
| `test_run_checks.py` | the registry's order and the parity parser |
| `test_sitelib.py` | the shared helpers, on the cases their old copies disagreed on |
| `test_structured_data.py` | the homepage and Data Science describe the same person |
| `test_external_links.py` | what the weekly link report counts as gone |
| `tests/js/bookshelf.test.js` | ISO weeks and reading sessions on the calendar |
| `tests/js/post-runtime.test.js` | the end band's routes and neighbours, lead-ins, sidenote references |
| `tests/js/site-chrome.test.js` | `KR_PAGES`, the pager's page list, topic rows, the prerender rules |

```sh
python -m unittest discover -s tests -v            # all
python -m unittest tests.test_check_css -v         # one module
node --test "tests/js/*.test.js"                   # the JavaScript tests
```

## Outside the registry

- **The weekly link report** (`.github/workflows/links.yml`, Mondays
  07:17 UTC) runs `check_external_links.py` over every link that leaves
  the site and keeps one issue, "External link report", open while any
  link is gone. It never fails a run and is not in the registry: its
  answer depends on other people's servers, not on the push. Run it by
  hand with `--list` (what it would check), `--limit N` or `--no-issue`.
- **The weekly data refresh** validates its own files before it commits
  ([DATA.md](DATA.md#the-weekly-files)).

## Adding a check

1. Give the script a `--check` mode that writes nothing and exits 1 when
   the output would change (or when the rule is broken), and parse
   arguments with `sitelib.arg_parser(__doc__)`.
2. Add a `Check(...)` to `CHECKS` in `run_checks.py`, placed after every
   generator whose output it reads, with its fixer if it has one. Mark it
   `fast=True` only if it needs no third-party package and runs in about
   a second. A check that is not a Python script names its program
   (`program="node"`).
3. Add the same command as a named step in `site-checks.yml`, in the same
   position, with `if: ${{ !cancelled() }}` and a comment saying what it
   stops. `run_checks.py --ci-parity` fails until the two agree.
4. `git add -N` the new script, run `run_checks.py --fix` (the colophon
   counts the new step and the new script), and see the check fail on the
   breakage it exists for before trusting it to pass.

## Adding a smoke assertion

- **A pin** for a bug that shipped: a `check_*` function in the "Regression
  pins" section of `smoke_test.py`, taking `(browser, base, rep)`, called
  from `run_pins()`, with the bug named in its docstring and in the module
  docstring. Open pages with `site_context` and `open_page`, which abort
  third parties and block the service worker so the page is the page as
  served.
- **A page check**: a predicate in the `CHECKS` table at the top of
  `smoke_test.py`, for a page whose interface script builds.
- **Prove it bites.** Break the fix in the served response with a
  Playwright route (rewrite one file as it is served; the working tree is
  never touched), watch the assertion fail, then remove the route. An
  assertion that has never failed has not been shown to test anything.
  The service worker script cannot be rerouted, so an offline check needs
  a server handler instead.
- **Waiting.** No fixed sleeps: wait on a predicate with
  `wait_for_function`, so a healthy page moves on at once and a slow one
  fails with a name.

A post-wide rule belongs in `check_post_template.py` instead (its
docstring pins each assertion to its bug); a cost belongs in
`perf_budget.py`.

## Raising a budget

Budgets are about 15% above what was measured when they were set. When a
change is meant to cost more, run `perf_budget.py --report`, raise only
the numbers that change warrants in `.github/perf-budgets.json`, and say
in the commit which change needed the room. Never raise one to make an
unexplained failure pass: the failure names the heaviest files, so find
what grew. The procedure is in `perf_budget.py`'s docstring.

The stylesheet ratchets work the other way: they may only fall.
`check_css.py --report` lists every counted instance by line, and
`check_css.py --update-baseline` lowers `.github/css-baseline.json`
after a change that removed some. A rise is a hand edit to that file,
with the reason in the commit.

## Third-party noise

A third party failing is not this site breaking. `NOISE` in
`.github/scripts/harness.py` is the one list of console text from hosts
the site does not control (analytics, embeds, map tiles, the Bluesky
feed, cover images), and every browser suite ignores a console line
that contains one of its entries. Failed responses need no entry: they
are judged by host. Add to `NOISE` only when a new third-party service
logs errors of its own that the site cannot prevent; never to quiet an
error from `js/` or `data/`, which is exactly what the suites exist to
catch.
