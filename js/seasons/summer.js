/**
 * seasons/summer.js: summer's art for js/season.js (see that file for the
 * pieces): a leafy branch with cherries and a tyre swing on its rope,
 * dandelion seeds rising in the light theme and fireflies in the dark,
 * sunflowers, a sandcastle and a jar of fireflies in place of the
 * pumpkins among grass, daisies and a shell, a dragonfly, a sun favicon,
 * a sunbeam that reaches as far as the reader has, a warm haze in the
 * light theme, suns on the sunniest places, a 404 page that has gone on
 * holiday. Its own:
 *   - the footer's visitors, by the reader's own clock: by day a monarch
 *     comes down to the sunflowers and flies off when the pointer comes
 *     near; after dark, fireflies blink over the footer
 *   - a beach ball resting on the footer's top edge: a click kicks it,
 *     and it rolls and bounces along the edge, off the patch and the
 *     footer's end, until it comes to rest. Under reduced motion it sits
 *     still and takes no clicks.
 *
 * Classes only this file applies (css/seasons/summer.css):
 * .kr-season-pumpkin, .kr-season-glow, .kr-season-dangler__body,
 * .kr-season-dangler--swing, .kr-season-flyer__body,
 * .kr-season-flyer__wing (--l, --r), .kr-season-track__sun,
 * .kr-season-badge__body, .kr-season-butterfly (--gone, __wing, __wing--l,
 * __wing--r), .kr-season-fireflies (__fly), .kr-season-ball (__shadow,
 * __body, __spin).
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg, bar = K.bar, leafAt = K.leafAt, OVAL = K.OVAL;

    var GREEN = '#4f9a3a', DARK_GREEN = '#3c7a2c';

    /* A sun of radius r about (cx, cy) as one filled path: a disc and
       `rays` short rays standing off it. */
    function sunPath(cx, cy, r, rays) {
        var d = 'M' + (cx - r) + ' ' + cy + 'a' + r + ' ' + r + ' 0 1 0 ' + (r * 2) + ' 0a' + r + ' ' + r + ' 0 1 0 ' + (-r * 2) + ' 0z';
        for (var i = 0; i < rays; i++) {
            var deg = i * 360 / rays, a = deg * Math.PI / 180;
            d += bar(cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 1.3, r * 0.55, deg, r * 0.28);
        }
        return d;
    }

    /* A dandelion seed rising on the canvas's 24 x 24 box: the fine
       parachute, the stalk, the seed. */
    function seedPath() {
        var d = '';
        for (var deg = -165; deg <= -15; deg += 18.75) d += bar(12, 9, 8, deg, 0.9);
        return d + bar(12, 9, 11, 90, 0.9) + 'M10.9 21a1.1 2 0 1 0 2.2 0a1.1 2 0 1 0-2.2 0z';
    }

    // Light theme: seeds drifting up on warm air. Dark: fireflies. The
    // engine swaps them when the theme changes.
    var LEAVES = {
        light: { kind: 'rise', colours: ['#ffffff', '#fdf8e8', '#f6efd6'], per1000: 9, shapes: [seedPath()],
            tumble: false, size: [18, 28] },
        dark: { kind: 'twinkle', colours: ['#f4ff8a', '#fff3a3', '#d8ff70'], per1000: 12, shapes: [K.DOT],
            glow: true, size: [11, 17] }
    };

    // A pair of cherries on their stalks, hanging from (x, y).
    function cherries(x, y) {
        return '<path d="M' + x + ' ' + y + 'c-1 3-2.6 6-4 9M' + x + ' ' + y + 'c.6 3 2 6.4 3.4 10" fill="none" stroke="#5a7a2a"' +
            ' stroke-width=".9" stroke-linecap="round"/>' +
            '<circle cx="' + (x - 4.2) + '" cy="' + (y + 10.6) + '" r="2.8" fill="#9e1b38" stroke-width=".4"/>' +
            '<circle cx="' + (x + 3.6) + '" cy="' + (y + 11.8) + '" r="2.8" fill="#b8243f" stroke-width=".4"/>' +
            '<circle cx="' + (x - 5.1) + '" cy="' + (y + 9.6) + '" r=".8" fill="#ffffff" fill-opacity=".7" stroke="none"/>' +
            '<circle cx="' + (x + 2.7) + '" cy="' + (y + 10.8) + '" r=".8" fill="#ffffff" fill-opacity=".7" stroke="none"/>';
    }

    // The branch in full leaf, two pairs of cherries hanging from it.
    function branchArt() {
        return '<path d="' + K.TWIG + '"' +
            ' fill="none" stroke-width="2.2" stroke-linecap="round"/>' +
            leafAt(OVAL, GREEN, 54, 12, 160, 0.6) + leafAt(OVAL, DARK_GREEN, 40, 24, 200, 0.6) +
            leafAt(OVAL, '#6cb44a', 35, 7, -60, 0.55) + leafAt(OVAL, GREEN, 13, 18, -80, 0.6) +
            leafAt(OVAL, DARK_GREEN, 16, 34, 220, 0.55) + leafAt(OVAL, '#6cb44a', 4, 48, 190, 0.5) +
            cherries(31, 17) + cherries(46, 24);
    }

    // A tyre swing on its rope, the tread in the season's creature colour.
    var SWING = svg('kr-season-dangler__body', '0 0 20 20',
        '<path fill-rule="evenodd" d="M10 4.4a7.2 7.2 0 1 0 .01 0zM10 8.4a3.2 3.2 0 1 1-.01 0z"/>' +
        '<path d="M10 0v5.4" stroke="#8a6a44" stroke-width="1.2"/>');

    /* A dragonfly from above, flying right: a long tail, two pairs of
       glassy wings that whirr, a big-eyed head. */
    var DRAGONFLY = svg('kr-season-flyer__body', '0 0 64 32',
        '<g class="kr-season-flyer__wing kr-season-flyer__wing--l">' +
        '<path d="M43 14.6C41.6 8 38.6 2.4 33.6 1.2c-1.6 2.2-.4 8.4 7.6 13.6z"/>' +
        '<path d="M39.8 14.8C34.4 9.6 28.4 6.6 23.2 7c-.6 2.2 4 6.4 15.6 8.6z"/></g>' +
        '<g class="kr-season-flyer__wing kr-season-flyer__wing--r">' +
        '<path d="M43 17.4c-1.4 6.6-4.4 12.2-9.4 13.4-1.6-2.2-.4-8.4 7.6-13.6z"/>' +
        '<path d="M39.8 17.2c-5.4 5.2-11.4 8.2-16.6 7.8-.6-2.2 4-6.4 15.6-8.6z"/></g>' +
        '<path d="M5 16c0-.7.5-1 1.2-1H37v2H6.2C5.5 17 5 16.7 5 16z"/>' +
        '<ellipse cx="41" cy="16" rx="4.4" ry="2.8"/>' +
        '<circle cx="47" cy="14.3" r="2.1"/><circle cx="47" cy="17.7" r="2.1"/>');

    /* Sunflowers: two heads on tall stalks with broad leaves. */
    function sunflower(x, y, r, squash) {
        return '<g transform="translate(' + x + ' ' + y + ') scale(' + (squash || 1) + ' 1)">' +
            '<path d="' + K.star(0, 0, r, 16, 0.6) + '" fill="#f6c026" stroke="#d99a12" stroke-width=".5" stroke-linejoin="round"/>' +
            '<circle r="' + (r * 0.48) + '" fill="#6b3f1d"/>' +
            '<circle r="' + (r * 0.3) + '" fill="#4a2a12"/></g>';
    }

    var SUNFLOWERS = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M24 25c-1 12 1 22 0 31M46 32c1 9-1 16 0 24" fill="none" stroke="' + DARK_GREEN +
        '" stroke-width="2.4" stroke-linecap="round"/>' +
        '<path d="M24 40c-4-5-11-6-15-3 4 4 10 5 15 3zM24 33c4-4 10-4 13-1-3 3-9 4-13 1zM46 44c4-4 10-4 13-1-3 3-9 4-13 1z"' +
        ' fill="' + GREEN + '"/>' +
        sunflower(24, 15, 12) + sunflower(46, 25, 8.5, 0.86));

    // A sandcastle with a flag, and a pail beside it.
    var SANDCASTLE = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M2 56c4-5 40-5 44 0z" fill="#d8b46a"/>' +
        '<path d="M8 54V25h2.6v-3h2.4v3h2.4v-3h2.4v3H20v29zM29 54V25h2.6v-3H34v3h2.4v-3h2.4v3h2.6v29z" fill="#e3c27a"/>' +
        '<path d="M18 54V33h2.4v-3h2.6v3h2.4v-3h2.4v3h2.6v21z" fill="#ecd08e"/>' +
        '<path d="M21 54v-8a3.5 3.5 0 0 1 7 0v8z" fill="#a8843f"/>' +
        '<path d="M8 40h12M29 40h12.6M18 44h11.4" stroke="#c9a45e" stroke-width="1"/>' +
        '<path d="M35 22V9" stroke="#7a5a2a" stroke-width="1"/><path d="M35 9l7 2.5-7 2.5z" fill="#3d8fd1"/>' +
        '<path d="M46 40h15l-2.2 15h-10.6z" fill="#3d8fd1"/><path d="M45.4 39h16.2v2.6H45.4z" fill="#2f74ad"/>' +
        '<path d="M47.6 40c0-6 11.8-6 11.8 0" fill="none" stroke="#2f74ad" stroke-width="1.1"/>');

    // A jar of fireflies, glowing (.kr-season-glow flickers them).
    var JAR = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M18 16h28v4c3 2 4 5 4 9v20c0 4-2 6-6 6H20c-4 0-6-2-6-6V29c0-4 1-7 4-9z" fill="#dff1ea" fill-opacity=".3"' +
        ' stroke="#8fb3a6" stroke-width="1.6"/>' +
        '<path d="M17 8h30v8H17z" fill="#a0a7ab" stroke="#6f777b" stroke-width="1"/>' +
        '<path d="M17 10.6h30M17 13.4h30" stroke="#6f777b" stroke-width=".7"/>' +
        '<path d="M19 25c-1 6-1 16 0 24" stroke="#ffffff" stroke-opacity=".6" stroke-width="1.6" stroke-linecap="round" fill="none"/>' +
        '<circle cx="28" cy="31" r="5.5" fill="#e6ff7a" fill-opacity=".18"/><circle cx="37" cy="41" r="5" fill="#e6ff7a" fill-opacity=".16"/>' +
        '<path class="kr-season-glow" d="M26 31a2 2 0 1 0 4 0a2 2 0 1 0-4 0zM35.2 41a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0-3.6 0z' +
        'M38.4 27a1.5 1.5 0 1 0 3 0a1.5 1.5 0 1 0-3 0zM24.6 46a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0-3.2 0z"/>');

    // Grass, daisies and a shell for between the pieces.
    function strewn(w, body) {
        return K.bit(24, 24, w, 0, body);
    }
    var TUFT = '<path d="M5 24c1-6 0-10-3-14 4 3 6 8 6 14zM10 24c0-8 1-14 4-19-1 6-1 13 0 19zM16 24c1-5 3-9 7-11-3 3-4 7-4 11z"' +
        ' fill="' + GREEN + '"/>';
    var DAISY = '<path d="M12 13v11" stroke="' + DARK_GREEN + '" stroke-width="1.6"/>' +
        '<path d="' + K.star(12, 9, 8.5, 12, 0.45) + '" fill="#ffffff" stroke="#c9c2b4" stroke-width=".5" stroke-linejoin="round"/>' +
        '<circle cx="12" cy="9" r="2.4" fill="#f2c230"/>';
    var SHELL = '<path d="M12 22L3 12c0-6 4-9 9-9s9 3 9 9z" fill="#f0d2b4" stroke="#c49a74" stroke-width=".8"/>' +
        '<path d="M12 22V4M12 22L7 5.4M12 22l5-16.6M12 22L4.2 8.6M12 22l7.8-13.4" stroke="#c49a74" stroke-width=".7"/>';

    var SUN_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<path d="' + sunPath(12, 12, 5.6, 8) + '" fill="#f5a614"/>' +
        '<circle cx="12" cy="12" r="4.4" fill="#ffd34d"/></svg>';

    var MAP_SUN = svg('kr-season-badge__body', '0 0 24 24', '<path d="' + sunPath(12, 12, 5.4, 8) + '"/>');

    // The sunbeam's tip, a small sun that turns.
    var SUN_TIP = svg('kr-season-track__sun', '0 0 24 24',
        '<path d="' + sunPath(12, 12, 5.2, 8) + '" fill="#f5a614"/><circle cx="12" cy="12" r="4.2" fill="#ffd34d"/>');

    // A monarch, from above, wings open.
    var WING = 'M15.4 11.6C12.6 4.8 6.4 1.4 2.6 2.6.8 3.4 1.4 7.6 4.6 10.4c-2.6 1.4-3.4 4.4-1.8 6.6 2 2.4 7 1.2 12.6-5.4z';
    var MONARCH = svg('', '0 0 32 24',
        '<g class="kr-season-butterfly__wing kr-season-butterfly__wing--l"><path d="' + WING + '" fill="#e8811c"' +
        ' stroke="#1e1a17" stroke-width="1.2" stroke-linejoin="round"/>' +
        '<path d="M14.6 11C10 9 6.4 6.6 4 4M14.6 11.4C10.4 11.6 6.6 13.6 4.2 15.6" stroke="#1e1a17" stroke-width=".7" fill="none"/>' +
        '<circle cx="3.4" cy="4.2" r=".55" fill="#fff"/><circle cx="2.6" cy="6.4" r=".5" fill="#fff"/>' +
        '<circle cx="3.2" cy="15.4" r=".5" fill="#fff"/></g>' +
        '<g transform="translate(32 0) scale(-1 1)"><g class="kr-season-butterfly__wing kr-season-butterfly__wing--r">' +
        '<path d="' + WING + '" fill="#e8811c" stroke="#1e1a17" stroke-width="1.2" stroke-linejoin="round"/>' +
        '<path d="M14.6 11C10 9 6.4 6.6 4 4M14.6 11.4C10.4 11.6 6.6 13.6 4.2 15.6" stroke="#1e1a17" stroke-width=".7" fill="none"/>' +
        '<circle cx="3.4" cy="4.2" r=".55" fill="#fff"/><circle cx="2.6" cy="6.4" r=".5" fill="#fff"/>' +
        '<circle cx="3.2" cy="15.4" r=".5" fill="#fff"/></g></g>' +
        '<ellipse cx="16" cy="12.4" rx="1.1" ry="6" fill="#1e1a17"/>' +
        '<path d="M15.6 6.8l-1.6-3.4M16.4 6.8l1.6-3.4" stroke="#1e1a17" stroke-width=".6"/>');

    /* The footer's visitors, once it is in view, by the reader's clock.
       By day (5am to 8pm) a monarch flutters down to the big sunflower,
       opens and closes its wings there, and flies off when the pointer
       comes to the sunflowers. After dark, fireflies drift and blink
       over the footer. The tyre swing sways meanwhile. None of it under
       reduced motion. */
    function visitors(kit) {
        if (kit.reduced) return;
        Array.prototype.forEach.call(document.querySelectorAll('.kr-season-dangler'), function (s) {
            s.classList.add('kr-season-dangler--swing');
        });
        kit.onFooter(function (footer) {
            var hour = new Date().getHours();
            if (hour >= 20 || hour < 5) fireflies(footer);
            else monarch(footer);
        });
    }

    function monarch(footer) {
        var flower = footer.querySelector('.kr-season-patch__big');
        if (!flower) return;
        var el = document.createElement('span');
        el.className = 'kr-season-butterfly';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = MONARCH;
        flower.appendChild(el);
        function off() {
            // Off from where it is, even if it has not landed yet.
            el.style.setProperty('--kr-season-from', getComputedStyle(el).transform);
            el.classList.add('kr-season-butterfly--gone');
        }
        footer.querySelector('.kr-season-patch').addEventListener('pointerenter', off);
        el.addEventListener('animationend', function (e) {
            if (e.target === el && e.animationName === 'kr-season-flit-off') el.remove();
        });
    }

    function fireflies(footer) {
        var el = document.createElement('div');
        el.className = 'kr-season-fireflies';
        el.setAttribute('aria-hidden', 'true');
        var html = '';
        for (var i = 0; i < 12; i++) {
            html += '<span class="kr-season-fireflies__fly" style="left: ' + (6 + Math.random() * 88).toFixed(1) + '%;' +
                ' top: ' + (12 + Math.random() * 70).toFixed(1) + '%; animation-delay: -' + (Math.random() * 9).toFixed(1) +
                's, -' + (Math.random() * 6).toFixed(1) + 's; animation-duration: ' + (9 + Math.random() * 7).toFixed(1) +
                's, ' + (4 + Math.random() * 4).toFixed(1) + 's"></span>';
        }
        el.innerHTML = html;
        footer.appendChild(el);
    }

    /* ---------------------------------------------------------------- *
     * Its own: a beach ball on the footer's edge
     * ---------------------------------------------------------------- */

    /* A beach ball seen from its pole on a 32 x 32 box: six curved gores
       about a white cap (__spin, turned by script as it rolls), with a
       shine and its rim over them that stay put. */
    function ballArt() {
        var gores = ['#e8453c', '#ffffff', '#f6c026', '#ffffff', '#2f86d6', '#ffffff'], body = '';
        function at(a, r) { return K.fix(16 + Math.cos(a) * r) + ' ' + K.fix(16 + Math.sin(a) * r); }
        for (var i = 0; i < 6; i++) {
            var a0 = i * Math.PI / 3, a1 = a0 + Math.PI / 3;
            // Each gore's edges bow the same way, so the ball reads as turning.
            body += '<path d="M16 16Q' + at(a0 + 0.5, 8) + ' ' + at(a0, 15) + 'A15 15 0 0 1 ' + at(a1, 15) + 'Q' +
                at(a1 + 0.5, 8) + ' 16 16z" fill="' + gores[i] + '"/>';
        }
        return '<svg class="kr-season-ball__body" viewBox="0 0 32 32" aria-hidden="true" focusable="false">' +
            '<g class="kr-season-ball__spin">' + body + '<circle cx="16" cy="16" r="3.2" fill="#ffffff" stroke="#d8d2c4"' +
            ' stroke-width=".6"/></g>' +
            '<ellipse cx="11" cy="9.6" rx="5.6" ry="3.2" transform="rotate(-35 11 9.6)" fill="#ffffff" fill-opacity=".45"/>' +
            '<circle cx="16" cy="16" r="15" fill="none" stroke="#5a4a3a" stroke-opacity=".55" stroke-width=".9"/></svg>';
    }

    /* The ball rests on the footer's top edge, right of the patch (or
       anywhere along it, where the patch leaves too little room). A
       click kicks it away from the side it was struck on, with a little
       hop: it rolls, bounces off the patch and the footer's end, and
       comes to rest. One frame loop, only while it moves; the room is
       measured when the footer's size changes and the ball when it is
       kicked, never per frame. Under reduced motion it sits still and
       takes no clicks. */
    var GRAVITY = 1500, HOP = 0.45, WALL = 0.55;
    function beachBall(kit) {
        var footer = document.querySelector('.kr-footer');
        if (!footer || footer.querySelector('.kr-season-ball')) return;
        var el = document.createElement('span');
        el.className = 'kr-season-ball';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<span class="kr-season-ball__shadow"></span>' + ballArt();
        footer.appendChild(el);
        var body = el.lastChild, spin = body.firstChild, shadow = el.firstChild;
        var lo = 0, hi = 0, size = 28, x = -1, y = 0, vx = 0, vy = 0, turn = 0, frame = 0, last = 0;

        function room() {
            var f = footer.getBoundingClientRect(), patch = footer.querySelector('.kr-season-patch');
            size = body.getBoundingClientRect().width || size;
            var from = patch ? patch.getBoundingClientRect().right - f.left + 4 : 8;
            hi = Math.max(8, f.width - size - 10);
            lo = hi - from > size * 4 ? from : 8;
            x = x < 0 ? lo + (hi - lo) * 0.62 : Math.max(lo, Math.min(hi, x));
            draw();
        }

        function draw() {
            el.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
            body.style.transform = 'translateY(' + (-y).toFixed(1) + 'px)';
            spin.style.transform = 'rotate(' + turn.toFixed(1) + 'deg)';
            shadow.style.transform = 'scale(' + Math.max(0.4, 1 - y / 40).toFixed(2) + ')';
        }

        function tick(now) {
            frame = 0;
            var dt = last ? Math.min(0.033, (now - last) / 1000) : 0.016;
            last = now;
            vy -= GRAVITY * dt;
            y += vy * dt;
            if (y <= 0) {
                y = 0;
                // A hop that lands hard bounces; a soft one stays down.
                vy = vy < -90 ? -vy * HOP : 0;
                vx *= 0.9;
            }
            x += vx * dt;
            if (x < lo) { x = lo; vx = -vx * WALL; } else if (x > hi) { x = hi; vx = -vx * WALL; }
            if (!y && !vy) {
                // Rolling: it loses most of its speed each second, and a
                // little more besides, so it comes to a stop.
                vx *= Math.pow(0.3, dt);
                vx -= Math.sign(vx) * Math.min(Math.abs(vx), 50 * dt);
            }
            turn = (turn + vx * dt / (size / 2) * 57.3) % 360;
            draw();
            if (!y && !vy && Math.abs(vx) < 4) { last = 0; return; }
            frame = requestAnimationFrame(tick);
        }

        room();
        if (window.ResizeObserver) new ResizeObserver(function () { room(); }).observe(footer);
        if (kit.reduced) return;
        body.addEventListener('click', function (e) {
            var r = body.getBoundingClientRect(), off = e.clientX - (r.left + r.width / 2);
            var away = Math.abs(off) < r.width * 0.08 ? (Math.random() < 0.5 ? -1 : 1) : (off < 0 ? 1 : -1);
            vx = away * (360 + Math.random() * 240) + vx * 0.3;
            // Low enough that the ball stays in the band above the footer.
            vy = Math.max(vy, 170 + Math.random() * 80);
            if (!frame) { last = 0; frame = requestAnimationFrame(tick); }
        });
    }

    K.dress({
        // The seeds in both themes: the night's fireflies are dots.
        backdrop: { shapes: LEAVES.light.shapes, colours: ['#fff3c4', '#ffe9a0', '#f6efd6'] },
        corner: branchArt, dangler: SWING,
        leaves: LEAVES,
        // The sunflowers hum with cicadas, the sandcastle has the lake
        // lapping at it, the jar of fireflies has crickets about it.
        patch: [{ art: SUNFLOWERS, size: 'big', sound: 'cicadas' },
                { art: JAR, size: 'small', sound: 'crickets' },
                { art: SANDCASTLE, size: 'mid', sound: 'waves' }],
        strew: [strewn(18, TUFT), strewn(14, DAISY), strewn(13, SHELL), strewn(15, TUFT), strewn(12, DAISY)],
        puff: 'kr-season-puff--scatter kr-season-puff--pollen',
        flyer: DRAGONFLY, flight: 'kr-season-flyer--dart',
        favicon: SUN_ICON, moonmark: sunPath(14, 11, 2.2, 8),
        // A beam of sunlight as far as the reader has come, the sun at its tip.
        track: { kind: 'sunbeam', mode: 'fill', tip: SUN_TIP },
        map: { tag: 'summer', min: 3, share: 0.05, badge: MAP_SUN },
        lost: {
            title: 'This Page Has Gone on Holiday',
            lede: 'Whatever lived at this address packed the car and went up north to the lake. ' +
                'It left no forwarding address.',
            caption: "While it's away, have one of my summer photographs. "
        },
        cursor: K.cursor('#f7c843', '<path fill="#f39c12" stroke="#7a4a05" stroke-width=".6" d="' + sunPath(6, 6, 2.9, 8) + '"/>' +
            '<circle cx="6" cy="6" r="2.3" fill="#ffd34d"/>', '#5a3a05'),
        extra: function (kit) {
            visitors(kit);
            beachBall(kit);
        }
    });
})();
