/**
 * seasons/cat-day.js: International Cat Day's art for js/season.js (see
 * that file for the pieces), for 8 August, in daylight and in the coats
 * of the house's four cats and a couple of friends: a ginger cat asleep
 * on a shelf in the corner with its striped tail hanging down, tufts of
 * fluff and small hearts drifting over the openers, a tabby in a
 * cardboard box, a ball of yarn and a food bowl on the footer with a toy
 * mouse, a feather and jingle balls between them, hearts from whatever
 * is clicked, a kitten chasing a butterfly along the foot of the window,
 * a cat face favicon, a cat sitting in the moon, paw prints along a
 * post's top wherever the reader has passed, a 404 page knocked off the
 * table, and a toy mouse for the pointer.
 * Its own:
 *   - the corner cat: its tail swishes as it sleeps; touch the tail and it
 *     flicks, and the cat opens its eyes and lifts its head a moment
 *   - a tuxedo and a calico who walk along the footer's edge at their own
 *     paces (kit.walker), sit down a while, slow-blink, and walk on
 *   - in the homepage hero, a laser dot under the mouse pointer and a
 *     fluffy grey cat who stalks it along the bottom of the picture,
 *     wiggles, and pounces when it comes low; it runs off when the
 *     pointer leaves (mice only)
 *   - on the 404 page, a black cat on a table who pats the page over the
 *     edge, then looks at you
 * The tabby in the box pops its head up when the box is clicked.
 *
 * Classes only this file applies (css/seasons/cat-day.css):
 * .kr-season-pumpkin, .kr-season-dangler__body, .kr-season-catnap
 * (--woken, __body, __head, __shut, __open, __z), .kr-season-puff--hearts,
 * .kr-season-flyer--chase, .kr-season-chase (__kit, __fly, __wing,
 * __wing--l, __wing--r), .kr-season-track--paws, .kr-season-boxcat,
 * .kr-season-yarn, .kr-season-strut (__walk, __sit, __leg, __leg--a,
 * __leg--b, __eye, __eyes), the walkers' kinds (kr-season-walker--tuxedo,
 * --calico), .kr-season-laser (--on, __dot, __cat, __cat--run,
 * __cat--stalk, __cat--pounce, __leap, __paws), .kr-season-knock (--play,
 * --done, __page, __paw, __eyes, __floor).
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg, star = K.star;

    // Ginger and its stripes, cream, tabby browns, the slate of a tuxedo,
    // calico patches, a fluffy grey, a black cat; pink noses, cat eyes.
    var GINGER = '#ec9444', GINGER_DARK = '#c2661c', CREAM = '#fbe8c8';
    var TABBY = '#a48a68', TABBY_DARK = '#5e4a35', TABBY_PALE = '#eadcc2';
    var SLATE = '#3e4149', WHITE = '#fbf9f4', EDGE = '#6b5a4a';
    var CAL_ORANGE = '#e3893a', CAL_BLACK = '#2c2b30';
    var GREY = '#959caa', GREY_DARK = '#6e7584', GREY_PALE = '#cfd3db';
    var NILA = '#26252b';
    var PINK = '#ec9aa8', AMBER = '#e9b43c', GREEN = '#9cc95a', PUPIL = '#1d1b1f';
    var WOOD = '#b98352', WOOD_DARK = '#8a5a31';

    function fix(v) { return K.fix(+v); }

    /* A paw print on a 12 x 12 box: the main pad and four toes. */
    var PAW = '<path d="M6 11.6c-2.1 0-3.7-1-3.7-2.6 0-1.8 1.7-3.3 3.7-3.3s3.7 1.5 3.7 3.3c0 1.6-1.6 2.6-3.7 2.6z"/>' +
        '<ellipse cx="1.9" cy="5" rx="1.2" ry="1.5" transform="rotate(-20 1.9 5)"/>' +
        '<ellipse cx="4.4" cy="2.4" rx="1.25" ry="1.6" transform="rotate(-8 4.4 2.4)"/>' +
        '<ellipse cx="7.6" cy="2.4" rx="1.25" ry="1.6" transform="rotate(8 7.6 2.4)"/>' +
        '<ellipse cx="10.1" cy="5" rx="1.2" ry="1.5" transform="rotate(20 10.1 5)"/>';

    /* ------------------------------------------------------------------ *
     * The corner: a ginger cat asleep on a shelf, tail over the edge
     * ------------------------------------------------------------------ */

    /* A shelf on its bracket in the top right corner, the cat curled on
       it, head down on its paws, eyes shut, a z or two rising. Its tail
       runs along the front of the shelf to drop over the edge where the
       dangling thing hangs (x 35.5), and the rest of it is the thread. */
    function catnapArt() {
        var s = ' stroke="none"';
        return '<path d="M63 34L63 47.5L51.5 34z" fill="' + WOOD_DARK + '"/>' +
            '<rect x="13" y="30" width="51" height="4.4" rx="1" fill="' + WOOD + '"/>' +
            '<path d="M13.6 30.6h50" stroke="#d9aa78" stroke-width=".7"/>' +
            '<g class="kr-season-catnap__body">' +
            '<path d="M21 30.2C21 22.6 29 16.4 41 16.4c10.6 0 17.4 4.8 17.4 10.6v3.2z" fill="' + GINGER + '"/>' +
            '<ellipse cx="51" cy="24.6" rx="7.6" ry="6.2" fill="' + GINGER + '"/>' +
            '<path d="M35.8 17.2c1.2 3.2 1 6.2-.4 8.8M41.6 16.5c1.4 3.6 1.2 7-.2 9.8M47.4 17.4c1.4 3.4 1.2 6.6-.4 9.4M53 19.6c1 2.6.8 5-.6 7"' +
            ' fill="none" stroke="' + GINGER_DARK + '" stroke-width="1.5" stroke-linecap="round"/>' +
            '</g>' +
            '<path d="M56.6 29.6c-4 3.4-14.6 2-21.1 2.4V38.6" fill="none" stroke="' + GINGER + '" stroke-width="3.4" stroke-linecap="round"/>' +
            '<path d="M48 31.3l.6 1.8M43 31.5l.4 1.9M38.6 31.7v1.9M35.5 34.6h-1.6" stroke="' + GINGER_DARK + '" stroke-width="1"/>' +
            '<g class="kr-season-catnap__head">' +
            '<path d="M16.4 20L15.8 11.4l6.4 5.4zM26.2 16.6l6-5 .2 8.4z" fill="' + GINGER + '"/>' +
            '<path d="M17.6 17.4l-.2-3.6 2.6 2.4zM28.4 15.8l2.6-2.2v3.4z" fill="' + PINK + '"' + s + '/>' +
            '<ellipse cx="24" cy="23" rx="8.4" ry="7" fill="' + GINGER + '"/>' +
            '<path d="M22.4 16.4v2.4M24.2 16.1v2.6M26 16.4v2.4" stroke="' + GINGER_DARK + '" stroke-width="1" stroke-linecap="round"/>' +
            '<ellipse cx="24.4" cy="26.4" rx="3.6" ry="2.3" fill="' + CREAM + '"' + s + '/>' +
            '<g class="kr-season-catnap__shut" fill="none" stroke="#5a3214" stroke-width=".9" stroke-linecap="round">' +
            '<path d="M19.4 22.8q1.7 1.5 3.4 0M25.8 22.8q1.7 1.5 3.4 0"/></g>' +
            '<g class="kr-season-catnap__open"' + s + '>' +
            '<ellipse cx="21.1" cy="22.6" rx="1.5" ry="1.7" fill="' + AMBER + '"/><ellipse cx="27.5" cy="22.6" rx="1.5" ry="1.7" fill="' + AMBER + '"/>' +
            '<ellipse cx="21.3" cy="22.7" rx=".5" ry="1.3" fill="' + PUPIL + '"/><ellipse cx="27.7" cy="22.7" rx=".5" ry="1.3" fill="' + PUPIL + '"/></g>' +
            '<path d="M23.5 25l1.8 0-.9 1z" fill="' + PINK + '"' + s + '/>' +
            '<path d="M17.4 26.6l-4 .4M17.4 27.8l-3.8 1.4M31.4 26.6l4 .2M31.4 27.8l3.8 1.2" stroke="#fff6e8" stroke-width=".4"/>' +
            '</g>' +
            '<ellipse cx="18.4" cy="29.4" rx="3.6" ry="1.7" fill="' + CREAM + '"/>' +
            '<ellipse cx="25.6" cy="29.6" rx="3.4" ry="1.6" fill="' + CREAM + '"/>' +
            '<g class="kr-season-catnap__z" fill="none" stroke="#fff4e0" stroke-width="1.1" stroke-linejoin="round">' +
            '<path d="M10.4 12.4h3l-3 3h3"/><path d="M5.6 6.6h2.2l-2.2 2.2h2.2"/></g>';
    }

    // The tip of the tail: striped, with the curl a hanging tail has.
    var TAIL_TIP = svg('kr-season-dangler__body', '0 0 20 20',
        '<path d="M7.3 0h5.4v10.6c0 2.6 1.6 3.6 3 3 1-.4 1.4-1.4 1.2-2.4 1.8.4 2.4 2.4 1.6 4.2-1.2 2.8-4.6 3.8-7.4 2.4-2.4-1.2-3.8-3.4-3.8-6.6z"' +
        ' fill="' + GINGER + '" stroke="' + EDGE + '" stroke-width=".5"/>' +
        '<path d="M7.6 3.4h4.8M7.6 7.8h4.8M8 12.4c1.2.4 2.8.6 4.4.4M10.6 16.6l1.6-2" stroke="' + GINGER_DARK + '" stroke-width="1.4" fill="none"/>');

    /* ------------------------------------------------------------------ *
     * The air: fluff and small hearts
     * ------------------------------------------------------------------ */

    var FLUFF = star(12, 12, 7.5, 14, 0.74);
    var HEART = 'M12 20.4C5.2 15.6 3 12.4 3 9.3 3 6.7 5 4.7 7.6 4.7c1.8 0 3.4 1 4.4 2.6 1-1.6 2.6-2.6 4.4-2.6 2.6 0 4.6 2 4.6 4.6 0 3.1-2.2 6.3-9 11.1z';
    var AIR_COLOURS = ['#fff3e0', '#ffd6ad', '#ffc2cf', '#f7b277', '#ffffff', '#dde0f6'];

    /* ------------------------------------------------------------------ *
     * The patch: a tabby in a box, a ball of yarn, a food bowl
     * ------------------------------------------------------------------ */

    /* A cardboard box with its flaps open and a tabby inside, ears and
       eyes over the rim; style.css pops the head up when it is clicked. */
    var BOX = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M8 25L1.6 15.4 18 13.6 24 25z" fill="#b8854c"/>' +
        '<path d="M56 25l6.4-9.6-16.4-1.8L40 25z" fill="#b8854c"/>' +
        '<path d="M9 25h46v4H9z" fill="#5c3d1c"/>' +
        '<g class="kr-season-boxcat">' +
        '<path d="M19.6 20.4L18.4 8.6l8 6.2zM44.4 20.4l1.2-11.8-8 6.2z" fill="' + TABBY + '" stroke="' + TABBY_DARK + '" stroke-width=".6"/>' +
        '<path d="M20.6 15l-.4-3.8 3.2 2.6zM43.4 15l.4-3.8-3.2 2.6z" fill="' + PINK + '"/>' +
        '<ellipse cx="32" cy="24" rx="13.4" ry="11" fill="' + TABBY + '" stroke="' + TABBY_DARK + '" stroke-width=".6"/>' +
        '<path d="M29 13.4l.6 4M32 13v4.4M35 13.4l-.6 4M20.4 21.4l3.2 1M20 24.4l3.4.2M43.6 21.4l-3.2 1M44 24.4l-3.4.2"' +
        ' stroke="' + TABBY_DARK + '" stroke-width="1.2" stroke-linecap="round"/>' +
        '<ellipse cx="26.6" cy="22.4" rx="2.6" ry="2.9" fill="' + GREEN + '"/><ellipse cx="37.4" cy="22.4" rx="2.6" ry="2.9" fill="' + GREEN + '"/>' +
        '<ellipse cx="26.8" cy="22.6" rx=".9" ry="2.3" fill="' + PUPIL + '"/><ellipse cx="37.2" cy="22.6" rx=".9" ry="2.3" fill="' + PUPIL + '"/>' +
        '<circle cx="27.4" cy="21.4" r=".6" fill="#ffffff"/><circle cx="37.8" cy="21.4" r=".6" fill="#ffffff"/>' +
        '<ellipse cx="32" cy="29" rx="4.8" ry="3.2" fill="' + TABBY_PALE + '"/>' +
        '<path d="M30.8 27.2h2.4L32 28.6z" fill="' + PINK + '"/>' +
        '<path d="M26 28.6l-7 -.6M26 30l-6.6 1.4M38 28.6l7-.6M38 30l6.6 1.4" stroke="#fffaf0" stroke-width=".45"/>' +
        '<ellipse cx="25" cy="27.6" rx="3" ry="1.8" fill="' + TABBY + '"/><ellipse cx="39" cy="27.6" rx="3" ry="1.8" fill="' + TABBY + '"/>' +
        '</g>' +
        '<path d="M8 27h48v28H8z" fill="#cf9a5c"/>' +
        '<path d="M56 27l6-3v27l-6 4z" fill="#a8763f"/>' +
        '<path d="M8 27h48" stroke="#e8be86" stroke-width="1.2"/>' +
        '<path d="M26 27v8.6h12V27" fill="#d9ab72"/>' +
        '<path d="M13 51v-6.4M10.8 46.8l2.2-2.2 2.2 2.2M19 51v-6.4M16.8 46.8l2.2-2.2 2.2 2.2" fill="none" stroke="#8a5c2a" stroke-width=".9" stroke-linecap="round" stroke-linejoin="round"/>');

    // A ball of blue yarn, its winding showing, a loose end across the floor.
    var YARN = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M14 52c-4 2-9 1.4-10.4-1.4-1.4-2.6 1.6-4.6 3.8-3.2" fill="none" stroke="#5576c4" stroke-width="1.6" stroke-linecap="round"/>' +
        '<g class="kr-season-yarn">' +
        '<circle cx="34" cy="34" r="19" fill="#6d8fd9"/>' +
        '<path d="M18.6 24c6.8-4.4 18.6-5 28.4 1.8M16 33c8.8-6 23.8-6.4 34.4 2.4M17.4 42c8-5 22.6-5.6 32.4 1.8M23 49.4c5.4-2.6 14.6-3 22 .2"' +
        ' fill="none" stroke="#4a68b4" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M28 15.8c-5 7-6 23.6 3 36.8M38 15.6c6 6.6 8.4 21.6 1.6 37" fill="none" stroke="#91acec" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M44 21c-2.6 6-2 12 1.4 17" fill="none" stroke="#4a68b4" stroke-width="1.3" stroke-linecap="round"/>' +
        '</g>' +
        '<path d="M15.6 50.6C19 52.8 22 53.4 26 52.6" fill="none" stroke="#5576c4" stroke-width="1.6" stroke-linecap="round"/>');

    // A food bowl, a heap of kibble and a fish on its side.
    var BOWL = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M14 36c2-5 8-7.4 18-7.4S48 31 50 36z" fill="#9a5b2c"/>' +
        '<path d="M20 31.6a2 1.6 0 1 0 4 0 2 1.6 0 1 0-4 0zM27 30a2 1.6 0 1 0 4 0 2 1.6 0 1 0-4 0zM34 30.6a2 1.6 0 1 0 4 0 2 1.6 0 1 0-4 0z' +
        'M40.4 32.2a2 1.6 0 1 0 4 0 2 1.6 0 1 0-4 0zM23.6 34a2 1.6 0 1 0 4 0 2 1.6 0 1 0-4 0zM30.4 33.4a2 1.6 0 1 0 4 0 2 1.6 0 1 0-4 0z' +
        'M30.6 27.2a2 1.6 0 1 0 4 0 2 1.6 0 1 0-4 0z" fill="#c07a3e"/>' +
        '<path d="M6 36h52c-1 9-6 15.4-14 16.6H20C12 51.4 7 45 6 36z" fill="#3f9e94"/>' +
        '<ellipse cx="32" cy="36" rx="26" ry="2.6" fill="#62bdb2"/>' +
        '<path d="M8 41.6c8 1.6 40 1.6 48 0" fill="none" stroke="#2f7c74" stroke-width="1.1"/>' +
        '<path d="M24 47.4c2.6-2.6 7.4-3 11 0-3.6 3-8.4 2.6-11 0zM35 47.4l3.4-2.4v4.8z" fill="#fff4e4"/>' +
        '<circle cx="27.4" cy="47" r=".7" fill="#2f7c74"/>');

    // A grey felt mouse with a pink ear and a string tail.
    function mouse(w) {
        return K.bit(28, 14, w, 0,
            '<path d="M7 11.4C5 13.4 1.6 13.2.6 10.6" fill="none" stroke="#8b8f98" stroke-width="1" stroke-linecap="round"/>' +
            '<path d="M6 12c0-5 4.6-8.4 10-8.4 4.4 0 8.4 3.4 10.6 7.4.4.8 0 1.4-.8 1.4H6.6z" fill="#a9adb6"/>' +
            '<circle cx="18" cy="5" r="2.6" fill="' + PINK + '"/><circle cx="18" cy="5" r="1.5" fill="#f6c3cc"/>' +
            '<circle cx="23" cy="9" r=".7" fill="' + PUPIL + '"/><circle cx="26.8" cy="11.4" r=".8" fill="' + PINK + '"/>');
    }

    // A feather from a wand toy, teal and gold.
    function feather(h, turn) {
        return K.bit(12, 28, fix(h * 12 / 28), turn,
            '<path d="M6 27V3" stroke="#6b5a45" stroke-width=".8"/>' +
            '<path d="M6 2c4 3 5.4 8.4 4.4 14-.8 3.6-2.6 6-4.4 7.4-1.8-1.4-3.6-3.8-4.4-7.4C.6 10.4 2 5 6 2z" fill="#2fa39a"/>' +
            '<path d="M6 7c2 1.6 2.6 4.4 2.2 7.2-.4 1.8-1.2 3-2.2 3.8-1-.8-1.8-2-2.2-3.8C3.4 11.4 4 8.6 6 7z" fill="#e9b949"/>' +
            '<path d="M6 10l3.4-2M6 14l4-2M6 10L2.6 8M6 14l-4-2" stroke="#1f7d76" stroke-width=".5"/>');
    }

    // A jingle ball: a slotted ball with a bell in it.
    function jingle(w, colour) {
        return K.bit(12, 12, w, 0, '<circle cx="6" cy="6" r="5.4" fill="' + colour + '"/>' +
            '<path d="M2 4.4h8M1.4 7.4h9.2M6 .8v10.4" stroke="#ffffff" stroke-opacity=".7" stroke-width="1"/>' +
            '<circle cx="6" cy="6" r="1.6" fill="#e6c34a"/>');
    }

    /* ------------------------------------------------------------------ *
     * The flyer: a kitten bounding after a butterfly
     * ------------------------------------------------------------------ */

    var CHASE = svg('kr-season-chase', '0 0 132 52',
        '<g class="kr-season-chase__kit">' +
        '<path d="M10 33c-5-1.4-8-5.4-8.4-10.6-.2-1.6 1.6-2 2.2-.4 1 3.6 3.4 6.4 7.4 7.6z" fill="' + GINGER + '"/>' +
        '<path d="M13 38.6L3.6 43.4M14.8 39.6L7.6 47.4" stroke="' + GINGER + '" stroke-width="3.6" stroke-linecap="round"/>' +
        '<path d="M9 34c0-4.4 5-7 11-7h10c4.4 0 7 2.2 7 5.4s-2.8 5.4-7 5.4H16c-4.6 0-7-1.4-7-3.8z" fill="' + GINGER + '"/>' +
        '<path d="M17.6 28.6c.8 2 .6 4-.4 5.6M23 27.6c.8 2.2.6 4.4-.4 6.2M28.4 27.6c.6 2 .4 3.8-.4 5.4" fill="none" stroke="' + GINGER_DARK + '" stroke-width="1.3" stroke-linecap="round"/>' +
        '<path d="M15 36.4c4 1.6 12 1.8 17 .4" fill="none" stroke="' + WHITE + '" stroke-width="1.8" stroke-linecap="round"/>' +
        '<path d="M32 34.4L42.6 30M31 36.6L41.6 37.4" stroke="' + GINGER + '" stroke-width="3.4" stroke-linecap="round"/>' +
        '<circle cx="43.2" cy="29.8" r="1.8" fill="' + WHITE + '"/><circle cx="42.2" cy="37.4" r="1.8" fill="' + WHITE + '"/>' +
        '<circle cx="3.4" cy="43.6" r="1.8" fill="' + WHITE + '"/><circle cx="7.4" cy="47.6" r="1.8" fill="' + WHITE + '"/>' +
        '<path d="M37 24.4l.4-6.2 4 3.8zM43.4 21.6l4.6-3.4-.2 6z" fill="' + GINGER + '"/>' +
        '<path d="M38 22.4l.2-2.6 1.8 1.8zM45.2 21.6l2-1.4-.1 2.6z" fill="' + PINK + '"/>' +
        '<circle cx="42" cy="27" r="6" fill="' + GINGER + '"/>' +
        '<ellipse cx="45.2" cy="29.4" rx="3" ry="2.1" fill="' + WHITE + '"/>' +
        '<ellipse cx="44.2" cy="25.6" rx="1.4" ry="1.6" fill="' + GREEN + '"/><circle cx="44.6" cy="25.6" r=".9" fill="' + PUPIL + '"/>' +
        '<path d="M47.4 27.8l1.2.4-.8.9z" fill="' + PINK + '"/>' +
        '</g>' +
        '<g class="kr-season-chase__fly">' +
        '<g class="kr-season-chase__wing kr-season-chase__wing--l">' +
        '<path d="M103 10C97 1 89 1.6 89.6 8.4c.4 3.4 5.4 4.6 13.4 3.4z" fill="#f4cf48" stroke="#a37a12" stroke-width=".7"/>' +
        '<path d="M103 13c-6.4.4-9.6 4.6-7.6 7.6 1.6 2.4 6 .2 7.6-5.6z" fill="#f7dc74" stroke="#a37a12" stroke-width=".7"/>' +
        '<circle cx="94.6" cy="7" r="1.3" fill="#ef8a2b"/></g>' +
        '<g class="kr-season-chase__wing kr-season-chase__wing--r">' +
        '<path d="M105 10c6-9 14-8.4 13.4-1.6-.4 3.4-5.4 4.6-13.4 3.4z" fill="#f4cf48" stroke="#a37a12" stroke-width=".7"/>' +
        '<path d="M105 13c6.4.4 9.6 4.6 7.6 7.6-1.6 2.4-6 .2-7.6-5.6z" fill="#f7dc74" stroke="#a37a12" stroke-width=".7"/>' +
        '<circle cx="113.4" cy="7" r="1.3" fill="#ef8a2b"/></g>' +
        '<ellipse cx="104" cy="12.6" rx="1.1" ry="5.4" fill="#4a3a20"/>' +
        '<path d="M103.6 7.4c-.6-2-1.8-3.4-3.2-4M104.4 7.4c.6-2 1.8-3.4 3.2-4" fill="none" stroke="#4a3a20" stroke-width=".6"/>' +
        '</g>');

    /* ------------------------------------------------------------------ *
     * The walkers: a tuxedo and a calico, each walking and sitting
     * ------------------------------------------------------------------ */

    /* A cat in profile facing right on a 48 x 30 box, in two poses that
       style.css swaps as it walks and sits: walking, with its legs drawn
       twice (in stride, then together); sitting, its tail round its feet,
       an eye that slow-blinks. `c` holds its coat: main, belly and socks,
       eye, and markings for each pose (drawn over the coat, clipped to it). */
    function strutter(c, id) {
        var leg = function (pairs, cls) {
            return '<g class="kr-season-strut__leg ' + cls + '">' + pairs.map(function (p) {
                return '<path d="M' + p[0] + ' 19L' + p[1] + ' 28.2" stroke="' + c.main + '" stroke-width="3.3" stroke-linecap="round"/>' +
                    '<ellipse cx="' + p[1] + '" cy="28.6" rx="1.9" ry="1.1" fill="' + c.sock + '"/>';
            }).join('') + '</g>';
        };
        var walkBody = 'M10 16c0-4.6 4-6.2 9-6.2h12c4 0 6.2 2.2 6.6 5.2.5 3.6-2.4 6-6.6 6H17c-4.4 0-7-1.6-7-5z';
        var sitBody = 'M21.4 29.4c-3.6 0-4.6-3.4-3.6-8.4 1-6 5-9.8 10-9.8 4 0 5.4 3.8 5.4 8.8 0 5-1 9.4-5.2 9.4z';
        var head = function (x, y, eyeClass) {
            return '<path d="M' + fix(x - 4.4) + ' ' + fix(y - 2.4) + 'l.6-5.4 3.6 3.2zM' + fix(x + 0.6) + ' ' + fix(y - 4.8) +
                'l3.6-3.2.6 5.6z" fill="' + c.main + '"/>' +
                '<path d="M' + fix(x - 3.6) + ' ' + fix(y - 3.4) + 'l.3-2.6 1.6 1.6z" fill="' + PINK + '"/>' +
                '<circle cx="' + x + '" cy="' + y + '" r="5.2" fill="' + c.main + '"/>' +
                (c.face ? c.face(x, y) : '') +
                '<ellipse cx="' + fix(x + 3.2) + '" cy="' + fix(y + 2.3) + '" rx="2.2" ry="1.6" fill="' + c.belly + '"/>' +
                '<g class="' + eyeClass + '"><ellipse cx="' + fix(x + 2.1) + '" cy="' + fix(y - 0.8) + '" rx="1.3" ry="1.5" fill="' + c.eye + '"/>' +
                '<ellipse cx="' + fix(x + 2.4) + '" cy="' + fix(y - 0.8) + '" rx=".4" ry="1" fill="' + PUPIL + '"/></g>' +
                '<path d="M' + fix(x + 5) + ' ' + fix(y + 1.2) + 'l.4 1-1 .2z" fill="' + PINK + '"/>';
        };
        var walk = '<g class="kr-season-strut__walk">' +
            '<path class="kr-season-walker__tail" d="M11.4 14.6C6 12.6 4 8 6 3c.6-1.4 2.4-1.2 2.2.4-.8 3.6.4 7.2 3.8 9z" fill="' + c.main + '"/>' +
            leg([[15, 11.4], [32, 28.6]], 'kr-season-strut__leg--a') +
            leg([[14, 14.6], [31.4, 31.6]], 'kr-season-strut__leg--b') +
            '<path d="' + walkBody + '" fill="' + c.main + '"/>' +
            (c.walkMarks ? '<clipPath id="' + id + '-w"><path d="' + walkBody + '"/></clipPath>' +
                '<g clip-path="url(#' + id + '-w)">' + c.walkMarks + '</g>' : '') +
            leg([[17, 19.6], [34, 36.6]], 'kr-season-strut__leg--a') +
            leg([[16, 16.6], [33, 33.2]], 'kr-season-strut__leg--b') +
            '<path d="M35.6 13.6c2 2.6 1.8 5.6-.6 7.2-1.6-2-1.4-5 .6-7.2z" fill="' + c.belly + '"/>' +
            head(39.6, 10, 'kr-season-strut__eyes') + '</g>';
        var sit = '<g class="kr-season-strut__sit">' +
            '<path class="kr-season-walker__tail" d="M20.4 28.6c-6 1.2-10.2-.4-10-3 .1-1.2 1.6-1.2 1.7-.1.4 1.4 3.8 1.8 8.2 1.1z" fill="' + c.main + '"/>' +
            '<path d="' + sitBody + '" fill="' + c.main + '"/>' +
            (c.sitMarks ? '<clipPath id="' + id + '-s"><path d="' + sitBody + '"/></clipPath>' +
                '<g clip-path="url(#' + id + '-s)">' + c.sitMarks + '</g>' : '') +
            '<path d="M29 15.6c3 2.4 3.6 7 2 11.6-2.6-2.6-3.6-7-2-11.6z" fill="' + c.belly + '"/>' +
            '<path d="M29.2 19v9.6M31.8 19v9.6" stroke="' + c.main + '" stroke-width="2.4" stroke-linecap="round"/>' +
            '<ellipse cx="29.4" cy="28.8" rx="1.6" ry="1" fill="' + c.sock + '"/><ellipse cx="32.2" cy="28.8" rx="1.6" ry="1" fill="' + c.sock + '"/>' +
            head(31, 8.4, 'kr-season-strut__eye') + '</g>';
        return svg('kr-season-strut', '0 0 48 30', walk + sit);
    }

    // A tuxedo in slate and white, after the grey and white one at home.
    var TUXEDO = strutter({ main: SLATE, belly: WHITE, sock: WHITE, eye: GREEN,
        walkMarks: '<ellipse cx="24" cy="21" rx="9" ry="2.4" fill="' + WHITE + '"/>',
        sitMarks: '<path d="M26 30c2-4 2.4-10 3-14l6 2v12z" fill="' + WHITE + '"/>',
        face: function (x, y) {
            return '<path d="M' + fix(x + 0.4) + ' ' + fix(y + 5.2) + 'c-.4-2.4.4-5 2-7.2 1.4 1.8 2.6 3.8 3 6.2z" fill="' + WHITE + '"/>';
        } }, 'kr-season-tux');

    // A calico: white, with ginger and black patches.
    var CALICO = strutter({ main: WHITE, belly: WHITE, sock: WHITE, eye: AMBER,
        walkMarks: '<path d="M8 8h11c1 3 0 7-4 9-3 1-6 0-7-1z" fill="' + CAL_BLACK + '"/>' +
            '<path d="M20 8h9c1 3-1 6-5 6.6-2.6.4-4-1.4-4-3.6z" fill="' + CAL_ORANGE + '"/>' +
            '<path d="M29 9h6c.6 2.4-.4 4.4-3 4.8-2 .2-3.2-1.2-3-4.8z" fill="' + CAL_BLACK + '"/>',
        sitMarks: '<path d="M16 10h8c1 4 0 8-3 10.6-2 1.4-4.4 1-5-1z" fill="' + CAL_ORANGE + '"/>' +
            '<path d="M16 21c3 0 5 2 5 5s-2 4.4-5 4.4z" fill="' + CAL_BLACK + '"/>',
        face: function (x, y) {
            return '<path d="M' + fix(x - 5.2) + ' ' + fix(y) + 'a5.2 5.2 0 0 1 4.2-5.1c.6 2 .4 4-1 5.6-1 1-2.2 1-3.2-.5z" fill="' + CAL_BLACK + '"/>' +
                '<path d="M' + fix(x + 0.6) + ' ' + fix(y - 5.1) + 'a5.2 5.2 0 0 1 4.4 3.6c-1.4.8-3 .8-4.2-.2-.6-.8-.6-2-.2-3.4z" fill="' + CAL_ORANGE + '"/>' +
                '<path d="M' + fix(x - 4.4) + ' ' + fix(y - 2.4) + 'l.6-5.4 3.6 3.2z" fill="' + CAL_BLACK + '"/>' +
                '<path d="M' + fix(x + 0.6) + ' ' + fix(y - 4.8) + 'l3.6-3.2.6 5.6z" fill="' + CAL_ORANGE + '"/>';
        } }, 'kr-season-cal');

    /* ------------------------------------------------------------------ *
     * Small things: the tab, the moon, the pointer, the paw prints
     * ------------------------------------------------------------------ */

    var CAT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
        '<path d="M3.4 16.4L3 2.6l10 6.6zM28.6 16.4L29 2.6l-10 6.6z" fill="#e8892f"/>' +
        '<path d="M5.4 11.4l-.2-5.4 4.4 3zM26.6 11.4l.2-5.4-4.4 3z" fill="#f2a6b3"/>' +
        '<ellipse cx="16" cy="18.4" rx="13.4" ry="11.6" fill="#ec9444"/>' +
        '<path d="M13.6 8.2l.8 3.6M16 7.8v4M18.4 8.2l-.8 3.6" stroke="#b85c16" stroke-width="1.6" stroke-linecap="round"/>' +
        '<ellipse cx="16" cy="24.6" rx="6.2" ry="4.4" fill="#fbe8c8"/>' +
        '<ellipse cx="10.6" cy="17.4" rx="2.4" ry="2.8" fill="#8cc152"/><ellipse cx="21.4" cy="17.4" rx="2.4" ry="2.8" fill="#8cc152"/>' +
        '<ellipse cx="10.8" cy="17.6" rx=".9" ry="2.3" fill="#1d1b1f"/><ellipse cx="21.2" cy="17.6" rx=".9" ry="2.3" fill="#1d1b1f"/>' +
        '<path d="M14.4 21.6h3.2L16 23.4z" fill="#e98a9c"/></svg>';

    // A cat sitting in the moon, seen from behind, its tail curled round.
    var MOON_CAT = 'M10.2 7.8l.1-2.8 1.5 1.6zM13.8 7.8L12.2 6.6l1.5-1.6z' +
        'M9.8 8.6a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0z' +
        'M12 10C9.6 10 8.7 13 8.9 15.6 9.1 17.4 10.1 18.4 12 18.4s2.9-1 3.1-2.8C15.3 13 14.4 10 12 10z' +
        'M14.4 17.6c2 .8 3.8 0 3.8-1.8 0-.6-.4-.9-.7-.6-.1 1.4-1.3 2.1-2.9 1.6z';

    // A paw print for the track: a cat has walked along the post's top.
    function pawPrint(i) {
        return '<svg viewBox="-1 -1 14 14" style="transform: translateY(' + (i % 2 ? 6 : 0) + 'px) rotate(' +
            (i % 2 ? 98 : 82) + 'deg)" aria-hidden="true" focusable="false">' + PAW + '</svg>';
    }

    /* ------------------------------------------------------------------ *
     * Its own: the corner cat wakes, the laser, the 404's table
     * ------------------------------------------------------------------ */

    /* Touch the corner cat's tail and the tail flicks (style.css's flick
       in place of the drop), and the cat opens its eyes and lifts its
       head for a couple of seconds before it settles again. */
    function catnap(kit) {
        if (kit.reduced) return;
        Array.prototype.forEach.call(document.querySelectorAll('.kr-season-corner'), function (corner) {
            var tail = corner.querySelector('.kr-season-dangler');
            if (!tail) return;
            tail.addEventListener('click', function () {
                corner.classList.add('kr-season-catnap--woken');
                clearTimeout(corner.krNap);
                corner.krNap = setTimeout(function () { corner.classList.remove('kr-season-catnap--woken'); }, 2600);
            });
            // The engine clears the drop only after its own animation.
            tail.addEventListener('animationend', function (e) {
                if (e.animationName === 'kr-season-tailflick') tail.classList.remove('kr-season-dangler--drop');
            });
        });
    }

    /* A fluffy grey cat, low on its paws, stalking to the right (the
       laser's cat); its front legs reach up when it pounces. */
    var STALKER = svg('', '0 0 64 34',
        '<g class="kr-season-laser__leap">' +
        '<path d="M15 19.4C10 18 5.2 17.4 1.8 15c-1.2-.8-2.2.8-1.2 2 3 3.4 8.4 5.6 14 6z" fill="' + GREY + '"/>' +
        '<path class="kr-season-laser__paws" d="M43 22.6L55 12.4M41.4 24.2L55.6 16.6" stroke="' + GREY + '" stroke-width="3.4" stroke-linecap="round"/>' +
        '<path class="kr-season-laser__paws" d="M55.4 12.2a1.9 1.9 0 1 0 .01 0zM56 16.4a1.9 1.9 0 1 0 .01 0z" fill="' + GREY_PALE + '"/>' +
        '<path d="M12 21.6c0-5.6 5-8.2 12-8 8 .2 16 3.4 21 8 2 2 1 5.8-3 5.8H18c-4 0-6-2.2-6-5.8z" fill="' + GREY + '"/>' +
        '<path d="M12.6 22c0-4.2 3-6.6 6.4-6.6 3.8 0 6 3 6 6.6 0 2.4-.6 4.4-1.8 5.4h3.6c.8 1.6 0 3.2-1.4 3.2h-9c-2.6 0-3.8-3.6-3.8-8.6z" fill="' + GREY_DARK + '"/>' +
        '<ellipse cx="18.6" cy="30.4" rx="3.6" ry="1.5" fill="' + GREY_PALE + '"/>' +
        '<path d="M37 29.2h12.4M34.6 30.2H45" stroke="' + GREY + '" stroke-width="3.4" stroke-linecap="round"/>' +
        '<ellipse cx="50.6" cy="29.8" rx="2.6" ry="1.5" fill="' + GREY_PALE + '"/><ellipse cx="46.2" cy="30.8" rx="2.4" ry="1.3" fill="' + GREY_PALE + '"/>' +
        '<path d="M45.4 16.8l-.8-6 5 3.8zM52 14.4l5.6-3 0 6.2z" fill="' + GREY + '"/>' +
        '<path d="M46.2 15l-.3-2.8 2.2 1.8zM53.6 14.4l2.6-1.4v2.8z" fill="' + PINK + '"/>' +
        '<circle cx="50.6" cy="21" r="6.6" fill="' + GREY + '"/>' +
        '<path d="M43.6 23.4l1.6 4.2 1.8-2.6 1.8 3 1.2-3.4z" fill="' + GREY_PALE + '"/>' +
        '<ellipse cx="54.6" cy="23.6" rx="2.9" ry="2.1" fill="' + GREY_PALE + '"/>' +
        '<circle cx="53" cy="19.8" r="2.1" fill="' + AMBER + '"/><circle cx="53.3" cy="19.9" r="1.6" fill="' + PUPIL + '"/>' +
        '<circle cx="53.8" cy="19.2" r=".5" fill="#ffffff"/>' +
        '<path d="M57.4 22.2l1.4.3-.8 1z" fill="' + PINK + '"/>' +
        '<path d="M53 24.4l-5.6 1.4M56 24.8l6.4 1.6" stroke="#eef0f4" stroke-width=".4"/>' +
        '</g>');

    /* The homepage hero's laser dot and its cat: the dot sits under the
       mouse pointer while it is over the hero; the cat comes in from the
       nearer side and keeps to the foot of the picture, under the
       headline, running to get below the dot, stalking and wiggling once
       it is there, and pouncing when the dot comes down into the lowest
       third. When the pointer leaves, the dot goes out and the cat runs
       off. Mice only; never under reduced motion. */
    function laser(kit) {
        var hero = document.querySelector('.welcome-area');
        if (!hero || kit.reduced || hero.querySelector('.kr-season-laser') ||
            !(window.matchMedia && window.matchMedia('(pointer: fine)').matches)) return;
        var el = document.createElement('div');
        el.className = 'kr-season-laser';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<span class="kr-season-laser__dot"></span><span class="kr-season-laser__cat">' + STALKER + '</span>';
        hero.appendChild(el);
        var dot = el.firstChild, cat = el.lastChild;
        var CAT_W = 80;
        var px = 0, py = 0, w = 0, h = 0, inside = false, x = -CAT_W - 20, face = 1;
        var frame = 0, last = 0, still = 0, cool = 0, pose = '';

        function setPose(p) {
            if (p === pose) return;
            if (pose) cat.classList.remove('kr-season-laser__cat--' + pose);
            pose = p;
            if (p) cat.classList.add('kr-season-laser__cat--' + p);
        }

        function tick(now) {
            frame = 0;
            var dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
            last = now;
            var goal = inside ? px - CAT_W * 0.78 : (x + CAT_W / 2 < w / 2 ? -CAT_W - 30 : w + 30);
            if (inside && face < 0) goal = px - CAT_W * 0.22;
            var dx = goal - x;
            var want = dx > 3 ? 1 : (dx < -3 ? -1 : face);
            if (want !== face && Math.abs(dx) > 12) face = want;
            var far = Math.abs(dx) > 26;
            var speed = far ? 360 : 90;
            x += Math.max(-speed * dt, Math.min(speed * dt, dx));
            cool = Math.max(0, cool - dt);
            if (!inside) {
                setPose('run');
                if ((x <= -CAT_W - 29) || (x >= w + 29)) {
                    el.classList.remove('kr-season-laser--on');
                    setPose('');
                    last = 0;
                    return;
                }
            } else if (pose === 'pounce') {
                // Let the leap play out.
            } else if (far) {
                setPose('run');
                still = 0;
            } else {
                setPose('stalk');
                still += dt;
                if (still > 0.7 && cool <= 0 && py > h * 0.62) {
                    setPose('pounce');
                    cool = 1.6;
                    setTimeout(function () { if (pose === 'pounce') setPose('stalk'); still = 0; }, 650);
                }
            }
            cat.style.transform = 'translateX(' + x.toFixed(1) + 'px) scaleX(' + face + ')';
            // Crouched under a dot that is out of reach: nothing will change
            // until the pointer moves (the wiggle is CSS), so stop drawing.
            if (inside && pose === 'stalk' && Math.abs(dx) <= 3 && still > 0.7 && cool <= 0 && py <= h * 0.62) {
                last = 0;
                return;
            }
            frame = requestAnimationFrame(tick);
        }

        function run() {
            if (!frame) { last = 0; frame = requestAnimationFrame(tick); }
        }

        // The hero's box, read on the way in and when the page moves, not on
        // every move of the mouse.
        var r = null;
        function measure() { r = hero.getBoundingClientRect(); }
        hero.addEventListener('pointerenter', measure);
        window.addEventListener('scroll', function () { r = null; }, { passive: true });
        window.addEventListener('resize', function () { r = null; });

        hero.addEventListener('pointermove', function (e) {
            if (e.pointerType && e.pointerType !== 'mouse') return;
            if (!r) measure();
            w = r.width; h = r.height;
            px = e.clientX - r.left; py = e.clientY - r.top;
            if (!inside) {
                inside = true;
                if (!el.classList.contains('kr-season-laser--on')) {
                    x = px < w / 2 ? -CAT_W - 20 : w + 20;
                    face = px < w / 2 ? 1 : -1;
                }
                el.classList.add('kr-season-laser--on');
            }
            dot.style.transform = 'translate(' + px.toFixed(1) + 'px, ' + py.toFixed(1) + 'px)';
            run();
        });
        hero.addEventListener('pointerleave', function () {
            inside = false;
            dot.style.transform += ' scale(0)';
            run();
        });
    }

    /* The 404 page: a table, a black cat sitting on it beside the page,
       which is too near the edge. The cat pats it, it slides off and
       drifts down to the floor, and the cat turns to look at you (style.css
       times it, --play). Under reduced motion the page is already on the
       floor (--done). */
    function knock(kit) {
        var lede = document.querySelector('.kr-lost__lede');
        if (!lede || !document.getElementById('kr-lost-canvas') || document.querySelector('.kr-season-knock')) return;
        var el = document.createElement('div');
        el.className = 'kr-season-knock ' + (kit.reduced ? 'kr-season-knock--done' : 'kr-season-knock--play');
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = svg('', '0 0 220 124',
            '<path d="M4 120.5h212" stroke-width="1.2" class="kr-season-knock__floor"/>' +
            '<path d="M76 70v50M204 70v50" stroke="' + WOOD_DARK + '" stroke-width="5" stroke-linecap="round"/>' +
            '<path d="M62 64l14-14h140v14z" fill="' + WOOD + '"/>' +
            '<path d="M62 64h154v6H62z" fill="' + WOOD_DARK + '"/>' +
            '<g class="kr-season-knock__page">' +
            '<path d="M64 62l8-9h30l-8 9z" fill="#fbfaf6" stroke="#b8b2a6" stroke-width=".8"/>' +
            '<path d="M74 55.4h20M72.4 57.4h18M70.6 59.4h14" stroke="#9c968a" stroke-width=".9"/></g>' +
            '<path d="M150 58c-4 2-14 2-18 0-1-.6-.4-2 1-1.6 4 1 11 1 15-.4" fill="none" stroke="' + NILA + '" stroke-width="3.4" stroke-linecap="round"/>' +
            '<path d="M120 61c-6 0-8-5-7-12 1-9 6-16 14-16s13 7 14 16c1 7-1 12-7 12z" fill="' + NILA + '"/>' +
            '<g class="kr-season-knock__paw">' +
            '<path d="M118 47c-4 2-8 6-10 10" stroke="' + NILA + '" stroke-width="4.4" stroke-linecap="round"/>' +
            '<ellipse cx="107.6" cy="57.6" rx="2.8" ry="2" fill="' + NILA + '"/></g>' +
            '<path d="M122 56v4.6M131.4 56v4.6" stroke="#46444c" stroke-width="1" stroke-linecap="round"/>' +
            '<path d="M115.6 22l-1.4-11 8.4 6.4zM138.4 22l1.4-11-8.4 6.4z" fill="' + NILA + '"/>' +
            '<path d="M117 18.4l-.4-4.4 3.4 2.6zM137 18.4l.4-4.4-3.4 2.6z" fill="#8a6a74"/>' +
            '<ellipse cx="127" cy="26" rx="12.4" ry="10.6" fill="' + NILA + '"/>' +
            '<ellipse cx="121.6" cy="24.6" rx="2.6" ry="2.8" fill="' + GREEN + '"/><ellipse cx="132.4" cy="24.6" rx="2.6" ry="2.8" fill="' + GREEN + '"/>' +
            '<g class="kr-season-knock__eyes"><ellipse cx="121.6" cy="24.8" rx="1" ry="2.3" fill="' + PUPIL + '"/>' +
            '<ellipse cx="132.4" cy="24.8" rx="1" ry="2.3" fill="' + PUPIL + '"/></g>' +
            '<path d="M125.6 29.2h2.8L127 30.6z" fill="' + PINK + '"/>' +
            '<path d="M120 30.4l-9-.8M120 31.8l-8.6 1.8M134 30.4l9-.8M134 31.8l8.6 1.8" stroke="#bdbac4" stroke-width=".5"/>');
        lede.parentNode.insertBefore(el, lede);
    }

    // The pointer: a toy mouse, its nose the hotspot.
    var POINTER = '<path d="M16-3.4c3.6 3 6 8 6 14 0 5-2.6 8-6 8s-6-3-6-8c0-6 2.4-11 6-14z" fill="#a4a4b0"/>' +
        '<circle cx="12.4" cy="7.6" r="2.6" fill="#a4a4b0"/><circle cx="19.6" cy="7.6" r="2.6" fill="#a4a4b0"/>' +
        '<circle cx="12.4" cy="7.6" r="1.4" fill="#f2a6b3"/><circle cx="19.6" cy="7.6" r="1.4" fill="#f2a6b3"/>' +
        '<circle cx="14.6" cy="2.4" r=".7" fill="#1d1b1f"/><circle cx="17.4" cy="2.4" r=".7" fill="#1d1b1f"/>' +
        '<path d="M16 18.6c0 4 4.4 5.4 2.6 9-1.4 2.6-5 2-4.4 5" stroke="#f2a6b3" stroke-width="1.3" fill="none" stroke-linecap="round"/>';

    K.dress({
        // The ribbon's card (season.js, ribbon).
        about: { short: 'Cat Day', when: '8 August',
            text: 'International Cat Day was started in 2002 by the International Fund for Animal Welfare, and International Cat Care has run it since 2020. This house has four cats, and all four think every day is theirs.',
            link: 'https://en.wikipedia.org/wiki/International_Cat_Day' },
        corner: catnapArt, dangler: TAIL_TIP,
        // Tufts of fluff, now and then a small heart, drifting down.
        leaves: { kind: 'fall', colours: AIR_COLOURS, per1000: 10, shapes: [FLUFF, HEART], tumble: true, size: [10, 18] },
        // The tabby in the box meows, the yarn gets a small mew, the bowl a purr.
        patch: [{ art: BOX, size: 'big', sound: 'meow' },
                { art: YARN, size: 'small', sound: 'mew' },
                { art: BOWL, size: 'mid', sound: 'purr' }],
        strew: [mouse(22), jingle(9, '#e86a8a'), feather(22, -78), jingle(8, '#5aa9e6'), mouse(16)],
        puff: 'kr-season-puff--hearts',
        flyer: CHASE, flight: 'kr-season-flyer--chase',
        favicon: CAT_ICON, moonmark: MOON_CAT,
        // A paw print every 30px of a post's top, once the reader has passed.
        track: { kind: 'paws', mode: 'bits', every: 30, bit: pawPrint },
        fog: false,
        map: null,
        lost: {
            title: 'The Cat Knocked This Page Off the Table',
            lede: 'It was right here, near the edge. Then the cat looked me in the eye and gave it a push, ' +
                'and now it is somewhere under the sofa.',
            caption: 'While I look for it, have a random photograph. The cats chose it. '
        },
        cursor: K.pointer(POINTER, 2, 2, -45),
        extra: function (kit) {
            catnap(kit);
            K.walker(TUXEDO, 'tuxedo');
            K.walker(CALICO, 'calico');
            laser(kit);
            knock(kit);
        }
    });
})();
