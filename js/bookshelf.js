/**
 * bookshelf.js: the reading pages' pictures of data/books.json, and the
 * book helpers both pages share.
 *
 * On literature.html it draws:
 *   - the shelf: every book read, as a spine, in the order it was first
 *     read (render), with buttons that jump along it by year
 *     (renderShelfYears). Width from the length of the title, height
 *     varied by author, colour band by rating. It is a picture of a
 *     reading life rather than a table, which is what a shelf is for.
 *     Widths follow the title because that is the data to hand; page
 *     counts would be truer, and are one Goodreads field away.
 *   - the reading calendar (initCalendar): weeks, or months on a phone,
 *     its empty frame drawn before the data arrives.
 *   - Reading Now: the books in progress from now.json, with the date of
 *     the refresh, the last one finished and this year's count
 *     (renderCurrentlyReading, renderNow).
 *   - the six figures, and the counts quoted in the prose (renderFigures).
 *   - if books.json fails, a note in each of those places with a button
 *     that asks again (showFailure).
 * books.html loads it for the book helpers and the typographic covers,
 * which the cover wall (js/bookwall.js) falls back to.
 *
 * Needs shared-components.js first (krEscapeHtml, and krBookTitle, the
 * display form of a Goodreads title, which lives there because the
 * homepage's quotation uses it too).
 *
 * Globals, kept to two:
 *   krTypeCover(book, {decorative}) -> <span class="kr-typecover">
 *       A cover set in type for a book with no picture, and
 *       krTypeCover.dataAttrs(book), the attributes a cover <img> carries
 *       so a failed load can become one.
 *   krBookshelf
 *       The pure helpers everything here is built on. The first three are
 *       how every reading-page view of a book links to it and names it
 *       (the shelf, the cover wall in bookwall.js, the reviews in
 *       literature.js); the rest let a test pin the calendar's arithmetic
 *       (ISO weeks, week 53, re-read sessions) without a page, in the
 *       manner of krLiveCovers.helpers. Change a signature here and change
 *       its callers and tests with it.
 *         goodreadsUrl(book) -> my review, else the book's page, else a search
 *         coverUrl(isbn, size) -> Open Library cover, size 'M' or 'L'
 *         label(book)     -> "Title (Series #1) by Author, 4/5"
 *         sessions(book)  -> ['YYYY/MM/DD', ...]  every finish the
 *                            calendar and the counts include
 *         firstRead(book) -> 'YYYY/MM/DD', where the shelf files the book
 *         isoWeek(date)   -> {year, week}, the ISO 8601 year and week
 *         weeksIn(year)   -> 52 or 53
 *         parseDate(s)    -> a local Date for 'YYYY/MM/DD' (or -), else null
 *         yearGroups(years) -> the shelf's year buttons, spans of years
 *                            that each hold enough books to be worth one
 *       It is set before the file touches the document, so a test can
 *       load this file with a stub window (and a krBookTitle) and nothing
 *       else.
 */
