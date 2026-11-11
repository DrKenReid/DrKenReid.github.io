/**
 * bookwall.js: the cover wall on books.html ("Every Book").
 *
 * Every rated book in data/books.json, searchable by title and author,
 * with a Filter panel and a Sort panel built as the blog listing's are
 * (js/blog.js, js/series-index.js). A book hangs as the site's own small
 * copy of its cover (s in books.json marks the books that have one, ISBN
 * or not; the full copy, k, while the small one is missing), else Open
 * Library's for its ISBN, else a cover set in type (krTypeCover), so the
 * wall and its counts cover the whole reading history, not only the
 * books a cover can be found for. Every tile is drawn at once and its
 * <img> loads lazily, so only the covers on screen are fetched.
 *
 * Links, cover URLs and tooltips come from krBookshelf (js/bookshelf.js,
 * loaded first), so a tile says and links what the shelf does. A cover
 * that will not load is not dropped either: js/bookshelf.js tries the
 * next picture and then sets it in type, from the data- attributes on
 * the <img>, so every tile the counts promise is on the wall.
 *
 * FILTERS (one row each, OR within a row, AND across rows; the counts on
 * the pills are over the whole wall and never move):
 *   Genre      gn, one or two of GENRES a book; refresh_book_details.py
 *              derives them (its docstring has the table) and
 *              data/book-overrides.json corrects them
 *   Rating     my stars, 5 to 1 (the row's buttons are #book-wall-filters,
 *              which the smoke suite reads)
 *   Read in    the years I finished it: a re-read counts in each year it
 *              was read (krBookshelf.sessions); a book known only by the
 *              date it was added is in no year. The latest YEARS_SHOWN
 *              show, the rest are behind "+N more"
 *   Published  y, by decade from 1950 and in two wider bands before
 *              (periodKey), since the early decades hold a few books each
 *   Pages      n, in LENGTHS bands
 *   Author     the authors with AUTHOR_MIN books or more, one at a time;
 *              pressing one is the same as following its ?author= link
 *   Re-read    only the books I have read more than once (p)
 * A book with no year, no page count or no genre is in no band of that
 * row, so it shows only while that row is at All.
 *
 * SORTS (SORTS, the default first): date read, newest first, as
 * books.json is ordered; title (without a leading "The", "A" or "An");
 * author (by surname, with its particles: "Le Guin", "du Maurier");
 * year published; my rating; length. A book with no year or page count
 * goes last in either direction, and ties fall back to the date read.
 * Sorting by year or length puts that figure under the stars.
 *
 * ?author= is one author's books and no others: the link the command
 * palette's author rows (js/palette.js) and a post's "From my shelf"
 * strip (js/post-shelf.js) build, and the Author row's pills. The name
 * is matched whole, by authorKey, so its accents, full stops and spacing
 * need not survive the journey, and a title that mentions the author
 * does not count (a search for "Plato" also finds a book about him). The
 * search box shows the name, which is how the reader sees what narrows
 * the wall and how they let go of it: typing anything turns it back into
 * a search. A name no book on the wall carries is searched for as typed.
 *
 * URL keys: q (the search, as typed), author, rating, genre, read (years),
 * published (periodKey values), len (LENGTHS keys), reread (1), sort and
 * dir, written back with replaceState as on the blog listing (js/blog.js,
 * "WHY replaceState"), so a filtered wall can be linked to and survives a
 * reload. Lists are comma-separated. A value no book on the wall has is
 * dropped rather than obeyed, and the address bar is rewritten without
 * it. A link that arrives filtered opens the Filter panel with its
 * pressed pills in view (krRevealPressed), as the blog's does; an
 * ?author= alone does not, since the search box already names it.
 *
 * The count is #book-wall-count, the shared .kr-list-counter live region
 * (krUpdateSearchCounter): empty unless something narrows the wall, then
 * "Showing 37 of 604 books: read in 2025, fantasy". Nothing left offers
 * Clear search, Clear all filters and the whole-site search (krListEmpty;
 * its own Clear search knows only the blog's field, so this file adds
 * the wall's).
 *
 * The skeleton tiles the wall shows while books.json loads are in the
 * page's markup, and the toolbar is too, so the grid has its height from
 * the first paint and nothing below it moves when the covers arrive.
 *
 * Globals: window.krBookWall, the pure helpers (tests/js/bookwall.test.js),
 * set before the file touches the document.
 */
