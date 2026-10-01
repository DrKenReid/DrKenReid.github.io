/**
 * bookwall.js: the cover wall on books.html ("Every Book").
 *
 * Every rated book in data/books.json, searchable by title and author and
 * filterable by my rating. A book with an ISBN hangs as its Open Library
 * cover, looked up by that ISBN; a book Goodreads has no ISBN for (most
 * of the Kindle series) hangs as a cover set in type (krTypeCover), so
 * the wall and its counts cover the whole reading history, not only the
 * books a cover can be found for.
 *
 * Links, cover URLs and tooltips come from krBookshelf (js/bookshelf.js,
 * loaded first), so a tile says and links what the shelf does.
 * A cover Open Library has no scan of is not dropped either: js/bookshelf.js
 * sets it in type, from the data- attributes on the <img>,
 * so every tile the counts promise is on the wall. The counts are the
 * filter buttons' (built by renderFilterBar, which gives them
 * aria-pressed), the total in the lede, and #book-wall-count, the shared
 * .kr-list-counter live region, empty unless something narrows the wall.
 *
 * The address bar carries the search (?q=) and the rating (?rating=, 1
 * to 5), read once books.json is in and rewritten as they change, with
 * replaceState as on the blog listing (js/blog.js, "WHY replaceState"),
 * so "every five-star book" can be linked to and survives a reload. A
 * rating no book has is dropped rather than obeyed.
 *
 * The skeleton tiles the wall shows while books.json loads are in the
 * page's markup, so the grid has its height from the first paint and
 * nothing below it moves when the covers arrive.
 */
