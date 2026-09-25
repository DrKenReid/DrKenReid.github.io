/**
 * literature.js: the quotation band and the selected reviews on
 * literature.html. It starts itself and leaves nothing global. It needs
 * shared-components.js (krFetchJson, krEscapeHtml, krBookTitle,
 * krQuoteRotator) before it runs, and looks up krTypeCover and
 * krBookshelf from js/bookshelf.js only when the reviews render: both
 * files are deferred and this one runs first (without bookshelf.js the
 * reviews show plain covers and link to a search).
 *
 * The quotations rotate through data/quotes.json, shuffled, in the
 * homepage quotation's component, driven by the same code
 * (krQuoteRotator in shared-components.js, which sets out the WCAG 2.2.2
 * contract). The band here adds .kr-home-quote--hold: a pointer resting
 * on it (on devices that hover), or keyboard focus on the quotation
 * itself, holds the countdown where it is (style.css, "Reading pages").
 *
 * Reviews come from data/reviews.json; three show at first and the rest
 * wait behind a button.
 */
(function () {
    'use strict';

    var REVIEWS_SHOWN = 3;      // style.css hides the rest: .kr-reviews--collapsed, nth-child(n+4)
    var REVIEW_CUT = 300;       // characters of a review shown on its card

    function shuffle(arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    /* ------------------------------------------------------ quotations */
    function initQuotes() {
        var section = document.getElementById('quotes');
        if (section) {
            krFetchJson('data/quotes.json').then(function (data) {
                if (Array.isArray(data) && data.length) krQuoteRotator(section, shuffle(data));
            }).catch(function () {});
        }
        // The band draws on a short list; the count in the prose is the
        // whole collection, the same file the homepage counts.
        var counts = document.querySelectorAll('[data-lit="quotes"]');
        if (counts.length) {
            krFetchJson('data/quotes-all.json').then(function (all) {
                if (!Array.isArray(all)) return;
                counts.forEach(function (el) { el.textContent = String(all.length); });
            }).catch(function () {});
        }
    }

    /* --------------------------------------------------------- reviews */
    function initReviews() {
        // reviews.json is the hand-picked dozen; books.json (the weekly
        // Goodreads refresh) knows each book's review id, so the card can
        // link to the review itself rather than to the book.
        // A book being read again is on currently-reading, not the read
        // shelf, so now.json's entries (which link to the review) join in.
        // books.json is the shelf's too (js/bookshelf.js): one request serves both.
        Promise.all([
            krFetchJson('data/reviews.json'),
            krFetchJson('data/books.json').catch(function () { return []; }),
            krFetchJson('data/now.json').catch(function () { return {}; })
        ]).then(function (all) {
            var books = Array.isArray(all[1]) ? all[1].slice() : [];
            ((all[2] && all[2].reading) || []).forEach(function (b) {
                var m = /\/review\/show\/(\d+)/.exec(b.link || '');
                if (m) books.push({ t: b.title, w: m[1] });
            });
            renderReviews(all[0], books);
        }).catch(function () {});
    }

    /* The books.json entry a review is of: by ISBN, then by title, then by
       the title before any series bracket or subtitle (another edition). */
    function reviewedBook(r, books) {
        var key = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
        var hit = null;
        for (var i = 0; i < books.length && !hit; i++) {
            var b = books[i];
            if ((r.isbn13 && b.i === r.isbn13) || (r.isbn && b.i === r.isbn) || key(b.t) === key(r.title)) hit = b;
        }
        if (!hit) {
            // A different edition: the title before any series bracket.
            var short = key(r.title.replace(/\s*\(.*?\)\s*$/, '').split(':')[0]);
            for (var j = 0; j < books.length && !hit; j++) {
                if (key(books[j].t.replace(/\s*\(.*?\)\s*$/, '').split(':')[0]) === short) hit = books[j];
            }
        }
        return hit;
    }

    function renderReviews(reviews, books) {
        var container = document.getElementById('reviews-grid');
        if (!container) return;
        reviews.forEach(function (r) {
            var col = document.createElement('div');
            col.className = 'col-12 col-md-6 col-lg-4 mb-30';
            var stars = '';
            for (var i = 0; i < 5; i++) stars += i < r.rating ? '★' : '☆';
            var text = String(r.review || '');
            var cut = text.length > REVIEW_CUT;
            if (cut) text = text.substring(0, REVIEW_CUT).replace(/\s+\S*$/, '') + '...';
            // Escape first, then turn line breaks into <br>: the other way round
            // would escape the breaks, and skipping the escape would let a
            // review's own angle brackets through as markup.
            text = krEscapeHtml(text).replace(/\n/g, '<br>');
            // The card shows the title without its series bracket; the
            // matching above still uses the title as Goodreads has it.
            var shown = krBookTitle(r.title);
            var title = krEscapeHtml(shown.title);
            var author = krEscapeHtml(r.author);
            var isbn = r.isbn13 || r.isbn || '';
            // Cover and link from bookshelf.js, as the shelf builds them.
            var shelf = window.krBookshelf;
            var coverUrl = isbn && shelf ? krEscapeHtml(shelf.coverUrl(isbn, 'L')) : '';
            var hit = reviewedBook(r, books || []);
            var url = hit && shelf ? krEscapeHtml(shelf.goodreadsUrl(hit)) : '';
            var open = url ? '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="review-link-wrap">' : '';
            var close = url ? '</a>' : '';
            // A cover that fails to load is set in type by js/bookshelf.js's
            // error listener, from the data- attributes.
            var coverData = window.krTypeCover ? window.krTypeCover.dataAttrs({ t: r.title, a: r.author, r: r.rating }) : '';
            var card = document.createElement('div');
            card.className = 'review-card';
            card.innerHTML = (coverUrl ? '<div class="review-cover">' + open + '<img src="' + coverUrl + '" alt="Book cover: ' + title + ' by ' + author + '" loading="lazy"' + coverData + '>' + close + '</div>' : '') +
                '<div class="review-body">' +
                '<div class="review-stars">' + stars + '</div>' +
                '<h3 class="review-title">' + open + title + close + '</h3>' +
                (shown.series ? '<p class="review-series">' + krEscapeHtml(shown.series) + '</p>' : '') +
                '<p class="review-author">' + author + '</p>' +
                '<p class="review-text">' + text + '</p>' +
                (url ? '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="review-link">' + (cut ? 'Read the full review on Goodreads' : 'This review on Goodreads') + ' &rarr;</a>' : '') +
                '</div>';
            col.appendChild(card);
            container.appendChild(col);
        });
        // A few show at first; the button brings the rest.
        var more = document.getElementById('reviews-more');
        if (!more) return;
        var hidden = Math.max(0, reviews.length - REVIEWS_SHOWN);
        if (!hidden) { more.hidden = true; return; }
        var label = 'Show ' + hidden + ' more review' + (hidden === 1 ? '' : 's');
        more.textContent = label;
        more.addEventListener('click', function () {
            var open = container.classList.toggle('kr-reviews--collapsed') === false;
            more.setAttribute('aria-expanded', open ? 'true' : 'false');
            more.textContent = open ? 'Show fewer reviews' : label;
            if (!open) container.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
    }

    function init() {
        initQuotes();
        initReviews();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
}());
