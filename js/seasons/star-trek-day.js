/**
 * seasons/star-trek-day.js: Star Trek Day's art for js/season.js (see
 * that file for the pieces), for 8 September, the day Star Trek had its
 * American premiere in 1966, dressed for The Next Generation: a
 * starship in the corner (a saucer, an engineering hull, two nacelles)
 * with a delta badge on its thread, stars twinkling over the openers, a
 * cup of Earl Grey, a flute on its box and a PADD on the footer with
 * isolinear chips between them, a shimmer of energy from whatever is
 * clicked, a starship that crosses at impulse and jumps to warp as the
 * footer arrives, a fleet in the margins, a delta favicon, a starship
 * crossing the moon, a 404 page that has boldly gone, and the gold
 * delta for the pointer. Every drawing is the site's own.
 * Its own:
 *   - engage: a click on the corner's starship sends it to warp, drawn
 *     out long and gone in a flash, and it drops back out of warp a
 *     moment later
 *   - the footer's three pieces beam in, each in a column of sparkle, as
 *     they come into view
 *   - a panel of coloured bars along the footer's top that powers up as
 *     the footer arrives, and a row of them in place of a post's reading
 *     bar, lit as far as the reader has read
 * Under reduced motion the ship takes no clicks, nothing beams in and
 * the panel is lit from the start.
 *
 * Classes only this file applies (css/seasons/star-trek-day.css):
 * .kr-season-pumpkin, .kr-season-dangler__body, .kr-season-starship
 * (--warp, __ship, __flash), .kr-season-steam, .kr-season-padd__lit,
 * .kr-season-puff--energize, .kr-season-flyer--warp, .kr-season-warpflash,
 * .kr-season-energize (--wait), .kr-season-lcars (--off, --on, __bar,
 * __bar--a to --f), .kr-season-track--lcars, .kr-season-pill (--a to --d).
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg, star = K.star;

    // The hull's greys, its windows, and the engines' colours.
    var HULL = '#d6dbe3', HULL_SHADE = '#aeb6c3', HULL_FAR = '#98a1b0', EDGE = '#4b5262';
    var WINDOW = '#ffe7a0', BUSSARD = '#ff5a3c', WARP = '#6cc8ff', DEFLECTOR = '#86e0ff';
    // The delta's gold, and the panel colours the PADD's screen shares.
    var GOLD = '#e2b84a', GOLD_EDGE = '#6b4e0e';
    var LCARS = { orange: '#ff9c3a', peach: '#ffcc99', lilac: '#cc99cc', blue: '#9999ff', gold: '#ffcc66', red: '#cc6666' };

    // A four-pointed sparkle about (cx, cy).
    function sparkle(cx, cy, r) { return star(cx, cy, r, 4, 0.28); }

    /* A starship in profile on a 64 x 40 box, bow to the left: the far
       nacelle and its pylon behind, the engineering hull with its
       deflector, the neck, the saucer with its bridge and a row of
       windows, and the near pylon and nacelle in front, red at the
       bussard collector and blue along the warp coil. */
    var SHIP = '<g stroke="' + EDGE + '" stroke-width=".5" stroke-linejoin="round">' +
        '<path d="M47 22l5 0 4-7.6h-3.4z" fill="' + HULL_FAR + '"/>' +
        '<path d="M43.6 12.6c0-1.3.9-1.8 2.4-1.8l14.6.3c1.4 0 2.4.8 2.4 1.7s-1 1.7-2.4 1.7l-14.6.3c-1.5 0-2.4-.9-2.4-2.2z" fill="' + HULL_FAR + '"/>' +
        '<path d="M28 26.5c0-2.6 2.6-3.6 6-3.8l18-.6c3.6 0 7.4 1.4 7.4 3.8s-3.8 3.6-7.4 3.6l-18-.4c-3.4-.1-6-1-6-2.6z" fill="' + HULL + '"/>' +
        '<path d="M31 17.6h9l7.6 5.4-9.6.2z" fill="' + HULL_SHADE + '"/>' +
        '<path d="M2 14.6C6 11.2 18 9.6 25 9.6S42 11 45 14.2C42 17 32 19.2 24 19.2S5.6 17.6 2 14.6z" fill="' + HULL + '"/>' +
        '<path d="M20 10.2c.6-1.6 2.4-2.4 4.4-2.4s3.6.8 4.2 2.4z" fill="' + HULL + '"/>' +
        '<path d="M49.4 23.4l5.2-.2 3.8-5h-4z" fill="' + HULL_SHADE + '"/>' +
        '<path d="M42.6 17.4c0-1.4 1-2 2.6-2l15.2.3c1.6 0 2.6.8 2.6 1.7s-1 1.7-2.6 1.7l-15.2.3c-1.6 0-2.6-.6-2.6-2z" fill="' + HULL + '"/></g>' +
        '<g stroke="none">' +
        '<circle cx="45.2" cy="12.7" r="1.2" fill="' + BUSSARD + '" opacity=".75"/>' +
        '<ellipse cx="31" cy="26.6" rx="2.2" ry="2" fill="' + DEFLECTOR + '"/>' +
        '<path d="M34 28.6c5 .9 12 1 18 .5" fill="none" stroke="' + HULL_SHADE + '" stroke-width=".8"/>' +
        '<path d="M3.6 14.8C10 16 18 16.4 24 16.4s15.4-.7 19.6-2.2" fill="none" stroke="' + EDGE + '" stroke-width=".45"/>' +
        '<path d="M7 15.8C13 16.8 19 17.2 24 17.2s11-.4 16-1.4" fill="none" stroke="' + WINDOW +
        '" stroke-width=".8" stroke-dasharray=".8 1.4"/>' +
        '<path d="M47 16.9h13.4V18H47z" fill="' + WARP + '"/>' +
        '<ellipse cx="44.6" cy="17.4" rx="1.6" ry="1.4" fill="' + BUSSARD + '"/></g>';

    /* The corner: the starship, sitting a little below the top, among a
       few stars; the delta badge hangs below it on the thread. The ship
       is its own group, so a click can send it to warp (engage, below),
       with a flash at its bow for the jump. */
    function shipArt() {
        return '<g fill="#ffe9c2" stroke="none">' +
            '<path d="' + sparkle(6, 6, 2.6) + sparkle(54, 52, 2.4) + sparkle(18, 54, 1.8) + sparkle(42, 4, 1.6) + '"/></g>' +
            '<g transform="translate(1 9) scale(.94)"><g class="kr-season-starship__ship">' + SHIP + '</g></g>' +
            '<circle class="kr-season-starship__flash" cx="4.6" cy="22.7" r="5"/>';
    }

    // The delta badge on its thread: a gold arrowhead, notched below.
    var DELTA_PATH = 'M10 1.2C12.6 6 15 11.6 16.6 18.6 14.4 16.2 12.2 15 10 15S5.6 16.2 3.4 18.6C5 11.6 7.4 6 10 1.2z';
    var DELTA = svg('kr-season-dangler__body', '0 0 20 20',
        '<path d="' + DELTA_PATH + '" fill="' + GOLD + '" stroke="' + GOLD_EDGE + '" stroke-width=".9" stroke-linejoin="round"/>' +
        '<path d="M10 3.8c1.3 3 2.3 6.2 2.9 9.2" fill="none" stroke="#fff3c4" stroke-width=".9" stroke-linecap="round" opacity=".8"/>');

    /* A cup of tea, Earl Grey, hot, on the pumpkins' 64 x 56 box: a
       porcelain cup with a gold band on its saucer, steam rising. */
    var TEACUP = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M8 48.5c0-2.6 10.7-4.5 24-4.5s24 1.9 24 4.5-10.7 4-24 4-24-1.4-24-4z" fill="#f4f1ea" stroke="#8d8778" stroke-width=".9"/>' +
        '<path d="M44.5 28.5c4.6-.6 8 1.6 7.6 5.2-.4 3.6-4.2 5.8-8.8 5.4" fill="none" stroke="#8d8778" stroke-width="4.6" stroke-linecap="round"/>' +
        '<path d="M44.5 28.5c4.6-.6 8 1.6 7.6 5.2-.4 3.6-4.2 5.8-8.8 5.4" fill="none" stroke="#f8f6f0" stroke-width="2.8" stroke-linecap="round"/>' +
        '<path d="M16 26h32c0 9.6-3.6 16.6-9.4 19.2-1.8.8-4.2 1.2-6.6 1.2s-4.8-.4-6.6-1.2C19.6 42.6 16 35.6 16 26z" fill="#f8f6f0" stroke="#8d8778" stroke-width="1"/>' +
        '<path d="M17.4 31.6c9.6 1.6 19.6 1.6 29.2 0" fill="none" stroke="#c9a54a" stroke-width="1.1"/>' +
        '<ellipse cx="32" cy="26" rx="16" ry="2.8" fill="#9a5a24" stroke="#c9a54a" stroke-width=".8"/>' +
        '<ellipse cx="28" cy="25.6" rx="6" ry=".8" fill="#c78a4a" opacity=".7"/>' +
        '<g class="kr-season-steam" fill="none" stroke-width="1.6" stroke-linecap="round">' +
        '<path d="M25 21c-2.4-3 2.4-5 0-8.4"/><path d="M32 20c-2.6-3.4 2.6-5.6 0-9.6"/><path d="M39 21c-2.4-3 2.4-5 0-8.4"/></g>');

    /* A PADD standing on its edge: a beige slab with a dark screen, and
       on it a panel of the kind the ship's computers show, an elbow of
       colour round the corner, bars, lines of type and a block that
       blinks. */
    var PADD = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M20 4h24a3 3 0 0 1 3 3v45a3 3 0 0 1-3 3H20a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z" fill="#cbbd9f" stroke="#5e5140" stroke-width="1"/>' +
        '<rect x="20" y="8" width="24" height="38" rx="1" fill="#0c0c14" stroke="none"/>' +
        '<g stroke="none">' +
        '<path d="M21.5 19.5V12a2.5 2.5 0 0 1 2.5-2.5h6.5v3H25a1 1 0 0 0-1 1v6z" fill="' + LCARS.orange + '"/>' +
        '<rect x="31.6" y="9.5" width="5.4" height="3" rx="1.5" fill="' + LCARS.lilac + '"/>' +
        '<rect x="38.2" y="9.5" width="4.4" height="3" rx="1.5" fill="' + LCARS.blue + '"/>' +
        '<rect x="21.5" y="21" width="2.5" height="5" fill="' + LCARS.peach + '"/>' +
        '<rect x="21.5" y="27.4" width="2.5" height="7" fill="' + LCARS.lilac + '"/>' +
        '<path d="M21.5 35.8H24v6.2a1 1 0 0 0 1 1h6v2.6h-7a2.5 2.5 0 0 1-2.5-2.5z" fill="' + LCARS.orange + '"/>' +
        '<path d="M26 15.6h12M26 18.4h15M26 21.2h9M26 24h13" stroke="#8f96a8" stroke-width=".9"/>' +
        '<rect class="kr-season-padd__lit" x="26" y="28" width="6.4" height="3" rx="1.5" fill="' + LCARS.gold + '"/>' +
        '<rect x="33.6" y="28" width="8.6" height="3" rx="1.5" fill="' + LCARS.blue + '"/>' +
        '<rect x="26" y="33" width="16.2" height="3" rx="1.5" fill="' + LCARS.red + '"/>' +
        '<rect x="32.4" y="42.6" width="5" height="3" rx="1.5" fill="' + LCARS.peach + '"/>' +
        '<rect x="38.6" y="42.6" width="4" height="3" rx="1.5" fill="' + LCARS.lilac + '"/>' +
        '<circle cx="26" cy="50.5" r="1.1" fill="' + LCARS.orange + '"/><circle cx="32" cy="50.5" r="1.1" fill="' + LCARS.blue + '"/>' +
        '<circle cx="38" cy="50.5" r="1.1" fill="' + LCARS.red + '"/></g>');

    /* A flute lying on the wooden box it came in: a pale wooden tube with
       brass bands, finger holes and a flared end, on a box with a brass
       clasp. */
    var FLUTE = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M8 36l4-5h40l4 5z" fill="#9a6238" stroke="#3e2414" stroke-width="1" stroke-linejoin="round"/>' +
        '<path d="M8 36h48v16a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2z" fill="#7b4a2b" stroke="#3e2414" stroke-width="1"/>' +
        '<path d="M12 44h14M36 48h16M14 50h8" stroke="#5e3720" stroke-width=".7"/>' +
        '<rect x="30" y="37.6" width="4" height="3.2" rx=".6" fill="#d9b45a" stroke="#6b4e0e" stroke-width=".5"/>' +
        '<path d="M9 28.4h40l7-1.6v6.4l-7-1.6H9a1.6 1.6 0 0 1 0-3.2z" fill="#e3cf9f" stroke="#7a6440" stroke-width=".8"/>' +
        '<path d="M14 28.4h1.6v3.2H14zM45.4 28.4H47v3.2h-1.6z" fill="#b8913f" stroke="none"/>' +
        '<g fill="#3e2f1a" stroke="none"><circle cx="22" cy="30" r=".8"/><circle cx="27" cy="30" r=".8"/>' +
        '<circle cx="32" cy="30" r=".8"/><circle cx="37" cy="30" r=".8"/><circle cx="42" cy="30" r=".8"/></g>');

    // Between them: isolinear chips, a sparkle or two, a small delta pin.
    function chip(w, tint, band, turn) {
        return K.bit(24, 10, w, turn, '<rect x="1" y="1.5" width="22" height="7" rx="1" fill="' + tint +
            '" fill-opacity=".6" stroke="#5b6170" stroke-width=".7"/>' +
            '<rect x="2.6" y="1.5" width="4.4" height="7" fill="' + band + '"/>' +
            '<path d="M8.6 3.2h12.4" stroke="#ffffff" stroke-opacity=".7" stroke-width=".7"/>');
    }
    function glint(size, colour) {
        return K.bit(24, 24, size, 0, '<path d="' + sparkle(12, 12, 11) + '" fill="' + colour + '"/>');
    }
    var PIN = K.bit(20, 20, 9, 0, '<path d="' + DELTA_PATH + '" fill="' + GOLD + '" stroke="' + GOLD_EDGE +
        '" stroke-width="1.2" stroke-linejoin="round"/>');

    // The flyer: the starship turned to fly right, a flash at its bow for the jump.
    var FLYER = svg('kr-season-flyer__body', '0 0 64 40',
        '<g transform="translate(64 0) scale(-1 1)">' + SHIP + '</g>' +
        '<circle class="kr-season-warpflash" cx="61" cy="14.6" r="6"/>');

    var DELTA_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<path d="M16 1.5C20.4 9.6 24.6 19.6 27.4 30.4 23.6 26.6 19.8 24.6 16 24.6S8.4 26.6 4.6 30.4C7.4 19.6 11.6 9.6 16 1.5z"' +
        ' fill="' + GOLD + '" stroke="' + GOLD_EDGE + '" stroke-width="1.4" stroke-linejoin="round"/></svg>';

    /* A small starship on a 24 x 24 box as one shape, bow to the left
       (each part wound the same way, so they fill as one): for the moon,
       and for the fleet in the margins. A delta there too, repeated down
       the page, would read as a badge stamped everywhere. */
    var SHIP_24 = 'M2 10.4C4.4 8.4 9 7.6 11.4 7.6s6.6.8 8.4 2.6c-1.8 1.6-5.4 2.6-8.4 2.6S3.8 12 2 10.4z' +
        'M13 12.2h3.6l3 3.4H16z' +
        'M15.4 15.2h5.4a1.6 1.6 0 0 1 0 3.2h-5.4a1.6 1.6 0 0 1 0-3.2z' +
        'M19.6 15.4l1.4-3h1.2l-1.2 3z' +
        'M17.6 11.2h4.6a.9.9 0 0 1 0 1.8h-4.6a.9.9 0 0 1 0-1.8z';

    /* What stands in for a post's reading bar: a row of panel bars, one
       every 34px, dim ahead of the reader and lit behind. The colours
       come round in an uneven order, as on a panel. */
    var PILLS = 'abacdbadcab';
    function pill(i) {
        return '<i class="kr-season-pill kr-season-pill--' + PILLS.charAt(i % PILLS.length) + '"></i>';
    }

    /* ------------------------------------------------------------------ *
     * Its own: engage, the beaming in, the panel on the footer
     * ------------------------------------------------------------------ */

    /* Engage: a click on the corner's starship (it takes clicks, from
       this file) draws it out long, gone in a flash, and a moment later
       it drops back out of warp where it was. One jump at a time; never
       under reduced motion (the ship takes no clicks then). */
    function engage(kit) {
        if (kit.reduced) return;
        Array.prototype.forEach.call(document.querySelectorAll('.kr-season-corner__art'), function (art) {
            art.classList.add('kr-season-starship');
            art.addEventListener('click', function () {
                art.classList.add('kr-season-starship--warp');
            });
            art.addEventListener('animationend', function (e) {
                if (e.animationName === 'kr-season-engage') art.classList.remove('kr-season-starship--warp');
            });
        });
    }

    /* The footer's three pieces beam in as the footer comes into view (the
       patch sits on its top edge, so it shows first): held out of sight
       until then (--wait), then each fades in through a column of
       sparkle, one after another. Watching the footer, not the patch: a
       jump to the foot of a long page on a phone carries the patch past
       the top of the screen unseen, and it must not stay hidden. Where
       IntersectionObserver is missing, or under reduced motion, they are
       simply there. */
    function energize(kit) {
        var patch = document.querySelector('.kr-season-patch');
        if (!patch || kit.reduced || !window.IntersectionObserver) return;
        patch.classList.add('kr-season-energize--wait');
        kit.onFooter(function () {
            patch.classList.remove('kr-season-energize--wait');
            patch.classList.add('kr-season-energize');
        }, 0.1);
    }

    /* A panel of coloured bars along the top of the footer (always dark),
       rounded at both ends, which powers up from left to right as the
       footer comes into view; lit from the start under reduced motion. */
    var PANEL = [['a', 5], ['b', 2], ['c', 3], ['d', 8], ['e', 2], ['a', 3], ['f', 1], ['c', 6], ['b', 2]];
    function lcars(kit) {
        var footer = document.querySelector('.kr-footer');
        if (!footer || footer.querySelector('.kr-season-lcars')) return;
        var el = document.createElement('div');
        el.className = 'kr-season-lcars';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = PANEL.map(function (bar, i) {
            return '<span class="kr-season-lcars__bar kr-season-lcars__bar--' + bar[0] + '" style="flex-grow: ' + bar[1] +
                '; animation-delay: ' + i * 70 + 'ms"></span>';
        }).join('');
        footer.appendChild(el);
        if (kit.reduced || !window.IntersectionObserver) return;
        el.classList.add('kr-season-lcars--off');
        kit.onFooter(function () {
            el.classList.remove('kr-season-lcars--off');
            el.classList.add('kr-season-lcars--on');
        }, 0.1);
    }

    // The pointer: a gold delta, its point the hotspot, turned a little.
    var POINTER = '<path d="M16-1C19.2 5.8 21.8 13.2 23.6 22.4 21.2 20 18.6 18.8 16 18.8S10.8 20 8.4 22.4C10.2 13.2 12.8 5.8 16-1z" fill="#e2b84a"/>' +
        '<path d="M16 2C17.3 5.2 18.4 8.8 19.2 12.6" stroke="#fff3c4" stroke-width="1" fill="none" stroke-linecap="round"/>';

    K.dress({
        // The ribbon's card (season.js, ribbon).
        about: { short: 'Star Trek Day', when: '8 September',
            text: 'Star Trek premiered on American television on 8 September 1966, and fans keep the date as Star Trek Day. ' +
                'The Next Generation followed in 1987, with Sir Patrick Stewart as Captain Jean-Luc Picard, ' +
                'who taught me much of what I know about leading people.',
            link: 'https://en.wikipedia.org/wiki/Star_Trek_Day' },
        corner: shipArt, dangler: DELTA,
        // Stars, mostly points of light, some four-pointed, twinkling.
        leaves: { kind: 'twinkle', colours: ['#ffffff', '#dfe9ff', '#ffe3b8', '#c9d4ff', '#ffd27a'], per1000: 40,
            shapes: [K.DOT, sparkle(12, 12, 11)], tumble: false, glow: true, size: [6, 15] },
        // A fleet in the margins, among stars.
        backdrop: { shapes: [SHIP_24, sparkle(12, 12, 10)],
            colours: [['#9aa6b8', '#b7c0ce', '#8d97aa'], ['#ffcf8a', '#c9b3ff', '#9fd0ff']] },
        // Tea, Earl Grey, hot; the flute from its box; a PADD. No sounds yet.
        patch: [{ art: TEACUP, size: 'big' },
                { art: FLUTE, size: 'small' },
                { art: PADD, size: 'mid' }],
        strew: [chip(20, LCARS.orange, '#c25a10', -6), glint(10, '#ffe3a0'), chip(16, '#8fc8ff', '#3f7fc4', 12), PIN,
            chip(14, '#a8e6a0', '#4f9a46', -10)],
        puff: 'kr-season-puff--energize',
        flyer: FLYER, flight: 'kr-season-flyer--warp',
        favicon: DELTA_ICON, moonmark: SHIP_24,
        cursor: K.pointer(POINTER, 8, 1, -28),
        // Panel bars along a post's top, lit as far as the reader has read.
        track: { kind: 'lcars', mode: 'bits', every: 34, bit: pill },
        fog: false,
        map: null,
        lost: {
            title: 'This Page Has Boldly Gone',
            lede: 'Whatever lived at this address set a course for somewhere no one has gone before. ' +
                'The away team is still looking for it.',
            caption: 'While they search, have a photograph from somewhere closer to home. '
        },
        extra: function (kit) {
            engage(kit);
            energize(kit);
            lcars(kit);
        }
    });
})();
