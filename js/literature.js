/* literature.js: the quote carousel and the selected reviews on
   literature.html. Reviews come from data/reviews.json; three show at
   first and the rest wait behind a button. */
var allQuotes = [];
var quoteIndex = 0;
var autoTimer = null;

function initQuotes() {
    bindQuoteButtons();
    initSwipe();
    fetch('/data/quotes.json').then(function (r) { return r.json(); }).then(function (data) {
        allQuotes = shuffle(data);
        showQuote(0);
    }).catch(function () {});
    // The carousel draws on a short list; the count in the prose is the
    // whole collection, the same file the homepage counts.
    var counts = document.querySelectorAll('[data-lit="quotes"]');
    if (counts.length) {
        fetch('/data/quotes-all.json').then(function (r) { return r.json(); }).then(function (all) {
            if (!Array.isArray(all)) return;
            counts.forEach(function (el) { el.textContent = String(all.length); });
        }).catch(function () {});
    }
}

function bindQuoteButtons() {
    var prev = document.getElementById('quote-prev-btn');
    var next = document.getElementById('quote-next-btn');
    if (prev && !prev.dataset.bound) { prev.addEventListener('click', prevQuote); prev.dataset.bound = 'true'; }
    if (next && !next.dataset.bound) { next.addEventListener('click', nextQuote); next.dataset.bound = 'true'; }
}

function scheduleNext() {
    if (autoTimer) clearTimeout(autoTimer);
    var q = allQuotes[quoteIndex];
    if (!q) return;
    var words = q.quote.split(/\s+/).length;
    var ms = Math.min(Math.max(words * 150, 5000), 20000);
    autoTimer = setTimeout(nextQuote, ms);
}

function showQuote(idx) {
    var q = allQuotes[idx];
    if (!q) return;
    var el = document.getElementById('quote-text');
    var attr = document.getElementById('quote-attr');
    if (!el || !attr) return;
    el.style.opacity = '0';
    attr.style.opacity = '0';
    setTimeout(function () {
        el.textContent = '“' + q.quote + '”';
        attr.textContent = '— ' + q.author + ', ' + q.book;
        el.style.opacity = '1';
        attr.style.opacity = '1';
        scheduleNext();
    }, 400);
}

function nextQuote() {
    if (!allQuotes.length) return;
    if (autoTimer) clearTimeout(autoTimer);
    quoteIndex = (quoteIndex + 1) % allQuotes.length;
    showQuote(quoteIndex);
}

function prevQuote() {
    if (!allQuotes.length) return;
    if (autoTimer) clearTimeout(autoTimer);
    quoteIndex = (quoteIndex - 1 + allQuotes.length) % allQuotes.length;
    showQuote(quoteIndex);
}

function initReviews() {
    // reviews.json is the hand-picked dozen; books.json (the weekly
    // Goodreads refresh) knows each book's review id, so the card can
    // link to the review itself rather than to the book.
    // A book being read again is on currently-reading, not the read
    // shelf, so now.json's entries (which link to the review) join in.
    Promise.all([
        fetch('/data/reviews.json').then(function (r) { return r.json(); }),
        fetch('/data/books.json').then(function (r) { return r.json(); }).catch(function () { return []; }),
        fetch('/data/now.json').then(function (r) { return r.json(); }).catch(function () { return {}; })
    ]).then(function (all) {
        var books = Array.isArray(all[1]) ? all[1].slice() : [];
        ((all[2] && all[2].reading) || []).forEach(function (b) {
            var m = /\/review\/show\/(\d+)/.exec(b.link || '');
            if (m) books.push({ t: b.title, w: m[1] });
        });
        renderReviews(all[0], books);
    }).catch(function () {});
}

function goodreadsReviewUrl(r, books) {
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
    if (!hit) return '';
    if (hit.w) return 'https://www.goodreads.com/review/show/' + hit.w;
    return hit.g ? 'https://www.goodreads.com/book/show/' + hit.g : '';
}

function renderReviews(reviews, books) {
    var container = document.getElementById('reviews-grid');
    if (!container) return;
    reviews.forEach(function (r) {
        var col = document.createElement('div');
        col.className = 'col-12 col-md-6 col-lg-4 mb-30';
        var stars = '';
        for (var i = 0; i < 5; i++) stars += i < r.rating ? '★' : '☆';
        var text = r.review;
        var cut = text.length > 300;
        if (cut) text = text.substring(0, 300).replace(/\s+\S*$/, '') + '...';
        text = text.replace(/\n/g, '<br>');
        var isbn = r.isbn13 || r.isbn || '';
        var coverUrl = isbn ? 'https://covers.openlibrary.org/b/isbn/' + isbn + '-L.jpg' : '';
        var url = goodreadsReviewUrl(r, books || []);
        var open = url ? '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="review-link-wrap">' : '';
        var close = url ? '</a>' : '';
        var card = document.createElement('div');
        card.className = 'review-card';
        card.innerHTML = (coverUrl ? '<div class="review-cover">' + open + '<img src="' + coverUrl + '" alt="Book cover: ' + r.title + ' by ' + r.author + '" loading="lazy" onerror="this.parentElement.parentElement.style.display=\'none\'">' + close + '</div>' : '') +
            '<div class="review-body">' +
            '<div class="review-stars">' + stars + '</div>' +
            '<h3 class="review-title">' + open + r.title + close + '</h3>' +
            '<p class="review-author">' + r.author + '</p>' +
            '<p class="review-text">' + text + '</p>' +
            (url ? '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="review-link">' + (cut ? 'Read the full review on Goodreads' : 'This review on Goodreads') + ' &rarr;</a>' : '') +
            '</div>';
        col.appendChild(card);
        container.appendChild(col);
    });
    // Three show at first; the button brings the rest.
    var more = document.getElementById('reviews-more');
    if (!more) return;
    var hidden = Math.max(0, reviews.length - 3);
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

var touchStartX = 0;
var touchEndX = 0;
var SWIPE_THRESHOLD = 50;

function initSwipe() {
    var el = document.getElementById('quotes');
    if (!el) return;
    el.addEventListener('touchstart', function (e) { touchStartX = e.changedTouches[0].screenX; }, { passive: true });
    el.addEventListener('touchend', function (e) {
        touchEndX = e.changedTouches[0].screenX;
        var diff = touchStartX - touchEndX;
        if (Math.abs(diff) > SWIPE_THRESHOLD) { if (diff > 0) nextQuote(); else prevQuote(); }
    }, { passive: true });
}

function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
}
