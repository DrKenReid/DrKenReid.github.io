/**
 * seasons/winter.js: winter's art for js/season.js (see that file for the
 * pieces), with nothing of Christmas in it: a snowy branch with a mitten
 * on a string, snow in place of the leaves, snowmen in place of the
 * pumpkins, an owl, a snowflake favicon, eaves that grow an icicle
 * wherever the reader has passed, frost in both themes, snowflakes on the
 * snowiest places, a 404 page that is snowed in. Its own:
 *   - snow settling along the footer's top edge, deeper the longer the
 *     reader stays
 *   - frost creeping in from the corners of each page opener and the
 *     homepage hero once the reader has been still for a few seconds (no
 *     pointer move, key or scroll), frond by frond, and clearing at the
 *     first move or scroll. Under reduced motion a faint frost lies in
 *     the corners from the start, still.
 *
 * Classes only this file applies (css/seasons/winter.css):
 * .kr-season-pumpkin, .kr-season-dangler__body, .kr-season-flyer__body,
 * .kr-season-flyer__wing (--l, --r), .kr-season-badge__body,
 * .kr-season-settle, .kr-season-rime (--on, --still, __corner,
 * __corner--tl, --tr, --bl, --br, __vein, __vein--fine, __flake).
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg, flake = K.flake;

    var FLAKE = flake(12, 12, 11);
    // Snow on the light page needs an edge to be seen.
    var SNOWY = '#f4f9fd', SNOW_EDGE = '#9fb6c9';
    var SNOW_COLOURS = ['#ffffff', '#f2f8fd', '#dcecf8', '#c4ddf0'];

    // The twig's boughs, bare, with snow lying along them and three icicles.
    function snowArt() {
        var lump = function (x, y, rx, turn) {
            return '<ellipse cx="' + x + '" cy="' + y + '" rx="' + rx + '" ry="' + (rx * 0.32).toFixed(1) + '"' +
                ' transform="rotate(' + turn + ' ' + x + ' ' + y + ')" fill="' + SNOWY + '"/>';
        };
        return '<path d="' + K.TWIG + '"' +
            ' fill="none" stroke-width="2.2" stroke-linecap="round"/>' +
            lump(55, 3.6, 7, -19) + lump(37, 11.2, 6, -35) + lump(21, 23.6, 6.5, -40) +
            lump(18.6, 19.8, 4.6, -12) + lump(44.4, 7.4, 2.6, -70) +
            '<path d="M51.3 6.2l1.4 7.4 1.6-8.3zM40 10.4l1.1 5.4 1.4-6.8zM27.6 19.4l1.2 6.2 1.5-7.6z"' +
            ' fill="#cfe6f5" stroke-width="0.5"/>';
    }

    // A mitten on its string, cuff up, thumb out to one side.
    var MITTEN = svg('kr-season-dangler__body', '0 0 20 20',
        '<path d="M5.5 6h8.5v8.2c0 3-1.9 5.3-4.25 5.3S5.5 17.2 5.5 14.2zM5.6 9.4C3.4 9 2 10.4 2.2 12.3c.1 1.5 1.5 2.5 3.4 2.2z"/>' +
        '<rect x="4.8" y="2.2" width="9.9" height="4.4" rx="1.2" fill="' + SNOWY + '" stroke="' + SNOW_EDGE + '" stroke-width=".8"/>');

    // An owl seen from below as it passes over, broad wings and pale eyes.
    var OWL = svg('kr-season-flyer__body', '0 0 64 32',
        '<path class="kr-season-flyer__wing kr-season-flyer__wing--l" d="M28 13C22 8 13 7 2 10c3 1 4 2 4 3-2 0-3 1-4 2 3 0 5 1 6 2-2 1-3 2-3 3 6-1 13-1 23-3z"/>' +
        '<path class="kr-season-flyer__wing kr-season-flyer__wing--r" d="M36 13c6-5 15-6 26-3-3 1-4 2-4 3 2 0 3 1 4 2-3 0-5 1-6 2 2 1 3 2 3 3-6-1-13-1-23-3z"/>' +
        '<path d="M32 6c-4.2 0-7 2.8-7 6.6 0 5.6 3.2 11.6 7 13.4 3.8-1.8 7-7.8 7-13.4C39 8.8 36.2 6 32 6z"/>' +
        '<circle cx="29.4" cy="11.6" r="1.6" fill="#f2c94c"/><circle cx="34.6" cy="11.6" r="1.6" fill="#f2c94c"/>');

    /* A snowman on the pumpkins' 64 x 56 box, in a scarf of the given
       colour, the small one in a bobble hat. */
    function snowman(scarf, hat) {
        var snow = ' fill="' + SNOWY + '" stroke="' + SNOW_EDGE + '" stroke-width="1"';
        return svg('kr-season-pumpkin', '0 0 64 56',
            '<path d="M23 27l-11-7M12 20l-2-3.6M12 20l-4 .6M41 27l11-8M52 19l1.6-3.8M52 19l4 .2" fill="none"' +
            ' stroke="#6b4a2f" stroke-width="1.6" stroke-linecap="round"/>' +
            '<circle cx="32" cy="42.5" r="13"' + snow + '/>' +
            '<circle cx="32" cy="26" r="9.5"' + snow + '/>' +
            '<circle cx="32" cy="12.5" r="7"' + snow + '/>' +
            '<path d="M29 11.2a1 1 0 1 0 .01 0zM35 11.2a1 1 0 1 0 .01 0zM32 23.4a1.1 1.1 0 1 0 .01 0z' +
            'M32 28.4a1.1 1.1 0 1 0 .01 0zM32 38a1.2 1.2 0 1 0 .01 0zM32 43a1.2 1.2 0 1 0 .01 0z" fill="#2c3440"/>' +
            '<path d="M32 13.2l7 1.4-7 1.2z" fill="#e8892b"/>' +
            '<path d="M24.6 17.8c4.6 1.8 10.2 1.8 14.8 0l.4 3.2c-5 1.8-10.6 1.8-15.6 0zM34.4 20.4l.4 8.2 3.6-.7-1.4-7.8z" fill="' + scarf + '"/>' +
            (hat ? '<path d="M25.4 8.6c.6-5 3.4-7.2 6.6-7.2s6 2.2 6.6 7.2z" fill="' + scarf + '"/>' +
                '<circle cx="32" cy="1.6" r="1.8" fill="' + SNOWY + '" stroke="' + SNOW_EDGE + '" stroke-width=".8"/>' : ''));
    }

    // A drift of snow for between the snowmen, w px wide.
    function drift(w) {
        return K.bit(24, 10, w, 0, '<path d="M.5 10c2-6 6.5-9 11.5-9s9.5 3 11.5 9z" fill="' + SNOWY +
            '" stroke="' + SNOW_EDGE + '" stroke-width=".8"/>');
    }

    var FLAKE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<path d="' + flake(12, 12, 11.5) + '" fill="#3d86c6"/></svg>';

    var MAP_FLAKE = svg('kr-season-badge__body', '0 0 24 24', '<path d="' + FLAKE + '"/>');

    // An icicle for the eaves along a post's top, its length in px.
    function icicle(length) {
        return '<svg viewBox="0 0 8 24" preserveAspectRatio="none" style="height: ' + length + 'px"' +
            ' aria-hidden="true" focusable="false"><path d="M0 0h8L4.7 22.6c-.2.9-1.2.9-1.4 0z" fill="#cfe6f5"' +
            ' stroke="#8fb3cf" stroke-width="1" vector-effect="non-scaling-stroke"/>' +
            '<path d="M2.2 1.5L4 16" stroke="#ffffff" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>';
    }

    /* Snow settles along the footer's top edge, a ridge with a soft top
       that deepens over the first two minutes on the page (style.css
       grows it; under reduced motion it is there, settled, at once). */
    function settle(kit) {
        var footer = document.querySelector('.kr-footer');
        if (!footer || footer.querySelector('.kr-season-settle')) return;
        var el = document.createElement('div');
        el.className = 'kr-season-settle';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<svg viewBox="0 0 400 12" preserveAspectRatio="none" aria-hidden="true" focusable="false">' +
            '<path d="M0 12V7c20-4 40-5 62-2s44 3 70 0 50-5 78-2 52 4 80 1 52-4 70-2 30 2 40 3v7z" fill="' + SNOWY +
            '" stroke="' + SNOW_EDGE + '" stroke-width="1" vector-effect="non-scaling-stroke"/></svg>';
        footer.insertBefore(el, footer.firstChild);
        // One frame on, so the transition runs from nothing.
        requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('is-visible'); }); });
    }

    /* ---------------------------------------------------------------- *
     * Its own: frost that creeps in while the reader is still
     * ---------------------------------------------------------------- */

    // A random that is the same on every page for a given seed.
    function seeded(n) {
        return function () { var v = Math.sin(++n * 91.7 + 12.9898) * 43758.5453; return v - Math.floor(v); };
    }

    /* The frost in one corner, on a 200 x 200 box with the corner at its
       origin: seven fronds of ice reaching out from it, each a spine with
       a row of fine barbs along it (one path, drawn barb by barb) and a
       smaller frond branching off its middle, and a small crystal at
       each tip. Every vein has pathLength 1 so style.css can draw it out
       with its dash; --kr-season-at is when each starts, the barbs a
       moment after their spine and a side frond once its spine has
       reached it. RIME_SPINE is style.css's time for a spine to grow. */
    var RIME_SPINE = 3.6;
    function rimeArt(seed) {
        var rand = seeded(seed), fix = K.fix, veins = '', tips = '';
        function at(t) { return '" style="--kr-season-at: ' + t.toFixed(2) + 's"/>'; }
        function frond(x0, y0, deg, len, start, wide, tip) {
            var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), barbs = '';
            for (var d = 7 + rand() * 4, k = 0; d < len - 4; d += 4.5 + rand() * 4, k++) {
                var turn = (deg + (k % 2 ? 1 : -1) * (52 + rand() * 14)) * Math.PI / 180;
                var bl = (len - d) * (0.16 + rand() * 0.14) + 2.5;
                barbs += 'M' + fix(x0 + c * d) + ' ' + fix(y0 + s * d) + 'l' + fix(Math.cos(turn) * bl) + ' ' +
                    fix(Math.sin(turn) * bl);
            }
            veins += '<path class="kr-season-rime__vein" pathLength="1" stroke-width="' + wide + '" d="M' + fix(x0) + ' ' +
                fix(y0) + 'L' + fix(x0 + c * len) + ' ' + fix(y0 + s * len) + at(start) +
                '<path class="kr-season-rime__vein kr-season-rime__vein--fine" pathLength="1" stroke-width="' + fix(wide * 0.6) +
                '" d="' + barbs + at(start + 0.3);
            if (tip) tips += '<path class="kr-season-rime__flake" d="' + flake(x0 + c * (len + 4), y0 + s * (len + 4), tip) + at(start + RIME_SPINE);
        }
        for (var i = 0; i < 7; i++) {
            var deg = 3 + (i + 0.15 + rand() * 0.7) * (84 / 7), a = deg * Math.PI / 180;
            var len = 105 + rand() * 75 - Math.abs(deg - 45) * 0.8, start = rand() * 3;
            frond(0, 0, deg, len, start, 1.2, 3 + rand() * 2.5);
            var off = len * (0.3 + rand() * 0.2);
            frond(Math.cos(a) * off, Math.sin(a) * off, deg + (rand() < 0.5 ? -1 : 1) * (28 + rand() * 12),
                len * (0.35 + rand() * 0.15), start + off / len * RIME_SPINE, 0.9, 0);
        }
        return '<svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">' + veins + tips + '</svg>';
    }

    /* After IDLE_S seconds with no pointer move, press, key, wheel or
       scroll, frost creeps in from the four corners of each page opener
       and the homepage hero (under an opener's type; the lower two
       smaller, as that type sits low), frond by frond; the first move or
       scroll clears it. The countdown is a one-second tick that runs
       only until the frost is on, so a still page runs no timer at all.
       Under reduced motion a faint frost lies in the corners from the
       start, still. */
    var IDLE_S = 5;
    function rime(kit) {
        var hosts = document.querySelectorAll('.breadcrumb-area, .kr-opener, .welcome-area');
        if (!hosts.length) return;
        var corners = ['tl', 'tr', 'bl', 'br'].map(function (at, i) {
            return '<span class="kr-season-rime__corner kr-season-rime__corner--' + at + '">' + rimeArt(i * 7 + 3) + '</span>';
        }).join('');
        var layers = Array.prototype.map.call(hosts, function (host) {
            var el = document.createElement('div');
            el.className = 'kr-season-rime' + (kit.reduced ? ' kr-season-rime--still' : '');
            el.setAttribute('aria-hidden', 'true');
            el.innerHTML = corners;
            host.insertBefore(el, host.querySelector(':scope > .container, :scope > .kr-opener__inner'));
            return el;
        });
        if (kit.reduced) return;

        var quiet = 0, ticking = 0, on = false;
        function frost(v) {
            on = v;
            layers.forEach(function (el) { el.classList.toggle('kr-season-rime--on', v); });
        }
        // Stopped while the tab is hidden; its return wakes it again.
        function tick() {
            ticking = 0;
            if (document.hidden) { quiet = 0; return; }
            if (++quiet >= IDLE_S) { frost(true); return; }
            ticking = setTimeout(tick, 1000);
        }
        function wake() {
            quiet = 0;
            if (on) frost(false);
            if (!ticking) ticking = setTimeout(tick, 1000);
        }
        ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach(function (type) {
            window.addEventListener(type, wake, { passive: true });
        });
        document.addEventListener('visibilitychange', wake);
        wake();
    }

    K.dress({
        corner: snowArt, dangler: MITTEN,
        // Mostly small flakes, some whole snowflakes; snow does not tumble.
        leaves: { kind: 'fall', colours: SNOW_COLOURS, per1000: 26, shapes: [K.DOT, FLAKE], tumble: false },
        // The big snowman crunches through snow, the small one is a
        // chickadee, the middle one lands in a drift.
        patch: [{ art: snowman('#2f6fa8'), size: 'big', sound: 'snow' },
                { art: snowman('#d9a530', true), size: 'small', sound: 'chickadee' },
                { art: snowman('#2a8c82'), size: 'mid', sound: 'flop' }],
        strew: [drift(22), drift(16), drift(18), drift(20), drift(14)], puff: 'kr-season-puff--scatter kr-season-puff--snow',
        flyer: OWL, flight: 'kr-season-flyer--soar',
        favicon: FLAKE_ICON, moonmark: flake(14, 11, 4.4),
        // An icicle every 26px of eaves, grown once the reader has passed.
        track: { kind: 'icicles', mode: 'bits', every: 26, bit: function (i) { return icicle(9 + (i * 7) % 5 * 3); } },
        map: { tag: 'winter', min: 3, share: 0.05, badge: MAP_FLAKE },
        lost: {
            title: 'This Page Is Snowed In',
            lede: 'Whatever lived at this address is under a lot of snow, and nobody has dug it out.',
            caption: "While you wait for the thaw, have one of my winter photographs. "
        },
        // An ice-blue pointer with a snowflake at its tail.
        cursor: K.cursor('#cfe6f5', '<path fill="#3d86c6" d="' + flake(6, 6, 5.8) + '"/>', '#2f4a63'),
        extra: function (kit) {
            settle(kit);
            rime(kit);
        }
    });
})();
