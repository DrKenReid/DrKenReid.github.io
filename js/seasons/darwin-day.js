/**
 * seasons/darwin-day.js: Darwin Day's art for js/season.js (see that file
 * for the pieces), for 12 February, his birthday, in a naturalist's
 * greens and ochres: the "I think" tree from his first notebook on
 * transmutation in the corner, with a beetle on a thread (he collected
 * them), peppered moths, pale and dark, drifting over the openers, three
 * Galapagos finches with three different beaks among cactus pads, seeds
 * and a barnacled stone, HMS Beagle sailing along the foot of the window,
 * a finch favicon and moon, a tree of life that branches along a post's
 * top wherever the reader has passed, a sea mist off the islands, finches
 * on the wildlife places, a 404 page gone extinct, a sage pointer with a
 * beetle at its tail. Its own:
 *   - a click on a finch mutates its beak, a little longer or deeper or
 *     more hooked each time, and the beaks are kept for the visit, so the
 *     three drift apart page by page: descent with modification
 *   - a Galapagos tortoise that plods along the footer's edge (kit.walker)
 *   - on the 404 page, a litter of biomorphs (Dawkins' Blind Watchmaker)
 *     grown from the missing address: click a child to breed from it
 *
 * Classes only this file applies (css/seasons/darwin-day.css):
 * .kr-season-pumpkin, .kr-season-dangler__body, .kr-season-dangler__line,
 * .kr-season-flyer__body, .kr-season-flyer--beagle,
 * .kr-season-puff--seeds, .kr-season-track--phylo, .kr-season-twig,
 * .kr-season-badge__body, .kr-season-beak, .kr-season-tortoise__head,
 * .kr-season-biomorphs (__board, __tile, __tile--parent, __kid, __form,
 * __form--born, __gen), and the walker's kind, tortoise
 * (kr-season-walker--tortoise).
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg;

    function fix(v) { return K.fix(+v); }

    // A small seeded generator, so the drawings come out the same each time.
    function seeded(s) {
        return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }

    /* Points along a cubic from p0 to p3 (n steps, p0 left out), for the
       moths, which the canvas fills as one path. */
    function cubic(p0, p1, p2, p3, n) {
        var out = [];
        for (var i = 1; i <= n; i++) {
            var t = i / n, u = 1 - t;
            out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
                u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
        }
        return out;
    }

    /* A closed polygon, wound one way for a solid and the other for a hole,
       so a canvas's nonzero fill punches the speckles out of the wings. */
    function poly(pts, hole) {
        var area = 0;
        for (var i = 0; i < pts.length; i++) {
            var a = pts[i], b = pts[(i + 1) % pts.length];
            area += a[0] * b[1] - b[0] * a[1];
        }
        if ((area > 0) === !!hole) pts = pts.slice().reverse();
        return 'M' + pts.map(function (p) { return fix(p[0]) + ' ' + fix(p[1]); }).join('L') + 'z';
    }
    function ring(cx, cy, r, hole) {
        var pts = [];
        for (var i = 0; i < 10; i++) pts.push([cx + Math.cos(i / 10 * Math.PI * 2) * r, cy + Math.sin(i / 10 * Math.PI * 2) * r]);
        return poly(pts, hole);
    }
    function mirror(pts) { return pts.map(function (p) { return [24 - p[0], p[1]]; }); }

    /* A peppered moth on the 24 x 24 box, wings spread, body down the
       middle; `open` spreads the forewings further. Speckled with a few
       holes, which read as the pepper on a pale moth. */
    function moth(open) {
        var fore = [[12.6, 8]].concat(cubic([12.6, 8], [15.5, 5 - open], [20, 3.6 - open], [23.2, 5.2 - open], 6),
            cubic([23.2, 5.2 - open], [22.4, 9], [18.4, 11.6], [12.6, 12.4], 6));
        var hind = [[12.6, 11.6]].concat(cubic([12.6, 11.6], [16.4, 11.6], [19.8, 13.8], [19.2, 17.4], 5),
            cubic([19.2, 17.4], [16.6, 18.6], [13.6, 16.6], [12.6, 14.2], 5));
        var body = [[11.2, 7.4], [12, 6.2], [12.8, 7.4], [12.9, 15.6], [12, 17.4], [11.1, 15.6]];
        return poly(fore) + poly(mirror(fore)) + poly(hind) + poly(mirror(hind)) + poly(body) +
            K.bar(11.6, 6.8, 4.2, -118, 0.55) + K.bar(12.4, 6.8, 4.2, -62, 0.55) +
            ring(17.4, 7.6 - open * 0.6, 0.75, true) + ring(6.6, 7.6 - open * 0.6, 0.75, true) +
            ring(20.2, 7 - open * 0.8, 0.5, true) + ring(3.8, 7 - open * 0.8, 0.5, true) +
            ring(16, 14.6, 0.55, true) + ring(8, 14.6, 0.55, true);
    }
    // Pale (the typical form), speckled grey, and now and then the dark
    // form that soot made common.
    var MOTH_COLOURS = ['#f4efe2', '#e6dfcc', '#d4ccb6', '#f4efe2', '#4a443d'];

    /* The corner: the tree from Notebook B (1837), headed "I think", with
       its root marked 1 and its branches splitting down into the corner.
       Living tips carry a short crossbar, lost ones end bare; four living
       ones are lettered A to D, as his are. */
    function thinkTree() {
        var rnd = seeded(1837);
        var d = '', tips = [];
        function grow(x, y, deg, len, depth) {
            var a = deg * Math.PI / 180, x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
            // A slight bow, as a pen draws it.
            var bow = (rnd() - 0.5) * len * 0.22;
            var mx = (x + x2) / 2 - Math.sin(a) * bow, my = (y + y2) / 2 + Math.cos(a) * bow;
            d += 'M' + fix(x) + ' ' + fix(y) + 'Q' + fix(mx) + ' ' + fix(my) + ' ' + fix(x2) + ' ' + fix(y2);
            if (!depth) { tips.push([x2, y2, a]); return; }
            var n = depth < 3 && rnd() < 0.3 ? 3 : 2, step = n === 3 ? 30 : 46;
            for (var k = 0; k < n; k++) {
                grow(x2, y2, deg + (k - (n - 1) / 2) * step + (rnd() - 0.5) * 12, len * (0.76 + rnd() * 0.14), depth - 1);
            }
        }
        grow(15, 22, 48, 13, 3);
        var letters = 'ABCD', lettered = 0, bars = '', marks = '';
        tips.forEach(function (t, i) {
            var living = i % 3 === 0 || i === tips.length - 1;
            if (!living) return;
            var nx = -Math.sin(t[2]) * 2, ny = Math.cos(t[2]) * 2;
            bars += 'M' + fix(t[0] - nx) + ' ' + fix(t[1] - ny) + 'L' + fix(t[0] + nx) + ' ' + fix(t[1] + ny);
            if (lettered < 4) {
                marks += '<text x="' + fix(t[0] + Math.cos(t[2]) * 3.4 - 1.6) + '" y="' + fix(t[1] + Math.sin(t[2]) * 3.4 + 2) +
                    '">' + letters.charAt(lettered++) + '</text>';
            }
        });
        var ink = ' style="fill: var(--kr-season-line); stroke: none"';
        return '<path d="' + d + bars + '" fill="none" stroke-width="1.1" stroke-linecap="round"/>' +
            '<g font-family="Lora, Georgia, serif" font-style="italic" font-size="5.4"' + ink + '>' + marks + '</g>' +
            '<text x="22" y="10" font-family="Lora, Georgia, serif" font-style="italic" font-size="9"' + ink + '>I think</text>' +
            '<text x="12.4" y="21" font-family="Lora, Georgia, serif" font-size="6.6"' + ink + '>1</text>';
    }

    // A beetle on the thread, head up: he once put one in his mouth to
    // free a hand for a third.
    var BEETLE = svg('kr-season-dangler__body', '0 0 20 20',
        '<path class="kr-season-dangler__line" d="M7.2 8.4L3.4 6.6M7 11.6H2.8M7.2 14.6l-3.8 2.6M12.8 8.4l3.8-1.8M13 11.6h4.2M12.8 14.6l3.8 2.6' +
        'M9 3.6L7.2.8M11 3.6L12.8.8" style="stroke-width: .9"/>' +
        '<ellipse cx="10" cy="4.8" rx="2.1" ry="1.7"/>' +
        '<ellipse cx="10" cy="7.8" rx="3.4" ry="2.1"/>' +
        '<path d="M10 9.6c3.6 0 4.9 2.6 4.9 5.2 0 2.9-2.2 4.8-4.9 4.8s-4.9-1.9-4.9-4.8c0-2.6 1.3-5.2 4.9-5.2z"/>' +
        '<path d="M10 9.8v9.4" stroke="#ffffff" stroke-opacity=".35" stroke-width=".6"/>' +
        '<ellipse cx="8" cy="13" rx=".9" ry="2.2" fill="#ffffff" fill-opacity=".22"/>');

    /* A finch's beak, its base on the head at (47.4, 21.6): `len` long,
       `deep` deep at the base, its upper edge bowed by `hook`. */
    function beakPath(len, deep, hook) {
        var x0 = 47.4, y = 21.6;
        return 'M' + fix(x0) + ' ' + fix(y - deep / 2) + 'Q' + fix(x0 + len * 0.45) + ' ' + fix(y - deep / 2 - hook) + ' ' +
            fix(x0 + len) + ' ' + fix(y + 0.4) + 'Q' + fix(x0 + len * 0.45) + ' ' + fix(y + deep / 2 + hook * 0.25) + ' ' +
            fix(x0) + ' ' + fix(y + deep / 2) + 'z';
    }

    /* A Galapagos finch standing on the pumpkins' 64 x 56 box, facing
       right: tail, body, wing, head and eye, legs, and its beak, which the
       season's own toy changes. c: body, wing, belly, beak, and an edge
       drawn round the whole bird so it shows on either theme. */
    function finch(c, beak) {
        var TAIL = '<path d="M17 36L3 45.5l2.6 2.6L20 41z"', BODY = '<ellipse cx="29.3" cy="33" rx="15" ry="10.5"';
        var edged = ' fill="' + c.edge + '" stroke="' + c.edge + '" stroke-width="2.2" stroke-linejoin="round"/>';
        return svg('kr-season-pumpkin', '0 0 64 56',
            '<path d="M27 41.6l-2 9.4M25 51h-4.4M25 51l3.4 1.6M32.2 41.6l1.6 9.4M33.8 51h-4.4M33.8 51l3.6 1.2"' +
            ' fill="none" stroke="#5a5046" stroke-width="1.5" stroke-linecap="round"/>' +
            // The edge first, all round, then the bird over it.
            '<g transform="rotate(-18 29 33)">' + TAIL + edged + BODY + edged + '</g>' +
            '<circle cx="41" cy="21" r="9.3" fill="' + c.edge + '"/>' +
            '<g transform="rotate(-18 29 33)">' + TAIL + ' fill="' + c.wing + '"/>' + BODY + ' fill="' + c.body + '"/></g>' +
            '<path d="M21.6 39.6c7 3.6 15 1.8 19-4.8-4.6 2.4-12 4.6-19 4.8z" fill="' + c.belly + '"/>' +
            '<circle cx="41" cy="21" r="8.2" fill="' + c.body + '"/>' +
            '<path d="M16.6 31.4C21 25.2 30.6 23.4 37 27c-3 7.2-11 11.4-20.4 10.6z" fill="' + c.wing + '"/>' +
            '<path d="M22 30.6c3.4-1.6 7.6-2 11-1M20.6 33.6c3.4-1.6 7.6-2 11-1" fill="none" stroke="' + c.belly + '" stroke-width=".8" opacity=".7"/>' +
            '<path class="kr-season-beak" d="' + beakPath(beak[0], beak[1], beak[2]) + '" fill="' + c.beak + '"' +
            ' stroke="' + c.edge + '" stroke-width=".7" stroke-linejoin="round"/>' +
            '<circle cx="43.6" cy="19.2" r="1.6" fill="#141210"/><circle cx="44.1" cy="18.7" r=".5" fill="#ffffff"/>');
    }

    /* The three, each with its own beak, after the finches he brought
       home: a large ground finch's nutcracker, a cactus finch's probe and
       a warbler finch's tweezers. [length, depth, hook]. */
    var BEAKS = [[9, 10.5, 1.8], [13, 6, 0.8], [8, 3.6, 0.2]];
    var FINCHES = [
        { body: '#3d3530', wing: '#2b2521', belly: '#5c5249', beak: '#d6c6a2', edge: '#a6977f' },
        { body: '#544739', wing: '#3b3129', belly: '#7a6b58', beak: '#c2b08c', edge: '#ad9d84' },
        { body: '#8a8a5c', wing: '#68683f', belly: '#cfc99c', beak: '#a19570', edge: '#5b5a3a' }
    ];

    // Between them: an Opuntia pad, seeds, a stone with barnacles, a burr.
    function opuntia(size, turn) {
        return K.bit(24, 24, size, turn,
            '<path d="M12 23c-5.4 0-7.4-5-7-10 .4-5.6 3.4-10 7-10s6.6 4.4 7 10c.4 5-1.6 10-7 10z" fill="#5f8a3c" stroke="#3e5f26" stroke-width=".8"/>' +
            '<g fill="#e8e0b0"><circle cx="9" cy="8" r=".7"/><circle cx="14.6" cy="9" r=".7"/><circle cx="11.6" cy="13" r=".7"/>' +
            '<circle cx="8.4" cy="16.6" r=".7"/><circle cx="15" cy="17" r=".7"/></g>' +
            '<path d="M12 3c-1.4-1.8-.6-2.8 0-2.6s1.4.8 0 2.6z" fill="#f2c84b"/>');
    }
    function seeds(size) {
        return K.bit(24, 12, size, 0, '<ellipse cx="5" cy="8" rx="3.6" ry="2.6" fill="#8a6a3c" transform="rotate(-20 5 8)"/>' +
            '<ellipse cx="12.6" cy="9" rx="2.6" ry="1.9" fill="#b08a52"/><ellipse cx="19" cy="8.4" rx="3.2" ry="2.2" fill="#6f5530" transform="rotate(25 19 8.4)"/>');
    }
    function barnacles(size) {
        var cone = function (x, y, s) {
            return '<path d="M' + fix(x - 2.6 * s) + ' ' + fix(y) + 'L' + fix(x - 1.1 * s) + ' ' + fix(y - 3.4 * s) + 'h' + fix(2.2 * s) +
                'L' + fix(x + 2.6 * s) + ' ' + fix(y) + 'z" fill="#ece6d8" stroke="#8d877a" stroke-width=".5"/>' +
                '<path d="M' + fix(x - 0.8 * s) + ' ' + fix(y - 3.2 * s) + 'h' + fix(1.6 * s) + '" stroke="#5d584f" stroke-width=".7"/>';
        };
        return K.bit(24, 16, size, 0, '<path d="M1.5 16c-1-5 3-9.4 10.5-9.4S23.6 11 22.6 16z" fill="#7d8388"/>' +
            cone(7, 10.2, 1) + cone(12.6, 8.4, 1.15) + cone(17.4, 10.8, 0.85) + cone(10, 13.6, 0.7));
    }
    function burr(size, turn) {
        return K.bit(24, 24, size, turn,
            '<path d="' + K.star(12, 13, 10, 5, 0.55) + '" fill="#a88a4e" stroke="#6d5630" stroke-width=".8" stroke-linejoin="round"/>' +
            '<circle cx="12" cy="13" r="3" fill="#7c6438"/>');
    }

    /* HMS Beagle under sail, bound right: a barque, square sails on the
       fore and main, a spanker on the mizzen, the jib, her ensign, and the
       sea she sails on. */
    function sail(x, y, w, h) {
        return 'M' + fix(x - w / 2) + ' ' + fix(y) + 'Q' + fix(x) + ' ' + fix(y - 1.4) + ' ' + fix(x + w / 2) + ' ' + fix(y) +
            'L' + fix(x + w / 2 + 0.8) + ' ' + fix(y + h) + 'Q' + fix(x) + ' ' + fix(y + h + 1.8) + ' ' + fix(x - w / 2 - 0.8) + ' ' + fix(y + h) + 'z';
    }
    var CANVAS = ' fill="#f4ecd8" stroke="#a8946c" stroke-width=".6" stroke-linejoin="round"';
    var BEAGLE = svg('kr-season-flyer__body', '0 0 96 64',
        '<path d="M26 44V12M48 44V5M68 44V13M83 42.5l12-7" stroke="#4a3626" stroke-width="1.3" fill="none"/>' +
        '<path d="M48 5.4h-7.6l1.8 2-1.8 2H48z" fill="#24427a"/>' +
        '<path d="M25 15.4L12.4 21 11.6 41.6H25z"' + CANVAS + '/>' +
        '<path d="M93.6 36.4L69.6 15.6 71 38z"' + CANVAS + '/>' +
        '<path d="' + sail(48, 8.6, 13, 7) + sail(48, 17.4, 17, 8.4) + sail(48, 27.4, 21, 10.4) + '"' + CANVAS + '/>' +
        '<path d="' + sail(68, 15.8, 11, 6) + sail(68, 23.2, 15, 7.4) + sail(68, 32, 18.4, 8.6) + '"' + CANVAS + '/>' +
        '<path d="M8 40.2h13.4v4H8.8z" fill="#3b2a1e"/>' +
        '<path d="M8.8 44h76l-6.4 10.4c-21 3-45 3-63.4 0z" fill="#3b2a1e" stroke="#c9b48a" stroke-width=".5"/>' +
        '<path d="M11.4 47.4h70.6" stroke="#e6d9b4" stroke-width="1.7"/>' +
        '<g fill="#1d140e"><rect x="20" y="46.7" width="2" height="1.4"/><rect x="30" y="46.7" width="2" height="1.4"/>' +
        '<rect x="40" y="46.7" width="2" height="1.4"/><rect x="50" y="46.7" width="2" height="1.4"/>' +
        '<rect x="60" y="46.7" width="2" height="1.4"/><rect x="70" y="46.7" width="2" height="1.4"/></g>' +
        '<path d="M0 54.6q6-3.6 12 0t12 0 12 0 12 0 12 0 12 0 12 0 12 0V64H0z" fill="#2f6f93" fill-opacity=".92"/>' +
        '<path d="M0 54.6q6-3.6 12 0t12 0 12 0 12 0 12 0 12 0 12 0 12 0" fill="none" stroke="#e6f2f6" stroke-width=".9"/>');

    /* A Galapagos tortoise walking right on a 56 x 32 box: a saddleback,
       its shell's front edge lifted so its long neck can reach up; scutes
       on the shell; four thick legs; its head (which nods). */
    var TORTOISE = svg('', '0 0 56 32',
        '<path d="M13.4 23.6v7h4.6v-6.2M21 24.4v6.2h4v-6M33.8 24v6.6h4.4v-7M40.6 23v6.6h3.8v-6.4" fill="#6f665a" stroke="#3c362f" stroke-width=".6"/>' +
        '<path d="M8.6 24.6L5 27.4l4.4-.4z" fill="#6f665a"/>' +
        '<path d="M43 19.6c3.4-4.4 6.4-7.4 8.4-7.6" fill="none" stroke="#3c362f" stroke-width="5.4" stroke-linecap="round"/>' +
        '<path d="M43 19.6c3.4-4.4 6.4-7.4 8.4-7.6" fill="none" stroke="#7d7466" stroke-width="4" stroke-linecap="round"/>' +
        '<g class="kr-season-tortoise__head"><ellipse cx="52" cy="11.6" rx="3.9" ry="2.7" fill="#7d7466" stroke="#3c362f" stroke-width=".6"/>' +
        '<circle cx="53.4" cy="10.8" r=".6" fill="#141210"/><path d="M53.6 13.2h2" stroke="#3c362f" stroke-width=".5"/></g>' +
        '<path d="M7.6 25.4C7.4 13.4 15.6 5 27 5c9.6 0 17 5.4 19.6 13.6L45 20.4c.6 1.6.8 3.2.6 5z" fill="#4c3f2e" stroke="#2a2219" stroke-width=".8"/>' +
        '<path d="M15 17.6l4.6-6.2h8.2l4.2 6.2-4.2 6.4h-8.2zM32 17.6l3.6-6 6.2 1.6 2 7-6.6 3.8zM15 17.6l-5.4 1.6M19.6 11.4l-2.6-3.6' +
        'M27.8 11.4l.8-5.2M35.6 11.6l1.4-3.4" fill="none" stroke="#8c7754" stroke-width=".9" stroke-linejoin="round"/>' +
        '<path d="M7.6 25.4h38" stroke="#2a2219" stroke-width="1.6" stroke-linecap="round"/>');

    /* A finch in silhouette on a 24 x 24 box, facing right, its beak
       stout: for the map, the moon and the tab. Absolute commands only, so
       place() can move and scale it. */
    var FINCH_SHAPE = 'M3.6 16.6C3.6 12.2 7.4 9.2 12 9C12.6 6.2 14.8 4.4 17.4 4.4C19 4.4 20.2 5.2 20.8 6.4' +
        'L23.6 8.2L20.8 9.8C20.4 11.6 19.4 13 17.8 14C17 16.8 14.2 18.8 10.6 18.8L6 21.2L1 22.2L4.4 18.6' +
        'C4 18 3.6 17.4 3.6 16.6Z';
    function place(d, s, dx, dy) {
        var n = 0;
        return d.replace(/-?\d*\.?\d+/g, function (v) {
            return fix(n++ % 2 ? +v * s + dy : +v * s + dx);
        });
    }
    var FINCH_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<path d="' + FINCH_SHAPE + '" fill="#2f4a2a" stroke="#f4ecd8" stroke-width="1.1" stroke-linejoin="round" paint-order="stroke"/>' +
        '<path d="M20.8 6.4L23.6 8.2L20.8 9.8C21.4 8.8 21.4 7.4 20.8 6.4Z" fill="#d6b45a"/>' +
        '<circle cx="18.2" cy="7.2" r="1" fill="#f4ecd8"/></svg>';
    var MAP_FINCH = svg('kr-season-badge__body', '0 0 24 24', '<path d="' + FINCH_SHAPE + '"/>');

    /* A twig of the tree of life for a post's top, one per bit: a stem
       down from the line, forking twice, its living tips crossbarred. The
       forks differ by i, the same each time the page is drawn. */
    function twig(i) {
        var rnd = seeded(i * 7919 + 17);
        var d = 'M13 0V' + fix(3 + rnd() * 2);
        var y0 = 4.5, bars = '';
        [-1, 1].forEach(function (side) {
            var x1 = 13 + side * (4 + rnd() * 3), y1 = y0 + 4 + rnd() * 3;
            d += 'M13 ' + fix(y0 - 1) + 'Q' + fix(13 + side * 1.2) + ' ' + fix(y1 - 1) + ' ' + fix(x1) + ' ' + fix(y1);
            [-1, 1].forEach(function (s2) {
                if (rnd() < 0.25) return;
                var x2 = x1 + s2 * (2 + rnd() * 2.4), y2 = y1 + 3 + rnd() * 4;
                d += 'M' + fix(x1) + ' ' + fix(y1) + 'L' + fix(x2) + ' ' + fix(y2);
                if (rnd() < 0.6) bars += 'M' + fix(x2 - 1.4) + ' ' + fix(y2) + 'h2.8';
            });
        });
        return '<svg class="kr-season-twig" viewBox="0 0 26 20" aria-hidden="true" focusable="false">' +
            '<path d="' + d + bars + '" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>';
    }

    /* Descent with modification: a click on a finch mutates its beak (a
       little longer or shorter, deeper or shallower, more or less hooked,
       never past what a finch could carry), and the beaks are kept for
       the visit, so each page shows the lineage as it now stands. Nothing
       moves but the beak's outline, so reduced motion keeps it. */
    var BEAK_KEY = 'kr-season-beaks';
    function beaks() {
        var pieces = document.querySelectorAll('.kr-season-patch > span');
        if (pieces.length < 3) return;
        var kept = null;
        try { kept = JSON.parse(sessionStorage.getItem(BEAK_KEY) || 'null'); } catch (e) {}
        var now = BEAKS.map(function (b, i) {
            var k = kept && kept[i];
            return k && k.length === 3 && k.every(isFinite) ? k : b.slice();
        });
        function gauss() {
            return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random());
        }
        function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
        function show(i) {
            var path = pieces[i].querySelector('.kr-season-beak');
            if (path) path.setAttribute('d', beakPath(now[i][0], now[i][1], now[i][2]));
        }
        Array.prototype.forEach.call(pieces, function (el, i) {
            show(i);
            el.addEventListener('click', function () {
                var b = now[i];
                now[i] = [clamp(b[0] * Math.exp(gauss() * 0.14), 5, 16), clamp(b[1] * Math.exp(gauss() * 0.14), 3, 12.5),
                    clamp(b[2] + gauss() * 0.35, 0, 2.6)];
                show(i);
                try { sessionStorage.setItem(BEAK_KEY, JSON.stringify(now)); } catch (e) {}
            });
        });
    }

    /* The 404 page's biomorphs, after Richard Dawkins' Blind Watchmaker:
       nine genes draw a branching form (eight set the reach of each
       branch's direction, the ninth how many times it forks). The page
       grows a parent from the missing address and a litter of four
       mutants, each one gene away; a click on a child breeds from it, so
       the reader is the selection. Children appear with a small pop, not
       under reduced motion. */
    function biomorphs(kit) {
        var lede = document.querySelector('.kr-lost__lede');
        if (!lede || !document.getElementById('kr-lost-canvas') || document.querySelector('.kr-season-biomorphs')) return;
        // An address with a broken escape is just what lands here.
        var path = location.pathname || '/';
        try { path = decodeURIComponent(path); } catch (e) {}
        var seed = 12;
        for (var i = 0; i < path.length; i++) seed = (seed * 31 + path.charCodeAt(i)) >>> 0;
        var rnd = seeded(seed);
        var generation = 1;

        function form(genes) {
            var dx = [-genes[1], -genes[0], 0, genes[0], genes[1], genes[2], 0, -genes[2]];
            var dy = [genes[5], genes[4], genes[3], genes[4], genes[5], genes[6], genes[7], genes[6]];
            var segs = [];
            (function tree(x, y, len, dir) {
                dir = (dir + 8) % 8;
                var x2 = x + len * dx[dir], y2 = y + len * dy[dir];
                segs.push([x, y, x2, y2]);
                if (len > 1) { tree(x2, y2, len - 1, dir - 1); tree(x2, y2, len - 1, dir + 1); }
            })(0, 0, genes[8], 2);
            return segs;
        }
        function draw(genes, cx, cy, box) {
            var segs = form(genes), b = bounds(segs);
            var x0 = b[0], y0 = b[1], x1 = b[2], y1 = b[3];
            var k = Math.min(box / Math.max(x1 - x0, 1e-6), box / Math.max(y1 - y0, 1e-6), 5);
            var ox = cx - (x0 + x1) / 2 * k, oy = cy - (y0 + y1) / 2 * k;
            return segs.map(function (s) {
                return 'M' + fix(ox + s[0] * k) + ' ' + fix(oy + s[1] * k) + 'L' + fix(ox + s[2] * k) + ' ' + fix(oy + s[3] * k);
            }).join('');
        }
        /* The first parent: the most promising of a few forms the address
           seeds, scored for branching (distinct tips) over lopsidedness,
           so a lost page never opens on a flat line. */
        function bounds(segs) {
            var b = [Infinity, Infinity, -Infinity, -Infinity];
            segs.forEach(function (s) {
                b[0] = Math.min(b[0], s[0], s[2]); b[2] = Math.max(b[2], s[0], s[2]);
                b[1] = Math.min(b[1], s[1], s[3]); b[3] = Math.max(b[3], s[1], s[3]);
            });
            return b;
        }
        function promise(genes) {
            var segs = form(genes), b = bounds(segs), ends = {};
            segs.forEach(function (s) { ends[s[2] + ',' + s[3]] = 1; });
            var w = b[2] - b[0] + 1, h = b[3] - b[1] + 1;
            return Object.keys(ends).length / (1 + 6 * Math.abs(Math.log(w / h)));
        }
        var parent = null, best = -1;
        for (var c = 0; c < 40; c++) {
            var genes = [];
            for (var g = 0; g < 8; g++) {
                var v = Math.round(rnd() * 6) - 3;
                // The upright genes (the trunk's and the branches' fall) are never naught.
                if (g >= 3 && !v) v = rnd() < 0.5 ? -1 : 1;
                genes.push(v);
            }
            genes.push(5 + ((rnd() * 2) | 0));
            var score = promise(genes);
            if (score > best) { best = score; parent = genes; }
        }

        function mutant(genes, taken) {
            for (var tries = 0; tries < 40; tries++) {
                var child = genes.slice(), at = (Math.random() * 9) | 0, step = Math.random() < 0.5 ? -1 : 1;
                child[at] = at === 8 ? Math.max(2, Math.min(8, child[at] + step)) : Math.max(-5, Math.min(5, child[at] + step));
                var key = child.join();
                if (key !== genes.join() && taken.indexOf(key) === -1) { taken.push(key); return child; }
            }
            return genes.slice();
        }

        var el = document.createElement('div');
        el.className = 'kr-season-biomorphs';
        el.setAttribute('aria-hidden', 'true');
        lede.parentNode.insertBefore(el, lede);
        var kids = [];

        function render(born) {
            var taken = [];
            kids = [0, 1, 2, 3].map(function () { return mutant(parent, taken); });
            var order = [kids[0], kids[1], parent, kids[2], kids[3]];
            var body = order.map(function (genes, k) {
                var x = 3 + k * 84, isParent = k === 2;
                return '<g class="kr-season-biomorphs__tile' + (isParent ? ' kr-season-biomorphs__tile--parent' : ' kr-season-biomorphs__kid') + '"' +
                    (isParent ? '' : ' data-kid="' + (k < 2 ? k : k - 1) + '"') + '>' +
                    '<rect x="' + x + '" y="2" width="76" height="76" rx="7"/>' +
                    '<path class="kr-season-biomorphs__form' + (born && !isParent && !kit.reduced ? ' kr-season-biomorphs__form--born' : '') + '"' +
                    (born && !isParent ? ' style="animation-delay: ' + (k * 0.06).toFixed(2) + 's"' : '') +
                    ' d="' + draw(genes, x + 38, 40, 60) + '"/></g>';
            }).join('');
            el.innerHTML = '<svg class="kr-season-biomorphs__board" viewBox="0 0 426 80" aria-hidden="true" focusable="false">' + body + '</svg>' +
                '<p class="kr-season-biomorphs__gen">Generation ' + generation + '. Click a child to breed from it.</p>';
        }
        render(false);
        el.addEventListener('click', function (e) {
            var tile = e.target.closest && e.target.closest('[data-kid]');
            if (!tile) return;
            parent = kids[+tile.getAttribute('data-kid')];
            generation++;
            render(true);
        });
    }

    K.dress({
        // The ribbon's card (season.js, ribbon).
        about: { short: 'Darwin Day', when: '12 February',
            text: 'Charles Darwin was born on 12 February 1809. On the Origin of Species, in 1859, set out evolution by natural selection, the idea every evolutionary algorithm borrows: vary, select, repeat.',
            link: 'https://en.wikipedia.org/wiki/Darwin_Day' },
        corner: thinkTree, dangler: BEETLE,
        // Peppered moths drifting and fading, pale ones and the odd dark one.
        leaves: { kind: 'twinkle', colours: MOTH_COLOURS, per1000: 16, shapes: [moth(0), moth(2.4)], tumble: false, size: [16, 28] },
        // The ground finch sings, the cactus finch has the surf behind it;
        // the warbler finch keeps its peace.
        patch: [{ art: finch(FINCHES[0], BEAKS[0]), size: 'big', sound: '' },
                { art: finch(FINCHES[1], BEAKS[1]), size: 'mid', sound: 'waves' },
                { art: finch(FINCHES[2], BEAKS[2]), size: 'small', sound: '' }],
        strew: [opuntia(20, -8), seeds(14), barnacles(20), burr(12, 20), seeds(11)],
        puff: 'kr-season-puff--scatter kr-season-puff--seeds',
        flyer: BEAGLE, flight: 'kr-season-flyer--beagle',
        favicon: FINCH_ICON, moonmark: place(FINCH_SHAPE, 0.62, 4.6, 4.8),
        // A twig every 28px of the line, branching once the reader has passed.
        track: { kind: 'phylo', mode: 'bits', every: 28, bit: twig },
        // A finch over a place with a good share of wildlife frames.
        map: { tag: 'wildlife', min: 2, share: 0.2, badge: MAP_FINCH },
        lost: {
            title: 'This Page Went Extinct',
            lede: 'Whatever lived at this address left no fossils. It may have been outcompeted, ' +
                'or it may only ever have been a missing link.',
            caption: "While you're here, have one of my wildlife photographs. "
        },
        // A sage pointer with a beetle at its tail.
        cursor: K.cursor('#a9d4ae', '<path fill="#24402a" stroke="#e9f2e6" stroke-width=".6" d="M6 3.6c2.4 0 3.4 2 3.4 4 0 2.3-1.6 3.8-3.4 3.8S2.6 9.9 2.6 7.6c0-2 1-4 3.4-4zM6 .8c1 0 1.8.7 1.8 1.6S7 3.8 6 3.8 4.2 3.3 4.2 2.4 5 .8 6 .8z"/>' +
            '<path d="M6 3.8v7.4" stroke="#e9f2e6" stroke-width=".5"/>', '#1f3a24'),
        extra: function (kit) {
            beaks();
            K.walker(TORTOISE, 'tortoise');
            biomorphs(kit);
        }
    });
})();