(function () {
    'use strict';

    /* ------------------------------------------------------- book links
       krBookTitle (shared-components.js) gives a title its display form;
       these three build what every reading-page view of a book links to
       and says about it, so the shelf, the cover wall and the reviews
       agree. */

    /* My review page for the book when the refresh has its id (rating and
       review in one place), else the book's page, else a search. */
    function goodreadsUrl(book) {
        if (book.w) return 'https://www.goodreads.com/review/show/' + book.w;
        return book.g ? 'https://www.goodreads.com/book/show/' + book.g
                      : 'https://www.goodreads.com/search?q=' + encodeURIComponent(book.t);
    }
    /* Open Library's cover for an ISBN, size 'M' (a wall tile, a Reading
       Now thumbnail) or 'L' (a review card). default=false: a 404 for an
       ISBN with no scan, rather than a blank placeholder, so the error
       listener below can set the cover in type instead. */
    function coverUrl(isbn, size) {
        return 'https://covers.openlibrary.org/b/isbn/' + encodeURIComponent(isbn) + '-' + (size || 'M') + '.jpg?default=false';
    }
    /* "The Captain (The Last Horizon #1) by Will Wight, 4/5": a spine's or
       a wall tile's name and tooltip, which have room for the series in
       brackets. */
    function bookLabel(b) {
        var name = krBookTitle(b.t);
        return name.title + (name.series ? ' (' + name.series + ')' : '') +
            (b.a ? ' by ' + b.a : '') + (b.r ? ', ' + b.r + '/5' : '');
    }

    /* ------------------------------------------------------------- dates
       A book's finish dates: `d` is the latest (unless it is only the date
       added, `e`), `p` holds the earlier reads the weekly refresh kept as
       the date moved on. Each is a session the calendar counts; the shelf
       files the book once, where it was first read. */
    function sessions(b) {
        var out = b.e ? [] : [b.d];
        return out.concat(b.p || []);
    }
    function firstRead(b) {
        var s = sessions(b);
        return s.length ? s.slice().sort()[0] : String(b.d || '');
    }
    function parseDate(s) {
        var m = /^(\d{4})[\/-](\d{2})[\/-](\d{2})/.exec(String(s || ''));
        return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
    }
    /* The Thursday of a date's ISO week, in UTC. ISO puts a week in the
       year its Thursday falls in; the month view puts it in that
       Thursday's month by the same rule. */
    function isoThursday(date) {
        var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        return d;
    }
    function isoWeek(date) {
        var d = isoThursday(date);
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return { year: d.getUTCFullYear(), week: Math.ceil(((d - yearStart) / 86400000 + 1) / 7) };
    }
    function weeksIn(year) {
        return isoWeek(new Date(year, 11, 28)).week;
    }

    /* ------------------------------------------------------ year buttons
       The shelf's year buttons (renderShelfYears) cover spans of years:
       oldest first, a span closes once it holds YEAR_GROUP_MIN books, so
       the thin early years (one to five books each) share a button and
       the busy ones get their own. The newest year always has its own.
       `years` is [{year, first, count}] oldest first: the year, the index
       of its first spine, and how many books it files. Returns
       [{label, year, first}]: "1997–2010" or "2024", the span's first
       year (whose marker the button scrolls to) and its first spine. */
    var YEAR_GROUP_MIN = 30;

    function yearGroups(years) {
        var groups = [], open = null;
        years.forEach(function (y, i) {
            var newest = i === years.length - 1;
            if (newest && open) { groups.push(open); open = null; }
            if (!open) open = { from: y.year, to: y.year, first: y.first, count: 0 };
            open.to = y.year;
            open.count += y.count;
            if (open.count >= YEAR_GROUP_MIN || newest) { groups.push(open); open = null; }
        });
        return groups.map(function (g) {
            return { label: g.from === g.to ? g.from : g.from + '–' + g.to, year: g.from, first: g.first };
        });
    }

    window.krBookshelf = {
        goodreadsUrl: goodreadsUrl,
        coverUrl: coverUrl,
        label: bookLabel,
        sessions: sessions,
        firstRead: firstRead,
        isoWeek: isoWeek,
        weeksIn: weeksIn,
        parseDate: parseDate,
        yearGroups: yearGroups
    };

    /* ------------------------------------------------- typographic cover
       The cover a book gets when there is no picture of it: Open Library
       has no scan for the ISBN, a hotlinked Goodreads image has gone, or
       the book never had an ISBN. Title in Lora, the series under it,
       the author at the foot, and down the left edge the same rating
       colour its spine has on the shelf (the .kr-spine--rN classes, reused
       so the two can never disagree). Built with textContent, so no title
       is ever parsed as markup. Its type scales with its own width
       (style.css, "Reading pages"), so one component serves a 56px Reading
       Now thumbnail and a cover-wall tile alike. `decorative` hides it
       from screen readers where the title is already written beside it. */
    function krTypeCover(book, opts) {
        var b = book || {};
        var name = krBookTitle(b.t);
        var r = Math.max(0, Math.min(5, Math.round(+b.r || 0)));
        var el = document.createElement('span');
        // --series tells the stylesheet's line budget to leave the series
        // its two lines (see "Typographic cover" in style.css).
        el.className = 'kr-typecover' + (name.series ? ' kr-typecover--series' : '');
        if (opts && opts.decorative) el.setAttribute('aria-hidden', 'true');
        function part(cls, text) {
            var s = document.createElement('span');
            s.className = cls;
            if (text) s.textContent = text;
            el.appendChild(s);
        }
        part('kr-typecover__band kr-spine--r' + r, '');
        part('kr-typecover__title', name.title);
        if (name.series) part('kr-typecover__series', name.series);
        if (b.a) part('kr-typecover__author', b.a);
        return el;
    }
    /* What a cover <img> carries so that, if it fails, the listener below
       can build its typographic stand-in: the raw title (series and all),
       author and rating. Escaped for a double-quoted attribute. */
    krTypeCover.dataAttrs = function (b) {
        return ' data-title="' + krEscapeHtml(b.t || '') + '"' +
            (b.a ? ' data-author="' + krEscapeHtml(b.a) + '"' : '') +
            (b.r ? ' data-rating="' + (+b.r || 0) + '"' : '');
    };
    window.krTypeCover = krTypeCover;

    // A test loads this file with a stub window and no document.
    if (typeof document === 'undefined' || !document.addEventListener) return;

    /* One listener for every book cover on the page, in the capture phase.
       An <img> error does not bubble, but it does travel down through the
       capture phase, so a single listener on the document sees every cover
       that fails, including ones rendered long after it was bound, and no
       cover needs an inline onerror (the old one spliced the title back
       into markup, so an apostrophe broke it). The typographic cover takes
       the image's place, so a tile keeps its size and a list its count.
       An image with empty alt text sat beside its own title, so the
       stand-in is hidden from screen readers too. */
    document.addEventListener('error', function (e) {
        var img = e.target;
        if (!img || img.tagName !== 'IMG' || !img.hasAttribute('data-title')) return;
        img.replaceWith(krTypeCover({
            t: img.getAttribute('data-title'),
            a: img.getAttribute('data-author'),
            r: img.getAttribute('data-rating')
        }, { decorative: !img.getAttribute('alt') }));
    }, true);

    function hash(str) {
        var h = 2166136261;
        for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }

    /* ------------------------------------------------------------- shelf
       Each spine is a link in a list item. The list is one Tab stop, not
       six hundred: a roving tabindex (initShelfKeys) leaves one spine in
       the Tab order, the newest to begin with since that is where the
       shelf opens, and the arrow keys, Home and End move between them, so
       every book is still in reach of the keyboard. A row of buttons over
       the shelf jumps along it by year (renderShelfYears). */
    // A series name is a second, smaller column of type down the spine.
    var SPINE_SERIES_W = 12;

    function render(books) {
        var shelf = document.getElementById('kr-shelf');
        if (!shelf) return;
        var sorted = books.slice().sort(function (a, b) {
            return firstRead(a).localeCompare(firstRead(b));
        });
        var years = {};
        var yearList = [];   // [{year, first (spine index), count}], oldest first
        var html = sorted.map(function (b, i) {
            var name = krBookTitle(b.t);
            var w = Math.max(26, Math.min(74, 18 + name.title.length * 0.85)) + (name.series ? SPINE_SERIES_W : 0);
            var h = 200 + (hash(b.a || '') % 56);
            var year = firstRead(b).slice(0, 4);
            var marker = '';
            if (year && !years[year]) {
                years[year] = { year: year, first: i, count: 0 };
                yearList.push(years[year]);
                marker = '<span class="kr-shelf__year" aria-hidden="true" data-year="' + krEscapeHtml(year) + '">' + krEscapeHtml(year) + '</span>';
            }
            if (years[year]) years[year].count++;
            var label = krEscapeHtml(bookLabel(b));
            return marker +
                '<span class="kr-shelf__slot" role="listitem">' +
                '<a class="kr-spine kr-spine--r' + (b.r || 0) + '" href="' + krEscapeHtml(goodreadsUrl(b)) + '"' +
                ' target="_blank" rel="noopener noreferrer" tabindex="-1" data-i="' + i + '"' +
                ' style="width:' + w.toFixed(0) + 'px;height:' + h + 'px"' +
                ' title="' + label + '" aria-label="' + label + '">' +
                '<span class="kr-spine__title">' + krEscapeHtml(name.title) + '</span>' +
                (name.series ? '<span class="kr-spine__series">' + krEscapeHtml(name.series) + '</span>' : '') +
                '</a></span>';
        }).join('');
        shelf.innerHTML = html;
        var count = document.getElementById('kr-shelf-count');
        if (count) count.textContent = sorted.length.toLocaleString();
        var keys = initShelfKeys(shelf);
        // Start at the most recent end: that is the part of the shelf that
        // changes. The list itself does not scroll; its wrapper does.
        var scroller = shelf.parentNode;
        if (scroller) scroller.scrollLeft = scroller.scrollWidth;
        renderShelfYears(document.getElementById('kr-shelf-years'), shelf, scroller, yearGroups(yearList), keys);
    }

    /* One Tab stop for the whole shelf (see the shelf's comment above).
       Returns {moveTo(index, focus)} so the year buttons can hand the stop
       to the first book of the year they jump to. */
    function initShelfKeys(shelf) {
        var spines = shelf.querySelectorAll('.kr-spine');
        if (!spines.length) return { moveTo: function () {} };
        var current = spines.length - 1;
        spines[current].tabIndex = 0;
        function moveTo(i, focus) {
            i = Math.max(0, Math.min(spines.length - 1, i));
            if (i !== current) {
                spines[current].tabIndex = -1;
                spines[i].tabIndex = 0;
                current = i;
            }
            if (focus) spines[i].focus();
        }
        shelf.addEventListener('keydown', function (e) {
            var spine = e.target.closest ? e.target.closest('.kr-spine') : null;
            if (!spine || e.altKey || e.ctrlKey || e.metaKey) return;
            var i = +spine.getAttribute('data-i');
            var to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: spines.length - 1 }[e.key];
            if (to === undefined) return;
            e.preventDefault();
            moveTo(to, true);
        });
        // A spine clicked or tapped becomes the stop, so Tab and the arrows
        // carry on from where the reader is.
        shelf.addEventListener('focusin', function (e) {
            var spine = e.target.closest ? e.target.closest('.kr-spine') : null;
            if (spine) moveTo(+spine.getAttribute('data-i'), false);
        });
        return { moveTo: moveTo };
    }

    /* The year buttons over the shelf, and a last one back to the newest
       end, where the shelf opens. A button scrolls the shelf (not the
       page) to put its year's marker at the left edge, and makes that
       year's first book the shelf's Tab stop; focus stays on the button,
       so another press can follow. Plain buttons: they jump, they do not
       filter, so nothing is pressed. */
    function renderShelfYears(host, shelf, scroller, groups, keys) {
        if (!host || !scroller || !groups.length) return;
        var spines = shelf.querySelectorAll('.kr-spine');
        function button(label, attrs) {
            return '<button type="button" class="btn gallery-filter-btn"' + attrs + '>' + krEscapeHtml(label) + '</button>';
        }
        host.innerHTML = groups.map(function (g) {
            return button(g.label, ' data-year="' + krEscapeHtml(g.year) + '" data-first="' + g.first + '"');
        }).join('') + button('Newest', ' data-first="' + (spines.length - 1) + '"');
        // Where the row scrolls (a phone), it starts at its newest end, as
        // the shelf does, with the older years off to the left.
        host.scrollLeft = host.scrollWidth;
        host.addEventListener('click', function (e) {
            var btn = e.target.closest ? e.target.closest('button[data-first]') : null;
            if (!btn) return;
            var year = btn.getAttribute('data-year');
            var marker = year ? shelf.querySelector('.kr-shelf__year[data-year="' + year + '"]') : null;
            var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            // Offsets are measured from the scroller's edge, which the
            // shelf's own left margin sits inside.
            var left = marker
                ? marker.getBoundingClientRect().left - scroller.getBoundingClientRect().left + scroller.scrollLeft - 12
                : scroller.scrollWidth;
            scroller.scrollTo({ left: Math.max(0, left), behavior: still ? 'auto' : 'smooth' });
            keys.moveTo(+btn.getAttribute('data-first'), false);
        });
    }

    /* ---------------------------------------------------- reading calendar
       One row per ISO year from 2021, one cell per ISO week, shaded by the
       books finished that week; the year's total as a bar at the end of
       its row. A single amber ramp (magnitude, one hue), hover or focus
       for the titles, and a table of the same numbers for anyone who wants
       them as numbers.

       Month view. Below 576px (Bootstrap's sm breakpoint) a row of 53
       weeks leaves each cell under 6px: too small to read a pattern from
       and far too small to tap. There the calendar folds into months, 12
       cells to a year, at least 22px each (wider than that from 320px up:
       the year and its total move onto a line of their own above the
       cells). A week goes to the month its Thursday falls in, the rule ISO
       uses to give a week a year, so a row of months adds up to exactly
       the row of weeks it replaces and the totals never change with the
       width. The ramp is the same, stepped on books per week (a month of
       four books reads as a week of one), and a tap opens the month's
       books in the same card a week uses.

       Buttons. A cell with books is a <button> (keyboard reachable, and
       the card opens on focus or tap) only when it is drawn at least 24px
       square, WCAG 2.5.8's minimum target. Month cells always are. Week
       cells, about 13px at full width, are a picture: hover shows the
       card, and the keyboard has the table and the shelf, which lists
       every book as a link. Measured after drawing rather than assumed,
       so a wider layout would get week buttons with no change here. A grid
       of buttons is a group; a grid of spans is an image, named with the
       year totals. (role="img" hides its children, so it can never hold
       buttons.)

       Before books.json arrives. The rows are known without it (one per
       year from CAL_FROM to this one), so the calendar is drawn at once
       with every cell empty and no totals, marked aria-busy, and drawn
       again when the data lands: the section has its final height from
       the start, and nothing below it moves. */
    var CAL_FROM = 2021;
    var MONTH_VIEW = '(max-width: 575.98px)';
    var TARGET_MIN = 24;
    var WEEKS_PER_MONTH = 52.1775 / 12;
    var TIP_LIMIT = 8;
    // Books a month's card lists in full on a phone. The card must fit on
    // one side of the tapped cell (style.css caps it at half the screen,
    // see .kr-cal__tip--month); eight ran to 490px and covered the cell.
    // A busier month (up to 14 books) is listed compactly instead, a line
    // a book with its title and stars (.kr-cal__tip--compact), and only a
    // screen too short even for that ends the list in "and N more".
    var TIP_LIMIT_MONTH = 4;
    var MONTH_NAMES = [];
    for (var mi = 0; mi < 12; mi++) {
        MONTH_NAMES.push(new Date(2026, mi, 1).toLocaleDateString('en-GB', { month: 'long' }));
    }

    function fmtWeek(year, week) {
        // Monday of that ISO week.
        var jan4 = new Date(year, 0, 4), day = jan4.getDay() || 7;
        var mon = new Date(year, 0, 4 - day + 1 + (week - 1) * 7);
        return mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }

    var CAL_VIEWS = {
        week: {
            cells: 'weeks',
            perWeek: 1,
            units: function (y) { return weeksIn(y); },
            future: function (y, u, now) { return y === now.year && u > now.week; },
            heading: function (y, u) { return 'Week of ' + fmtWeek(y, u) + ' ' + y; }
        },
        month: {
            cells: 'months',
            perWeek: WEEKS_PER_MONTH,
            units: function () { return 12; },
            future: function (y, u, now) { return y === now.year && u > now.month; },
            heading: function (y, u) { return MONTH_NAMES[u - 1] + ' ' + y; }
        }
    };

    function calendarModel(books, today) {
        var weeks = {}, months = {}, byYear = {};
        function add(map, key, b) { (map[key] = map[key] || []).push(b); }
        books.forEach(function (b) {
            // Every finish, re-reads included; a date that is only the date
            // added (b.e) says nothing about the week and is skipped.
            sessions(b).forEach(function (s) {
                var d = parseDate(s);
                if (!d) return;
                var iw = isoWeek(d);
                if (iw.year < CAL_FROM) return;
                add(weeks, iw.year + '-' + iw.week, b);
                add(months, iw.year + '-' + (isoThursday(d).getUTCMonth() + 1), b);
                byYear[iw.year] = (byYear[iw.year] || 0) + 1;
            });
        });
        var now = isoWeek(today);
        now.month = isoThursday(today).getUTCMonth() + 1;
        var years = [];
        for (var y = CAL_FROM; y <= now.year; y++) years.push(y);
        return { weeks: weeks, months: months, byYear: byYear, years: years, now: now };
    }

    function countLabel(n) { return n + (n === 1 ? ' book' : ' books'); }

    /* model.loading draws the frame without the data: empty cells, no
       totals, and a name that says it is still coming. */
    function calendarHtml(model, mode, buttons) {
        var view = CAL_VIEWS[mode], cells = model[view.cells];
        var totals = model.years.map(function (y) { return model.byYear[y] || 0; });
        var shown = function (i) { return model.loading ? '' : String(totals[i]); };
        var maxYear = Math.max.apply(null, totals) || 1;
        var name = 'Books finished per ' + mode + ' since ' + CAL_FROM;
        var html = '<div class="kr-cal__grid kr-cal__grid--' + mode + '"' + (buttons
            ? ' role="group" aria-label="' + name + '">'
            : ' role="img" aria-label="' + krEscapeHtml(model.loading ? name + ', loading' : name + ': ' + model.years.map(function (y, i) {
                return totals[i] + ' in ' + y;
            }).join(', ')) + '">');
        if (mode === 'month') {
            html += '<div class="kr-cal__monthnames" aria-hidden="true">' + MONTH_NAMES.map(function (m) {
                return '<span>' + m.charAt(0) + '</span>';
            }).join('') + '</div>';
        }
        model.years.forEach(function (y, i) {
            html += '<div class="kr-cal__row"><span class="kr-cal__year">' + y + '</span>' +
                '<span class="' + (mode === 'month' ? 'kr-cal__months' : 'kr-cal__weeks') + '">';
            for (var u = 1, n = view.units(y); u <= n; u++) {
                var key = y + '-' + u, list = cells[key] || [];
                if (!list.length) {
                    html += '<span class="kr-cal__cell' + (view.future(y, u, model.now) ? ' kr-cal__cell--future' : '') + '" data-l="0"></span>';
                    continue;
                }
                var level = Math.min(3, Math.ceil(list.length / view.perWeek));
                var attrs = ' class="kr-cal__cell" data-l="' + level + '" data-k="' + key + '"';
                if (buttons) {
                    var label = view.heading(y, u) + ': ' + countLabel(list.length) + ': ' + list.map(function (b) {
                        return krBookTitle(b.t).title + (b.r ? ' (' + b.r + '/5)' : '');
                    }).join('; ');
                    html += '<button type="button"' + attrs + ' aria-label="' + krEscapeHtml(label) + '"></button>';
                } else {
                    html += '<span' + attrs + '></span>';
                }
            }
            html += '</span><span class="kr-cal__total"><span class="kr-cal__bar" style="width:' +
                Math.round(100 * totals[i] / maxYear) + '%"></span><span class="kr-cal__n">' + shown(i) + '</span></span></div>';
        });
        html += '</div>' +
            '<div class="kr-cal__legend" aria-hidden="true"><span>Fewer</span>' +
            '<span class="kr-cal__cell" data-l="0"></span><span class="kr-cal__cell" data-l="1"></span>' +
            '<span class="kr-cal__cell" data-l="2"></span><span class="kr-cal__cell" data-l="3"></span><span>More</span></div>' +
            '<details class="kr-cal__table"><summary>The same numbers as a table</summary><table><thead><tr><th scope="col">Year</th><th scope="col">Books finished</th></tr></thead><tbody>' +
            model.years.map(function (y, i) { return '<tr><th scope="row">' + y + '</th><td>' + shown(i) + '</td></tr>'; }).join('') +
            '</tbody></table></details>';
        return html;
    }

    /* Draws the empty calendar now (see "Before books.json arrives" above)
       and returns, or null without a host:
         update(books)  draw the real calendar
         clear()        empty the host (books.json failed)
         frame()        the empty calendar again (a retry) */
    function initCalendar(host) {
        if (!host) return null;
        var model = null;
        var monthQuery = window.matchMedia ? window.matchMedia(MONTH_VIEW) : null;
        var drawn = '';   // 'week', 'week+buttons' or 'month+buttons'
        var mode = 'week';
        var tip = initCalendarTip(host, function (cell) {
            var key = cell.getAttribute('data-k'), parts = key.split('-');
            var list = model[CAL_VIEWS[mode].cells][key] || [];
            return { heading: CAL_VIEWS[mode].heading(+parts[0], +parts[1]), list: list, month: mode === 'month' };
        });

        function draw(nextMode, buttons) {
            var sig = nextMode + (buttons ? '+buttons' : '');
            if (sig === drawn) return;
            drawn = sig;
            mode = nextMode;
            tip.hide(true);
            host.innerHTML = calendarHtml(model, mode, buttons);
            host.classList.toggle('kr-cal--months', mode === 'month');
        }
        function fit() {
            if (!model) return;
            if (monthQuery && monthQuery.matches) { draw('month', true); return; }
            // Draw the weeks, then measure what the grid made of them.
            if (mode !== 'week' || !drawn) draw('week', false);
            var cell = host.querySelector('.kr-cal__weeks .kr-cal__cell');
            draw('week', !!cell && cell.getBoundingClientRect().width >= TARGET_MIN);
        }
        function redraw(next, busy) {
            model = next;
            if (busy) host.setAttribute('aria-busy', 'true'); else host.removeAttribute('aria-busy');
            drawn = '';
            fit();
        }
        function frame() {
            var empty = calendarModel([], new Date());
            empty.loading = true;
            redraw(empty, true);
        }
        frame();
        var queued = false;
        window.addEventListener('resize', function () {
            if (queued) return;
            queued = true;
            requestAnimationFrame(function () { queued = false; fit(); });
        });
        return {
            update: function (books) { redraw(calendarModel(books, new Date()), false); },
            clear: function () {
                model = null;
                drawn = '';
                tip.hide(true);
                host.innerHTML = '';
                host.removeAttribute('aria-busy');
            },
            frame: frame
        };
    }

    /* The card that opens over a cell: the week or month, then each book
       with its series, author and rating. Anchored to the cell where the
       browser can do that; placed by hand (above the cell, clamped to the
       viewport) elsewhere. One card is shared by every cell, in both views.
       Hover and focus open it; so does a click, because iOS neither
       focuses a tapped button nor always sends it a mouseover. A tap
       anywhere else, Escape or a scroll closes it. `describe(cell)` gives
       {heading, list} for the view on screen. */
    function initCalendarTip(host, describe) {
        var tip = document.createElement('div');
        tip.className = 'kr-cal__tip';
        tip.setAttribute('role', 'tooltip');
        document.body.appendChild(tip);
        var anchored = !!(window.CSS && CSS.supports && CSS.supports('position-area', 'top'));
        var current = null, hideTimer = null;
        var CELL = '.kr-cal__cell[data-k]';

        function stars(r) {
            var n = Math.max(0, Math.min(5, +r || 0)), out = '';
            for (var i = 1; i <= 5; i++) out += '<span class="' + (i <= n ? 'is-on' : '') + '">' + (i <= n ? '★' : '☆') + '</span>';
            return '<span class="kr-cal__tip-stars" aria-hidden="true">' + out + '</span>';
        }
        function fill(info, compact, limit) {
            var list = info.list, shown = list.slice(0, limit);
            tip.innerHTML = '<div class="kr-cal__tip-head">' + krEscapeHtml(info.heading) +
                '<span>' + countLabel(list.length) + '</span></div>' +
                '<ul class="kr-cal__tip-list">' + shown.map(function (b) {
                    var name = krBookTitle(b.t);
                    return '<li><span class="kr-cal__tip-title">' + krEscapeHtml(name.title) + '</span>' +
                        (!compact && name.series ? '<span class="kr-cal__tip-series">' + krEscapeHtml(name.series) + '</span>' : '') +
                        (!compact && b.a ? '<span class="kr-cal__tip-author">' + krEscapeHtml(b.a) + '</span>' : '') + stars(b.r) + '</li>';
                }).join('') + '</ul>' +
                (list.length > shown.length ? '<div class="kr-cal__tip-more">and ' + (list.length - shown.length) + ' more</div>' : '');
        }
        function show(cell) {
            var info = describe(cell), list = info.list;
            if (!list.length) return;
            // A month with more books than its card lists in full goes
            // compact and lists them all (see TIP_LIMIT_MONTH).
            var compact = !!info.month && list.length > TIP_LIMIT_MONTH;
            var limit = !info.month ? TIP_LIMIT : compact ? list.length : TIP_LIMIT_MONTH;
            tip.classList.toggle('kr-cal__tip--month', !!info.month);
            tip.classList.toggle('kr-cal__tip--compact', compact);
            fill(info, compact, limit);
            // Only a screen too short for the whole list shortens it, a
            // book at a time, until the card fits under its cap.
            while (compact && limit > TIP_LIMIT_MONTH && tip.scrollHeight > tip.clientHeight + 1) {
                fill(info, compact, --limit);
            }
            clearTimeout(hideTimer);
            if (current && current !== cell) current.style.anchorName = '';
            current = cell;
            tip.classList.add('is-visible');
            if (anchored) { cell.style.anchorName = '--kr-cal'; tip.style.left = tip.style.top = ''; return; }
            var r = cell.getBoundingClientRect(), tr = tip.getBoundingClientRect();
            var left = Math.max(8, Math.min(r.left + r.width / 2 - tr.width / 2, window.innerWidth - tr.width - 8));
            // Above the cell, or below it when it fits there and not above;
            // with room on neither side, whichever side has more.
            var above = r.top - 18, below = window.innerHeight - r.bottom - 18;
            var up = tr.height <= above || (tr.height > below && above >= below);
            var top = up ? r.top - tr.height - 10 : r.bottom + 10;
            tip.style.left = left + 'px';
            tip.style.top = top + 'px';
        }
        function hide(now) {
            clearTimeout(hideTimer);
            if (now) { tip.classList.remove('is-visible'); return; }
            hideTimer = setTimeout(function () { tip.classList.remove('is-visible'); }, 120);
        }
        function cellOf(e) { return e.target && e.target.closest ? e.target.closest(CELL) : null; }
        host.addEventListener('mouseover', function (e) { var c = cellOf(e); if (c) show(c); });
        host.addEventListener('mouseout', function (e) { if (cellOf(e)) hide(); });
        host.addEventListener('focusin', function (e) { var c = cellOf(e); if (c) show(c); });
        host.addEventListener('focusout', function (e) { if (cellOf(e)) hide(); });
        document.addEventListener('click', function (e) {
            var c = cellOf(e);
            if (c && host.contains(c)) show(c); else hide(true);
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(true); });
        window.addEventListener('scroll', function () { hide(true); }, { passive: true });
        return { hide: hide };
    }

    /* ------------------------------------------------------- reading now
       The books in progress (now.json, refreshed weekly with the rest of
       the live data), the last two finished and this year's count
       (books.json). Each book is one link: cover, title, the series on a
       quieter line, then author and date. */
    function coverImg(src, b) {
        return '<img src="' + krEscapeHtml(src) + '" alt="" loading="lazy"' + krTypeCover.dataAttrs(b) + '>';
    }
    function typeCoverHtml(b) {
        return krTypeCover(b, { decorative: true }).outerHTML;
    }
    function readingBook(href, rel, b, cover, meta) {
        var name = krBookTitle(b.t);
        return '<a class="kr-reading__book" href="' + krEscapeHtml(href) + '" target="_blank" rel="' + rel + '">' +
            cover +
            '<span><span class="kr-reading__title">' + krEscapeHtml(name.title) + '</span>' +
            (name.series ? '<span class="kr-reading__series">' + krEscapeHtml(name.series) + '</span>' : '') +
            '<span class="kr-reading__meta">' + meta + '</span></span></a>';
    }
    function fmtDay(d) {
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    /* The list ends on the date of the weekly refresh that wrote it, so a
       stalled refresh shows its age instead of passing for this week. */
    function renderCurrentlyReading() {
        var grid = document.getElementById('currently-reading-grid');
        if (!grid) return;
        krFetchJson('data/now.json').then(function (now) {
            var reading = now && Array.isArray(now.reading) ? now.reading : [];
            var asOf = now && now.updated && typeof formatPostDate === 'function'
                ? '<p class="kr-reading__meta kr-reading__asof">Updated ' + krEscapeHtml(formatPostDate(now.updated)) + '</p>' : '';
            if (!reading.length) {
                grid.innerHTML = '<p class="kr-reading__meta">Between books.</p>' + asOf;
                return;
            }
            grid.innerHTML = reading.map(function (r) {
                var b = { t: r.title, a: r.author };
                return readingBook(r.link, 'nofollow noopener noreferrer', b,
                    r.img ? coverImg(r.img, b) : typeCoverHtml(b), krEscapeHtml(r.author || ''));
            }).join('') + asOf;
        }).catch(function () {
            grid.innerHTML = '<p class="kr-reading__meta">Could not load this just now.</p>';
        });
    }

    function renderNow(books) {
        var last = document.getElementById('kr-last-finished');
        var yc = document.getElementById('kr-year-count');
        if (!last && !yc) return;
        var dated = books.filter(function (b) { return !b.e && parseDate(b.d); });
        dated.sort(function (a, b) { return String(b.d).localeCompare(String(a.d)); });
        if (last) {
            last.innerHTML = dated.slice(0, 2).map(function (b) {
                return readingBook(goodreadsUrl(b), 'noopener noreferrer', b,
                    b.i ? coverImg(coverUrl(b.i), b) : typeCoverHtml(b),
                    krEscapeHtml(b.a || '') + (b.r ? ' &middot; ' + b.r + '/5' : '') + '<br>' + fmtDay(parseDate(b.d)));
            }).join('');
        }
        if (yc) {
            var y = new Date().getFullYear();
            var inYear = function (year) {
                var n = 0;
                books.forEach(function (b) { sessions(b).forEach(function (s) { if (s.slice(0, 4) === String(year)) n++; }); });
                return n;
            };
            var thisYear = inYear(y), lastYear = inYear(y - 1);
            var again = 0;
            books.forEach(function (b) { (b.p || []).forEach(function () { if (String(b.d).slice(0, 4) === String(y)) again++; }); });
            yc.textContent = String(thisYear);
            var sub = document.getElementById('kr-year-sub');
            if (sub) sub.textContent = 'book' + (thisYear === 1 ? '' : 's') + ' finished in ' + y + (again ? ', ' + again + ' of them re-reads' : '') + '; ' + lastYear + ' in ' + (y - 1) + '.';
        }
    }

    /* ---------------------------------------------------------- figures
       Six numbers worked out from books.json, so a Goodreads refresh
       changes them without anyone retyping a figure. */
    function renderFigures(books) {
        var host = document.getElementById('kr-figures');
        var rated = books.filter(function (b) { return b.r > 0; });
        var reviews = books.filter(function (b) { return b.v; }).length;
        // The counts quoted in the page's prose come from the same file.
        Array.prototype.forEach.call(document.querySelectorAll('[data-lit]'), function (el) {
            var k = el.getAttribute('data-lit');
            if (k === 'books') el.textContent = String(Math.floor(books.length / 10) * 10) + '+';
            if (k === 'reviews') el.textContent = String(reviews);
        });
        if (!host) return;
        var avg = rated.reduce(function (s, b) { return s + b.r; }, 0) / (rated.length || 1);
        var five = rated.filter(function (b) { return b.r === 5; }).length;
        var byAuthor = {}, byYear = {};
        var finishes = [];
        books.forEach(function (b) {
            if (b.a) byAuthor[b.a] = (byAuthor[b.a] || 0) + 1;
            sessions(b).forEach(function (s) { if (parseDate(s)) finishes.push(s); });
        });
        finishes.sort();
        finishes.forEach(function (s) { var y = s.slice(0, 4); byYear[y] = (byYear[y] || 0) + 1; });
        var topAuthor = Object.keys(byAuthor).sort(function (a, b) { return byAuthor[b] - byAuthor[a] || a.localeCompare(b); })[0] || '';
        var topYear = Object.keys(byYear).sort(function (a, b) { return byYear[b] - byYear[a] || b.localeCompare(a); })[0] || '';
        // Longest run of consecutive ISO weeks with at least one book finished.
        var weeks = {};
        finishes.forEach(function (s) {
            var d = parseDate(s), day = d.getDay() || 7;
            var mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day + 1);
            weeks[mon.getTime()] = true;
        });
        var keys = Object.keys(weeks).map(Number).sort(function (a, b) { return a - b; });
        var best = 0, run = 0, bestEnd = 0;
        for (var i = 0; i < keys.length; i++) {
            run = (i > 0 && keys[i] - keys[i - 1] <= 7 * 86400000 + 3600000) ? run + 1 : 1;
            if (run > best) { best = run; bestEnd = keys[i]; }
        }
        var streakEnd = best ? new Date(bestEnd) : null;
        var first = finishes.length ? parseDate(finishes[0]) : null;
        var rereads = books.reduce(function (n, b) { return n + (b.p || []).length; }, 0);
        var figures = [
            ['Books read', String(books.length), (first ? 'on the shelf since ' + first.getFullYear() : '') + (rereads ? ', ' + rereads + ' read again' : '')],
            ['Five stars', String(five), Math.round(100 * five / (rated.length || 1)) + '% of the ' + rated.length + ' I rated'],
            ['Average rating', avg.toFixed(2), 'out of 5, across every rating'],
            ['Most read author', topAuthor, byAuthor[topAuthor] + ' books'],
            ['Busiest year', topYear, byYear[topYear] + ' books finished'],
            ['Longest streak', best + (best === 1 ? ' week' : ' weeks'), streakEnd ? 'in a row with a book finished, ending ' + streakEnd.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '']
        ];
        host.innerHTML = figures.map(function (f) {
            return '<div class="kr-figure"><dt>' + krEscapeHtml(f[0]) + '</dt><dd><span class="kr-figure__n">' + krEscapeHtml(f[1]) + '</span>' +
                (f[2] ? '<span class="kr-figure__sub">' + krEscapeHtml(f[2]) + '</span>' : '') + '</dd></div>';
        }).join('');
    }

    /* ---------------------------------------------------------- failure
       When books.json does not arrive, each section it feeds says so in
       place of an empty card or a dash, with a button that asks again
       (krFetchJson forgets a failed request, so the retry is a real one).
       The note goes after the section's own element, which may be a list
       or a <dl> that cannot hold a paragraph.
       The notes stay until the retry is answered, and then the reader's
       place is kept: a button that had focus would otherwise go from
       under it and leave focus on the page itself. Focus goes to the
       heading of the section whose button was pressed, or to its new
       button if the retry failed too. */
    var FAILED = 'kr-reading__failed';
    var FED = ['kr-last-finished', 'kr-reading-calendar', 'kr-shelf', 'kr-figures'];

    /* retry(id) asks again; `from` is the id of the section whose button
       was pressed, if one was. */
    function showFailure(retry, from) {
        FED.forEach(function (id) {
            var el = document.getElementById(id);
            if (!el) return;
            var note = document.createElement('p');
            note.className = FAILED;
            note.innerHTML = '<span>Could not load the books just now.</span> ' +
                '<button type="button" class="kr-btn kr-btn--ghost kr-btn--sm">Try again</button>';
            var button = note.querySelector('button');
            button.addEventListener('click', function () { retry(id); });
            el.parentNode.insertBefore(note, el.nextSibling);
            if (id === from) button.focus();
        });
        var sub = document.getElementById('kr-year-sub');
        if (sub) sub.textContent = 'Could not load the books just now.';
    }

    function clearFailure() {
        Array.prototype.forEach.call(document.querySelectorAll('.' + FAILED), function (n) { n.remove(); });
        var sub = document.getElementById('kr-year-sub');
        if (sub) sub.textContent = '';
    }

    /* The heading a section's content sits under: its column's h3 in
       Reading Now, else its band's h2. Focusable from script only, and
       scrolled to if it is off screen, so the focus is seen. */
    function focusHeading(id) {
        var el = document.getElementById(id);
        var area = el && el.closest ? el.closest('.kr-reading__col, .about-us-area') : null;
        var heading = area ? area.querySelector('h2, h3') : null;
        if (!heading) return;
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
        heading.focus();
    }

    function init() {
        renderCurrentlyReading();
        if (!document.getElementById('kr-shelf') && !document.getElementById('kr-reading-calendar') &&
            !document.getElementById('kr-figures') && !document.getElementById('kr-last-finished')) return;
        // The calendar's frame goes up before the data (see initCalendar).
        var calendar = initCalendar(document.getElementById('kr-reading-calendar'));
        var asking = false;
        // `from`: the section whose Try again was pressed (see "failure").
        function load(from) {
            asking = true;
            // Shared with literature.js's reviews, so the page asks for it once.
            krFetchJson('data/books.json').then(function (books) {
                if (!Array.isArray(books)) throw new Error('data/books.json is not a list');
                var read = books.filter(function (b) { return b && b.t; });
                clearFailure();
                render(read);
                if (calendar) calendar.update(read);
                renderNow(read);
                renderFigures(read);
                asking = false;
                if (from) focusHeading(from);
            }).catch(function () {
                // The empty calendar goes, rather than stand there as a
                // year of nothing read; a retry puts the frame back.
                if (calendar) calendar.clear();
                clearFailure();
                asking = false;
                showFailure(function (id) {
                    if (asking) return;
                    if (calendar) calendar.frame();
                    load(id);
                }, from);
            });
        }
        load();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
}());
