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
| `posts.json` | `[{title, date, tags, category, excerpt, url, image, ...}]`, newest first | you, plus `generate_read_times.py` and `generate_post_facets.py` for their fields | nearly everything: the listing and its series band, cards, palette, header, openers, heads, feed, sitemap, share images | every publish | `data-schemas`, `audit`, and every post generator's `--check` | yes, the hand-written fields ([below](#postsjson)) |
| `books.json` | `[{t, a, r, v, i, g, c, k, s, n, y, gn, w, d, e, p, m}]`, latest finish first (`n` pages, for Reading Stats' pages figures; `y` the year first published and `gn` one or two genres, for the wall's filters; `k` and `s` mark a book whose cover the site has a copy of, full and small) | `refresh_books.py`, weekly; `y` and `gn` by `refresh_book_details.py`, which runs after it | `js/bookshelf.js`, `js/bookwall.js` (the wall's filters and sorts), `js/literature.js`, `js/slideshow.js` (`show=books`: the rated books and their covers, `k` in front and `s` on the wall; `show=quotes`: each quote's book, its cover and year), `js/palette.js` (the author rows, once the reader types) and `js/post-shelf.js` (a book post's From my shelf strip) | weekly | `data-schemas`; `tests/test_refresh_books.py`, `tests/test_reading_parity.py`, `tests/test_refresh_book_details.py` | no ([Reading](#reading)) |
| `book-details.json` | `{books: [{g, year, yearFrom, labels, labelsFrom, asked}]}`, by Goodreads id: what is known of each book's first year and genres, and where from | `refresh_book_details.py`: weekly from Open Library for new books, and from a Goodreads export with `--export` | `refresh_book_details.py` only, which sets `y` and `gn` in `books.json` from it; no page | weekly | `data-schemas`; `tests/test_refresh_book_details.py` (`books.json` agrees with it) | no ([Years and genres](#years-and-genres)) |
| `book-overrides.json` | `{_help, books: [{g, t, gn?, y?}]}`: hand corrections to a book's genres or year | you (its `_help` field says how) | `refresh_book_details.py` | when a book is placed wrong | `data-schemas`; `tests/test_refresh_book_details.py` (every id on the shelf, every genre known) | yes, then `refresh_book_details.py --offline` |
| `reading.json` | `{books, reviews, thisYear, rereads, updated}` | `refresh_books.py`, weekly | `index.html` (`books` and `reviews` only) | weekly | `data-schemas`; `tests/test_reading_parity.py` (`thisYear`) | no |
| `now.json` | `{track: {name, artist, url, nowPlaying}, reading: [{title, author, link, img}], updated}` (`img` a path to the site's small copy of the cover) | `refresh_now.py`, weekly | `renderNowStrip` (homepage), `js/bookshelf.js` (Reading Now, dated by `updated`), `js/literature.js` (review links for a book being re-read) | weekly | `data-schemas` | no |
| `lastfm.json` | `{scrobbles, user, updated}` | `refresh_now.py`, weekly | `updateLastfmStats` (the homepage figure) | weekly | `data-schemas` | no |
| `lastfm-history.json` | `[{d, n}]`, the latest 90 refreshes | `refresh_now.py`, weekly | nothing yet; the record of how the count moves | weekly | `data-schemas` | no |
| `topalbums.json` | `{albums: [{name, artist, url, img, plays}], period, updated}` | `refresh_now.py`, weekly | `js/albums.js` (the crate on `music.html`, dated by `updated`), `js/slideshow.js` (`show=music`) | weekly | `data-schemas` | no |
| `listening.json` | `{user, registered, updated, weeks: [{d, n, a, p}]}`: a record per Last.fm chart week over the whole account, oldest first (`d` the day the week starts, `n` its scrobbles, `a` and `p` its most played artist and that artist's plays) | `refresh_listening.py`, weekly | `js/listening.js` (the listening calendar and its figures on `music.html`, which stay hidden while the file has no weeks) | weekly | `data-schemas`; `tests/test_refresh_listening.py`, `tests/js/listening.test.js` | no ([Listening](#listening)) |
| `bluesky.json` | `{posts: [{slug, uri, url, posted}]}`, the newest share first: the Bluesky post each blog post was shared in (`slug` the post's file name without its extension, `uri` the Bluesky post's at:// address, `url` its page on bsky.app, `posted` when) | `refresh_bluesky.py`, weekly | `renderPostEnd` (looks this post up once the comments come near) and `js/bluesky-replies.js` (the replies under the post) | when a post is shared | `data-schemas`; `tests/test_refresh_bluesky.py`, `tests/js/bluesky-replies.test.js` | only to add a share the script cannot find ([Bluesky shares](#bluesky-shares)) |
| `publications.json` | `{scholar: {profile, citations}, selected: {mostCited, mostRecent}, publications: [...]}` | you | `generate_publications.py`, which writes the list and its JSON-LD into `data_science.html` | when a citation count or a paper changes | `data-schemas`, `publications` | yes, then regenerate |
| `colophon.json` | measurements of the repository | `generate_colophon.py` | `colophon.html`; `index.html` (photographs, quotations, series); `js/literature.js` (quotations) | whenever a measured file changes | `colophon` | never |
| `photo-dims.json` | `{"<n>": [width, height]}` | `generate_photo_dims.py` | `js/gallery.js` (the justified rows and the orientation filter), `index.html` (the Latest section's photography lane), `js/slideshow.js` (`show=quotes&behind=photos`: a photograph shaped like the screen) | when thumbnails are added | `photo-dims` | never |
| `photo-originals.json` | `{"<n>": [width, height]}`, the full-size frame on the release | `generate_photo_renditions.py` (reads each PNG's header with a ranged request) | the same script: a hero is made at `HERO_EDGE` or the original's own size, whichever is smaller | when frames are added | `renditions` | never |
| `photo-colours.json` | `{red: [<n>, ...], orange, yellow, green, teal, blue, purple, pink, brown, none}`: every frame's number under its main colour, or under `none` when it has too little colour to have one | `generate_photo_colours.py`, from the thumbnails' pixels | `js/gallery.js` (the Colour filter and `?colour=`) | when thumbnails are added | `colours`, `data-schemas` | never |
| `photo-exif.json` | `{frames: [{n, camera, lens, focal, aperture, shutter, iso}]}`, by frame number: only the frames whose originals kept their camera data, and only these fields | `generate_photo_exif.py`, from a folder of the originals named on its command line; it merges, so a frame the folder cannot speak for keeps its entry | `js/gallery.js` (the exposure line in the lightbox, drawn by `krLightboxCaption` in `js/lightbox.js`, and the "By the numbers" figures) | by hand, when originals are at hand | `data-schemas` (no other field may appear), `unit-tests` (`tests/test_photo_exif.py`: listed frames only, as the script writes it) | never |
| `photo-tags.json` | `{"<n>": [tags]}` | a tagging tool kept outside the repository; `bw` rewritten by `detect_monochrome.py` | `js/gallery.js`, `js/slideshow.js` (the gallery's filter buttons are `KR_PHOTO_CATEGORIES` in `js/shared-components.js`) | when photographs are added | `monochrome` | subject tags yes; `bw` never |
| `photo-locations.json` | `{_help, regions: [{name, path, lat, lng, photos: ["<n>"]}]}`; `path` is the region's place in the gallery's place filter, `[country]`, `[country, town]` or `[country, town, place in that town]`, with the state after the country in the United States (`["United States", "Michigan", "Ann Arbor"]`); a spot outside any town, a loch or a park, stands as its own town | you (its `_help` field says how) | `map.html`, `js/gallery.js` (tile captions, the globe badge, the place filter and `?place=`), `js/palette.js` (places), `js/slideshow.js` (its Place setting and caption) | when photographs are placed | `data-schemas` (every region has a `path`) | yes |
| `photo-credits.json` | `{_help, credits: {"<n>": "line"}}`: a credit for someone else's work in a frame (a mural, a sculpture) | you | `js/gallery.js` (the tile's hover caption, the lightbox caption, the link's name) | when a frame shows work Ken can name | none | yes |
| `photo-variants.json` | `{_help, groups: [["<n>", "<n>", ...]]}`: frames that are one photograph, the shown edit first | you (its `_help` field says how) | `js/gallery.js` (one tile per group, the edits on hover and in the lightbox), `js/slideshow.js` (one slide per group) | when a re-edit goes up | `audit` (`photo-variants`) | yes |
| `photography-files.json` | `["<n>.png"]`, newest first: every frame | a filename tool kept outside the repository, or by hand | `js/gallery.js`, `js/slideshow.js`, `404.html`, `index.html` (the three newest, the Latest section), `generate_colophon.py`, the audit's orphan report | when photographs are added | the smoke suite (the gallery renders) | yes, carefully |
| `photosets.json` | `{_help, sets: [{date, from, to, place}]}`, newest first: one entry per photoset added | you, when a set goes up | `generate_photo_feed.py`, which writes `feed-photos.xml` and the `KR_NEW_PHOTOS` line in `js/shared-components.js` from it; `js/slideshow.js` (its "Added to the gallery" setting) | when photographs are added | `photo-feed`, `data-schemas` | yes |
| `photography-standard-files.json` | `["<n>.png"]`: the frames the photo strip may show | as above | `renderPhotoStrip`, `404.html`, `js/slideshow.js` (its default selection, and the photographs behind `show=quotes`) | rarely | none | yes |
| `quotes-all.json` | `[{q, a, b, g?}]`: every saved passage (quote, author, book, and the book's Goodreads id when it is on the shelf, which the wall links; without it the link is a Goodreads search) | an export tool kept outside the repository | `generate_quote_wall.py` (bakes `quotes.html`), `generate_colophon.py` (the count the pages read from `colophon.json`) `js/slideshow.js` (`show=quotes`), `js/palette.js` (the author rows, once the reader types) and `js/post-shelf.js` (a book post's From my shelf strip) | occasionally | `quote-wall` | yes, then regenerate |
| `quotes.json` | `[{quote, author, book, g?, popularity}]` (`g` as in `quotes-all.json`, for the attribution's link) | as above | `js/literature.js` (the rotating quotation) | rarely | none | yes |
| `quotes-home.json` | `[{quote, author, book, g?}]` (`g` as above) | you | `index.html` (the homepage quotation) | rarely | none | yes |
| `reviews.json` | `[{title, author, rating, review, isbn, isbn13}]`: the selected reviews | an export tool kept outside the repository | `js/literature.js` | rarely | none | yes |
| `reading-analysis.json` | `{exported, shelves, rated, fourOrFive, community, genres, topGenre}`: a dated snapshot of what the feed can't give (my rating against the Goodreads average, genres, the to-read and did-not-finish shelves), with 95% intervals | `scripts/site_summary.py` in [GoodReads-Analysis](https://github.com/DrKenReid/GoodReads-Analysis), from a Goodreads export enhanced with [Enhance-GoodReads-Export](https://github.com/PaulKlinger/Enhance-GoodReads-Export) | `js/bookshelf.js` (the last Reading Stats figures and their hover cards; the panel stands without it) | when I download a new export | `data-schemas` | no: rerun the script |
| `invites.json` | `{_help, invites: {"<slug>": {title, line}}}` | you, one entry per post when it is published | `renderNewsletterPopup` (the newsletter pop-up at the end of a post; a post without one gets its category's words) | with every new post | `unit-tests` (`tests/test_invites.py`: every post has one, house style) | yes |
| `popular.json` | `[{url, views}]`, most viewed first, every post | a tool kept outside the repository: each Analytics export's page views (Engagement overview, "Page title and screen class") matched to posts by title, a browser-translated title counted for its post, and added to the totals on file | `js/blog.js` (the Popularity sort) | occasionally | none | yes |
| `stories.json` | `[]` | reserved for the short-story section | `renderMoreStories`, `index.html` (the Latest section's writing lane, shown once there is a story) | not yet | none | |

`data/schema/` holds a schema for every file the pages parse with no
fallback, and for the two central hand-edited files: books, reading, now,
lastfm, lastfm-history, topalbums, listening, bluesky, posts and
publications. The two photograph files a script derives for the gallery,
`photo-colours.json` and `photo-exif.json`, have one each as well; the
second's is what keeps anything but the exposure out of that file. So do
`book-details.json`, which the weekly workflow commits, and
`book-overrides.json`, typed in, whose genres must be ones the page has.

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
- `shelf` is optional and written by hand: the authors a post about
  books is about, each spelled as `books.json` spells the name
  (`"shelf": ["Patrick Rothfuss"]`). It is what puts the From my shelf
  strip in that post's end band
  ([COMPONENTS.md](COMPONENTS.md#the-end-band)); nothing is guessed from
  a title. Give it to a post that is plainly about one author or a few,
  not to one that mentions a book in passing. The audit's `posts-shelf`
  rule fails a name with no rated book in `books.json` and no quote in
  `quotes-all.json`.

(The essay: [A Blog Engine in One JSON File](https://www.kenreid.co.uk/blog/blog-engine-in-one-json-file.html).)

## The weekly files

`.github/workflows/lastfm-refresh.yml` runs every Monday at 06:00 UTC
(and on demand) and owns nine files, listed once in its `FILES`
variable: `lastfm.json`, `now.json`, `lastfm-history.json`,
`topalbums.json`, `listening.json`, `books.json`, `reading.json`,
`bluesky.json` and `book-details.json`.

- `refresh_now.py` fetches Last.fm (with the `LASTFM_API_KEY` secret)
  and the Goodreads currently-reading shelf. A source that fails keeps its
  previous values; the script exits 1 after writing what did refresh.
- `refresh_listening.py` asks Last.fm (with the same secret) for the
  chart weeks `listening.json` does not have and for the newest two, and
  adds them to the file ([Listening](#listening)). One week that fails
  is skipped and asked for again the next Monday; when nothing could be
  fetched the file is left as it was (with no file yet, one with no
  weeks is written) and the script exits 1.
- `refresh_books.py` fetches the Goodreads read shelf and merges it into
  `books.json`, then writes `reading.json`. It writes nothing when the
  feed looks truncated or short, or when a merge would lose a re-read.
  It also downloads the cover of each book the site has no copy of yet
  ([Reading](#reading)), and `refresh_now.py` does the same for the
  books in progress; the workflow commits that folder, its `COVERS`
  variable, with the data files.
- `refresh_book_details.py` runs after it, even when it failed, and gives
  each book its first year and genres (`y`, `gn`), asking Open Library
  (no key) about the books `book-details.json` has no entry for
  ([Years and genres](#years-and-genres)). A lookup that fails is a
  warning, tried again the next Monday; the script exits 0 whatever Open
  Library does.
- `refresh_bluesky.py` walks my public Bluesky feed (no key) for the
  posts of mine that shared a blog post and merges them into
  `bluesky.json` ([Bluesky shares](#bluesky-shares)). A first page that
  fails writes nothing; a later one still merges the pages that
  arrived, and the script exits 1 either way.
- `validate_data.py` checks all nine against their schemas. Nothing that
  fails is committed.

Because the workflow commits to `master` on its own, pull before pushing
on a Monday. Its commits do not regenerate the colophon, which is why the
colophon check tolerates commit counts a little behind (`LAG` in
`generate_colophon.py`).

## Listening

`listening.json` is the account's listening history by week: a record
for every Last.fm chart week since the account opened, oldest first.
`data/schema/listening.schema.json` describes each field:

| Key | Meaning |
|---|---|
| `d` | the day the chart week starts (UTC); Last.fm's weeks run from noon on a Sunday |
| `n` | scrobbles that week: the plays of every artist in the week's chart, added up |
| `a`, `p` | the week's most played artist and that artist's plays; left out of a week with nothing played |

`refresh_listening.py` builds the file a week at a time and keeps what
it has. A run asks only for the weeks not on file and, again, for the
newest two, whose counts can still move, so a normal Monday is three
requests. A week it cannot fetch has no record and is asked for again
on the next run; a week with nothing played has one, with `n` at 0.
Nothing on file is ever dropped, and an empty answer never replaces a
week that had plays: the script's docstring has the rules and
`tests/test_refresh_listening.py` pins them with the network mocked.
A file with no weeks is filled from the account's first week on, a
request a week. Inside the workflow a run stops asking after five
minutes and the next one carries on; with the key in the environment,
`python .github/scripts/refresh_listening.py --backfill` walks the
whole history in one go.

Before that first run there may be no file, or one with no weeks.
`validate_data.py` passes over a missing one (`MAY_BE_ABSENT`), a run
of the script never ends without a file, and the page draws nothing
from either. A missing file is the worse of the two for the page: the
browser logs its request as a 404, which the smoke suite counts as an
error on `music.html`.

`js/listening.js` draws the file on `music.html` as a calendar (a cell
a week, or a month on a phone) and six figures, and shows neither while
the file has no weeks: the section is then the lastfmstats charts
alone. The calendar is the reading calendar's markup and CSS. A chart
week is drawn in the ISO week most of it falls in, and a row's total is
the sum of its cells, because a week that spans the new year is one
number and cannot be split between two calendar years. The file holds
each week's most played artist and no more, so the figures say who led
the most weeks, not who was played most over a year.
`tests/js/listening.test.js` pins the arithmetic, some of it on
`tests/fixtures/listening.json`, a made-up history kept for the tests.

## Bluesky shares

`bluesky.json` says which Bluesky post each blog post was shared in, so
the post can show the replies to it with its comments
([COMPONENTS.md](COMPONENTS.md#the-end-band)). A page is matched to its
Bluesky post here, ahead of time, and never guessed in the reader's
browser: a post with no entry asks Bluesky nothing.

`refresh_bluesky.py` walks my public author feed on Bluesky's public API
(no key, no login), newest first, and takes my own top-level posts that
link to `/blog/<slug>.html` on this site, by their link card or by a link
in the text. A repost or a reply does not count, nor does a link to a
slug `posts.json` does not list. Where a post was shared twice, the more
recent share is kept.

The file is the record, as `books.json` is. An entry the walk did not
reach is kept, a run that fails changes nothing on file, and an entry
goes only when Bluesky itself says its post has been deleted (the script
asks for the entries it did not see, by address). A share the script
cannot recognise, a Bluesky post about a piece with no link to it, can be
added by hand and is kept on the same terms; a later share that does
link replaces it. The script's docstring has the rules and
`tests/test_refresh_bluesky.py` pins them with the network replaced.

A post shared today has no entry until the next Monday's run. To give it
one at once, run `python .github/scripts/refresh_bluesky.py` and commit
the file. The file is rewritten only when its contents change, so a week
with no new share is no change.

## Reading

`books.json` is every book on the Goodreads read shelf. The keys are
single letters because every reader of the reading pages downloads the
whole file; `data/schema/books.schema.json` describes each:

| Key | Meaning |
|---|---|
| `t`, `a` | title (series in brackets, as Goodreads gives it) and author |
| `r` | my rating, 0 when unrated |
| `v` | 1 when I wrote a review |
| `i` | ISBN, when Goodreads has one; a book with no cover on the site has one looked up at Open Library by it |
| `g`, `w` | the Goodreads book id and review id; the pages link to `goodreads.com/review/show/<w>` |
| `c` | the cover Goodreads shows (about 475px tall), as a path under `GR_COVERS`; every book has one, ISBN or not. No page loads it: it is where the site's copy is downloaded from |
| `k` | 1 when the site has its own full copy of that cover, `img/covers/shelf/<g>.jpg`: what a review card and the slideshow's featured book show |
| `s` | 1 when it has the small copy, `img/covers/shelf/s/<g>.jpg`: what a tile on the wall and a thumbnail show |
| `d` | the date I last finished it; `e: 1` when that is only the date it was added |
| `p` | earlier finish dates, one per earlier read |
| `y` | the year it was first published ([Years and genres](#years-and-genres)) |
| `gn` | one or two genre keys, the main one first ([Years and genres](#years-and-genres)) |
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

One author's reading has an address on both pages: `books.html?author=`
(the books I rated, `js/bookwall.js`) and `quotes.html?author=` (the
quotes I saved, the page's own script). The command palette's author
rows (`js/palette.js`) and the From my shelf strip (`js/post-shelf.js`)
build those links from `books.json` and `quotes-all.json` in the
browser; there is no author index to regenerate when `books.json`
changes on a Monday. The two files do not spell every name alike
(`quotes-all.json` has "Ursula K. LeGuin" and names with doubled
spaces), so all four match a name by one key, `authorKey`: lower case,
without accents, spaces or punctuation. `tests/js/palette.test.js` fails
when the four copies of that function differ, and checks every author
row's count against what its link selects.

The covers on the reading pages are the site's own files, so showing a
book asks Goodreads for nothing. `refresh_books.py` downloads each cover
once from the address `c` names, twice over: a full copy about 400px
tall at `img/covers/shelf/<g>.jpg`, for a review card and the
slideshow's featured book, and a small one 240px tall at
`img/covers/shelf/s/<g>.jpg`, for a tile on the wall, a thumbnail and
the slideshow's wall, where a screenful is hundreds of covers. It is
standard library only, so each file is kept as Goodreads sent it. It
sets `k` (full) and `s` (small) on the record once the file is written,
and the pages ask only for the files a record's marks name (`shelfCover`
in `js/bookshelf.js` and in `js/slideshow.js`), so a file that is not
there is never requested. Each use takes the copy that suits its size
and the other while that one is missing; a book with neither shows Open
Library's cover for its ISBN, then a cover set in type. The marks go
when Goodreads changes `c`, and the next run fetches the new cover. A
cover that cannot be fetched is a warning in the run's log, never a
failure, and is tried again the next week. `refresh_books.py --covers`
runs that stage alone, with no feed, writing the marks as it goes so a
run that is cut short starts again where it stopped.

The books in progress are not on the read shelf, so they have no record
to mark. `refresh_now.py` keeps the small copy of each in the same
folder (`local_cover` in `refresh_books.py`) and writes its path as the
book's `img` in `now.json`; a cover it cannot fetch is left out, and
Reading Now sets that book's cover in type. `refresh_now.py --covers`
does only this, with no Last.fm key and no feed.

### Years and genres

The wall on `books.html` filters by when a book first came out and by
genre, and sorts by the year, so every record carries `y` and `gn`.
`refresh_book_details.py` sets both, from these sources, best first:

| | year (`y`) | genres (`gn`) |
|---|---|---|
| 1 | `book-overrides.json`, by hand | `book-overrides.json`, by hand |
| 2 | a Goodreads library export: Original Publication Year, else the edition's Year Published | the genres readers shelve the book under on Goodreads, with their votes, from an export enhanced with [Enhance-GoodReads-Export](https://github.com/PaulKlinger/Enhance-GoodReads-Export) |
| 3 | the feed's `book_published`, which `refresh_books.py` writes for a new book and never over a year on file | Open Library's subjects for the work |
| 4 | Open Library's `first_publish_year` | |

What the sources said is kept in `book-details.json`, a book an entry:
the year and the labels (a Goodreads genre and its votes, or an Open
Library subject) and where each came from. It is the cache, so a
Monday asks Open Library only about the week's new books, by ISBN where
there is one, else by title and author (the author must be the first
named on the answer); a book it cannot place is asked again after 90
days. The labels are kept as they came, so a change to the genre table
in the script reaches every book on the next run, with no network:
`python .github/scripts/refresh_book_details.py --offline`.

The genres are twelve fixed keys, in the order the page lists them:
`fantasy`, `litrpg` (LitRPG and progression), `scifi`, `horror`,
`crime` (crime and thriller), `literary` (literary fiction), `history`,
`science` (science and technology), `philosophy` (and religion),
`psychology` (and self-help), `biography` (and memoir) and `politics`
(and society). The script's docstring has the table that turns a label
into one; a book gets its best genre and, when it scores close behind,
a second. LitRPG and progression fantasy lead whenever they reach an
eighth of the best score, because readers shelve those books as
"Fantasy" first. A book nothing places has no `gn` and shows only while
the Genre row is at All. To move a book, add it to
`book-overrides.json` and run the script with `--offline`; the test
`tests/test_refresh_book_details.py` fails when `books.json` and the two
files disagree, and when the page's genre list (`GENRES` in
`js/bookwall.js`) is not the script's.

A new Goodreads export (Goodreads' Import and export page, then the
enhancer for the genres) refreshes the backlog:
`python .github/scripts/refresh_book_details.py --export <file.csv>`.
It speaks for what the export has and keeps what it lacks.

## Photographs

The full-size photographs are not in the repository. GitHub Pages caps a
site at 1 GB, and the originals alone are larger, so they live as assets
of the `photos-v1` release
(`https://github.com/DrKenReid/DrKenReid.github.io/releases/download/photos-v1/<n>.png`,
`KR_RELEASE` in `js/shared-components.js`). The repository holds the
400px thumbnails (`img/photography/thumb/<n>.webp`, with an 800px
`<n>@2x.webp` beside each) and a hero of every frame
(`img/photography/hero/<n>.webp`, 1920px on the long edge, about 100 KB),
which the openers, the photographs in posts and the slideshow use. A post
links a thumbnail and the runtime opens the original in the lightbox. The
slideshow never streams the originals: the release answers every request
for one with `no-cache`, and a slideshow left running as a wallpaper
would fetch gigabytes a day. (The essay:
[Hosting a Photography Portfolio on GitHub for Free](https://www.kenreid.co.uk/blog/hosting-photography-on-github-for-free.html).)

Adding photographs touches every file in this group:

1. Upload each original to the `photos-v1` release as `<n>.png`, numbering
   on from the highest.
2. Add the thumbnail `img/photography/thumb/<n>.webp`; once the original
   is on the release, `generate_photo_renditions.py` makes its `@2x` and
   its hero (the `renditions` check fails a frame without them).
3. Add `"<n>.png"` to the top of `photography-files.json` (newest first),
   and to `photography-standard-files.json` if the photo strip may show
   it. The homepage's Latest section ignores that pool: it shows the
   three newest frames of all, so the last frames added lead the homepage
   whatever they are.
4. Give it subject tags in `photo-tags.json`. The tags come from a
   tagging model run outside the repository (the essay
   [Building a Photo Tagging System with CLIP](https://www.kenreid.co.uk/blog/photo-tagging-with-clip.html)
   describes it); the gallery's filter buttons are `KR_PHOTO_CATEGORIES`
   in `js/shared-components.js`. `animals` is every animal, wild, farm or
   pet; it took over from `wildlife`, and `KR_PHOTO_TAG_RENAMED` sends an
   old `?tag=wildlife` link to it. `autumn` is strict in the model (it
   misses many autumn frames), so look over a new autumn shoot by eye: the
   fall season's photo strip and map read it. `winter`, `spring` and
   `summer` are the same, picked by eye for their seasons.
5. Place it in a region of `photo-locations.json` if it belongs on the
   map ([Putting My Photos on a Map](https://www.kenreid.co.uk/blog/putting-my-photos-on-a-map.html)).
   A new region needs a `path` as well as its pin: the country, the
   state in the United States, the town and, for a spot inside a town,
   its own name (`["Scotland", "Stirling", "Stirling Castle"]`,
   `["United States", "Michigan", "Ann Arbor"]`). That is where the
   gallery's place filter lists it.
6. Add the set to the top of `photosets.json`: the day it went up,
   its first and last frame numbers and where it was taken. From it
   `generate_photo_feed.py` (run by step 7) writes the set's item in
   `feed-photos.xml`, the photography feed, and copies the newest day's
   sets into `KR_NEW_PHOTOS` in `js/shared-components.js`: every frame
   from the first of them up wears the "New" badge in the gallery and on the homepage,
   whose Latest section reads "<count> new photographs from
   <place>." Frames from two places added on one day go in as two sets
   with the same date (one feed item each, both New, the line naming
   both places). The `photo-feed` check fails while frames sit past the
   newest set, so a set cannot go up without its entry.
7. `git add -N` the new images, then run `run_checks.py --fix`:
   `generate_photo_dims.py` records the thumbnail's size (the gallery lays
   out rows from it; a frame without one is assumed 3:2),
   `detect_monochrome.py` decides its `bw` tag from its pixels,
   `generate_photo_colours.py` its colour family, and the colophon
   counts it.
8. While the files the set was made from are still on your disk, run
   `python .github/scripts/generate_photo_exif.py --first <n> <file> ...`
   with the set's first frame number and those files in the order they
   were numbered. It adds the camera, lens and exposure of each one that
   still carries them to `photo-exif.json`. Read the exports, not the
   `<n>.png` made for the release: a frame re-saved as a PNG on the way
   there has lost its camera data. No check can ask for this step,
   because nothing in the repository knows what the files hold: a frame
   it never read just has no exposure line.

Re-edits of one photograph (a colour and a black and white version, a
different grade, a double exposure of a portrait) and a file listed twice
are grouped in `photo-variants.json`. Each group is one tile in the
gallery: its first stem is the edit the tile shows, and the others fade
in while the tile is hovered and have their own Edit buttons in the
lightbox. A group matches a subject filter when any of its edits has the
tag, and shows that edit. Every frame stays in `photography-files.json`
and keeps its tags, place and release file, so `?photo=` works for any of
them. The audit's `photo-variants` rule fails a group naming an unlisted
frame, a frame in two groups, or a group of one. A new edit of an old
frame goes up as a new frame, then into the old frame's group.

The `bw` tag is decided by pixels only: a frame counts when its chroma is
low almost everywhere, so a selective-colour photograph (a grey street and
one pink coat) does not pass. The thresholds and the rule that was tried
and dropped are in `detect_monochrome.py`'s docstring.

The colour filter's families are decided by pixels as well
(`generate_photo_colours.py`). Each coloured pixel of the thumbnail votes
for one of eight hue families, or for brown when it is a warm colour that
is dark or washed out (wood, stone, fur, skin), with the strength of its
colour as the weight; the family with the most weight is the frame's. A
blue sky over a green field is whichever holds more of the frame. A frame
with colour on too little of it has no family: every `bw` frame, and a
grey scene with a trace of tint. One family a frame, so a colour shows
the frames that are mostly that colour; a group in `photo-variants.json`
is in a family when any of its edits is, and shows that edit. The
thresholds are in the script's docstring, and its `--report` shows what a
change to one would move before anything is written.

`photo-exif.json` is the one photograph file made from the originals
themselves, which only the release and a copy on disk hold, so its script
takes them as arguments (a folder of `<n>.png`, or `--first` and a set's
own files) and no check can rerun it. Only the
frames whose exports kept their camera data are in it; the gallery's
"By the numbers" section counts them and says how many that is. The
script looks up seven tags by number (maker, model, lens model, exposure
time, f-number, ISO, focal length) and decodes nothing else, so a file's
position, serial numbers, owner, software and dates stay where they are,
and the file's schema refuses any field but the six the script writes. It
merges into the file and never takes a frame out while the gallery lists
it, so it can be run against a partial copy of the originals.

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
