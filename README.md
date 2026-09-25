# kenreid.co.uk

[![Site checks](https://github.com/DrKenReid/DrKenReid.github.io/actions/workflows/site-checks.yml/badge.svg?branch=master)](https://github.com/DrKenReid/DrKenReid.github.io/actions/workflows/site-checks.yml)

The personal site of Ken Reid: data science and research, a blog, a
gallery of photographs, and what he is reading and listening to. It is a
static site with no framework, served by GitHub Pages straight from this
repository, and every generated file in it is checked against its source
on every push.

**Live site:** [kenreid.co.uk](https://www.kenreid.co.uk)

## Pages

- **Home**: an introduction and the latest posts
- **About**: background and interests
- **Blog** and **Series**: every post, filterable, and the posts that run in parts
- **Data Science**: projects, publications and the CV
- **Photography** and **Photo Map**: every photograph, filterable by subject, and by place
- **Music**: guitar and Last.fm listening statistics
- **Literature**, **Every Book** and **Quote Wall**: reading now, the reading calendar, reviews, every book read and passages saved while reading
- **Contact**, **Colophon** (how the site is built, measured) and **Privacy**

## How it is built

- **Plain HTML, CSS and JavaScript.** No framework, no bundler, no build
  step on the server. Each page is an HTML file; the header, footer, post
  cards and everything around a blog post are drawn by
  `js/shared-components.js`.
- **One stylesheet.** `style.css` is the source; `style.min.css`, the file
  pages load, is built from it and from the vendor sheets it imports, with
  every rule no page can use pruned away.
- **Bootstrap 4's CSS** for the grid and utilities, and none of its
  JavaScript.
- **jQuery 2.2.4, for two plugins only**: Owl Carousel (the homepage hero
  and the photo strip) and Magnific Popup (the lightbox), both in
  `js/alime.bundle.js`. The site's own scripts touch jQuery only to
  drive those two plugins.
- **Leaflet** for the photo map, vendored in `js/vendor/leaflet/`.
- **Self-hosted fonts**: Lora and Poppins, and icon fonts subset to the
  glyphs the site uses.
- **A service worker** (`sw.js`) for offline reading.
- **Data** in `data/*.json`: the blog is one file, `data/posts.json`.
  Last.fm listening and the Goodreads shelf are refreshed every Monday by
  a GitHub Actions workflow that commits the result.
- **Python scripts** in `.github/scripts/` generate what a build step
  would (the share images, the feed, the sitemap, post heads, the
  minified stylesheet) and check everything: one ordered registry of
  static checks, plus three browser suites in Playwright's Chromium. CI
  runs the same list on every push to `master` and every pull request.

The full picture, with the reasons for each choice, is in the developer
docs: **[.github/docs](.github/docs/README.md)**.

## Running it locally

```sh
git clone https://github.com/DrKenReid/DrKenReid.github.io.git
cd DrKenReid.github.io
python -m http.server 8000
```

Then open <http://localhost:8000/>. Serve from the repository root: the
pages use root-absolute paths (`/js/site.js`), as they do on the live site.

To run the checks, or to change anything that is generated:

```sh
python -m venv .venv
.venv/Scripts/pip install -r .github/scripts/requirements.txt    # .venv/bin/pip on macOS and Linux
.venv/Scripts/python -m playwright install chromium
.venv/Scripts/python .github/hooks/install.py                    # the pre-commit hook
.venv/Scripts/python .github/scripts/run_checks.py               # every static check
.venv/Scripts/python .github/scripts/run_checks.py --fix         # regenerate what is stale, then check
.venv/Scripts/python .github/scripts/run_checks.py --browser     # add the browser suites
```

The pre-commit subset (`--fast`) needs only Python and git. A full
`run_checks.py` also runs the monochrome check, which needs Pillow, and
the JavaScript tests need Node 21 or later; the packages are also for
the browser suites and a few generators.
[TESTING.md](.github/docs/TESTING.md) covers every check.

## Repository map

| Path | What it holds |
|---|---|
| `index.html`, `about.html`, `blog.html` ... | the top-level pages, one file each |
| `series-*.html` | a landing page for each blog series |
| `blog/` | the posts, and the images that belong to them (`blog/img/`) |
| `js/` | the site's scripts; `js/shared-components.js` is the shared runtime |
| `style.css` | the one stylesheet to edit; `style.min.css` is built from it |
| `css/`, `fonts/` | vendor stylesheets and fonts, imported into the build |
| `img/` | photograph thumbnails and hero crops, share cards (`img/og/`), icons |
| `data/` | the JSON the pages and generators read; `data/schema/` describes the shapes |
| `docs/` | the CV and the thesis, as PDFs |
| `sw.js`, `offline.html`, `manifest.json` | offline reading and the installable app |
| `feed.xml`, `sitemap.xml` (generated) and `robots.txt` | for readers and crawlers |
| `.github/scripts/` | the generators and the checks, with `run_checks.py` as the one list |
| `.github/workflows/` | CI (`site-checks.yml`), the weekly data refresh and the weekly link report |
| `.github/docs/` | the developer docs |
| `.github/hooks/` | the pre-commit hook and its installer |
| `tests/` | unit tests for the scripts (`unittest`) and for the browser helpers (`tests/js/`, Node) |

The full-size photographs are not in the repository: they are assets of
the `photos-v1` release, because GitHub Pages caps a site at 1 GB.

## How This Site Is Built

A series on the blog explains the thinking behind most of this, for a
general reader:

1. [Building a Photo Tagging System with CLIP](https://www.kenreid.co.uk/blog/photo-tagging-with-clip.html)
2. [How to Write a Blog (or: What I Learned By Doing It)](https://www.kenreid.co.uk/blog/how-to-write-a-blog.html)
3. [Hosting a Photography Portfolio on GitHub for Free](https://www.kenreid.co.uk/blog/hosting-photography-on-github-for-free.html)
4. [Reading This Site Offline](https://www.kenreid.co.uk/blog/reading-this-site-offline.html)
5. [Self-Hosting Your Fonts](https://www.kenreid.co.uk/blog/self-hosting-your-fonts.html)
6. [Putting My Photos on a Map](https://www.kenreid.co.uk/blog/putting-my-photos-on-a-map.html)
7. [Free Comments via GitHub Discussions](https://www.kenreid.co.uk/blog/free-comments-via-github-discussions.html)
8. [My Website Has a Test Suite](https://www.kenreid.co.uk/blog/my-website-has-a-test-suite.html)
9. [A Blog Engine in One JSON File](https://www.kenreid.co.uk/blog/blog-engine-in-one-json-file.html)
10. [Ctrl+K for a Static Site](https://www.kenreid.co.uk/blog/ctrl-k-for-a-static-site.html)
11. [The Invisible Half of a Blog Post](https://www.kenreid.co.uk/blog/invisible-half-of-a-blog-post.html)
12. [Dark Mode That Doesn't Flash](https://www.kenreid.co.uk/blog/dark-mode-that-doesnt-flash.html)
13. [Letting Robots Update Your Homepage](https://www.kenreid.co.uk/blog/letting-robots-update-your-homepage.html)
14. [How the Interactive Posts Work](https://www.kenreid.co.uk/blog/how-the-interactive-posts-work.html)
15. [Making This Website Accessible](https://www.kenreid.co.uk/blog/making-this-website-accessible.html)
16. [Every Card Has a Sketch](https://www.kenreid.co.uk/blog/every-card-has-a-sketch.html)

Each essay describes its system as it was first built; where one and the
code disagree, the code and the developer docs are current.

## Deployment

GitHub Pages serves the `master` branch, with the custom domain in
`CNAME`. A push to `master` is a deploy. Pages publishes independently of
the site checks, so run them before pushing.

## License

- **Website code & markup**: [Apache License 2.0](LICENSE)
- **Photography & media assets**: [Creative Commons Attribution-NonCommercial-NoDerivatives 4.0](https://creativecommons.org/licenses/by-nc-nd/4.0/) — All photographs and image files are copyright © Ken Reid. Use requires attribution and is limited to non-commercial purposes with no derivatives.

## Template

Based on the [Alime Photography HTML Template](https://colorlib.com/wp/template/flavor/) by [Colorlib](https://colorlib.com). Premium license purchased — attribution not required.

## Links

[![Instagram](https://img.shields.io/badge/Instagram-%23E4405F.svg?logo=Instagram&logoColor=white)](https://instagram.com/drkenreid) [![LinkedIn](https://img.shields.io/badge/LinkedIn-%230077B5.svg?logo=linkedin&logoColor=white)](https://linkedin.com/in/kennethneilreid) [![Bluesky](https://img.shields.io/badge/Bluesky-0285FF?logo=bluesky&logoColor=white)](https://bsky.app/profile/kenreid.co.uk)
