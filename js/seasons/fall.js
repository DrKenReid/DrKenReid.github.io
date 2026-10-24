/**
 * seasons/fall.js: the fall's art for js/season.js (see that file for the
 * pieces): an oak twig with an acorn, more leaves, plain pumpkins in
 * orange, cream and red, geese in a V, a maple leaf favicon, a twig whose
 * leaves fall as the reader passes them, a golden haze in both themes,
 * leaves on the places most photographed in autumn, a 404 page that has
 * fallen. Its own: a squirrel that runs along the footer's top edge once
 * (kit.walker), stops to look about by the pumpkins and dashes off; a
 * click on it sends it off at once.
 *
 * Classes only this file applies (css/seasons/fall.css):
 * .kr-season-pumpkin, .kr-season-dangler__body, .kr-season-flyer__body,
 * .kr-season-flyer__wing (--l, --r), .kr-season-badge__body,
 * and the walker's kind, squirrel (kr-season-walker--squirrel).
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg, leafAt = K.leafAt, MAPLE = K.MAPLE, OVAL = K.OVAL;

    // The Halloween leaves, wider: the same with brick, a late green and a yellow.
    var FALL_COLOURS = K.LEAF_COLOURS.concat(['#a33a1c', '#8a9a3b', '#e6c13d']);

    // An oak twig reaching in from the corner, four leaves on it.
    function twigArt() {
        return '<path d="' + K.TWIG + '"' +
            ' fill="none" stroke-width="2.2" stroke-linecap="round"/>' +
            leafAt(OVAL, FALL_COLOURS[2], 46, 28, 170, 0.75) +
            leafAt(MAPLE, FALL_COLOURS[0], 10, 27, -110, 0.8) +
            leafAt(OVAL, FALL_COLOURS[5], 30, 12, -40, 0.6) +
            leafAt(MAPLE, FALL_COLOURS[1], 6, 44, 200, 0.7);
    }

    var ACORN = svg('kr-season-dangler__body', '0 0 20 20',
        '<path d="M10 3.4V1" stroke="#6b4423" stroke-width="1.4" stroke-linecap="round"/>' +
        '<path d="M5.4 9h9.2c0 5-1.9 8.7-4.6 10.4C7.3 17.7 5.4 14 5.4 9z" fill="#b5762f"/>' +
        '<path d="M4 9.2c0-3.4 2.7-5.8 6-5.8s6 2.4 6 5.8z" fill="#6b4423"/>');

    // Five geese in a V, flying right: a body, a neck and head, two wings.
    function geese() {
        var one = '<ellipse cx="0" cy="0" rx="3.4" ry="1.5"/>' +
            '<path d="M2.6-.7l3.6-1 1.4.5-1.3.7-3.4 1.1z"/>' +
            '<path class="kr-season-flyer__wing kr-season-flyer__wing--l" d="M.6-.6C-1.4-4.4-4.4-6.4-8.6-7c2.2 2.2 3.8 4.7 6.6 7.2z"/>' +
            '<path class="kr-season-flyer__wing kr-season-flyer__wing--r" d="M.2.6C-1.8 3.8-4.6 5.6-8 6.2c1.8-2 3.2-4.1 5.6-6.4z"/>';
        var at = [[130, 30], [106, 19], [106, 41], [82, 8], [82, 52]];
        return svg('kr-season-flyer__body', '0 0 144 60', at.map(function (p) {
            return '<g transform="translate(' + p[0] + ' ' + p[1] + ') scale(1.6)">' + one + '</g>';
        }).join(''));
    }

    var MAPLE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<path d="' + MAPLE + '" fill="#d9622b"/>' +
        '<path d="M12 14v9" stroke="#8c3b1f" stroke-width="1.4" stroke-linecap="round"/></svg>';

    // A small leaf for the moon, tumbling across it.
    var MOON_LEAF = 'M15.6 9.4c.4 2.5-.5 4.7-2.4 6-1.3.9-2.9 1.1-4.4.6.5-1.5 1.5-2.8 2.9-3.6 1.3-.8 2.4-1.8 3.9-3z';

    var MAP_LEAF = svg('kr-season-badge__body', '0 0 24 24', '<path d="' + MAPLE + '"/>');

    // A grey squirrel side on, facing right, its tail curled up behind.
    var SQUIRREL = svg('', '0 0 40 30',
        '<path class="kr-season-walker__tail" d="M13 22C4 22 1 14 3 8s9-8 12-3c2 4-3 6-4 9-1 2 1 5 3 6z"/>' +
        '<path d="M12 23c0-6 4-10 10-10 3-3 7-4 10-2l2-3 1 4c2 1 3 3 3 5l-3 1c-1 2-3 3-5 3l1 4h-3l-1-3h-6l1 3h-3l-1-3c-3 1-5 1-7 1z"/>' +
        '<circle cx="33.4" cy="12.8" r=".9" fill="#1f1a14"/>');

    K.dress({
        corner: twigArt, dangler: ACORN,
        leaves: { kind: 'fall', colours: FALL_COLOURS, per1000: 20, shapes: [MAPLE, OVAL], tumble: true },
        // The big pumpkin crunches through leaves, the cream one caws,
        // the red one honks.
        patch: [{ art: K.pumpkin(null), size: 'big', sound: 'leaves' },
                { art: K.pumpkin(null, ['#d8c49a', '#ecdcb6', '#bfa878']), size: 'small', sound: 'crow' },
                { art: K.pumpkin(null, ['#a8401a', '#c4552a', '#93361a']), size: 'mid', sound: 'geese' }],
        strew: K.strewnLeaves(FALL_COLOURS), puff: 'kr-season-puff--leaves',
        flyer: geese(), flight: 'kr-season-flyer--glide',
        favicon: MAPLE_ICON, moonmark: MOON_LEAF,
        // A leaf every 64px of twig, the reader's passing drops it.
        track: { kind: 'branch', mode: 'bits', every: 64, bit: function (i) {
            return svg('', '0 0 24 24', '<path d="' + (i % 3 ? OVAL : MAPLE) + '" fill="' +
                FALL_COLOURS[(i * 5) % FALL_COLOURS.length] + '" transform="rotate(180 12 12)"/>');
        } },
        map: { tag: 'autumn', min: 3, share: 0.05, badge: MAP_LEAF },
        lost: {
            title: 'This Page Has Fallen',
            lede: 'Like the leaves outside, whatever was here came down and blew away.',
            caption: "While you're here, have one of my autumn photographs. "
        },
        // An amber pointer with a maple leaf at its tail.
        cursor: K.cursor('#e8a33d', '<path transform="scale(.5)" fill="#c4512a" stroke="#5a2a10" stroke-width="1" d="' + MAPLE + '"/>'),
        extra: function () { K.walker(SQUIRREL, 'squirrel'); }
    });
})();
