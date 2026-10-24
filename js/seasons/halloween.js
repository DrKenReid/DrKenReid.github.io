/**
 * seasons/halloween.js: Halloween's art for js/season.js (see that file
 * for the pieces): a cobweb and its spider, autumn leaves, jack-o'-lanterns
 * with flickering faces, a bat, a pumpkin favicon, a candle burning down
 * as the reader goes, fog in the dark theme only, ghosts over the most
 * abandoned places, a haunted 404 page, an orange pointer with a bat.
 * Its own:
 *   - eyes that open in the dark along the footer's top, and shut when
 *     the pointer comes near
 *   - a black cat that walks along the footer's edge (kit.walker), sits a
 *     while by the pumpkins, and bolts when clicked
 *   - a ghost that rises from the corner of a post card's picture while
 *     the card is hovered
 *   - a full moon in the homepage hero's sky that a witch on a broomstick
 *     crosses now and then (wide screens)
 *   - a flash of lightning when the reader switches to the dark theme
 *   - gravestones and candy corn among the pumpkins
 *
 * Classes only this file applies (css/seasons/halloween.css):
 * .kr-season-pumpkin, .kr-season-glow, .kr-season-dangler__line,
 * .kr-season-flyer__body, .kr-season-flyer__wing (--l, --r),
 * .kr-season-track__fire, .kr-season-track__core, .kr-season-badge__body,
 * .kr-season-badge__eye, .kr-season-eyes (__pair, __pair--shut),
 * .kr-season-peek (--up), .kr-season-sky (__moon, __witch),
 * .kr-season-flash, and the walker's kind, cat (kr-season-walker--cat).
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg, pumpkin = K.pumpkin;

    function cobwebArt() {
        // Radials from the corner (64, 0), then sagging rings between them.
        var spokes = [180, 157, 135, 112, 90];
        var lines = spokes.map(function (deg) {
            var r = deg * Math.PI / 180;
            return 'M64 0L' + (64 + Math.cos(r) * 64).toFixed(1) + ' ' + (Math.sin(r) * 64).toFixed(1);
        });
        [16, 30, 44, 58].forEach(function (radius) {
            var d = '';
            spokes.forEach(function (deg, i) {
                var r = deg * Math.PI / 180;
                var x = 64 + Math.cos(r) * radius, y = Math.sin(r) * radius;
                if (!i) { d += 'M' + x.toFixed(1) + ' ' + y.toFixed(1); return; }
                var m = (deg + spokes[i - 1]) / 2 * Math.PI / 180;
                var sag = radius * 0.82;
                d += 'Q' + (64 + Math.cos(m) * sag).toFixed(1) + ' ' + (Math.sin(m) * sag).toFixed(1) +
                    ' ' + x.toFixed(1) + ' ' + y.toFixed(1);
            });
            lines.push(d);
        });
        return '<path d="' + lines.join('') + '" fill="none"/>';
    }

    var SPIDER = svg('kr-season-dangler__body', '0 0 20 20',
        '<path d="M6 9L1 6M6 11L0 11M6 13L1 16M14 9l5-3M14 11h6M14 13l5 3" class="kr-season-dangler__line"/>' +
        '<ellipse cx="10" cy="11" rx="4.2" ry="5"/><circle cx="10" cy="6.6" r="2.4"/>');

    var BAT = svg('kr-season-flyer__body', '0 0 64 32',
        '<path class="kr-season-flyer__wing kr-season-flyer__wing--l" d="M30 13C25 7 16 4 4 6c4 2 6 5 6 9-3-2-6-2-9 0 5 1 8 5 9 9 3-3 7-3 10-1 3-4 6-6 10-6z"/>' +
        '<path class="kr-season-flyer__wing kr-season-flyer__wing--r" d="M34 13c5-6 14-9 26-7-4 2-6 5-6 9 3-2 6-2 9 0-5 1-8 5-9 9-3-3-7-3-10-1-3-4-6-6-10-6z"/>' +
        '<path d="M32 9l-3-4 1 5c-2 1-3 4-3 7 0 4 2 7 5 7s5-3 5-7c0-3-1-6-3-7l1-5z"/>');

    var PUMPKIN_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 56">' +
        '<path d="M31 11c-.5-4 1-8 5-10l2.5 2.5c-3 1.5-4 4-4 7.5z" fill="#5b6b2c"/>' +
        '<ellipse cx="20" cy="33" rx="15" ry="19" fill="#c9581a"/>' +
        '<ellipse cx="44" cy="33" rx="15" ry="19" fill="#c9581a"/>' +
        '<ellipse cx="32" cy="32" rx="15" ry="21" fill="#e5761f"/>' +
        '<path d="M17 28l5-8 5 8zM37 28l5-8 5 8zM16 37c5 10 27 10 32 0z" fill="#3a1d08"/></svg>';

    var MOON_BAT = 'M12 11.2c.6-.9 1.3-.9 1.6 0 1-1.2 2.8-1.7 4.4-1.5-.9.6-1.2 1.5-1 2.4' +
        '.9-.5 2-.5 2.9 0-1.4.3-2.3 1.2-2.6 2.3-.9-.8-2-.8-2.9-.1-.6-.6-1.3-.9-2-.9s-1.4.3-2 .9' +
        'c-.9-.7-2-.7-2.9.1-.3-1.1-1.2-2-2.6-2.3.9-.5 2-.5 2.9 0 .2-.9-.1-1.8-1-2.4 1.6-.2 3.4.3 4.4 1.5.3-.9 1-.9 1.6 0z';

    var GHOST = svg('kr-season-badge__body', '0 0 20 22',
        '<path d="M10 1a8 8 0 0 0-8 8v12l2.7-2 2.6 2 2.7-2 2.7 2 2.6-2 2.7 2V9a8 8 0 0 0-8-8z"/>' +
        '<circle class="kr-season-badge__eye" cx="7.3" cy="9" r="1.5"/>' +
        '<circle class="kr-season-badge__eye" cx="12.7" cy="9" r="1.5"/>');

    var FLAME = svg('kr-season-track__fire', '0 0 12 20',
        '<path d="M6 0C8 5 12 8 12 13a6 6 0 0 1-12 0C0 9 3 7 4 3c1 2 1 4 2 5 1-2 0-5 0-8z"/>' +
        '<path class="kr-season-track__core" d="M6 9c1.4 2 3 3.5 3 5.4a3 3 0 0 1-6 0C3 12.6 4.6 11 6 9z"/>');

    /* Eyes in the dark along the footer's top: a few pairs open, blink
       now and then, and shut tight when the pointer comes within reach,
       opening again a while after it leaves. */
    function eyes(kit) {
        var footer = document.querySelector('.kr-footer');
        if (!footer || footer.querySelector('.kr-season-eyes')) return;
        var el = document.createElement('div');
        el.className = 'kr-season-eyes';
        el.setAttribute('aria-hidden', 'true');
        // Across the dark band above the footer's text, clear of the patch.
        var spots = [[34, 26], [52, 44], [71, 20], [90, 38]];
        el.innerHTML = spots.map(function (s, i) {
            return '<span class="kr-season-eyes__pair" style="left: ' + s[0] + '%; top: ' + s[1] + 'px;' +
                ' animation-delay: -' + (i * 1.7).toFixed(1) + 's">' +
                svg('', '0 0 24 8', '<ellipse cx="5" cy="4" rx="3.4" ry="2.6"/><ellipse cx="19" cy="4" rx="3.4" ry="2.6"/>') +
                '</span>';
        }).join('');
        footer.appendChild(el);
        var pairs = el.querySelectorAll('.kr-season-eyes__pair');
        footer.addEventListener('pointermove', function (e) {
            Array.prototype.forEach.call(pairs, function (p) {
                var r = p.getBoundingClientRect();
                var near = Math.abs(e.clientX - (r.left + r.width / 2)) < 90 && Math.abs(e.clientY - (r.top + r.height / 2)) < 70;
                if (near) {
                    p.classList.add('kr-season-eyes__pair--shut');
                    clearTimeout(p.krOpen);
                    p.krOpen = setTimeout(function () { p.classList.remove('kr-season-eyes__pair--shut'); }, 2600);
                }
            });
        });
    }

    // A black cat walking right, tail up, eyes lit.
    var CAT = svg('', '0 0 48 30',
        '<path class="kr-season-walker__tail" d="M11 20C5 19 2 14 3 8c.5-3 2.6-4.4 4-3.6-2 2-2.6 5-1 8 1.2 2.2 3.4 3.4 5.6 3.4z"/>' +
        '<path d="M10 21c0-5.4 4-8.6 10-8.6h12.4c2.6 0 4.2-1.2 5-3l1-4 2.4 3 2.2-3 1 4.2c.8 1 1 2.6 1 3.8 0 3-2 5.2-5 6l-.6 1.2v6.4' +
        'h-2.8l-1-5.4h-9.6l-1 5.4h-2.8l-.8-5.6c-2.6-.2-4.6-1-5.8-2.2l-1.2 7.8H9.6z"/>' +
        '<ellipse cx="40.6" cy="10.6" rx="1.1" ry=".8" fill="#ffd36b"/><ellipse cx="44" cy="10.6" rx="1" ry=".8" fill="#ffd36b"/>');

    // A witch on her broomstick, flying right, on a 48 x 26 box.
    var WITCH = svg('kr-season-sky__witch', '0 -4 48 26',
        '<path d="M6 15.6L44 11.2l.3 1.2L6.3 16.8zM7 15L0 13l1 3-1 3 7.5-1.6z"/>' +
        '<path d="M21 15.4c.6-5.6 3.2-8.6 6.4-8.6 2.8 0 4 2.6 4 6.4l2.4 1-11.4 2zM22.4 9.4C17.6 10 14.4 12.6 12.4 15l9-.6z"/>' +
        '<circle cx="28.4" cy="5.2" r="2.2"/><path d="M24.6 4.6h7.6l-2.4-1.4L24 -3.2l2.8 6z"/>');

    var GRAVE = function (w) {
        return K.bit(20, 24, w, 0, '<path d="M3 24V9a7 7 0 0 1 14 0v15z" fill="#8d8a93" stroke="#55525b" stroke-width="1"/>' +
            '<path d="M7 11h6M7 14h6M7 17h4" stroke="#55525b" stroke-width="1.2" stroke-linecap="round"/>' +
            '<path d="M1 24c1-2 2-3 3-2 0-2 1-3 2-1M14 24c1-2 2-3 3-1 1-2 2-2 2 1" fill="none" stroke="#5b6b2c" stroke-width="1"/>');
    };

    var CANDY_CORN = K.bit(16, 18, 11, -18, '<path d="M2.5 12h11l1.5 4c0 1.4-14 1.4-14 0z" fill="#f2c230"/>' +
        '<path d="M4.7 6.5h6.6l2.2 5.5H2.5z" fill="#ec7a1c"/><path d="M8 1c1 0 2.6 3.6 3.3 5.5H4.7C5.4 4.6 7 1 8 1z" fill="#fbf6e9"/>');

    /* A ghost rises from the bottom corner of a post card's picture while
       the card is hovered, and sinks back when the pointer leaves. Cards
       are drawn after load, so this listens on the document. */
    function peeks(kit) {
        if (kit.reduced) return;
        var CARD = '.blog-card, .single-post-area';
        document.addEventListener('pointerover', function (e) {
            var card = e.target.closest && e.target.closest(CARD);
            if (!card) return;
            var pic = card.querySelector('.blog-card-img, .post-thumbnail');
            if (!pic) return;
            var peek = pic.querySelector('.kr-season-peek');
            if (!peek) {
                peek = document.createElement('span');
                peek.className = 'kr-season-peek';
                peek.setAttribute('aria-hidden', 'true');
                peek.innerHTML = GHOST;
                pic.appendChild(peek);
            }
            requestAnimationFrame(function () { requestAnimationFrame(function () {
                peek.classList.add('kr-season-peek--up');
            }); });
        });
        document.addEventListener('pointerout', function (e) {
            var card = e.target.closest && e.target.closest(CARD);
            if (!card || (e.relatedTarget && card.contains(e.relatedTarget))) return;
            var peek = card.querySelector('.kr-season-peek');
            if (peek) peek.classList.remove('kr-season-peek--up');
        });
    }

    /* The moon in the homepage hero's sky, high on the right, clear of
       the headline; the witch crosses it every half minute or so
       (style.css times her; she stays away under reduced motion). */
    function sky() {
        var hero = document.querySelector('.welcome-area');
        if (!hero || hero.querySelector('.kr-season-sky')) return;
        var el = document.createElement('div');
        el.className = 'kr-season-sky';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<span class="kr-season-sky__moon"></span>' + WITCH;
        hero.appendChild(el);
    }

    /* Lightning: one flicker over the page when the reader switches to
       the dark theme (two dips of a pale wash inside a second), and none
       again for five seconds, however fast the theme is toggled, so it
       never comes near three flashes a second. Not under reduced motion. */
    function lightning(kit) {
        if (kit.reduced || !window.MutationObserver) return;
        var root = document.documentElement;
        var was = root.getAttribute('data-theme'), due = false, lastFlash = -1e9;
        new MutationObserver(function () {
            var now = root.getAttribute('data-theme');
            if (now !== was) {
                was = now;
                due = now === 'dark';
            }
            // Wait out theme.js's circular reveal, so the whole page flickers.
            if (!due || root.classList.contains('kr-theme-reveal')) return;
            due = false;
            if (Date.now() - lastFlash < 5000) return;
            lastFlash = Date.now();
            var flash = document.createElement('div');
            flash.className = 'kr-season-flash';
            flash.setAttribute('aria-hidden', 'true');
            document.body.appendChild(flash);
            flash.addEventListener('animationend', function () { flash.remove(); });
        }).observe(root, { attributes: true, attributeFilter: ['data-theme', 'class'] });
    }

    // For the margins of a post: bats, ghosts and leaves,
    // on the backdrop's 24 x 24 box.
    var BAT_24 = 'M12 8.6l-1-1.4.3 1.8c-.8.4-1.2 1.3-1.2 2.3 0 1.5.8 2.5 1.9 2.5s1.9-1 1.9-2.5c0-1-.4-1.9-1.2-2.3l.3-1.8z' +
        'M10.2 10.6C8.2 8.4 5 7.6 1 8.3c1.4.8 2.2 1.9 2.2 3.3-1-.6-2.2-.6-3.2 0 1.8.4 2.9 1.8 3.2 3.3 1-1 2.5-1 3.5-.4 1-1.4 2.1-2.1 3.5-2.1z' +
        'M13.8 10.6c2-2.2 5.2-3 9.2-2.3-1.4.8-2.2 1.9-2.2 3.3 1-.6 2.2-.6 3.2 0-1.8.4-2.9 1.8-3.2 3.3-1-1-2.5-1-3.5-.4-1-1.4-2.1-2.1-3.5-2.1z';
    var GHOST_24 = 'M12 3a6.5 6.5 0 0 0-6.5 6.5V21l2.2-1.6 2.1 1.6 2.2-1.6 2.2 1.6 2.1-1.6 2.2 1.6V9.5A6.5 6.5 0 0 0 12 3z';

    K.dress({
        backdrop: { shapes: [BAT_24, GHOST_24, K.MAPLE], colours: [['#2b2233'], ['#f7f5ff'], ['#e07a2e', '#c4512a', '#e8a33d']] },
        // The ribbon's card (season.js, ribbon).
        about: { short: 'Halloween', when: '31 October',
            text: 'Halloween grew out of Samhain, the Gaelic festival at the end of the harvest, when the line between the living and the dead was said to wear thin. Guising, going door to door in costume for treats, is the Scottish and Irish custom that turned into trick-or-treating.',
            link: 'https://en.wikipedia.org/wiki/Halloween' },
        corner: cobwebArt, dangler: SPIDER,
        leaves: { kind: 'fall', colours: K.LEAF_COLOURS, per1000: 14, shapes: [K.MAPLE, K.OVAL], tumble: true },
        // The big pumpkin howls, the small one hoots, the middle one creaks.
        patch: [{ art: pumpkin(0), size: 'big', sound: 'wolves' },
                { art: pumpkin(1), size: 'small', sound: 'owl' },
                { art: pumpkin(2), size: 'mid', sound: 'creak' }],
        // Gravestones and candy corn among the leaves.
        strew: (function (l) {
            return [GRAVE(18), CANDY_CORN + l[1], l[2], GRAVE(14) + l[3], CANDY_CORN];
        })(K.strewnLeaves(K.LEAF_COLOURS)), puff: '',
        flyer: BAT, flight: '',
        favicon: PUMPKIN_ICON, moonmark: MOON_BAT,
        track: { kind: 'candle', mode: 'burn', tip: FLAME },
        // A ghost over a place haunted by its abandoned frames: at least
        // `min` of them and `share` of all it has (one derelict corner of
        // a city does not make the city haunted).
        map: { tag: 'abandoned', min: 3, share: 0.3, badge: GHOST },
        lost: {
            title: 'This Page Has Passed Over',
            lede: 'Nothing lives at this address any more, if anything ever did. ' +
                'Only the link haunts the place.',
            caption: "Since you're lost anyway, here's one of my spookier photographs. "
        },
        // An orange pointer with a bat at its tail.
        cursor: K.cursor('#e5761f', '<path transform="scale(.19) translate(0 14)" fill="#2b2233" stroke="#f3e7cc" stroke-width="5" paint-order="stroke" d="M30 13C25 7 16 4 4 6c4 2 6 5 6 9-3-2-6-2-9 0 5 1 8 5 9 9 3-3 7-3 10-1 3-4 6-6 10-6zM34 13c5-6 14-9 26-7-4 2-6 5-6 9 3-2 6-2 9 0-5 1-8 5-9 9-3-3-7-3-10-1-3-4-6-6-10-6zM32 9l-3-4 1 5c-2 1-3 4-3 7 0 4 2 7 5 7s5-3 5-7c0-3-1-6-3-7l1-5z"/>'),
        extra: function (kit) {
            eyes(kit);
            K.walker(CAT, 'cat');
            peeks(kit);
            sky();
            lightning(kit);
        }
    });
})();
