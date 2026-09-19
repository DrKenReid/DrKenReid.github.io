/**
 * bookwall.js — the literature page's cover wall.
 *
 * Renders every rated book from data/books.json as an OpenLibrary
 * cover, filterable by rating. Covers that OpenLibrary lacks are
 * dropped on error, so the wall stays clean.
 */
(function () {
    var books = [];
    var activeRating = 0;   // 0 = all
    var searchQuery = '';

    function coverUrl(isbn) {
        // default=false makes OpenLibrary 404 on missing covers instead of
        // serving a blank 1x1, so onerror can drop the tile.
        return 'https://covers.openlibrary.org/b/isbn/' + isbn + '-M.jpg?default=false';
    }

    function goodreadsUrl(book) {
        return book.g ? 'https://www.goodreads.com/book/show/' + book.g
                      : 'https://www.goodreads.com/search?q=' + encodeURIComponent(book.t);
    }

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

    function renderWall() {
        var grid = document.getElementById('book-wall-grid');
        if (!grid) return;
        var q = searchQuery.trim().toLowerCase();
        var subset = books.filter(function (b) {
            if (activeRating !== 0 && b.r !== activeRating) return false;
            return !q || (b.t + ' ' + b.a).toLowerCase().indexOf(q) !== -1;
        });
        grid.innerHTML = subset.map(function (b) {
            return '<a class="book-wall-item" data-live="' + genreOf(b) + '" href="' + goodreadsUrl(b) + '" target="_blank" rel="noopener noreferrer"' +
                ' title="' + (b.t + ' — ' + b.a + ' (' + stars(b.r) + ')').replace(/"/g, '&quot;') + '">' +
                '<img src="' + coverUrl(b.i) + '" alt="' + (b.t + ' by ' + b.a).replace(/"/g, '&quot;') + '" loading="lazy"' +
                ' onerror="this.closest(\'.book-wall-item\').remove()">' +
                '<span class="book-wall-stars">' + stars(b.r) + '</span>' +
                '</a>';
        }).join('');
        if (window.krLiveCovers) window.krLiveCovers.attach(grid, function () { return true; });
        var counter = document.getElementById('book-wall-count');
        if (counter) {
            counter.textContent = subset.length + ' book' + (subset.length === 1 ? '' : 's');
        }
    }

    function renderFilters() {
        var bar = document.getElementById('book-wall-filters');
        if (!bar) return;
        var options = [[0, 'All'], [5, '5★'], [4, '4★'], [3, '3★'], [2, '2★'], [1, '1★']];
        bar.innerHTML = '';
        options.forEach(function (opt) {
            var count = opt[0] === 0 ? books.length : books.filter(function (b) { return b.r === opt[0]; }).length;
            if (!count) return;
            var btn = document.createElement('button');
            btn.className = 'btn gallery-filter-btn' + (opt[0] === activeRating ? ' active' : '');
            btn.textContent = opt[1] + ' (' + count + ')';
            btn.addEventListener('click', function () {
                activeRating = opt[0];
                bar.querySelectorAll('.gallery-filter-btn').forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');
                renderWall();
            });
            bar.appendChild(btn);
        });
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
                }, 120);
            });
        }
        // Skeleton covers while books.json + cover images arrive
        grid.innerHTML = new Array(18).fill('<span class="book-wall-item kr-skeleton"></span>').join('');
        fetch('/data/books.json').then(function (r) { return r.json(); }).then(function (data) {
            books = data || [];
            renderFilters();
            renderWall();
        }).catch(function () { grid.innerHTML = ''; });
    });
}());
