/**
 * seasons/bonfire-night.js: Bonfire Night's art for js/season.js (see that
 * file for the pieces): a Catherine wheel spinning on its post with a
 * toffee apple on a string, busy fireworks in the hot colours of a back
 * garden display over the openers, a bonfire, a rocket in a milk bottle
 * and a lit sparkler on the footer, a rocket on its stick, a bonfire
 * favicon, a fuse burning down as the reader goes, smoke in both themes, a
 * barrel of gunpowder over London, a 404 page that went up in smoke. Its
 * own: sparks that follow the pointer over the homepage hero, as if the
 * reader were writing with a sparkler.
 *
 * Classes only this file applies (css/seasons/bonfire-night.css):
 * .kr-season-pumpkin, .kr-season-glow, .kr-season-dangler__body,
 * .kr-season-flyer__body, .kr-season-flyer__trail, .kr-season-badge__body,
 * .kr-season-wheel, .kr-season-blaze, .kr-season-track__fizz,
 * .kr-season-sparkler.
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg, bar = K.bar, star = K.star;

    // Ember orange, flame, rocket red, green, magenta, the white of a sparkler.
    var FIREWORK_COLOURS = ['#ff8a3d', '#ffb347', '#ff5a36', '#7fe36b', '#ff6fd8', '#fff0b0'];
    var WOOD = '#6b4423', WOOD_END = '#c99b6a', FLAME = '#ef6a1f', SPARK = '#ffd34d';

    // A burst of `n` rays round (cx, cy), r long, for a sparkler's tip.
    function rays(cx, cy, r, n, wide) {
        var d = '';
        for (var i = 0; i < n; i++) {
            var deg = i * 360 / n + (i % 2 ? 8 : 0);
            d += bar(cx, cy, r * (i % 3 ? 0.7 : 1), deg, wide);
        }
        return d;
    }

    /* A Catherine wheel pinned to a stake: a coil of pink paper with a
       yellow stripe, sparks spraying from its free end. The coil and its
       sparks turn together (.kr-season-wheel); under reduced motion it
       holds still. */
    var WX = 34, WY = 24;
    function wheelArt() {
        var coil = '', stripe = '';
        for (var t = 0; t <= 3 * Math.PI * 2; t += 0.25) {
            var r = 2.4 + t * 0.62;
            coil += (t ? 'L' : 'M') + (WX + Math.cos(t) * r).toFixed(1) + ' ' + (WY + Math.sin(t) * r).toFixed(1);
        }
        stripe = coil;
        // The free end, at the last turn: sparks fly back along it.
        var end = 3 * Math.PI * 2, er = 2.4 + end * 0.62;
        var ex = WX + Math.cos(end) * er, ey = WY + Math.sin(end) * er;
        var spray = '';
        for (var i = 0; i < 6; i++) spray += bar(ex, ey, 6 + (i % 3) * 3, 60 + i * 14, 0.9);
        return '<path d="M' + (WX - 2.5) + ' 0h5v50h-5z" fill="' + WOOD + '" stroke="none"/>' +
            '<g class="kr-season-wheel">' +
            '<path d="' + coil + '" fill="none" stroke="#c23a7a" stroke-width="3.4" stroke-linecap="round"/>' +
            '<path d="' + stripe + '" fill="none" stroke="#f6c34a" stroke-width="1" stroke-dasharray="3 3"/>' +
            '<path class="kr-season-glow" d="' + spray + '" stroke="none"/>' +
            '<circle cx="' + ex.toFixed(1) + '" cy="' + ey.toFixed(1) + '" r="2" fill="#fff0b0" stroke="none"/></g>' +
            '<circle cx="' + WX + '" cy="' + WY + '" r="1.8" fill="#9aa0a6" stroke="#4a4f55" stroke-width=".6"/>';
    }

    // A toffee apple hanging by its stick, glossy, with a drip.
    var TOFFEE_APPLE = svg('kr-season-dangler__body', '0 0 20 20',
        '<path d="M9.2 0h1.6v8h-1.6z" fill="#d9b27a"/>' +
        '<path d="M10 6.6c4 0 6.8 2.4 6.8 6.2 0 3.4-2.6 6.4-6.8 6.4s-6.8-3-6.8-6.4c0-3.8 2.8-6.2 6.8-6.2z" fill="#8a2410" stroke="#4a1206" stroke-width=".6"/>' +
        '<path d="M6.6 17.6c.4 1.4.4 2.2 1.2 2.2s.6-1 .4-1.8" fill="#8a2410"/>' +
        '<path d="M6 11.2c.5-1.8 1.8-2.8 3.4-3" fill="none" stroke="#ffd9c2" stroke-width="1.1" stroke-linecap="round" stroke-opacity=".8"/>');

    /* The footer's pieces, on the pumpkins' 64 x 56 box. A bonfire: logs
       stacked across, flames over them that flicker (.kr-season-blaze, its
       heart .kr-season-glow). */
    function log(x0, y0, len, deg) {
        var a = deg * Math.PI / 180;
        return '<path d="' + bar(x0, y0, len, deg, 5.4) + '" fill="' + WOOD + '"/>' +
            '<ellipse cx="' + (x0 + Math.cos(a) * len).toFixed(1) + '" cy="' + (y0 + Math.sin(a) * len).toFixed(1) +
            '" rx="2.2" ry="2.7" fill="' + WOOD_END + '" stroke="#8a5a32" stroke-width=".6"/>';
    }
    function cone(x0, y0, x1, y1) {
        var dx = x1 - x0, dy = y1 - y0;
        return '<path d="' + bar(x0, y0, Math.sqrt(dx * dx + dy * dy), Math.atan2(dy, dx) * 180 / Math.PI, 3.6) +
            '" fill="#5a3a1e"/>';
    }
    var BONFIRE = svg('kr-season-pumpkin', '0 0 64 56',
        // Sticks stood up in a cone, crossing over the top.
        cone(8, 51, 37, 1) + cone(56, 51, 27, 1) + cone(20, 52, 38, 3) + cone(45, 52, 25, 3) +
        '<path class="kr-season-blaze" d="M32 3c3 7 11 11 13 20 1.6 7-1 13-5 17 1-4 0-7-2-9 0 4-2 7-6 9 1-3 0-6-2-8-2 3-6 5-7 9' +
        '-4-4-6-10-4-16 1-5 5-8 6-13 2 3 3 5 3 8 2-5 4-10 4-17z" fill="' + FLAME + '"/>' +
        '<path class="kr-season-glow" d="M32 18c2 5 7 8 7 14 0 4-2 7-4 9 0-3-1-5-3-6-1 3-3 5-6 6-2-3-3-6-2-9 1-4 4-6 5-9 1 2 2 3 2 5 1-3 1-6 1-10z"/>' +
        log(4, 52, 54, -6) + log(8, 46, 50, 4) + log(30, 54, 30, -2));

    // A rocket in a milk bottle, ready to go: the stick down the neck.
    var ROCKET_BOTTLE = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M31.3 8h1.4v42h-1.4z" fill="#c9a26b"/>' +
        '<path d="M33 7h7v17h-7z" fill="#d9472b" stroke="#7a1f10" stroke-width=".8"/>' +
        '<path d="M33 12h7v3h-7z" fill="#f6c34a"/>' +
        '<path d="M32.4 7.4L36.5 1.6 40.6 7.4z" fill="#2f4a8a"/>' +
        '<path d="M36.5 24v3" stroke="#3a2a20" stroke-width=".9"/>' +
        '<path d="M27 22h10v6c0 3 6 5 6 11v13c0 2-1 3-3 3H24c-2 0-3-1-3-3V39c0-6 6-8 6-11z" fill="#dfeef5" fill-opacity=".55" stroke="#8fb3c4" stroke-width="1.2"/>' +
        '<path d="M26 20.6h12v2.4H26z" fill="#c9d9e2" stroke="#8fb3c4" stroke-width=".8"/>' +
        '<path d="M24.5 40v10" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round" stroke-opacity=".7"/>');

    // A sparkler stuck in the ground, alight at its tip.
    var SPARKLER = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M22 55L38 19" stroke="#8d939a" stroke-width="1.6" stroke-linecap="round"/>' +
        '<path d="M28 41.5L38 19" stroke="#4d5359" stroke-width="3" stroke-linecap="round"/>' +
        '<path class="kr-season-glow" d="' + rays(39, 17, 15, 14, 1) + '"/>' +
        '<circle cx="39" cy="17" r="3.4" fill="#fff6d8"/>' +
        '<path d="' + star(52, 8, 2.4, 4, 0.3) + star(26, 9, 2, 4, 0.3) + star(50, 28, 1.8, 4, 0.3) + '" fill="' + SPARK + '"/>');

    // Bits for between them: sticks, embers, a spent sparkler.
    function stick(w, turn) {
        return K.bit(24, 8, w, turn,
            '<path d="M1 5l21-2M14 3.6l4-3" stroke="' + WOOD + '" stroke-width="1.8" stroke-linecap="round"/>');
    }
    function ember(w) {
        return K.bit(12, 8, w, 0, '<path d="M1 7c0-3 2-5 5-5s5 2 5 5z" fill="#3a2a20"/>' +
            '<path class="kr-season-glow" d="M3.4 6.4c.4-1.6 1.4-2.4 2.6-2.4s2.2.8 2.6 2.4z"/>');
    }
    function spent(w, turn) {
        return K.bit(24, 6, w, turn,
            '<path d="M1 3h22" stroke="#8d939a" stroke-width="1.2" stroke-linecap="round"/>' +
            '<path d="M12 3h11" stroke="#2a2a2a" stroke-width="2.2" stroke-linecap="round"/>');
    }

    // A rocket on its stick, flying right, sparks streaming from its tail.
    var ROCKET = svg('kr-season-flyer__body', '0 0 96 24',
        '<path class="kr-season-flyer__trail" d="M0 12l40-3.4v6.8z" fill="' + SPARK + '" fill-opacity=".45"/>' +
        '<path class="kr-season-flyer__trail" d="M22 12l20-2v4z" fill="#ff8a3d"/>' +
        '<path d="M44 13h34v1.4H44z" fill="#c9a26b"/>' +
        '<path d="M58 7h24v6H58z" fill="#d9472b" stroke="#7a1f10" stroke-width=".8"/>' +
        '<path d="M66 7h3v6h-3z" fill="#f6c34a"/>' +
        '<path d="M82 6.6L90 10l-8 3.4z" fill="#2f4a8a"/>');

    var BONFIRE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<path d="M12 1c1.4 3 4.6 4.6 5.4 8.4.6 3-.4 5.6-2 7.2.4-1.6 0-2.8-.8-3.6 0 1.6-.8 2.8-2.4 3.6.4-1.2 0-2.4-.8-3.2' +
        '-.8 1.2-2.4 2-2.8 3.6-1.6-1.6-2.4-4-1.6-6.4.4-2 2-3.2 2.4-5.2.8 1.2 1.2 2 1.2 3.2.8-2 1.6-4 1.4-7.6z" fill="#ef6a1f"/>' +
        '<path d="M12 8c.8 2 2.8 3.2 2.8 5.6 0 1.6-.8 2.8-1.6 3.6 0-1.2-.4-2-1.2-2.4-.4 1.2-1.2 2-2.4 2.4-.8-1.2-1.2-2.4-.8-3.6.4-1.6 1.6-2.4 2-3.6.4.8.8 1.2.8 2 .4-1.2.4-2.4.4-4z" fill="#ffc53d"/>' +
        '<path d="' + bar(2, 22, 20, -12, 2.6) + bar(22, 22, 20, -168, 2.6) + '" fill="#6b4423"/></svg>';

    // A small rocket crossing the moon, nose up and to the right.
    var MOON_ROCKET = bar(8, 17, 8, -45, 2.4) + 'M14.6 10.1l3.2-1.6-1.6 3.2z' + bar(5, 20, 5, -45, 0.8);

    // A barrel of gunpowder with its fuse lit, for London.
    var POWDER_KEG = svg('kr-season-badge__body', '0 0 22 24',
        '<path d="M5 7c-1.2 5-1.2 10 0 15h12c1.2-5 1.2-10 0-15z" fill="#8a5a32" stroke="#3a2412" stroke-width="1"/>' +
        '<path d="M4.4 10.6h13.2M4.4 18.4h13.2" stroke="#3a2412" stroke-width="1.6"/>' +
        '<ellipse cx="11" cy="7" rx="6" ry="1.8" fill="#c99b6a" stroke="#3a2412" stroke-width=".8"/>' +
        '<path d="M11 7c0-2 1.6-3 3-4" fill="none" stroke="#3a2412" stroke-width="1"/>' +
        '<path d="' + rays(14.6, 2.6, 2.6, 8, 0.7) + '" fill="#ffb347"/>');

    // The tip of the fuse: a spark that fizzes (style.css flickers it).
    var FIZZ = svg('kr-season-track__fizz', '0 0 16 16',
        '<path d="' + rays(8, 8, 7.6, 12, 0.8) + '" fill="' + SPARK + '"/>' +
        '<circle cx="8" cy="8" r="2.4" fill="#fff6d8"/>');

    /* Sparks after the pointer over the homepage hero, the way a sparkler
       writes in the dark: each move throws a few streaks that fall and
       fade within a second. One canvas over the hero, drawing only while
       sparks are in the air; never under reduced motion. */
    function sparkler(kit) {
        var hero = document.querySelector('.welcome-area');
        if (kit.reduced || !hero || hero.querySelector('.kr-season-sparkler') || !window.requestAnimationFrame) return;
        var COLOURS = ['#fff6d0', '#ffe28a', '#ffd34d', '#ffb347', '#ff8a3d'];
        var canvas = null, ctx = null;
        var sparks = [], frame = 0, last = 0, w = 0, h = 0, head = null;

        function size() {
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = hero.clientWidth; h = hero.clientHeight;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        // The canvas is made at the first stroke, not before: a hero the
        // reader never draws over costs nothing.
        function paper() {
            canvas = document.createElement('canvas');
            canvas.className = 'kr-season-sparkler';
            canvas.setAttribute('aria-hidden', 'true');
            hero.appendChild(canvas);
            ctx = canvas.getContext('2d');
            size();
            if (window.ResizeObserver) new ResizeObserver(size).observe(hero);
        }

        hero.addEventListener('pointermove', function (e) {
            if (!canvas) paper();
            var r = hero.getBoundingClientRect();
            var x = e.clientX - r.left, y = e.clientY - r.top;
            head = { x: x, y: y, age: 0 };
            for (var i = 0; i < 4 && sparks.length < 180; i++) {
                var a = Math.random() * Math.PI * 2, v = 50 + Math.random() * 130;
                sparks.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, age: 0,
                    life: 0.3 + Math.random() * 0.5, colour: COLOURS[(Math.random() * COLOURS.length) | 0] });
            }
            if (!frame) { last = 0; frame = requestAnimationFrame(tick); }
        }, { passive: true });

        function tick(now) {
            var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
            last = now;
            ctx.clearRect(0, 0, w, h);
            ctx.lineCap = 'round';
            sparks = sparks.filter(function (s) {
                s.age += dt;
                var left = 1 - s.age / s.life;
                if (left <= 0) return false;
                s.vy += 160 * dt;
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                ctx.globalAlpha = left;
                ctx.strokeStyle = s.colour;
                ctx.lineWidth = 1.3;
                ctx.beginPath();
                ctx.moveTo(s.x, s.y);
                ctx.lineTo(s.x - s.vx * 0.035, s.y - s.vy * 0.035);
                ctx.stroke();
                return true;
            });
            // The burning tip, bright where the pointer is, fading once it stops.
            if (head) {
                head.age += dt;
                var glow = 1 - head.age / 0.35;
                if (glow > 0) {
                    ctx.globalAlpha = glow;
                    ctx.fillStyle = '#fff6d8';
                    ctx.shadowColor = '#ffd34d';
                    ctx.shadowBlur = 14;
                    ctx.beginPath();
                    ctx.arc(head.x, head.y, 2.6, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                } else head = null;
            }
            ctx.globalAlpha = 1;
            frame = sparks.length || head ? requestAnimationFrame(tick) : 0;
        }
    }

    // For the margins of a post: sparks and embers off the fire.
    var SPARK_24 = K.star(12, 12, 10, 8, 0.25), EMBER_24 = K.star(12, 12, 9, 4, 0.5);

    K.dress({
        backdrop: { shapes: [SPARK_24, EMBER_24], colours: ['#ffb347', '#ff8a3d', '#ffd34d', '#e0662a'] },
        // The ribbon's card (season.js, ribbon).
        about: { short: 'Bonfire Night', when: '5 November',
            text: 'On 5 November 1605 Guy Fawkes was caught in a cellar under the House of Lords with 36 barrels of gunpowder, part of a plot to blow up King James I and Parliament. Bonfires were lit that night for the king\'s escape, and they\'ve been lit every year since.',
            link: 'https://en.wikipedia.org/wiki/Guy_Fawkes_Night' },
        corner: wheelArt, dangler: TOFFEE_APPLE,
        // Busier than Hogmanay's and hotter: a back garden display, crisp sparks.
        leaves: { kind: 'fireworks', colours: FIREWORK_COLOURS, per1000: 0, shapes: [K.DOT], rate: 1.5, glow: false },
        // The bonfire crackles, the rocket goes up, the sparkler fizzes.
        patch: [{ art: BONFIRE, size: 'big', sound: 'fire' },
                { art: SPARKLER, size: 'small', sound: 'sparkler' },
                { art: ROCKET_BOTTLE, size: 'mid', sound: 'fireworks' }],
        strew: [stick(22, -8), ember(12), spent(20, 12), stick(18, 20), ember(10)],
        puff: 'kr-season-puff--scatter kr-season-puff--cinders',
        flyer: ROCKET, flight: 'kr-season-flyer--rocket',
        favicon: BONFIRE_ICON, moonmark: MOON_ROCKET,
        // A fuse along the top of a post, burning down to the reader.
        track: { kind: 'fuse', mode: 'burn', tip: FIZZ },
        // Westminster, where the gunpowder was found.
        map: { places: ['London'], badge: POWDER_KEG },
        lost: {
            title: 'This Page Went Up in Smoke',
            lede: 'Remember, remember the fifth of November. Nobody remembered this page, ' +
                'and whatever was here went on the bonfire.',
            caption: "While the embers cool, have one of my photographs. "
        },
        extra: sparkler,
        // An ember pointer with a flame at its tail.
        cursor: K.cursor('#ff9550', '<path fill="#ffc53d" stroke="#7a2a08" stroke-width=".7" d="M6 .4c1.2 2 3.6 3.2 3.6 6.2a3.6 3.6 0 0 1-7.2 0c0-1.8 1.2-2.6 1.6-4 .6.8.8 1.4.8 2.2.6-1.4 1.2-2.6 1.2-4.4z"/>', '#4a1d06')
    });
})();
