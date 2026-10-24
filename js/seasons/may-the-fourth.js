/**
 * seasons/may-the-fourth.js: the art for two days, May the Fourth (in
 * blue) and the Revenge of the Fifth the day after (in red; KR_SEASONS
 * gives it `art: 'may-the-fourth'`), for js/season.js (see that file for
 * the pieces). Generic space, nothing from any film: a ringed planet with
 * its moon on a thread, stars twinkling over the openers, three tin
 * rockets that hop and fire when clicked, stardust between them, a comet,
 * a star favicon, a beam of light that reaches as far as the reader has,
 * a nebula along the hero's foot in the dark theme, and a 404 page that
 * is not the one you want. Its own: a click on the planet jumps to light
 * speed, the stars over the opener streaking past for a moment.
 * The two days differ only in colour (style.css's tokens for each key,
 * and the colours below, picked by K.season.key) and in the 404's words.
 * The pointer is the day's colour with a small star at its tail.
 *
 * Classes only this file applies (css/seasons/may-the-fourth.css):
 * .kr-season-pumpkin, .kr-season-rocket, .kr-season-rocket__flame,
 * .kr-season-dangler__body, .kr-season-flyer__body,
 * .kr-season-flyer--comet, .kr-season-puff--exhaust,
 * .kr-season-track--beam, .kr-season-track__spark, .kr-season-planet,
 * .kr-season-warp, .kr-season-warp__streak, .kr-season-warping (its
 * "jump to light speed" banner, for the last four).
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg, star = K.star;
    var FIFTH = K.season && K.season.key === 'revenge-of-the-fifth';

    function fix(v) { return K.fix(+v); }

    // The day's colours: blue and starlight on the 4th, ember and red on the 5th.
    var DAY = FIFTH ? {
        stars: ['#ffffff', '#ffd2c2', '#ff8a6a', '#ff5a4a', '#ffe0a0'],
        planet: ['#c8553a', '#e4876a', '#9c3524', '#f0a184'],
        accent: '#d23a2a', window: '#3a1414', pointer: '#ff5a4a', pointerEdge: '#3a0c0c',
        icon: '#e8402f', iconEdge: '#7a1410', sparkle: '#ffb08a', tail: ['#ff5a3a', '#ffd2c2']
    } : {
        stars: ['#ffffff', '#d6ecff', '#a8d8ff', '#fff3b0', '#cfd8ff'],
        planet: ['#6f85dc', '#a3b4f0', '#4f61bd', '#c2cdf6'],
        accent: '#2f7fd0', window: '#12305a', pointer: '#5fb8ff', pointerEdge: '#0c2340',
        icon: '#ffcf3f', iconEdge: '#9a6a00', sparkle: '#ffe27a', tail: ['#3f9fff', '#d6ecff']
    };
    var RING = '#e6cf8f', RING_EDGE = '#a88d4c';

    // A four-pointed sparkle about (cx, cy).
    function sparkle(cx, cy, r) { return star(cx, cy, r, 4, 0.28); }

    /* The corner: a ringed planet, tilted, its bands drawn as strips of
       the disc, the near half of the ring passing in front of it, with a
       few sparkles about. The thread its moon hangs on is the line. */
    function planetArt() {
        var cx = 38, cy = 22, r = 12, c = DAY.planet;
        function band(a, b, fill) {
            var w1 = Math.sqrt(r * r - a * a), w2 = Math.sqrt(r * r - b * b);
            return '<path d="M' + fix(cx - w1) + ' ' + fix(cy + a) + 'L' + fix(cx + w1) + ' ' + fix(cy + a) +
                'A' + r + ' ' + r + ' 0 0 1 ' + fix(cx + w2) + ' ' + fix(cy + b) + 'L' + fix(cx - w2) + ' ' + fix(cy + b) +
                'A' + r + ' ' + r + ' 0 0 1 ' + fix(cx - w1) + ' ' + fix(cy + a) + 'z" fill="' + fill + '" stroke="none"/>';
        }
        var ringBack = 'M17 22A21 5.4 0 0 1 59 22', ringFront = 'M17 22A21 5.4 0 0 0 59 22';
        var innerBack = 'M21 22A17 4.2 0 0 1 55 22', innerFront = 'M21 22A17 4.2 0 0 0 55 22';
        return '<g fill="' + DAY.sparkle + '" stroke="none">' +
            '<path d="' + sparkle(9, 9, 3.4) + sparkle(18, 46, 2.4) + sparkle(57, 51, 2.8) + sparkle(5, 31, 1.7) + '"/></g>' +
            '<g transform="rotate(-22 38 22)">' +
            '<path d="' + ringBack + '" fill="none" stroke="' + RING + '" stroke-width="2.6"/>' +
            '<path d="' + innerBack + '" fill="none" stroke="' + RING_EDGE + '" stroke-width=".8"/>' +
            '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + c[0] + '" stroke="none"/>' +
            band(-9.5, -6, c[3]) + band(-3, 0.5, c[1]) + band(3, 5.5, c[2]) + band(7.5, 10, c[1]) +
            '<path d="M38 10A12 12 0 0 1 38 34A7 12 0 0 0 38 10z" fill="#0d1030" opacity=".28" stroke="none"/>' +
            '<path d="' + ringFront + '" fill="none" stroke="' + RING + '" stroke-width="2.6"/>' +
            '<path d="' + innerFront + '" fill="none" stroke="' + RING_EDGE + '" stroke-width=".8"/></g>';
    }

    // The moon on its thread: grey, cratered, shaded on one side.
    var MOON = svg('kr-season-dangler__body', '0 0 20 20',
        '<circle cx="10" cy="10" r="7.4" fill="#e6e1d3" stroke="#8f897c" stroke-width=".6"/>' +
        '<circle cx="7.4" cy="8" r="1.7" fill="#c9c1ad"/><circle cx="12.6" cy="12.4" r="2.2" fill="#c9c1ad"/>' +
        '<circle cx="11.8" cy="6.4" r="1" fill="#c9c1ad"/><circle cx="6.8" cy="13" r=".9" fill="#c9c1ad"/>' +
        '<path d="M10 2.6a7.4 7.4 0 0 1 0 14.8A5 7.4 0 0 0 10 2.6z" fill="#1b1d33" opacity=".18"/>');

    /* A tin rocket on the pumpkins' 64 x 56 box, standing on its fins:
       a body, a nose cone and fins in the accent, a porthole, a nozzle,
       and a flame below it that only burns when it is clicked. */
    function rocket(body, accent, port) {
        return svg('kr-season-pumpkin kr-season-rocket', '0 0 64 56',
            '<path class="kr-season-rocket__flame" d="M27.4 45.5c0 4.4 2 7.8 4.6 10.3 2.6-2.5 4.6-5.9 4.6-10.3z"/>' +
            '<path d="M22.6 30.5c-6.2 2.6-9.4 7.4-9.4 15l9.4-3.6zM41.4 30.5c6.2 2.6 9.4 7.4 9.4 15l-9.4-3.6z" fill="' + accent +
            '" stroke="#2b3240" stroke-width=".8"/>' +
            '<path d="M27 42.5h10l-1.6 4h-6.8z" fill="#5b6472"/>' +
            '<path d="M32 1.5c6.6 5.6 10 14 10 25V43H22V26.5c0-11 3.4-19.4 10-25z" fill="' + body +
            '" stroke="#2b3240" stroke-width="1"/>' +
            '<path d="M32 1.5c3 2.6 5.3 5.8 6.9 9.5H25.1c1.6-3.7 3.9-6.9 6.9-9.5z" fill="' + accent + '"/>' +
            '<path d="M22.2 36h19.6" stroke="' + accent + '" stroke-width="1.6"/>' +
            '<circle cx="32" cy="21" r="4.6" fill="' + port + '" stroke="#2b3240" stroke-width="1.6"/>' +
            '<path d="M30 19.4a2.4 2.4 0 0 1 2.6-.9" stroke="#ffffff" stroke-width="1" fill="none" stroke-linecap="round"/>' +
            '<path d="M30.6 33.5h2.8v13h-2.8z" fill="' + accent + '" stroke="#2b3240" stroke-width=".6"/>');
    }

    // Stardust between the rockets: sparkles, and a pebble of moon rock.
    function dust(size, colour, turn) {
        return K.bit(24, 24, size, turn,
            '<path d="' + sparkle(12, 12, 11) + '" fill="' + colour + '"/>');
    }
    function pebble(w) {
        return K.bit(24, 12, w, 0, '<path d="M2 11c-1-4 2-8 8-9s12 2 13 6-2 3.5-6 3.5z" fill="#9a9488"' +
            ' stroke="#5e594f" stroke-width=".8"/>');
    }

    // A comet heading right: a bright head and a tail fading behind it.
    var COMET = svg('kr-season-flyer__body', '0 0 140 28',
        '<defs><linearGradient id="kr-season-comet-tail" x1="0" x2="1" y1="0" y2="0">' +
        '<stop offset="0" stop-color="' + DAY.tail[0] + '" stop-opacity="0"/>' +
        '<stop offset=".7" stop-color="' + DAY.tail[0] + '" stop-opacity=".7"/>' +
        '<stop offset="1" stop-color="' + DAY.tail[1] + '" stop-opacity="1"/></linearGradient></defs>' +
        '<path d="M2 14C40 9 90 7 124 9.5a4.6 4.6 0 0 1 0 9C90 21 40 19 2 14z" fill="url(#kr-season-comet-tail)"/>' +
        '<path d="M40 14.6C70 13 100 12.6 124 13.4" stroke="#ffffff" stroke-opacity=".6" stroke-width=".8" fill="none"/>' +
        '<circle cx="124" cy="14" r="5.4" fill="#ffffff"/>');

    var STAR_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<path d="' + star(16, 17, 15, 5, 0.46) + '" fill="' + DAY.icon + '" stroke="' + DAY.iconEdge +
        '" stroke-width="1.2" stroke-linejoin="round"/></svg>';

    // A small rocket crossing the moon, nose to the upper right.
    var MOON_ROCKET = 'M17.6 6.4c-2.9-.2-5.6 1.3-7.2 4l3.2 3.2c2.7-1.6 4.2-4.3 4-7.2z' +
        'M10.1 10.9l-2.6.3-1.3 2.2 2.6-.2zM13.1 13.9l-.3 2.6-2.2 1.3.2-2.6zM9.6 14.4l-2 2 1 1 2-2z';

    // The tip of the beam: a bright point with four short rays.
    var SPARK = '<svg class="kr-season-track__spark" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
        '<path d="' + star(8, 8, 8, 4, 0.2) + '"/><circle cx="8" cy="8" r="2.6"/></svg>';

    /* Light speed: a click on the corner's planet (it takes clicks, from
       this file) streaks the stars over the page's opener into lines
       rushing out from its middle for a second, the twinkling stars gone
       while they do. Not under reduced motion, and one jump at a time. */
    function jump() {
        var host = document.querySelector('.welcome-area, .kr-opener, .breadcrumb-area');
        if (!host || host.classList.contains('kr-season-warping')) return;
        var el = document.createElement('div');
        el.className = 'kr-season-warp';
        el.setAttribute('aria-hidden', 'true');
        var html = '';
        for (var i = 0; i < 48; i++) {
            var deg = (i / 48) * 360 + Math.random() * 6;
            html += '<span style="transform: rotate(' + fix(deg) + 'deg)"><i class="kr-season-warp__streak" style="left: ' +
                (20 + Math.random() * 120 | 0) + 'px; animation-delay: ' + (Math.random() * 0.25).toFixed(2) + 's"></i></span>';
        }
        el.innerHTML = html;
        host.appendChild(el);
        host.classList.add('kr-season-warping');
        setTimeout(function () {
            el.remove();
            host.classList.remove('kr-season-warping');
        }, 1500);
    }

    function warp(kit) {
        if (kit.reduced) return;
        Array.prototype.forEach.call(document.querySelectorAll('.kr-season-corner__art'), function (art) {
            art.classList.add('kr-season-planet');
            art.addEventListener('click', jump);
        });
    }

    K.dress({
        // The ribbon's card (season.js, ribbon), for whichever day it is.
        about: K.season.key === 'revenge-of-the-fifth' ?
            { short: 'Fifth of May', when: '5 May',
                text: 'The day after May the Fourth belongs to the other side: Revenge of the Fifth, after Revenge of the Sith. Hence the red.',
                link: 'https://en.wikipedia.org/wiki/Star_Wars_Day' } :
            { short: 'May the 4th', when: '4 May',
                text: 'Say it out loud: May the Fourth be with you. A pun Star Wars fans turned into a holiday, and tomorrow is Revenge of the Fifth.',
                link: 'https://en.wikipedia.org/wiki/Star_Wars_Day' },
        corner: planetArt, dangler: MOON,
        // Stars, mostly points of light, some four-pointed, twinkling.
        leaves: { kind: 'twinkle', colours: DAY.stars, per1000: 46, shapes: [K.DOT, sparkle(12, 12, 11)],
            tumble: false, glow: true, size: [7, 17] },
        // The big rocket lifts off, the small one takes a small step, the
        // middle one hears Saturn.
        patch: [{ art: rocket('#ece8de', DAY.accent, DAY.window), size: 'big', sound: 'liftoff' },
                { art: rocket('#ffffff', FIFTH ? '#f08a3a' : '#2fa7a0', DAY.window), size: 'small', sound: 'small-step' },
                { art: rocket('#cdd3dc', FIFTH ? '#8a1f2a' : '#6a4fc0', DAY.window), size: 'mid', sound: 'saturn' }],
        strew: [dust(14, DAY.sparkle, 0), pebble(16), dust(10, '#ffffff', 20), dust(12, DAY.stars[2], 45), pebble(11)],
        puff: 'kr-season-puff--exhaust',
        flyer: COMET, flight: 'kr-season-flyer--comet',
        favicon: STAR_ICON, moonmark: MOON_ROCKET,
        cursor: K.cursor(DAY.pointer, '<path fill="' + DAY.icon + '" stroke="' + DAY.iconEdge + '" stroke-width=".8"' +
            ' stroke-linejoin="round" d="' + star(6, 6.4, 5.8, 5, 0.46) + '"/>', DAY.pointerEdge),
        // A beam of light that reaches as far as the reader has read.
        track: { kind: 'beam', mode: 'fill', tip: SPARK },
        map: null,
        lost: FIFTH ? {
            title: 'This Page Went Over to the Dark Side',
            lede: 'Whatever lived at this address was tempted away, and took the page with it.',
            caption: 'Before you go, have a photograph from somewhere far away. '
        } : {
            title: "This Isn't the Page You're Looking For",
            lede: 'Whatever lived at this address has gone a very long way from here, ' +
                'and left no forwarding coordinates.',
            caption: 'Since you have come this far, have a photograph from somewhere far away. '
        },
        extra: warp
    });
})();
