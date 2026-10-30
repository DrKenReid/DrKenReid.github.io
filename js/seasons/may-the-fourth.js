/**
 * seasons/may-the-fourth.js: the art for two days, May the Fourth (4 May,
 * the light side, in blue) and the Revenge of the Fifth the day after (5
 * May, the dark side, in red; KR_SEASONS gives it `art: 'may-the-fourth'`),
 * for js/season.js (see that file for the pieces). Every drawing is the
 * site's own evocation of Star Wars, no logo, still or blueprint, and
 * picked by K.season.key where the days differ.
 * Both days: stars twinkling over the openers, a lightsaber hilt floating
 * over a stone on the footer whose blade ignites when clicked (a silver
 * hilt and a blue blade on the 4th, a black hilt and a red one on the
 * 5th), blaster bolts from whatever is clicked, a lightsaber in place of
 * a post's reading bar (its hilt at the left, its blade reaching as far
 * as the reader has read), a lightsaber favicon, a pointer with a small
 * hilt at its tail, a nebula along the hero's foot in the dark theme, and
 * a 404 page that is not the one you want.
 * The 4th: twin suns setting over the dunes in the corner, a training
 * remote on its thread, a domed astromech droid and a moisture
 * vaporator on the footer with a blue crystal, a nut, sand and sparkles
 * between them, a four-winged starfighter crossing (and one crossing the
 * moon), and starfighters in the margins. Its own:
 *   - a click on the corner jumps to light speed, the stars over the
 *     opener streaking past for a moment
 *   - on the 404 page, a crawl of text receding into the stars over the
 *     opener, in its own words, behind the page's real title
 * The 5th: a battle station the size of a moon in the corner, a probe
 * droid dangling from its thread, a two-legged walker and a mouse droid
 * on the footer with red crystals and nuts between them, a fighter with
 * a ball cockpit between hexagonal wings crossing (and one crossing the
 * moon), and those fighters in the margins. Its own:
 *   - a click on the station charges its dish and fires it
 *   - a click on any page opener (not on a link) cuts a red saber slash
 *     across it where it was clicked, which glows and fades
 * Under reduced motion the corner takes no clicks, no crawl moves (it
 * stands still, part way up) and no slash is cut.
 *
 * Classes only this file applies (css/seasons/may-the-fourth.css):
 * .kr-season-pumpkin, .kr-season-dangler__body, .kr-season-flyer__body,
 * .kr-season-saber (__float, __blade), .kr-season-droid (__dome,
 * __lamp), .kr-season-vaporator (__lamp), .kr-season-strider,
 * .kr-season-mousedroid, .kr-season-puff--bolts,
 * .kr-season-flyer--fourwing, .kr-season-flyer--hexwing,
 * .kr-season-fighter__engine, .kr-season-track--saber,
 * .kr-season-blade-tip, .kr-season-jump, .kr-season-warp (__streak),
 * .kr-season-warping, .kr-season-crawl (__text, __episode, __title),
 * .kr-season-station (--fire, __dish, __ray, __beam, __flash, __core),
 * .kr-season-slashes, .kr-season-slash.
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg, star = K.star, bar = K.bar;
    var FIFTH = K.season && K.season.key === 'revenge-of-the-fifth';

    function fix(v) { return K.fix(+v); }

    // A four-pointed sparkle about (cx, cy).
    function sparkle(cx, cy, r) { return star(cx, cy, r, 4, 0.28); }

    /* The day's colours: starlight and a blue blade on the 4th, embers and
       a red blade on the 5th; a crystal's fill, facets and edge; the
       ships in the margins; the hilts' metals. */
    var DAY = FIFTH ? {
        stars: ['#ffffff', '#ffd2c2', '#ff8a6a', '#ff5a4a', '#ffe0a0'],
        dust: ['#ff8a6a', '#ffb08a', '#ffe0a0'],
        blade: '#ff3b3b', sparkle: '#ffb08a', pointer: '#ff5a4a', pointerEdge: '#3a0c0c',
        crystal: ['#e8352a', '#ffb0a0', '#7a1410'],
        ships: ['#8e939c', '#a9aeb7', '#6f747d'],
        hilt: '#2a2c31', hiltEdge: '#8d929b', grip: '#b9bdc5'
    } : {
        stars: ['#ffffff', '#d6ecff', '#a8d8ff', '#fff3b0', '#cfd8ff'],
        dust: ['#a8d8ff', '#ffe27a', '#cfd8ff'],
        blade: '#3f9fff', sparkle: '#ffe27a', pointer: '#5fb8ff', pointerEdge: '#0c2340',
        crystal: ['#4fb0ff', '#d6f0ff', '#1a4f8a'],
        ships: ['#9fb0c4', '#c3cfdd', '#8396ad'],
        hilt: '#c3c8d0', hiltEdge: '#4a4f58', grip: '#1f2228'
    };
    // The droids' blue, their whites and greys, and the hulls' greys.
    var BLUE = '#2f6fd0', WHITE = '#eef1f5', SILVER = '#cfd6df', STEEL = '#9aa3af', EDGE = '#56606e';
    var HULL = '#aeb2ba', HULL_DARK = '#5d626b', HULL_MID = '#8d929b', PANEL = '#d6d9de';
    var RED_EYE = '#ff3b2b';

    /* ------------------------------------------------------------------ *
     * The corners: twin suns over the dunes, or a battle station
     * ------------------------------------------------------------------ */

    /* The 4th: a round window on a desert at dusk, two suns going down
       over the dunes, the larger half behind the far ridge, a vaporator
       standing on it, and a few stars out round the window. The remote
       hangs on its thread below (x 35.5). Each corner gets its own ids:
       one of the two is always display: none, and a gradient or clip
       found in a hidden svg draws nothing. */
    var windows = 0;
    function sunsArt() {
        var id = 'kr-season-dusk-' + (++windows);
        var disc = 'M14 27a22 22 0 1 0 44 0a22 22 0 1 0-44 0z';
        return '<defs><linearGradient id="' + id + '-sky" x1="0" x2="0" y1="0" y2="1">' +
            '<stop offset="0" stop-color="#2c2a66"/><stop offset=".55" stop-color="#b8577a"/>' +
            '<stop offset=".8" stop-color="#f29a52"/></linearGradient>' +
            '<clipPath id="' + id + '-clip"><path d="' + disc + '"/></clipPath></defs>' +
            '<g fill="' + DAY.sparkle + '" stroke="none">' +
            '<path d="' + sparkle(7, 8, 2.8) + sparkle(9, 46, 1.8) + sparkle(4, 26, 1.4) + sparkle(60, 54, 2) + '"/></g>' +
            '<g clip-path="url(#' + id + '-clip)" stroke="none">' +
            '<path d="M14 5h44v44H14z" fill="url(#' + id + '-sky)"/>' +
            '<path d="' + sparkle(24, 11, 1.4) + sparkle(46, 9, 1) + sparkle(35, 7, .9) + '" fill="#fff3cc" opacity=".8"/>' +
            '<circle cx="43" cy="29" r="9" fill="#ffd27a" opacity=".3"/>' +
            '<circle cx="43" cy="29" r="5.8" fill="#ffc861"/>' +
            '<circle cx="29" cy="20.6" r="5.4" fill="#fff0b8" opacity=".3"/>' +
            '<circle cx="29" cy="20.6" r="3.4" fill="#fff6d8"/>' +
            '<path d="M51 33.4v-7.2h1.4v7.2M49.6 28h4.2M50 31h3.4M51.7 26.2v-2.6" fill="none" stroke="#5a3a3a" stroke-width=".9"/>' +
            '<path d="M10 40C22 33 38 32.4 62 34v20H10z" fill="#dca560"/>' +
            '<path d="M10 40C22 33 38 32.4 62 34" fill="none" stroke="#f6cf8e" stroke-width=".8"/>' +
            '<path d="M10 52c10-8.4 26-11.6 52-10.4V54H10z" fill="#b97a34"/>' +
            '<path d="M10 52c10-8.4 26-11.6 52-10.4" fill="none" stroke="#d99a4e" stroke-width=".7"/></g>' +
            '<path d="' + disc + '" fill="none" stroke-width="1.4"/>';
    }

    /* The 5th: a battle station the size of a moon, its dish in the upper
       left, a trench round its middle and lit panels over it, a shadow on
       its far side. The beam it fires (hidden until then, fire below)
       gathers from four rays in front of the dish and reaches down to the
       lower left of the box, where it flashes. */
    function stationArt() {
        return '<g fill="' + DAY.sparkle + '" stroke="none">' +
            '<path d="' + sparkle(8, 8, 2.6) + sparkle(14, 46, 1.8) + sparkle(58, 54, 2.2) + sparkle(56, 4, 1.5) + '"/></g>' +
            '<circle cx="39" cy="24" r="16" fill="' + HULL + '" stroke="' + HULL_DARK + '" stroke-width=".7"/>' +
            '<path d="M39 8A16 16 0 0 1 39 40A10 16 0 0 0 39 8z" transform="rotate(35 39 24)" fill="#1c1f26" opacity=".28" stroke="none"/>' +
            '<path d="M23.2 25.4Q39 29.8 54.8 25.4" fill="none" stroke="' + HULL_DARK + '" stroke-width="1.3"/>' +
            '<path d="M28 33h3M34 34.4h4M42 34h3M30 37.4h5M40 37.8h3M47 30.6h3M45 14.6h4M48.6 19h3M40 11.4h3M27 29h2.6M51.6 23h2"' +
            ' fill="none" stroke="' + PANEL + '" stroke-width=".7"/>' +
            '<circle class="kr-season-station__dish" cx="32" cy="17" r="5" fill="' + HULL_MID + '" stroke="#4f545c" stroke-width=".6"/>' +
            '<circle cx="32" cy="17" r="2.6" fill="none" stroke="#6b7079" stroke-width=".5"/>' +
            '<circle cx="32" cy="17" r="1.1" fill="' + PANEL + '" stroke="none"/>' +
            '<path class="kr-season-station__ray" d="M28.6 13.6L25 21.4M35.4 13.6L25 21.4M28.4 20.6L25 21.4M35.6 20.4L25 21.4"/>' +
            '<path class="kr-season-station__beam" d="M25 21.4L5.4 54.6" pathLength="1"/>' +
            '<g class="kr-season-station__flash"><circle cx="5.4" cy="54.6" r="4.6" opacity=".45"/>' +
            '<circle class="kr-season-station__core" cx="5.4" cy="54.6" r="2.2"/></g>';
    }

    // The 4th's remote on its thread: a grey training ball with its band,
    // emitters and two stubs, a shine on its upper left.
    var REMOTE = svg('kr-season-dangler__body', '0 0 20 20',
        '<path d="M2.6 10H.8M17.4 10h1.8" stroke="#4e555e" stroke-width="1.2"/>' +
        '<circle cx="10" cy="10" r="7.2" fill="#a9b0b9" stroke="#4e555e" stroke-width=".6"/>' +
        '<path d="M2.8 10.4c4.6 1.4 9.8 1.4 14.4 0" fill="none" stroke="#6f7781" stroke-width="1.3"/>' +
        '<circle cx="10" cy="6.2" r="1.3" fill="#2a2f36"/><circle cx="6" cy="13.4" r="1.1" fill="#2a2f36"/>' +
        '<circle cx="14" cy="13.4" r="1.1" fill="#2a2f36"/>' +
        '<circle cx="10" cy="6.2" r=".5" fill="#ff7a4a"/><circle cx="6" cy="13.4" r=".45" fill="#ff7a4a"/>' +
        '<circle cx="14" cy="13.4" r=".45" fill="#ff7a4a"/>' +
        '<circle cx="7" cy="6.4" r="1.6" fill="#ffffff" opacity=".45"/>');

    // The 5th's probe droid on its thread: a dark head with antennae, a
    // red eye, and its arms hanging below.
    var PROBE = svg('kr-season-dangler__body', '0 0 20 20',
        '<path d="M8.4 3L7.2 0M11.6 3L13 .4M10 2.4V0" stroke="#3a3d44" stroke-width=".7"/>' +
        '<path d="M9.2 11.4c-1 2.4-3 4.6-5.6 6.6M10 11.8v7.6M10.8 11.4c1 2.4 3 4.6 5.6 6.6' +
        'M9.4 11.6c-.4 2.6-1.4 5-2.8 7.2M10.6 11.6c.4 2.6 1.4 5 2.8 7.2" fill="none" stroke="#3a3d44" stroke-width=".8" stroke-linecap="round"/>' +
        '<path d="M7.4 10.6h5.2l-.6 1.8H8z" fill="#2b2d33"/>' +
        '<circle cx="10" cy="7" r="4.8" fill="#2b2d33" stroke="#60646c" stroke-width=".5"/>' +
        '<path d="M5.6 8.6h8.8" stroke="#60646c" stroke-width=".5"/>' +
        '<circle cx="10" cy="7.4" r="1.4" fill="' + RED_EYE + '"/>' +
        '<circle cx="7.4" cy="5.8" r=".6" fill="#ff8a6a"/><circle cx="12.6" cy="5.8" r=".6" fill="#ff8a6a"/>');

    /* ------------------------------------------------------------------ *
     * The footer: a saber on both days, two droids or a walker and a mouse
     * ------------------------------------------------------------------ */

    /* A lightsaber hilt on the pumpkins' 64 x 56 box, floating over a flat
       stone with two pebbles lifted beside it, its blade (hidden until it
       is clicked) reaching up out of the box. The 4th's hilt is silver
       with a black grip; the 5th's is black with silver rings and a
       flared emitter. */
    function saber() {
        var h = DAY.hilt, e = DAY.hiltEdge, g = DAY.grip;
        var hilt = FIFTH ?
            '<path d="M26.2 17.4l2.8 5.8h6l2.8-5.8-2.6 1.6h-6.4z" fill="' + h + '" stroke="' + e + '" stroke-width=".6" stroke-linejoin="round"/>' +
            '<rect x="28.2" y="23.2" width="7.6" height="17.6" rx=".8" fill="' + h + '" stroke="' + e + '" stroke-width=".6"/>' +
            '<path d="M28.2 27.2h7.6M28.2 31.2h7.6M28.2 35.2h7.6" stroke="' + g + '" stroke-width="1.1"/>' +
            '<rect x="35.8" y="28.4" width="1.6" height="2.6" fill="' + RED_EYE + '"/>' +
            '<path d="M28.4 40.8h7.2l1.8 2.6H26.6z" fill="#55585f" stroke="' + e + '" stroke-width=".5"/>' :
            '<path d="M26.6 18h10.8l-1.2 5.2h-8.4z" fill="#dde1e6" stroke="' + e + '" stroke-width=".6" stroke-linejoin="round"/>' +
            '<path d="M28.6 20.4h6.8" stroke="' + e + '" stroke-width=".5"/>' +
            '<rect x="28" y="23.2" width="8" height="17.6" fill="' + h + '" stroke="' + e + '" stroke-width=".6"/>' +
            '<path d="M28 30.4h8M28 32.6h8M28 34.8h8M28 37h8" stroke="' + g + '" stroke-width="1.2"/>' +
            '<rect x="36" y="25" width="1.8" height="3.2" fill="#d93a2a"/>' +
            '<path d="M28.4 40.8h7.2l.8 2.6h-8.8z" fill="#8d939d" stroke="' + e + '" stroke-width=".5"/>';
        return svg('kr-season-pumpkin kr-season-saber', '0 0 64 56',
            '<path d="M13 55.4c0-4 4.4-7.4 10.4-8.2 5.4-.8 11.8-.8 17.2 0 6 .8 10.4 4.2 10.4 8.2z" fill="#8d8a84" stroke="#55524c" stroke-width=".8"/>' +
            '<path d="M19 50.4c4-1.6 10-2 14-1.6" fill="none" stroke="#b4b0a8" stroke-width=".9" stroke-linecap="round"/>' +
            '<g class="kr-season-saber__float">' +
            '<g transform="translate(32 43.4) scale(1.35) translate(-32 -43.4)">' +
            '<g class="kr-season-saber__blade">' +
            '<rect x="28.2" y="-24" width="7.6" height="44" rx="3.8" fill="' + DAY.blade + '" opacity=".6"/>' +
            '<rect x="30.1" y="-23" width="3.8" height="43" rx="1.9" fill="#ffffff"/></g>' +
            hilt + '</g>' +
            '<path d="M15.6 41.4l3-1.2 2 1.6-2.4 1.6z" fill="#8d8a84" stroke="#55524c" stroke-width=".5"/>' +
            '<path d="M45.6 37.6l2.4-1.4 2.2 1.2-1.6 2z" fill="#8d8a84" stroke="#55524c" stroke-width=".5"/></g>');
    }

    /* The 4th's astromech, from the front: a domed head with a big lens,
       a blue-panelled body on two legs and a third foot between them. The
       dome's lens and panels turn inside it (clipped to it) when clicked,
       and the red lamp on it blinks. */
    var DOME = 'M17 21A15 15 0 0 1 47 21z';
    var DROID = svg('kr-season-pumpkin kr-season-droid', '0 0 64 56',
        '<defs><clipPath id="kr-season-dome"><path d="' + DOME + '"/></clipPath></defs>' +
        '<g stroke="' + EDGE + '" stroke-width=".7">' +
        '<path d="M7 18.6h9v28.6H7zM48 18.6h9v28.6h-9z" fill="' + WHITE + '"/>' +
        '<path d="M9 24h5v10H9zM50 24h5v10h-5z" fill="' + BLUE + '"/>' +
        '<path d="M4.4 47.2h14.2l2.2 7H2.2zM45.4 47.2h14.2l2.2 7H43.2z" fill="' + STEEL + '"/>' +
        '<path d="M27 46h10v4.4H27z" fill="#b8c0ca"/><path d="M24.4 50h15.2l1.8 4.2H22.6z" fill="' + STEEL + '"/>' +
        '<path d="M17 21h30v25.4c0 1.2-1 2.2-2.2 2.2H19.2c-1.2 0-2.2-1-2.2-2.2z" fill="' + WHITE + '"/></g>' +
        '<g stroke="none">' +
        '<path d="M20.6 24.6h8v7h-8zM24 39.6h16v6.2H24z" fill="' + BLUE + '"/>' +
        '<path d="M31.4 24.6h12v2.8h-12zM31.4 29.4h12v1.8h-12z" fill="' + STEEL + '"/>' +
        '<path d="M20.6 34.2h22.8v1.2H20.6zM20.6 36.6h22.8v1.2H20.6z" fill="#b8c0ca"/>' +
        '<circle cx="11.5" cy="21.6" r="3.4" fill="#b8c0ca"/><circle cx="52.5" cy="21.6" r="3.4" fill="#b8c0ca"/></g>' +
        '<path d="' + DOME + '" fill="' + SILVER + '" stroke="' + EDGE + '" stroke-width=".7"/>' +
        '<g clip-path="url(#kr-season-dome)"><g class="kr-season-droid__dome" stroke="none">' +
        '<path d="M15 17.6h34V21H15zM22.4 10.4h4.6V15h-4.6zM36.6 11.2h6v3h-6z" fill="' + BLUE + '"/>' +
        '<circle cx="32" cy="12.4" r="3.2" fill="#1d2430"/><circle cx="31" cy="11.4" r=".9" fill="#ffffff" opacity=".7"/>' +
        '<circle class="kr-season-droid__lamp" cx="40" cy="16" r="1.1" fill="#ff4a3a"/></g></g>');

    /* The 4th's moisture vaporator: a tall column on splayed feet with
       three collars, a narrow top and an aerial, and an amber lamp that
       blinks. */
    var VAPORATOR = svg('kr-season-pumpkin kr-season-vaporator', '0 0 64 56',
        '<g stroke="#5e574c" stroke-width=".8" stroke-linejoin="round">' +
        '<path d="M19.6 55.4l7.4-9.6h10l7.4 9.6z" fill="#a9a091"/>' +
        '<path d="M27 12.6h10v33.6H27z" fill="#d6d0c4"/>' +
        '<path d="M20 17h24v4.2H20zM22.4 28.6h19.2v3.2H22.4zM18.8 38.8h26.4v4.2H18.8z" fill="#a9a091"/>' +
        '<path d="M28.4 12.6l1.4-6h4.4l1.4 6z" fill="#bfb8aa"/></g>' +
        '<path d="M32 6.6V.6M28.8 3.2h6.4" stroke="#5e574c" stroke-width=".9"/>' +
        '<path d="M29.6 33.4v4.4M32 33.4v4.4M34.4 33.4v4.4" stroke="#8a8274" stroke-width=".7"/>' +
        '<circle class="kr-season-vaporator__lamp" cx="32" cy="24.8" r="1.6" fill="#ffb34d" stroke="none"/>');

    /* The 5th's walker, in profile facing right: a boxy head with a slit
       of a viewport and two guns under its chin, on two legs whose knees
       bend back, the far one darker and a step behind. */
    var STRIDER = svg('kr-season-pumpkin kr-season-strider', '0 0 64 56',
        '<g fill="none" stroke-linecap="round" stroke-linejoin="round">' +
        '<path d="M28 28l3.4 11L23 50" stroke="#5f646d" stroke-width="3.4"/>' +
        '<path d="M31 28l8 11-4 11" stroke="#a2a7af" stroke-width="3.6"/></g>' +
        '<g stroke="#4c5058" stroke-width=".6">' +
        '<path d="M16.4 50h11.6l2.2 5.2H14.2z" fill="#5f646d"/>' +
        '<path d="M29.4 50h11.6l2.2 5.2H27.2z" fill="' + HULL_MID + '"/>' +
        '<circle cx="31.4" cy="39" r="2" fill="#5f646d"/><circle cx="39" cy="39" r="2.2" fill="' + HULL_MID + '"/>' +
        '<rect x="23.6" y="22.6" width="13" height="7" rx="1.6" fill="' + HULL_MID + '"/>' +
        '<path d="M12 18L13 7.6 17 4h23l9 6.4-.8 9.4-6.6 3.2H17z" fill="#b9bdc5"/>' +
        '<path d="M21 4V2h9v2z" fill="#9ea3ab"/></g>' +
        '<path d="M20.4 7v14M27 5.6V22M34 5.6V22" stroke="' + HULL_MID + '" stroke-width=".6"/>' +
        '<path d="M40.6 10.4l6.6 2.6M41 15.4h5.6" stroke="#1d2026" stroke-width="1.6" stroke-linecap="round"/>' +
        '<path d="M44.4 21.4h10M42.4 23.8h8" stroke="#4c5058" stroke-width="1.5" stroke-linecap="round"/>');

    /* The 5th's mouse droid: a low black box on two wheels, a grey panel
       and a red light at its nose, a feeler raised. */
    var MOUSE_DROID = svg('kr-season-pumpkin kr-season-mousedroid', '0 0 64 56',
        '<path d="M44.2 40.2l3.4-4.6h2.6" fill="none" stroke="' + HULL_MID + '" stroke-width=".8"/>' +
        '<path d="M12 49.6l2.6-9.6h28.8l8.6 5.6v4z" fill="#26282e" stroke="#5c616a" stroke-width=".7"/>' +
        '<path d="M18 42.4h13v3.4H18z" fill="#5c616a"/>' +
        '<path d="M34 42.6h6v1.6h-6z" fill="' + HULL_MID + '"/>' +
        '<circle cx="47.6" cy="46.6" r="1.1" fill="' + RED_EYE + '"/>' +
        '<circle cx="20" cy="51.6" r="3.4" fill="#15161a" stroke="#5c616a" stroke-width=".7"/>' +
        '<circle cx="42" cy="51.6" r="3.4" fill="#15161a" stroke="#5c616a" stroke-width=".7"/>');

    /* Between them: crystals of the day's colour, a nut off a droid,
       sparkles, a pebble of sand. */
    function crystal(w, turn) {
        var c = DAY.crystal;
        return K.bit(12, 20, w, turn, '<path d="M6 .8l4.4 5v8.4L6 19.2 1.6 14.2V5.8z" fill="' + c[0] + '" stroke="' + c[2] +
            '" stroke-width=".8" stroke-linejoin="round"/>' +
            '<path d="M6 .8v18.4M1.6 5.8L6 8.4l4.4-2.6" fill="none" stroke="' + c[1] + '" stroke-width=".6" opacity=".8"/>');
    }
    function nut(w, turn) {
        return K.bit(12, 12, w, turn, '<path d="M3.2 1.2h5.6L11.6 6 8.8 10.8H3.2L.4 6zM8.2 6a2.2 2.2 0 1 0-4.4 0a2.2 2.2 0 1 0 4.4 0z"' +
            ' fill="#a3a9b2" stroke="#5b616b" stroke-width=".7" fill-rule="evenodd"/>');
    }
    function dust(size, colour) {
        return K.bit(24, 24, size, 0, '<path d="' + sparkle(12, 12, 11) + '" fill="' + colour + '"/>');
    }
    function pebble(w) {
        return K.bit(24, 12, w, 0, '<path d="M2 11c-1-4 2-8 8-9s12 2 13 6-2 3.5-6 3.5z" fill="#d9b178"' +
            ' stroke="#8f6a3a" stroke-width=".8"/>');
    }

    /* ------------------------------------------------------------------ *
     * The flyers, the margins, the small things
     * ------------------------------------------------------------------ */

    /* The 4th's flyer: a four-winged starfighter from above, nose to the
       right, its wings open in pairs with a cannon at each tip, a stripe
       of blue, a droid's dome behind the canopy and four engines glowing
       at the back. */
    function wing(root, tip, gun, shade) {
        return '<path d="M' + root[0] + ' ' + root[2] + 'H' + root[1] + 'L' + tip[1] + ' ' + tip[2] + 'H' + tip[0] + 'z" fill="' + shade +
            '" stroke="' + EDGE + '" stroke-width=".6" stroke-linejoin="round"/>' +
            '<path d="M' + tip[0] + ' ' + gun + 'H' + (tip[1] + 30) + '" stroke="#6b7482" stroke-width="1.6" stroke-linecap="round"/>';
    }
    var FOURWING = svg('kr-season-flyer__body', '0 0 100 60',
        wing([17, 31, 27], [14, 24, 9], 9, '#c9ced6') + wing([17, 31, 33], [14, 24, 51], 51, '#c9ced6') +
        wing([19, 35, 27], [22, 32, 4], 4, '#e4e7ec') + wing([19, 35, 33], [22, 32, 56], 56, '#e4e7ec') +
        '<path d="M23.6 10.4h8.4l-.4 2.4h-8.4zM23.6 49.6h8.4l-.4-2.4h-8.4z" fill="' + BLUE + '"/>' +
        '<g stroke="' + EDGE + '" stroke-width=".5">' +
        '<rect x="12" y="20.6" width="22" height="4.6" rx="2.3" fill="#b8bec8"/>' +
        '<rect x="12" y="34.8" width="22" height="4.6" rx="2.3" fill="#b8bec8"/></g>' +
        '<g class="kr-season-fighter__engine" fill="#ff8a5a">' +
        '<circle cx="11.6" cy="22.9" r="2"/><circle cx="11.6" cy="37.1" r="2"/>' +
        '<circle cx="10.4" cy="25.8" r="1.4" opacity=".7"/><circle cx="10.4" cy="34.2" r="1.4" opacity=".7"/></g>' +
        '<path d="M14 26.4h44l30 1.8 8 1.8-8 1.8-30 1.8H14z" fill="#eceef2" stroke="' + EDGE + '" stroke-width=".6" stroke-linejoin="round"/>' +
        '<path d="M70 26.9h5v6.2h-5z" fill="' + BLUE + '"/>' +
        '<path d="M48 27.4c4-.6 9-.6 12 .4v4.4c-3 1-8 1-12 .4z" fill="#2a3442"/>' +
        '<circle cx="41" cy="30" r="2.6" fill="' + SILVER + '" stroke="' + EDGE + '" stroke-width=".4"/>' +
        '<circle cx="41" cy="30" r="1" fill="' + BLUE + '"/>');

    /* The 5th's flyer: a ball cockpit between two hexagonal wings, seen
       from the front, each wing ribbed from its middle to its corners. */
    function hexWing(cx) {
        var pts = [[cx, 2], [cx + 7, 12], [cx + 7, 44], [cx, 54], [cx - 7, 44], [cx - 7, 12]];
        return '<path d="M' + pts.map(function (p) { return p.join(' '); }).join('L') + 'z" fill="#2e3138" stroke="#a3a8b1"' +
            ' stroke-width="1.2" stroke-linejoin="round"/>' +
            '<path d="' + pts.map(function (p) { return 'M' + cx + ' 28L' + p.join(' '); }).join('') + '" stroke="#6b7079" stroke-width=".7"/>' +
            '<circle cx="' + cx + '" cy="28" r="2.2" fill="#6b7079"/>';
    }
    var HEXWING = svg('kr-season-flyer__body', '0 0 84 56',
        hexWing(10) + hexWing(74) +
        '<path d="M17 26h14v4H17zM53 26h14v4H53z" fill="#7b808a" stroke="#4a4e56" stroke-width=".5"/>' +
        '<circle cx="42" cy="28" r="11" fill="#9aa0a9" stroke="#4a4e56" stroke-width=".8"/>' +
        '<circle cx="42" cy="28" r="6" fill="#1b1d22" stroke="#6b7079" stroke-width=".8"/>' +
        '<path d="M42 22v12M36 28h12M37.8 23.8l8.4 8.4M46.2 23.8l-8.4 8.4" stroke="#6b7079" stroke-width=".6"/>' +
        '<path d="M33.6 22.2a11 11 0 0 1 6-5" stroke="#dfe2e6" stroke-width="1" fill="none" stroke-linecap="round"/>');

    /* The same two fighters small, on a 24 x 24 box, each as one shape
       (its parts wound the same way, so they fill as one): for the moon
       and the margins. The four-winged one from the front: an X about its
       hull, an engine at the root of each wing and a cannon at each tip.
       The other a ball between two upright wings. */
    function dot(cx, cy, r) {
        return 'M' + fix(cx - r) + ' ' + fix(cy) + 'a' + r + ' ' + r + ' 0 1 0 ' + 2 * r + ' 0a' + r + ' ' + r + ' 0 1 0 ' + -2 * r + ' 0z';
    }
    function fourwing24() {
        var d = dot(12, 12, 2.4);
        [-26, 26, 154, 206].forEach(function (deg) {
            var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
            d += bar(12, 12, 10.4, deg, 1.5) + dot(12 + c * 4.4, 12 + s * 4.4, 1.6) + dot(12 + c * 10.6, 12 + s * 10.6, 1);
        });
        return d;
    }
    var FIGHTER_24 = FIFTH ?
        'M3.6 4.6h2.4v14.8H3.6zM18 4.6h2.4v14.8H18zM6 11.2h3.2v1.6H6zM14.8 11.2H18v1.6h-3.2z' +
        'M9 12a3 3 0 1 1 6 0a3 3 0 1 1-6 0z' : fourwing24();

    /* A lightsaber for the tab: a hilt at the lower left, the blade in
       the day's colour with a white core. */
    var SABER_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<path d="M13.4 18.6L28 4" stroke="' + DAY.blade + '" stroke-width="6.4" stroke-linecap="round" opacity=".8"/>' +
        '<path d="M13.4 18.6L28 4" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round"/>' +
        '<path d="M4.6 27.4l9.4-9.4" stroke="#2b3038" stroke-width="5.6" stroke-linecap="round"/>' +
        '<path d="M4.6 27.4l9.4-9.4" stroke="' + (FIFTH ? '#5a5e66' : '#c3c8d0') + '" stroke-width="3.6" stroke-linecap="round"/>' +
        '<path d="M7.4 22.6l2 2M9.4 20.6l2 2" stroke="#2b3038" stroke-width="1.2"/></svg>';

    // The pointer's emblem: a small hilt with a stub of blade.
    var HILT_EMBLEM = '<path d="M1.6 10.4l3.6-3.6" stroke="#2b3038" stroke-width="3.2" stroke-linecap="round"/>' +
        '<path d="M1.6 10.4l3.6-3.6" stroke="' + (FIFTH ? '#6a6e76' : '#c3c8d0') + '" stroke-width="1.8" stroke-linecap="round"/>' +
        '<path d="M5.8 6.2l5-5" stroke="' + DAY.blade + '" stroke-width="2.6" stroke-linecap="round"/>' +
        '<path d="M5.8 6.2l5-5" stroke="#ffffff" stroke-width="1" stroke-linecap="round"/>';

    /* ------------------------------------------------------------------ *
     * The 4th's own: light speed, and the crawl on the 404 page
     * ------------------------------------------------------------------ */

    /* Light speed: a click on the corner (it takes clicks, from this
       file) streaks the stars over the page's opener into lines rushing
       out from its middle for a second, the twinkling stars gone while
       they do. Not under reduced motion, and one jump at a time. */
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
            art.classList.add('kr-season-jump');
            art.addEventListener('click', jump);
        });
    }

    /* The crawl: on the 404 page, behind its title, a few lines in the
       site's own words leaning back into the stars over the opener and
       sliding away up them, round and round. Decoration: aria-hidden, the
       page's real title and lede stay where they are. Under reduced motion
       it stands still, part way up (the stylesheet's resting place). */
    var CRAWL = ['A reader has followed a link to the far edge of this site, and found an address with nothing at it.',
        'The page that once stood here was moved, renamed or retired, and nobody wrote down where it went.',
        'With a search box, a random photograph and the way back to the blog, the reader sets out to find what they came for...'];

    function crawl() {
        var host = document.querySelector('.breadcrumb-area');
        if (!host || !document.getElementById('kr-lost-canvas') || host.querySelector('.kr-season-crawl')) return;
        var el = document.createElement('div');
        el.className = 'kr-season-crawl';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<div class="kr-season-crawl__text"><p class="kr-season-crawl__episode">Episode 404</p>' +
            '<p class="kr-season-crawl__title">The Missing Page</p><p>' + CRAWL.join('</p><p>') + '</p></div>';
        host.insertBefore(el, host.querySelector(':scope > .container'));
    }

    /* ------------------------------------------------------------------ *
     * The 5th's own: the station fires, a saber slashes the openers
     * ------------------------------------------------------------------ */

    /* A click on the corner's station (it takes clicks, from this file)
       charges its dish, gathers four rays in front of it and fires a beam
       to the lower left, which flashes where it ends; one shot at a time,
       the class cleared when the beam's animation ends. Not under reduced
       motion (the station takes no clicks then). */
    function fire(kit) {
        if (kit.reduced) return;
        Array.prototype.forEach.call(document.querySelectorAll('.kr-season-corner__art'), function (art) {
            art.classList.add('kr-season-station');
            art.addEventListener('click', function () { art.classList.add('kr-season-station--fire'); });
            art.addEventListener('animationend', function (e) {
                if (e.animationName === 'kr-season-superlaser') art.classList.remove('kr-season-station--fire');
            });
        });
    }

    /* A click on a page opener or the homepage hero, anywhere but on a
       link, a button or the corner, cuts a red saber slash across it
       where it landed, at a slant of its own: a white-hot stroke that
       sweeps through and leaves a glow which fades. The slashes go in a
       layer of their own over the photograph and under the opener's type
       (over the hero, as its stars are), clipped to it and taking no
       clicks; at most SLASH_MOST at once. Not while the reader is
       selecting text, and never under reduced motion. */
    var SLASH_MOST = 5;

    function slashes(kit) {
        if (kit.reduced) return;
        Array.prototype.forEach.call(document.querySelectorAll('.breadcrumb-area, .kr-opener, .welcome-area'), function (host) {
            if (host.querySelector('.kr-season-slashes')) return;
            var layer = document.createElement('div');
            layer.className = 'kr-season-slashes';
            layer.setAttribute('aria-hidden', 'true');
            host.insertBefore(layer, host.querySelector(':scope > .kr-opener__inner, :scope > .container'));
            host.addEventListener('click', function (e) {
                if (e.target.closest('a, button, input, select, textarea, label, summary, [role="button"], .kr-season-corner')) return;
                if (window.getSelection && String(window.getSelection())) return;
                var box = layer.getBoundingClientRect();
                var slant = (Math.random() < 0.5 ? -1 : 1) * (16 + Math.random() * 34);
                var s = document.createElement('span');
                s.className = 'kr-season-slash';
                s.style.left = fix(e.clientX - box.left) + 'px';
                s.style.top = fix(e.clientY - box.top) + 'px';
                s.style.transform = 'translate(-50%, -50%) rotate(' + fix(slant) + 'deg)';
                layer.appendChild(s);
                while (layer.children.length > SLASH_MOST) layer.firstChild.remove();
                s.addEventListener('animationend', function (ev) {
                    if (ev.animationName === 'kr-season-slash-glow') s.remove();
                });
            });
        });
    }

    K.dress({
        // The ribbon's card (season.js, ribbon), for whichever day it is.
        about: FIFTH ?
            { short: 'Fifth of May', when: '5 May',
                text: 'The day after May the Fourth belongs to the other side: Revenge of the Fifth, after Revenge of the Sith. Hence the red.',
                link: 'https://en.wikipedia.org/wiki/Star_Wars_Day' } :
            { short: 'May the 4th', when: '4 May',
                text: 'Say it out loud: May the Fourth be with you. A pun Star Wars fans turned into a holiday, and tomorrow is Revenge of the Fifth.',
                link: 'https://en.wikipedia.org/wiki/Star_Wars_Day' },
        corner: FIFTH ? stationArt : sunsArt,
        dangler: FIFTH ? PROBE : REMOTE,
        // Stars, mostly points of light, some four-pointed, twinkling.
        leaves: { kind: 'twinkle', colours: DAY.stars, per1000: 46, shapes: [K.DOT, sparkle(12, 12, 11)],
            tumble: false, glow: true, size: [7, 17] },
        // The day's fighters in the margins, among sparkles.
        backdrop: { shapes: [FIGHTER_24, sparkle(12, 12, 10)], colours: [DAY.ships, DAY.dust] },
        // A droid or a walker, a vaporator or a mouse droid, and the saber,
        // on the sounds the rockets they replaced had.
        patch: FIFTH ?
            [{ art: STRIDER, size: 'big', sound: 'liftoff' },
             { art: MOUSE_DROID, size: 'small', sound: 'small-step' },
             { art: saber(), size: 'mid', sound: 'saturn' }] :
            [{ art: DROID, size: 'big', sound: 'liftoff' },
             { art: VAPORATOR, size: 'small', sound: 'small-step' },
             { art: saber(), size: 'mid', sound: 'saturn' }],
        strew: FIFTH ?
            [nut(10, 10), crystal(9, 24), dust(10, DAY.sparkle), nut(8, -20), crystal(7, -32)] :
            [crystal(9, -18), pebble(14), dust(10, DAY.sparkle), nut(9, 15), dust(12, '#ffffff')],
        puff: 'kr-season-puff--bolts',
        flyer: FIFTH ? HEXWING : FOURWING,
        flight: FIFTH ? 'kr-season-flyer--hexwing' : 'kr-season-flyer--fourwing',
        favicon: SABER_ICON, moonmark: FIGHTER_24,
        cursor: K.cursor(DAY.pointer, HILT_EMBLEM, DAY.pointerEdge),
        // A lightsaber over a post: the hilt at the left, the blade as far
        // as the reader has read, its glowing tip at the reader.
        track: { kind: 'saber', mode: 'fill', tip: '<i class="kr-season-blade-tip"></i>' },
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
        extra: function (kit) {
            if (FIFTH) {
                fire(kit);
                slashes(kit);
            } else {
                warp(kit);
                crawl();
            }
        }
    });
})();
