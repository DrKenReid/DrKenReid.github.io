/**
 * listening.js: the listening history on the music page.
 *
 * Purpose
 *   Draws the listening history, listening.json in data/ (one record per
 *   Last.fm chart week over the whole account, kept up by
 *   .github/scripts/refresh_listening.py), on music.html:
 *     - the listening calendar: one row per year and one cell per week,
 *       or per month on a phone, shaded by the scrobbles in it, with the
 *       most played artist in the cell's card, the year's total as a bar
 *       at the end of its row, and the same numbers as a table;
 *     - six figures worked out from the same records (figures), each
 *       with a card of what is behind it.
 *   The block (#kr-listening) is hidden in the page's markup and shown
 *   only once the file has a week with something played. With no weeks,
 *   or no file, nothing is drawn and the page is as it was without it:
 *   the lastfmstats charts behind their facade.
 *
 * Loaded by
 *   music.html, after shared-components.js (krFetchJson, krEscapeHtml,
 *   formatPostDate).
 *
 * Exposes
 *   krListening, the pure helpers the drawing is built on, so a test can
 *   pin the arithmetic without a page (tests/js/listening.test.js). It is
 *   set before the file touches the document, so a test can load this
 *   file with a stub window and nothing else.
 *     parseDay(s)        -> the UTC time of 'YYYY-MM-DD', else NaN
 *     isoWeek(ms)        -> {year, week, month}: the ISO 8601 year and
 *                           week of a UTC day, and the month of that
 *                           week's Thursday
 *     weeksIn(year)      -> 52 or 53
 *     cellOf(d)          -> the {year, week, month} a chart week starting
 *                           on the day d is drawn in, else null
 *     thresholds(counts) -> [a, b]: the weekly counts that end the first
 *                           and second shades
 *     level(n, steps)    -> 0 to 3, a cell's shade
 *     leaders(weeks)     -> [{a, weeks, plays}]: the artists who led a
 *                           week, most weeks first
 *     model(weeks, today)-> what the calendar draws, or null with nothing
 *                           played: {weeks, cells, months, byYear, years,
 *                           steps, first, last}
 *     figures(model)     -> the six figures as numbers and records
 *
 * Design notes
 *   - It is the reading calendar (initCalendar in js/bookshelf.js) with
 *     scrobbles for books: the same markup and classes, so the two share
 *     their rules (style.css §14) and the listening one adds only its
 *     wider totals (§15). The same behaviour too. Below 576px (MONTH_VIEW)
 *     a row of 53 weeks is too small to read or tap, so the calendar
 *     folds into months. A cell is a button, reached by Tab with its card
 *     opening on focus or a tap, only when it is drawn at least TARGET_MIN
 *     (24px) square, WCAG 2.5.8's minimum target: month cells always are,
 *     week cells (about 13px) are a picture, named with the year totals,
 *     with the table under it for anyone who wants the numbers.
 *     bookshelf.js keeps its calendar and its card to itself, so the week
 *     arithmetic and the card are restated here, in UTC, which is how
 *     Last.fm draws its weeks. The card differs in one thing: opened by
 *     keyboard focus, it stays through a scroll (onScroll in initTip).
 *   - A chart week runs from noon on a Sunday (UTC) to the next, and the
 *     calendar's columns are ISO weeks, Monday to Sunday. A chart week is
 *     drawn in the ISO week that holds six and a half of its seven days:
 *     the one its fourth day falls in (cellOf). A month takes the weeks
 *     whose Thursday falls in it, the rule ISO uses to give a week a
 *     year, so a row of months adds up to the row of weeks it replaces.
 *   - A row's total is the sum of its own cells, so a year here is an ISO
 *     year. The reading calendar gives each row its calendar year's count
 *     instead, which it can: a book has the day it was finished. A chart
 *     week that spans 31 December is one number for both years and cannot
 *     be split between them, so the bar, the table, the picture's name
 *     and the year figures all count a year as its row does, and agree.
 *   - Shades are thirds, not a scale from nought to the busiest week: one
 *     week of a thousand scrobbles would leave every other week the
 *     palest shade. A third of the weeks with music are in each
 *     (thresholds); a month is shaded by its average week.
 *   - A week the file has no record of (before the first week with
 *     music, after the newest, or one the refresh could not fetch) is
 *     drawn faded, as the reading calendar draws the weeks still to
 *     come: not known is not the same as nothing played.
 *   - The file holds each week's most played artist and nothing more, so
 *     "most weeks at number one" is what the figures can say about
 *     artists. A year's most played artist overall is a different
 *     question, which a week's winner cannot answer.
 */
