/**
 * seasons/hogmanay.js: Hogmanay's art for js/season.js (see that file for
 * the pieces), with nothing of Christmas in it: a clock at five to
 * midnight with a lump of coal on a string, fireworks in gold and silver
 * over the openers, the first foot's gifts on the footer (a tartan tin of
 * shortbread, black bun, a lump of coal), a shooting star, a firework
 * favicon, footprints that cross the top of a post as the reader does, no
 * fog, a burst over each place that sees the new year in with fireworks,
 * a 404 page that missed the Bells. Its own: the corner clock keeps the
 * reader's time, and on the homepage a line counts down to the Bells (the
 * reader's midnight), which bursts when it comes; on 1 and 2 January it
 * says which year it is.
 *
 * Classes only this file applies (css/seasons/hogmanay.css):
 * .kr-season-pumpkin, .kr-season-dangler__body, .kr-season-flyer__body,
 * .kr-season-flyer__trail, .kr-season-badge__body, .kr-season-glint,
 * .kr-season-hand (--hour, --minute), .kr-season-clock--chime,
 * .kr-season-bells (--rung, --final), .kr-season-bells__text,
 * .kr-season-bells__burst.
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg, star = K.star, bar = K.bar;

    // Night blue, gold, champagne, silver, ice blue, lilac.
    var NIGHT = '#1d2a4a', GOLD = '#f2c14e';
    var FIREWORK_COLOURS = ['#ffd36e', '#fff1c4', '#e9eef9', '#9cc4ff', '#c9b8ff', '#f5b94a'];
    var COAL = '#2e323c', COAL_FACE = '#565e6e', COAL_EDGE = '#8b94a6';

    // The clock's centre on the corner's 64 x 64 box, and its hands' turns
    // at five to midnight (season.js draws it before the extra sets the time).
    var CX = 36, CY = 25;

    /* A wall clock hung from the top edge on a short cord, its face cream
       with twelve marks, a gold rim, two hands and a sparkle beside it. */
    function clockArt() {
        var marks = '';
        for (var i = 0; i < 12; i++) {
            var long = i % 3 === 0;
            var a = i * 30 - 90, rad = a * Math.PI / 180;
            var r0 = long ? 13.4 : 15;
            marks += bar(CX + Math.cos(rad) * r0, CY + Math.sin(rad) * r0, long ? 3.6 : 2, a, long ? 1.5 : 0.9);
        }
        return '<path d="M' + CX + ' 0V5" fill="none" stroke-width="1.4"/>' +
            '<circle cx="' + CX + '" cy="' + CY + '" r="19.6" fill="#fbf3dc" stroke="#c99a2e" stroke-width="2.6"/>' +
            '<circle cx="' + CX + '" cy="' + CY + '" r="17.2" fill="none" stroke="#e6cf8f" stroke-width=".6"/>' +
            '<path d="' + marks + '" fill="' + NIGHT + '" stroke="none"/>' +
            '<path class="kr-season-hand kr-season-hand--hour" d="M' + CX + ' ' + (CY + 2) + 'V' + (CY - 10) + '"' +
            ' transform="rotate(357.5 ' + CX + ' ' + CY + ')" fill="none" stroke="' + NIGHT + '" stroke-width="2.4" stroke-linecap="round"/>' +
            '<path class="kr-season-hand kr-season-hand--minute" d="M' + CX + ' ' + (CY + 3) + 'V' + (CY - 15) + '"' +
            ' transform="rotate(330 ' + CX + ' ' + CY + ')" fill="none" stroke="' + NIGHT + '" stroke-width="1.4" stroke-linecap="round"/>' +
            '<circle cx="' + CX + '" cy="' + CY + '" r="1.8" fill="#c99a2e" stroke="none"/>' +
            '<path class="kr-season-glint" d="' + star(9, 12, 5, 4, 0.28) + star(15, 44, 3.4, 4, 0.28) + '" fill="' + GOLD + '" stroke="none"/>';
    }

    // A lump of coal on the string, faceted, with a gold glint.
    var COAL_LUMP = svg('kr-season-dangler__body', '0 0 20 20',
        '<path d="M5 5.5l6-2.2 5.2 3 1.6 6.4-3.4 5.2-7.2.8L2.6 14 2 8.6z" fill="' + COAL + '" stroke="' + COAL_EDGE + '" stroke-width=".7" stroke-linejoin="round"/>' +
        '<path d="M5 5.5l6-2.2 1.6 5.4-5.4 2.2zM12.6 8.7l3.6-2.4 1.6 6.4-4.6-.6z" fill="' + COAL_FACE + '"/>' +
        '<path d="' + star(8.6, 6.8, 2.2, 4, 0.25) + '" fill="' + GOLD + '"/>');

    /* The first foot's gifts, on the pumpkins' 64 x 56 box. A tin of
       shortbread in a blue and green tartan, its lid propped behind and
       three fingers standing out of it. */
    function shortbreadTin() {
        var finger = function (x, y, turn) {
            return '<g transform="rotate(' + turn + ' ' + x + ' ' + (y + 14) + ')">' +
                '<rect x="' + (x - 4) + '" y="' + y + '" width="8" height="18" rx="1.6" fill="#ecc985" stroke="#b98a3e" stroke-width=".8"/>' +
                '<path d="M' + (x - 1.4) + ' ' + (y + 4) + 'h.1M' + (x + 1.4) + ' ' + (y + 4) + 'h.1M' + (x - 1.4) + ' ' + (y + 8.5) + 'h.1M' +
                (x + 1.4) + ' ' + (y + 8.5) + 'h.1" stroke="#b98a3e" stroke-width="1.2" stroke-linecap="round"/></g>';
        };
        var tartan = '';
        [11, 27, 43].forEach(function (x) {
            tartan += '<rect x="' + x + '" y="27" width="7" height="26" fill="#2f6b4f" fill-opacity=".75"/>' +
                '<rect x="' + (x + 3) + '" y="27" width="1" height="26" fill="' + GOLD + '"/>';
        });
        [31, 43].forEach(function (y) {
            tartan += '<rect x="6" y="' + y + '" width="52" height="6" fill="#2f6b4f" fill-opacity=".6"/>' +
                '<rect x="6" y="' + (y + 2.5) + '" width="52" height="1" fill="' + GOLD + '"/>';
        });
        return svg('kr-season-pumpkin', '0 0 64 56',
            '<g transform="rotate(-14 50 26)"><rect x="18" y="4" width="44" height="22" rx="3" fill="#1f3a6e" stroke="#c99a2e" stroke-width="1.4"/>' +
            '<rect x="24" y="9" width="32" height="12" rx="2" fill="#fbf3dc"/>' +
            '<path d="M28 15h24" stroke="#c99a2e" stroke-width="2.2" stroke-linecap="round"/></g>' +
            finger(22, 12, -10) + finger(32, 9, 0) + finger(42, 12, 9) +
            '<rect x="6" y="26" width="52" height="28" rx="2.5" fill="#1f3a6e"/>' + tartan +
            '<rect x="6" y="26" width="52" height="28" rx="2.5" fill="none" stroke="#c99a2e" stroke-width="1.6"/>' +
            '<rect x="4.5" y="24.5" width="55" height="4" rx="1.5" fill="#c99a2e"/>');
    }

    // A slab of black bun: dark fruit cake in a pastry case, cut to show it.
    var FRUIT = [[15, 32, '#8a4420'], [22, 38, '#c98b3a'], [30, 31, '#6d2f18'], [36, 40, '#c98b3a'], [41, 33, '#8a4420'],
        [18, 43, '#6d2f18'], [27, 44, '#a35a2a'], [44, 43, '#6d2f18'], [33, 35, '#e0b060'], [13, 38, '#a35a2a']];
    var BLACK_BUN = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M6 22c0-5 3-8 8-8h32c5 0 8 3 8 8v28c0 2-1 3-3 3H9c-2 0-3-1-3-3z" fill="#d9a85a" stroke="#9c6a2a" stroke-width="1.2"/>' +
        '<path d="M8 19c1-2.5 3-3.6 6-3.6h32c3 0 5 1.1 6 3.6" fill="none" stroke="#f0cf8e" stroke-width="1.6" stroke-linecap="round"/>' +
        '<rect x="10" y="25" width="40" height="24" rx="2" fill="#3a2016"/>' +
        FRUIT.map(function (f) {
            return '<circle cx="' + f[0] + '" cy="' + f[1] + '" r="1.5" fill="' + f[2] + '"/>';
        }).join('') +
        '<path d="M20 19.6h.1M30 19.6h.1M40 19.6h.1" stroke="#9c6a2a" stroke-width="1.4" stroke-linecap="round"/>' +
        // A slice cut from it, leaning against the end.
        '<g transform="rotate(-9 54 54)"><rect x="47" y="30" width="13" height="24" rx="2" fill="#d9a85a" stroke="#9c6a2a" stroke-width="1"/>' +
        '<rect x="49.5" y="33" width="8" height="18.5" rx="1" fill="#3a2016"/>' +
        '<circle cx="52" cy="37" r="1.3" fill="#c98b3a"/><circle cx="55" cy="42" r="1.3" fill="#8a4420"/>' +
        '<circle cx="52.4" cy="47" r="1.3" fill="#e0b060"/></g>');

    // A lump of coal, bigger, for the footer.
    var COAL_PIECE = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M10 30l12-12 18-2 14 10 4 16-8 10-26 2-14-8z" fill="' + COAL + '" stroke="' + COAL_EDGE + '" stroke-width="1.4" stroke-linejoin="round"/>' +
        '<path d="M22 18l18-2-4 14-16 4zM40 16l14 10-6 8-12-4z" fill="' + COAL_FACE + '"/>' +
        '<path d="M10 30l10 4-2 12-8-2z" fill="#3e4452"/>' +
        '<path class="kr-season-glint" d="' + star(30, 24, 4.6, 4, 0.25) + '" fill="' + GOLD + '"/>');

    // Bits for between the gifts: a shortbread finger, coal, a gold star.
    function finger(w, turn) {
        return K.bit(24, 10, w, turn,
            '<rect x="1" y="1" width="22" height="8" rx="1.6" fill="#ecc985" stroke="#b98a3e" stroke-width=".8"/>' +
            '<path d="M6 5h.1M12 5h.1M18 5h.1" stroke="#b98a3e" stroke-width="1.3" stroke-linecap="round"/>');
    }
    function nugget(w) {
        return K.bit(12, 10, w, 0, '<path d="M1 6l3-4.5 5 .5 2 5-3 2.5H3z" fill="' + COAL + '" stroke="' + COAL_EDGE +
            '" stroke-width=".6" stroke-linejoin="round"/>');
    }
    function sparkle(w) {
        return K.bit(24, 24, w, 0, '<path class="kr-season-glint" d="' + star(12, 12, 11, 4, 0.28) + '" fill="' + GOLD + '"/>');
    }

    // A shooting star going right and a little down, its tail behind it.
    var SHOOTING_STAR = svg('kr-season-flyer__body', '0 0 120 24',
        '<path class="kr-season-flyer__trail" d="M0 11.6L100 9.6v4.8z" fill="#fff1c4" fill-opacity=".35"/>' +
        '<path class="kr-season-flyer__trail" d="M40 11.4L100 10.4v3.2z" fill="#ffd36e" fill-opacity=".6"/>' +
        '<path d="' + star(104, 12, 10, 5, 0.45) + '" fill="#ffd36e" stroke="#c99a2e" stroke-width=".8" stroke-linejoin="round"/>');

    // A burst of twelve rays round a dot, on a 24 x 24 box.
    function burst(r, wide) {
        var d = '';
        for (var i = 0; i < 12; i++) d += bar(12 + Math.cos(i * Math.PI / 6) * r * 0.32, 12 + Math.sin(i * Math.PI / 6) * r * 0.32,
            r * (i % 2 ? 0.5 : 0.68), i * 30, wide);
        return d + 'M10 12a2 2 0 1 0 4 0a2 2 0 1 0-4 0z';
    }

    var BURST_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<circle cx="12" cy="12" r="12" fill="' + NIGHT + '"/>' +
        '<path d="' + burst(11, 1.7) + '" fill="#ffd36e"/></svg>';

    var MAP_BURST = svg('kr-season-badge__body', '0 0 24 24', '<path d="' + burst(12, 1.9) + '"/>');

    // A boot print walking right, the left and right feet at two heights.
    function footprint(i) {
        return svg('', '0 0 12 12', '<g transform="translate(0 ' + (i % 2 ? 2.6 : -0.6) + ')">' +
            '<ellipse cx="8" cy="4.6" rx="3.4" ry="2.2"/><ellipse cx="2.4" cy="4.6" rx="1.7" ry="1.6"/></g>');
    }

    /* ------------------------------------------------------------------ *
     * The Bells: the corner clock keeps time, and the homepage counts down
     * ------------------------------------------------------------------ */

    function plural(n, word) {
        return n + ' ' + word + (n === 1 ? '' : 's');
    }

    /* What the homepage line says at `now`: on 1 and 2 January, the year;
       otherwise the time left to the reader's midnight (31 December's, on
       the day; tonight's, in a preview), in hours and minutes, then
       minutes and seconds, then the last ten seconds alone. */
    function countdown(now) {
        if (now.getMonth() === 0 && now.getDate() <= 2) {
            return { text: 'Happy New Year, and welcome to ' + now.getFullYear() + '.', next: 0 };
        }
        var midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        var ms = midnight - now, left = Math.ceil(ms / 1000);
        var h = Math.floor(left / 3600), m = Math.floor(left % 3600 / 60), s = left % 60;
        // Wake when the shown number changes: on the minute, or the second.
        var said = { at: midnight, next: ms % 1000 || 1000 };
        if (h) { said.text = plural(h, 'hour') + ', ' + plural(m, 'minute') + ' to the Bells'; said.next = ms % 60000 || 60000; }
        else if (m) said.text = plural(m, 'minute') + ', ' + plural(s, 'second') + ' to the Bells';
        else if (left > 10) said.text = plural(s, 'second') + ' to the Bells';
        else { said.text = String(left); said.final = true; }
        return said;
    }

    function bells(kit) {
        var hours = document.querySelectorAll('.kr-season-hand--hour');
        var minutes = document.querySelectorAll('.kr-season-hand--minute');

        function setClocks(now) {
            var m = now.getMinutes(), h = now.getHours() % 12 + m / 60;
            Array.prototype.forEach.call(hours, function (p) {
                p.setAttribute('transform', 'rotate(' + (h * 30).toFixed(1) + ' ' + CX + ' ' + CY + ')');
            });
            Array.prototype.forEach.call(minutes, function (p) {
                p.setAttribute('transform', 'rotate(' + (m * 6) + ' ' + CX + ' ' + CY + ')');
            });
        }
        // The hands step once a minute; under reduced motion they are set once.
        (function tick() {
            var now = new Date();
            setClocks(now);
            if (!kit.reduced) setTimeout(tick, (60 - now.getSeconds()) * 1000 + 50);
        })();

        var hero = document.querySelector('.welcome-area');
        if (!hero || hero.querySelector('.kr-season-bells')) return;
        var el = document.createElement('div');
        el.className = 'kr-season-bells';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<span class="kr-season-bells__text"></span>';
        hero.appendChild(el);
        var text = el.firstChild;

        function ring() {
            el.classList.remove('kr-season-bells--final');
            el.classList.add('kr-season-bells--rung');
            text.textContent = 'Happy New Year.';
            kit.play('fireworks');
            if (kit.reduced) return;
            Array.prototype.forEach.call(document.querySelectorAll('.kr-season-corner__art'), function (art) {
                art.classList.add('kr-season-clock--chime');
            });
            // High over the hero, clear of its type, one after another.
            [[34, 16, 0], [60, 10, 0.35], [84, 22, 0.7], [48, 26, 1.05], [72, 14, 1.4], [92, 34, 1.75]].forEach(function (b) {
                var burst = document.createElement('span');
                burst.className = 'kr-season-bells__burst';
                burst.style.left = b[0] + '%';
                burst.style.top = b[1] + '%';
                burst.style.animationDelay = b[2] + 's';
                hero.appendChild(burst);
                burst.addEventListener('animationend', function () { burst.remove(); });
            });
        }

        /* Past the midnight it was counting to (and not long past: a tab
           asleep all night does not ring at breakfast), it rings, and a
           minute later says the year, or in a preview counts again. */
        var target = null;
        function update() {
            var now = new Date();
            if (target && now >= target) {
                var late = now - target;
                target = null;
                if (late < 300000) { ring(); setTimeout(update, 60000); return; }
            }
            var said = countdown(now);
            text.textContent = said.text;
            el.classList.remove('kr-season-bells--rung');
            el.classList.toggle('kr-season-bells--final', !!said.final);
            target = said.at || null;
            if (said.next) setTimeout(update, said.next + 20);
        }
        update();
    }

    // For the margins of a post: gold and silver stars, as the fireworks go up.
    var STAR_24 = K.star(12, 12, 11, 5, 0.45), SPARK_24 = K.star(12, 12, 10, 8, 0.25);

    // The pointer: a clock's minute hand, its point the hotspot.
    var POINTER = '<path d="M16-3.6l2.6 6.2h-1.3l.4 21h-3.4l.4-21h-1.3z" fill="#e8c25a"/>' +
        '<circle cx="16" cy="27.6" r="3.4" fill="none" stroke="#e8c25a" stroke-width="1.8"/>' +
        '<circle cx="16" cy="27.6" r="1" fill="#e8c25a"/>';

    K.dress({
        backdrop: { shapes: [STAR_24, SPARK_24], colours: ['#e8c25a', '#f3dd8f', '#cfd6e6', '#b8c2ff'] },
        // The ribbon's card (season.js, ribbon).
        about: { short: 'Hogmanay', when: '31 December to 2 January',
            text: 'Scotland\'s new year. Christmas wasn\'t even a public holiday in Scotland until 1958, so this was the big one. After the Bells at midnight comes first-footing: the first person over the doorstep brings the luck for the year, ideally with coal, shortbread, salt or whisky.',
            link: 'https://en.wikipedia.org/wiki/Hogmanay' },
        corner: clockArt, dangler: COAL_LUMP,
        // Fewer, grander bursts than Bonfire Night's, in gold and silver, glowing.
        leaves: { kind: 'fireworks', colours: FIREWORK_COLOURS, per1000: 0, shapes: [K.DOT], rate: 0.75, glow: true },
        // The tin sets off the fireworks, the black bun cheers, the coal
        // knocks at the door: the first foot over the threshold.
        patch: [{ art: shortbreadTin(), size: 'big', sound: 'fireworks' },
                { art: COAL_PIECE, size: 'small', sound: 'knock' },
                { art: BLACK_BUN, size: 'mid', sound: 'cheer' }],
        strew: [finger(20, -12), nugget(12), sparkle(12), finger(16, 18), nugget(10)],
        puff: 'kr-season-puff--scatter kr-season-puff--streamers',
        flyer: SHOOTING_STAR, flight: 'kr-season-flyer--shoot',
        favicon: BURST_ICON, moonmark: star(14.5, 10.5, 4.2, 4, 0.3),
        // A boot print every 34px along the top of the post, made as the
        // reader passes: the first foot crossing the page.
        track: { kind: 'footsteps', mode: 'bits', every: 34, bit: footprint },
        // The places that see the new year in with fireworks: Edinburgh's
        // Hogmanay, Glasgow's, Stirling's at the castle, Inverness's.
        map: { places: ['Edinburgh', 'Glasgow', 'Stirling Castle', 'Stirling, Scotland', 'Inverness'], badge: MAP_BURST },
        lost: {
            title: 'This Page Missed the Bells',
            lede: 'Whatever lived at this address went out first-footing at midnight, ' +
                'and nobody has seen it since.',
            caption: "While you wait for it to find its way home, have one of my photographs of Scotland. "
        },
        extra: bells,
        cursor: K.pointer(POINTER, 2, 2, -45)
    });
})();
