/**
 * post-shelf.js: the "From my shelf" strip at the end of a post about books.
 *
 * Purpose
 *   On a post whose data/posts.json record names authors in `shelf`, shows
 *   what the reading pages hold by each of them: my books by the author,
 *   each with my rating and the year I finished it (a re-read noted), a
 *   passage or two I saved while reading them, and links to the Quote Wall
 *   and to Every Book filtered to that author. An essay about one writer
 *   is where a reader is most likely to want those pages and, without
 *   this, least likely to learn they exist. It counts as those pages
 *   count (Every Book hangs the books I rated), so a number here is the
 *   number its link lands on. It does not link each book out to Goodreads
 *   (Every Book does that), and it never shows an empty box: an author
 *   with no rated book and no saved quote is left out, and a strip left
 *   with no author takes its slot away.
 *
 * Loaded by
 *   renderPostEnd in js/shared-components.js, and only on a post with a
 *   `shelf`: it makes the slot (.kr-post-end__slot.kr-post-shelf, hidden,
 *   between the sign-off and Up next) and appends this script. A post
 *   without the field loads neither this file nor the two data files.
 *   Needs shared-components.js (loadBlogPosts, postByFile,
 *   resolveCurrentPostFileName, krFetchJson, krEscapeHtml, krBookTitle,
 *   siteRootPrefix); starts itself.
 *
 * Exposes
 *   Nothing.
 *
 * Design notes
 *   - Which posts, and which authors, is written down, never guessed from
 *     a title: the `shelf` field, held to the reading data by the audit's
 *     posts-shelf rule (.github/scripts/audit_site.py).
 *   - The same passages on every visit. They are picked by a rule (the
 *     shortest that reads whole, the second from another book where there
 *     is one), not at random, so the page is the same page to everyone
 *     and a reader who comes back finds what they saw.
 *   - At most BOOKS_MAX books, my highest rated first and, within a
 *     rating, in the order I read them; the link to Every Book counts
 *     them all.
 *   - The rows are divs with list roles and the text is in spans: inside
 *     .blog-post an <li> or a <p> would take the prose rules (style.css
 *     section 10, "From my shelf").
 *   - authorKey is the function js/palette.js, js/bookwall.js and the
 *     script in quotes.html carry, so a name here selects on those pages
 *     what it selected here; tests/js/palette.test.js holds the copies
 *     together.
 */
