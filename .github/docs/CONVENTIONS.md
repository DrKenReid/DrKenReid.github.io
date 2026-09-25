# Conventions

The rules the code already follows, and the reasons for them. Match them in
new work; where an old file does not, leave it better than you found it
rather than rewriting it wholesale.

## Naming

**Classes.** The site's own classes start `kr-` and follow BEM:
`kr-block`, `kr-block__element`, `kr-block--modifier`
(`.kr-opener__title`, `.kr-btn--ghost`, `.kr-post-end__slot`). The prefix
separates what the site owns from the template's and Bootstrap's names,
which still style a lot of markup, and makes a class searchable across
HTML, JS and CSS in one grep.

Some older names are kept on purpose because other code finds elements by
them: `.breadcrumb-area` (the page opener; the print sheet, the view
transition and `initHeroTransitions` all look for it), `.blog-card` and
`.single-post-area` (the two post cards), `.blog-post` (the article; every
generator finds a post's body by it), `.section-heading`,
`.plain-english-box`, `.faq-item`. Do not rename one without searching
every script under `js/` and `.github/scripts/` for it.

State classes that script toggles are short and unprefixed where the
component scopes them: `.is-visible`, `.is-far`, `.active`, `.is-on`.
Each stylesheet section lists the classes only script applies, because
the stylesheet pruner cannot always see them (below).

**JavaScript.** Shared helpers are plain globals prefixed `kr`
(`krFetchJson`, `krEscapeHtml`, `krOnScroll`); site constants are
`KR_UPPER_CASE` (`KR_PAGES`, `KR_ROUTES`, `KR_RELEASE`). Two verbs carry
meaning:

- `render*` draws markup into a host the page names (`renderHeader`,
  `renderTopicPosts`, `renderPostEnd`).
- `init*` wires behaviour onto markup that already exists
  (`initEmbedFacades`, `initPostSidenotes`, `initLiveCovers`).

A page script wraps itself in an IIFE and exposes at most one start
function (`js/blog.js` exposes `initBlog`, `js/series-index.js`
`initSeriesIndex`; `js/literature.js` exposes nothing and starts itself).
`js/gallery.js` is the exception still to be brought in line: it has no
IIFE and defines its functions as top-level globals.
The larger engines expose one object: `window.KRViz` (`js/kr-viz.js`),
`window.krLiveCovers` (`js/live-covers.js`), `window.krPalette`
(`js/palette.js`), `window.krNavMenu` (`js/site.js`).

**Python.** Scripts in `.github/scripts/` are named for what they do to
the site: `generate_*` writes an output, `check_*` only reads, `refresh_*`
fetches from the network. Shared helpers go in `sitelib.py`, never a
private copy (its docstring lists the copies that drifted before it
existed).

## Tokens, not literals

The site's colours, surfaces, radii, shadows and label sizes are custom
properties in `style.css` §01, set on `:root`. A token whose value
differs by theme is restated under `:root[data-theme="dark"]`; the
theme-independent ones (the radii, shadows, label and display sizes,
`--kr-action-fill`, the photograph colours) are set once. A rule that
reads a token follows the theme by itself and needs no dark twin; a rule
with a literal colour is the same colour on both pages, which is how
dark-theme text once ended up at 2.3:1. So:

- read a token (`color: var(--kr-muted)`), never a new hex value;
- if no token fits, add one to §01 (in both blocks if it differs by
  theme), with its measured contrast in the comment beside it
  (`tests/test_contrast.py` re-measures every text token on every run);
- a block that overrides a token another token is built from (the dark
  block, or a scoped override) restates the built one too, because a
  `var()` in a custom property is resolved where it is declared
  (`tests/test_decisions.py`, `DerivedTokensAreRestated`);
- a literal that must stay (a photograph's scrim, a brand colour on a
  share button) keeps its dark twin directly after it.

`check_css.py` holds three counts over `style.css` that may only go down:
raw colour literals outside the token blocks, `!important`, and
hand-written dark-theme rules (`.github/css-baseline.json`). New code that
adds one fails the build; code that removes one lowers the baseline with
`python .github/scripts/check_css.py --update-baseline`.
[DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) lists the tokens.

## The stylesheet

`style.css` is the only stylesheet to edit. Pages load `style.min.css`,
which `python .github/scripts/minify_css.py` builds: it inlines the
vendor sheets `style.css` imports, minifies, swaps the icon fonts for
subsets, and prunes every rule whose selectors cannot match anything in
the tracked HTML and JS. Never edit `style.min.css`; `minify_css.py
--check` fails while it is stale.

- **Sections.** The file is 23 numbered sections, each opened by a banner
  `/* ==== :: §NN Name ==== */`, listed in the contents at the top. New CSS
  goes in the section of the component it belongs to, never appended at
  the end. A new component gets a sub-banner (`/* --- Name --- */`) that
  says what builds it, which classes only script applies, and which
  tokens it reads.
- **The pruner reads tracked files.** It scans `git ls-files`, not the
  folder. A new page or script is invisible to it until
  `git add -N <file>`, and its classes are pruned from the built file
  until then.
- **Classes built at runtime.** The pruner sees `class=` attributes and
  every string literal in the scripts, including a literal stem of six or
  more characters, holding a hyphen or an underscore, followed by `+` or,
  in a template literal, by `${` (`'kr-spine--r' + rating` and
  `` `kr-spine--r${rating}` `` both keep every `kr-spine--r*` rule; a
  stem starting `data-`, `js-`, `ms-` or `-webkit-` never counts). A
  class assembled any other way, from a variable alone or with `join`,
  must go in `RUNTIME_TOKENS` in `css_prune.py`, or its rule disappears
  without a warning. This is how the hero headline once lost its
  animation.
- **Publishing can make the build stale** with no CSS edit, because a
  post may use a class for the first time. `run_checks.py --fix` rebuilds.
- **A new icon** (`fa-*`, `ti-*`, `icon_*`) needs
  `python .github/scripts/subset_icon_fonts.py` before the build.
- **Gradient text** (`background-clip: text`) sits inside
  `@supports ((-webkit-background-clip: text) or (background-clip: text))`
  with a solid colour outside it: transparent text without clip support
  is invisible text. `tests/test_decisions.py` checks.
- **One print block**, §23. `check_css.py` fails on a second.

## JavaScript

- **No build, no modules.** Every script is a classic `<script>` sharing
  globals, served as written. There is no transpiler, so nothing may use
  syntax the browser would have to have compiled for it, and there are no
  `import` statements.
- **Match the file.** The shared runtime (`js/shared-components.js`,
  `js/site.js`, `js/theme.js`, `js/kr-viz.js`, `js/live-covers.js`) is
  written in ES5 syntax: `var`, `function`, no arrow functions. Every page
  depends on it, and a syntax error there takes the header, footer and
  post furniture down with it. `js/palette.js` uses ES2018 syntax
  (`const`, arrow functions, `for...of`, spread), which every browser the
  site supports parses. Newer APIs are used where they help and are tested for
  first (`'IntersectionObserver' in window`, `HTMLScriptElement.supports`),
  with the page still working without them.
- **`'use strict'`** inside each IIFE in new code. Older files that
  predate the rule run without it: `js/theme.js`,
  `js/shared-components.js`, `js/gallery.js`, `js/albums.js`,
  `js/nerd-mode.js` and `js/prism-loader.js`. Adding it to one is a
  behaviour change (a silent assignment becomes an error), so test the
  pages that load it.
- **Scroll work goes through `krOnScroll(fn)`**: `fn` measures and
  returns a function that writes, so every scroll handler on the page
  reads layout together and writes together, once a frame.
- **No inline styles for state.** Toggle a class or the `hidden`
  attribute; the stylesheet decides what it looks like.

### Escaping

Anything from data (a title, an excerpt, a book's author, a URL) that goes
into `innerHTML` passes through `krEscapeHtml(s)`, which is safe in text
and inside a quoted attribute. Prefer `textContent` where no markup is
needed. `createBlogCardElement` escapes every field itself, so pass it raw
data. Titles in `posts.json` contain apostrophes and ampersands, and a
Goodreads title can contain anything.

### Cards

Every post card is built by `createBlogCardElement(post, options)` in
`js/shared-components.js`: `cardStyle: 'overlay'` for the photograph card
of the blog listing, the default stacked card everywhere else. It adds the
cursor-lit ring (`.kr-lit`), the cover glow (`.kr-glow-host`), the live
cover hook and the prerender rules, so a card built any other way would
be the one that does not glow, sketch or prerender. The related-post
cards baked into each post are the same markup written by
`generate_related_posts.py`; a change to one builder is a change to both
(`tests/test_generate_related_posts.py` pins the Python side).

### Data

Fetch site data through `krFetchJson(path)`, and the post list through
`loadBlogPosts()`. Each file is requested once per page however many
components ask (the smoke suite checks), the path works from any folder
depth, and a failure rejects with the URL in the message. The parsed value
is shared by every caller: treat it as read-only and `slice()` before
sorting.

## `data-*` hosts

Markup opts into behaviour with attributes rather than script calls, so a
page gains a component by writing HTML.

| Attribute | On | Does |
|---|---|---|
| `data-live="<key>"` | any element | makes it a hover-sketch host (`js/live-covers.js`); keys are the post slugs and the prefixed site keys in `js/covers-site.js` |
| `data-live-host` | a child of a host | that child is the canvas box |
| `data-live-arg` | a host | JSON passed to the sketch (the globe's latitude and longitude) |
| `data-live-under` | a host | the canvas goes under the host's text, which turns light while it runs (the post pager) |
| `data-live-href` | a host | which post's sketch to run, when the host is not a link to it |
| `data-topic-tags` | an empty `div` between sections | renders a "writing about" row (`renderTopicPosts`); also `data-topic-urls`, `data-topic-limit`, `data-topic-more`, `data-topic-eyebrow`, `data-topic-title` |
| `data-embed-src`, `data-embed-title` | `button.kr-embed-facade` | swapped for the iframe on click (`initEmbedFacades`); `data-embed-height` overrides the 16:9 box for a non-video embed |
| `data-fullres`, `data-fullres-size` | `.blog-post` | the full-resolution switch on a photography post (`initFullResMode`) |
| `data-no-toc` | `.blog-post` | no contents rail for this post |
| `data-kr-root` | `<html>` | the path back to the site root, for a page served at URLs it does not live at (`404.html`) |
| `data-kr-toolbar`, `data-kr-sliders`, `data-kr-stats` | children of `.kr-viz` | where the demo engine builds its controls ([VIZ-ENGINE.md](VIZ-ENGINE.md)) |
| `data-series` | `#series-page` | which series a landing page lists |
| `data-bg` | a homepage hero slide | its photograph, painted after load |
| `data-lit`, `data-colo` | an element holding a placeholder (`&mdash;` on the colophon) or a fallback figure (`literature.html`) | replaced with a figure from data (`js/literature.js`, `colophon.html`); the smoke sweep fails if an em dash placeholder is left in any `[data-colo]`, `[data-lit]` or `[data-count]` |

## File headers

Every first-party script opens with a comment that answers four
questions, so the next reader knows what the file is for before reading
it. New files use this shape:

```js
/**
 * <file>.js: <what it is, in one line>.
 *
 * Purpose
 *   What it does on which pages, and what it deliberately does not do.
 *
 * Loaded by
 *   Which pages load it, how (deferred in the head, after
 *   shared-components.js), and what must load first.
 *
 * Exposes
 *   The globals other code may call, with their signatures. "Nothing"
 *   is a good answer.
 *
 * Design notes
 *   The decisions that look arbitrary without their reason, the traps
 *   they avoid, and a link to the essay that explains the system, if
 *   there is one.
 */
```

Older files use their own headings for the same ground (`js/palette.js`:
WHAT IT FINDS, LOADED BY, RANKING; `sw.js`: caches, strategy,
versioning); keep them, and keep them current. Python scripts put the
same four answers in the module docstring, which `sitelib.arg_parser`
turns into the script's `--help`.

## Comments

A comment says why: the decision, the bug it prevents, the constraint
that is not visible in the code, how to reuse the thing. It does not
narrate the next line. Name the file and function a reader should look at
(`see renderPostEnd`), because `check_docs.py` checks that every path a
comment names exists. Do not refer to private notes, drafts or
review labels; say the reason itself.

## Python scripts

- Standard library only, except where a script says otherwise
  (`.github/scripts/requirements.txt` lists the few that need Pillow,
  fontTools or Playwright). Every `--check` mode except
  `detect_monochrome.py`'s runs without a package, which is what lets the
  CI audit job and the pre-commit hook install nothing.
- Parse arguments with `sitelib.arg_parser(__doc__)`: the docstring
  becomes `--help`, and abbreviations are refused so a mistyped flag
  cannot be taken for one that rewrites files.
- A generator writes by default and has `--check`, which writes nothing
  and exits 1 when the output would change. `--check` is what CI and
  `run_checks.py` run; see [TESTING.md](TESTING.md#adding-a-check).
- Read the corpus with `sitelib.tracked(...)` (git ls-files), so a run on
  a laptop with untracked work in progress reads the same files as CI.
- Keep a file's line endings when rewriting it (the working copy may be
  CRLF, the repository stores LF) and make every generator idempotent: a
  second run changes nothing.

## Writing for readers

Visible copy on the site is British English (the pages declare
`lang="en-GB"`), in sentence case for labels and buttons. Post prose has
no em dashes (the audit's `em-dash` rule); the top-level pages use them
only in project and publication lines, which the rule leaves out. Post
prose belongs to its author; a change to how the site works never
rewrites what a post says.
