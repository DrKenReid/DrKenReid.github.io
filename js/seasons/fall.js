/**
 * seasons/fall.js: the fall's art for js/season.js (see that file for the
 * pieces): an oak twig with an acorn, more leaves, plain pumpkins in
 * orange, cream and red, geese in a V, a maple leaf favicon, a twig whose
 * leaves fall as the reader passes them, a golden haze in both themes,
 * leaves on the places most photographed in autumn, a 404 page that has
 * fallen. Its own:
 *   - a squirrel that runs along the footer's top edge once
 *     (kit.walker), stops to look about by the pumpkins and dashes off;
 *     a click on it sends it off at once
 *   - a pile of leaves at the foot of each page opener and the homepage
 *     hero that a mouse pointer sweeping through scatters: the leaves
 *     fly up the way it was going, tumble, and drift back down to settle
 *     where they land (mice only, never a touch). Under reduced motion
 *     the pile lies still.
 *
 * Classes only this file applies (css/seasons/fall.css):
 * .kr-season-pumpkin, .kr-season-dangler__body, .kr-season-flyer__body,
 * .kr-season-flyer__wing (--l, --r), .kr-season-badge__body,
 * the walker's kind, squirrel (kr-season-walker--squirrel), and
 * .kr-season-pile (__leaf).
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg, leafAt = K.leafAt, MAPLE = K.MAPLE, OVAL = K.OVAL;

    // The Halloween leaves, wider: the same with brick, a late green and a yellow.
    var FALL_COLOURS = K.LEAF_COLOURS.concat(['#a33a1c', '#8a9a3b', '#e6c13d']);

    // An oak twig reaching in from the corner, four leaves on it.
    function twigArt() {
        return '<path d="' + K.TWIG + '"' +
            ' fill="none" stroke-width="2.2" stroke-linecap="round"/>' +
            leafAt(OVAL, FALL_COLOURS[2], 46, 28, 170, 0.75) +
            leafAt(MAPLE, FALL_COLOURS[0], 10, 27, -110, 0.8) +
            leafAt(OVAL, FALL_COLOURS[5], 30, 12, -40, 0.6) +
            leafAt(MAPLE, FALL_COLOURS[1], 6, 44, 200, 0.7);
    }

    var ACORN = svg('kr-season-dangler__body', '0 0 20 20',
        '<path d="M10 3.4V1" stroke="#6b4423" stroke-width="1.4" stroke-linecap="round"/>' +
        '<path d="M5.4 9h9.2c0 5-1.9 8.7-4.6 10.4C7.3 17.7 5.4 14 5.4 9z" fill="#b5762f"/>' +
        '<path d="M4 9.2c0-3.4 2.7-5.8 6-5.8s6 2.4 6 5.8z" fill="#6b4423"/>');

    // Five geese in a V, flying right: a body, a neck and head, two wings.
    function geese() {
        var one = '<ellipse cx="0" cy="0" rx="3.4" ry="1.5"/>' +
            '<path d="M2.6-.7l3.6-1 1.4.5-1.3.7-3.4 1.1z"/>' +
            '<path class="kr-season-flyer__wing kr-season-flyer__wing--l" d="M.6-.6C-1.4-4.4-4.4-6.4-8.6-7c2.2 2.2 3.8 4.7 6.6 7.2z"/>' +
            '<path class="kr-season-flyer__wing kr-season-flyer__wing--r" d="M.2.6C-1.8 3.8-4.6 5.6-8 6.2c1.8-2 3.2-4.1 5.6-6.4z"/>';
        var at = [[130, 30], [106, 19], [106, 41], [82, 8], [82, 52]];
        return svg('kr-season-flyer__body', '0 0 144 60', at.map(function (p) {
            return '<g transform="translate(' + p[0] + ' ' + p[1] + ') scale(1.6)">' + one + '</g>';
        }).join(''));
    }

    var MAPLE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<path d="' + MAPLE + '" fill="#d9622b"/>' +
        '<path d="M12 14v9" stroke="#8c3b1f" stroke-width="1.4" stroke-linecap="round"/></svg>';

    // A small leaf for the moon, tumbling across it.
    var MOON_LEAF = 'M15.6 9.4c.4 2.5-.5 4.7-2.4 6-1.3.9-2.9 1.1-4.4.6.5-1.5 1.5-2.8 2.9-3.6 1.3-.8 2.4-1.8 3.9-3z';

    var MAP_LEAF = svg('kr-season-badge__body', '0 0 24 24', '<path d="' + MAPLE + '"/>');

    // A grey squirrel side on, facing right, its tail curled up behind.
    var SQUIRREL = svg('', '0 0 40 30',
        '<path class="kr-season-walker__tail" d="M13 22C4 22 1 14 3 8s9-8 12-3c2 4-3 6-4 9-1 2 1 5 3 6z"/>' +
        '<path d="M12 23c0-6 4-10 10-10 3-3 7-4 10-2l2-3 1 4c2 1 3 3 3 5l-3 1c-1 2-3 3-5 3l1 4h-3l-1-3h-6l1 3h-3l-1-3c-3 1-5 1-7 1z"/>' +
        '<circle cx="33.4" cy="12.8" r=".9" fill="#1f1a14"/>');

    /* ---------------------------------------------------------------- *
     * Its own: a pile of leaves at the foot of each opener
     * ---------------------------------------------------------------- */

    /* A heap of leaves lies at the foot of each page opener and the
       homepage hero, right of the middle (clear of the hero's pause
       button). A mouse pointer sweeping through it throws the leaves it
       meets up and along the way it was going, harder the faster it
       moves; they tumble and drift back down, swaying, and settle on the
       ground where they come down. Each leaf is placed by a transform
       only; the frame loop runs while a leaf is in the air and stops
       when the last has settled; the host's box is measured on the way
       in and after a scroll or resize, never per move. Mice only (a
       touch never stirs it); under reduced motion the pile lies still. */
    var PILE_GRAVITY = 700, PILE_REACH = 30, PILE_FLAT = 0.6, PILE_FLING = 700;

    function leafPiles(kit) {
        Array.prototype.forEach.call(document.querySelectorAll('.breadcrumb-area, .kr-opener, .welcome-area'), function (host) {
            if (!host.querySelector(':scope > .kr-season-pile')) leafPile(host, kit);
        });
    }

    // Where the pile lies: about four fifths across, its whole width in
    // the frame and clear of the corner the hero's pause button takes.
    function pileAt(w, half) {
        return Math.max(half + 12, Math.min(w - half - 72, w * 0.78));
    }

    function leafPile(host, kit) {
        var layer = document.createElement('div');
        layer.className = 'kr-season-pile';
        layer.setAttribute('aria-hidden', 'true');
        host.insertBefore(layer, host.querySelector(':scope > .container, :scope > .kr-opener__inner'));
        var box = host.getBoundingClientRect(), w = box.width, h = box.height, small = w < 768;
        var n = small ? 24 : 36, half = small ? 44 : 66, tall = small ? 20 : 30;
        var cx = pileAt(w, half), leaves = [];
        for (var i = 0; i < n; i++) {
            // Most near the middle, and higher there: a heap.
            var u = Math.random() + Math.random() - 1;
            leaves.push({ x: cx + u * half, y: Math.random() * tall * (1 - Math.pow(Math.abs(u), 1.6)),
                size: (small ? 11 : 14) + Math.random() * (small ? 5 : 8), turn: Math.random() * 360,
                vx: 0, vy: 0, spin: 0, rest: 0, air: false, flat: PILE_FLAT, flip: 1,
                fall: 55 + Math.random() * 40, sway: 0.8 + Math.random() * 0.8, phase: Math.random() * 6.3,
                pluck: 0.6 + Math.random() * 0.8,
                shape: Math.random() < 0.6 ? MAPLE : OVAL, colour: FALL_COLOURS[(Math.random() * FALL_COLOURS.length) | 0] });
        }
        // The lowest first, so the ones on top are drawn over them.
        leaves.sort(function (a, b) { return a.y - b.y; });
        leaves.forEach(function (l) {
            l.rest = l.y;
            l.el = document.createElement('span');
            l.el.className = 'kr-season-pile__leaf';
            l.el.innerHTML = svg('', '0 0 24 24', '<path d="' + l.shape + '" fill="' + l.colour + '"/>');
            l.el.style.width = l.size.toFixed(1) + 'px';
            place(l);
            layer.appendChild(l.el);
        });

        function place(l) {
            l.el.style.transform = 'translate(' + (l.x - l.size / 2).toFixed(1) + 'px, ' + (-l.y).toFixed(1) + 'px) scale(1, ' +
                l.flat.toFixed(2) + ') rotate(' + l.turn.toFixed(0) + 'deg) scale(' + l.flip.toFixed(2) + ', 1)';
        }

        var rect = null, frame = 0, last = 0, clock = 0;
        if (window.ResizeObserver) {
            new ResizeObserver(function () {
                rect = null;
                var r = host.getBoundingClientRect(), to = pileAt(r.width, half);
                w = r.width;
                h = r.height;
                // The heap keeps its place in the frame.
                leaves.forEach(function (l) {
                    l.x = Math.max(8, Math.min(w - 8, l.x + to - cx));
                    place(l);
                });
                cx = to;
            }).observe(host);
        }
        if (kit.reduced) return;

        function tick(now) {
            frame = 0;
            var dt = last ? Math.min(0.033, (now - last) / 1000) : 0.016, moving = false;
            last = now;
            clock += dt;
            leaves.forEach(function (l) {
                if (l.air) {
                    l.vy = Math.max(-l.fall, l.vy - PILE_GRAVITY * dt);
                    l.vx *= Math.pow(0.4, dt);
                    // On the way down a leaf rocks from side to side.
                    l.x += (l.vx + (l.vy < 0 ? Math.sin(clock * l.sway * 3 + l.phase) * 40 : 0)) * dt;
                    l.y += l.vy * dt;
                    l.turn += l.spin * dt;
                    l.spin *= Math.pow(0.5, dt);
                    l.flip = Math.max(0.25, Math.abs(Math.cos(clock * l.sway * 4 + l.phase)));
                    if (l.x < 8 || l.x > w - 8) { l.x = Math.max(8, Math.min(w - 8, l.x)); l.vx *= -0.3; }
                    if (l.y > h - 14) { l.y = h - 14; l.vy = Math.min(0, l.vy); }
                    if (l.y <= l.rest && l.vy <= 0) { l.y = l.rest; l.air = false; }
                }
                var flat = l.air ? 1 : PILE_FLAT;
                if (!l.air) l.flip += (1 - l.flip) * Math.min(1, dt * 8);
                l.flat += (flat - l.flat) * Math.min(1, dt * 8);
                if (l.air || Math.abs(l.flat - flat) > 0.01 || l.flip < 0.99) {
                    moving = true;
                    place(l);
                }
            });
            if (moving) frame = requestAnimationFrame(tick);
            else last = 0;
        }

        var px0 = 0, py0 = 0, t0 = 0;
        host.addEventListener('pointerenter', function () { rect = null; t0 = 0; });
        window.addEventListener('scroll', function () { rect = null; }, { passive: true });
        host.addEventListener('pointermove', function (e) {
            if (e.pointerType !== 'mouse') return;
            if (!rect) rect = host.getBoundingClientRect();
            var px = e.clientX - rect.left, py = rect.bottom - e.clientY;
            var gap = (e.timeStamp - t0) / 1000;
            // The pointer's own speed, held to PILE_FLING either way.
            var pvx = t0 && gap > 0 && gap < 0.12 ? (px - px0) / gap : 0;
            var pvy = t0 && gap > 0 && gap < 0.12 ? (py - py0) / gap : 0;
            pvx = Math.max(-PILE_FLING, Math.min(PILE_FLING, pvx));
            pvy = Math.max(-PILE_FLING, Math.min(PILE_FLING, pvy));
            px0 = px; py0 = py; t0 = e.timeStamp;
            if (py > tall + PILE_REACH) return;
            var speed = Math.min(PILE_FLING, Math.sqrt(pvx * pvx + pvy * pvy)), stirred = false;
            leaves.forEach(function (l) {
                // Every leaf in the pointer's column below it or near it
                // (none is left lying on a leaf that has gone), but not one
                // still on its way up from the last throw.
                var dx = l.x - px;
                if (Math.abs(dx) > PILE_REACH || l.y > py + PILE_REACH || (l.air && l.vy > 0)) return;
                var near = 1 - Math.abs(dx) / PILE_REACH;
                l.vx = ((dx < 0 ? -1 : 1) * (40 + speed * 0.15) * near + pvx * 0.3) * l.pluck + (Math.random() - 0.5) * 90;
                l.vy = Math.min(360, (80 + speed * 0.16 * (0.5 + near)) * l.pluck + Math.random() * 80);
                l.spin = (Math.random() - 0.5) * 900;
                l.rest = Math.random() * 3;
                l.air = stirred = true;
            });
            if (stirred && !frame) { last = 0; frame = requestAnimationFrame(tick); }
        });
    }

    K.dress({
        corner: twigArt, dangler: ACORN,
        leaves: { kind: 'fall', colours: FALL_COLOURS, per1000: 20, shapes: [MAPLE, OVAL], tumble: true },
        // The big pumpkin crunches through leaves, the cream one caws,
        // the red one honks.
        patch: [{ art: K.pumpkin(null), size: 'big', sound: 'leaves' },
                { art: K.pumpkin(null, ['#d8c49a', '#ecdcb6', '#bfa878']), size: 'small', sound: 'crow' },
                { art: K.pumpkin(null, ['#a8401a', '#c4552a', '#93361a']), size: 'mid', sound: 'geese' }],
        strew: K.strewnLeaves(FALL_COLOURS), puff: 'kr-season-puff--scatter kr-season-puff--leaves',
        flyer: geese(), flight: 'kr-season-flyer--glide',
        favicon: MAPLE_ICON, moonmark: MOON_LEAF,
        // A leaf every 64px of twig, the reader's passing drops it.
        track: { kind: 'branch', mode: 'bits', every: 64, bit: function (i) {
            return svg('', '0 0 24 24', '<path d="' + (i % 3 ? OVAL : MAPLE) + '" fill="' +
                FALL_COLOURS[(i * 5) % FALL_COLOURS.length] + '" transform="rotate(180 12 12)"/>');
        } },
        map: { tag: 'autumn', min: 3, share: 0.05, badge: MAP_LEAF },
        lost: {
            title: 'This Page Has Fallen',
            lede: 'Like the leaves outside, whatever was here came down and blew away.',
            caption: "While you're here, have one of my autumn photographs. "
        },
        // An amber pointer with a maple leaf at its tail.
        cursor: K.cursor('#e8a33d', '<path transform="scale(.5)" fill="#c4512a" stroke="#5a2a10" stroke-width="1" d="' + MAPLE + '"/>'),
        extra: function (kit) {
            K.walker(SQUIRREL, 'squirrel');
            leafPiles(kit);
        }
    });
})();
