/**
 * seasons/firefly-day.js: Firefly Day's art for js/season.js (see that
 * file for the pieces), for 20 September, the day Fox first aired the
 * show in 2002, in the frontier's browns and dusty golds under a field of
 * stars: a Firefly-class ship in the corner (a round head on a neck, the
 * cargo hull, the big round engine at the back and an engine pod under
 * it) with a knitted hat with earflaps hanging on the thread, stars
 * twinkling over the openers, a stack of cargo crates, a toy dinosaur and
 * a clay jug on the footer with strawberries, a spanner, a pebble and a
 * coin between them, dust from whatever is clicked, a tumbleweed rolling
 * across the foot of the window, a rope over a post that pays out as the
 * reader goes, a dusty haze along the foot of the hero, ships and stars
 * in the margins, a firefly for the favicon, the ship crossing the moon,
 * a 404 page lost in the black, and a pointer in saddle brown with a
 * firefly's glow at its tail. Every drawing is the site's own.
 * Its own:
 *   - full burn: a click on the corner's ship lights its rear engine
 *     white-hot and the ship lunges forward a moment
 *   - the toy dinosaur rears and stamps when it is clicked
 *   - on the 404 page, a wanted poster for the missing page, nailed up
 *     above the lede, swinging once as it goes up
 * Under reduced motion the ship takes no clicks, the dinosaur stays
 * where it stands and the poster simply hangs.
 *
 * Classes only this file applies (css/seasons/firefly-day.css):
 * .kr-season-pumpkin, .kr-season-dangler__body, .kr-season-ff-ship
 * (--burn, __hull, __engine), .kr-season-ff-dino, .kr-season-puff--dust,
 * .kr-season-flyer--tumble, .kr-season-ff-weed, .kr-season-track--rope,
 * .kr-season-ff-knot, .kr-season-ff-wanted (--swing).
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg, star = K.star;

    // The ship's weathered hull, its windows, and its engines' glow.
    var HULL = '#b9ab95', HULL_SHADE = '#8e7f6a', EDGE = '#3d3428', GLASS = '#2f3d4a';
    var EMBER = '#ffb347', CORE = '#fff1c4';

    function sparkle(cx, cy, r) { return star(cx, cy, r, 4, 0.28); }

    /* A Firefly-class ship in profile on a 64 x 40 box, bow to the left:
       a round head with a band of windows, on a short neck, the cargo hull
       behind it, the big round engine at the back glowing, and an engine
       pod on an arm under the hull, glowing at its tail. */
    var SHIP = '<g class="kr-season-ff-ship__hull" stroke="' + EDGE + '" stroke-width=".6" stroke-linejoin="round">' +
        '<path d="M40 25.4l4.4 5.4 2.6-.6-3.2-5.6z" fill="' + HULL_SHADE + '"/>' +
        '<path d="M37.6 32.6c0-1.6 1.4-2.8 3.2-2.8h12.6c1.6 0 2.8 1.2 2.8 2.8s-1.2 2.8-2.8 2.8H40.8c-1.8 0-3.2-1.2-3.2-2.8z" fill="' + HULL + '"/>' +
        '<path d="M15 14.4h11v6.4H15z" fill="' + HULL_SHADE + '"/>' +
        '<path d="M24 14.6c2-4.6 6.4-6.8 12.4-6.8h12c2.6 0 4.2 1.8 4.2 4.2V24c0 2-1.6 3.4-3.6 3.4H30.4c-4 0-6.4-3-6.4-6.4z" fill="' + HULL + '"/>' +
        '<path d="M2 18.4c0-3.8 3.2-6.6 7.4-6.6H16v12.4H9.4C5.2 24.2 2 22 2 18.4z" fill="' + HULL + '"/>' +
        '<circle cx="54" cy="17.4" r="8.4" fill="' + HULL_SHADE + '"/></g>' +
        '<g stroke="none">' +
        '<path d="M4.4 16.4c1.4-1.6 3.4-2.4 5.6-2.4H14v2.6H4.4z" fill="' + GLASS + '"/>' +
        '<path d="M28 21.6h20M30 24.4h16" stroke="' + HULL_SHADE + '" stroke-width=".8"/>' +
        '<path d="M34 11.6h4v4h-4zM40 11.6h4v4h-4z" fill="' + HULL_SHADE + '" opacity=".7"/>' +
        '<g class="kr-season-ff-ship__engine"><circle cx="54" cy="17.4" r="5.6" fill="' + EMBER + '"/>' +
        '<circle cx="54" cy="17.4" r="3.2" fill="' + CORE + '"/></g>' +
        '<path d="M54.2 31.2h2v2.8h-2z" fill="' + EMBER + '"/></g>';

    // The corner: the ship among stars, sitting a little below the top.
    function shipArt() {
        return '<g fill="#fff4dc" stroke="none">' +
            '<path d="' + sparkle(8, 6, 2.6) + sparkle(56, 52, 2.2) + sparkle(20, 54, 1.8) + sparkle(46, 3, 1.6) + '"/></g>' +
            '<g transform="translate(1 10) scale(.94)"><g class="kr-season-ff-ship">' + SHIP + '</g></g>';
    }

    /* A knitted hat with earflaps on the thread: orange, a yellow band,
       a red stripe, a pompom on top and the flaps hanging down. */
    var HAT = svg('kr-season-dangler__body', '0 0 20 20',
        '<path d="M3.6 12.6h3l-.5 4.6H4.2zM13.4 12.6h3l-.5 4.6h-1.9z" fill="#f28c28" stroke="#7a3a10" stroke-width=".5"/>' +
        '<path d="M3 12.4c0-5 3-8.4 7-8.4s7 3.4 7 8.4z" fill="#f28c28" stroke="#7a3a10" stroke-width=".6"/>' +
        '<path d="M3.2 10.2h13.6v2.2H3.2z" fill="#f6c445" stroke="none"/>' +
        '<path d="M4.4 8h11.2v1.1H4.4z" fill="#c8402a" stroke="none"/>' +
        '<path d="M6.4 5.6v2.2M10 4.2v3.6M13.6 5.6v2.2" stroke="#d26a18" stroke-width=".6"/>' +
        '<circle cx="10" cy="3.2" r="2.3" fill="#e0552a" stroke="#7a3a10" stroke-width=".5"/>');

    /* Cargo crates on the pumpkins' 64 x 56 box: a big crate with a
       smaller one on it, set askew, boards and corner irons drawn in. */
    var CRATES = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M8 30h36v24H8z" fill="#9a6b3c" stroke="#3a2614" stroke-width="1"/>' +
        '<path d="M8 38h36M8 46h36" stroke="#6b4626" stroke-width=".9" fill="none"/>' +
        '<path d="M8 30l36 24M44 30L8 54" stroke="#6b4626" stroke-width="1.4" fill="none"/>' +
        '<path d="M8 30h4v4H8zM40 30h4v4h-4zM8 50h4v4H8zM40 50h4v4h-4z" fill="#5a5048" stroke="none"/>' +
        '<g transform="rotate(-5 34 22)"><path d="M20 12h28v18H20z" fill="#b08254" stroke="#3a2614" stroke-width="1"/>' +
        '<path d="M20 18h28M20 24h28" stroke="#7a5332" stroke-width=".8" fill="none"/>' +
        '<path d="M28 15.4h12v6H28z" fill="#e8d9b8" stroke="#7a5332" stroke-width=".6"/>' +
        '<path d="M30 17.6h8M30 19.4h5" stroke="#9a8664" stroke-width=".7" fill="none"/></g>' +
        '<path d="M46 54c2-2 6-2 8 0z" fill="#8a7a62" stroke="#3a2614" stroke-width=".6"/>');

    /* A toy dinosaur, a plastic tyrannosaur standing on its two legs,
       its tail out behind, its little arms up. */
    var DINO = svg('kr-season-pumpkin kr-season-ff-dino', '0 0 64 56',
        '<path d="M4 41c6-1 12-4 17-8l4 4c-6 4-13 6-21 4z" fill="#4f9a4f" stroke="#245a24" stroke-width=".9" stroke-linejoin="round"/>' +
        '<path d="M28 39l-2 12h6l1-11zM37 38l1 13h6l-2-13z" fill="#4f9a4f" stroke="#245a24" stroke-width=".9" stroke-linejoin="round"/>' +
        '<path d="M24 54h9v-3h-7zM37 54h9l-1-3h-7z" fill="#3f8a3f" stroke="#245a24" stroke-width=".8"/>' +
        '<path d="M19 34c2-7 9-11 17-11 4 0 7 1 9 3l2-8c1-4 4-6 8-6h3c3 0 4 2 4 4v3c0 2-1 3-3 3h-4l-2 3c1 5-1 12-6 15-4 3-10 3-15 1-6-1-12-4-13-7z"' +
        ' fill="#5aa65a" stroke="#245a24" stroke-width=".9" stroke-linejoin="round"/>' +
        '<path d="M45 28l4 2-1 1.6-3.6-1.4zM44 31.6l3.6 2.2-1 1.4-3-2z" fill="#4f9a4f" stroke="#245a24" stroke-width=".7"/>' +
        '<circle cx="57" cy="15.4" r="1.1" fill="#1d1b1f"/>' +
        '<path d="M51 22h7l-.8 1.2-.8-1-.8 1-.8-1-.8 1-.8-1-.8 1z" fill="#ffffff" stroke="none"/>' +
        '<path d="M28 30c4 2 9 2 13 0" fill="none" stroke="#7cc47c" stroke-width="1.2" stroke-linecap="round"/>');

    /* A clay jug: a round belly, a short neck stopped with a cork, a loop
       of a handle, a pale glaze band. */
    var JUG = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M42 24c7-1 10 4 8 10-1 4-5 6-8 6" fill="none" stroke="#7a5230" stroke-width="3.4" stroke-linecap="round"/>' +
        '<path d="M26 14h12v8c5 3 8 8 8 15 0 10-6 16-14 16s-14-6-14-16c0-7 3-12 8-15z" fill="#c79a63" stroke="#5e3d1e" stroke-width="1"/>' +
        '<path d="M19 33c8 3 18 3 26 0v4c-8 3-18 3-26 0z" fill="#efe1c4" stroke="none"/>' +
        '<path d="M27 8h10l-1 6h-8z" fill="#b8956a" stroke="#5e3d1e" stroke-width=".9"/>' +
        '<path d="M24 26c-2 4-3 9-2 14" fill="none" stroke="#e6c99c" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>' +
        '<ellipse cx="32" cy="53" rx="12" ry="1.8" fill="#000000" fill-opacity=".18" stroke="none"/>');

    // Between them: strawberries, a spanner, a pebble, a coin.
    function strawberry(w, turn) {
        return K.bit(20, 20, w, turn, '<path d="M10 18.6c-5-3-7-7-6-10 1-2 3-3 6-3s5 1 6 3c1 3-1 7-6 10z" fill="#d8323c" stroke="#7a1418" stroke-width=".6"/>' +
            '<g fill="#ffe38a"><circle cx="8" cy="9" r=".6"/><circle cx="12" cy="9" r=".6"/><circle cx="10" cy="12" r=".6"/>' +
            '<circle cx="7.6" cy="12.6" r=".5"/><circle cx="12.4" cy="12.6" r=".5"/></g>' +
            '<path d="M5.6 5.6l4.4-3 4.4 3-4.4 1.2z" fill="#3f8a3a"/>');
    }
    var SPANNER = K.bit(24, 10, 20, -12, '<path d="M7 5h11" stroke="#9aa3ad" stroke-width="2.4" stroke-linecap="round"/>' +
        '<circle cx="4.4" cy="5" r="3" fill="#9aa3ad" stroke="#4a525a" stroke-width=".5"/><circle cx="4.4" cy="5" r="1.2" fill="#2a2a2a"/>' +
        '<path d="M18 2.6h4.4l-1.6 2.4 1.6 2.4H18z" fill="#9aa3ad" stroke="#4a525a" stroke-width=".5"/>');
    var PEBBLE = K.bit(24, 12, 14, 0, '<path d="M2 11c-1-4 2-8 8-9s12 2 13 6-2 3.5-6 3.5z" fill="#a08a6c" stroke="#5e4e3a" stroke-width=".8"/>');
    var COIN = K.bit(20, 20, 10, 0, '<circle cx="10" cy="10" r="8.6" fill="#d9b65a" stroke="#7a5a12" stroke-width="1"/>' +
        '<circle cx="10" cy="10" r="5.6" fill="none" stroke="#a8862e" stroke-width="1"/><path d="M8 7.4h4v5.2H8z" fill="#a8862e"/>');

    /* The flyer: a tumbleweed, a ball of dry twigs, bouncing along the
       foot of the window as it turns over (.kr-season-ff-weed). */
    var WEED = svg('kr-season-flyer__body', '0 0 48 48',
        '<g class="kr-season-ff-weed" fill="none" stroke-linecap="round">' +
        '<g stroke="#a8875a" stroke-width="1.4"><ellipse cx="24" cy="24" rx="20" ry="17"/><ellipse cx="24" cy="24" rx="15" ry="20" transform="rotate(30 24 24)"/>' +
        '<ellipse cx="24" cy="24" rx="18" ry="11" transform="rotate(-40 24 24)"/></g>' +
        '<g stroke="#7a5c36" stroke-width="1.1"><ellipse cx="24" cy="24" rx="12" ry="16" transform="rotate(70 24 24)"/>' +
        '<path d="M8 20c8 4 22-6 32 2M10 32c10-6 18 6 30-4M18 8c-2 12 8 22 4 32M30 7c4 10-6 20 0 34"/></g></g>');

    var FIREFLY_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<circle cx="20.4" cy="20.4" r="10.4" fill="#ffe27a" fill-opacity=".35"/>' +
        '<path d="M12.4 8.2c3-4 9-5 12-3-3 2-7 4-10 6zM8.2 12.4c-4 3-5 9-3 12 2-3 4-7 6-10z" fill="#d9e6f0" fill-opacity=".9" stroke="#6b7d8a" stroke-width=".8"/>' +
        '<ellipse cx="11" cy="11" rx="5" ry="3.4" transform="rotate(45 11 11)" fill="#3a2a1c"/>' +
        '<ellipse cx="19.4" cy="19.4" rx="6.4" ry="4.6" transform="rotate(45 19.4 19.4)" fill="#ffd23f" stroke="#8a5a12" stroke-width="1"/>' +
        '<path d="M8 8L4 3M10 7L8.4 2" stroke="#3a2a1c" stroke-width="1.2" stroke-linecap="round"/></svg>';

    /* The ship on a 24 x 24 box as one shape, bow to the left, each part
       wound the same way so they fill as one: for the moon, and for the
       ships in the margins. */
    var SHIP_24 = 'M2 12.4c0-1.8 1.6-3 3.6-3H8v5.4H5.6C3.6 14.8 2 14 2 12.4z' +
        'M8 10.4h4.6v3.2H8z' +
        'M11.6 10.6c1-2 3-3 6-3h4.4c1.2 0 2 .8 2 2V15c0 1-.8 1.6-1.8 1.6h-7.6c-2 0-3-1.4-3-3.2z' +
        'M16.6 11.6a3.6 3.6 0 1 1 7.2 0a3.6 3.6 0 1 1-7.2 0z' +
        'M17.6 16.4h1.4l.4 1.2H18z' +
        'M16 17.4h5.6a1.2 1.2 0 0 1 0 2.4H16a1.2 1.2 0 0 1 0-2.4z';

    // The end of the rope over a post: a knot.
    var KNOT = '<svg class="kr-season-ff-knot" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
        '<circle cx="8" cy="8" r="5.6" fill="#b08850" stroke="#5e3d1e" stroke-width="1"/>' +
        '<path d="M4.6 6.4c2 1.4 4.8 1.4 6.8 0M4.6 9.6c2-1.4 4.8-1.4 6.8 0" fill="none" stroke="#5e3d1e" stroke-width=".9"/></svg>';

    /* ------------------------------------------------------------------ *
     * Its own: full burn
     * ------------------------------------------------------------------ */

    /* A click on the corner's ship (it takes clicks, from this file)
       lights its rear engine white-hot and the ship lunges forward a
       moment, then settles. Never under reduced motion (the ship takes
       no clicks then). */
    function burn(kit) {
        if (kit.reduced) return;
        Array.prototype.forEach.call(document.querySelectorAll('.kr-season-corner__art'), function (art) {
            var ship = art.querySelector('.kr-season-ff-ship');
            if (!ship) return;
            ship.addEventListener('click', function () {
                art.classList.remove('kr-season-ff-ship--burn');
                void art.getBoundingClientRect();
                art.classList.add('kr-season-ff-ship--burn');
            });
            art.addEventListener('animationend', function (e) {
                if (e.animationName === 'kr-season-ff-lunge') art.classList.remove('kr-season-ff-ship--burn');
            });
        });
    }

    /* The 404 page: a wanted poster for the missing page, nailed up above
       the lede, a parchment with WANTED across the top, a drawing of the
       page itself and a reward in platinum. It swings once on its top
       nail as it is put up; under reduced motion it simply hangs. */
    function wanted(kit) {
        var lede = document.querySelector('.kr-lost__lede');
        if (!lede || !document.getElementById('kr-lost-canvas') || document.querySelector('.kr-season-ff-wanted')) return;
        var el = document.createElement('div');
        el.className = 'kr-season-ff-wanted' + (kit.reduced ? '' : ' kr-season-ff-wanted--swing');
        el.setAttribute('aria-hidden', 'true');
        var serif = ' font-family="Lora, Georgia, serif" text-anchor="middle" fill="#3a2614"';
        el.innerHTML = svg('', '0 0 160 200',
            '<path d="M8 6l144 2 2 184-146 2z" fill="#ead6a6" stroke="#8a6a3e" stroke-width="1.4" stroke-linejoin="round"/>' +
            '<path d="M8 6l10 14-10 8M152 8l-8 12 10 6M154 192l-12-6 10-10M8 194l12-8-10-8" fill="#d8bf86" stroke="none"/>' +
            '<text x="80" y="38" font-size="27" font-weight="700" letter-spacing="2"' + serif + '>WANTED</text>' +
            '<path d="M24 46h112" stroke="#6b4626" stroke-width="1.2"/>' +
            '<path d="M58 58h34l12 12v50H58z" fill="#fbf5e6" stroke="#3a2614" stroke-width="1.6" stroke-linejoin="round"/>' +
            '<path d="M92 58v12h12" fill="none" stroke="#3a2614" stroke-width="1.6" stroke-linejoin="round"/>' +
            '<path d="M65 80h28M65 88h32M65 96h24" stroke="#9a8664" stroke-width="1.4"/>' +
            '<path d="M70 108c4-4 14-4 18 0" fill="none" stroke="#3a2614" stroke-width="1.6" stroke-linecap="round"/>' +
            '<text x="80" y="144" font-size="13" font-style="italic"' + serif + '>for going missing</text>' +
            '<text x="80" y="170" font-size="15" font-weight="700" letter-spacing="1"' + serif + '>REWARD</text>' +
            '<text x="80" y="186" font-size="12"' + serif + '>200 platinum</text>' +
            '<circle cx="80" cy="12" r="2.4" fill="#5a5048"/>');
        lede.parentNode.insertBefore(el, lede);
    }

    K.dress({
        // The ribbon's card (season.js, ribbon).
        about: { short: 'Firefly Day', when: '20 September',
            text: 'Firefly first aired on Fox on 20 September 2002. Fox cancelled it after eleven of its fourteen episodes had ' +
                'been shown, and strong DVD sales got it a film, Serenity, in 2005. There is no official fan day, so this one is mine.',
            link: 'https://en.wikipedia.org/wiki/Firefly_(TV_series)' },
        corner: shipArt, dangler: HAT,
        // Stars over the openers, mostly points of light, in dusty golds.
        leaves: { kind: 'twinkle', colours: ['#fff4dc', '#f2d39a', '#e8b77a', '#ffffff', '#d9c7a8'], per1000: 34,
            shapes: [K.DOT, sparkle(12, 12, 11)], tumble: false, glow: true, size: [6, 14] },
        // Ships among the stars in the margins.
        backdrop: { shapes: [SHIP_24, sparkle(12, 12, 10)],
            colours: [['#a8987e', '#8e7f6a', '#b9ab95'], ['#e8b77a', '#f2d39a', '#d9c7a8']] },
        // The cargo, a toy dinosaur, a jug. No sounds yet.
        patch: [{ art: CRATES, size: 'big' },
                { art: DINO, size: 'small' },
                { art: JUG, size: 'mid' }],
        strew: [strawberry(12, -10), SPANNER, PEBBLE, COIN, strawberry(10, 16)],
        puff: 'kr-season-puff--dust',
        flyer: WEED, flight: 'kr-season-flyer--tumble',
        favicon: FIREFLY_ICON, moonmark: SHIP_24,
        // A saddle-brown pointer with a firefly's glow at its tail.
        cursor: K.cursor('#b5773a', '<circle cx="6" cy="6" r="4.6" fill="#ffe27a" fill-opacity=".45"/>' +
            '<circle cx="6" cy="6" r="2.8" fill="#ffd23f" stroke="#5a3a12" stroke-width=".9"/>', '#3a2410'),
        // A rope over a post, paid out as far as the reader has read.
        track: { kind: 'rope', mode: 'fill', tip: KNOT },
        map: null,
        lost: {
            title: 'This Page Is Lost in the Black',
            lede: 'Whatever lived at this address took a job out past the edge of the map, and the job went sideways. ' +
                'It could be anywhere out there.',
            caption: 'While it limps home, have a photograph from somewhere in the \'verse. '
        },
        extra: function (kit) {
            burn(kit);
            wanted(kit);
        }
    });
})();