(function () {
    'use strict';

    var SEARCH_DEBOUNCE_MS = 120;

    var books = [];         // books.json, shared with other readers: read only
    var activeRating = 0;   // 0 = every rating
    var searchQuery = '';

    function onTheWall(b) { return !!b.r; }

    function stars(n) {
        return '★'.repeat(n);
    }

    /* books.json carries no genre, so the hover sketch is picked from the
       title: enough signal for a picture, not for a catalogue. */
    var SCIFI = /\b(space|star|stars|galaxy|galactic|planet|mars|robot|android|cyber|dune|foundation|hyperion|alien|expanse|culture|orbit|quantum|neuromancer|ender|children of time|three-body|martian|ship|machine|time)\b/i;
    var FANTASY = /\b(dragon|magic|wizard|witch|sword|kingdom|king|queen|throne|realm|elf|elves|dwarf|hobbit|ring|tower|blade|mage|sorcer\w*|quest|dungeon|crawler|chicken|kingkiller|storm|light|mist|shadow|dark|spell|cradle|lord|gods?)\b/i;
    var NONFICTION = /\b(introduction|guide|history|science|course|courses|how to|why|philosophy|economics|psychology|thinking|habits|art of|theory|data|statistics|brief|lives|biography|memoir|essays|notes|manual|principles|lessons|great courses)\b/i;
    function genreOf(b) {
        var t = b.t || '';
        if (NONFICTION.test(t)) return 'genre:nonfiction';
        if (SCIFI.test(t)) return 'genre:scifi';
        if (FANTASY.test(t)) return 'genre:fantasy';
        return 'genre:fiction';
    }

    /* A tile is one link: the cover, then the stars that show on hover.
       Its name is "Title by Author, rated N of 5" either way: the <img>'s
       alt text, or for a book with no ISBN a hidden line beside a cover
       set in type, which is itself hidden so the title is not read twice. */
    function tile(b) {
        var name = krBookTitle(b.t);
        var called = krEscapeHtml(name.title + ' by ' + b.a);
        var cover = b.i
            ? '<img src="' + krEscapeHtml(krBookshelf.coverUrl(b.i, 'M')) + '" alt="' + called + '" loading="lazy"' +
                krTypeCover.dataAttrs(b) + '>'
            : krTypeCover(b, { decorative: true }).outerHTML + '<span class="sr-only">' + called + '</span>';
        return '<a class="book-wall-item" data-live="' + genreOf(b) + '" href="' + krEscapeHtml(krBookshelf.goodreadsUrl(b)) + '"' +
            ' target="_blank" rel="noopener noreferrer" title="' + krEscapeHtml(krBookshelf.label(b)) + '">' +
            cover +
            '<span class="book-wall-stars"><span aria-hidden="true">' + stars(b.r) + '</span>' +
            '<span class="sr-only">, rated ' + b.r + ' of 5</span></span>' +
            '</a>';
    }

    /* Writes the search and the rating into the address bar (see the
       header). The query is kept as typed, trimmed; a key at its default
       is left out, so the whole wall is plain /books.html. */
    function syncUrl() {
        if (!window.history || !window.history.replaceState) return;
        var params = new URLSearchParams();
        var q = searchQuery.trim();
        if (q) params.set('q', q);
        if (activeRating) params.set('rating', String(activeRating));
        var qs = params.toString();
        try {
            window.history.replaceState(window.history.state, '', window.location.pathname + (qs ? '?' + qs : '') + window.location.hash);
        } catch (e) {}
    }

    function renderWall() {
        var grid = document.getElementById('book-wall-grid');
        if (!grid) return;
        var q = searchQuery.trim().toLowerCase();
        var wall = books.filter(onTheWall);
        var subset = wall.filter(function (b) {
            if (activeRating !== 0 && b.r !== activeRating) return false;
            return !q || (b.t + ' ' + b.a).toLowerCase().indexOf(q) !== -1;
        });
        grid.removeAttribute('aria-busy');
        grid.innerHTML = subset.map(tile).join('');
        krUpdateSearchCounter(subset.length, wall.length, 'books', !q && !activeRating,
            { input: null, counter: 'book-wall-count' });
        syncUrl();
    }

    /* Returns renderFilterBar's { setActive }, or null with no bar. */
    function renderFilters() {
        var bar = document.getElementById('book-wall-filters');
        if (!bar) return null;
        var wall = books.filter(onTheWall);
        var items = [5, 4, 3, 2, 1].map(function (r) {
            return {
                key: String(r),
                // The star is decoration; a screen reader hears "5 stars".
                label: r + '<span aria-hidden="true">★</span><span class="sr-only"> star' + (r === 1 ? '' : 's') + '</span>',
                count: wall.filter(function (b) { return b.r === r; }).length
            };
        }).filter(function (it) { return it.count > 0; });
        bar.setAttribute('aria-label', 'Filter by my rating');
        var total = document.getElementById('book-wall-total');
        if (total) total.textContent = wall.length + ' books';
        var control = renderFilterBar(bar, items, {
            multi: false,
            allLabel: 'All (' + wall.length + ')',
            onChange: function (keys) {
                activeRating = keys.length ? +keys[0] : 0;
                renderWall();
            }
        });
        control.keys = items.map(function (it) { return it.key; });
        return control;
    }

    document.addEventListener('DOMContentLoaded', function () {
        var grid = document.getElementById('book-wall-grid');
        if (!grid) return;
        var search = document.getElementById('book-wall-search');
        var params = new URLSearchParams(window.location.search);
        var presetQuery = (params.get('q') || '').trim();
        var presetRating = (params.get('rating') || '').trim();
        var debounce = null;
        if (search) {
            if (presetQuery) search.value = presetQuery;
            search.addEventListener('input', function () {
                clearTimeout(debounce);
                debounce = setTimeout(function () {
                    searchQuery = search.value;
                    renderWall();
                }, SEARCH_DEBOUNCE_MS);
            });
        }
        searchQuery = presetQuery;
        grid.setAttribute('aria-busy', 'true');
        // The same request js/bookshelf.js would make, shared through krFetchJson.
        krFetchJson('data/books.json').then(function (data) {
            books = Array.isArray(data) ? data : [];
            var bar = renderFilters();
            // setActive draws the wall through onChange; a stale rating
            // falls through to the whole wall.
            if (bar && bar.keys.indexOf(presetRating) !== -1) bar.setActive([presetRating]);
            else renderWall();
        }).catch(function () {
            grid.removeAttribute('aria-busy');
            grid.innerHTML = '';
            var counter = document.getElementById('book-wall-count');
            if (counter) counter.textContent = 'The books could not be loaded just now.';
        });
    });
}());
