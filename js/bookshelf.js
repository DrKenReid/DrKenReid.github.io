/**
 * bookshelf.js — the literature page's shelf of spines.
 *
 * Every book read in data/books.json drawn as a spine, in the order it
 * was read: width from the length of the title, height varied by author,
 * colour band by rating. Hover or focus for the title; click for the
 * Goodreads page. It is a picture of a reading life rather than a table,
 * which is what a shelf is for.
 *
 * Widths are proportional to title length because that is the data to
 * hand; page counts would be truer, and are one Goodreads field away.
 */
(function () {
    'use strict';

    function goodreadsUrl(book) {
        return book.g ? 'https://www.goodreads.com/book/show/' + book.g
                      : 'https://www.goodreads.com/search?q=' + encodeURIComponent(book.t);
    }

    function hash(str) {
        var h = 2166136261;
        for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }

    function esc(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
    }

    /* A book's finish dates: `d` is the latest (unless it is only the
       date added, `e`), `p` holds the earlier reads the weekly refresh
       kept as the date moved on. Each is a session the calendar counts;
       the shelf files the book once, where it was first read. */
    function sessions(b) {
        var out = b.e ? [] : [b.d];
        return out.concat(b.p || []);
    }
    function firstRead(b) {
        var s = sessions(b);
        return s.length ? s.slice().sort()[0] : String(b.d || '');
    }

    function render(books) {
        var shelf = document.getElementById('kr-shelf');
        if (!shelf) return;
        var sorted = books.slice().sort(function (a, b) {
            return firstRead(a).localeCompare(firstRead(b));
        });
        var years = {};
        var html = sorted.map(function (b) {
            var title = b.t || '';
            var w = Math.max(26, Math.min(74, 18 + title.length * 0.85));
            var h = 200 + (hash(b.a || '') % 56);
            var year = firstRead(b).slice(0, 4);
            var marker = '';
            if (year && !years[year]) {
                years[year] = true;
                marker = '<span class="kr-shelf__year" aria-hidden="true">' + year + '</span>';
            }
            var label = title + (b.a ? ' — ' + b.a : '') + (b.r ? ' (' + b.r + '/5)' : '');
            return marker +
                '<a class="kr-spine kr-spine--r' + (b.r || 0) + '" href="' + goodreadsUrl(b) + '"' +
                ' target="_blank" rel="noopener noreferrer"' +
                ' style="width:' + w.toFixed(0) + 'px;height:' + h + 'px"' +
                ' title="' + esc(label) + '" aria-label="' + esc(label) + '">' +
                '<span class="kr-spine__title">' + esc(title) + '</span></a>';
        }).join('');
        shelf.innerHTML = html;
        var count = document.getElementById('kr-shelf-count');
        if (count) count.textContent = sorted.length.toLocaleString();
        // Start at the most recent end: that is the part of the shelf that
        // changes. The list itself does not scroll; its wrapper does.
        var scroller = shelf.parentNode;
        if (scroller) scroller.scrollLeft = scroller.scrollWidth;
    }

    /* ---------------------------------------------------- reading calendar
       One row per year from 2021, one cell per ISO week, shaded by the
       books finished that week; the year's total as a bar at the end of
       its row. A single amber ramp (magnitude, one hue), hover for the
       titles, and a table of the same numbers for anyone who wants them
       as numbers. */
    var CAL_FROM = 2021;

    function isoWeek(date) {
        var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        var day = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - day);
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return { year: d.getUTCFullYear(), week: Math.ceil(((d - yearStart) / 86400000 + 1) / 7) };
    }
    function weeksIn(year) {
        var dec28 = new Date(year, 11, 28);
        return isoWeek(dec28).week;
    }
    function parseDate(s) {
        var m = /^(\d{4})[\/-](\d{2})[\/-](\d{2})/.exec(String(s || ''));
        return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
    }
    function fmtWeek(year, week) {
        // Monday of that ISO week.
        var jan4 = new Date(year, 0, 4), day = jan4.getDay() || 7;
        var mon = new Date(year, 0, 4 - day + 1 + (week - 1) * 7);
        return mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }

    function renderCalendar(books) {
        var host = document.getElementById('kr-reading-calendar');
        if (!host) return;
        var now = new Date(), thisYear = now.getFullYear();
        var byCell = {}, byYear = {};
        books.forEach(function (b) {
            // Every finish, re-reads included; a date that is only the
            // date added (b.e) says nothing about the week and is skipped.
            sessions(b).forEach(function (s) {
                var d = parseDate(s);
                if (!d) return;
                var iw = isoWeek(d);
                if (iw.year < CAL_FROM) return;
                var k = iw.year + '-' + iw.week;
                (byCell[k] = byCell[k] || []).push(b);
                byYear[iw.year] = (byYear[iw.year] || 0) + 1;
            });
        });
        var years = [];
        for (var y = CAL_FROM; y <= thisYear; y++) years.push(y);
        var maxYear = Math.max.apply(null, years.map(function (y) { return byYear[y] || 0; })) || 1;
        var nowWeek = isoWeek(now);
        var html = '<div class="kr-cal__grid" role="img" aria-label="Books finished per week since ' + CAL_FROM + '">';
        years.forEach(function (y) {
            var n = weeksIn(y);
            html += '<div class="kr-cal__row"><span class="kr-cal__year">' + y + '</span><span class="kr-cal__weeks">';
            for (var w = 1; w <= n; w++) {
                var future = y === nowWeek.year && w > nowWeek.week;
                var list = byCell[y + '-' + w] || [];
                var level = Math.min(3, list.length);
                // A week with books is a button (keyboard reachable, and the
                // card opens on focus); an empty week is inert.
                if (list.length) {
                    var label = 'Week of ' + fmtWeek(y, w) + ' ' + y + ': ' + list.length + (list.length === 1 ? ' book: ' : ' books: ') +
                        list.map(function (b) { return b.t + (b.r ? ' (' + b.r + '/5)' : ''); }).join('; ');
                    html += '<button type="button" class="kr-cal__cell" data-l="' + level + '" data-k="' + y + '-' + w + '" aria-label="' + esc(label) + '"></button>';
                } else {
                    html += '<span class="kr-cal__cell' + (future ? ' kr-cal__cell--future' : '') + '" data-l="0"></span>';
                }
            }
            var total = byYear[y] || 0;
            html += '</span><span class="kr-cal__total"><span class="kr-cal__bar" style="width:' + Math.round(100 * total / maxYear) + '%"></span><span class="kr-cal__n">' + total + '</span></span></div>';
        });
        html += '</div>' +
            '<div class="kr-cal__legend" aria-hidden="true"><span>Fewer</span>' +
            '<span class="kr-cal__cell" data-l="0"></span><span class="kr-cal__cell" data-l="1"></span>' +
            '<span class="kr-cal__cell" data-l="2"></span><span class="kr-cal__cell" data-l="3"></span><span>More</span></div>' +
            '<details class="kr-cal__table"><summary>The same numbers as a table</summary><table><thead><tr><th scope="col">Year</th><th scope="col">Books finished</th></tr></thead><tbody>' +
            years.map(function (y) { return '<tr><th scope="row">' + y + '</th><td>' + (byYear[y] || 0) + '</td></tr>'; }).join('') +
            '</tbody></table></details>';
        host.innerHTML = html;
        initCalendarTip(host, byCell);
    }

    /* The card that opens over a week: the week, then each book with its
       author and rating. Anchored to the cell where the browser can do
       that; placed by hand (above the cell, clamped to the viewport)
       elsewhere. One card is shared by every cell. */
    function initCalendarTip(host, byCell) {
        var tip = document.createElement('div');
        tip.className = 'kr-cal__tip';
        tip.setAttribute('role', 'tooltip');
        document.body.appendChild(tip);
        var anchored = !!(window.CSS && CSS.supports && CSS.supports('position-area', 'top'));
        var current = null, hideTimer = null;

        function stars(r) {
            var n = Math.max(0, Math.min(5, +r || 0)), out = '';
            for (var i = 1; i <= 5; i++) out += '<span class="' + (i <= n ? 'is-on' : '') + '">' + (i <= n ? '\u2605' : '\u2606') + '</span>';
            return '<span class="kr-cal__tip-stars" aria-hidden="true">' + out + '</span>';
        }
        function show(cell) {
            var k = cell.getAttribute('data-k'), list = byCell[k] || [];
            if (!list.length) return;
            var parts = k.split('-'), y = +parts[0], w = +parts[1];
            var shown = list.slice(0, 8);
            tip.innerHTML = '<div class="kr-cal__tip-head">Week of ' + fmtWeek(y, w) + ' ' + y +
                '<span>' + list.length + (list.length === 1 ? ' book' : ' books') + '</span></div>' +
                '<ul class="kr-cal__tip-list">' + shown.map(function (b) {
                    return '<li><span class="kr-cal__tip-title">' + esc(b.t) + '</span>' +
                        (b.a ? '<span class="kr-cal__tip-author">' + esc(b.a) + '</span>' : '') + stars(b.r) + '</li>';
                }).join('') + '</ul>' +
                (list.length > shown.length ? '<div class="kr-cal__tip-more">and ' + (list.length - shown.length) + ' more</div>' : '');
            clearTimeout(hideTimer);
            if (current && current !== cell) current.style.anchorName = '';
            current = cell;
            tip.classList.add('is-visible');
            if (anchored) { cell.style.anchorName = '--kr-cal'; tip.style.left = tip.style.top = ''; return; }
            var r = cell.getBoundingClientRect(), tr = tip.getBoundingClientRect();
            var left = Math.max(8, Math.min(r.left + r.width / 2 - tr.width / 2, window.innerWidth - tr.width - 8));
            var top = r.top - tr.height - 10;
            if (top < 8) top = r.bottom + 10;
            tip.style.left = left + 'px';
            tip.style.top = top + 'px';
        }
        function hide() {
            hideTimer = setTimeout(function () { tip.classList.remove('is-visible'); }, 120);
        }
        host.addEventListener('mouseover', function (e) { var c = e.target.closest('.kr-cal__cell[data-k]'); if (c) show(c); });
        host.addEventListener('mouseout', function (e) { if (e.target.closest && e.target.closest('.kr-cal__cell[data-k]')) hide(); });
        host.addEventListener('focusin', function (e) { var c = e.target.closest('.kr-cal__cell[data-k]'); if (c) show(c); });
        host.addEventListener('focusout', function (e) { if (e.target.closest && e.target.closest('.kr-cal__cell[data-k]')) hide(); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') tip.classList.remove('is-visible'); });
        window.addEventListener('scroll', function () { tip.classList.remove('is-visible'); }, { passive: true });
    }

    /* ------------------------------------------------------- reading now
       The last book finished and this year's count, beside the books in
       progress that the page fills from now.json. */
    function coverOrBlank(b) {
        if (b.i) {
            return '<img src="https://covers.openlibrary.org/b/isbn/' + b.i + '-M.jpg?default=false" alt="" loading="lazy"' +
                ' onerror="this.outerHTML=\'<span class=&quot;kr-now__cover--blank&quot;>\' + this.getAttribute(\'data-t\') + \'</span>\'"' +
                ' data-t="' + esc(b.t) + '">';
        }
        return '<span class="kr-now__cover--blank">' + esc(b.t) + '</span>';
    }
    function fmtDay(d) {
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    function renderNow(books) {
        var last = document.getElementById('kr-last-finished');
        var yc = document.getElementById('kr-year-count');
        if (!last && !yc) return;
        var dated = books.filter(function (b) { return !b.e && parseDate(b.d); });
        dated.sort(function (a, b) { return String(b.d).localeCompare(String(a.d)); });
        if (last) {
            last.innerHTML = dated.slice(0, 2).map(function (b) {
                var d = parseDate(b.d);
                return '<a class="kr-now__book" href="' + goodreadsUrl(b) + '" target="_blank" rel="noopener noreferrer">' +
                    coverOrBlank(b) +
                    '<span><span class="kr-now__title">' + esc(b.t) + '</span>' +
                    '<span class="kr-now__meta">' + esc(b.a || '') + (b.r ? ' &middot; ' + b.r + '/5' : '') + '<br>' + fmtDay(d) + '</span></span></a>';
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
        var dated = books.filter(function (b) { return !b.e && parseDate(b.d); });
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
            return '<div class="kr-figure"><dt>' + esc(f[0]) + '</dt><dd><span class="kr-figure__n">' + esc(f[1]) + '</span>' +
                (f[2] ? '<span class="kr-figure__sub">' + esc(f[2]) + '</span>' : '') + '</dd></div>';
        }).join('');
    }

    function init() {
        if (!document.getElementById('kr-shelf') && !document.getElementById('kr-reading-calendar') && !document.getElementById('kr-figures')) return;
        fetch('/data/books.json').then(function (r) { return r.json(); }).then(function (books) {
            if (!Array.isArray(books)) return;
            var read = books.filter(function (b) { return b && b.t; });
            render(read);
            renderCalendar(read);
            renderNow(read);
            renderFigures(read);
        }).catch(function () {});
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
}());
