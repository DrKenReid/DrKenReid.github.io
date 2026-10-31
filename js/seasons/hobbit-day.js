/**
 * seasons/hobbit-day.js: Hobbit Day's art for js/season.js (see that file
 * for the pieces), for 22 September, the birthday Bilbo and Frodo
 * Baggins share, in the greens, browns and golds of the Shire: a round
 * green door with a brass knob in the middle, set in a bank of turf with
 * a round window lit within, in the corner, and the Ring hanging on its
 * chain below it; gold rings like it turning over as they drift down
 * over the openers; a party cake
 * with its candles lit, a basket of mushrooms and a pipe on its stand
 * blowing smoke rings on the footer, with acorns, a slice of seed cake, a
 * coin and an oak leaf between them; smoke rings from whatever is clicked;
 * a firework dragon swooping across as the footer arrives; a road over a
 * post from the round door to the Mountain, with a small traveller who
 * walks there by the middle of the post and back again by its end; a
 * morning mist along the foot of the hero in the light theme; acorns,
 * oak leaves, mushrooms and smoke rings in the margins; the round door
 * for the favicon; the Ring crossing the moon; a long pipe for the
 * pointer; and a 404 page gone on an adventure. Every drawing is the
 * site's own.
 * Its own:
 *   - the Ring: a click on it (it hangs on its chain from the corner) puts
 *     it on, and for a moment the page goes grey and misty and the pointer
 *     vanishes
 *   - on the 404 page, a round green door that swings open on a lamplit
 *     hall when it is clicked, and closes again
 *   - a second-breakfast clock on the footer, which tells the reader by
 *     their own clock which meal it is and which comes next
 *   - a hand-drawn map of the Shire along the top of the footer (from
 *     992px), the road running off it to the east
 *   - there and back again: the traveller over a post (see the track)
 * Under reduced motion the Ring does nothing, the door opens and shuts
 * without swinging, the smoke rings hold still and no dragon flies.
 *
 * Classes only this file applies (css/seasons/hobbit-day.css):
 * .kr-season-pumpkin, .kr-season-dangler__body, .kr-season-hob-glint,
 * .kr-season-hob-smoke, .kr-season-puff--rings, .kr-season-flyer--dragon,
 * .kr-season-hob-spark, .kr-season-track--journey, .kr-season-hob-walker,
 * .kr-season-hob-marks (__home, __mountain), .kr-season-hob-mist,
 * .kr-season-hob-door (--open, __hall, __leaf, __frame),
 * .kr-season-hob-clock (__face, __hour, __minute, __now, __next),
 * .kr-season-hob-map.
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg, star = K.star;

    var DOOR = '#2f6b3a', DOOR_DARK = '#1f4a27', BRASS = '#d9b65a', BRASS_DARK = '#8a6a1e';
    var TURF = '#5f9a3a', TURF_DARK = '#3f7a2a', STONE = '#b8ad96', STONE_DARK = '#7a705e';
    var WOOD = '#8a5a32', WOOD_DARK = '#4e3218', GOLD = '#e2b84a', GOLD_DARK = '#8a6a1e', LAMP = '#ffe9a8';

    function fix(v) { return K.fix(+v); }

    /* A round door at (cx, cy) of radius r: green planks, a darker rim, the
       brass knob in its very middle. */
    function roundDoor(cx, cy, r) {
        var lines = '';
        [-0.5, 0, 0.5].forEach(function (k) {
            var x = cx + k * r, h = Math.sqrt(r * r - (k * r) * (k * r)) * 0.94;
            lines += 'M' + fix(x) + ' ' + fix(cy - h) + 'V' + fix(cy + h);
        });
        return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + DOOR + '" stroke="' + DOOR_DARK + '" stroke-width="' + fix(r * 0.08) + '"/>' +
            '<path d="' + lines + '" stroke="' + DOOR_DARK + '" stroke-width="' + fix(r * 0.05) + '" fill="none" opacity=".7"/>' +
            '<circle cx="' + cx + '" cy="' + cy + '" r="' + fix(r * 0.17) + '" fill="' + BRASS + '" stroke="' + BRASS_DARK + '" stroke-width="' + fix(r * 0.04) + '"/>' +
            '<circle cx="' + fix(cx - r * 0.05) + '" cy="' + fix(cy - r * 0.05) + '" r="' + fix(r * 0.06) + '" fill="#fff6d6"/>';
    }

    /* The corner: a bank of turf reaching in from the top right, a round
       window lit within, the round door in a ring of stone, grass along the
       bank's foot and a few flowers. The Ring hangs below on its chain. */
    function hillArt() {
        var blades = '';
        for (var x = 24; x < 64; x += 3.2) {
            var y = 40 + Math.sin(x * 0.5) * 1.6 + (x > 50 ? 2 : 0);
            blades += 'M' + fix(x) + ' ' + fix(y) + 'l' + fix(-1 + (x % 2)) + ' ' + fix(-3 - (x % 3)) + 'l1.4 ' + fix(3 + (x % 3));
        }
        return '<path d="M64 0V46C56 46 46 45 38 42 30 39 24 32 22 22 20 13 22 5 25 0z" fill="' + TURF + '"/>' +
            '<path d="M64 36C56 38 46 38 38 35 31 32 27 27 25 20" fill="none" stroke="' + TURF_DARK + '" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>' +
            '<path d="' + blades + '" fill="' + TURF_DARK + '" stroke="none"/>' +
            '<circle cx="31" cy="10" r="4.4" fill="' + LAMP + '" stroke="' + WOOD_DARK + '" stroke-width="1.2"/>' +
            '<path d="M31 5.6v8.8M26.6 10h8.8" stroke="' + WOOD_DARK + '" stroke-width=".9"/>' +
            '<circle cx="47" cy="22" r="13.4" fill="' + STONE + '" stroke="' + STONE_DARK + '" stroke-width="1"/>' +
            roundDoor(47, 22, 11) +
            '<g stroke="none"><circle cx="28" cy="38" r="1.3" fill="#f2c94c"/><circle cx="34" cy="41" r="1.1" fill="#e8476a"/>' +
            '<circle cx="58" cy="43" r="1.3" fill="#f2c94c"/><circle cx="22.6" cy="30" r="1" fill="#e8476a"/></g>';
    }

    // The Ring on its chain: a plain gold band, a glint that comes and goes.
    var RING = svg('kr-season-dangler__body', '0 0 20 20',
        '<path d="M10 3.4v2.6" stroke="' + GOLD_DARK + '" stroke-width=".8"/>' +
        '<path fill-rule="evenodd" d="M3.6 12.4a6.4 5.4 0 1 0 12.8 0a6.4 5.4 0 1 0-12.8 0zM5.8 12.4a4.2 3.4 0 1 1 8.4 0a4.2 3.4 0 1 1-8.4 0z" fill="' + GOLD + '" stroke="' + GOLD_DARK + '" stroke-width=".6"/>' +
        '<path d="M5 10.4a6 5 0 0 1 4-3" fill="none" stroke="#fff6d6" stroke-width=".9" stroke-linecap="round"/>' +
        '<path class="kr-season-hob-glint" d="' + star(14.6, 8.6, 2.6, 4, 0.25) + '" fill="#ffffff"/>');

    /* A party cake on the pumpkins' 64 x 56 box: three tiers iced in cream,
       berries, 111 piped on the middle tier, and five candles, their flames
       the shared glow (they flicker). */
    var CAKE = svg('kr-season-pumpkin', '0 0 64 56',
        '<ellipse cx="32" cy="52.4" rx="26" ry="3" fill="#e8e2d4" stroke="#9a9080" stroke-width=".8"/>' +
        '<path d="M10 38h44v13H10z" fill="#e9c98f" stroke="#8a6a3e" stroke-width=".9"/>' +
        '<path d="M16 28.6h32V38H16z" fill="#f0d6a6" stroke="#8a6a3e" stroke-width=".9"/>' +
        '<path d="M22 20.4h20v8.2H22z" fill="#f6e2bc" stroke="#8a6a3e" stroke-width=".9"/>' +
        '<path d="M10 38c3 3 5 3 7 0s4 3 7 0 4 3 7 0 4 3 7 0 4 3 7 0 4 3 7 0 2 2 2 0M16 28.6c2.6 2.6 4.4 2.6 6.4 0s4 2.6 6.4 0 4 2.6 6.4 0 4 2.6 6.4 0 3.4 2.6 6.4 0M22 20.4c2 2 3.4 2 5 0s3.4 2 5 0 3.4 2 5 0 3.4 2 5 0" fill="#fffaf0" stroke="none"/>' +
        '<g fill="#c8323c" stroke="none"><circle cx="14" cy="45" r="1.6"/><circle cx="24" cy="46" r="1.6"/><circle cx="40" cy="46" r="1.6"/><circle cx="50" cy="45" r="1.6"/></g>' +
        '<text x="32" y="36.4" text-anchor="middle" font-family="Lora, Georgia, serif" font-size="6.4" font-weight="700" fill="#a0522d">111</text>' +
        '<g stroke="none">' + [24, 28, 32, 36, 40].map(function (x, i) {
            return '<path d="M' + (x - 0.9) + ' ' + (12 + (i % 2)) + 'h1.8v' + (8.4 - (i % 2)) + 'h-1.8z" fill="' + ['#7ab8e8', '#e8476a', '#f2c94c', '#7ab8e8', '#e8476a'][i] + '"/>' +
                '<path class="kr-season-glow" d="M' + x + ' ' + (6.6 + (i % 2)) + 'c1.4 1.8 1.8 3 1.8 3.8a1.8 1.8 0 0 1-3.6 0c0-.8.4-2 1.8-3.8z"/>';
        }).join('') + '</g>');

    // A wicker basket heaped with brown mushrooms.
    var BASKET = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M14 26c0-14 36-14 36 0" fill="none" stroke="' + WOOD + '" stroke-width="2.4"/>' +
        '<g stroke="' + WOOD_DARK + '" stroke-width=".7">' +
        '<path d="M20 22c-3-6 7-9 9-3z" fill="#b08a6a"/><path d="M28 20c-2-8 10-9 10-1z" fill="#c49a76"/>' +
        '<path d="M37 22c0-7 10-6 9 1z" fill="#a8805e"/><path d="M14 26c-1-6 8-7 8-1z" fill="#b8916e"/>' +
        '<path d="M44 26c0-5 8-5 7 1z" fill="#b08a6a"/></g>' +
        '<path d="M10 26h44l-5 26H15z" fill="#b8874a" stroke="' + WOOD_DARK + '" stroke-width="1"/>' +
        '<path d="M11.4 32h41.2M12.6 38h38.8M13.8 44h36.4M20 26l2 26M28 26l1 26M36 26l-1 26M44 26l-2 26" stroke="' + WOOD + '" stroke-width="1" fill="none"/>');

    /* A long pipe resting on a little stand, its bowl's ember aglow, smoke
       rings rising from it (.kr-season-hob-smoke). */
    var PIPE = svg('kr-season-pumpkin', '0 0 64 56',
        '<g class="kr-season-hob-smoke" fill="none" stroke="#cfc8bc" stroke-width="1.6">' +
        '<ellipse cx="46" cy="24" rx="4.4" ry="2.4"/><ellipse cx="46" cy="24" rx="4.4" ry="2.4"/><ellipse cx="46" cy="24" rx="4.4" ry="2.4"/></g>' +
        '<path d="M14 46h20v6H14z" fill="' + WOOD + '" stroke="' + WOOD_DARK + '" stroke-width=".9"/>' +
        '<path d="M18 46v-6h3v6M27 46v-6h3v6" fill="' + WOOD_DARK + '" stroke="none"/>' +
        '<path d="M4 41.4c10-1.6 24-2 36-2.6" fill="none" stroke="' + WOOD_DARK + '" stroke-width="2.6" stroke-linecap="round"/>' +
        '<path d="M4 41.4c10-1.6 24-2 36-2.6" fill="none" stroke="#a8784a" stroke-width="1.4" stroke-linecap="round"/>' +
        '<path d="M38 30h14l-1.6 11c-.4 2.4-2.4 4-5.4 4s-5-1.6-5.4-4z" fill="' + WOOD + '" stroke="' + WOOD_DARK + '" stroke-width="1"/>' +
        '<ellipse cx="45" cy="30" rx="7" ry="1.8" fill="#3a2414" stroke="' + WOOD_DARK + '" stroke-width=".6"/>' +
        '<ellipse class="kr-season-glow" cx="45" cy="30" rx="4" ry=".9"/>');

    // Between them: acorns, a slice of seed cake, a coin, an oak leaf.
    function acorn(w, turn) {
        return K.bit(20, 20, w, turn, '<path d="M5 9c0 6 2.4 9 5 9s5-3 5-9z" fill="#b8874a" stroke="' + WOOD_DARK + '" stroke-width=".7"/>' +
            '<path d="M4 9.4c0-3 2.6-5 6-5s6 2 6 5z" fill="#7a5a32" stroke="' + WOOD_DARK + '" stroke-width=".7"/>' +
            '<path d="M10 4.4V2" stroke="' + WOOD_DARK + '" stroke-width="1.2" stroke-linecap="round"/>');
    }
    var SEEDCAKE = K.bit(24, 16, 16, -6, '<path d="M2 14L20 4l2 4-18 8z" fill="#e9c98f" stroke="#8a6a3e" stroke-width=".7"/>' +
        '<path d="M2 14l18-10" stroke="#fffaf0" stroke-width="1.2"/>' +
        '<g fill="#7a5a32"><circle cx="9" cy="11" r=".5"/><circle cx="13" cy="10" r=".5"/><circle cx="16" cy="8.6" r=".5"/></g>');
    var COIN = K.bit(20, 20, 9, 0, '<circle cx="10" cy="10" r="8.4" fill="' + GOLD + '" stroke="' + GOLD_DARK + '" stroke-width="1"/>' +
        '<circle cx="10" cy="10" r="5.4" fill="none" stroke="' + GOLD_DARK + '" stroke-width=".8"/>');
    var OAK = 'M12 2c1.6 1.6 1 3.2 2.6 3.6s3-1 3.6.6-1.6 2.4-1 3.6 2.8.6 2.8 2.4-2.6 1.6-2.4 3 2 1.8 1 3.2-3-.4-3.8.8-.4 2.4-2.8 3.2V23h-1v-1.6' +
        'c-2.4-.8-1.6-2-2.8-3.2s-2.8.4-3.8-.8-1-1.8 1-3.2.6-1.2-2.4-3-.6-2.4 1-2.4.6-3.6-1-3.6c.6-1.6 2-.2 3.6-.6S10.4 3.6 12 2z';

    /* The flyer: a dragon of fireworks, wings beating (the shared flap),
       sparks streaming from its tail and twinkling (.kr-season-hob-spark). */
    var SPARKS = [[8, 30, 1.6], [16, 34, 1.2], [22, 27, 1.4], [30, 33, 1], [36, 29, 1.3], [14, 24, 1], [26, 38, 1.1]];
    var DRAGON = svg('kr-season-flyer__body', '0 0 150 64',
        '<g stroke="none">' + SPARKS.map(function (s, i) {
            return '<circle class="kr-season-hob-spark" style="animation-delay: -' + (i * 0.17).toFixed(2) + 's" cx="' + s[0] + '" cy="' + s[1] + '" r="' + s[2] + '" fill="' + (i % 2 ? '#ffd34d' : '#ff9a3c') + '"/>';
        }).join('') + '</g>' +
        '<path class="kr-season-flyer__wing kr-season-flyer__wing--l" d="M78 30C70 14 60 6 46 4c8 8 12 14 14 22 6 0 12 2 18 4z" fill="#ff8a2a" stroke="#c8402a" stroke-width="1"/>' +
        '<path d="M40 31c10-4 22-6 34-4 10 2 20 1 30-3 8-3 16-3 22 0l-4 4c-6-2-12-2-18 2-10 6-22 8-34 7-10-1-20 0-30-6z" fill="#ff6a2a" stroke="#c8402a" stroke-width="1"/>' +
        '<path d="M40 31C30 30 22 34 14 32" fill="none" stroke="#ff6a2a" stroke-width="3" stroke-linecap="round"/>' +
        '<path d="M126 24l10-6 8 2-2 4 6 3-8 3-6-1-6 2z" fill="#ff6a2a" stroke="#c8402a" stroke-width="1"/>' +
        '<path d="M134 18l2-6M138 19l4-5" stroke="#ffd34d" stroke-width="1.4" stroke-linecap="round"/>' +
        '<circle cx="138" cy="22" r="1" fill="#fff4b0"/>' +
        '<path class="kr-season-flyer__wing kr-season-flyer__wing--r" d="M84 29C92 12 104 4 118 2c-8 8-12 16-14 24-6 0-12 2-20 3z" fill="#ffb347" stroke="#c8402a" stroke-width="1"/>' +
        '<path d="M60 31c10-2 22-2 34-1M70 34c8 0 16 0 24-2" stroke="#ffd34d" stroke-width="1" fill="none" stroke-linecap="round"/>');

    var DOOR_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<circle cx="16" cy="16" r="15" fill="' + STONE + '" stroke="' + STONE_DARK + '" stroke-width="1"/>' + roundDoor(16, 16, 12) + '</svg>';

    /* A smoke ring (and the Ring, crossing the moon) on a 24 x 24 box: an
       oval band, its outer edge wound one way and its inner the other, so
       the middle stays open. */
    var RING_24 = 'M3 12a9 6 0 1 0 18 0a9 6 0 1 0-18 0zM6 12a6 3.6 0 1 1 12 0a6 3.6 0 1 1-12 0z';
    var RING_MOON = 'M7 12a5 3.6 0 1 0 10 0a5 3.6 0 1 0-10 0zM8.8 12a3.2 2.2 0 1 1 6.4 0a3.2 2.2 0 1 1-6.4 0z';
    /* The Ring over the openers, on the same box: a heavy round band, seen
       face on; the tumble turns it edge on and back as it falls. */
    var ONE_RING_24 = 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0zM6 12a6 6 0 1 1 12 0a6 6 0 1 1-12 0z';
    var MUSHROOM_24 = 'M3 13c0-6 4-9 9-9s9 3 9 9zM10 13h4l1 8h-6z';
    var ACORN_24 = 'M6 11c0 7 3 11 6 11s6-4 6-11zM5 11.4c0-3.6 3-6 7-6s7 2.4 7 6zM11.4 5.4V2h1.2v3.4z';

    // The traveller over a post: a small figure with a pack and a stick.
    var WALKER = '<svg class="kr-season-hob-walker" viewBox="0 0 16 18" aria-hidden="true" focusable="false">' +
        '<path d="M12.6 3.4L14 17" stroke="' + WOOD_DARK + '" stroke-width="1" stroke-linecap="round"/>' +
        '<path d="M5 6.6c-2 .4-3 2-3 4.4h3.6z" fill="#7a5a32"/>' +
        '<path d="M5.4 6h5l1.6 7.4H4z" fill="' + DOOR + '"/>' +
        '<path d="M5.6 13.4l-.8 3.6M9.6 13.4l1 3.6" stroke="#8a6a4a" stroke-width="1.4" stroke-linecap="round"/>' +
        '<circle cx="8" cy="3.4" r="2.4" fill="#f0c8a0"/><path d="M5.6 2.8c.6-2 4-2.4 4.8 0" fill="#7a4a1e"/></svg>';

    // The pointer: a long pipe, its mouthpiece the hotspot.
    var POINTER = '<path d="M15.4-3.4h1.2l.4 1.6v26h-2v-26z" fill="#4e3218"/>' +
        '<path d="M15.6-.4v24" stroke="#a8784a" stroke-width=".8"/>' +
        '<path d="M11 22.6h10l-1.2 8.6c-.3 1.8-1.8 3-3.8 3s-3.5-1.2-3.8-3z" fill="#8a5a32"/>' +
        '<ellipse cx="16" cy="22.6" rx="5" ry="1.4" fill="#3a2414"/><ellipse cx="16" cy="22.6" rx="3" ry=".7" fill="#ff9a3c"/>';

    /* ------------------------------------------------------------------ *
     * Its own: the Ring, the door, the clock, the map, the road
     * ------------------------------------------------------------------ */

    /* A click on the Ring (as on any dangler, it also drops on its chain)
       puts it on: for a moment a grey mist closes in round the page, its
       colours drain away and the pointer vanishes. One at a time; never
       under reduced motion. */
    function ring(kit) {
        if (kit.reduced) return;
        var root = document.documentElement, on = false;
        Array.prototype.forEach.call(document.querySelectorAll('.kr-season-dangler'), function (d) {
            d.addEventListener('click', function () {
                if (on) return;
                on = true;
                var was = root.style.getPropertyValue('--kr-season-cursor');
                var mist = document.createElement('div');
                mist.className = 'kr-season-hob-mist';
                mist.setAttribute('aria-hidden', 'true');
                document.body.appendChild(mist);
                root.style.setProperty('--kr-season-cursor', 'none');
                mist.addEventListener('animationend', function () {
                    mist.remove();
                    root.style.setProperty('--kr-season-cursor', was);
                    on = false;
                });
            });
        });
    }

    /* On the 404 page, above the lede: a round green door in its ring of
       stone. A click swings it open on a hall lit by a lamp, a grey hat on
       the peg, and it closes again a few seconds later; a second click
       shuts it at once. Under reduced motion it opens and shuts without
       swinging. */
    function door(kit) {
        var lede = document.querySelector('.kr-lost__lede');
        if (!lede || !document.getElementById('kr-lost-canvas') || document.querySelector('.kr-season-hob-door')) return;
        var el = document.createElement('div');
        el.className = 'kr-season-hob-door';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML =
            '<div class="kr-season-hob-door__hall">' + svg('', '0 0 100 100',
                '<circle cx="50" cy="50" r="40" fill="#5a3a1e"/>' +
                '<circle cx="50" cy="50" r="40" fill="url(#kr-season-hob-glow)"/>' +
                '<defs><radialGradient id="kr-season-hob-glow" cx="62%" cy="38%" r="60%"><stop offset="0" stop-color="#ffe9a8" stop-opacity=".95"/>' +
                '<stop offset=".5" stop-color="#e8a24a" stop-opacity=".55"/><stop offset="1" stop-color="#5a3a1e" stop-opacity="0"/></radialGradient></defs>' +
                '<path d="M14 74h72" stroke="#3a2414" stroke-width="2"/><path d="M20 74c10-6 50-6 60 0" fill="#7a4a22"/>' +
                '<path d="M62 26v10" stroke="#3a2414" stroke-width="1.2"/><circle cx="62" cy="40" r="4.4" fill="#fff4c4"/>' +
                '<path d="M30 40h8" stroke="#3a2414" stroke-width="1.6" stroke-linecap="round"/>' +
                '<path d="M28 41l6-16 6 16z" fill="#9aa0a8" stroke="#5a5e66" stroke-width=".8"/>' +
                '<path d="M25.4 41.4h17.2" stroke="#7a7e86" stroke-width="2.2" stroke-linecap="round"/>') + '</div>' +
            '<div class="kr-season-hob-door__leaf">' + svg('', '0 0 100 100', roundDoor(50, 50, 40)) + '</div>' +
            '<div class="kr-season-hob-door__frame">' + svg('', '0 0 100 100',
                '<circle cx="50" cy="50" r="45" fill="none" stroke="' + STONE + '" stroke-width="9"/>' +
                '<circle cx="50" cy="50" r="49.4" fill="none" stroke="' + STONE_DARK + '" stroke-width="1.2"/>' +
                '<path d="M50 4.6v9M18 18l6.4 6.4M82 18l-6.4 6.4M4.6 50h9M95.4 50h-9" stroke="' + STONE_DARK + '" stroke-width="1.2"/>') + '</div>';
        lede.parentNode.insertBefore(el, lede);
        var shut = 0;
        el.addEventListener('click', function () {
            clearTimeout(shut);
            var open = el.classList.toggle('kr-season-hob-door--open');
            if (open) shut = setTimeout(function () { el.classList.remove('kr-season-hob-door--open'); }, 4500);
        });
    }

    /* The second-breakfast clock, on the footer's top edge at its right: a
       clock face showing the reader's own time, the meal that time is for
       and the next. It ticks once a minute, only while the page is shown. */
    var MEALS = [[7, 'Breakfast'], [9, 'Second breakfast'], [11, 'Elevenses'], [13, 'Luncheon'],
        [15, 'Afternoon tea'], [18, 'Dinner'], [21, 'Supper'], [23, 'Bed, after a late snack']];
    function meals(now) {
        var h = now.getHours() + now.getMinutes() / 60, at = MEALS.length - 1;
        for (var i = 0; i < MEALS.length; i++) if (h >= MEALS[i][0]) at = i;
        if (h < MEALS[0][0]) at = MEALS.length - 1;
        var next = MEALS[(at + 1) % MEALS.length];
        return { now: MEALS[at][1], next: next[1] === MEALS[MEALS.length - 1][1] ? 'Bed' : next[1], at: next[0] };
    }
    function clock() {
        var footer = document.querySelector('.kr-footer');
        if (!footer || footer.querySelector('.kr-season-hob-clock')) return;
        var ticks = '';
        for (var i = 0; i < 12; i++) {
            var a = i * Math.PI / 6;
            ticks += 'M' + fix(24 + Math.sin(a) * 17) + ' ' + fix(24 - Math.cos(a) * 17) + 'L' + fix(24 + Math.sin(a) * 20) + ' ' + fix(24 - Math.cos(a) * 20);
        }
        var el = document.createElement('div');
        el.className = 'kr-season-hob-clock';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = svg('kr-season-hob-clock__face', '0 0 48 48',
            '<circle cx="24" cy="24" r="22" fill="#fbf3dc" stroke="' + WOOD_DARK + '" stroke-width="2"/>' +
            '<path d="' + ticks + '" stroke="' + WOOD_DARK + '" stroke-width="1.4"/>' +
            '<path class="kr-season-hob-clock__hour" d="M24 24V12.6" stroke="' + WOOD_DARK + '" stroke-width="2.6" stroke-linecap="round"/>' +
            '<path class="kr-season-hob-clock__minute" d="M24 24V7.4" stroke="' + DOOR + '" stroke-width="1.6" stroke-linecap="round"/>' +
            '<circle cx="24" cy="24" r="2" fill="' + BRASS + '" stroke="' + BRASS_DARK + '" stroke-width=".6"/>') +
            '<span><span class="kr-season-hob-clock__now"></span><span class="kr-season-hob-clock__next"></span></span>';
        footer.appendChild(el);
        var hour = el.querySelector('.kr-season-hob-clock__hour'), minute = el.querySelector('.kr-season-hob-clock__minute');
        var nowEl = el.querySelector('.kr-season-hob-clock__now'), nextEl = el.querySelector('.kr-season-hob-clock__next');
        var timer = 0;
        function draw() {
            var now = new Date(), m = meals(now);
            hour.setAttribute('transform', 'rotate(' + fix((now.getHours() % 12 + now.getMinutes() / 60) * 30) + ' 24 24)');
            minute.setAttribute('transform', 'rotate(' + (now.getMinutes() * 6) + ' 24 24)');
            nowEl.textContent = m.now;
            nextEl.textContent = 'Next: ' + m.next.toLowerCase() + ', ' + (m.at < 10 ? '0' : '') + m.at + ':00';
        }
        function run() {
            clearInterval(timer);
            if (document.hidden) return;
            draw();
            timer = setInterval(draw, 30000);
        }
        document.addEventListener('visibilitychange', run);
        run();
    }

    /* A hand-drawn map of the Shire along the top of the footer, between
       the patch and the clock (from 992px): woods, the Hill with its door,
       the Water winding past Hobbiton to the pool at Bywater, and the road
       running east off the edge of the map. */
    function map() {
        var footer = document.querySelector('.kr-footer');
        if (!footer || footer.querySelector('.kr-season-hob-map')) return;
        var trees = '';
        [[14, 14], [21, 18], [28, 12], [35, 17], [20, 24], [298, 44], [306, 48], [314, 42], [322, 47]].forEach(function (t) {
            trees += '<circle cx="' + t[0] + '" cy="' + t[1] + '" r="3"/><path d="M' + t[0] + ' ' + (t[1] + 3) + 'v2.6"/>';
        });
        var label = ' font-family="Lora, Georgia, serif" font-style="italic" font-size="8.4" stroke="none" fill="currentColor"';
        var el = document.createElement('div');
        el.className = 'kr-season-hob-map';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = svg('', '0 0 360 60',
            '<g fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round">' + trees +
            '<path d="M0 40C34 35 56 46 90 39s56-8 90-2 68 9 100 3 56-6 80-3" stroke-width="1.4"/>' +
            '<path d="M0 42.6C34 37.6 56 48.6 90 41.6s56-8 90-2 68 9 100 3 56-6 80-3" stroke-width=".6"/>' +
            '<path d="M96 27q16-17 32 0"/><path d="M104 23q8-6 16 0" stroke-width=".7"/><circle cx="112" cy="24.4" r="1.5"/>' +
            '<path d="M62 24q6-6 12 0M168 20q5-5 10 0M222 24q6-6 12 0" stroke-width=".8"/>' +
            '<ellipse cx="200" cy="45" rx="9" ry="3"/>' +
            '<path d="M126 31C168 28 222 23 266 20s62-6 78-6" stroke-dasharray="3 3"/>' +
            '<path d="M344 9.4l8 4.6-8 4.6" stroke-width="1.2"/>' +
            '<path d="' + star(336, 47, 5, 4, 0.3) + '" stroke-width=".8"/></g>' +
            '<text x="112" y="37"' + label + ' text-anchor="middle">Hobbiton</text>' +
            '<text x="112" y="11"' + label + ' text-anchor="middle">The Hill</text>' +
            '<text x="200" y="58"' + label + ' text-anchor="middle">Bywater</text>' +
            '<text x="44" y="54"' + label + ' text-anchor="middle">The Water</text>' +
            '<text x="284" y="12"' + label + ' text-anchor="middle">East Road</text>' +
            '<text x="336" y="38"' + label + ' text-anchor="middle" font-style="normal" font-size="6.4">N</text>');
        footer.appendChild(el);
    }

    /* There and back again: over a post, the round door at the left end of
       the road and the Mountain at the right, the traveller between them
       (the track's tip, its place from path below). The track is built
       when the reading bar is, which may be after this runs. */
    function marks() {
        function place() {
            var el = document.querySelector('.kr-season-track--journey');
            if (!el || el.querySelector('.kr-season-hob-marks')) return !!el;
            var m = document.createElement('span');
            m.className = 'kr-season-hob-marks';
            m.innerHTML = '<span class="kr-season-hob-marks__home">' + svg('', '0 0 16 16',
                '<circle cx="8" cy="8" r="7.4" fill="' + STONE + '" stroke="' + STONE_DARK + '" stroke-width=".8"/>' + roundDoor(8, 8, 5.8)) + '</span>' +
                '<span class="kr-season-hob-marks__mountain">' + svg('', '0 0 20 16',
                '<path d="M1 15.4L10 1.4l9 14z" fill="#7a7e86" stroke="#4a4e56" stroke-width=".8" stroke-linejoin="round"/>' +
                '<path d="M7 6.2L10 1.4l3 4.8-1.6-.8-1.4 1.2-1.4-1.2z" fill="#ffffff"/>') + '</span>';
            el.appendChild(m);
            return true;
        }
        if (place() || !document.querySelector('.blog-post, .story-post') || !window.MutationObserver) return;
        var watch = new MutationObserver(function () { if (place()) watch.disconnect(); });
        watch.observe(document.body, { childList: true });
        setTimeout(function () { watch.disconnect(); }, 8000);
    }

    K.dress({
        // The ribbon's card (season.js, ribbon).
        about: { short: 'Hobbit Day', when: '22 September',
            text: 'The birthday Bilbo and Frodo Baggins share. The Hobbit came out on 21 September 1937, and the American ' +
                'Tolkien Society proclaimed Hobbit Day, and Tolkien Week around it, in 1978. Fans throw parties, eat well ' +
                'and go barefoot.',
            link: 'https://en.wikipedia.org/wiki/Hobbit_Day' },
        corner: hillArt, dangler: RING,
        // The Ring drifting down, turning over, glowing gold.
        leaves: { kind: 'fall', colours: ['#f2c94c', GOLD, '#ffd966', '#d9a52e'], per1000: 5,
            shapes: [ONE_RING_24], tumble: true, glow: true, size: [16, 30] },
        // Acorns, oak leaves, mushrooms and smoke rings in the margins.
        backdrop: { shapes: [ACORN_24, OAK, MUSHROOM_24, RING_24],
            colours: [['#b8874a', '#8a5a32'], [TURF, '#8a9a3a', '#c9962c'], ['#b08a6a', '#c49a76'], ['#cfc8bc', '#bdb5a6']] },
        // The cake, the basket, the pipe. No sounds yet.
        patch: [{ art: CAKE, size: 'big' },
                { art: BASKET, size: 'small' },
                { art: PIPE, size: 'mid' }],
        strew: [acorn(12, -12), SEEDCAKE, COIN, K.leaf(OAK, '#c9962c', 15, 30), acorn(10, 20)],
        puff: 'kr-season-puff--rings',
        flyer: DRAGON, flight: 'kr-season-flyer--dragon',
        favicon: DOOR_ICON, moonmark: RING_MOON,
        cursor: K.pointer(POINTER, 2, 2, -45),
        // The road over a post: there by the middle, and back again by the end.
        track: { kind: 'journey', mode: 'fill', tip: WALKER,
            path: function (done) { return done <= 0.5 ? done * 2 : 2 - done * 2; } },
        map: null,
        lost: {
            title: 'This Page Has Gone on an Adventure',
            lede: 'Whatever lived at this address ran out of the door one morning without so much as a pocket ' +
                'handkerchief, and has not come back again yet.',
            caption: 'While it is away, have a photograph from somewhere green. '
        },
        extra: function (kit) {
            ring(kit);
            door(kit);
            clock();
            map();
            marks();
        }
    });
})();