(function () {
    'use strict';

    var SEARCH_DEBOUNCE_MS = 120;
    var YEARS_SHOWN = 8;    // years read shown before "+N more"
    var AUTHOR_MIN = 5;     // books an author needs for a pill in the Author row
    var AUTHORS_SHOWN = 6;  // author pills shown before "+N more"

    /* Genre keys in refresh_book_details.py's GENRES order, which is the
       row's; tests/test_refresh_book_details.py holds the two together.
       `words` is how the count names it, `live` the hover sketch a tile
       of that genre runs (js/covers-site.js). */
    var GENRES = [
        { key: 'fantasy', label: 'Fantasy', words: 'fantasy', live: 'genre:fantasy' },
        { key: 'litrpg', label: 'LitRPG and progression', words: 'LitRPG and progression', live: 'genre:fantasy' },
        { key: 'scifi', label: 'Science fiction', words: 'science fiction', live: 'genre:scifi' },
        { key: 'horror', label: 'Horror', words: 'horror', live: 'genre:fiction' },
        { key: 'crime', label: 'Crime and thriller', words: 'crime and thriller', live: 'genre:fiction' },
        { key: 'literary', label: 'Literary fiction', words: 'literary fiction', live: 'genre:fiction' },
        { key: 'history', label: 'History', words: 'history', live: 'genre:nonfiction' },
        { key: 'science', label: 'Science and technology', words: 'science and technology', live: 'genre:nonfiction' },
        { key: 'philosophy', label: 'Philosophy and religion', words: 'philosophy and religion', live: 'genre:nonfiction' },
        { key: 'psychology', label: 'Psychology and self-help', words: 'psychology and self-help', live: 'genre:nonfiction' },
        { key: 'biography', label: 'Biography and memoir', words: 'biography and memoir', live: 'genre:nonfiction' },
        { key: 'politics', label: 'Politics and society', words: 'politics and society', live: 'genre:nonfiction' }
    ];

    var LENGTHS = [
        { key: 'short', label: 'Under 200', words: 'under 200 pages', max: 199 },
        { key: 'medium', label: '200 to 399', words: '200 to 399 pages', max: 399 },
        { key: 'long', label: '400 to 599', words: '400 to 599 pages', max: 599 },
        { key: 'epic', label: '600 or more', words: '600 pages or more', max: Infinity }
    ];

    var SORTS = [
        { key: 'read', label: 'Date read', defaultDir: -1 },
        { key: 'title', label: 'Title', defaultDir: 1 },
        { key: 'author', label: 'Author', defaultDir: 1 },
        { key: 'published', label: 'Published', defaultDir: -1 },
        { key: 'rating', label: 'Rating', defaultDir: -1 },
        { key: 'pages', label: 'Pages', defaultDir: -1 }
    ];

    /* ------------------------------------------------------- pure helpers */

    function onTheWall(b) { return !!b.r; }

    /* An author's name as a key: lower case, without accents, spaces or
       punctuation, so a name in a link finds its books however it was
       typed. js/palette.js builds the links and has the original; the
       copies are held to it by tests/js/palette.test.js. */
    function authorKey(name) {
        var s = String(name || '');
        if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return s.toLowerCase().replace(/[^a-z0-9]+/g, '') || s.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    /* The years a book was finished in, each once, newest first. */
    function readYears(b) {
        var seen = {};
        krBookshelf.sessions(b).forEach(function (d) {
            var y = String(d || '').slice(0, 4);
            if (/^\d{4}$/.test(y)) seen[y] = true;
        });
        return Object.keys(seen).sort().reverse();
    }

    /* The Published row's band for a year: its decade from 1950 on
       ("2010s"), "1900-1949" and "before-1900" for the thin years before;
       '' for a book with no year. */
    function periodKey(y) {
        if (!(y > 0)) return '';
        if (y >= 1950) return Math.floor(y / 10) * 10 + 's';
        return y >= 1900 ? '1900-1949' : 'before-1900';
    }
    function periodLabel(key) {
        if (key === '1900-1949') return { label: '1900 to 1949', words: 'from 1900 to 1949' };
        if (key === 'before-1900') return { label: 'Before 1900', words: 'before 1900' };
        return { label: key, words: 'in the ' + key };
    }
    /* Newest first, the decades before the two wide bands. */
    function periodOrder(key) {
        if (key === 'before-1900') return 0;
        if (key === '1900-1949') return 1;
        return parseInt(key, 10) || 0;
    }

    function lengthKey(n) {
        if (!(n > 0)) return '';
        for (var i = 0; i < LENGTHS.length; i++) {
            if (n <= LENGTHS[i].max) return LENGTHS[i].key;
        }
        return '';
    }

    /* A title as the Title sort reads it: the series off (krBookTitle), a
       leading article off, lower case. */
    function titleSortKey(t) {
        var name = typeof krBookTitle === 'function' ? krBookTitle(t).title : String(t || '');
        return String(name).toLowerCase().replace(/^(the|a|an)\s+/, '').trim();
    }

    /* "Ursula K. Le Guin" -> "le guin ursula k.": the surname, with the
       particles before it, then the rest. A suffix (Jr., III) is not a
       surname. */
    var PARTICLES = /^(de|da|del|della|der|den|di|du|la|le|van|von|ter|st\.?)$/i;
    function authorSortKey(name) {
        var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        while (parts.length > 1 && /^(jr\.?|sr\.?|ii|iii|iv),?$/i.test(parts[parts.length - 1])) parts.pop();
        if (parts.length > 1) parts[parts.length - 2] = parts[parts.length - 2].replace(/,$/, '');
        var i = parts.length - 1;
        while (i > 0 && PARTICLES.test(parts[i - 1])) i--;
        return (parts.slice(i).join(' ') + ' ' + parts.slice(0, i).join(' ')).trim().toLowerCase();
    }

    var collator = typeof Intl !== 'undefined' && Intl.Collator
        ? new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' }) : null;
    function textCompare(a, b) {
        return collator ? collator.compare(a, b) : (a < b ? -1 : a > b ? 1 : 0);
    }

    /* A number where a book may have none: books without one go last in
       either direction. */
    function numberCompare(x, y, dir) {
        var hx = x > 0, hy = y > 0;
        if (hx !== hy) return hx ? -1 : 1;
        return hx ? dir * (x - y) : 0;
    }

    /* Newest finish first; a book with no date last. */
    function readCompare(a, b) {
        var da = String(a.d || ''), db = String(b.d || '');
        if (!da !== !db) return da ? -1 : 1;
        return da < db ? 1 : da > db ? -1 : 0;
    }

    /* The comparator for a sort option and direction. `index` maps each
       book to its place in books.json, the last tie-break, so equal books
       keep the file's order whatever the browser's sort does. */
    function comparator(key, dir, index) {
        return function (a, b) {
            var c = 0;
            if (key === 'title') {
                c = dir * textCompare(titleSortKey(a.t), titleSortKey(b.t)) ||
                    textCompare(authorSortKey(a.a), authorSortKey(b.a));
            } else if (key === 'author') {
                c = dir * textCompare(authorSortKey(a.a), authorSortKey(b.a)) ||
                    textCompare(titleSortKey(a.t), titleSortKey(b.t));
            } else if (key === 'published') {
                c = numberCompare(a.y, b.y, dir);
            } else if (key === 'rating') {
                c = dir * ((a.r || 0) - (b.r || 0));
            } else if (key === 'pages') {
                c = numberCompare(a.n, b.n, dir);
            } else {
                c = dir < 0 ? readCompare(a, b) : -readCompare(a, b);
            }
            if (!c && key !== 'read') c = readCompare(a, b);
            return c || (index ? index.get(a) - index.get(b) : 0);
        };
    }

    /* True when book `b` passes every filter in `f`:
       { genres, ratings, years, periods, lengths: [keys], reread: bool,
         author: key or '', query: lower-case text or '' }. */
    function passes(b, f) {
        if (f.genres.length && !(b.gn || []).some(function (g) { return f.genres.indexOf(g) !== -1; })) return false;
        if (f.ratings.length && f.ratings.indexOf(String(b.r)) === -1) return false;
        if (f.years.length && !readYears(b).some(function (y) { return f.years.indexOf(y) !== -1; })) return false;
        if (f.periods.length && f.periods.indexOf(periodKey(b.y)) === -1) return false;
        if (f.lengths.length && f.lengths.indexOf(lengthKey(b.n)) === -1) return false;
        if (f.reread && !(b.p && b.p.length)) return false;
        if (f.author) return authorKey(b.a) === f.author;
        return !f.query || (b.t + ' ' + b.a).toLowerCase().indexOf(f.query) !== -1;
    }

    /* How many books carry each key, for a row's pills: `keysOf(book)`
       gives a book's keys in that row (each counted once a book). */
    function tally(books, keysOf) {
        var counts = {};
        books.forEach(function (b) {
            var seen = {};
            (keysOf(b) || []).forEach(function (k) {
                if (!k || seen[k]) return;
                seen[k] = true;
                counts[k] = (counts[k] || 0) + 1;
            });
        });
        return counts;
    }

    /* "a", "a or b", "a, b or c". */
    function orList(words) {
        if (words.length < 2) return words.join('');
        return words.slice(0, -1).join(', ') + ' or ' + words[words.length - 1];
    }

    window.krBookWall = {
        GENRES: GENRES,
        LENGTHS: LENGTHS,
        SORTS: SORTS,
        authorKey: authorKey,
        readYears: readYears,
        periodKey: periodKey,
        lengthKey: lengthKey,
        titleSortKey: titleSortKey,
        authorSortKey: authorSortKey,
        comparator: comparator,
        passes: passes,
        tally: tally,
        orList: orList
    };

    if (typeof document === 'undefined' || !document.addEventListener) return;

    /* ------------------------------------------------------------- state */

    var books = [];         // books.json, shared with other readers: read only
    var wall = [];          // the rated ones, in books.json's order
    var order = null;       // Map: book -> its place in `wall`, the last tie-break
    var searchQuery = '';
    var activeAuthor = '';  // an author in force: the name as books.json spells it
    var filters = { genres: [], ratings: [], years: [], periods: [], lengths: [], reread: false };
    var sortKey = SORTS[0].key;
    var sortDir = SORTS[0].defaultDir;
    var bars = {};          // renderFilterBar handles by row
    var clearRow = null;
    var toolbar = null;
    var syncing = false;    // set while a row is synced from outside, so its onChange stays out
    var search = null;

    var GENRE_BY_KEY = {};
    GENRES.forEach(function (g) { GENRE_BY_KEY[g.key] = g; });
    var LENGTH_BY_KEY = {};
    LENGTHS.forEach(function (l) { LENGTH_BY_KEY[l.key] = l; });

    function stars(n) {
        return '★'.repeat(n);
    }

    /* The author on the wall that `name` means, spelled as books.json
       spells it, or '' when no rated book is theirs. */
    function wallAuthor(name) {
        var key = authorKey(name);
        for (var i = 0; key && i < wall.length; i++) {
            if (authorKey(wall[i].a) === key) return wall[i].a;
        }
        return '';
    }

    /* The hover sketch: the book's genre's, else a guess from the title,
       enough signal for a picture (a book the details have not reached). */
    var SCIFI = /\b(space|star|stars|galaxy|galactic|planet|mars|robot|android|cyber|dune|foundation|hyperion|alien|expanse|culture|orbit|quantum|neuromancer|ender|children of time|three-body|martian|ship|machine|time)\b/i;
    var FANTASY = /\b(dragon|magic|wizard|witch|sword|kingdom|king|queen|throne|realm|elf|elves|dwarf|hobbit|ring|tower|blade|mage|sorcer\w*|quest|dungeon|crawler|chicken|kingkiller|storm|light|mist|shadow|dark|spell|cradle|lord|gods?)\b/i;
    var NONFICTION = /\b(introduction|guide|history|science|course|courses|how to|why|philosophy|economics|psychology|thinking|habits|art of|theory|data|statistics|brief|lives|biography|memoir|essays|notes|manual|principles|lessons|great courses)\b/i;
    function sketchOf(b) {
        var g = b.gn && GENRE_BY_KEY[b.gn[0]];
        if (g) return g.live;
        var t = b.t || '';
        if (NONFICTION.test(t)) return 'genre:nonfiction';
        if (SCIFI.test(t)) return 'genre:scifi';
        if (FANTASY.test(t)) return 'genre:fantasy';
        return 'genre:fiction';
    }

    /* What the sort puts under the stars: the year for Published, the
       page count for Pages, nothing for the rest. [shown, spoken] */
    function sortNote(b) {
        if (sortKey === 'published' && b.y) return [String(b.y), ', first published ' + b.y];
        if (sortKey === 'pages' && b.n) return [b.n + ' pages', ', ' + b.n + ' pages'];
        return null;
    }

    /* A tile is one link: the cover, then the stars that show on hover and
       focus. Its name is "Title by Author, rated N of 5" either way: the
       <img>'s alt text, or for a book with no picture a hidden line beside
       a cover set in type, which is itself hidden so the title is not
       read twice. */
    function tile(b) {
        var name = krBookTitle(b.t);
        var called = krEscapeHtml(name.title + ' by ' + b.a);
        var attrs = krBookshelf.coverAttrs(b, 'M');
        var note = sortNote(b);
        var cover = attrs
            ? '<img' + attrs + ' alt="' + called + '" loading="lazy"' + krTypeCover.dataAttrs(b) + '>'
            : krTypeCover(b, { decorative: true }).outerHTML + '<span class="sr-only">' + called + '</span>';
        return '<a class="book-wall-item" data-live="' + sketchOf(b) + '" href="' + krEscapeHtml(krBookshelf.goodreadsUrl(b)) + '"' +
            ' target="_blank" rel="noopener noreferrer" title="' + krEscapeHtml(krBookshelf.label(b)) + '">' +
            cover +
            '<span class="book-wall-stars"><span aria-hidden="true">' + stars(b.r) + '</span>' +
            (note ? '<span class="book-wall-note" aria-hidden="true">' + krEscapeHtml(note[0]) + '</span>' : '') +
            '<span class="sr-only">, rated ' + b.r + ' of 5' + (note ? krEscapeHtml(note[1]) : '') + '</span></span>' +
            '</a>';
    }

    /* ----------------------------------------------------------- filters */

    function filterCount() {
        return filters.genres.length + filters.ratings.length + filters.years.length +
            filters.periods.length + filters.lengths.length + (filters.reread ? 1 : 0) +
            (activeAuthor ? 1 : 0);
    }

    function currentFilters() {
        return {
            genres: filters.genres, ratings: filters.ratings, years: filters.years,
            periods: filters.periods, lengths: filters.lengths, reread: filters.reread,
            author: activeAuthor ? authorKey(activeAuthor) : '',
            query: activeAuthor ? '' : searchQuery.trim().toLowerCase()
        };
    }

    /* The filters in force, in words, for the count: "by Will Wight, read
       in 2025, fantasy or horror". Commas, not the blog's middle dots:
       the count is a live region, and a screen reader reads a dot out. */
    function filterWords() {
        var parts = [];
        if (activeAuthor) parts.push('by ' + activeAuthor);
        if (filters.years.length) parts.push('read in ' + orList(filters.years.slice().sort().reverse()));
        if (filters.periods.length) {
            parts.push('published ' + orList(filters.periods.slice().sort(function (a, b) {
                return periodOrder(b) - periodOrder(a);
            }).map(function (k) { return periodLabel(k).words; })));
        }
        var genres = GENRES.filter(function (g) { return filters.genres.indexOf(g.key) !== -1; });
        if (genres.length) parts.push(orList(genres.map(function (g) { return g.words; })));
        if (filters.ratings.length) {
            var r = filters.ratings.slice().sort();
            parts.push('rated ' + orList(r) + (r.length === 1 && r[0] === '1' ? ' star' : ' stars'));
        }
        var lengths = LENGTHS.filter(function (l) { return filters.lengths.indexOf(l.key) !== -1; });
        if (lengths.length) parts.push(orList(lengths.map(function (l) { return l.words; })));
        if (filters.reread) parts.push('read more than once');
        return parts.join(', ');
    }

    /* One row of pills: renderFilterBar in a krFacetRow, its counts from
       tally() and its selection reported to `set`. */
    function pillRow(container, name, caption, ariaLabel, items, opts) {
        var holder = krFacetRow(container, caption, ariaLabel);
        if (opts.id) holder.id = opts.id;
        var bar = renderFilterBar(holder, items, {
            multi: opts.multi !== false,
            allLabel: 'All',
            collapseAfter: opts.collapseAfter || 0,
            onChange: function (keys) {
                if (syncing) return;
                opts.set(keys);
                changed();
            }
        });
        bars[name] = bar;
        return bar;
    }

    function buildFilterPanel() {
        var panel = document.getElementById('book-wall-panel');
        if (!panel) return;
        panel.innerHTML = '';
        bars = {};

        var genreCounts = tally(wall, function (b) { return b.gn; });
        pillRow(panel, 'genre', 'Genre', 'Filter books by genre',
            GENRES.filter(function (g) { return genreCounts[g.key]; }).map(function (g) {
                return { key: g.key, label: krEscapeHtml(g.label), count: genreCounts[g.key] };
            }), { set: function (keys) { filters.genres = keys; } });

        var ratingCounts = tally(wall, function (b) { return [String(b.r)]; });
        pillRow(panel, 'rating', 'Rating', 'Filter books by my rating',
            ['5', '4', '3', '2', '1'].filter(function (r) { return ratingCounts[r]; }).map(function (r) {
                return {
                    key: r,
                    // The star is decoration; a screen reader hears "5 stars".
                    label: r + '<span aria-hidden="true">★</span><span class="sr-only"> star' + (r === '1' ? '' : 's') + '</span>',
                    count: ratingCounts[r]
                };
            }), { id: 'book-wall-filters', set: function (keys) { filters.ratings = keys; } });

        var yearCounts = tally(wall, readYears);
        pillRow(panel, 'year', 'Read in', 'Filter books by the year I read them',
            Object.keys(yearCounts).sort().reverse().map(function (y) {
                return { key: y, label: y, count: yearCounts[y] };
            }), { collapseAfter: YEARS_SHOWN, set: function (keys) { filters.years = keys; } });

        var periodCounts = tally(wall, function (b) { return [periodKey(b.y)]; });
        pillRow(panel, 'period', 'Published', 'Filter books by when they were first published',
            Object.keys(periodCounts).sort(function (a, b) {
                return periodOrder(b) - periodOrder(a);
            }).map(function (k) {
                return { key: k, label: krEscapeHtml(periodLabel(k).label), count: periodCounts[k] };
            }), { set: function (keys) { filters.periods = keys; } });

        var lengthCounts = tally(wall, function (b) { return [lengthKey(b.n)]; });
        pillRow(panel, 'length', 'Pages', 'Filter books by length',
            LENGTHS.filter(function (l) { return lengthCounts[l.key]; }).map(function (l) {
                return { key: l.key, label: krEscapeHtml(l.label), count: lengthCounts[l.key] };
            }), { set: function (keys) { filters.lengths = keys; } });

        var authors = topAuthors();
        pillRow(panel, 'author', 'Author', 'Filter books by author',
            authors.map(function (a) {
                return { key: a.key, label: krEscapeHtml(a.name), count: a.count };
            }), {
                multi: false,
                collapseAfter: AUTHORS_SHOWN,
                set: function (keys) {
                    // The box shows the author, as a link's ?author= does,
                    // and empties when the pill is let go.
                    var pick = keys.length ? authors.filter(function (a) { return a.key === keys[0]; })[0] : null;
                    activeAuthor = pick ? pick.name : '';
                    searchQuery = activeAuthor;
                    if (search) search.value = activeAuthor;
                }
            });

        var rereads = wall.filter(function (b) { return b.p && b.p.length; }).length;
        if (rereads) {
            var holder = krFacetRow(panel, 'Re-read', 'Filter books I have read more than once');
            var btn = krFacetButton(holder, krCountLabel('Read more than once', rereads), function () {
                filters.reread = !filters.reread;
                krSetPressed(btn, filters.reread);
                changed();
            });
            btn.id = 'book-wall-reread';
            krSetPressed(btn, filters.reread);
        }

        clearRow = krClearRow(panel, clearAll);
        syncBars();
    }

    /* The Author row's pills: every author with AUTHOR_MIN books or more,
       most books first, and the author in force when they have fewer,
       first, so a pressed pill always says what narrows the wall. */
    function topAuthors() {
        var by = {};
        wall.forEach(function (b) {
            var k = authorKey(b.a);
            if (!by[k]) by[k] = { key: k, name: b.a, count: 0 };
            by[k].count++;
        });
        var list = Object.keys(by).map(function (k) { return by[k]; }).filter(function (a) {
            return a.count >= AUTHOR_MIN;
        }).sort(function (a, b) {
            return b.count - a.count || textCompare(authorSortKey(a.name), authorSortKey(b.name));
        });
        var current = activeAuthor ? by[authorKey(activeAuthor)] : null;
        if (current && list.indexOf(current) === -1) list.unshift(current);
        return list;
    }

    /* Every row's pills as the state says, without their onChange. */
    function syncBars() {
        syncing = true;
        try {
            if (bars.genre) bars.genre.setActive(filters.genres);
            if (bars.rating) bars.rating.setActive(filters.ratings);
            if (bars.year) bars.year.setActive(filters.years);
            if (bars.period) bars.period.setActive(filters.periods);
            if (bars.length) bars.length.setActive(filters.lengths);
            if (bars.author) bars.author.setActive(activeAuthor ? [authorKey(activeAuthor)] : []);
        } finally {
            syncing = false;
        }
        var reread = document.getElementById('book-wall-reread');
        if (reread) krSetPressed(reread, filters.reread);
        if (clearRow) clearRow.sync(filterCount());
    }

    /* Every filter off (the panel's Clear all filters, and the empty
       state's). An author goes with them, and so does its name in the box. */
    function clearAll() {
        filters = { genres: [], ratings: [], years: [], periods: [], lengths: [], reread: false };
        if (activeAuthor) {
            activeAuthor = '';
            searchQuery = '';
            if (search) search.value = '';
        }
        syncBars();
        changed();
    }

    /* ---------------------------------------------------- sort, toolbar, url */

    function buildSortPanel() {
        var panel = document.getElementById('book-wall-sort');
        if (!panel) return;
        krSortPanel(panel, {
            options: SORTS,
            ariaLabel: 'Sort books',
            state: function () { return { key: sortKey, dir: sortDir }; },
            onChange: function (key, dir) {
                sortKey = key;
                sortDir = dir;
                changed();
            }
        });
    }

    function syncToolbar() {
        krToolbarLabels(filterCount(), krSortOption(SORTS, sortKey).label, sortDir);
    }

    /* Writes the search (or the author), the filters and the sort into the
       address bar (see the header). The query is kept as typed, trimmed; a
       key at its default is left out, so the whole wall is plain
       /books.html. */
    function syncUrl() {
        if (!window.history || !window.history.replaceState) return;
        var params = new URLSearchParams();
        var q = searchQuery.trim();
        if (activeAuthor) params.set('author', activeAuthor);
        else if (q) params.set('q', q);
        if (filters.ratings.length) params.set('rating', filters.ratings.join(','));
        if (filters.genres.length) params.set('genre', filters.genres.join(','));
        if (filters.years.length) params.set('read', filters.years.join(','));
        if (filters.periods.length) params.set('published', filters.periods.join(','));
        if (filters.lengths.length) params.set('len', filters.lengths.join(','));
        if (filters.reread) params.set('reread', '1');
        krSortToUrl(params, SORTS, sortKey, sortDir);
        var qs = params.toString();
        try {
            window.history.replaceState(window.history.state, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
        } catch (e) {}
    }

    /* The filters a URL asks for, each value kept only if a book on the
       wall has it. */
    function readUrl(params) {
        function known(key, counts) {
            var seen = {};
            return krUrlList(params, key).filter(function (v) {
                if (!counts[v] || seen[v]) return false;
                seen[v] = true;
                return true;
            });
        }
        filters.genres = known('genre', tally(wall, function (b) { return b.gn; }));
        filters.ratings = known('rating', tally(wall, function (b) { return [String(b.r)]; }));
        filters.years = known('read', tally(wall, readYears));
        filters.periods = known('published', tally(wall, function (b) { return [periodKey(b.y)]; }));
        filters.lengths = known('len', tally(wall, function (b) { return [lengthKey(b.n)]; }));
        filters.reread = params.get('reread') === '1' && wall.some(function (b) { return b.p && b.p.length; });
        var sort = krSortFromUrl(params, SORTS);
        sortKey = sort.key;
        sortDir = sort.dir;
    }

    /* After any change of state: the clear row, the toolbar, the address
       bar and the wall. */
    function changed() {
        if (clearRow) clearRow.sync(filterCount());
        syncToolbar();
        syncUrl();
        renderWall();
    }

    /* ------------------------------------------------------------- render */

    function renderWall() {
        var grid = document.getElementById('book-wall-grid');
        if (!grid) return;
        var f = currentFilters();
        var subset = wall.filter(function (b) { return passes(b, f); });
        subset.sort(comparator(sortKey, sortDir, order));
        grid.removeAttribute('aria-busy');
        if (subset.length) {
            grid.innerHTML = subset.map(tile).join('');
        } else {
            grid.innerHTML = '';
            showEmpty(grid, f.query || (activeAuthor ? activeAuthor : ''));
        }
        krUpdateSearchCounter(subset.length, wall.length, 'books', filterCount() === 0 && !f.query,
            { input: null, counter: 'book-wall-count' }, filterWords());
    }

    /* Nothing left: krListEmpty's Clear all filters, with the wall's own
       Clear search and the whole-site search beside it when there is a
       search (krListEmpty's own Clear search empties the blog's field). */
    function showEmpty(grid, q) {
        krListEmpty(grid, { clearFilters: filterCount() ? clearAll : null });
        if (!q || !search) return;
        var box = grid.querySelector('.kr-list-empty');
        if (!box) return;
        var row = box.querySelector('.kr-btn-row');
        if (!row) {
            row = document.createElement('div');
            row.className = 'kr-btn-row';
            box.appendChild(row);
        }
        function action(label, onClick) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'kr-btn kr-btn--ghost kr-btn--sm';
            btn.textContent = label;
            btn.addEventListener('click', onClick);
            return btn;
        }
        row.insertBefore(action('Clear search', function () {
            search.value = '';
            search.dispatchEvent(new Event('input'));
            search.focus();
        }), row.firstChild);
        if (window.krPalette && typeof window.krPalette.open === 'function') {
            row.appendChild(action('Search the whole site', function () { window.krPalette.open(q); }));
        }
    }

    /* ---------------------------------------------------------------- start */

    document.addEventListener('DOMContentLoaded', function () {
        var grid = document.getElementById('book-wall-grid');
        if (!grid) return;
        search = document.getElementById('book-wall-search');
        var params = new URLSearchParams(window.location.search);
        var presetAuthor = (params.get('author') || '').trim();
        // An author link fills the box with the name, in place of any ?q=.
        var presetQuery = presetAuthor || (params.get('q') || '').trim();
        var debounce = null;
        if (search) {
            if (presetQuery) search.value = presetQuery;
            search.addEventListener('input', function () {
                clearTimeout(debounce);
                debounce = setTimeout(function () {
                    var hadAuthor = !!activeAuthor;
                    activeAuthor = '';
                    searchQuery = search.value;
                    if (hadAuthor) syncBars();
                    changed();
                }, SEARCH_DEBOUNCE_MS);
            });
        }
        searchQuery = presetQuery;
        grid.setAttribute('aria-busy', 'true');
        // The same request js/bookshelf.js would make, shared through krFetchJson.
        krFetchJson('data/books.json').then(function (data) {
            books = Array.isArray(data) ? data : [];
            wall = books.filter(onTheWall);
            order = new Map();
            wall.forEach(function (b, i) { order.set(b, i); });
            var total = document.getElementById('book-wall-total');
            if (total) total.textContent = wall.length + ' books';
            // The author the link names, once there are books to find them
            // among; the box takes the name as the shelf spells it, unless
            // the reader has started typing in it while the books loaded.
            if (presetAuthor && (!search || search.value.trim() === presetAuthor)) {
                activeAuthor = wallAuthor(presetAuthor);
                if (activeAuthor && search) search.value = activeAuthor;
            }
            readUrl(params);
            buildFilterPanel();
            buildSortPanel();
            toolbar = krInitTogglePanels([
                ['kr-filter-toggle', 'book-wall-panel'],
                ['kr-sort-toggle', 'book-wall-sort']
            ]);
            syncToolbar();
            // A link that arrives filtered shows its filters; an author
            // alone is already named in the search box.
            if (filterCount() - (activeAuthor ? 1 : 0) > 0) {
                toolbar.open('book-wall-panel');
                krRevealPressed(document.getElementById('book-wall-panel'));
            }
            renderWall();
            // Values the wall does not offer were dropped by readUrl; write
            // what was kept, so the address bar matches the page.
            syncUrl();
        }).catch(function () {
            grid.removeAttribute('aria-busy');
            grid.innerHTML = '';
            var counter = document.getElementById('book-wall-count');
            if (counter) counter.textContent = 'The books could not be loaded just now.';
        });
    });
}());
