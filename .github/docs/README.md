# Developer docs

How kenreid.co.uk is built, why it is built that way, and how to change it
without breaking it. The repository's front page (`README.md`) says how to
run the site locally; these pages are for working on it.

They live under `.github/` because GitHub Pages never publishes a folder
whose name starts with a dot, so nothing here becomes a page of the site.
Keep them there: a Markdown file anywhere else in the tree is published
beside the site, and the audit fails on it (`audit_site.py`, the
`published-markdown` rule), except `README.md` and `blog/downloads/`,
which are published on purpose, and anything `_config.yml` excludes.

| Page | Read it when you are |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | finding your way round: page anatomy, script order, the two boot phases, what loads late, the generators and the weekly jobs, and a table of where to change what. Adding a page or a series. |
| [CONVENTIONS.md](CONVENTIONS.md) | writing code: naming, tokens, the JavaScript baseline, `data-*` hosts, file headers, escaping, the shared helpers to reuse. |
| [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) | styling anything: the tokens in both themes with their measured contrast, the shared components and the three rules. Adding a component. |
| [COMPONENTS.md](COMPONENTS.md) | writing or editing a post: the post skeleton, every post component, what the runtime adds by itself, `posts.json`, and the hover sketch every post needs. |
| [VIZ-ENGINE.md](VIZ-ENGINE.md) | building an interactive demo on `js/kr-viz.js`. |
| [DATA.md](DATA.md) | touching anything under `data/`: who writes each file, who reads it, how often, and whether a hand edit is safe. |
| [TESTING.md](TESTING.md) | running the checks, reading a failure, or adding a check, a smoke assertion or a budget. |

## The short version

- Plain HTML, CSS and JavaScript, served by GitHub Pages from `master`
  with no build step on the server. Everything that is generated (the
  stylesheet, the share images, the feed, the sitemap, the post heads,
  parts of `data/`) is generated locally and committed.
- `style.css` is the only stylesheet you edit; `style.min.css` is built
  from it. See [CONVENTIONS.md](CONVENTIONS.md#the-stylesheet).
- `js/shared-components.js` draws the header, footer, cards and all the
  furniture around a post. A site-wide change is made there, not in
  ninety HTML files.
- `data/posts.json` is the blog. Listings, cards, the palette, openers,
  heads, the feed and the sitemap are all built from it.
- `python .github/scripts/run_checks.py` runs every check in dependency
  order; `--fix` regenerates whatever is stale first. The same list runs
  in CI on every push to `master` and every pull request.

## The essays

The site's series "How This Site Is Built" explains the thinking behind
most of these systems for a general reader. Each essay describes its
system as first built; where an essay and these docs disagree, the docs
and the code are current.

| Subsystem | Essay | Docs |
|---|---|---|
| Photo tags and the gallery filter | [Building a Photo Tagging System with CLIP](https://www.kenreid.co.uk/blog/photo-tagging-with-clip.html) | [DATA.md](DATA.md#photographs) |
| Full-size photographs on a release | [Hosting a Photography Portfolio on GitHub for Free](https://www.kenreid.co.uk/blog/hosting-photography-on-github-for-free.html) | [DATA.md](DATA.md#photographs) |
| Service worker and offline reading | [Reading This Site Offline](https://www.kenreid.co.uk/blog/reading-this-site-offline.html) | [ARCHITECTURE.md](ARCHITECTURE.md#the-service-worker) |
| Self-hosted fonts and icon subsets | [Self-Hosting Your Fonts](https://www.kenreid.co.uk/blog/self-hosting-your-fonts.html) | [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md#type) |
| The photo map | [Putting My Photos on a Map](https://www.kenreid.co.uk/blog/putting-my-photos-on-a-map.html) | [DATA.md](DATA.md#photographs) |
| Comments | [Free Comments via GitHub Discussions](https://www.kenreid.co.uk/blog/free-comments-via-github-discussions.html) | [COMPONENTS.md](COMPONENTS.md#what-the-runtime-adds) |
| The checks | [My Website Has a Test Suite](https://www.kenreid.co.uk/blog/my-website-has-a-test-suite.html) | [TESTING.md](TESTING.md) |
| `posts.json` and the listing | [A Blog Engine in One JSON File](https://www.kenreid.co.uk/blog/blog-engine-in-one-json-file.html) | [DATA.md](DATA.md#postsjson) |
| The command palette | [Ctrl+K for a Static Site](https://www.kenreid.co.uk/blog/ctrl-k-for-a-static-site.html) | [ARCHITECTURE.md](ARCHITECTURE.md#where-to-change-what) |
| Post heads, feeds and structured data | [The Invisible Half of a Blog Post](https://www.kenreid.co.uk/blog/invisible-half-of-a-blog-post.html) | [COMPONENTS.md](COMPONENTS.md#the-head) |
| The theme and dark mode | [Dark Mode That Doesn't Flash](https://www.kenreid.co.uk/blog/dark-mode-that-doesnt-flash.html) | [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md#two-themes) |
| The weekly data refresh | [Letting Robots Update Your Homepage](https://www.kenreid.co.uk/blog/letting-robots-update-your-homepage.html) | [ARCHITECTURE.md](ARCHITECTURE.md#the-weekly-jobs) |
| Interactive demos | [How the Interactive Posts Work](https://www.kenreid.co.uk/blog/how-the-interactive-posts-work.html) | [VIZ-ENGINE.md](VIZ-ENGINE.md) |
| Accessibility | [Making This Website Accessible](https://www.kenreid.co.uk/blog/making-this-website-accessible.html) | [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md#accessibility) |
| Hover sketches | [Every Card Has a Sketch](https://www.kenreid.co.uk/blog/every-card-has-a-sketch.html) | [COMPONENTS.md](COMPONENTS.md#the-hover-sketch) |

The series page is `series-how-this-site-is-built.html`; the posts are
the entries in `data/posts.json` whose series is "How This Site Is
Built".

## Keeping these docs true

`python .github/scripts/check_docs.py --check` runs in CI and in the
pre-commit hook. It fails when a path written in these pages, in the
README or in a code comment names a file under a folder the repository
tracks that git does not track (a rename that left a pointer behind),
when tracked text names a private file, and on a leftover review label.
A path into a folder git ignores is not recognised as a path at all, so
it cannot catch that; do not name one. Write a pattern
with a placeholder (`img/og/<slug>.jpg`) rather than a made-up name. It
cannot tell whether a sentence is still true, so when you change how
something works, change the page that describes it in the same commit.
