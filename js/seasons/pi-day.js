/**
 * seasons/pi-day.js: Pi Day's art for js/season.js (see that file for the
 * pieces), for 14 March (3/14), in blueprint blue and pie-crust gold:
 * Archimedes' circle between two hexagons in the corner, with a slice of
 * pie on a thread, the digits of pi drifting over the openers (in pi's
 * own proportions: more 5s than 7s), an apple pie with a pi cut in its
 * crust, a cherry lattice and a pumpkin pie a slice short, forks and
 * crumbs between them, a pie in the sky, a pie favicon, a pi across the
 * moon, and a 404 page that is irrational. Over a post, a wheel rolls
 * along the top as the reader goes and unrolls its rim behind it: a tick
 * every turn, pi diameters apart, which its marked rim touches each time
 * round. The pointer is blue with a pi at its tail. Its own:
 *   - the corner's polygons double their sides, 6, 12, 24, 48, 96, as
 *     Archimedes did, closing on the circle from inside and out
 *   - a Monte Carlo board on the footer: a click throws darts at a square
 *     with a quarter circle in it, and four times the share that land
 *     inside estimates pi, live
 *   - on the 404 page, Buffon's needles: needles dropped on floorboards,
 *     the share that cross a crack estimating pi; a click drops more
 *
 * Classes only this file applies (css/seasons/pi-day.css):
 * .kr-season-pumpkin, .kr-season-dangler__body, .kr-season-flyer__body,
 * .kr-season-flyer--pie, .kr-season-puff--digits, .kr-season-track--unroll,
 * .kr-season-roller (__mark), .kr-season-archimedes (__in,
 * __out, __n), .kr-season-darts (__read, __pi, __n, __board, __square,
 * __quarter, __hit, __hit--in, __hit--new), .kr-season-buffon (__floor,
 * __board, __board--alt, __crack, __needle, __needle--cross,
 * __needle--new, __read).
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg;

    function fix(v) { return K.fix(+v); }

    /* ------------------------------------------------------------------ *
     * Digits drawn as filled paths (the canvas fills shapes, not type):
     * each glyph is pen strokes on a 10 x 16 cell, thickened into bars
     * with round joints, every piece wound the same way so they merge.
     * ------------------------------------------------------------------ */
    function poly(pts) {
        var area = 0;
        for (var i = 0; i < pts.length; i++) {
            var a = pts[i], b = pts[(i + 1) % pts.length];
            area += a[0] * b[1] - b[0] * a[1];
        }
        if (area < 0) pts = pts.slice().reverse();
        return 'M' + pts.map(function (p) { return fix(p[0]) + ' ' + fix(p[1]); }).join('L') + 'z';
    }
    function arc(cx, cy, rx, ry, a0, a1, n) {
        var out = [];
        for (var i = 0; i <= n; i++) {
            var a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
            out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
        }
        return out;
    }
    function quad(p0, p1, p2, n) {
        var out = [];
        for (var i = 0; i <= n; i++) {
            var t = i / n, u = 1 - t;
            out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
        }
        return out;
    }
    var STROKES = {
        '0': [arc(5, 8, 4, 7, 0, 360, 28)],
        '1': [[[2.4, 4], [5.6, 1], [5.6, 15]], [[2.6, 15], [8.6, 15]]],
        '2': [arc(5, 5, 3.8, 3.8, 195, 380, 12).concat([[1.2, 15], [9, 15]])],
        '3': [arc(5, 4.6, 3.6, 3.4, -150, 90, 12), arc(5, 11.3, 4, 3.7, -90, 150, 12)],
        '4': [[[7, 15], [7, 1], [0.8, 11], [9.6, 11]]],
        '5': [[[8.6, 1], [2.4, 1], [1.8, 7.4]].concat(arc(5, 10.6, 4, 4.3, -128, 155, 14))],
        '6': [quad([8.4, 1.4], [1.2, 3.6], [1.1, 11], 10), arc(5, 11, 3.9, 4, 0, 360, 24)],
        '7': [[[0.8, 1], [9.2, 1], [3.6, 15]]],
        '8': [arc(5, 4.4, 3.3, 3.3, 0, 360, 20), arc(5, 11.4, 3.9, 3.6, 0, 360, 24)],
        '9': [arc(5, 5, 3.9, 4, 0, 360, 24), quad([8.9, 5], [8.8, 13], [1.6, 14.8], 10)],
        'pi': [quad([0.2, 4.6], [0.8, 1.8], [4, 1.9], 6).concat([[10, 1.6]]),
            quad([3.6, 2], [3.6, 10], [1.4, 15], 8), quad([7, 2], [6.4, 13.4], [9.4, 14.6], 8)]
    };
    /* The glyph `ch` as one filled path, its cell scaled by s and set at
       (ox, oy), its strokes w wide (in cell units). */
    function glyph(ch, s, ox, oy, w) {
        var half = (w || 2.4) / 2, d = '';
        function pt(p) { return [ox + p[0] * s, oy + p[1] * s]; }
        function disc(p) {
            var c = pt(p), pts = [];
            for (var i = 0; i < 10; i++) pts.push([c[0] + Math.cos(i * Math.PI / 5) * half * s, c[1] + Math.sin(i * Math.PI / 5) * half * s]);
            return poly(pts);
        }
        STROKES[ch].forEach(function (line) {
            for (var i = 0; i < line.length; i++) {
                d += disc(line[i]);
                if (!i) continue;
                var a = pt(line[i - 1]), b = pt(line[i]);
                var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
                var nx = -dy / len * half * s, ny = dx / len * half * s;
                d += poly([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]);
            }
        });
        return d;
    }
    // On the 24 x 24 box the canvas uses.
    function cell(ch) { return glyph(ch, 1.1, 6.5, 3.2); }

    /* ------------------------------------------------------------------ *
     * The art
     * ------------------------------------------------------------------ */

    /* The corner: Archimedes' bounds. A circle with a polygon inside it
       and one outside, their perimeters either side of the circle's; the
       count of sides is written below (the extra doubles it). */
    var CX = 36, CY = 27, R = 18.5;
    function polygon(n, r) {
        var d = '';
        for (var k = 0; k < n; k++) {
            var a = (-90 + k * 360 / n) * Math.PI / 180;
            d += (k ? 'L' : 'M') + fix(CX + Math.cos(a) * r) + ' ' + fix(CY + Math.sin(a) * r);
        }
        return d + 'z';
    }
    function bounds(n) {
        return { inner: polygon(n, R), outer: polygon(n, R / Math.cos(Math.PI / n)) };
    }
    function archimedesArt() {
        var b = bounds(6);
        var ink = ' style="fill: var(--kr-season-line); stroke: none"';
        return '<circle cx="' + CX + '" cy="' + CY + '" r="' + R + '" fill="none" stroke-width="1.2"/>' +
            '<path class="kr-season-archimedes__out" d="' + b.outer + '" fill="none" stroke-width=".8" stroke-linejoin="round"/>' +
            '<path class="kr-season-archimedes__in" d="' + b.inner + '" fill="none" stroke-width=".8" stroke-linejoin="round"/>' +
            '<path d="M' + CX + ' ' + CY + 'h' + R + '" fill="none" stroke-width=".8" stroke-dasharray="1.6 1.2"/>' +
            '<circle cx="' + CX + '" cy="' + CY + '" r="1.1"' + ink + '/>' +
            '<text class="kr-season-archimedes__n" x="6" y="60" font-family="Lora, Georgia, serif" font-style="italic" font-size="7.4"' +
            ink + '>n = 6</text>';
    }

    // A slice of apple pie hanging by its point: the top crust, its
    // vents, the rim.
    var SLICE = svg('kr-season-dangler__body', '0 0 20 20',
        '<path d="M10 1.2L17.6 15.2Q10 19.4 2.4 15.2z" fill="#e7b46a" stroke="#9a5f22" stroke-width=".6" stroke-linejoin="round"/>' +
        '<path d="M2.6 15.4Q10 19.6 17.4 15.4" fill="none" stroke="#c07f34" stroke-width="2.6" stroke-linecap="round"/>' +
        '<path d="M9 10.6l2.2-1.1M8.2 13.4l3.4-.6M9.8 7.4l1-.9" stroke="#7a4718" stroke-width=".9" stroke-linecap="round"/>');

    // Pale digits, the odd gold one, drifting over the photographs.
    var DIGIT_COLOURS = ['#ffffff', '#d8ebff', '#a9d2ff', '#ffe2b0', '#ffd08a'];
    // pi first (drawn 70% of the time), then 3.1415926535897932384626433832795
    // without its point, so the rest turn up as often as they do in pi.
    var DIGITS = ['pi'].concat('31415926535897932384626433832795'.split('')).map(cell);

    /* The pies, on the pumpkins' 64 x 56 box, three quarters on: a tin
       dish, the crimped rim, and each one's top. */
    var TIN = '<path d="M4.4 33h55.2l-5.2 15.6c-14 3.4-30.8 3.4-44.8 0z" fill="#bcc3ca" stroke="#7a828b" stroke-width=".8"/>' +
        '<path d="M9 45.6c13 2.6 33 2.6 46 0" fill="none" stroke="#e9edf1" stroke-width="1"/>';
    function rim(crust, dark) {
        var crimps = '';
        for (var k = 0; k < 24; k++) {
            var a = k / 24 * Math.PI * 2;
            crimps += '<circle cx="' + fix(32 + Math.cos(a) * 26.6) + '" cy="' + fix(31.4 + Math.sin(a) * 9.8) + '" r="2.4"/>';
        }
        return '<ellipse cx="32" cy="32" rx="28" ry="10.6" fill="' + dark + '"/>' +
            '<g fill="' + crust + '" stroke="' + dark + '" stroke-width=".5">' + crimps + '</g>';
    }
    // Where a line through (x0, y0) along (dx, dy) crosses the pie's top.
    function chord(x0, y0, dx, dy, rx, ry) {
        var a = dx * dx / (rx * rx) + dy * dy / (ry * ry), b = 2 * ((x0 - 32) * dx / (rx * rx) + (y0 - 31) * dy / (ry * ry));
        var c = (x0 - 32) * (x0 - 32) / (rx * rx) + (y0 - 31) * (y0 - 31) / (ry * ry) - 1, disc = b * b - 4 * a * c;
        if (disc <= 0) return '';
        var t0 = (-b - Math.sqrt(disc)) / (2 * a), t1 = (-b + Math.sqrt(disc)) / (2 * a);
        return 'M' + fix(x0 + dx * t0) + ' ' + fix(y0 + dy * t0) + 'L' + fix(x0 + dx * t1) + ' ' + fix(y0 + dy * t1);
    }
    function applePie() {
        return svg('kr-season-pumpkin', '0 0 64 56', TIN + rim('#e2a85a', '#b06f2a') +
            '<ellipse cx="32" cy="31" rx="23.6" ry="8.2" fill="#ecc07a"/>' +
            '<path d="M14 30c5-3 10-4.4 15-4.6M38 25.6c4 .2 8 1.4 11.6 3.4" fill="none" stroke="#f7dca6" stroke-width="1.4" stroke-linecap="round"/>' +
            // pi cut into the crust, foreshortened.
            '<path d="' + glyph('pi', 1, 0, 0, 2.6) + '" fill="#7a4718" transform="translate(25.4 27.2) scale(1.32 .52)"/>' +
            '<path d="M14.6 32.4l3.4-1.2M46 32.4l3.4 1.2" stroke="#7a4718" stroke-width="1.2" stroke-linecap="round"/>');
    }
    function cherryPie() {
        var strips = '', cherries = '';
        // A square lattice laid corner to corner, seen three quarters on.
        for (var k = -4; k <= 4; k++) {
            strips += chord(32 + k * 9, 31, 1, 0.36, 23.4, 8.2) + chord(32 + k * 9, 31, 1, -0.36, 23.4, 8.2);
        }
        [[23.6, 31], [32, 28], [40.4, 31], [32, 34.2], [27.8, 25.6], [36.2, 25.6], [18, 28.4], [46, 28.4]].forEach(function (p) {
            cherries += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="1.5" fill="#c4233c"/>' +
                '<circle cx="' + (p[0] - 0.5) + '" cy="' + (p[1] - 0.5) + '" r=".45" fill="#ffd2d8"/>';
        });
        return svg('kr-season-pumpkin', '0 0 64 56', TIN + rim('#e2a85a', '#b06f2a') +
            '<ellipse cx="32" cy="31" rx="23.6" ry="8.2" fill="#8e1a2e"/>' + cherries +
            '<path d="' + strips + '" fill="none" stroke="#a8692a" stroke-width="3"/>' +
            '<path d="' + strips + '" fill="none" stroke="#f0c27a" stroke-width="2"/>');
    }
    /* A pumpkin pie, a dollop of cream on it and a slice gone from the
       front: the tin shows through the gap, with the cut faces either
       side. */
    function pumpkinPie() {
        function at(deg, rx, ry, dy) {
            var a = deg * Math.PI / 180;
            return [32 + Math.cos(a) * rx, 31 + (dy || 0) + Math.sin(a) * ry];
        }
        var l = at(112, 23.6, 8.2), r = at(68, 23.6, 8.2), lo = at(112, 23.6, 8.2, 5), ro = at(68, 23.6, 8.2, 5);
        var gap = 'M32 31L' + fix(r[0]) + ' ' + fix(r[1]) + 'A23.6 8.2 0 0 1 ' + fix(l[0]) + ' ' + fix(l[1]) + 'z';
        return svg('kr-season-pumpkin', '0 0 64 56', TIN + rim('#dca055', '#a8682a') +
            '<ellipse cx="32" cy="31" rx="23.6" ry="8.2" fill="#c8661e"/>' +
            '<ellipse cx="32" cy="30.4" rx="20" ry="6.4" fill="#d27428" opacity=".6"/>' +
            '<path d="' + gap + '" fill="#cdd3d9"/>' +
            '<path d="M32 31L32 36L' + fix(ro[0]) + ' ' + fix(ro[1]) + 'L' + fix(r[0]) + ' ' + fix(r[1]) + 'z" fill="#b5551a"/>' +
            '<path d="M32 31L32 36L' + fix(lo[0]) + ' ' + fix(lo[1]) + 'L' + fix(l[0]) + ' ' + fix(l[1]) + 'z" fill="#9c4614"/>' +
            '<path d="M32 36L' + fix(ro[0]) + ' ' + fix(ro[1]) + 'M32 36L' + fix(lo[0]) + ' ' + fix(lo[1]) + '" stroke="#d9a050" stroke-width="1.6"/>' +
            '<path d="M26 28.6c0-2.6 2.6-3.6 3.6-5.6.6 1.6 3.2 1.6 3.6 3.4.6-.6 2.4-.4 2.6 1 .8.4 1.6 1.2 1.2 2.2-3.4 1.4-7.6 1.4-11 0z"' +
            ' fill="#fff7ea" stroke="#d9cbb2" stroke-width=".6"/>' +
            '<g fill="#7a3a12"><circle cx="18" cy="31" r=".5"/><circle cx="21" cy="34" r=".45"/><circle cx="44" cy="28" r=".5"/>' +
            '<circle cx="47" cy="31.6" r=".45"/><circle cx="39" cy="33.4" r=".4"/></g>');
    }

    // Between the pies: a fork, crumbs, a slice on its side, a biscuit.
    function bit(w, h, body, turn) {
        return '<svg class="kr-season-leaf" viewBox="0 0 24 ' + h + '" width="' + w + '" height="' + fix(w * h / 24) + '"' +
            (turn ? ' style="transform: rotate(' + turn + 'deg)"' : '') + ' aria-hidden="true" focusable="false">' + body + '</svg>';
    }
    var FORK = bit(20, 12, '<path d="M1 7.2h12.6M13.4 5.4l3.6.4M13.4 9l3.6-.4M13.4 7.2H22" stroke="#a7b0b9" stroke-width="1.3" stroke-linecap="round"/>' +
        '<path d="M13 5.2c.8 0 1 4 0 4" fill="#a7b0b9"/>', -6);
    function crumbs(w) {
        return bit(w, 8, '<circle cx="4" cy="6" r="1.6" fill="#d39a4e"/><circle cx="9" cy="6.6" r="1" fill="#e2b36c"/>' +
            '<circle cx="14" cy="5.6" r="1.3" fill="#c4863a"/><circle cx="19.6" cy="6.4" r=".9" fill="#d39a4e"/>');
    }
    var SLICE_SIDE = bit(18, 14, '<path d="M1 12.6L22.6 7.4l.4 5.2z" fill="#c8661e"/><path d="M1 12.6L22.6 7.4l.4 5.2z" fill="none" stroke="#a8682a" stroke-width=".6"/>' +
        '<path d="M1 13h22" stroke="#dca055" stroke-width="1.4"/><path d="M21.4 6.6c1 0 1.8.8 1.6 2l.2 4.4" fill="none" stroke="#dca055" stroke-width="1.8"/>');
    var BISCUIT = bit(13, 24, '<circle cx="12" cy="12" r="10.6" fill="#e7bd78" stroke="#b98447" stroke-width="1"/>' +
        '<path d="' + glyph('pi', 1.05, 6.8, 3.6, 2.2) + '" fill="#a8692a"/>', 14);

    // A pie in the sky: the apple pie, flying, with lines behind it.
    var SKY_PIE = svg('kr-season-flyer__body', '0 0 80 56',
        '<path d="M2 26h12M5 33h10M2 40h13" stroke="#9fb4c8" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>' +
        '<g transform="translate(16 0)">' + TIN + rim('#e2a85a', '#b06f2a') + '<ellipse cx="32" cy="31" rx="23.6" ry="8.2" fill="#ecc07a"/>' +
        '<path d="' + glyph('pi', 1, 0, 0, 2.6) + '" fill="#7a4718" transform="translate(25.4 27.2) scale(1.32 .52)"/></g>');

    var PIE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<circle cx="16" cy="16" r="15" fill="#c98436"/><circle cx="16" cy="16" r="12" fill="#ecc07a"/>' +
        '<path d="' + glyph('pi', 1.25, 9.8, 6, 2.8) + '" fill="#1d4f8a"/></svg>';

    var MOON_PI = glyph('pi', 0.62, 8.9, 7, 2.6);

    // The wheel at the reader's place over a post: its rim, a spoke, and
    // the mark on its rim that met the line at the start.
    var WHEEL = '<svg class="kr-season-roller" viewBox="0 0 14 14" aria-hidden="true" focusable="false">' +
        '<circle cx="7" cy="7" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
        '<path d="M7 7v6.2M7 7L1.6 4M7 7l5.4-3" stroke="currentColor" stroke-width=".7"/>' +
        '<circle cx="7" cy="13" r="1.5" class="kr-season-roller__mark"/></svg>';

    /* ------------------------------------------------------------------ *
     * Its own
     * ------------------------------------------------------------------ */

    /* Archimedes doubled the sides of his polygons from 6 to 96 to pin pi
       between 3 10/71 and 3 1/7. The corner does the same, a doubling
       every couple of seconds, holds at 96 (where the three lines are as
       one), and starts again. Still at six under reduced motion. */
    function archimedes(kit) {
        if (kit.reduced) return;
        // Three times round, then it rests at 96 sides: the corner sits in
        // the fixed header, and a timer for the whole visit buys nothing.
        var steps = [6, 12, 24, 48, 96, 96, 96], at = 0, left = steps.length * 3;
        var timer = setInterval(function () {
            if (document.hidden) return;
            if (--left <= 0) clearInterval(timer);
            at = (at + 1) % steps.length;
            var n = steps[at], b = bounds(n);
            Array.prototype.forEach.call(document.querySelectorAll('.kr-season-corner__art'), function (art) {
                var inner = art.querySelector('.kr-season-archimedes__in'), outer = art.querySelector('.kr-season-archimedes__out');
                var label = art.querySelector('.kr-season-archimedes__n');
                if (inner) inner.setAttribute('d', b.inner);
                if (outer) outer.setAttribute('d', b.outer);
                if (label) label.textContent = 'n = ' + n;
            });
        }, 2200);
    }

    /* The wheel turns as it rolls: the engine moves it to the reader's
       place, and this turns it by that distance over its radius, so its
       mark comes round to the line at every tick (one turn, pi diameters
       on). It moves only as the reader scrolls. */
    function roll() {
        var RADIUS = 7;
        function bind(tip) {
            var wheel = tip.querySelector('.kr-season-roller');
            if (!wheel) return;
            function turn() {
                var m = /translateX\(([\d.e-]+)px\)/.exec(tip.style.transform || '');
                if (m) wheel.style.transform = 'rotate(' + (parseFloat(m[1]) / RADIUS).toFixed(4) + 'rad)';
            }
            turn();
            new MutationObserver(turn).observe(tip, { attributes: true, attributeFilter: ['style'] });
        }
        var tip = document.querySelector('.kr-season-track--unroll .kr-season-track__tip');
        if (tip) { bind(tip); return; }
        if (!document.querySelector('.blog-post, .story-post')) return;
        var wait = new MutationObserver(function () {
            var t = document.querySelector('.kr-season-track--unroll .kr-season-track__tip');
            if (t) { wait.disconnect(); bind(t); }
        });
        wait.observe(document.body, { childList: true });
        setTimeout(function () { wait.disconnect(); }, 8000);
    }

    /* The Monte Carlo board, right of the footer's edge: a unit square
       with a quarter circle in it. A click throws two dozen darts at
       random; the share inside the arc, times four, estimates pi, and the
       estimate beside the board updates as they land. It starts with a
       few already thrown. Darts drop in with a small pop, not under
       reduced motion. */
    var MAX_HITS = 420;
    function darts(kit) {
        var footer = document.querySelector('.kr-footer');
        if (!footer || footer.querySelector('.kr-season-darts')) return;
        var el = document.createElement('div');
        el.className = 'kr-season-darts';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<span class="kr-season-darts__read"><span class="kr-season-darts__pi"></span>' +
            '<span class="kr-season-darts__n"></span></span>' +
            '<svg class="kr-season-darts__board" viewBox="0 0 60 60" aria-hidden="true" focusable="false">' +
            '<rect class="kr-season-darts__square" x=".5" y=".5" width="59" height="59"/>' +
            '<path class="kr-season-darts__quarter" d="M.5 59.5V.5A59 59 0 0 1 59.5 59.5z"/><g></g></svg>';
        footer.insertBefore(el, footer.firstChild);
        var hits = el.querySelector('g'), board = el.querySelector('.kr-season-darts__board');
        var piEl = el.querySelector('.kr-season-darts__pi'), nEl = el.querySelector('.kr-season-darts__n');
        var thrown = 0, inside = 0, NS = 'http://www.w3.org/2000/svg';
        function read() {
            piEl.textContent = '\u03c0 \u2248 ' + (thrown ? (4 * inside / thrown).toFixed(3) : '?');
            nEl.textContent = thrown + ' darts';
        }
        function throwDarts(count, still) {
            for (var i = 0; i < count; i++) {
                var x = Math.random(), y = Math.random(), hit = x * x + y * y <= 1;
                thrown++;
                if (hit) inside++;
                var dot = document.createElementNS(NS, 'circle');
                dot.setAttribute('cx', fix(0.5 + x * 59));
                dot.setAttribute('cy', fix(59.5 - y * 59));
                dot.setAttribute('r', '1.25');
                dot.setAttribute('class', 'kr-season-darts__hit' + (hit ? ' kr-season-darts__hit--in' : '') +
                    (still || kit.reduced ? '' : ' kr-season-darts__hit--new'));
                if (!still && !kit.reduced) dot.style.animationDelay = (i * 0.03).toFixed(2) + 's';
                hits.appendChild(dot);
            }
            while (hits.childNodes.length > MAX_HITS) hits.removeChild(hits.firstChild);
            read();
        }
        throwDarts(100, true);
        board.addEventListener('click', function () { throwDarts(24, false); });
    }

    /* Buffon's needles on the 404 page: needles as long as the boards are
       wide, dropped at random on the floor. The chance one crosses a
       crack is 2 / pi, so two needles for every crossing estimates pi. A
       hundred and fifty fall at the start, a few at a time (all at once
       under reduced motion); a click on the floor drops fifty more. */
    function buffon(kit) {
        var lede = document.querySelector('.kr-lost__lede');
        if (!lede || !document.getElementById('kr-lost-canvas') || document.querySelector('.kr-season-buffon')) return;
        var TOP = 10, GAP = 18, ROWS = 4, HALF = GAP / 2;
        var floor = '';
        for (var r = 0; r < ROWS; r++) {
            floor += '<rect class="kr-season-buffon__board' + (r % 2 ? ' kr-season-buffon__board--alt' : '') + '" x="0" y="' + (TOP + r * GAP) +
                '" width="320" height="' + GAP + '"/>';
        }
        for (var c = 0; c <= ROWS; c++) floor += '<path class="kr-season-buffon__crack" d="M0 ' + (TOP + c * GAP) + 'H320"/>';
        var el = document.createElement('div');
        el.className = 'kr-season-buffon';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<svg class="kr-season-buffon__floor" viewBox="0 0 320 92" aria-hidden="true" focusable="false">' + floor + '<g></g></svg>' +
            '<p class="kr-season-buffon__read"></p>';
        lede.parentNode.insertBefore(el, lede);
        var needles = el.querySelector('g'), read = el.querySelector('.kr-season-buffon__read');
        var dropped = 0, crossed = 0, due = 0, timer = 0, NS = 'http://www.w3.org/2000/svg';
        function say() {
            read.textContent = dropped + ' needles, ' + crossed + ' across a crack: \u03c0 \u2248 2 \u00d7 ' + dropped + ' / ' + crossed +
                ' = ' + (crossed ? (2 * dropped / crossed).toFixed(3) : '?');
        }
        function drop(count, still) {
            for (var i = 0; i < count; i++) {
                var cx = 6 + Math.random() * 308, cy = TOP + Math.random() * GAP * ROWS, t = Math.random() * Math.PI;
                var dx = Math.cos(t) * HALF, dy = Math.sin(t) * HALF;
                var cross = Math.floor((cy - dy - TOP) / GAP) !== Math.floor((cy + dy - TOP) / GAP);
                dropped++;
                if (cross) crossed++;
                var line = document.createElementNS(NS, 'path');
                line.setAttribute('d', 'M' + fix(cx - dx) + ' ' + fix(cy - dy) + 'L' + fix(cx + dx) + ' ' + fix(cy + dy));
                line.setAttribute('class', 'kr-season-buffon__needle' + (cross ? ' kr-season-buffon__needle--cross' : '') +
                    (still ? '' : ' kr-season-buffon__needle--new'));
                needles.appendChild(line);
            }
            while (needles.childNodes.length > 600) needles.removeChild(needles.firstChild);
            say();
        }
        function rain(count) {
            if (kit.reduced) { drop(count, true); return; }
            due += count;
            if (timer) return;
            timer = setInterval(function () {
                var n = Math.min(3, due);
                due -= n;
                drop(n, false);
                if (!due) { clearInterval(timer); timer = 0; }
            }, 60);
        }
        say();
        rain(150);
        el.querySelector('.kr-season-buffon__floor').addEventListener('click', function () { rain(50); });
    }

    K.dress({
        // The ribbon's card (season.js, ribbon).
        about: { short: 'Pi Day', when: '14 March',
            text: '3/14 in American date order, which is about the only good thing that order has ever done. Larry Shaw started it at the San Francisco Exploratorium in 1988, and it\'s Albert Einstein\'s birthday too.',
            link: 'https://en.wikipedia.org/wiki/Pi_Day' },
        corner: archimedesArt, dangler: SLICE, fog: false,
        // The digits drifting and glinting, upright.
        leaves: { kind: 'twinkle', colours: DIGIT_COLOURS, per1000: 22, shapes: DIGITS, tumble: false, size: [14, 26] },
        // No recordings: a pie keeps its peace.
        patch: [{ art: applePie(), size: 'big', sound: '' },
                { art: cherryPie(), size: 'small', sound: '' },
                { art: pumpkinPie(), size: 'mid', sound: '' }],
        strew: [FORK, crumbs(10), SLICE_SIDE, crumbs(8), BISCUIT],
        puff: 'kr-season-puff--digits',
        flyer: SKY_PIE, flight: 'kr-season-flyer--pie',
        favicon: PIE_ICON, moonmark: MOON_PI,
        track: { kind: 'unroll', mode: 'fill', tip: WHEEL },
        map: null,
        lost: {
            title: 'This Page Is Irrational',
            lede: 'It goes on and on without ever repeating itself, and it never once arrives at the page you wanted.',
            caption: "While you're here, have a photograph picked by Math.random(). "
        },
        // A blue pointer with a pi at its tail.
        cursor: K.cursor('#8cc6ff', '<path fill="#12345a" stroke="#ffffff" stroke-width=".9" paint-order="stroke" d="' +
            glyph('pi', 0.95, 1.2, 0.6, 2.8) + '"/>', '#12345a'),
        extra: function (kit) {
            archimedes(kit);
            roll();
            darts(kit);
            buffon(kit);
        }
    });
})();
