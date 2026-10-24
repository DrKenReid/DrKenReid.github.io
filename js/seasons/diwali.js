/**
 * seasons/diwali.js: Diwali's art for js/season.js (see that file for the
 * pieces): a toran of marigolds and mango leaves with a star lantern on
 * its string, sky lanterns rising in place of the leaves, three diyas
 * whose flames flicker, marigolds strewn between them, a sky lantern
 * drifting up past the page, a diya favicon, a string of lights that come
 * on wherever the reader has passed, a warm haze in the dark theme, and a
 * 404 page with no lamp at its door. Its own: a row of diyas along the
 * footer's top edge, lit one by one as the footer comes into view, and on
 * the 404 page a rangoli poured petal by petal, its pattern seeded from
 * the missing address, so every lost page gets its own. The pointer is
 * saffron with a small lit diya at its tail.
 *
 * Classes only this file applies (css/seasons/diwali.css):
 * .kr-season-pumpkin, .kr-season-glow, .kr-season-flame,
 * .kr-season-dangler__body, .kr-season-flyer__body,
 * .kr-season-puff--sparks, .kr-season-flyer--rise,
 * .kr-season-track--lights, .kr-season-track__bulb, .kr-season-ledge,
 * .kr-season-ledge__lamp (--lit), .kr-season-ledge__flame,
 * .kr-season-rangoli (--pour), .kr-season-rangoli__bit (css/seasons/diwali.css,
 * "Diwali's lamps", for the last five).
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg, star = K.star;

    // Saffron, marigold, gold, magenta, a rose pink, deep indigo.
    var SAFFRON = '#f08a1c', MARIGOLD = '#f7b52c', GOLD = '#f5c542', MAGENTA = '#c2185b',
        ROSE = '#e8508f';
    var LEAF = '#3f7d34', LEAF_RIB = '#2a5a22';
    // Rising lanterns: warm paper lit from inside.
    var LANTERN_COLOURS = ['#ffb347', '#ffc861', '#ff9a3c', '#ffd98a', '#ffa65c'];

    function fix(v) { return K.fix(+v); }

    // A marigold seen face on: a ruffled ball, darker at the heart.
    function marigold(cx, cy, r, colour) {
        return '<path d="' + star(cx, cy, r, 12, 0.8) + '" fill="' + colour + '" stroke="#b45309" stroke-width=".35"/>' +
            '<circle cx="' + fix(cx) + '" cy="' + fix(cy) + '" r="' + fix(r * 0.42) + '" fill="#d9620f" stroke="none"/>';
    }

    // A mango leaf hanging point down from (x, y), turned a little.
    function mangoLeaf(x, y, turn) {
        return '<g transform="translate(' + fix(x) + ' ' + fix(y) + ') rotate(' + turn + ')">' +
            '<path d="M0 0c2.6 2.2 2.8 6.6 0 11.5-2.8-4.9-2.6-9.3 0-11.5z" fill="' + LEAF + '" stroke="none"/>' +
            '<path d="M0 1v9.5" stroke="' + LEAF_RIB + '" stroke-width=".45" fill="none"/></g>';
    }

    /* The toran: a garland of marigolds swagging across the corner with
       mango leaves hanging from it, and a strand of marigolds down the
       right edge ending in a small brass bell. The string is the line. */
    function toranArt() {
        function at(t) {
            var u = 1 - t;
            return [u * u * 2 + 2 * u * t * 33 + t * t * 64, u * u * 3 + 2 * u * t * 30 + t * t * 1];
        }
        var out = '<path d="M2 3Q33 30 64 1M61 1V40" fill="none" stroke-width="1"/>';
        [0.13, 0.31, 0.5, 0.69].forEach(function (t, i) {
            var p = at(t);
            out += mangoLeaf(p[0], p[1] + 1.5, [12, 4, -4, -10][i]);
        });
        for (var i = 0; i < 11; i++) {
            var p = at(0.04 + i * 0.085);
            out += marigold(p[0], p[1], 3.3, i % 2 ? MARIGOLD : SAFFRON);
        }
        for (var y = 6, k = 0; y <= 36; y += 5.6, k++) out += marigold(61, y, 2.8, k % 2 ? SAFFRON : MARIGOLD);
        out += '<path d="M58 46.5c0-4.2 1.2-6.6 3-6.6s3 2.4 3 6.6z" fill="#c9962c" stroke="#8f6a1b" stroke-width=".5"/>' +
            '<circle cx="61" cy="47.4" r="1" fill="#8f6a1b" stroke="none"/>';
        return out;
    }

    // An akash kandil: a star lantern, lit inside, with three tassels.
    var KANDIL = svg('kr-season-dangler__body', '0 0 20 20',
        '<path d="M5.3 14.6v4.6M10 12.6v6.8M14.7 14.6v4.6" stroke="' + MAGENTA + '" stroke-width="1.1" stroke-linecap="round"/>' +
        '<path d="' + star(10, 8.4, 8, 5, 0.52) + '" fill="' + SAFFRON + '" stroke="#a8480f" stroke-width=".6"/>' +
        '<path class="kr-season-glow" d="' + star(10, 8.7, 4.2, 5, 0.5) + '"/>');

    // A sky lantern on the 24 x 24 box, and a spark.
    var LANTERN = 'M6.5 6C6.5 2.2 17.5 2.2 17.5 6L15.4 19.6Q12 21.2 8.6 19.6Z';

    /* A diya on the pumpkins' 64 x 56 box: a clay lamp, its rim dark with
       oil, a wick and a flame that flickers (and sways), in the given
       clay, rim and paint, painted with a band of dots and a scallop. */
    function diya(clay, rim, paint, second) {
        var dots = '';
        for (var x = 14; x <= 50; x += 6) dots += '<circle cx="' + x + '" cy="37" r="1.5"/>';
        return svg('kr-season-pumpkin', '0 0 64 56',
            '<g class="kr-season-flame"><path class="kr-season-glow" d="M32 3c4.6 7.6 7.6 11.6 7.6 17a7.6 7.6 0 0 1-15.2 0c0-5.4 3-9.4 7.6-17z"/>' +
            '<path d="M32 13.5c2.2 3.4 3.5 5.3 3.5 7.8a3.5 3.5 0 0 1-7 0c0-2.5 1.3-4.4 3.5-7.8z" fill="#fff4c9"/></g>' +
            '<path d="M32 27.6v3" stroke="#3a2210" stroke-width="1.6" stroke-linecap="round"/>' +
            '<path d="M4.5 30.5h55C58 43 47 50.5 32 50.5S6 43 4.5 30.5z" fill="' + clay + '"/>' +
            '<ellipse cx="32" cy="30.5" rx="27.5" ry="3.2" fill="' + rim + '"/>' +
            '<path d="M24 50h16l-1.6 4.6H25.6z" fill="' + rim + '"/>' +
            '<g fill="' + paint + '">' + dots + '</g>' +
            '<path d="M12 42.5q2.5 2.6 5 0t5 0 5 0 5 0 5 0 5 0 5 0 5 0" fill="none" stroke="' + (second || paint) +
            '" stroke-width="1.2" stroke-linecap="round"/>');
    }

    // A marigold head and a loose petal for between the diyas.
    function bloom(size, outer, inner, turn) {
        return '<svg class="kr-season-leaf" viewBox="0 0 24 24" width="' + size + '" height="' + size + '"' +
            ' style="transform: rotate(' + turn + 'deg)" aria-hidden="true" focusable="false">' +
            '<path d="' + star(12, 12, 11, 14, 0.8) + '" fill="' + outer + '"/>' +
            '<path d="' + star(12, 12, 6.8, 10, 0.75) + '" fill="' + inner + '"/>' +
            '<circle cx="12" cy="12" r="2.2" fill="#9a4a0c"/></svg>';
    }
    function petal(size, colour, turn) {
        return '<svg class="kr-season-leaf" viewBox="0 0 24 24" width="' + size + '" height="' + size + '"' +
            ' style="transform: rotate(' + turn + 'deg)" aria-hidden="true" focusable="false">' +
            '<path d="M12 3c4.2 3 5.4 9 0 18-5.4-9-4.2-15 0-18z" fill="' + colour + '"/></svg>';
    }

    // A sky lantern rising: paper lit from inside, its ribs, the burner.
    var SKY_LANTERN = svg('kr-season-flyer__body', '0 0 40 56',
        '<path d="M8 8C8 1.6 32 1.6 32 8L28.6 44c-2.6 2-14.6 2-17.2 0z" fill="#f59a3a"/>' +
        '<path d="M13 10c0-3.4 14-3.4 14 0l-2.4 30c-2.2 1.4-7 1.4-9.2 0z" fill="#ffd27a"/>' +
        '<path d="M20 3.4v41.4M11.6 5.6l3 39M28.4 5.6l-3 39" stroke="#c4621a" stroke-width=".7" fill="none" opacity=".55"/>' +
        '<ellipse cx="20" cy="45" rx="8.6" ry="1.8" fill="#8a4512"/>' +
        '<path d="M20 46.4c1.6 2.4 2.4 3.6 2.4 5a2.4 2.4 0 0 1-4.8 0c0-1.4.8-2.6 2.4-5z" fill="#fff0b0"/>');

    var DIYA_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<path d="M16 1.5c3.2 5.2 5.4 7.8 5.4 11.4a5.4 5.4 0 0 1-10.8 0c0-3.6 2.2-6.2 5.4-11.4z" fill="#f59e0b"/>' +
        '<path d="M16 8.4c1.6 2.4 2.5 3.7 2.5 5.3a2.5 2.5 0 0 1-5 0c0-1.6.9-2.9 2.5-5.3z" fill="#fde68a"/>' +
        '<path d="M1.5 18h29c-1 7.6-7 11.8-14.5 11.8S2.5 25.6 1.5 18z" fill="#b5462a"/>' +
        '<ellipse cx="16" cy="18" rx="14.5" ry="2.2" fill="#6b230e"/></svg>';

    // A small diya on the moon: its bowl and its flame.
    var MOON_DIYA = 'M7.6 13.4h8.8c-.4 2.3-2.1 3.6-4.4 3.6s-4-1.3-4.4-3.6z' +
        'M12 6.6c1.3 2 2.1 3.2 2.1 4.4a2.1 2.1 0 0 1-4.2 0c0-1.2.8-2.4 2.1-4.4z';

    /* A bulb on the string of lights over a post: a cap and a bulb, in
       saffron, magenta, gold, green and white by turn; style.css keeps it
       dim until the reader has passed it. */
    var BULBS = ['#ffa31a', '#ff4fa3', '#ffd84d', '#4fe08f', '#fff1d0'];
    function bulb(i) {
        return '<svg class="kr-season-track__bulb" viewBox="0 0 10 16" style="color: ' + BULBS[i % BULBS.length] +
            '; transform: rotate(' + (i % 2 ? 6 : -6) + 'deg)" aria-hidden="true" focusable="false">' +
            '<path d="M3.4 0h3.2v3.4H3.4z" fill="#4a4038"/>' +
            '<path d="M5 3c2.6 0 4 2.7 4 5.8S7.2 15.5 5 15.5 1 11.9 1 8.8 2.4 3 5 3z" fill="currentColor"/>' +
            '<path d="M3.4 6.4c-.5.8-.7 1.7-.7 2.6" stroke="#fff" stroke-width=".8" stroke-linecap="round" opacity=".7"/></svg>';
    }

    // A small diya for the footer's ledge, its flame out until it is lit.
    function ledgeLamp(clay) {
        return svg('', '0 0 20 22',
            '<path class="kr-season-ledge__flame" d="M10 1c1.9 3 3 4.6 3 6.6a3 3 0 0 1-6 0c0-2 1.1-3.6 3-6.6z"/>' +
            '<path d="M10 10.4v1.6" stroke="#3a2210" stroke-width="1" stroke-linecap="round"/>' +
            '<path d="M1.5 12.5h17C18 18 14.6 20.6 10 20.6S2 18 1.5 12.5z" fill="' + clay + '"/>' +
            '<ellipse cx="10" cy="12.5" rx="8.5" ry="1.4" fill="#6b230e"/>');
    }

    /* Along the footer's top edge, right of the diyas, a row of small
       lamps, lit one by one from the left as the footer comes into view,
       as someone walks along a ledge lighting them. Under reduced motion
       they are all lit from the start. */
    function ledge(kit) {
        var footer = document.querySelector('.kr-footer');
        if (!footer || footer.querySelector('.kr-season-ledge')) return;
        var el = document.createElement('div');
        el.className = 'kr-season-ledge';
        el.setAttribute('aria-hidden', 'true');
        footer.insertBefore(el, footer.firstChild);
        var clays = ['#b5532a', '#c9962c', '#a3324f', '#b5532a', '#8f4a1f'];
        var n = Math.max(3, Math.min(14, Math.floor(el.clientWidth / 70)));
        var html = '';
        for (var i = 0; i < n; i++) html += '<span class="kr-season-ledge__lamp">' + ledgeLamp(clays[i % clays.length]) + '</span>';
        el.innerHTML = html;
        var lamps = el.querySelectorAll('.kr-season-ledge__lamp');
        function light() {
            Array.prototype.forEach.call(lamps, function (lamp, i) {
                // The flame inside reads it (a delay does not inherit through the svg).
                if (!kit.reduced) lamp.style.setProperty('--kr-season-delay', (0.25 + i * 0.32).toFixed(2) + 's');
                lamp.classList.add('kr-season-ledge__lamp--lit');
            });
        }
        if (kit.reduced || !window.IntersectionObserver) { light(); return; }
        kit.onFooter(light, 0.15);
    }

    /* The 404 page's rangoli: rings of petals and dots about a flower, in
       n-fold symmetry, seeded from the missing address like the page's
       hill climber, so each lost page has its own. It is poured from the
       middle outwards, petal by petal; under reduced motion it is there
       whole. */
    var POWDER = ['#f08a1c', '#d81b74', '#f5b82e', '#2a9d68', '#6a3fc8', '#ff6a3d', '#1f8fb8'];
    function rangoli(kit) {
        var lede = document.querySelector('.kr-lost__lede');
        if (!lede || !document.getElementById('kr-lost-canvas') || document.querySelector('.kr-season-rangoli')) return;
        // An address with a broken escape is just what lands here.
        var path = location.pathname || '/';
        try { path = decodeURIComponent(path); } catch (e) {}
        var seed = 7;
        for (var i = 0; i < path.length; i++) seed = (seed * 31 + path.charCodeAt(i)) >>> 0;
        function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
        var colours = POWDER.slice();
        for (var s = colours.length - 1; s > 0; s--) {
            var j = (rnd() * (s + 1)) | 0, t = colours[s];
            colours[s] = colours[j];
            colours[j] = t;
        }
        var n = [6, 8, 8, 10, 12][(rnd() * 5) | 0];
        var step = 360 / n, layer = 0, body = '';

        // A petal from radius r0 to r1 on the +x axis, half-width w.
        function petalPath(r0, r1, w, sharp) {
            var a = r0 + (r1 - r0) * 0.3, b = r0 + (r1 - r0) * (sharp ? 0.6 : 0.8);
            return 'M' + r0 + ' 0C' + fix(a) + ' ' + fix(w) + ' ' + fix(b) + ' ' + fix(w) + ' ' + r1 + ' 0C' +
                fix(b) + ' ' + fix(-w) + ' ' + fix(a) + ' ' + fix(-w) + ' ' + r0 + ' 0z';
        }
        function ring(count, offset, shape) {
            for (var k = 0; k < count; k++) {
                var deg = offset + k * 360 / count;
                body += '<g transform="rotate(' + fix(deg) + ')"><g class="kr-season-rangoli__bit" style="animation-delay: ' +
                    (layer * 0.5 + k / count * 0.45).toFixed(2) + 's">' + shape + '</g></g>';
            }
            layer++;
        }
        function dot(r, size, colour) {
            return '<circle cx="' + r + '" cy="0" r="' + size + '" fill="' + colour + '"/>';
        }
        var round = rnd() < 0.5;
        body += '<g class="kr-season-rangoli__bit"><circle r="7" fill="' + colours[0] + '"/>' +
            '<circle r="3" fill="' + colours[2] + '"/></g>';
        layer++;
        ring(n, 0, '<path d="' + petalPath(6, 20, 5.5, false) + '" fill="' + colours[1] + '"/>');
        ring(n, step / 2, '<path d="' + petalPath(15, 45, 13, !round) + '" fill="' + colours[2] + '"/>' +
            '<path d="' + petalPath(21, 39, 6.5, !round) + '" fill="' + colours[3] + '"/>' + dot(31, 1.6, colours[0]));
        ring(n * 2, step / 4, dot(50, 2.6, colours[4]));
        ring(n, 0, '<path d="' + petalPath(45, 81, 15, true) + '" fill="' + colours[5] + '"/>' +
            '<path d="' + petalPath(52, 74, 7.5, true) + '" fill="' + colours[1] + '"/>');
        ring(n * 2, step / 4, round ? dot(84, 3.2, colours[0]) :
            '<path d="' + petalPath(76, 90, 3.6, true) + '" fill="' + colours[0] + '"/>');
        ring(n * 3, 0, dot(94, 1.9, colours[3]));

        var el = document.createElement('div');
        el.className = 'kr-season-rangoli' + (kit.reduced ? '' : ' kr-season-rangoli--pour');
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<svg viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">' + body + '</svg>';
        lede.parentNode.insertBefore(el, lede);
    }

    K.dress({
        // The ribbon's card (season.js, ribbon).
        about: { short: 'Diwali', when: 'Five days in October or November',
            text: 'The festival of lights, kept by Hindus, Sikhs and Jains. Homes are lit with diyas, small oil lamps, doorsteps get rangoli, and the main night, Lakshmi Puja, falls on the new moon of Kartik.',
            link: 'https://en.wikipedia.org/wiki/Diwali' },
        corner: toranArt, dangler: KANDIL,
        // Sky lanterns rising, now and then a spark, all glowing.
        leaves: { kind: 'rise', colours: LANTERN_COLOURS, per1000: 12, shapes: [LANTERN, K.DOT],
            tumble: false, glow: true, size: [18, 34] },
        // The big diya rings a bell, the small one sets off firecrackers,
        // the middle one is the crowd out for the night.
        patch: [{ art: diya('#b5532a', '#6b230e', '#fde68a', '#fff4dc'), size: 'big', sound: 'bell' },
                { art: diya('#a3195b', '#5c0f33', GOLD), size: 'small', sound: 'firecrackers' },
                { art: diya('#c9962c', '#7a5614', '#fff4dc', '#7a5614'), size: 'mid', sound: 'festival' }],
        strew: [bloom(18, SAFFRON, MARIGOLD, 0), petal(11, ROSE, -40), bloom(14, MARIGOLD, '#fbd46a', 20),
            petal(10, SAFFRON, 70), bloom(16, SAFFRON, MARIGOLD, 45)],
        puff: 'kr-season-puff--sparks',
        flyer: SKY_LANTERN, flight: 'kr-season-flyer--rise',
        favicon: DIYA_ICON, moonmark: MOON_DIYA,
        // A saffron pointer with a small lit diya at its tail.
        cursor: K.cursor('#f7a531', '<path fill="#ffc53d" stroke="#7a3a0c" stroke-width=".7" d="M6 .6c1.5 2.3 2.4 3.5 2.4 4.9a2.4 2.4 0 0 1-4.8 0c0-1.4.9-2.6 2.4-4.9z"/>' +
            '<path fill="#b5462a" stroke="#4a1a08" stroke-width=".7" d="M.6 8h10.8c-.4 2.6-2.6 3.8-5.4 3.8S1 10.6.6 8z"/>', '#4a1a08'),
        // A light every 30px of string, on once the reader has passed it.
        track: { kind: 'lights', mode: 'bits', every: 30, bit: bulb },
        map: null,
        lost: {
            title: 'No Lamp at This Door',
            lede: 'At Diwali every doorway has a lamp to light the way in. This one has none, ' +
                'because there is no page behind it.',
            caption: "While you're here, have one of my brighter photographs. "
        },
        extra: function (kit) {
            ledge(kit);
            rangoli(kit);
        }
    });
})();
