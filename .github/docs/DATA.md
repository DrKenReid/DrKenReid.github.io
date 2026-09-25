# Data

Everything the pages draw from data lives in `data/` as JSON, fetched in
the browser through `krFetchJson` (one request per file per page) and, for
the generated pages, read by the scripts in `.github/scripts/`. Some files
are written by hand, some by a script in the repository, some by the
weekly workflow, and a few by tools kept outside the repository. Which is
which decides whether you may edit a file, so check the table before you
do.

The rule: **never hand-edit a file a script writes.** For most of them,
the check that compares the file with its script's output fails the
build. The weekly files are only checked against `data/schema/`, so a
hand edit passes: the next Monday's run overwrites it (Last.fm, now,
top albums, reading), or, for `books.json`, keeps it as the record and
builds on it, which is why a hand edit there is dangerous.

## Every file

| File | Shape | Written by | Read by | Changes | Checked by | Hand edits |
|---|---|---|---|---|---|---|
| `posts.json` | `[{title, date, tags, category, excerpt, url, image, ...}]`, newest first | you, plus `generate_read_times.py` and `generate_post_facets.py` for their fields | nearly everything: the listing, cards, palette, header, openers, heads, feed, sitemap, share images | every publish | `data-schemas`, `audit`, and every post generator's `--check` | yes, the hand-written fields ([below](#postsjson)) |
| `books.json` | `[{t, a, r, v, i, g, w, d, e, p, m}]`, latest finish first | `refresh_books.py`, weekly | `js/bookshelf.js`, `js/bookwall.js`, `js/literature.js` | weekly | `data-schemas`; `tests/test_refresh_books.py`, `tests/test_reading_parity.py` | no ([Reading](#reading)) |
| `reading.json` | `{books, reviews, thisYear, rereads, updated}` | `refresh_books.py`, weekly | `index.html` (`books` and `reviews` only) | weekly | `data-schemas`; `tests/test_reading_parity.py` (`thisYear`) | no |
| `now.json` | `{track: {name, artist, url, nowPlaying}, reading: [{title, author, link, img}], updated}` | `refresh_now.py`, weekly | `renderNowStrip` (homepage), `js/bookshelf.js` (Reading Now), `js/literature.js` (review links for a book being re-read) | weekly | `data-schemas` | no |
| `lastfm.json` | `{scrobbles, user, updated}` | `refresh_now.py`, weekly | `updateLastfmStats` (the homepage figure) | weekly | `data-schemas` | no |
| `lastfm-history.json` | `[{d, n}]`, the latest 90 refreshes | `refresh_now.py`, weekly | nothing yet; the record of how the count moves | weekly | `data-schemas` | no |
| `topalbums.json` | `{albums: [{name, artist, url, img, plays}], period, updated}` | `refresh_now.py`, weekly | `js/albums.js` (the crate on `music.html`) | weekly | `data-schemas` | no |
| `publications.json` | `{scholar: {profile, citations}, selected, publications: [...]}` | you | `generate_publications.py`, which writes the list and its JSON-LD into `data_science.html` | when a citation count or a paper changes | `data-schemas`, `publications` | yes, then regenerate |
| `colophon.json` | measurements of the repository | `generate_colophon.py` | `colophon.html`; `index.html` (photographs, quotations, series) | whenever a measured file changes | `colophon` | never |
| `photo-dims.json` | `{"<n>": [width, height]}` | `generate_photo_dims.py` | `js/gallery.js` | when thumbnails are added | `photo-dims` | never |
| `photo-tags.json` | `{"<n>": [tags]}` | a tagging tool kept outside the repository; `bw` rewritten by `detect_monochrome.py` | `js/gallery.js` (its filter buttons are `KR_PHOTO_CATEGORIES` in `js/shared-components.js`) | when photographs are added | `monochrome` | subject tags yes; `bw` never |
| `photo-locations.json` | `{_help, regions: [{name, lat, lng, photos: ["<n>"]}]}` | you (its `_help` field says how) | `map.html`, `js/gallery.js` (tile captions, the globe badge), `js/palette.js` (places) | when photographs are placed | none | yes |
| `photography-files.json` | `["<n>.png"]`, newest first: every frame | a filename tool kept outside the repository, or by hand | `js/gallery.js`, `404.html`, `generate_colophon.py`, the audit's orphan report | when photographs are added | the smoke suite (the gallery renders) | yes, carefully |
| `photography-standard-files.json` | `["<n>.png"]`: the frames the photo strip may show | as above | `renderPhotoStrip`, `404.html` | rarely | none | yes |
| `quotes-all.json` | `[{q, a, b}]`: every saved passage (quote, author, book) | an export tool kept outside the repository | `generate_quote_wall.py` (bakes `quotes.html`), `js/literature.js` and `generate_colophon.py` (the count) | occasionally | `quote-wall` | yes, then regenerate |
| `quotes.json` | `[{quote, author, book, popularity}]` | as above | `js/literature.js` (the rotating quotation) | rarely | none | yes |
| `quotes-home.json` | `[{quote, author, book}]` | you | `index.html` (the homepage quotation) | rarely | none | yes |
| `reviews.json` | `[{title, author, rating, review, isbn, isbn13}]`: the selected reviews | an export tool kept outside the repository | `js/literature.js` | rarely | none | yes |
| `popular.json` | `[{url, views}]` | a tool kept outside the repository, from an analytics export | `js/blog.js` (the Popularity sort) | occasionally | none | yes |
| `stories.json` | `[]` | reserved for the short-story section | `renderMoreStories` | not yet | none | |

`data/schema/` holds a schema for every file the pages parse with no
fallback, and for the two central hand-edited files: books, reading, now,
lastfm, lastfm-history, topalbums, posts and publications.

## posts.json

The blog's database: one entry per published post, newest first. The
fields, who writes each and what reads it are in
[COMPONENTS.md](COMPONENTS.md#postsjson). What is worth knowing here:

- It is published. The browser fetches it on every page that shows a
  card, the palette or the header's recent posts, so keep it lean: an
  excerpt is a sentence or two, not the post.
- Order matters. The file is newest first, and the pager, the header and
  the feed take that order as given.
- A post not in the file is a draft. The generators, the audit and the
  sitemap all work from this list, and an untracked HTML file with no
  entry is invisible to all of them.
- The facets (`interactive`, `code`) and the counts (`words`,
  `readMinutes`) are derived from the post's HTML; `run_checks.py --fix`
  rewrites them after any edit to a post.

(The essay: [A Blog Engine in One JSON File](https://www.kenreid.co.uk/blog/blog-engine-in-one-json-file.html).)

## The weekly files

`.github/workflows/lastfm-refresh.yml` runs every Monday at 06:00 UTC
(and on demand) and owns six files, listed once in its `FILES`
variable: `lastfm.json`, `now.json`, `lastfm-history.json`,
`topalbums.json`, `books.json` and `reading.json`.

- `refresh_now.py` fetches Last.fm (with the `LASTFM_API_KEY` secret)
  and the Goodreads currently-reading shelf. A source that fails keeps its
  previous values; the script exits 1 after writing what did refresh.
- `refresh_books.py` fetches the Goodreads read shelf and merges it into
  `books.json`, then writes `reading.json`. It writes nothing when the
  feed looks truncated or short, or when a merge would lose a re-read.
- `validate_data.py` checks all six against their schemas. Nothing that
  fails is committed.

Because the workflow commits to `master` on its own, pull before pushing
on a Monday. Its commits do not regenerate the colophon, which is why the
colophon check tolerates commit counts a little behind (`LAG` in
`generate_colophon.py`).

## Reading

`books.json` is every book on the Goodreads read shelf. The keys are
single letters because every reader of the reading pages downloads the
whole file; `data/schema/books.schema.json` describes each:

| Key | Meaning |
|---|---|
| `t`, `a` | title (series in brackets, as Goodreads gives it) and author |
| `r` | my rating, 0 when unrated |
| `v` | 1 when I wrote a review |
| `i` | ISBN, when Goodreads has one; the cover wall looks covers up by it |
| `g`, `w` | the Goodreads book id and review id; the pages link to `goodreads.com/review/show/<w>` |
| `d` | the date I last finished it; `e: 1` when that is only the date it was added |
| `p` | earlier finish dates, one per earlier read |
| `m` | weekly refreshes in a row that did not see the book |

The feed reports only a book's latest finish, and the full list of
sessions needs a login, so an earlier finish exists nowhere but in `p`.
That is why this file is never regenerated from scratch, and why a hand
edit is dangerous: the merge treats the file as the record.
`refresh_books.py`'s docstring has the merge rules and
`tests/test_refresh_books.py` pins them. The reading calendar, this year's
count and the streak count every session; the shelf files a book once, at
its first read. `tests/test_reading_parity.py` checks that
`refresh_books.py` (`reading.json`'s `thisYear`, computed in Python) and
`js/bookshelf.js` (the reading page's "this year" and calendar, computed
in the browser) count sessions the same way. No page shows `thisYear`
today; the homepage reads only `books` and `reviews` from `reading.json`.

## Photographs

The full-size photographs are not in the repository. GitHub Pages caps a
site at 1 GB, and the originals alone are larger, so they live as assets
of the `photos-v1` release
(`https://github.com/DrKenReid/DrKenReid.github.io/releases/download/photos-v1/<n>.png`,
`KR_RELEASE` in `js/shared-components.js`). The repository holds the
400px thumbnails (`img/photography/thumb/<n>.webp`) and the wide hero
crops the openers use (`img/photography/hero/<n>.webp`). A post links a
thumbnail and the runtime opens the original in the lightbox. (The essay:
[Hosting a Photography Portfolio on GitHub for Free](https://www.kenreid.co.uk/blog/hosting-photography-on-github-for-free.html).)

Adding photographs touches every file in this group:

1. Upload each original to the `photos-v1` release as `<n>.png`, numbering
   on from the highest.
2. Add the thumbnail `img/photography/thumb/<n>.webp` (and a hero crop if
   it will open a page).
3. Add `"<n>.png"` to the top of `photography-files.json` (newest first),
   and to `photography-standard-files.json` if the photo strip may show
   it.
4. Give it subject tags in `photo-tags.json`. The tags come from a
   tagging model run outside the repository (the essay
   [Building a Photo Tagging System with CLIP](https://www.kenreid.co.uk/blog/photo-tagging-with-clip.html)
   describes it); the gallery's filter buttons are `KR_PHOTO_CATEGORIES`
   in `js/shared-components.js`.
5. Place it in a region of `photo-locations.json` if it belongs on the
   map ([Putting My Photos on a Map](https://www.kenreid.co.uk/blog/putting-my-photos-on-a-map.html)).
6. `git add -N` the new images, then run `run_checks.py --fix`:
   `generate_photo_dims.py` records the thumbnail's size (the gallery lays
   out rows from it; a frame without one is assumed 3:2),
   `detect_monochrome.py` decides its `bw` tag from its pixels, and the
   colophon counts it.

The `bw` tag is decided by pixels only: a frame counts when its chroma is
low almost everywhere, so a selective-colour photograph (a grey street and
one pink coat) does not pass. The thresholds and the rule that was tried
and dropped are in `detect_monochrome.py`'s docstring.

## Quotations

`quotes-all.json` is every saved passage, baked into `quotes.html` as
static HTML by `generate_quote_wall.py`, so the wall reads without
JavaScript and search engines see the quotations; the page's script adds
search and filters. Edit the JSON and rerun the script (`run_checks.py
--fix` does). `quotes.json` (the literature page's rotating quotation)
and `quotes-home.json` (the homepage's) are short hand-picked lists.

## Adding a data file

1. Put it in `data/`, and read it with `krFetchJson('data/<name>.json')`.
2. If a page parses it with no fallback, give it a schema:
   `data/schema/<name>.schema.json` is picked up by `validate_data.py`
   with no other change. The validator enforces `type`, `properties`,
   `required`, `additionalProperties` (as a boolean), `items`, `enum`,
   `minimum`, `maximum` and `pattern`, and exits 2 on any other keyword
   rather than ignoring it.
3. If a script writes it, give the script a `--check` mode and register
   it ([TESTING.md](TESTING.md#adding-a-check)).
4. Add a row to the table above.
