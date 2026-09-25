/**
 * bookwall.js: the cover wall on books.html ("Every Book").
 *
 * Every rated book in data/books.json that has an ISBN, as its Open
 * Library cover, searchable by title and author and filterable by my
 * rating. The filter is the documented one: books.json holds every book
 * read, and the wall shows the rated ones Goodreads has an ISBN for,
 * since a cover is looked up by ISBN.
 *
 * Links, cover URLs and tooltips come from krBookshelf (js/bookshelf.js,
 * loaded first), so a tile says and links what the shelf does.
 * A cover Open Library has no scan of is not dropped: js/bookshelf.js
 * sets it in type, from the data- attributes on the <img>,
 * so every tile the counts promise is on the wall. The counts are the
 * filter buttons' (built by renderFilterBar, which gives them
 * aria-pressed), the total in the lede, and #book-wall-count, the shared
 * .kr-list-counter live region, empty unless something narrows the wall.
 */
(function () {
    'use strict';

    var SEARCH_DEBOUNCE_MS = 120;
    var SKELETON_TILES = 18;

    var books = [];         // books.json, shared with other readers: read only
    var activeRating = 0;   // 0 = every rating
    var searchQuery = '';

    function onTheWall(b) { return !!(b.i && b.r); }

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

    function tile(b) {
        var name = krBookTitle(b.t);
        return '<a class="book-wall-item" data-live="' + genreOf(b) + '" href="' + krEscapeHtml(krBookshelf.goodreadsUrl(b)) + '"' +
            ' target="_blank" rel="noopener noreferrer" title="' + krEscapeHtml(krBookshelf.label(b)) + '">' +
            '<img src="' + krEscapeHtml(krBookshelf.coverUrl(b.i, 'M')) + '" alt="' + krEscapeHtml(name.title + ' by ' + b.a) + '" loading="lazy"' +
            krTypeCover.dataAttrs(b) + '>' +
            '<span class="book-wall-stars"><span aria-hidden="true">' + stars(b.r) + '</span>' +
            '<span class="sr-only">, rated ' + b.r + ' of 5</span></span>' +
            '</a>';
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
        grid.innerHTML = subset.map(tile).join('');
        krUpdateSearchCounter(subset.length, wall.length, 'books', !q && !activeRating,
            { input: null, counter: 'book-wall-count' });
    }

    function renderFilters() {
        var bar = document.getElementById('book-wall-filters');
        if (!bar) return;
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
        renderFilterBar(bar, items, {
            multi: false,
            allLabel: 'All (' + wall.length + ')',
            onChange: function (keys) {
                activeRating = keys.length ? +keys[0] : 0;
                renderWall();
            }
        });
        var total = document.getElementById('book-wall-total');
        if (total) total.textContent = wall.length + ' books';
    }

    document.addEventListener('DOMContentLoaded', function () {
        var grid = document.getElementById('book-wall-grid');
        if (!grid) return;
        var search = document.getElementById('book-wall-search');
        var debounce = null;
        if (search) {
            search.addEventListener('input', function () {
                clearTimeout(debounce);
                debounce = setTimeout(function () {
                    searchQuery = search.value;
                    renderWall();
                }, SEARCH_DEBOUNCE_MS);
            });
        }
        // Skeleton covers while books.json and the covers arrive.
        grid.innerHTML = new Array(SKELETON_TILES).fill('<span class="book-wall-item kr-skeleton"></span>').join('');
        // The same request js/bookshelf.js would make, shared through krFetchJson.
        krFetchJson('data/books.json').then(function (data) {
            books = Array.isArray(data) ? data : [];
            renderFilters();
            renderWall();
        }).catch(function () {
            grid.innerHTML = '';
            var counter = document.getElementById('book-wall-count');
            if (counter) counter.textContent = 'The books could not be loaded just now.';
        });
    });
}());