(function () {
    'use strict';

    var BOOKS_MAX = 6;
    // A passage worth setting in the strip: long enough to say something,
    // short enough to stay a strip. Up to PASSAGES of them for a post
    // about one author, one each for a post about several.
    var PASSAGE_MIN = 30;
    var PASSAGE_MAX = 220;
    var PASSAGES = 2;

    function authorKey(name) {
        var s = String(name || '');
        if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return s.toLowerCase().replace(/[^a-z0-9]+/g, '') || s.toLowerCase().replace(/\s+/g, ' ').trim();
    }

    function tidy(s) {
        return String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
    }

    function plural(n, word) {
        return n + ' ' + word + (n === 1 ? '' : 's');
    }

    /* The dates a book was finished on, oldest first: `d` (unless it is
       only the date the book was added, `e`) and `p`, the earlier reads
       of a re-read. As js/bookshelf.js counts sessions. */
    function datesRead(b) {
        return (b.e ? [] : [b.d]).concat(b.p || []).map(String)
            .filter(function (d) { return /^\d{4}\D/.test(d); })
            .sort();
    }

    /* "2022"; "2023, re-read 2025"; "2025, twice" for a book read again
       within the year; '' for a book with no date kept. */
    function readLine(b) {
        var years = datesRead(b).map(function (d) { return d.slice(0, 4); });
        if (years.length < 2) return years[0] || '';
        var later = years.slice(1).filter(function (y, i, all) { return all.indexOf(y) === i; });
        if (later.length === 1 && later[0] === years[0]) {
            return years[0] + ', ' + (years.length === 2 ? 'twice' : years.length + ' times');
        }
        return years[0] + ', re-read ' + later.join(' and ');
    }

    /* A passage reads whole when its quotation marks pair up: a line saved
       from the middle of a conversation closes a quotation it never
       opened, or opens one it never closes, and looks broken set on its
       own. Curly doubles must nest. Straight doubles, and single marks
       that are not apostrophes (a letter on both sides), must come in an
       even number with the first of them opening, which is to say with
       nothing but a space or a bracket before it. A plural possessive
       ("the dogs' bowls") fails the test too; the passage is only passed
       over, and there are others. */
    function readsWhole(text) {
        var depth = 0, marks = { '"': [], "'": [] };
        for (var i = 0; i < text.length; i++) {
            var ch = text.charAt(i), before = text.charAt(i - 1), after = text.charAt(i + 1);
            if (ch === '\u201c') depth++;
            else if (ch === '\u201d') { if (--depth < 0) return false; }
            else if (ch === '"') marks['"'].push(before);
            else if ((ch === "'" || ch === '\u2018' || ch === '\u2019') &&
                !(/[A-Za-z]/.test(before) && /[A-Za-z]/.test(after))) marks["'"].push(before);
        }
        if (depth) return false;
        return ['"', "'"].every(function (kind) {
            var found = marks[kind];
            return found.length % 2 === 0 && (!found.length || !found[0] || /[\s(\[]/.test(found[0]));
        });
    }

    /* The passages to show, by rule: the shortest that fit and read whole,
       the second from a different book when the author has one. */
    function pickPassages(saved, howMany) {
        var fit = saved.map(function (q, i) {
            return { text: tidy(q.q), book: krBookTitle(q.b).title, id: q.g || tidy(q.b), at: i };
        }).filter(function (p) {
            return p.text.length >= PASSAGE_MIN && p.text.length <= PASSAGE_MAX && readsWhole(p.text);
        }).sort(function (x, y) {
            return x.text.length - y.text.length || x.at - y.at;
        });
        var out = fit.slice(0, 1);
        if (howMany > 1 && fit.length > 1) {
            var other = fit.filter(function (p) { return p.id !== fit[0].id; })[0];
            out.push(other || fit[1]);
        }
        return out;
    }

    /* One author's part of the strip as data, or null with nothing to
       show: { name, books: [...], total, quotes, passages: [...] }. */
    function shelfFor(name, books, quotes, howMany) {
        var key = authorKey(name);
        var mine = books.filter(function (b) { return b && b.r && authorKey(b.a) === key; });
        var saved = quotes.filter(function (q) { return q && q.q && authorKey(q.a) === key; });
        if (!mine.length && !saved.length) return null;
        // My highest rated first; within a rating, in the order I first
        // read them; on one date (a trilogy logged in a day), in the
        // order of the series, "#2" before "#10".
        var first = function (b) { return datesRead(b)[0] || '9999'; };
        var place = function (b) { var n = krBookTitle(b.t); return n.series || n.title; };
        var ranked = mine.slice().sort(function (x, y) {
            return y.r - x.r || (first(x) < first(y) ? -1 : first(x) > first(y) ? 1 : 0) ||
                place(x).localeCompare(place(y), undefined, { numeric: true }) ||
                String(x.t).localeCompare(String(y.t));
        });
        return {
            // As the shelf spells the name; an author I have only quoted
            // keeps the spelling posts.json gives.
            name: mine.length ? tidy(mine[0].a) : tidy(name),
            books: ranked.slice(0, BOOKS_MAX),
            total: mine.length,
            quotes: saved.length,
            passages: pickPassages(saved, howMany)
        };
    }

    function bookRow(b) {
        var name = krBookTitle(b.t);
        var read = readLine(b);
        var rating = Math.max(0, Math.min(5, +b.r || 0));
        return '<div class="kr-post-shelf__book" role="listitem">' +
            '<span class="kr-post-shelf__what">' +
                '<span class="kr-post-shelf__title">' + krEscapeHtml(name.title) + '</span>' +
                (name.series ? ' <span class="kr-post-shelf__series">' + krEscapeHtml(name.series) + '</span>' : '') +
            '</span>' +
            '<span class="kr-post-shelf__facts">' +
                // The stars are decoration; the number beside them is the rating.
                '<span class="kr-rating__stars" style="--kr-stars: ' + rating + '" aria-hidden="true"></span>' +
                '<span class="kr-post-shelf__score"><span class="sr-only">, rated </span>' + rating +
                    '<span class="sr-only"> out of 5</span></span>' +
                (read ? '<span class="kr-post-shelf__read"><span class="sr-only">, read in </span>' +
                    krEscapeHtml(read) + '</span>' : '') +
            '</span>' +
        '</div>';
    }

    function passageHtml(p) {
        return '<div class="kr-post-shelf__passage">' +
            '<span class="kr-post-shelf__quote">' + krEscapeHtml(p.text) + '</span>' +
            (p.book ? '<cite class="kr-post-shelf__source">' + krEscapeHtml(p.book) + '</cite>' : '') +
        '</div>';
    }

    /* "All 44 passages on the Quote Wall", with the author's name for a
       screen reader, which hears the links out of their card. */
    function onward(page, n, noun, where, author) {
        var href = siteRootPrefix() + page + '?' + new URLSearchParams({ author: author }).toString();
        return '<a class="kr-post-shelf__link" href="' + krEscapeHtml(href) + '">' +
            (n === 1 ? 'The one ' + noun : 'All ' + plural(n, noun)) +
            '<span class="sr-only"> by ' + krEscapeHtml(author) + '</span> on ' + where + '</a>';
    }

    function authorHtml(a) {
        return '<div class="kr-post-shelf__author">' +
            '<h3 class="kr-post-shelf__name">' + krEscapeHtml(a.name) + '</h3>' +
            (a.books.length ? '<div class="kr-post-shelf__books" role="list">' +
                a.books.map(bookRow).join('') + '</div>' : '') +
            (a.passages.length ? '<div class="kr-post-shelf__passages">' +
                a.passages.map(passageHtml).join('') + '</div>' : '') +
            '<div class="kr-post-shelf__links">' +
                (a.quotes ? onward('quotes.html', a.quotes, 'passage', 'the Quote Wall', a.name) : '') +
                (a.total ? onward('books.html', a.total, 'book', 'Every Book', a.name) : '') +
            '</div>' +
        '</div>';
    }

    function render(slot, names, books, quotes) {
        var seen = {};
        var authors = names.map(function (name) {
            var key = authorKey(name);
            if (seen[key]) return null;
            seen[key] = true;
            return shelfFor(name, books, quotes, names.length === 1 ? PASSAGES : 1);
        }).filter(Boolean);
        if (!authors.length) return false;
        slot.setAttribute('aria-labelledby', 'kr-post-shelf-title');
        slot.innerHTML = '<h2 class="kr-post-end__title" id="kr-post-shelf-title">From my shelf</h2>' +
            authors.map(authorHtml).join('');
        slot.hidden = false;
        return true;
    }

    function start() {
        var slot = document.querySelector('.kr-post-end .kr-post-shelf');
        if (!slot) return;
        var drop = function () { if (slot.parentNode) slot.parentNode.removeChild(slot); };
        // A file that fails counts as empty: the books still show without
        // the quotes, and the other way round.
        var read = function (path) {
            return krFetchJson(path).then(function (data) {
                return Array.isArray(data) ? data : [];
            }).catch(function () { return []; });
        };
        loadBlogPosts().then(function (posts) {
            var post = postByFile(posts, resolveCurrentPostFileName());
            var names = ((post && post.shelf) || []).map(tidy).filter(Boolean);
            if (!names.length) return drop();
            return Promise.all([read('data/books.json'), read('data/quotes-all.json')]).then(function (got) {
                if (!render(slot, names, got[0], got[1])) drop();
            });
        }).catch(drop);
    }

    start();
}());
