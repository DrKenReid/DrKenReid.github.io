/**
 * seasons/burns-night.js: Burns Night's art for js/season.js (see that
 * file for the pieces), for the supper on 25 January: a sprig of heather
 * with a thistle and a wee mouse hanging by its tail, thistledown and a
 * little snow in the air, a haggis on its plate, a dram and a bowl of
 * neeps and tatties among heather, a red grouse whirring past, a thistle
 * favicon, a quill across the moon, a quill drawing out a tartan ribbon
 * as the reader goes, peat smoke in the dark theme, thistles on the
 * Scottish places, a 404 page that has gone agley, a heather pointer
 * with a thistle. Its own: a line of
 * Burns over the footer, written out by hand, and a new one each time the
 * line or the haggis is clicked (the haggis wobbles too).
 *
 * Classes only this file applies (css/seasons/burns-night.css):
 * .kr-season-pumpkin, .kr-season-haggis, .kr-season-dangler__body,
 * .kr-season-dangler__line, .kr-season-flyer__body, .kr-season-flyer__wing
 * (--l, --r), .kr-season-quill, .kr-season-badge__body, .kr-season-verse
 * (__line, __source).
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg, bar = K.bar;

    // Heather's bells, from deep to pale; the thistle's tuft and its bulb.
    var HEATHER = ['#8e4a8f', '#a75fa6', '#c27fbf', '#d9a5d4'];
    var TUFT = '#9a4fb0', TUFT_DEEP = '#6f3487', BULB = '#4f7a3a', BULB_DEEP = '#36572a';

    /* A thistle on a 24 x 24 box, head up, its stem down to (12, 24): the
       purple tuft fanned over a green bulb crossed by its bracts. */
    function thistle() {
        return '<path d="M6.2 9.6L4.4 3.4l3.4 3.8L8.6.8l2.2 5.6L12 0l1.2 6.4 2.2-5.6.8 6.4 3.4-3.8-1.8 6.2z" fill="' + TUFT + '"/>' +
            '<path d="M8.4 9.4L7 4.6M15.6 9.4L17 4.6M12 9V2.6" stroke="' + TUFT_DEEP + '" stroke-width=".7" fill="none"/>' +
            '<path d="M6.4 9.2h11.2c0 4.8-2.6 8.6-5.6 8.6s-5.6-3.8-5.6-8.6z" fill="' + BULB + '"/>' +
            '<path d="M8 10.4l6.6 6M16 10.4l-6.6 6M7.2 13.2l4.4 4.2M16.8 13.2l-4.4 4.2M6.6 14.6l-2.6 1.2M17.4 14.6l2.6 1.2"' +
            ' stroke="' + BULB_DEEP + '" stroke-width=".7" fill="none"/>' +
            '<path d="M12 17.6V24" stroke="' + BULB_DEEP + '" stroke-width="1.4" fill="none"/>';
    }

    function thistleAt(x, y, turn, scale) {
        return '<g transform="translate(' + x + ' ' + y + ') rotate(' + turn + ') scale(' + scale + ') translate(-12 -12)">' +
            thistle() + '</g>';
    }

    /* A spike of heather: tiny bells in pairs up a stem from (x, y),
       `len` long at `deg`, the bells small at the tip. */
    function spike(x, y, len, deg, n, shade) {
        var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), out = '';
        for (var i = 0; i < n; i++) {
            var t = 0.25 + 0.75 * i / (n - 1), r = 1.7 - 0.8 * i / (n - 1);
            var bx = x + c * len * t, by = y + s * len * t, side = i % 2 ? 1 : -1;
            out += '<circle cx="' + (bx - s * side * 1.3).toFixed(1) + '" cy="' + (by + c * side * 1.3).toFixed(1) +
                '" r="' + r.toFixed(2) + '" fill="' + HEATHER[(i + shade) % HEATHER.length] + '"/>';
        }
        return out;
    }

    // A sprig of heather reaching in from the corner, a thistle at its end.
    function sprigArt() {
        return '<path d="M64 3C53 8 43 13 34 21S19 34 13 42M50 9c-1 6 0 11 3 15M38 17c-6-2-12-1-17 2M27 27c-1 5 0 9 2 12"' +
            ' fill="none" stroke-width="2" stroke-linecap="round"/>' +
            spike(50, 9, 16, 80, 7, 0) + spike(38, 17, 18, 168, 7, 1) + spike(27, 27, 13, 82, 6, 2) +
            spike(58, 5, 10, 150, 5, 3) + spike(44, 13, 10, 120, 5, 1) +
            thistleAt(9, 48, 210, 0.95);
    }

    // A wee mouse hanging by its tail, nose down, the tail curling up to the thread.
    var MOUSE = svg('kr-season-dangler__body', '0 0 20 20',
        '<path class="kr-season-dangler__line" d="M10 6.2c1.8-1 2.4-2.4 1.4-3.6S9.6 1 10 0" style="stroke-width: .9"/>' +
        '<g stroke="#e9dccb" stroke-width=".5" stroke-opacity=".7">' +
        '<path d="M10 5.6c3 0 4.6 2.6 4.6 6 0 2.6-1.4 4.4-2.8 5.6L10 19.6l-1.8-2.4C6.8 16 5.4 14.2 5.4 11.6c0-3.4 1.6-6 4.6-6z"/>' +
        '<circle cx="6.5" cy="14.6" r="1.9"/><circle cx="13.5" cy="14.6" r="1.9"/></g>' +
        '<circle cx="6.5" cy="14.6" r=".9" fill="#e8a6ad"/><circle cx="13.5" cy="14.6" r=".9" fill="#e8a6ad"/>' +
        '<circle cx="10" cy="19.3" r=".85" fill="#e8a6ad"/>');

    /* A bit of thistledown on the leaves' 24 x 24 box: a seed with its
       fan of fine hairs, all filled (the canvas fills every shape). */
    function thistledown() {
        var d = 'M10.8 19.6a1.2 2 0 1 0 2.4 0a1.2 2 0 1 0-2.4 0z';
        for (var deg = -160; deg <= -20; deg += 20) d += bar(12, 18.2, 10.5, deg, 0.7);
        return d;
    }
    var DOWN_COLOURS = ['#ffffff', '#f4eefa', '#e8dcf2', '#dcc6ea'];

    /* The supper on the pumpkins' 64 x 56 box. The haggis sits on a
       plate, plump and tied at the top with string. */
    var HAGGIS = svg('kr-season-pumpkin kr-season-haggis', '0 0 64 56',
        '<ellipse cx="32" cy="48" rx="29" ry="6.5" fill="#f3efe6" stroke="#a89f90" stroke-width="1"/>' +
        '<ellipse cx="32" cy="47.4" rx="20" ry="3.6" fill="none" stroke="#cfc6b6" stroke-width="1"/>' +
        '<path d="M12 36c0-11 9-19 20-19s20 8 20 19c0 6-6 10-20 10S12 42 12 36z" fill="#7d4f33"/>' +
        '<path d="M19 26c3-4 8-6 13-6M44 28c2 2 3 4 3 7" fill="none" stroke="#a87150" stroke-width="2.2" stroke-linecap="round"/>' +
        '<path d="M16 31c9 4 23 4 32 0M14 38c10 4.6 26 4.6 36 0" fill="none" stroke="#eadcbc" stroke-width="1.1"/>' +
        '<path d="M32 17c-1.6-2.4-4.4-3-6.4-1.6M32 17c1.6-2.4 4.4-3 6.4-1.6M32 17v-4" fill="none" stroke="#eadcbc"' +
        ' stroke-width="1.1" stroke-linecap="round"/>' +
        '<path d="M28.4 18.2c1-2 6.2-2 7.2 0-1 1.6-6.2 1.6-7.2 0z" fill="#6a4129"/>' +
        '<g transform="translate(43 13) rotate(30) scale(.55)">' + spike(0, 0, 18, 90, 6, 0) +
        '<path d="M0 0v18" stroke="#5c6b3a" stroke-width="1.4"/></g>');

    // A dram in a nosing glass: a tulip bowl, a short stem, a broad foot.
    var DRAM = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M22 4h20c0 9 6 14 6 25 0 8-5 13-12 14v5c4 0 8 1.4 8 3.6H20c0-2.2 4-3.6 8-3.6v-5c-7-1-12-6-12-14 0-11 6-16 6-25z"' +
        ' fill="#e4eef1" fill-opacity=".55" stroke="#8fa3ab" stroke-width="1.2"/>' +
        '<path d="M17.6 31c.6 7 5.4 11 14.4 11s13.8-4 14.4-11z" fill="#c4842a"/>' +
        '<ellipse cx="32" cy="31" rx="14.4" ry="2.4" fill="#e3a84a"/>' +
        '<path d="M22.6 10c-.6 6-3.6 10-3.6 17" fill="none" stroke="#ffffff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>');

    // Neeps and tatties: an orange mound and a cream one in a blue bowl.
    var NEEPS = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M9 30c0-8 6-13 12-12 2-4 8-5 11-1 3 3 4 7 3 13z" fill="#e3933a"/>' +
        '<path d="M15 24c2-2 5-3 8-2M25 20c2 0 4 1 5 3" fill="none" stroke="#c4741f" stroke-width="1.2" stroke-linecap="round"/>' +
        '<path d="M29 30c0-8 6-12 12-11 3-3 9-2 11 2 3 2 4 5 3 9z" fill="#f2e6bf"/>' +
        '<path d="M36 23c3-2 6-2 9 0M46 21c2 0 4 1 5 3" fill="none" stroke="#d2c08e" stroke-width="1.2" stroke-linecap="round"/>' +
        '<rect x="38" y="16.4" width="6" height="4" rx="1" fill="#f7d65a" transform="rotate(-12 41 18.4)"/>' +
        '<path d="M6 29h52c-1 12-11 20-26 20S7 41 6 29z" fill="#2f5f8f"/>' +
        '<path d="M8.4 34h47.2" stroke="#f3efe6" stroke-width="2"/>' +
        '<path d="M14 34l3 2.4 3-2.4 3 2.4 3-2.4 3 2.4 3-2.4 3 2.4 3-2.4 3 2.4 3-2.4 3 2.4 3-2.4" fill="none" stroke="#2f5f8f" stroke-width=".9"/>' +
        '<ellipse cx="32" cy="50" rx="10" ry="2" fill="#24496f"/>');

    // A sprig of heather for between the dishes, s px tall.
    function sprig(s, turn, shade) {
        return '<svg class="kr-season-leaf" viewBox="0 0 24 24" width="' + s + '" height="' + s + '"' +
            ' style="transform: rotate(' + turn + 'deg)" aria-hidden="true" focusable="false">' +
            '<path d="M12 23V4M12 15l-5-5M12 12l5-4" fill="none" stroke="#5c6b3a" stroke-width="1.3" stroke-linecap="round"/>' +
            spike(12, 22, 18, -90, 7, shade) + spike(12, 15, 7, -135, 4, shade + 1) + spike(12, 12, 6, -39, 4, shade + 2) +
            '</svg>';
    }

    /* A red grouse seen from below as it whirrs over the moor: a plump
       body, short round wings, the red comb over its eye. */
    var GROUSE = svg('kr-season-flyer__body', '0 0 64 32',
        '<path class="kr-season-flyer__wing kr-season-flyer__wing--l" d="M27 12C22 8 14 7 5 9c1 1.6 1 2.8 0 4 2 .4 2.6 1.6 1.6 3 3 .2 4 1.4 3.4 3 6 0 12-1.4 18-3z"/>' +
        '<path class="kr-season-flyer__wing kr-season-flyer__wing--r" d="M37 12c5-4 13-5 22-3-1 1.6-1 2.8 0 4-2 .4-2.6 1.6-1.6 3-3 .2-4 1.4-3.4 3-6 0-12-1.4-18-3z"/>' +
        '<path d="M32 4c-4.4 0-7 3-7 7 0 6 2.6 11.4 4.6 13.4l-1.6 4.6 4-2 4 2-1.6-4.6c2-2 4.6-7.4 4.6-13.4 0-4-2.6-7-7-7z"/>' +
        '<path d="M28.6 7.4c.8-1.2 1.8-1.6 2.6-1.2M35.4 7.4c-.8-1.2-1.8-1.6-2.6-1.2" fill="none" stroke="#c23a2b" stroke-width="1.3" stroke-linecap="round"/>' +
        '<path d="M31 3.4l1 -2.2 1 2.2z" fill="#3a2a20"/>');

    var THISTLE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<path d="M12 18v6" stroke="#36572a" stroke-width="1.6"/>' +
        '<path d="M12 21.4c-2-.4-3.6-1.6-4.6-3.4l1.6.2-.4-1.6 1.4.8.4-1.4c.8 1.6 1.4 3.4 1.6 5.4zM12 20.4c2-.4 3.6-1.6 4.6-3.4l-1.6.2.4-1.6-1.4.8-.4-1.4c-.8 1.6-1.4 3.4-1.6 5.4z" fill="#4f7a3a"/>' +
        thistle().replace(/stroke-width="\.7"/g, 'stroke-width=".9"') + '</svg>';

    // A quill crossing the moon, the nib to the lower left.
    var MOON_QUILL = 'M17.4 5.8c-4 .3-7 3.3-8 7.4l-.9 2.8.8.4 1.4-2.6c3.6-.8 6-3.8 6.7-8zM8.3 16.4l-1.6 2.6.5.3 1.7-2.5z';

    var MAP_THISTLE = svg('kr-season-badge__body', '0 0 24 24', thistle());

    // The track's tip: a quill, its nib at the reader, a drop of ink on it.
    var QUILL = svg('kr-season-quill', '0 0 16 24',
        '<path d="M1.6 22.6L14.4 2" stroke="#4a3d2c" stroke-width=".9"/>' +
        '<path d="M14.8 1.2c-4.4.4-8 4-9.4 9.4l-1.4 5 1 .5c4.6-2.8 8.2-7.8 9.8-14.9z" fill="#d8c39a" stroke="#5c4a34" stroke-width=".7"/>' +
        '<path d="M9 9.6c1.4-1.2 2.6-2.8 3.4-4.6M7.4 13c1.6-.8 3-2 4.2-3.4" fill="none" stroke="#9c855f" stroke-width=".6"/>' +
        '<path d="M.6 23.6l1.6-3.8 1.4.8z" fill="#2b2520"/>');

    /* Lines of Burns for the verse over the footer, each with its poem.
       A slash is a line break, set as one. */
    var VERSES = [
        ["Great chieftain o' the puddin-race!", 'Address to a Haggis'],
        ["The best laid schemes o' mice an' men / Gang aft agley", 'To a Mouse'],
        ["Wee, sleekit, cow'rin, tim'rous beastie", 'To a Mouse'],
        ["O wad some Pow'r the giftie gie us / To see oursels as ithers see us!", 'To a Louse'],
        ["My heart's in the Highlands, my heart is not here", "My Heart's in the Highlands"],
        ["O my Luve's like a red, red rose", 'A Red, Red Rose'],
        ["A man's a man for a' that", "A Man's a Man for A' That"],
        ['Nursing her wrath to keep it warm', "Tam o' Shanter"],
        ['Weel done, Cutty-sark!', "Tam o' Shanter"],
        ["Now's the day, and now's the hour", 'Scots Wha Hae']
    ];

    /* A line of Burns in the band over the footer, at its right, written
       out a letter at a time. A click on the line, or on the haggis, writes
       the next one. Under reduced motion each line is there at once. The
       footer is decoration's: aria-hidden, never focused. */
    function verse(kit) {
        var footer = document.querySelector('.kr-footer');
        if (!footer || footer.querySelector('.kr-season-verse')) return;
        var el = document.createElement('div');
        el.className = 'kr-season-verse';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<span class="kr-season-verse__line"></span><span class="kr-season-verse__source"></span>';
        footer.appendChild(el);
        var line = el.firstChild, source = el.lastChild;
        var at = (Math.random() * VERSES.length) | 0, timer = 0;

        function write() {
            var words = VERSES[at][0].replace(' / ', ', '), shown = 0;
            clearInterval(timer);
            source.textContent = VERSES[at][1];
            if (kit.reduced) { line.textContent = words; return; }
            line.textContent = '';
            timer = setInterval(function () {
                shown += 1;
                line.textContent = words.slice(0, shown);
                if (shown >= words.length) clearInterval(timer);
            }, 38);
        }
        function next() {
            at = (at + 1) % VERSES.length;
            write();
        }
        el.addEventListener('click', next);
        var haggis = footer.querySelector('.kr-season-patch > span');
        if (haggis) haggis.addEventListener('click', next);
        // Write the first line once the footer comes into view.
        if (!window.IntersectionObserver) { write(); return; }
        kit.onFooter(write, 0.1);
    }

    K.dress({
        corner: sprigArt, dangler: MOUSE,
        // Thistledown mostly, and a little snow: it is January.
        leaves: { kind: 'fall', colours: DOWN_COLOURS, per1000: 14, shapes: [thistledown(), K.DOT], tumble: false, size: [18, 30] },
        // The haggis is piped in, the dram clinks, the neeps and tatties
        // sit by the fire.
        patch: [{ art: HAGGIS, size: 'big', sound: 'pipes' },
                { art: DRAM, size: 'small', sound: 'clink' },
                { art: NEEPS, size: 'mid', sound: 'fire' }],
        strew: [sprig(20, -24, 0), sprig(16, 18, 1), sprig(18, -8, 2), sprig(19, 30, 3), sprig(14, -40, 1)],
        puff: 'kr-season-puff--steam',
        flyer: GROUSE, flight: 'kr-season-flyer--whirr',
        favicon: THISTLE_ICON, moonmark: MOON_QUILL,
        // A tartan ribbon that the quill draws out as far as the reader has read.
        track: { kind: 'tartan', mode: 'fill', tip: QUILL },
        map: { places: ['Scotland', 'Fife'], badge: MAP_THISTLE },
        lost: {
            title: 'This Page Has Gone Agley',
            lede: "The best laid schemes o' mice an' men gang aft agley, and so did this link.",
            caption: "While you're here, have one of my photographs of Scotland. "
        },
        extra: verse,
        // A heather pointer with a thistle at its tail.
        cursor: K.cursor('#c27fbf', '<g transform="scale(.5)">' + thistle() + '</g>', '#3a1f3d')
    });
})();
