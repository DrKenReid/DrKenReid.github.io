/**
 * seasons/womens-day.js: International Women's Day's art for js/season.js
 * (see that file for the pieces), for 8 March, in the day's purple, white
 * and green: a sash in the three colours across the corner with a badge
 * pinned to it, the Venus symbol with a raised fist inside its circle,
 * and a Venus symbol hanging on the thread; confetti in the three colours
 * and the odd Venus symbol falling over the openers; a jar of mimosa (the
 * day's flower in Italy and across Eastern Europe), an enamel badge and a
 * ballot box on the footer, with sprigs of mimosa, a violet, a rosette
 * and a ballot paper between them; confetti from whatever is clicked; a
 * small airship trailing a banner in the three colours; a sash that
 * grows across a post's top as the reader goes, a rosette at its end;
 * Venus symbols, raised fists and mimosa in the margins; a Venus symbol
 * for the favicon and in the moon; a hat pin with a rosette in the three
 * colours for the pointer; and a 404 page
 * left out of the history books. Every drawing is the site's own.
 * Its own:
 *   - a click on the corner's badge raises the fist inside it
 *   - a slip over the footer (from 992px) names a woman whose work
 *     science and computing stand on, and a click turns it to the next;
 *     under reduced motion the next is simply there
 *
 * Classes only this file applies (css/seasons/womens-day.css):
 * .kr-season-pumpkin, .kr-season-dangler__body, .kr-season-iwd-badge,
 * .kr-season-iwd-fist, .kr-season-iwd-raise (on the corner's art),
 * .kr-season-iwd-banner, .kr-season-puff--sash, .kr-season-flyer--airship,
 * .kr-season-track--sash, .kr-season-iwd-rosette, .kr-season-iwd-slip
 * (--turn, __line, __source).
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg, star = K.star;

    // The day's colours, and the mimosa's.
    var PURPLE = '#6b2d8f', PURPLE_MID = '#8e4fbf', LILAC = '#c9a7e8', GREEN = '#2f8f4e', GREEN_LIGHT = '#8fd19e';
    var WHITE = '#ffffff', EDGE = '#3e1a5a', MIMOSA = '#f5c400', MIMOSA_DARK = '#d9a400', STEM = '#4f7f2e', FERN = '#6d9f45';

    /* The Venus symbol on a 24 x 24 box, as one shape: a ring about
       (12, 9) and a cross below it. The ring's outer circle runs one way
       and its inner circle the other, so the middle stays open; the cross
       runs the outer circle's way, so it joins the ring. */
    var VENUS_24 = 'M5 9a7 7 0 1 0 14 0a7 7 0 1 0-14 0z' +
        'M7 9a5 5 0 1 1 10 0a5 5 0 1 1-10 0z' +
        'M11 15.4v7.6h2v-7.6zM8 18.4v2h8v-2z';
    /* A raised fist inside that ring, wound the outer circle's way so it
       fills the opening: the forearm rises from the ring's foot to a fist
       of four knuckles. */
    var FIST_24 = 'M9.4 6.6V10Q9.4 10.6 10.2 10.8H10.6V14.4H13.4V10.8H13.8Q14.6 10.6 14.6 10V6.6' +
        'Q14.6 5.6 13.95 5.6Q13.3 5.6 13.3 6.3Q13.3 5.4 12.65 5.4Q12 5.4 12 6.2' +
        'Q12 5.4 11.35 5.4Q10.7 5.4 10.7 6.3Q10.7 5.6 10.05 5.6Q9.4 5.6 9.4 6.6z';
    // The fist's fingers, thumb and wrist, as lines over it.
    var FIST_LINES = 'M10.7 6.4v1.5M12 6.2v1.6M13.3 6.4v1.5M9.6 8.7c1.2-.5 2.6-.4 3.6.3M10.7 11.3h2.6';
    var VENUS_FIST_24 = VENUS_24 + FIST_24;

    /* The Venus symbol with the fist, at (x, y), s times the 24 box, in
       `colour`, the fist's lines in `lines`. The fist is a group of its
       own, so a click can raise it. */
    function venusFist(x, y, s, colour, lines) {
        return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" stroke="none">' +
            '<path d="' + VENUS_24 + '" fill="' + colour + '"/>' +
            '<g class="kr-season-iwd-fist"><path d="' + FIST_24 + '" fill="' + colour + '"/>' +
            '<path d="' + FIST_LINES + '" fill="none" stroke="' + lines + '" stroke-width=".42" stroke-linecap="round"/></g></g>';
    }

    /* A round badge at (cx, cy) of radius r: a green rim, a purple ring, a
       white face and the Venus symbol with the fist in purple. */
    function badge(cx, cy, r) {
        var s = r * 1.3 / 24;
        return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + GREEN + '"/>' +
            '<circle cx="' + cx + '" cy="' + cy + '" r="' + K.fix(r * 0.88) + '" fill="' + PURPLE + '" stroke="none"/>' +
            '<circle cx="' + cx + '" cy="' + cy + '" r="' + K.fix(r * 0.74) + '" fill="' + WHITE + '" stroke="none"/>' +
            venusFist(K.fix(cx - 12 * s), K.fix(cy - 12.5 * s), K.fix(s), PURPLE, WHITE) +
            '<path d="M' + K.fix(cx - r * 0.62) + ' ' + K.fix(cy - r * 0.3) + 'a' + K.fix(r * 0.68) + ' ' + K.fix(r * 0.68) +
            ' 0 0 1 ' + K.fix(r * 0.5) + '-' + K.fix(r * 0.4) + '" fill="none" stroke="' + WHITE + '" stroke-opacity=".5" stroke-width="' +
            K.fix(r * 0.08) + '" stroke-linecap="round"/>';
    }

    /* The corner: a sash in the three colours across the corner, off both
       edges, with the badge pinned where it crosses; the hanging Venus
       symbol's thread runs behind them. */
    function sashArt() {
        return '<path d="M26 0h6l32 32v6z" fill="' + GREEN + '"/>' +
            '<path d="M20 0h6l38 38v6z" fill="' + WHITE + '"/>' +
            '<path d="M14 0h6l44 44v6z" fill="' + PURPLE + '"/>' +
            '<g class="kr-season-iwd-badge">' + badge(43.5, 20.5, 11) + '</g>';
    }

    // The Venus symbol on its thread, hung by its ring, with a pale edge
    // so it shows on a dark photograph too.
    var VENUS_HANGING = svg('kr-season-dangler__body', '0 0 20 20',
        '<g fill="none" stroke-linecap="round">' +
        '<circle cx="10" cy="6.6" r="4.6" stroke="' + WHITE + '" stroke-opacity=".85" stroke-width="3.6"/>' +
        '<path d="M10 11.4v7.2M6.8 15.4h6.4" stroke="' + WHITE + '" stroke-opacity=".85" stroke-width="3.6"/>' +
        '<circle cx="10" cy="6.6" r="4.6" stroke="' + PURPLE + '" stroke-width="2.2"/>' +
        '<path d="M10 11.4v7.2M6.8 15.4h6.4" stroke="' + PURPLE + '" stroke-width="2.2"/></g>');

    /* A jar of mimosa on the pumpkins' 64 x 56 box: a glass jar half full
       of water with a ribbon in the three colours round it, stems with
       feathery leaves, and the flowers in fluffy yellow balls. */
    var BALLS = [[22, 20], [18, 25], [26, 16], [33, 13], [30, 19], [37, 16], [45, 21], [48, 26], [41, 18],
        [27, 23], [36, 21], [20, 15], [42, 13], [15, 21], [50, 20], [32, 9], [25, 11]];
    var MIMOSA_JAR = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M30 50C29 42 27 34 22 22M32 50c0-10 1-20 1-34M34 50c2-9 6-18 12-25M31 46c-3-8-8-14-14-20M33 44c3-8 9-16 16-20"' +
        ' fill="none" stroke="' + STEM + '" stroke-width="1.2"/>' +
        '<path d="M24 27l-4-1.4M25 30h-4.4M33 24l-4-1.6M33 28l4-2M42 28l3.4 1M40 31l-3-2.4M20 25l-1-3M46 24l2-3"' +
        ' fill="none" stroke="' + FERN + '" stroke-width="1.5" stroke-linecap="round"/>' +
        '<g stroke="none" fill="' + MIMOSA + '">' + BALLS.map(function (b, i) {
            return '<circle cx="' + b[0] + '" cy="' + b[1] + '" r="' + (i % 3 ? 2.6 : 3) + '"/>';
        }).join('') + '</g>' +
        '<g stroke="none" fill="' + MIMOSA_DARK + '">' + BALLS.filter(function (b, i) { return i % 2; }).map(function (b) {
            return '<circle cx="' + (b[0] + 0.9) + '" cy="' + (b[1] + 0.9) + '" r=".9"/>';
        }).join('') + '</g>' +
        '<path d="M22 30.6h20V50a3 3 0 0 1-3 3H25a3 3 0 0 1-3-3z" fill="#dff1f5" fill-opacity=".45" stroke="#7d97a3" stroke-width="1"/>' +
        '<path d="M23 39h18v11a2 2 0 0 1-2 2H25a2 2 0 0 1-2-2z" fill="#a9d6e5" fill-opacity=".55" stroke="none"/>' +
        '<path d="M21 28.6h22v2.4H21z" fill="#cfe6ec" stroke="#7d97a3" stroke-width=".8"/>' +
        '<g stroke="none"><path d="M22 32.6h20V34H22z" fill="' + PURPLE + '"/><path d="M22 34h20v1.4H22z" fill="' + WHITE + '"/>' +
        '<path d="M22 35.4h20v1.4H22z" fill="' + GREEN + '"/>' +
        '<path d="M32 34.7l-6-3.6v7.2zM32 34.7l6-3.6v7.2z" fill="' + PURPLE_MID + '"/>' +
        '<path d="M31 35.4l-3 7 2 .4 2-6zM33 35.4l3 7-2 .4-2-6z" fill="' + GREEN + '"/></g>' +
        '<path d="M24.4 31.6c-.6 6-.6 12 0 18" fill="none" stroke="#ffffff" stroke-opacity=".7" stroke-width="1.1" stroke-linecap="round"/>');

    // The enamel badge, standing on its edge, its shadow under it.
    var ENAMEL = svg('kr-season-pumpkin', '0 0 64 56',
        '<ellipse cx="32" cy="51.6" rx="15" ry="2.2" fill="#000000" fill-opacity=".22" stroke="none"/>' +
        '<g stroke="' + EDGE + '" stroke-width=".8">' + badge(32, 29, 21) + '</g>');

    /* A ballot box: a wooden box seen from above one corner, a band of
       the three colours on its front, and a ballot marked with a cross
       going in at the slot. */
    var BALLOT_BOX = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M30 23.6L33 6h12l-1 17.6z" fill="#ffffff" stroke="#8a8a8a" stroke-width=".8"/>' +
        '<path d="M35.4 17.4h6.4M35.2 19.8h5.6" stroke="#c4c4c4" stroke-width=".8" fill="none"/>' +
        '<path d="M37 9.4l4.4 5M41.4 9.4l-4.4 5" stroke="' + PURPLE + '" stroke-width="1.5" stroke-linecap="round" fill="none"/>' +
        '<path d="M12 26l6-6h40l-6 6z" fill="#a8845e" stroke="#3d2a18" stroke-width="1" stroke-linejoin="round"/>' +
        '<path d="M28 22.6h16l-1.6 1.6H26.4z" fill="#2a1c10" stroke="none"/>' +
        '<path d="M52 26l6-6v26l-6 6z" fill="#6d5238" stroke="#3d2a18" stroke-width="1" stroke-linejoin="round"/>' +
        '<path d="M12 26h40v26H12z" fill="#8a6a4a" stroke="#3d2a18" stroke-width="1"/>' +
        '<g stroke="none"><path d="M12 31h40v1.8H12z" fill="' + PURPLE + '"/><path d="M12 32.8h40v1.8H12z" fill="' + WHITE + '"/>' +
        '<path d="M12 34.6h40v1.8H12z" fill="' + GREEN + '"/></g>' +
        '<path d="M15 41h12M15 45h9M36 47h12" stroke="#6d5238" stroke-width=".8" fill="none"/>');

    // Between them: sprigs of mimosa, a violet, a rosette, a folded ballot.
    function sprig(w, turn) {
        return K.bit(24, 16, w, turn, '<path d="M3 13c5-2 10-5 18-10" stroke="' + STEM + '" stroke-width="1" fill="none"/>' +
            '<path d="M6 12l-1.6-2.4M9 10.6l-1-2.6M8 12.4l2 1.6M13 8.4l-.6-2.4" stroke="' + FERN + '" stroke-width="1.1" stroke-linecap="round"/>' +
            '<g fill="' + MIMOSA + '"><circle cx="20" cy="4" r="2.4"/><circle cx="16.4" cy="5.8" r="2.2"/>' +
            '<circle cx="17.8" cy="2.4" r="1.8"/><circle cx="12.6" cy="8.2" r="2"/></g>');
    }
    function violet(w, turn) {
        return K.bit(20, 20, w, turn, '<path d="' + star(10, 10, 8.6, 5, 0.52) + '" fill="' + PURPLE_MID +
            '" stroke="' + EDGE + '" stroke-width=".6" stroke-linejoin="round"/><circle cx="10" cy="10" r="1.9" fill="' + MIMOSA + '"/>');
    }
    var ROSETTE_BIT = K.bit(20, 26, 13, 0,
        '<path d="M8 15l-4 10 3-1.4 2 2.4 2-10zM12 15l4 10-3-1.4-2 2.4-2-10z" fill="' + GREEN + '" stroke="' + EDGE + '" stroke-width=".5"/>' +
        '<circle cx="10" cy="10" r="8.6" fill="' + PURPLE + '" stroke="' + EDGE + '" stroke-width=".5"/>' +
        '<circle cx="10" cy="10" r="6" fill="' + WHITE + '"/><circle cx="10" cy="10" r="3.6" fill="' + GREEN + '"/>');
    var BALLOT_BIT = K.bit(24, 14, 17, -8, '<path d="M2 3l18-1 2 9-18 2z" fill="#ffffff" stroke="#9a9a9a" stroke-width=".7"/>' +
        '<path d="M12 2.6l.8 9.6" stroke="#cfcfcf" stroke-width=".6"/>' +
        '<path d="M5 5.6l3 3M8 5.6l-3 3" stroke="' + PURPLE + '" stroke-width="1.1" stroke-linecap="round"/>');

    /* The flyer: a small airship in purple banded white and green, a
       gondola under it, trailing a banner of the three colours that
       ripples as it goes (.kr-season-iwd-banner). */
    var AIRSHIP = svg('kr-season-flyer__body', '0 0 150 44',
        '<defs><clipPath id="kr-season-iwd-envelope"><ellipse cx="106" cy="18" rx="38" ry="13"/></clipPath></defs>' +
        '<g class="kr-season-iwd-banner" stroke="#6b6b78" stroke-width=".5">' +
        '<path d="M4 10C18 6 32 14 48 10v5C32 19 18 11 4 15z" fill="' + PURPLE + '"/>' +
        '<path d="M4 15C18 11 32 19 48 15v5C32 24 18 16 4 20z" fill="' + WHITE + '"/>' +
        '<path d="M4 20C18 16 32 24 48 20v5C32 29 18 21 4 25z" fill="' + GREEN + '"/></g>' +
        '<path d="M48 17.5L70 19" stroke="#7a6a5a" stroke-width=".8" fill="none"/>' +
        '<path d="M74 10l-9-7h10l7 9zM74 26l-9 7h10l7-9z" fill="' + PURPLE + '" stroke="' + EDGE + '" stroke-width=".8"/>' +
        '<ellipse cx="106" cy="18" rx="38" ry="13" fill="' + PURPLE_MID + '"/>' +
        '<g clip-path="url(#kr-season-iwd-envelope)"><path d="M60 19.4h100v4.2H60z" fill="' + WHITE + '"/>' +
        '<path d="M60 23.6h100v4.2H60z" fill="' + GREEN + '"/></g>' +
        '<ellipse cx="106" cy="18" rx="38" ry="13" fill="none" stroke="' + EDGE + '" stroke-width="1"/>' +
        '<path d="M86 10c10-4 30-4 40 0" stroke="#ffffff" stroke-opacity=".45" stroke-width="1.6" fill="none" stroke-linecap="round"/>' +
        '<path d="M99 30.6l1 2.4M115 30.6l-1 2.4" stroke="#3d2a18" stroke-width=".7"/>' +
        '<path d="M97 33h20l-2 5h-16z" fill="#8a6a4a" stroke="#3d2a18" stroke-width=".8"/>' +
        '<path d="M95 32.6v6" stroke="#5a5a64" stroke-width="1.2" stroke-linecap="round"/>');

    var VENUS_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g fill="none" stroke-linecap="round">' +
        '<circle cx="16" cy="10.8" r="7.6" stroke="#ffffff" stroke-width="5.2"/><path d="M16 18.4V29M11 24h10" stroke="#ffffff" stroke-width="5.2"/>' +
        '<circle cx="16" cy="10.8" r="7.6" stroke="#7b2fbf" stroke-width="3.2"/><path d="M16 18.4V29M11 24h10" stroke="#7b2fbf" stroke-width="3.2"/>' +
        '</g></svg>';

    // A small Venus symbol to cross the moon, wound as VENUS_24 is.
    var VENUS_MOON = 'M8.4 9.6a3.6 3.6 0 1 0 7.2 0a3.6 3.6 0 1 0-7.2 0z' +
        'M9.6 9.6a2.4 2.4 0 1 1 4.8 0a2.4 2.4 0 1 1-4.8 0z' +
        'M11.4 12.8v6h1.2v-6zM9.8 15.4v1.2h4.4v-1.2z';

    // Confetti, and three fluffy mimosa balls for the margins (each a
    // round of short tufts, all wound the same way so they fill as one).
    var CONFETTI = 'M9.5 3h5v18h-5z';
    var MIMOSA_24 = star(8, 14, 5.6, 14, 0.8) + star(15.4, 8.6, 5.4, 14, 0.8) + star(15.6, 17, 4.6, 14, 0.8);

    // The tip of the sash over a post: a rosette of the three colours.
    var ROSETTE_TIP = '<svg class="kr-season-iwd-rosette" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
        '<circle cx="8" cy="8" r="7.4" fill="' + PURPLE + '" stroke="' + EDGE + '" stroke-width=".6"/>' +
        '<circle cx="8" cy="8" r="5.2" fill="' + WHITE + '"/><circle cx="8" cy="8" r="3.2" fill="' + GREEN + '"/></svg>';

    /* ------------------------------------------------------------------ *
     * Its own: the fist raised, the slip over the footer
     * ------------------------------------------------------------------ */

    /* A click on the corner's badge (it takes clicks, from this file)
       raises the fist inside it and the badge swells a moment. Never
       under reduced motion (the badge takes no clicks then). */
    function raise(kit) {
        if (kit.reduced) return;
        Array.prototype.forEach.call(document.querySelectorAll('.kr-season-corner__art'), function (art) {
            var b = art.querySelector('.kr-season-iwd-badge');
            if (!b) return;
            b.addEventListener('click', function () {
                art.classList.remove('kr-season-iwd-raise');
                void art.getBoundingClientRect();
                art.classList.add('kr-season-iwd-raise');
            });
            art.addEventListener('animationend', function (e) {
                if (e.animationName === 'kr-season-iwd-punch') art.classList.remove('kr-season-iwd-raise');
            });
        });
    }

    // Women whose work science and computing stand on, a line each.
    var WOMEN = [
        ['Her notes on Babbage\'s Analytical Engine hold what is often called the first computer program.', 'Ada Lovelace, 1843'],
        ['Her rose diagrams showed that most soldiers who died in the Crimean War died of disease, not wounds.', 'Florence Nightingale, 1858'],
        ['Reviewing her book on the physical sciences, William Whewell coined the word scientist.', 'Mary Somerville, 1834'],
        ['She built one of the first compilers, so that programs could be written in words, not machine code.', 'Grace Hopper, 1952'],
        ['Inverse document frequency: a rare word says more about a page than a common one. Search engines still weigh words by it.',
            'Karen Spärck Jones, 1972'],
        ['John Glenn asked for her to check the computer\'s orbit figures by hand before he would fly.', 'Katherine Johnson, 1962'],
        ['Her X-ray work, Photo 51 above all, showed that DNA is a helix.', 'Rosalind Franklin, 1952'],
        ['She led the team that wrote the onboard flight software for the Apollo landings.', 'Margaret Hamilton, 1969'],
        ['Her theorem ties every continuous symmetry in physics to a quantity that is conserved.', 'Emmy Noether, 1918'],
        ['The first person to win two Nobel Prizes, and still the only one in two different sciences.', 'Marie Curie, 1911']
    ];

    /* The slip lies across the footer's top edge at its right (from 992px,
       style below), a card with a line and a name, in a shuffled order. A
       click turns it over to the next; under reduced motion the next line
       is simply there. Decoration: aria-hidden, never focused. */
    function slip(kit) {
        var footer = document.querySelector('.kr-footer');
        if (!footer || footer.querySelector('.kr-season-iwd-slip')) return;
        var order = WOMEN.slice();
        for (var i = order.length - 1; i > 0; i--) {
            var j = (Math.random() * (i + 1)) | 0, t = order[i];
            order[i] = order[j];
            order[j] = t;
        }
        var el = document.createElement('div');
        el.className = 'kr-season-iwd-slip';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<span class="kr-season-iwd-slip__line"></span><span class="kr-season-iwd-slip__source"></span>';
        footer.appendChild(el);
        var line = el.firstChild, source = el.lastChild, at = 0;
        function show() {
            line.textContent = order[at][0];
            source.textContent = order[at][1];
        }
        show();
        el.addEventListener('click', function () {
            at = (at + 1) % order.length;
            if (kit.reduced) { show(); return; }
            el.classList.remove('kr-season-iwd-slip--turn');
            void el.offsetWidth;
            el.classList.add('kr-season-iwd-slip--turn');
            setTimeout(show, 260);
        });
        el.addEventListener('animationend', function () { el.classList.remove('kr-season-iwd-slip--turn'); });
    }

    // The pointer: a hat pin with a rosette in the three colours, its point the hotspot.
    var POINTER = '<path d="M16-3.4l.7 2V21h-1.4V-1.4z" fill="#9aa3ad"/>' +
        '<path d="M14 26l-2.6 7.6 2.6-1 1.6 1.8 1-7.6zM18 26l2.6 7.6-2.6-1-1.6 1.8-1-7.6z" fill="#2f8f4e"/>' +
        '<circle cx="16" cy="24" r="6.2" fill="#6b2d8f"/><circle cx="16" cy="24" r="4.2" fill="#ffffff"/>' +
        '<circle cx="16" cy="24" r="2.4" fill="#2f8f4e"/>';

    K.dress({
        // The ribbon's card (season.js, ribbon).
        about: { short: 'Women\'s Day', when: '8 March',
            text: 'Clara Zetkin and others proposed a day for working women in 1910, and 8 March stuck after women textile ' +
                'workers in Petrograd marched on that day in 1917. The United Nations has kept it since 1975. Purple, white and ' +
                'green were the suffragettes\' colours, and in Italy women are given mimosa.',
            link: 'https://en.wikipedia.org/wiki/International_Women%27s_Day' },
        corner: sashArt, dangler: VENUS_HANGING,
        // Confetti in the three colours, now and then a Venus symbol, tumbling down.
        leaves: { kind: 'fall', colours: [PURPLE_MID, LILAC, GREEN, GREEN_LIGHT, WHITE], per1000: 16,
            shapes: [CONFETTI, VENUS_24], tumble: true, size: [9, 17] },
        // Venus symbols, raised fists and mimosa in the margins.
        backdrop: { shapes: [VENUS_24, VENUS_FIST_24, MIMOSA_24],
            colours: [[PURPLE_MID, LILAC], [PURPLE, GREEN], [MIMOSA, MIMOSA_DARK]] },
        // Mimosa, the badge, the ballot box. No sounds yet.
        patch: [{ art: MIMOSA_JAR, size: 'big' },
                { art: ENAMEL, size: 'small' },
                { art: BALLOT_BOX, size: 'mid' }],
        strew: [sprig(22, -8), violet(11, 10), ROSETTE_BIT, BALLOT_BIT, sprig(16, 20)],
        puff: 'kr-season-puff--scatter kr-season-puff--sash',
        flyer: AIRSHIP, flight: 'kr-season-flyer--airship',
        favicon: VENUS_ICON, moonmark: VENUS_MOON,
        cursor: K.pointer(POINTER, 2, 2, -45),
        // A sash of the three colours across a post's top, a rosette at its end.
        track: { kind: 'sash', mode: 'fill', tip: ROSETTE_TIP },
        fog: false,
        map: null,
        lost: {
            title: 'This Page Was Left Out of the History Books',
            lede: 'Whatever lived at this address did the work, and nobody wrote down where it went. ' +
                'It happens more often than it should.',
            caption: 'While I look for it, have a random photograph. '
        },
        extra: function (kit) {
            raise(kit);
            slip(kit);
        }
    });
})();