(function () {
    'use strict';

    var DAY = 86400000;
    var MONTH_VIEW = '(max-width: 575.98px)';
    var TARGET_MIN = 24;
    var MONTH_NAMES = [];
    for (var mi = 0; mi < 12; mi++) {
        MONTH_NAMES.push(new Date(Date.UTC(2026, mi, 1)).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' }));
    }

    /* ------------------------------------------------------------- dates
       Everything in UTC: the file's dates are UTC days, and a reader's
       own time zone must not move a week into another column. */
    function parseDay(s) {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
        return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
    }
    function isoWeek(ms) {
        var thursday = new Date(ms + (4 - (new Date(ms).getUTCDay() || 7)) * DAY);
        var yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
        return {
            year: thursday.getUTCFullYear(),
            week: Math.ceil(((thursday - yearStart) / DAY + 1) / 7),
            month: thursday.getUTCMonth() + 1
        };
    }
    function weeksIn(year) {
        return isoWeek(Date.UTC(year, 11, 28)).week;
    }
    function cellOf(d) {
        var ms = parseDay(d);
        return isNaN(ms) ? null : isoWeek(ms + 3 * DAY);
    }

    /* ------------------------------------------------------------ shades */
    function thresholds(counts) {
        var s = counts.filter(function (n) { return n > 0; }).sort(function (a, b) { return a - b; });
        if (!s.length) return [0, 0];
        return [s[Math.floor((s.length - 1) / 3)], s[Math.floor((s.length - 1) * 2 / 3)]];
    }
    function level(n, steps) {
        return !(n > 0) ? 0 : n <= steps[0] ? 1 : n <= steps[1] ? 2 : 3;
    }

    /* The artists who led a week among `weeks`, with how many weeks each
       led and the plays that won them: most weeks first, then most
       plays, then by name, so the order never depends on the file's. */
    function leaders(weeks) {
        var by = {}, out = [];
        weeks.forEach(function (w) {
            if (!w.a) return;
            var key = ' ' + w.a;   // an artist may be called "constructor"
            if (!by[key]) out.push(by[key] = { a: w.a, weeks: 0, plays: 0 });
            by[key].weeks++;
            by[key].plays += w.p;
        });
        return out.sort(function (x, y) {
            return y.weeks - x.weeks || y.plays - x.plays || (x.a < y.a ? -1 : x.a > y.a ? 1 : 0);
        });
    }

    /* ------------------------------------------------------------- model
       The file's weeks as the calendar needs them. Records it cannot
       place (no date, no count) are left out, and so are the silent weeks
       before the first one with music: the picture starts where the
       listening does. Returns null when nothing was ever played. */
    function buildModel(weeks, today) {
        var all = [];
        (Array.isArray(weeks) ? weeks : []).forEach(function (w) {
            var cell = w ? cellOf(w.d) : null, n = w ? Math.floor(+w.n) : NaN;
            if (!cell || !(n >= 0)) return;
            all.push({
                d: w.d, ms: parseDay(w.d), n: n,
                a: n > 0 && w.a ? String(w.a) : '',
                p: n > 0 ? Math.max(0, Math.floor(+w.p) || 0) : 0,
                year: cell.year, week: cell.week, month: cell.month
            });
        });
        all.sort(function (x, y) { return x.ms - y.ms; });
        var start = -1;
        all.some(function (w, i) { if (w.n > 0) start = i; return w.n > 0; });
        if (start < 0) return null;

        var list = [], cells = {}, months = {}, byYear = {};
        all.slice(start).forEach(function (w) {
            var key = w.year + '-' + w.week;
            // Chart weeks are seven days apart, so no two share a cell;
            // were the file ever to hold two that did, the first stands.
            if (cells[key]) return;
            cells[key] = w;
            list.push(w);
            (months[w.year + '-' + w.month] = months[w.year + '-' + w.month] || []).push(w);
            byYear[w.year] = (byYear[w.year] || 0) + w.n;
        });
        var last = list[list.length - 1];
        var now = isoWeek(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
        var years = [];
        for (var y = list[0].year; y <= Math.max(now.year, last.year); y++) years.push(y);
        return {
            weeks: list, cells: cells, months: months, byYear: byYear, years: years,
            steps: thresholds(list.map(function (w) { return w.n; })),
            first: list[0], last: last
        };
    }

    /* ----------------------------------------------------------- figures
       The numbers behind the six cards, as plain data (renderFigures
       words them). Years are the calendar's rows, ISO years, so a figure
       and the row it describes agree. */
    function figures(model) {
        var weeks = model.weeks;
        var played = weeks.filter(function (w) { return w.n > 0; });
        var total = played.reduce(function (s, w) { return s + w.n; }, 0);

        var years = model.years.map(function (y) {
            var inYear = weeks.filter(function (w) { return w.year === y; });
            var counts = inYear.filter(function (w) { return w.n > 0; }).map(function (w) { return w.n; });
            var top = leaders(inYear)[0] || null;
            return { year: y, n: model.byYear[y] || 0, weeks: inYear.length, median: median(counts), leader: top };
        });
        // The later of two equal years: it is the one a reader remembers.
        var busiestYear = years.slice().sort(function (a, b) { return b.n - a.n || b.year - a.year; })[0];
        var busiestWeeks = played.slice().sort(function (a, b) { return b.n - a.n || b.ms - a.ms; }).slice(0, 5);

        // A run is consecutive chart weeks with something played. A week
        // with no record ends one as a silent week does: it is not known
        // to have had music.
        var runs = [], run = null;
        weeks.forEach(function (w, i) {
            if (!(w.n > 0)) { run = null; return; }
            if (run && w.ms - weeks[i - 1].ms === 7 * DAY) { run.weeks++; run.to = w; return; }
            runs.push(run = { weeks: 1, from: w, to: w });
        });
        var current = run && run.to === model.last ? run : null;
        runs.sort(function (a, b) { return b.weeks - a.weeks || b.to.ms - a.to.ms; });

        return {
            total: total,
            weeksPlayed: played.length,
            weeksSilent: weeks.length - played.length,
            years: years,
            busiestYear: busiestYear,
            busiestWeeks: busiestWeeks,
            runs: runs.slice(0, 3),
            current: current,
            median: median(played.map(function (w) { return w.n; })),
            leaders: leaders(played)
        };
    }

    function median(counts) {
        var s = counts.slice().sort(function (a, b) { return a - b; });
        if (!s.length) return 0;
        var mid = Math.floor(s.length / 2);
        return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
    }

    window.krListening = {
        parseDay: parseDay,
        isoWeek: isoWeek,
        weeksIn: weeksIn,
        cellOf: cellOf,
        thresholds: thresholds,
        level: level,
        leaders: leaders,
        model: buildModel,
        figures: figures
    };

    // A test loads this file with a stub window and no document.
    if (typeof document === 'undefined' || !document.addEventListener) return;

    /* ------------------------------------------------------------- words */
    function num(n) { return Math.round(n).toLocaleString('en-GB'); }
    function count(n, one, many) { return num(n) + ' ' + (n === 1 ? one : many); }
    function scrobbles(n) { return count(n, 'scrobble', 'scrobbles'); }
    function fmt(ms, opts) {
        opts.timeZone = 'UTC';
        return new Date(ms).toLocaleDateString('en-GB', opts);
    }
    function weekName(w) {
        return 'Week of ' + fmt(w.ms, { day: 'numeric', month: 'short', year: 'numeric' });
    }
    function weekInWords(w) {   // mid-sentence, with the month in full
        return 'week of ' + fmt(w.ms, { day: 'numeric', month: 'long', year: 'numeric' });
    }
    function monthYear(ms) { return fmt(ms, { month: 'long', year: 'numeric' }); }

    /* A card's list: [[title, line under it]], both plain text. */
    function tipList(rows) {
        return '<ul class="kr-cal__tip-list">' + rows.map(function (r) {
            return '<li><span class="kr-cal__tip-title">' + krEscapeHtml(r[0]) + '</span>' +
                (r[1] ? '<span class="kr-cal__tip-author">' + krEscapeHtml(r[1]) + '</span>' : '') + '</li>';
        }).join('') + '</ul>';
    }
    /* A card's rows of key, middle and number: the middle a bar (a share
       of the largest, 0 to 1) or, given text, the text. */
    function tipRows(rows) {
        return '<ul class="kr-tip-bars">' + rows.map(function (r) {
            return '<li><span class="kr-tip-bars__k">' + krEscapeHtml(r[0]) + '</span>' +
                (typeof r[1] === 'number'
                    ? '<span class="kr-tip-bars__bar"><span style="width:' + Math.round(100 * r[1]) + '%"></span></span>'
                    : '<span>' + krEscapeHtml(r[1]) + '</span>') +
                '<span class="kr-tip-bars__n">' + krEscapeHtml(r[2]) + '</span></li>';
        }).join('') + '</ul>';
    }

    /* ---------------------------------------------------------- calendar
       What one cell stands for, in the view on screen: null with no
       record of it, else {n, per, heading, label, body}. `per` is the
       scrobbles a week that the shade is read from. */
    function describe(model, mode, key) {
        if (mode === 'week') {
            var w = model.cells[key];
            if (!w) return null;
            return {
                n: w.n, per: w.n,
                heading: weekName(w),
                label: weekName(w) + ': ' + scrobbles(w.n) +
                    (w.a ? '; most played ' + w.a + ', ' + count(w.p, 'play', 'plays') : ''),
                body: w.a ? tipList([[w.a, 'most played that week, ' + count(w.p, 'play', 'plays')]]) : ''
            };
        }
        var list = model.months[key];
        if (!list) return null;
        var n = list.reduce(function (s, x) { return s + x.n; }, 0);
        var top = leaders(list), parts = key.split('-');
        var name = MONTH_NAMES[+parts[1] - 1] + ' ' + parts[0];
        return {
            n: n, per: n / list.length, month: true,
            heading: name,
            label: name + ': ' + scrobbles(n) + (top.length ? '; most played by week: ' + top.map(function (t) {
                return t.a + ' (' + count(t.weeks, 'week', 'weeks') + ')';
            }).join(', ') : ''),
            body: tipList(top.map(function (t) {
                return [t.a, 'most played in ' + count(t.weeks, 'week', 'weeks') + ', ' + count(t.plays, 'play', 'plays')];
            }))
        };
    }

    function calendarHtml(model, mode, buttons) {
        var totals = model.years.map(function (y) { return model.byYear[y] || 0; });
        var maxYear = Math.max.apply(null, totals) || 1;
        var name = 'Scrobbles per ' + mode + ' since ' + model.years[0];
        var html = '<div class="kr-cal__grid kr-cal__grid--' + mode + '"' + (buttons
            ? ' role="group" aria-label="' + name + '">'
            : ' role="img" aria-label="' + krEscapeHtml(name + ': ' + model.years.map(function (y, i) {
                return num(totals[i]) + ' in ' + y;
            }).join(', ')) + '">');
        if (mode === 'month') {
            html += '<div class="kr-cal__monthnames" aria-hidden="true">' + MONTH_NAMES.map(function (m) {
                return '<span>' + m.charAt(0) + '</span>';
            }).join('') + '</div>';
        }
        model.years.forEach(function (y, i) {
            html += '<div class="kr-cal__row"><span class="kr-cal__year">' + y + '</span>' +
                '<span class="' + (mode === 'month' ? 'kr-cal__months' : 'kr-cal__weeks') + '">';
            for (var u = 1, units = mode === 'month' ? 12 : weeksIn(y); u <= units; u++) {
                var key = y + '-' + u, info = describe(model, mode, key);
                if (!info || !info.n) {
                    // No record of it is drawn faded; nothing played, empty.
                    html += '<span class="kr-cal__cell' + (info ? '' : ' kr-cal__cell--future') + '" data-l="0"></span>';
                    continue;
                }
                var attrs = ' class="kr-cal__cell" data-l="' + level(info.per, model.steps) + '" data-k="' + key + '"';
                html += buttons
                    ? '<button type="button"' + attrs + ' aria-label="' + krEscapeHtml(info.label) + '"></button>'
                    : '<span' + attrs + '></span>';
            }
            html += '</span><span class="kr-cal__total"><span class="kr-cal__bar" style="width:' +
                Math.round(100 * totals[i] / maxYear) + '%"></span><span class="kr-cal__n">' + num(totals[i]) + '</span></span></div>';
        });
        var byYear = figures(model).years;
        html += '</div>' +
            '<div class="kr-cal__legend" aria-hidden="true"><span>Fewer</span>' +
            '<span class="kr-cal__cell" data-l="0"></span><span class="kr-cal__cell" data-l="1"></span>' +
            '<span class="kr-cal__cell" data-l="2"></span><span class="kr-cal__cell" data-l="3"></span><span>More</span></div>' +
            '<details class="kr-cal__table"><summary>The same numbers as a table</summary><table><thead><tr>' +
            '<th scope="col">Year</th><th scope="col">Scrobbles</th><th scope="col">Most weeks at number one</th></tr></thead><tbody>' +
            byYear.map(function (r) {
                return '<tr><th scope="row">' + r.year + '</th><td>' + num(r.n) + '</td><td>' +
                    (r.leader ? krEscapeHtml(r.leader.a) + ', ' + count(r.leader.weeks, 'week', 'weeks') : '') + '</td></tr>';
            }).join('') + '</tbody></table></details>';
        return html;
    }

    /* Draws the calendar in the view the width calls for, and again when
       that changes (see the Design notes on views and buttons). */
    function initCalendar(host, model) {
        var monthQuery = window.matchMedia ? window.matchMedia(MONTH_VIEW) : null;
        var drawn = '';   // 'week', 'week+buttons' or 'month+buttons'
        var mode = 'week';
        var tip = initTip(host, function (cell) {
            return describe(model, mode, cell.getAttribute('data-k'));
        }, '.kr-cal__cell[data-k]');

        function draw(nextMode, buttons) {
            var sig = nextMode + (buttons ? '+buttons' : '');
            if (sig === drawn) return;
            drawn = sig;
            mode = nextMode;
            tip.hide(true);
            host.innerHTML = calendarHtml(model, mode, buttons);
        }
        function fit() {
            if (monthQuery && monthQuery.matches) { draw('month', true); return; }
            // Draw the weeks, then measure what the grid made of them.
            if (mode !== 'week' || !drawn) draw('week', false);
            var cell = host.querySelector('.kr-cal__weeks .kr-cal__cell');
            draw('week', !!cell && cell.getBoundingClientRect().width >= TARGET_MIN);
        }
        fit();
        var queued = false;
        window.addEventListener('resize', function () {
            if (queued) return;
            queued = true;
            requestAnimationFrame(function () { queued = false; fit(); });
        });
    }

    /* The card that opens over a cell or a figure: the reading
       calendar's (initCalendarTip in js/bookshelf.js, .kr-cal__tip in
       style.css §14), with a body built here. Anchored to its cell where
       the browser can do that; placed by hand (above the cell, clamped
       to the viewport) elsewhere. Hover and focus open it; so does a
       click, because iOS neither focuses a tapped button nor always
       sends it a mouseover. A tap anywhere else or Escape closes it,
       and so does a scroll, unless the card is on the element that has
       keyboard focus (onScroll). `info(cell)` gives {heading, count,
       body, month}. */
    var tipCount = 0;
    function initTip(host, info, selector) {
        var tip = document.createElement('div');
        tip.className = 'kr-cal__tip';
        tip.id = 'kr-listening-tip-' + (++tipCount);
        tip.setAttribute('role', 'tooltip');
        document.body.appendChild(tip);
        var anchored = !!(window.CSS && CSS.supports && CSS.supports('position-area', 'top'));
        var current = null, hideTimer = null;

        function show(cell) {
            var what = info(cell);
            if (!what) return;
            tip.classList.toggle('kr-cal__tip--month', !!what.month);
            tip.innerHTML = '<div class="kr-cal__tip-head">' + krEscapeHtml(what.heading) +
                (what.count || what.n ? '<span>' + krEscapeHtml(what.count || scrobbles(what.n)) + '</span>' : '') +
                '</div>' + (what.body || '');
            clearTimeout(hideTimer);
            if (current && current !== cell) { current.style.anchorName = ''; current.removeAttribute('aria-describedby'); }
            current = cell;
            cell.setAttribute('aria-describedby', tip.id);
            tip.classList.add('is-visible');
            place(cell);
        }
        function place(cell) {
            if (anchored) { cell.style.anchorName = '--kr-cal'; tip.style.left = tip.style.top = ''; return; }
            var r = cell.getBoundingClientRect(), tr = tip.getBoundingClientRect();
            var left = Math.max(8, Math.min(r.left + r.width / 2 - tr.width / 2, window.innerWidth - tr.width - 8));
            // Above the cell, or below it when it fits there and not above;
            // with room on neither side, whichever side has more.
            var above = r.top - 18, below = window.innerHeight - r.bottom - 18;
            var up = tr.height <= above || (tr.height > below && above >= below);
            tip.style.left = left + 'px';
            tip.style.top = (up ? r.top - tr.height - 10 : r.bottom + 10) + 'px';
        }
        function hide(now) {
            clearTimeout(hideTimer);
            if (now) { tip.classList.remove('is-visible'); return; }
            hideTimer = setTimeout(function () { tip.classList.remove('is-visible'); }, 120);
        }
        function cellOfEvent(e) { return e.target && e.target.closest ? e.target.closest(selector) : null; }
        host.addEventListener('mouseover', function (e) { var c = cellOfEvent(e); if (c) show(c); });
        host.addEventListener('mouseout', function (e) { if (cellOfEvent(e)) hide(); });
        host.addEventListener('focusin', function (e) { var c = cellOfEvent(e); if (c) show(c); });
        host.addEventListener('focusout', function (e) { if (cellOfEvent(e)) hide(); });
        document.addEventListener('click', function (e) {
            var c = cellOfEvent(e);
            if (c && host.contains(c)) show(c); else hide(true);
        });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(true); });
        /* A scroll closes a card the pointer opened. One on the element
           that has keyboard focus stays, and is placed again where the
           script does the placing: a browser scrolls a focused element
           into view, and that scroll used to close the card the focus
           had just opened, so a figure reached with Tab below the fold
           never showed one. */
        var placing = false;
        function onScroll() {
            var keyed = false;
            if (current && current === document.activeElement && tip.classList.contains('is-visible')) {
                try { keyed = current.matches(':focus-visible'); } catch (e) {}
            }
            if (!keyed) { hide(true); return; }
            if (anchored || placing) return;
            placing = true;
            requestAnimationFrame(function () { placing = false; if (current) place(current); });
        }
        document.addEventListener('scroll', onScroll, { passive: true, capture: true });
        return { hide: hide };
    }

    /* ----------------------------------------------------- figure cards
       The reading figures' markup (renderFigures in js/bookshelf.js,
       .kr-figure in style.css §14): a label, the figure, a line of words
       and for some a small picture, aria-hidden since the words and the
       card already say what it shows. Heights and widths are inline:
       they are the data. */
    function vizBars(values, hi) {
        var top = Math.max.apply(null, values) || 1;
        return '<span class="kr-figure__viz" aria-hidden="true">' + values.map(function (v, i) {
            return '<span class="kr-figure__bar' + (i === hi ? ' kr-figure__bar--hi' : '') +
                '" style="height:' + Math.max(6, Math.round(100 * v / top)) + '%"></span>';
        }).join('') + '</span>';
    }
    function vizRows(rows) {   // [[label, value, highlighted]]
        var top = Math.max.apply(null, rows.map(function (r) { return r[1]; })) || 1;
        return '<span class="kr-figure__viz kr-figure__viz--rows" aria-hidden="true">' + rows.map(function (r) {
            return '<span class="kr-figure__row' + (r[2] ? ' kr-figure__row--hi' : '') + '"><span>' + krEscapeHtml(r[0]) +
                '</span><span style="width:' + Math.max(4, Math.round(100 * r[1] / top)) + '%"></span></span>';
        }).join('') + '</span>';
    }

    /* Each card carries its own hover card ({f: [label, figure, words,
       picture], tip}), so the two cannot drift apart. */
    function figureCards(model) {
        var f = figures(model);
        var newestFirst = f.years.slice().reverse();
        var topYear = Math.max.apply(null, f.years.map(function (y) { return y.n; })) || 1;
        var topMedian = Math.max.apply(null, f.years.map(function (y) { return y.median; })) || 1;
        var by = f.busiestYear, week = f.busiestWeeks[0], run = f.runs[0], lead = f.leaders[0];
        var runWords = function (r) {
            var from = monthYear(r.from.ms), to = monthYear(r.to.ms);
            return r.from === r.to ? 'the ' + weekInWords(r.from) : from === to ? 'in ' + from : 'from ' + from + ' to ' + to;
        };

        var cards = [{
            f: ['Scrobbles', num(f.total), 'in the weekly charts since ' + monthYear(model.first.ms) +
                ', across ' + count(f.weeksPlayed, 'week', 'weeks') + ' with something played'],
            tip: { heading: 'Scrobbles by year', body: tipRows(newestFirst.map(function (y) {
                return [String(y.year), y.n / topYear, num(y.n)];
            })) }
        }, {
            f: ['Busiest year', String(by.year), scrobbles(by.n) + ', about ' + num(by.n / (by.weeks * 7)) + ' a day',
                vizBars(f.years.map(function (y) { return y.n; }), f.years.indexOf(by))],
            tip: { heading: 'Number one most often in ' + by.year, body: tipList(leaders(model.weeks.filter(function (w) {
                return w.year === by.year;
            })).slice(0, 5).map(function (t) {
                return [t.a, 'most played in ' + count(t.weeks, 'week', 'weeks') + ', ' + count(t.plays, 'play', 'plays')];
            })) }
        }, {
            f: ['Busiest week', num(week.n), 'scrobbles in the ' + weekInWords(week) +
                (week.a ? ', ' + num(week.p) + ' of them ' + week.a : '')],
            tip: { heading: 'The busiest weeks', body: tipList(f.busiestWeeks.map(function (w) {
                return [weekName(w) + ': ' + num(w.n), w.a ? w.a + ', ' + count(w.p, 'play', 'plays') : ''];
            })) }
        }, {
            f: ['Longest streak', count(run.weeks, 'week', 'weeks'), 'in a row with something played, ' + runWords(run) +
                (f.current === run ? ', and still going' : f.current ? '; the run I am on is ' + count(f.current.weeks, 'week', 'weeks') : '')],
            tip: { heading: 'The longest runs', body: tipList(f.runs.map(function (r) {
                return [count(r.weeks, 'week', 'weeks'), runWords(r)];
            })) }
        }, {
            f: ['A usual week', num(f.median), 'scrobbles: half the weeks with music had more, half fewer' +
                (f.weeksSilent ? '. ' + count(f.weeksSilent, 'week', 'weeks') + ' had none at all' : '')],
            tip: { heading: 'A usual week, by year', body: tipRows(newestFirst.map(function (y) {
                return [String(y.year), y.median / topMedian, num(y.median)];
            })) }
        }];
        if (lead) {
            cards.push({
                f: ['Most weeks at number one', lead.a, 'the most played artist in ' + count(lead.weeks, 'week', 'weeks') +
                    ', of the ' + count(f.leaders.length, 'artist', 'artists') + ' who led one',
                    f.leaders.length > 1 ? vizRows(f.leaders.slice(0, 3).map(function (t, i) { return [t.a, t.weeks, i === 0]; })) : ''],
                tip: { heading: 'Number one most often, by year', count: 'weeks', body: tipRows(newestFirst.filter(function (y) {
                    return y.leader;
                }).map(function (y) { return [String(y.year), y.leader.a, String(y.leader.weeks)]; })) }
            });
        }
        return cards;
    }

    function renderFigures(host, model) {
        var cards = figureCards(model);
        // f[3], the picture, is built markup (viz*); the rest is escaped.
        host.innerHTML = cards.map(function (c, i) {
            var f = c.f;
            return '<div class="kr-figure" tabindex="0" data-fig="' + i + '"><dt>' + krEscapeHtml(f[0]) + '</dt><dd><span class="kr-figure__n">' + krEscapeHtml(f[1]) + '</span>' +
                '<span class="kr-figure__sub">' + krEscapeHtml(f[2]) + '</span>' + (f[3] || '') + '</dd></div>';
        }).join('');
        initTip(host, function (fig) { return cards[+fig.getAttribute('data-fig')].tip; }, '.kr-figure[data-fig]');
    }

    function init() {
        var block = document.getElementById('kr-listening');
        var calendar = document.getElementById('kr-listening-calendar');
        if (!block || !calendar) return;
        // A file that does not arrive leaves the block hidden: the section
        // is the page's own charts link without it, not a failure to report.
        krFetchJson('data/listening.json').then(function (data) {
            var model = buildModel(data && data.weeks, new Date());
            if (!model) return;
            var since = document.getElementById('kr-listening-since');
            if (since) since.textContent = monthYear(model.first.ms);
            var asOf = document.getElementById('kr-listening-asof');
            if (asOf && data.updated && typeof formatPostDate === 'function') {
                asOf.textContent = ', as of ' + formatPostDate(data.updated);
            }
            // Shown before it is drawn: the calendar measures its cells.
            block.hidden = false;
            try {
                initCalendar(calendar, model);
                var figs = document.getElementById('kr-listening-figures');
                if (figs) renderFigures(figs, model);
            } catch (e) {
                block.hidden = true;
                throw e;
            }
        }, function () {});
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
}());
