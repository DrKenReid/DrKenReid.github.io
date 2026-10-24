/**
 * seasons/spring.js: spring's art for js/season.js (see that file for the
 * pieces): a twig in blossom with a caterpillar let down on its silk,
 * petals in place of the leaves, tulips, daffodils and a robin in place
 * of the pumpkins among small flowers, two swallows, a blossom favicon,
 * a vine whose buds open as the reader passes them, a morning mist in the
 * light theme, blossom on the places most photographed in spring, a 404
 * page that has not come up yet. Its own: now and then a short shower
 * crosses the page's opening photograph, and a rainbow follows it.
 *
 * Classes only this file applies (css/seasons/spring.css):
 * .kr-season-pumpkin, .kr-season-dangler__body, .kr-season-flyer__body,
 * .kr-season-flyer__wing (--l, --r), .kr-season-bloom,
 * .kr-season-badge__body, .kr-season-shower (__rain, __rain--far, __bow).
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg, leafAt = K.leafAt, OVAL = K.OVAL;

    // Blossom pinks and whites, for the petals in the air.
    var PETAL_COLOURS = ['#f9c5d8', '#f4a7c4', '#fde3ec', '#ffffff', '#f7b9d0'];
    var GREEN = '#6aa83e', DARK_GREEN = '#4a8a2c';

    // A cherry petal pointing up from (0, 0), r = 10, its tip notched.
    var PETAL = 'M0 0C-5.5-3.5-6.2-9.4-1.9-10.2L0-8.5 1.9-10.2C6.2-9.4 5.5-3.5 0 0z';

    /* A blossom of five notched petals about (x, y), `scale` of a petal
       10 long, turned, in `fill` with a darker edge and a gold eye. */
    function blossom(x, y, scale, turn, fill, edge) {
        var petals = '';
        for (var i = 0; i < 5; i++) petals += '<path d="' + PETAL + '" transform="rotate(' + (i * 72) + ')"/>';
        return '<g transform="translate(' + x + ' ' + y + ') rotate(' + turn + ') scale(' + scale + ')"' +
            ' fill="' + fill + '" stroke="' + (edge || '#d27a9c') + '" stroke-width="0.9">' + petals +
            '<circle r="2.4" fill="#f2c94c" stroke="#c98f2a" stroke-width="0.6"/></g>';
    }

    /* Five round petals about (cx, cy) as one path: a flower small enough
       to read as a dot of colour (the strew, the map, a petal in the air). */
    function posyPath(cx, cy, r) {
        var d = '', pr = r * 0.42;
        for (var i = 0; i < 5; i++) {
            var a = (i * 72 - 90) * Math.PI / 180;
            var x = cx + Math.cos(a) * r * 0.55, y = cy + Math.sin(a) * r * 0.55;
            d += 'M' + (x - pr).toFixed(2) + ' ' + y.toFixed(2) + 'a' + pr.toFixed(2) + ' ' + pr.toFixed(2) +
                ' 0 1 0 ' + (pr * 2).toFixed(2) + ' 0a' + pr.toFixed(2) + ' ' + pr.toFixed(2) + ' 0 1 0 ' +
                (-pr * 2).toFixed(2) + ' 0z';
        }
        return d;
    }

    // A single petal on the canvas's 24 x 24 box, notched at the top.
    var FALLING_PETAL = 'M12 21C8 19 5.6 14.5 6.2 9.6 6.6 6.4 8.4 3.6 10.6 2.8L12 5l1.4-2.2c2.2.8 4 3.6 4.4 6.8' +
        '.6 4.9-1.8 9.4-5.8 11.4z';
    var FALLING_POSY = posyPath(12, 12, 11);

    // The twig, in blossom: five flowers, two buds and two new leaves.
    function blossomArt() {
        return '<path d="' + K.TWIG + '"' +
            ' fill="none" stroke-width="2.2" stroke-linecap="round"/>' +
            leafAt(OVAL, GREEN, 41, 16, 150, 0.45) + leafAt(OVAL, '#8cc152', 22, 18, -60, 0.4) +
            leafAt(OVAL, GREEN, 8, 33, -150, 0.35) +
            '<ellipse cx="37" cy="10.6" rx="1.7" ry="2.5" transform="rotate(-50 37 10.6)" fill="#ee8fb2" stroke-width="0.5"/>' +
            '<ellipse cx="16.2" cy="28.4" rx="1.6" ry="2.4" transform="rotate(-30 16.2 28.4)" fill="#ee8fb2" stroke-width="0.5"/>' +
            blossom(55, 5.5, 0.52, 10, '#fbd0e0') + blossom(46, 25, 0.6, -20, '#f7b6cf') +
            blossom(30, 17.5, 0.5, 30, '#fde3ec') + blossom(11, 25, 0.55, 5, '#f7b6cf') +
            blossom(6, 41, 0.6, -12, '#fbd0e0');
    }

    // A caterpillar let down on its silk, head first, curling a little.
    var CATERPILLAR = svg('kr-season-dangler__body', '0 0 20 20',
        '<circle cx="10" cy="3" r="2.3" fill="#8cc152"/><circle cx="10.7" cy="6.6" r="2.6" fill="#6aa83e"/>' +
        '<circle cx="10.9" cy="10.4" r="2.7" fill="#8cc152"/><circle cx="10.3" cy="14.1" r="2.6" fill="#6aa83e"/>' +
        '<circle cx="9.3" cy="17.2" r="2.5" fill="#4a8a2c"/>' +
        '<circle cx="8.3" cy="17.8" r=".7" fill="#1f2a14"/>' +
        '<path d="M8.4 19.4l-1.4.5M10.2 19.5l.9.8" stroke="#2f4a1f" stroke-width=".7" stroke-linecap="round"/>' +
        '<path d="M12.6 6.2h1.2M13.4 10.2h1.2M12.7 14h1.2" stroke="#4a8a2c" stroke-width=".9" stroke-linecap="round"/>');

    /* Two barn swallows, seen from below as they pass, flying right:
       swept wings, forked tails. */
    function swallows() {
        var one = '<path d="M11 0C9.6-2 5-2.8-1-2.2L-15-7.4-9.4-.6-16 5.4-1 2.2C5 2.8 9.6 2 11 0z"/>' +
            '<circle cx="9" cy="0" r="2.4"/>' +
            '<path class="kr-season-flyer__wing kr-season-flyer__wing--l" d="M5-1.8C2-8.5-4-15.5-15-20.5c3.6 5.4 7 11.6 9 18.4z"/>' +
            '<path class="kr-season-flyer__wing kr-season-flyer__wing--r" d="M5 1.8C2 8.5-4 15.5-15 20.5c3.6-5.4 7-11.6 9-18.4z"/>';
        return svg('kr-season-flyer__body', '0 0 110 56',
            '<g transform="translate(36 34)">' + one + '</g>' +
            '<g transform="translate(90 18) scale(.8)">' + one + '</g>');
    }

    /* The patch. Tulips: three cups on stems among long leaves. */
    function tulip(x, y, s, c1, c2) {
        return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
            '<path d="M-6-2C-6.5-7-4.6-11-3-12.6L0-8.2 3-12.6C4.6-11 6.5-7 6-2 5.6 3 3 5 0 5S-5.6 3-6-2z" fill="' + c1 + '"/>' +
            '<path d="M-2.6 4.6C-4 1-3.2-6 0-11c3.2 5 4 12 2.6 15.6-1 .4-1.8.5-2.6.5s-1.6-.1-2.6-.5z" fill="' + c2 + '"/></g>';
    }

    var TULIPS = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M22 22c0 12-1 22 1 34M34 15c-1 14 1 28 0 41M45 28c-1 10 0 18-2 28" fill="none" stroke="' + DARK_GREEN +
        '" stroke-width="1.8" stroke-linecap="round"/>' +
        '<path d="M16 56c-5-9-6-19-3-28 2 10 5 19 9 28zM30 56c-3-11-1-22 4-30-1 11-1 21 1 30zM40 56c2-8 7-14 14-17-4 5-6 11-7 17z"' +
        ' fill="' + GREEN + '"/>' +
        '<path d="M24 56c-2-7-1-14 3-19-1 6-1 13 0 19z" fill="' + DARK_GREEN + '"/>' +
        tulip(22, 17, 0.95, '#ea6f9d', '#c94f7f') + tulip(34, 10, 1, '#f3c33c', '#d9a521') +
        tulip(45, 23, 0.85, '#b48ad8', '#9466bf'));

    // Daffodils: two faces and one nodding, on strap leaves.
    function daffodil(x, y, s) {
        return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' +
            '<path d="' + K.star(0, 0, 9.5, 6, 0.55) + '" fill="#f9e27a" stroke="#d9b53a" stroke-width=".7" stroke-linejoin="round"/>' +
            '<circle r="4" fill="#f2a51f" stroke="#d4861a" stroke-width=".7"/><circle r="1.9" fill="#e08a12"/></g>';
    }

    var DAFFODILS = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M20 22c1 12 0 22 1 34M38 16c-2 14 0 26-1 40M50 30c1 8 0 16-1 26" fill="none" stroke="' + DARK_GREEN +
        '" stroke-width="1.8" stroke-linecap="round"/>' +
        '<path d="M14 56c-1-10 1-20 5-27-1 10-1 19 0 27zM27 56c0-12 2-22 6-30-1 11-2 21-2 30zM44 56c0-9 2-17 6-22-1 8-2 15-2 22z"' +
        ' fill="' + GREEN + '"/>' +
        daffodil(20, 18, 0.95) + daffodil(38, 12, 1.05) +
        // the nodding one, side on: its petals behind, its trumpet out
        '<g transform="translate(51 29) rotate(28)"><path d="M-6-1L0-8 6-1 0 1z" fill="#f9e27a" stroke="#d9b53a" stroke-width=".6"/>' +
        '<path d="M-2.6 0h5.2l1 6.5h-7.2z" fill="#f2a51f" stroke="#d4861a" stroke-width=".6"/></g>');

    // An American robin, side on, facing left: grey back, brick breast.
    var ROBIN = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M43 34l17 7-2 4-18-6z" fill="#3b3631"/>' +
        '<ellipse cx="32" cy="33" rx="15" ry="11" transform="rotate(-18 32 33)" fill="#6a5f55"/>' +
        '<path d="M18 27c-2 9 3 17 12 18 6 .5 10-2 11-5-6-1-12-6-14-14z" fill="#d8692c"/>' +
        '<ellipse cx="38" cy="30" rx="10" ry="5.6" transform="rotate(-16 38 30)" fill="#564c44"/>' +
        '<circle cx="21" cy="19" r="8" fill="#3b3631"/>' +
        '<path d="M13.6 17.4L6 19.6l7.8 1.4z" fill="#f2b632"/>' +
        '<circle cx="18.4" cy="17.4" r="2.1" fill="#f4efe6"/><circle cx="18.2" cy="17.4" r="1.1" fill="#16120f"/>' +
        '<path d="M29 43v10M35 42v11M26 53h6M32 53h6" stroke="#9a6b3c" stroke-width="1.3" stroke-linecap="round"/>');

    // A tuft of new grass and a small flower, for between the pieces.
    function tuft(w) {
        return '<svg class="kr-season-leaf" viewBox="0 0 24 24" width="' + w + '" height="' + w + '" aria-hidden="true"' +
            ' focusable="false"><path d="M5 24c1-6 0-10-3-14 4 3 6 8 6 14zM10 24c0-8 1-14 4-19-1 6-1 13 0 19zM16 24c1-5 3-9 7-11' +
            '-3 3-4 7-4 11z" fill="' + GREEN + '"/></svg>';
    }
    function posy(colour, w) {
        return '<svg class="kr-season-leaf" viewBox="0 0 24 24" width="' + w + '" height="' + w + '" aria-hidden="true"' +
            ' focusable="false"><path d="M12 13v11" stroke="' + DARK_GREEN + '" stroke-width="1.6"/>' +
            '<path d="' + posyPath(12, 9, 9) + '" fill="' + colour + '" stroke="#b9a6b0" stroke-width=".5"/>' +
            '<circle cx="12" cy="9" r="1.8" fill="#f2c94c"/></svg>';
    }

    var BLOSSOM_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -12 24 24">' +
        blossom(0, 0, 1.12, 0, '#f6a5c4', '#c2547f') + '</svg>';

    var MAP_BLOSSOM = svg('kr-season-badge__body', '0 0 24 24',
        '<path d="' + posyPath(12, 12, 11) + '"/><circle cx="12" cy="12" r="2.6" fill="#f2c94c"/>');

    /* A bud on the vine along a post's top, with the flower it opens
       into (.kr-season-bloom, grown to full size once passed). */
    var BLOOMS = [['#f7b6cf', '#d27a9c'], ['#ffffff', '#c9b8c0'], ['#cdb3ec', '#9a7cc4'], ['#f9e27a', '#d9b53a']];
    function bud(i) {
        var c = BLOOMS[i % BLOOMS.length], side = i % 2 ? -1 : 1;
        return svg('', '0 0 24 24',
            '<path d="M12 0v9" stroke="' + DARK_GREEN + '" stroke-width="1.4"/>' +
            '<path d="M12 3C' + (12 + side * 4) + ' 1.5 ' + (12 + side * 7) + ' 3.5 ' + (12 + side * 8) + ' 7C' +
            (12 + side * 5) + ' 8 ' + (12 + side * 2) + ' 6.5 12 3z" fill="' + GREEN + '"/>' +
            '<ellipse cx="12" cy="12" rx="2.4" ry="3.4" fill="' + GREEN + '"/>' +
            '<path d="M10.2 10.6c.5-2.2 3.1-2.2 3.6 0z" fill="' + c[0] + '"/>' +
            '<g class="kr-season-bloom">' + blossom(12, 13, 0.8, i * 23, c[0], c[1]) + '</g>');
    }

    /* A rainbow, six bands fading out towards both feet. */
    var RAINBOW = '<svg class="kr-season-shower__bow" viewBox="0 0 200 100" aria-hidden="true" focusable="false">' +
        '<defs><linearGradient id="kr-season-bow-fade" x1="0" y1="0" x2="0" y2="1">' +
        '<stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>' +
        '</linearGradient><mask id="kr-season-bow-mask"><rect width="200" height="100" fill="url(#kr-season-bow-fade)"/></mask></defs>' +
        '<g fill="none" stroke-width="4.4" mask="url(#kr-season-bow-mask)">' +
        ['#ff7a7a', '#ffb050', '#ffe36e', '#8fe39a', '#7cc4ff', '#b49cff'].map(function (c, i) {
            var r = 92 - i * 4.2;
            return '<path d="M' + (100 - r).toFixed(1) + ' 100A' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 0 1 ' +
                (100 + r).toFixed(1) + ' 100" stroke="' + c + '"/>';
        }).join('') + '</g></svg>';

    /* Now and then (one page in three, once a visit) a short shower
       crosses the page's opening photograph a little after the reader
       arrives, and a rainbow comes out after it and fades. Only while the
       photograph is on screen; never under reduced motion. */
    var SHOWER_KEY = 'kr-season-shower';
    function shower(kit) {
        if (kit.reduced || !window.IntersectionObserver) return;
        var host = document.querySelector('.welcome-area, .kr-opener, .breadcrumb-area');
        if (!host) return;
        try { if (sessionStorage.getItem(SHOWER_KEY)) return; } catch (e) { return; }
        if (Math.random() > 0.34) return;
        var seen = false;
        new IntersectionObserver(function (entries) {
            seen = entries[entries.length - 1].isIntersecting;
        }).observe(host);
        setTimeout(function () {
            if (!seen || document.hidden) return;
            try { sessionStorage.setItem(SHOWER_KEY, '1'); } catch (e) {}
            var el = document.createElement('div');
            el.className = 'kr-season-shower';
            el.setAttribute('aria-hidden', 'true');
            el.innerHTML = '<span class="kr-season-shower__rain kr-season-shower__rain--far"></span>' +
                '<span class="kr-season-shower__rain"></span>' + RAINBOW;
            host.insertBefore(el, host.querySelector(':scope > .container, :scope > .kr-opener__inner'));
            el.querySelector('.kr-season-shower__bow').addEventListener('animationend', function () { el.remove(); });
        }, 12000 + Math.random() * 18000);
    }

    K.dress({
        corner: blossomArt, dangler: CATERPILLAR,
        // Mostly single petals, some whole small blossoms, turning over.
        leaves: { kind: 'fall', colours: PETAL_COLOURS, per1000: 11, shapes: [FALLING_PETAL, FALLING_POSY],
            tumble: true, size: [10, 18] },
        // The tulips are rained on, the daffodils stand where the
        // peepers call in the evening; the robin stays silent, for
        // want of a freely licensed recording of one.
        patch: [{ art: TULIPS, size: 'big', sound: 'rain' },
                { art: DAFFODILS, size: 'small', sound: 'peepers' },
                { art: ROBIN, size: 'mid', sound: '' }],
        strew: [tuft(18), posy('#ffffff', 14), posy('#cdb3ec', 13), tuft(15), posy('#f7b6cf', 14)],
        puff: 'kr-season-puff--petals',
        flyer: swallows(), flight: 'kr-season-flyer--swoop',
        favicon: BLOSSOM_ICON, moonmark: posyPath(14, 11, 4.6),
        // A bud every 34px of vine, open once the reader has passed it.
        track: { kind: 'vine', mode: 'bits', every: 34, bit: bud },
        map: { tag: 'spring', min: 3, share: 0.04, badge: MAP_BLOSSOM },
        lost: {
            title: "This Page Hasn't Sprouted",
            lede: 'Something was planted at this address, but nothing has come up yet. It may want more rain.',
            caption: 'While you wait, have one of my spring photographs. '
        },
        cursor: K.cursor('#9ed36a', '<path fill="#f6a5c4" stroke="#7a2e52" stroke-width=".8" d="' + posyPath(6, 6, 6) + '"/>' +
            '<circle cx="6" cy="6" r="1.5" fill="#f2c230"/>', '#2f4a1f'),
        extra: shower
    });
})();
