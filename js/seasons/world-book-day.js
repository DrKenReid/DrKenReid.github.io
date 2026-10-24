/**
 * seasons/world-book-day.js: World Book Day's art for js/season.js (see
 * that file for the pieces), for 23 April: a reading lamp clamped in the
 * corner with a bookworm in round glasses hanging from its shade on a
 * thread, loose pages turning over in the air, a stack of books with
 * someone's reading glasses on top, an open book with its ribbon, a cup
 * of tea, with a pencil, a biscuit and stray pages between them, a paper
 * plane folded from a printed page gliding over, an open book for a
 * favicon and across the moon, a shelf along a post's top that fills
 * with books as the reader reads, a 404 page with a page torn out, a
 * gold pointer with a green book at its tail, and the bookworm inching
 * along the footer's edge. Its own: a slip of paper tucked into the top
 * of the footer with a line from Ken's quote wall (data/quotes.json),
 * turned over for another at a click; and the bottom corner of each page
 * opener is dog-eared, and curls back further while the pointer is over
 * the opener, like the corner of a page about to be turned; on the 404
 * page the opener's foot is torn across instead, its own way for each
 * missing address.
 *
 * Classes only this file applies (css/seasons/world-book-day.css):
 * .kr-season-pumpkin, .kr-season-dangler__body, .kr-season-flyer__body,
 * .kr-season-wbd-steam, .kr-season-puff--pages, .kr-season-flyer--plane,
 * .kr-season-track--shelf, .kr-season-track__book, .kr-season-walker--bookworm,
 * .kr-season-wbd-slip (--turn), .kr-season-wbd-slip__line,
 * .kr-season-wbd-slip__source, .kr-season-wbd-curl, .kr-season-wbd-tear.
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg;

    // Book cloth: library green, navy, mustard, plum, rust brown, teal.
    var CLOTH = ['#2e5e46', '#23406b', '#b8862f', '#6a3f7a', '#8a4b2a', '#2a6b6b'];
    var GILT = '#e3c071', PAPER = '#fbf6ea', PAPER_EDGE = '#c9b896', INK = '#3a3328';
    var WORM = '#7fb85a', WORM_DEEP = '#4f7a3a';

    function fix(v) { return K.fix(+v); }

    /* An anglepoise lamp clamped to the corner: its arms (in the line),
       springs, a green shade lit inside, and a faint cone of light under
       it, where the bookworm hangs. */
    function lampArt() {
        return '<path d="M28 35h20l13 22Q38 66 13 57z" fill="#ffe7a0" opacity=".08" stroke="none"/>' +
            '<path d="M31 35h14l9 18Q38 59 21 53z" fill="#ffe7a0" opacity=".12" stroke="none"/>' +
            '<rect x="57" y="4" width="7" height="11" rx="1.2" fill="#6b5844" stroke="none"/>' +
            '<path d="M58 9L47 3L37 20" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<path d="M56 6.6l-1.4 2.2-1.4-2.6-1.4 2.6-1.4-2.6-1.4 2.6M44.4 7.4l-1.8 1.2.4-2.6-2 1.4.4-2.6" fill="none" stroke-width=".6"/>' +
            '<circle cx="47" cy="3" r="1.8" fill="#b08a4a" stroke="none"/>' +
            '<path d="M33 18.6L41 21.4L47 34Q37 38.6 26.4 33z" fill="#2e5e46" stroke="#1d3c2d" stroke-width=".7"/>' +
            '<path d="M35 20.4l3.6 1.4" stroke="#7fa88f" stroke-width="1" stroke-linecap="round"/>' +
            '<ellipse cx="36.8" cy="34.6" rx="10.4" ry="2.4" transform="rotate(8 36.8 34.6)" fill="#fff1c4" stroke="none"/>' +
            '<circle cx="37" cy="20" r="1.8" fill="#b08a4a" stroke="none"/>';
    }

    /* A bookworm hanging by a thread: green segments curling down to a
       round head in round glasses. */
    var BOOKWORM = svg('kr-season-dangler__body', '0 0 20 20',
        '<g fill="' + WORM + '" stroke="' + WORM_DEEP + '" stroke-width=".5">' +
        '<circle cx="10" cy="2.4" r="2.1"/><circle cx="11.6" cy="5" r="2.4"/><circle cx="12" cy="8.2" r="2.6"/>' +
        '<circle cx="10.8" cy="11.4" r="2.7"/><circle cx="9.4" cy="15.4" r="3.6"/></g>' +
        '<g fill="#ffffff" fill-opacity=".55" stroke="#2b2b2b" stroke-width=".55">' +
        '<circle cx="7.8" cy="15.2" r="1.45"/><circle cx="11" cy="15.2" r="1.45"/></g>' +
        '<path d="M9.25 15h.3" stroke="#2b2b2b" stroke-width=".5"/>' +
        '<circle cx="7.9" cy="15.3" r=".45" fill="#2b2b2b"/><circle cx="11.1" cy="15.3" r=".45" fill="#2b2b2b"/>' +
        '<path d="M8.4 17.6q1 .7 2 0" fill="none" stroke="#2b2b2b" stroke-width=".5" stroke-linecap="round"/>');

    /* A loose page on the leaves' 24 x 24 box, its corner folded and three
       lines of print (holes, so the canvas fills round them), and a
       smaller torn scrap. */
    var PAGE = 'M6 3h9l4 4v14H6zM15 3.8V7.2h3.4zM8 10.6v.7h8.4v-.7zM8 13.6v.7h8.4v-.7zM8 16.6v.7h5.6v-.7z';
    var SCRAP = 'M5 6.4l11.6-2.2 1.2 4-1 1.6 1.4 2-.6 2.4 1 3.8-11 2.2z';
    var PAPERS = ['#fffdf6', '#fbf6ea', '#f3ead6', '#eadfc6'];

    // A book's spine in a stack, lying down: cloth, two gilt bands, a label.
    function spine(x, y, w, h, cloth) {
        return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="1.2" fill="' + cloth + '"/>' +
            '<path d="M' + (x + 5) + ' ' + y + 'v' + h + 'M' + (x + w - 5) + ' ' + y + 'v' + h + '" stroke="' + GILT + '" stroke-width="1"/>' +
            '<rect x="' + fix(x + w * 0.36) + '" y="' + fix(y + h * 0.3) + '" width="' + fix(w * 0.28) + '" height="' + fix(h * 0.4) +
            '" rx=".6" fill="' + GILT + '" opacity=".85"/>' +
            '<path d="M' + (x + 1) + ' ' + fix(y + 0.8) + 'h' + (w - 2) + '" stroke="#ffffff" stroke-width=".8" opacity=".25"/>';
    }

    /* A stack of four books on the pumpkins' 64 x 56 box, someone's
       reading glasses folded on top. */
    var STACK = svg('kr-season-pumpkin', '0 0 64 56',
        spine(5, 44, 54, 11, CLOTH[0]) + spine(10, 35, 46, 9, CLOTH[1]) + spine(3, 26.6, 50, 8.4, CLOTH[2]) +
        spine(12, 18.6, 40, 8, CLOTH[3]) +
        '<g fill="#e6f1f5" fill-opacity=".45" stroke="' + INK + '" stroke-width="1.2">' +
        '<ellipse cx="26" cy="14.6" rx="5" ry="3.6"/><ellipse cx="38" cy="14.6" rx="5" ry="3.6"/></g>' +
        '<path d="M31 14q1-1.4 2 0M21 14l-4 3.6M43 14l4 3.6" fill="none" stroke="' + INK + '" stroke-width="1.1" stroke-linecap="round"/>');

    /* An open book on its green cover: two pages curving up from the
       gutter, lines of print, and a plum ribbon hanging from the spine. */
    var lines = '';
    for (var ly = 22; ly <= 40; ly += 3.6) {
        lines += 'M8 ' + fix(ly + 1) + 'Q17 ' + fix(ly - 1.4) + ' 28 ' + fix(ly + 1.6) +
            'M36 ' + fix(ly + 1.6) + 'Q47 ' + fix(ly - 1.4) + ' 56 ' + fix(ly + 1);
    }
    var OPEN_BOOK = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M1 18v32c11-3 22-2 31 3 9-5 20-6 31-3V18z" fill="#2e5e46"/>' +
        '<path d="M32 49C24 44 13 43 4 46V15c9-3 20-2 28 3z" fill="' + PAPER + '" stroke="' + PAPER_EDGE + '" stroke-width=".8"/>' +
        '<path d="M32 49c8-5 19-6 28-3V15c-9-3-20-2-28 3z" fill="' + PAPER + '" stroke="' + PAPER_EDGE + '" stroke-width=".8"/>' +
        '<path d="' + lines + '" fill="none" stroke="#a89c86" stroke-width=".9"/>' +
        '<path d="M32 18v31" stroke="#d9cdb2" stroke-width="1.6"/>' +
        '<path d="M33 18v37l2-2.4 2 2.4V18" fill="#6a3f7a"/>');

    /* A cup of tea on its saucer, a blue band round the cup, steam rising
       (the two wisps sway). */
    var TEA = svg('kr-season-pumpkin', '0 0 64 56',
        '<path class="kr-season-wbd-steam" d="M24 19c-3-4 3-6 0-10s3-6 0-9M33 19c-3-4 3-6 0-10" fill="none" stroke="#c9c2b5"' +
        ' stroke-width="1.6" stroke-linecap="round"/>' +
        '<ellipse cx="32" cy="50" rx="23" ry="4.4" fill="#f4f1ea" stroke="#b9b2a3" stroke-width=".9"/>' +
        '<path d="M44 28.4c7-1 9.6 2.6 8.6 6s-5 5.4-10 5" fill="none" stroke="#b9b2a3" stroke-width="3"/>' +
        '<path d="M44 28.4c7-1 9.6 2.6 8.6 6s-5 5.4-10 5" fill="none" stroke="#f7f4ee" stroke-width="1.6"/>' +
        '<path d="M13 25h33c0 13-6.4 23-16.5 23S13 38 13 25z" fill="#f7f4ee" stroke="#b9b2a3" stroke-width=".9"/>' +
        '<path d="M14.2 31.6h30.6" stroke="#3d6fa8" stroke-width="1.8"/>' +
        '<ellipse cx="29.5" cy="25.2" rx="16.5" ry="2.8" fill="#9a5a22" stroke="#b9b2a3" stroke-width=".9"/>');

    // Between them: a pencil, a biscuit and stray pages.
    function pencil(w, turn) {
        return '<svg class="kr-season-leaf" viewBox="0 0 24 6" width="' + w + '" height="' + fix(w / 4) + '"' +
            ' style="transform: rotate(' + turn + 'deg)" aria-hidden="true" focusable="false">' +
            '<rect x="1" y="1" width="3" height="4" rx=".8" fill="#e58aa0"/><rect x="3.6" y="1" width="1.4" height="4" fill="#b8b8b8"/>' +
            '<rect x="5" y="1" width="13" height="4" fill="#f2c230"/><path d="M5 2.4h13" stroke="#d9a520" stroke-width=".5"/>' +
            '<path d="M18 1l5 2-5 2z" fill="#e8c9a0"/><path d="M21.4 2.36L23 3l-1.6.64z" fill="#3a3328"/></svg>';
    }
    function biscuit(w) {
        return '<svg class="kr-season-leaf" viewBox="0 0 24 10" width="' + w + '" height="' + fix(w * 10 / 24) + '"' +
            ' aria-hidden="true" focusable="false"><ellipse cx="12" cy="6" rx="11" ry="3.6" fill="#c98a45"/>' +
            '<ellipse cx="12" cy="5.2" rx="11" ry="3.6" fill="#e2ac62"/>' +
            '<g fill="#b3743a"><circle cx="8" cy="5" r=".6"/><circle cx="12" cy="4" r=".6"/><circle cx="16" cy="5" r=".6"/>' +
            '<circle cx="12" cy="6.4" r=".6"/></g></svg>';
    }
    function loosePage(w, turn) {
        return '<svg class="kr-season-leaf" viewBox="0 0 24 24" width="' + w + '" height="' + w + '"' +
            ' style="transform: rotate(' + turn + 'deg)" aria-hidden="true" focusable="false">' +
            '<path d="M5 4h10l4 4v13H5z" fill="' + PAPER + '" stroke="' + PAPER_EDGE + '" stroke-width=".8"/>' +
            '<path d="M15 4v4h4" fill="none" stroke="' + PAPER_EDGE + '" stroke-width=".8"/>' +
            '<path d="M7.4 11h9M7.4 14h9M7.4 17h6" stroke="#a89c86" stroke-width=".8"/></svg>';
    }

    /* A paper plane folded from a printed page, seen from the side: the
       near wing, the fold under it, a few lines of print on it. */
    var PLANE = svg('kr-season-flyer__body', '0 0 64 32',
        '<path d="M26 21.6L62 3 32 28z" fill="#e9dfc8" stroke="' + PAPER_EDGE + '" stroke-width=".7" stroke-linejoin="round"/>' +
        '<path d="M2 15.4L62 3 26 21.6z" fill="' + PAPER + '" stroke="' + PAPER_EDGE + '" stroke-width=".7" stroke-linejoin="round"/>' +
        '<path d="M14 14.6l26-5.4M18 16.4l24-5M24 17.6l18-3.8" stroke="#b9ae98" stroke-width=".7" stroke-linecap="round"/>');

    var BOOK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<path d="M1 7v20c5-1.6 10-1.2 15 1.4 5-2.6 10-3 15-1.4V7z" fill="#2e5e46"/>' +
        '<path d="M16 26C12 23.4 7.4 23 3 24V5c4.4-1 9-.6 13 2z" fill="' + PAPER + '" stroke="#b9a988" stroke-width=".8"/>' +
        '<path d="M16 26c4-2.6 8.6-3 13-2V5c-4.4-1-9-.6-13 2z" fill="' + PAPER + '" stroke="#b9a988" stroke-width=".8"/>' +
        '<path d="M6 10.4c2.6-.6 5-.4 7.4.6M6 14.4c2.6-.6 5-.4 7.4.6M18.6 11c2.4-1 4.8-1.2 7.4-.6M18.6 15c2.4-1 4.8-1.2 7.4-.6"' +
        ' stroke="#a89c86" stroke-width="1.1" fill="none"/></svg>';

    // An open book crossing the moon.
    var MOON_BOOK = 'M12 9.2c-2-1.4-4.6-1.8-7-1.2v8.4c2.4-.6 5-.2 7 1.2 2-1.4 4.6-1.8 7-1.2V8c-2.4-.6-5-.2-7 1.2z';

    /* A book on the shelf over a post: a spine of the given height, cloth
       and gilt by turn; style.css keeps it a stub until the reader has
       passed it, then stands it up. */
    function shelfBook(i) {
        var h = 11 + (i * 7) % 5, cloth = CLOTH[(i * 5) % CLOTH.length];
        return '<svg class="kr-season-track__book" viewBox="0 0 6 16" style="height: ' + h + 'px"' +
            ' preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
            '<rect x=".3" y="0" width="5.4" height="16" rx=".6" fill="' + cloth + '"/>' +
            '<path d="M.3 2.6h5.4M.3 13.4h5.4" stroke="' + GILT + '" stroke-width=".9" vector-effect="non-scaling-stroke"/></svg>';
    }

    // The bookworm out for a walk along the footer's edge, glasses on.
    var WALKING_WORM = '<svg viewBox="0 0 40 16" aria-hidden="true" focusable="false">' +
        '<g fill="' + WORM + '" stroke="' + WORM_DEEP + '" stroke-width=".6">' +
        '<circle cx="4" cy="13" r="2.6"/><circle cx="8.6" cy="11.4" r="3"/><circle cx="13.4" cy="9.4" r="3.2"/>' +
        '<circle cx="18.4" cy="8.6" r="3.3"/><circle cx="23.4" cy="9.6" r="3.3"/><circle cx="28" cy="11.4" r="3.4"/>' +
        '<circle cx="33.6" cy="10" r="4.6"/></g>' +
        '<g fill="#ffffff" fill-opacity=".55" stroke="#2b2b2b" stroke-width=".6"><circle cx="34" cy="9.2" r="1.7"/>' +
        '<circle cx="37.6" cy="9.2" r="1.7"/></g><path d="M35.7 9h.2" stroke="#2b2b2b" stroke-width=".6"/>' +
        '<circle cx="34.3" cy="9.3" r=".5" fill="#2b2b2b"/><circle cx="37.9" cy="9.3" r=".5" fill="#2b2b2b"/>' +
        '<path d="M35.4 12.2q1.2.8 2.2 0" fill="none" stroke="#2b2b2b" stroke-width=".55" stroke-linecap="round"/></svg>';

    /* ---------------------------------------------------------------- *
     * A line from the quote wall on a slip of paper over the footer
     * ---------------------------------------------------------------- */

    /* The slip lies across the footer's top edge at its right (from 992px),
       like a note left in a book. It is filled once the footer comes into
       view, from data/quotes.json (only the shorter lines fit), and a
       click turns it over for another; under reduced motion the new line
       is simply there. Decoration: aria-hidden, never focused. */
    function slip(kit) {
        var footer = document.querySelector('.kr-footer');
        if (!footer || footer.querySelector('.kr-season-wbd-slip') || !window.fetch) return;
        var el = document.createElement('div');
        el.className = 'kr-season-wbd-slip';
        el.setAttribute('aria-hidden', 'true');
        el.hidden = true;
        el.innerHTML = '<span class="kr-season-wbd-slip__line"></span><span class="kr-season-wbd-slip__source"></span>';
        footer.appendChild(el);
        var line = el.firstChild, source = el.lastChild, quotes = [], at = 0;

        function show() {
            var q = quotes[at];
            line.textContent = q.quote;
            source.textContent = q.author + (q.book ? ', ' + q.book : '');
        }
        function next() {
            if (quotes.length < 2) return;
            at = (at + 1) % quotes.length;
            if (kit.reduced) { show(); return; }
            el.classList.remove('kr-season-wbd-slip--turn');
            void el.offsetWidth;
            el.classList.add('kr-season-wbd-slip--turn');
            setTimeout(show, 260);
        }
        el.addEventListener('click', next);
        el.addEventListener('animationend', function () { el.classList.remove('kr-season-wbd-slip--turn'); });

        function load() {
            fetch(siteRootPrefix() + 'data/quotes.json').then(function (r) { return r.json(); }).then(function (all) {
                quotes = (all || []).filter(function (q) {
                    return q && q.quote && q.author && q.quote.length <= 120;
                }).map(function (q) {
                    // "Clockwork Angel (The Infernal Devices, #1)" is shelved as its title.
                    return { quote: q.quote, author: q.author, book: String(q.book || '').replace(/\s*\([^)]*\)\s*$/, '') };
                });
                for (var i = quotes.length - 1; i > 0; i--) {
                    var j = (Math.random() * (i + 1)) | 0, t = quotes[i];
                    quotes[i] = quotes[j];
                    quotes[j] = t;
                }
                if (!quotes.length) return;
                show();
                el.hidden = false;
            }).catch(function () {});
        }
        if (!window.IntersectionObserver) { load(); return; }
        var seen = new IntersectionObserver(function (entries) {
            if (!entries[0].isIntersecting) return;
            seen.disconnect();
            load();
        }, { rootMargin: '200px' });
        seen.observe(footer);
    }

    /* A dog-ear on the bottom right corner of each page opener: the back
       of the page folded over, and the page under it showing. It curls
       back further while the pointer is over the opener (style.css). */
    function curls() {
        Array.prototype.forEach.call(document.querySelectorAll('.breadcrumb-area, .kr-opener'), function (host) {
            if (host.querySelector('.kr-season-wbd-curl, .kr-season-wbd-tear')) return;
            if (document.getElementById('kr-lost-canvas')) { tear(host); return; }
            var el = document.createElement('span');
            el.className = 'kr-season-wbd-curl';
            el.setAttribute('aria-hidden', 'true');
            host.appendChild(el);
        });
    }

    /* On the 404 page the opener has no corner to turn: its foot is torn
       across, ragged, the stub of the page that was there. The tear is
       seeded from the address, so each lost page tears its own way. */
    function tear(host) {
        var path = location.pathname || '/', seed = 11;
        for (var i = 0; i < path.length; i++) seed = (seed * 31 + path.charCodeAt(i)) >>> 0;
        function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
        var d = 'M0 24V' + fix(10 + rnd() * 6);
        for (var x = 0; x < 400;) {
            x = Math.min(400, x + 3 + rnd() * 9);
            d += 'L' + fix(x) + ' ' + fix(4 + rnd() * 12 + (rnd() < 0.12 ? -3 : 0));
        }
        var el = document.createElement('span');
        el.className = 'kr-season-wbd-tear';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<svg viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
            '<path d="' + d + 'V24z" fill="currentColor"/></svg>';
        host.appendChild(el);
    }

    K.dress({
        // The ribbon's card (season.js, ribbon).
        about: { short: 'Book Day', when: '23 April',
            text: 'UNESCO\'s World Book and Copyright Day, held since 1995 on the anniversary of the deaths of Shakespeare and Cervantes in 1616. The UK and Ireland keep their own World Book Day in early March.',
            link: 'https://en.wikipedia.org/wiki/World_Book_Day' },
        corner: lampArt, dangler: BOOKWORM,
        // Pages turning over as they fall, mostly whole ones, some scraps.
        leaves: { kind: 'fall', colours: PAPERS, per1000: 12, shapes: [PAGE, SCRAP], tumble: true, size: [24, 40] },
        // The stack is a book shut, the open book a page turned, the tea
        // poured from the kettle.
        patch: [{ art: STACK, size: 'big', sound: 'book' },
                { art: TEA, size: 'small', sound: 'tea' },
                { art: OPEN_BOOK, size: 'mid', sound: 'page' }],
        strew: [loosePage(16, -18), pencil(26, 6), biscuit(14), loosePage(13, 24), pencil(18, -10)],
        puff: 'kr-season-puff--pages',
        flyer: PLANE, flight: 'kr-season-flyer--plane',
        favicon: BOOK_ICON, moonmark: MOON_BOOK,
        // A book every 10px of shelf, stood up once the reader has passed it.
        track: { kind: 'shelf', mode: 'bits', every: 10, bit: shelfBook },
        fog: false,
        map: null,
        lost: {
            title: 'This Page Has Been Torn Out',
            lede: 'Someone has had this page out of the book. The story jumps from the page before to the page after, ' +
                'and whatever happened in between is anybody\'s guess.',
            caption: 'While I look for it, have a photograph to read by. '
        },
        // A gold pointer with a small green book at its tail.
        cursor: K.cursor('#f0c27a', '<rect x="1.4" y="1.4" width="9.2" height="9.6" rx="1" fill="#2e5e46" stroke="#173528" stroke-width=".8"/>' +
            '<path d="M3.6 1.4v9.6" stroke="' + GILT + '" stroke-width=".8"/><path d="M5.4 4.4h3.4M5.4 6.4h2.6" stroke="' + GILT +
            '" stroke-width=".8"/>', '#3a2a12'),
        extra: function (kit) {
            slip(kit);
            curls();
            kit.walker(WALKING_WORM, 'bookworm');
        }
    });
})();
