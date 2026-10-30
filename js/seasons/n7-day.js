/**
 * seasons/n7-day.js: N7 Day's art for js/season.js (see that file for
 * the pieces), for 7 November, the yearly day for Mass Effect, in N7 red
 * and white on gunmetal: a frigate in profile in the corner (a long nose,
 * a dark dorsal plate with a red stripe, swept wings, two fins and a
 * drive glowing at its stern) with a dog tag hanging on the thread; blue
 * motes of the element that drives the ships rising over the openers in
 * place of stars; an armoured helmet with a red and white stripe, a fish
 * tank and a model ship on its stand on the footer, with credit chits, a
 * tube of medi-gel, a shard of the blue element and a datapad between
 * them; orange flecks of a holographic interface from whatever is
 * clicked; the frigate crossing as the footer arrives; a red and white
 * stripe over a post that runs as the reader goes; small frigates and
 * striped chevrons in the margins; a red glow along the foot of the hero
 * in the dark theme; a striped favicon; the frigate in the moon; and a
 * 404 page gone through the relay. Every drawing is the site's own.
 * Its own:
 *   - the choice: a blue prompt and a red prompt rise in the corner of the
 *     page's opener; a click picks one, a sweep of its colour crosses the
 *     opener, and the frigate's drive, its trail and the stripe's tip burn
 *     blue or red for the rest of the visit (kept in this tab). Under
 *     reduced motion the prompts hold still and no sweep crosses.
 *   - the fish in the tank swim and bubbles rise from it
 *
 * Classes only this file applies (css/seasons/n7-day.css):
 * .kr-season-pumpkin, .kr-season-dangler__body, .kr-season-n7-drive,
 * .kr-season-n7-fish (--back), .kr-season-n7-bubble, .kr-season-puff--holo,
 * .kr-season-flyer--frigate, .kr-season-track--n7, .kr-season-n7-tip,
 * .kr-season-n7-choice (--shown, --gone, --hero, __paragon, __renegade, __glyph),
 * .kr-season-n7-sweep (--paragon, --renegade), and data-n7-choice on
 * <html>.
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg, star = K.star;

    var RED = '#c8102e', WHITE = '#ffffff', STEEL = '#3d4552', STEEL_DARK = '#2a2d33', HULL = '#d9dde3', EDGE = '#15171b';
    var EEZO = '#4fa8ff', ORANGE = '#ff8a1f';
    var CHOICE_KEY = 'kr-n7-choice';

    function sparkle(cx, cy, r) { return star(cx, cy, r, 4, 0.28); }

    /* A frigate in profile on a 64 x 40 box, bow to the left: the far wing
       behind, a long pale hull, a dark plate along its back with a red
       stripe, two swept fins, the near wing, a cockpit window at the nose
       and the drive at the stern (.kr-season-n7-drive, coloured by the
       visit's choice). */
    var SHIP = '<g stroke="' + EDGE + '" stroke-width=".5" stroke-linejoin="round">' +
        '<path d="M26 25l18 8h8l-12-8z" fill="#3b4048"/>' +
        '<path d="M47 16.2l11-7.2h2l-7 7.4z" fill="#2f3540"/>' +
        '<path d="M2 21l14-3 30-2.4 12 .8 4 3-2 3.6-14 2.4-30-.4z" fill="' + HULL + '"/>' +
        '<path d="M16 18l30-2.4 12 .8-2 2.2-16 .8-22 1z" fill="' + STEEL + '"/>' +
        '<path d="M44 16l10-9h3l-7 9.2z" fill="' + STEEL + '"/>' +
        '<path d="M24 24.6l18 7.4h8l-12-7.6z" fill="#c4c9d0"/></g>' +
        '<g stroke="none">' +
        '<path d="M18 19.6l38-1.6.4.8-38 1.7z" fill="' + RED + '"/>' +
        '<path d="M5 20.2l7-1.4 1 1.6-7 1z" fill="#2b3a4a"/>' +
        '<path d="M6 20.6l3.6-.7" stroke="#9fd0ff" stroke-width=".5"/>' +
        '<path d="M22 22.6h24" stroke="#aab1bb" stroke-width=".6"/>' +
        '<ellipse class="kr-season-n7-drive" cx="61.4" cy="19.6" rx="1.7" ry="2.6"/></g>';

    // The corner: the frigate among a few stars, a little below the top.
    function shipArt() {
        return '<g fill="#eaf4ff" stroke="none">' +
            '<path d="' + sparkle(8, 6, 2.4) + sparkle(54, 52, 2.2) + sparkle(18, 54, 1.7) + sparkle(36, 3, 1.5) + '"/></g>' +
            '<g transform="translate(1 8) scale(.94)">' + SHIP + '</g>';
    }

    // A dog tag on the thread: a dark tag with a hole, a red and white stripe.
    var TAG = svg('kr-season-dangler__body', '0 0 20 20',
        '<rect x="4.6" y="2.6" width="10.8" height="15.6" rx="3.2" fill="' + STEEL_DARK + '" stroke="#aab1bb" stroke-width=".7"/>' +
        '<circle cx="10" cy="5.2" r="1.1" fill="#0b0c0e" stroke="#aab1bb" stroke-width=".4"/>' +
        '<path d="M5 13.4l10.4-4v1.8L5 15.2z" fill="' + RED + '"/><path d="M5 15.2l10.4-4v.9L5 16.1z" fill="' + WHITE + '"/>');

    /* An armoured helmet on the pumpkins' 64 x 56 box: a gunmetal shell, a
       dark visor with a blue glint, a red and white stripe down one side,
       a lamp at the temple. */
    var HELMET = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M14 34c0-14 8-26 18-26s18 12 18 26v8c0 4-3 8-8 9H22c-5-1-8-5-8-9z" fill="#3a3f47" stroke="' + EDGE + '" stroke-width="1"/>' +
        '<path d="M39.6 9.8c2.4 1.2 4.4 3.2 5.8 5.6L44 46h-3.4z" fill="' + RED + '" stroke="none"/>' +
        '<path d="M45.4 15.4c.8 1.4 1.4 2.8 1.8 4.4L45.8 46H44z" fill="' + WHITE + '" stroke="none"/>' +
        '<path d="M19 29c5-3.4 21-3.4 26 0v7c-5 3.4-21 3.4-26 0z" fill="#1b2533" stroke="' + EDGE + '" stroke-width=".8"/>' +
        '<path d="M22 30.4c4-1.6 9-1.8 13-1" fill="none" stroke="#7cc4ff" stroke-width="1.1" stroke-linecap="round"/>' +
        '<path d="M22 51h20l-2 4H24z" fill="' + STEEL_DARK + '" stroke="none"/>' +
        '<circle cx="16.6" cy="36" r="1.8" fill="' + ORANGE + '" stroke="none"/>' +
        '<path d="M20 18c3-4 7-6 12-6" fill="none" stroke="#8a929e" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>');

    /* A fish tank: glass on a dark base with a lid, water weed, two fish
       that swim (.kr-season-n7-fish) and bubbles that rise
       (.kr-season-n7-bubble). */
    var TANK = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M10 18h44v32H10z" fill="#bfe6f5" fill-opacity=".45" stroke="#5b6a75" stroke-width="1.2"/>' +
        '<path d="M10 22h44" stroke="#7fc8e6" stroke-width="1"/>' +
        '<path d="M16 50c0-6 2-10-1-16M20 50c1-5-1-8 2-12M48 50c-1-4 1-7-1-11" fill="none" stroke="#3f9a5a" stroke-width="1.5" stroke-linecap="round"/>' +
        '<g class="kr-season-n7-fish"><path d="M24 32c4-4 10-4 12 0-2 4-8 4-12 0zM36 32l4-3v6z" fill="#ff9a3c" stroke="none"/>' +
        '<circle cx="27" cy="31.4" r=".7" fill="#1d1b1f"/></g>' +
        '<g class="kr-season-n7-fish kr-season-n7-fish--back"><path d="M38 42c3-3 8-3 10 0-2 3-7 3-10 0zM48 42l3-2v4z" fill="' + EEZO + '" stroke="none"/>' +
        '<circle cx="40.4" cy="41.6" r=".6" fill="#1d1b1f"/></g>' +
        '<g fill="none" stroke="#ffffff" stroke-width=".6" stroke-opacity=".9">' +
        '<circle class="kr-season-n7-bubble" cx="30" cy="27" r="1"/><circle class="kr-season-n7-bubble" cx="33" cy="30" r=".8"/>' +
        '<circle class="kr-season-n7-bubble" cx="44" cy="36" r="1"/></g>' +
        '<path d="M9 15.6h46v3H9z" fill="' + STEEL + '" stroke="' + EDGE + '" stroke-width=".6"/>' +
        '<path d="M8 50h48v4H8z" fill="' + STEEL_DARK + '" stroke="' + EDGE + '" stroke-width=".6"/>');

    // A model of the frigate on a stand, its own drive glowing.
    var MODEL = svg('kr-season-pumpkin', '0 0 64 56',
        '<g transform="translate(-1 12) scale(1.02)">' + SHIP + '</g>' +
        '<path d="M30 36h6v12h-6z" fill="' + STEEL_DARK + '" stroke="' + EDGE + '" stroke-width=".6"/>' +
        '<path d="M16 48h34l3 5H13z" fill="' + STEEL + '" stroke="' + EDGE + '" stroke-width=".8"/>' +
        '<path d="M26 50.4h14" stroke="#c9a54a" stroke-width="1.2"/>');

    // Between them: credit chits, medi-gel, a shard of the element, a datapad.
    function chit(w, turn) {
        return K.bit(24, 14, w, turn, '<rect x="1.5" y="1.5" width="21" height="11" rx="1.6" fill="#2f3540" stroke="#8a929e" stroke-width=".7"/>' +
            '<path d="M4 4.6h16" stroke="#d9b65a" stroke-width="1.6"/><path d="M4 9h7" stroke="#8a929e" stroke-width=".8"/>');
    }
    var MEDIGEL = K.bit(24, 12, 16, -10, '<rect x="2" y="3" width="16" height="6" rx="3" fill="#59c27a" stroke="#1f5e36" stroke-width=".7"/>' +
        '<rect x="17" y="4.2" width="5" height="3.6" rx=".8" fill="#e6e9ee" stroke="#5b6a75" stroke-width=".6"/>' +
        '<path d="M6 6h6M9 4.2v3.6" stroke="#ffffff" stroke-width="1"/>');
    var SHARD = K.bit(20, 20, 10, 12, '<path d="M10 1.6l5 7.4-5 9.4-5-9.4z" fill="' + EEZO + '" stroke="#1d4f8a" stroke-width=".7"/>' +
        '<path d="M10 1.6v16.8M5 9h10" stroke="#cfe8ff" stroke-width=".5"/>');
    var DATAPAD = K.bit(24, 16, 15, 6, '<rect x="1.5" y="1.5" width="21" height="13" rx="1.6" fill="' + STEEL_DARK + '" stroke="#8a929e" stroke-width=".7"/>' +
        '<rect x="3.6" y="3.6" width="16.8" height="8.8" rx=".6" fill="#2a1a0a"/>' +
        '<path d="M5.4 6h9M5.4 8.4h12M5.4 10.6h6" stroke="' + ORANGE + '" stroke-width=".9"/>');

    // The flyer: the frigate, turned to fly right.
    var FLYER = svg('kr-season-flyer__body', '0 0 64 40', '<g transform="translate(64 0) scale(-1 1)">' + SHIP + '</g>');

    var STRIPE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<rect x="2" y="2" width="28" height="28" rx="6" fill="#2a2d33"/>' +
        '<path d="M2 21L30 9v5L2 26z" fill="#c8102e"/><path d="M2 26l28-12v2.6L2 28.6z" fill="#ffffff"/></svg>';

    /* The frigate on a 24 x 24 box as one shape, bow to the left, each part
       wound the same way so they fill as one: for the moon and the
       margins. With it, a striped chevron for the margins. */
    var SHIP_24 = 'M2 13L9 11L20 9.6L21.6 10.2L22 12.6L21 14.4L9 14.6Z' +
        'M10 14.4L16 14.4L21 18.4L18 18.4Z' +
        'M17 10L21 6L22.4 6L20 10.2Z';
    var CHEVRON_24 = 'M4 16L12 8L20 16L17 16L12 11L7 16Z';

    // The tip of the stripe over a post: a chevron in the visit's colour.
    var TIP = '<svg class="kr-season-n7-tip" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
        '<path d="M3 4l7 4-7 4z"/><path d="M8 4l7 4-7 4z" opacity=".55"/></svg>';

    /* ------------------------------------------------------------------ *
     * Its own: the choice
     * ------------------------------------------------------------------ */

    function stored() {
        try { return sessionStorage.getItem(CHOICE_KEY); } catch (e) { return null; }
    }

    /* The two prompts rise in the lower corner of the page's opener a
       moment after it loads, pulse a while and fade if left alone. A click
       on one keeps that colour for the visit (data-n7-choice on <html>,
       which the stylesheet reads) and sends a sweep of it across the
       opener; once a colour is picked no prompt comes back. Decoration:
       aria-hidden, never focused. */
    function choice(kit) {
        var root = document.documentElement;
        var kept = stored();
        if (kept === 'paragon' || kept === 'renegade') { root.setAttribute('data-n7-choice', kept); return; }
        var host = document.querySelector('.welcome-area, .kr-opener, .breadcrumb-area');
        if (!host || host.querySelector('.kr-season-n7-choice')) return;
        var el = document.createElement('div');
        el.className = 'kr-season-n7-choice' + (host.classList.contains('welcome-area') ? ' kr-season-n7-choice--hero' : '');
        el.setAttribute('aria-hidden', 'true');
        var glyph = '<svg class="kr-season-n7-choice__glyph" viewBox="0 0 20 20" focusable="false">' +
            '<rect x="5" y="2.6" width="10" height="14.8" rx="5" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
            '<path d="M10 2.6v6.2" stroke="currentColor" stroke-width="1.4"/></svg>';
        el.innerHTML = '<span class="kr-season-n7-choice__paragon">' + glyph + '</span>' +
            '<span class="kr-season-n7-choice__renegade">' + glyph + '</span>';
        host.appendChild(el);
        var shown = setTimeout(function () { el.classList.add('kr-season-n7-choice--shown'); }, kit.reduced ? 0 : 1200);
        var gone = setTimeout(function () { el.classList.add('kr-season-n7-choice--gone'); }, 14000);
        function pick(which) {
            clearTimeout(shown);
            clearTimeout(gone);
            root.setAttribute('data-n7-choice', which);
            try { sessionStorage.setItem(CHOICE_KEY, which); } catch (e) {}
            el.classList.add('kr-season-n7-choice--gone');
            if (kit.reduced) return;
            var sweep = document.createElement('span');
            sweep.className = 'kr-season-n7-sweep kr-season-n7-sweep--' + which;
            sweep.setAttribute('aria-hidden', 'true');
            host.appendChild(sweep);
            sweep.addEventListener('animationend', function () { sweep.remove(); });
        }
        el.firstChild.addEventListener('click', function () { pick('paragon'); });
        el.lastChild.addEventListener('click', function () { pick('renegade'); });
    }

    K.dress({
        // The ribbon's card (season.js, ribbon).
        about: { short: 'N7 Day', when: '7 November',
            text: 'An informal yearly celebration of Mass Effect. The date reads as N7, the special forces rank that ' +
                'Commander Shepard holds, and BioWare often marks the day with news or a trailer.',
            link: 'https://en.wikipedia.org/wiki/Mass_Effect' },
        corner: shipArt, dangler: TAG,
        // Motes of the blue element rising slowly, glowing, in place of stars.
        leaves: { kind: 'rise', colours: ['#7cc4ff', EEZO, '#b7e0ff', '#ffffff'], per1000: 16,
            shapes: [K.DOT, 'M12 4l5 8-5 8-5-8z'], tumble: false, glow: true, size: [6, 13] },
        // Frigates and striped chevrons in the margins.
        backdrop: { shapes: [SHIP_24, CHEVRON_24],
            colours: [['#8a929e', '#aab1bb', '#6b7380'], [RED, '#e05a5a']] },
        // The helmet, the fish tank, the model ship. No sounds yet.
        patch: [{ art: HELMET, size: 'big' },
                { art: TANK, size: 'small' },
                { art: MODEL, size: 'mid' }],
        strew: [chit(16, -6), MEDIGEL, SHARD, DATAPAD, chit(12, 14)],
        puff: 'kr-season-puff--scatter kr-season-puff--holo',
        flyer: FLYER, flight: 'kr-season-flyer--frigate',
        favicon: STRIPE_ICON, moonmark: SHIP_24,
        // A gunmetal pointer with a red and white stripe at its tail.
        cursor: K.cursor('#3d4552', '<path d="M1 8.6L11 3.4v2.4L1 11z" fill="' + RED + '" stroke="#ffffff" stroke-width=".5"/>' +
            '<path d="M1 11l10-5.2v1.2L1 12.2z" fill="#ffffff"/>', '#0b0c0e'),
        // A red and white stripe over a post, a chevron at its end.
        track: { kind: 'n7', mode: 'fill', tip: TIP },
        map: null,
        lost: {
            title: 'This Page Went Through the Relay',
            lede: 'Whatever lived at this address went through the relay at the edge of the map, ' +
                'and nothing has come back through it yet.',
            caption: 'While we wait, have a photograph from somewhere a little closer to home. '
        },
        extra: choice
    });
})();
