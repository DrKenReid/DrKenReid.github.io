/**
 * Literature page: rotating quotes and review cards.
 * Loads data/quotes.json and data/reviews.json.
 */

/* --- Quotes --- */
var allQuotes = [];
var quoteIndex = 0;

function initQuotes() {
  fetch('data/quotes.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      allQuotes = shuffle(data);
      showQuote(0);
      setInterval(nextQuote, 12000);
    })
    .catch(function() {});
}

function showQuote(idx) {
  var q = allQuotes[idx];
  if (!q) return;
  var el = document.getElementById('quote-text');
  var attr = document.getElementById('quote-attr');
  if (!el || !attr) return;

  el.style.opacity = '0';
  attr.style.opacity = '0';
  setTimeout(function() {
    el.textContent = '\u201C' + q.quote + '\u201D';
    attr.textContent = '\u2014 ' + q.author + ', ' + q.book;
    el.style.opacity = '1';
    attr.style.opacity = '1';
  }, 400);
}

function nextQuote() {
  quoteIndex = (quoteIndex + 1) % allQuotes.length;
  showQuote(quoteIndex);
}

function prevQuote() {
  quoteIndex = (quoteIndex - 1 + allQuotes.length) % allQuotes.length;
  showQuote(quoteIndex);
}

/* --- Reviews --- */
function initReviews() {
  fetch('data/reviews.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      renderReviews(data);
    })
    .catch(function() {});
}

function renderReviews(reviews) {
  var container = document.getElementById('reviews-grid');
  if (!container) return;

  reviews.forEach(function(r) {
    var col = document.createElement('div');
    col.className = 'col-12 col-md-6 col-lg-4 mb-30';

    var stars = '';
    for (var i = 0; i < 5; i++) {
      stars += i < r.rating ? '\u2605' : '\u2606';
    }

    /* Truncate long reviews */
    var text = r.review;
    var truncated = false;
    if (text.length > 300) {
      text = text.substring(0, 300).replace(/\s+\S*$/, '') + '...';
      truncated = true;
    }
    text = text.replace(/\n/g, '<br>');

    var isbn = r.isbn13 || r.isbn || '';
    var coverUrl = isbn
      ? 'https://covers.openlibrary.org/b/isbn/' + isbn + '-L.jpg'
      : '';

    var card = document.createElement('div');
    card.className = 'review-card';
    card.innerHTML =
      (coverUrl ? '<div class="review-cover"><img src="' + coverUrl + '" alt="' + r.title + '" loading="lazy" onerror="this.parentElement.style.display=\'none\'"></div>' : '') +
      '<div class="review-body">' +
        '<div class="review-stars">' + stars + '</div>' +
        '<h4 class="review-title">' + r.title + '</h4>' +
        '<p class="review-author">' + r.author + '</p>' +
        '<p class="review-text">' + text + '</p>' +
      '</div>';

    col.appendChild(card);
    container.appendChild(col);
  });
}

/* --- Utility --- */
function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
