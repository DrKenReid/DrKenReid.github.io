/**
 * seasons/st-andrews.js: St Andrew's Day's art for js/season.js (see that
 * file for the pieces), for 30 November in saltire blue and white: a
 * string of saltire bunting with a fish on a line (Andrew was a
 * fisherman), saltire confetti in the air, a Highland coo, a puffin and a
 * set of pipes among small flags and pebbles, a gannet that glides over
 * and dives, a saltire favicon, a saltire across the moon, bunting along
 * a post's top whose flags fly out as the reader passes them, a haar off
 * the sea in both themes, saltires on the Scottish places, a 404 page
 * lost in the haar, a blue pointer with a saltire. Its own: the legend
 * of the day, a white saltire of
 * cloud that drifts together in the sky over the homepage hero and the
 * page openers, holds, and drifts apart.
 *
 * Classes only this file applies (css/seasons/st-andrews.css):
 * .kr-season-pumpkin, .kr-season-dangler__body, .kr-season-dangler__line,
 * .kr-season-flyer__body, .kr-season-flyer__wing (--up, --down),
 * .kr-season-badge__body, .kr-season-cloudcross (__band, __band--a, __band--b).
 */
(function () {
    'use strict';
    var K = window.krSeasonKit;
    if (!K) return;
    var svg = K.svg, bar = K.bar;

    var BLUE = '#0065bd', WHITE = '#ffffff', EDGE = '#9fb4c6';

    /* A saltire flag w wide, its top left at (x, y), turned about that
       corner: the blue field and the white cross corner to corner. */
    function flag(x, y, w, turn) {
        var h = w * 0.6, s = (w * 0.17).toFixed(2);
        return '<g transform="translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + turn.toFixed(1) + ')">' +
            '<rect width="' + w + '" height="' + h.toFixed(1) + '" fill="' + BLUE + '"/>' +
            '<path d="M0 0L' + w + ' ' + h.toFixed(1) + 'M' + w + ' 0L0 ' + h.toFixed(1) + '" stroke="' + WHITE +
            '" stroke-width="' + s + '"/></g>';
    }

    /* A string of bunting from the corner, sagging, with a saltire flag
       hung from it every so far along. */
    function buntingArt() {
        var p0 = [64, 3], p1 = [34, 28], p2 = [0, 22];
        function at(t) {
            var u = 1 - t;
            return [u * u * p0[0] + 2 * t * u * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * t * u * p1[1] + t * t * p2[1]];
        }
        function slope(t) {
            var dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
            var dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
            return Math.atan2(-dy, -dx) * 180 / Math.PI;
        }
        var flags = [0.14, 0.38, 0.62, 0.86].map(function (t) {
            var p = at(t);
            return flag(p[0] - 5, p[1], 11, slope(t) * 0.6);
        }).join('');
        return '<path d="M' + p0.join(' ') + 'Q' + p1.join(' ') + ' ' + p2.join(' ') + '" fill="none" stroke-width="1.2"/>' + flags;
    }

    // A wee fish caught on the line, hook in its mouth, tail down.
    var FISH = svg('kr-season-dangler__body', '0 0 20 20',
        '<path class="kr-season-dangler__line" d="M10 0v2.6c0 1.2 1.6 1.4 1.8.2" style="stroke-width: .9"/>' +
        '<path d="M10 3.6c2.6 1 4 3.6 4 6.8 0 2.6-1.2 4.6-2.8 5.6l2.6 3.6H6.2L8.8 16C7.2 15 6 13 6 10.4c0-3.2 1.4-5.8 4-6.8z"/>' +
        '<path d="M7.4 9.4c1.6.8 3.6.8 5.2 0M7.6 12c1.6.7 3.2.7 4.8 0" fill="none" stroke="#ffffff" stroke-opacity=".45" stroke-width=".7"/>' +
        '<circle cx="11.1" cy="6.4" r="1" fill="#ffffff"/><circle cx="11.3" cy="6.4" r=".5" fill="#10202c"/>');

    // Saltires and square scraps of blue and white, thrown up for the day.
    var SALTIRE = bar(5, 5, 19.8, 45, 4.4) + bar(19, 5, 19.8, 135, 4.4);
    var SCRAP = 'M7 7h10v10H7z';
    var CONFETTI = ['#ffffff', '#e6f0fb', '#5ea4ea', '#0065bd'];

    /* A Highland coo's head on the pumpkins' 64 x 56 box: long horns, a
       shaggy ginger fringe over its eyes, a broad soft nose. */
    var COO = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M21 17C11 17 4 11 2 3c4 5 11 7 19 7zM43 17c10 0 17-6 19-14-4 5-11 7-19 7z" fill="#ece0c2" stroke="#b9a87e" stroke-width=".8"/>' +
        '<path d="M2 3c1 1.6 2.4 3 4 4l-2.4.6zM62 3c-1 1.6-2.4 3-4 4l2.4.6z" fill="#4a3d2c"/>' +
        '<ellipse cx="13" cy="23" rx="7" ry="3.6" transform="rotate(18 13 23)" fill="#a8551f"/>' +
        '<ellipse cx="51" cy="23" rx="7" ry="3.6" transform="rotate(-18 51 23)" fill="#a8551f"/>' +
        '<path d="M20 13c5-3 19-3 24 0 3 7 3 15 1 23-1 6-4 11-13 12-9-1-12-6-13-12-2-8-2-16 1-23z" fill="#c06a2c"/>' +
        '<path d="M18 13c3-4 9-6 14-6s11 2 14 6c1 5-1 10-3 13 0-3-1-5-2-6-1 3-2 6-4 7 0-3-1-5-2-6-1 3-3 5-5 6 0-2-1-4-2-5-2 2-3 4-5 5 0-3 0-5-1-7-2 1-3 3-4 5-1-4-1-8 0-12z" fill="#9c4f1c"/>' +
        '<path d="M24 12c-1 4 0 8 1 11M31 11c0 4 0 8-1 11M38 12c0 4-1 7-2 10" fill="none" stroke="#7d3c14" stroke-width=".9" stroke-linecap="round"/>' +
        '<ellipse cx="32" cy="43" rx="10.5" ry="7" fill="#d9a07a"/>' +
        '<ellipse cx="28" cy="43" rx="1.8" ry="2.6" fill="#5a3422"/><ellipse cx="36" cy="43" rx="1.8" ry="2.6" fill="#5a3422"/>');

    /* A puffin standing, facing right: black back and cap, white face and
       front, the striped beak, orange feet. */
    var PUFFIN = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M22 51c-4-6-5-15-2-23 2-6 5-13 10-16 5-4 12-3 15 2 2 4 2 8 0 11 3 6 4 14 2 20-2 5-6 7-12 7-5 0-10-0-13-1z" fill="#1d1f24"/>' +
        '<path d="M34 24c5 4 9 12 8 20-1 5-4 8-8 8-3 0-5-3-5-8 0-8 1-15 5-20z" fill="#f6f5f0"/>' +
        '<path d="M33 10c4-1.4 9 .6 10 5 .8 3-.4 6-2.6 7-3 1.2-6.4 0-7.4-3-.8-3-.8-6 0-9z" fill="#ecebe5"/>' +
        '<path d="M42.6 11.6l10.4 3.6-10.4 5.6c-1-3.4-1-6.6 0-9.2z" fill="#e8642a"/>' +
        '<path d="M42.6 11.6l2.4.8v7l-2.4 1.4c-1-3.4-1-6.6 0-9.2z" fill="#f2c14e"/>' +
        '<path d="M47 13.2v4.6" stroke="#f2c14e" stroke-width=".9"/>' +
        '<circle cx="38" cy="13.6" r="1.2" fill="#1d1f24"/>' +
        '<path d="M24 50l-3.6 4.4h8.2zM33 50l-1.4 4.4h8.2z" fill="#f0782f"/>');

    /* A set of pipes: the bag in a blue tartan, three drones up to the
       right with their ivory mounts and a cord, the blowpipe and chanter. */
    var PIPES = svg('kr-season-pumpkin', '0 0 64 56',
        '<path d="M38 24L14 7" stroke="#2b221b" stroke-width="2.2" stroke-linecap="round"/>' +
        '<path d="M30 22L44 3M34 24L54 7M37 27L61 14" stroke="#2b221b" stroke-width="2.6" stroke-linecap="round"/>' +
        '<path d="M37.6 12.6l-1.8-1.4M41.2 7.6l-1.8-1.4M44.4 17l-1.6-1.6M49.4 12l-1.6-1.6M49 21.6l-1.2-1.8M55.4 18l-1.2-1.8"' +
        ' stroke="#efe6cf" stroke-width="2.4"/>' +
        '<path d="M44 3c3 5 7 6 10 4M54 7c2 4 5 6 7 7" fill="none" stroke="#c8a24a" stroke-width="1" stroke-linecap="round"/>' +
        '<path d="M15 38c-1-10 6-16 14-16 9 0 15 6 15 14 0 7-6 12-14 12-8 0-14-3-15-10z" fill="#1f3f6a"/>' +
        '<path d="M15.4 32h28.6M14.6 40h29M22 23v24.6M30 22v26M38 24v21" stroke="#2f7a5a" stroke-width="2" opacity=".85"/>' +
        '<path d="M15 36h29M26 22v26M34 23v24" stroke="#e7c75a" stroke-width=".6"/>' +
        '<path d="M19 45L11 55" stroke="#2b221b" stroke-width="2.8" stroke-linecap="round"/>' +
        '<path d="M10 54.4l2.6-3.2" stroke="#efe6cf" stroke-width="3.4"/>');

    // A pebble, and a small saltire on a stick, for between them.
    function pebble(w, colour) {
        return K.bit(24, 12, w, 0, '<path d="M2 11c-1-4 3-8 10-8s11 3 10 8z" fill="' + colour + '"/>');
    }
    function stickFlag(h, turn) {
        return K.bit(24, 24, h, turn,
            '<path d="M7 24V2" stroke="#6b5a45" stroke-width="1.4"/>' + flag(7.6, 2, 13, 0));
    }

    /* A gannet seen from the side as it glides over, wings spread up and
       down: white, black tips, a buff head, the long pale bill. */
    var GANNET = svg('kr-season-flyer__body', '0 0 72 48',
        '<path class="kr-season-flyer__wing kr-season-flyer__wing--up" d="M45 22C43 14 38 6 29 1c-1.4 7-.6 15 4 21z" fill="#f7f7f4" stroke="#8a96a0" stroke-width=".7"/>' +
        '<path d="M29 1c-.8 3-.6 6 .4 8.6l3.4-.8C32 6 31 3.4 29 1z" fill="#1d1f24"/>' +
        '<path d="M4 24l11-3.4v6.8z" fill="#f7f7f4" stroke="#8a96a0" stroke-width=".7"/>' +
        '<path d="M13 24c6-3.6 28-4.8 42-3.4 5 .6 9 1.8 11 3-2 1.4-6 2.4-11 2.8-14 1.2-36 .6-42-2.4z" fill="#f7f7f4" stroke="#8a96a0" stroke-width=".7"/>' +
        '<path d="M56 20.8c4 .4 8 1.6 10 2.8-2 1.4-6 2.4-10 2.6z" fill="#ecd28c"/>' +
        '<path d="M65.4 23l6.4.9-6.4 1.3z" fill="#a9b4bb"/>' +
        '<circle cx="62" cy="22.8" r=".8" fill="#1d1f24"/>' +
        '<path class="kr-season-flyer__wing kr-season-flyer__wing--down" d="M45 26C43 34 38 42 29 47c-1.4-7-.6-15 4-21z" fill="#f7f7f4" stroke="#8a96a0" stroke-width=".7"/>' +
        '<path d="M29 47c-.8-3-.6-6 .4-8.6l3.4.8C32 42 31 44.6 29 47z" fill="#1d1f24"/>');

    var SALTIRE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
        '<defs><clipPath id="f"><rect y="4.8" width="24" height="14.4" rx="1.6"/></clipPath></defs>' +
        '<g clip-path="url(#f)"><rect y="4.8" width="24" height="14.4" fill="' + BLUE + '"/>' +
        '<path d="M0 4.8L24 19.2M24 4.8L0 19.2" stroke="' + WHITE + '" stroke-width="3.2"/></g></svg>';

    // The legend's saltire, across the moon.
    var MOON_SALTIRE = bar(7.4, 7.4, 13, 45, 2.2) + bar(16.6, 7.4, 13, 135, 2.2);

    // A saltire flag on a short staff over a Scottish place.
    var MAP_FLAG = svg('kr-season-badge__body', '0 0 24 24',
        '<path d="M4 23V2" stroke="#4a3d2c" stroke-width="1.6" stroke-linecap="round"/>' +
        '<rect x="4.6" y="2.4" width="18" height="11" rx=".8" fill="' + BLUE + '" stroke="' + WHITE + '" stroke-width=".8"/>' +
        '<path d="M5 2.8L22.2 13M22.2 2.8L5 13" stroke="' + WHITE + '" stroke-width="2.2"/>');

    // A saltire flag of bunting for a post's top, hung by its top edge.
    var BUNTING = svg('', '0 0 12 9', '<rect width="12" height="9" fill="' + BLUE + '"/>' +
        '<path d="M0 0L12 9M12 0L0 9" stroke="' + WHITE + '" stroke-width="1.8"/>' +
        '<rect width="12" height="9" fill="none" stroke="' + EDGE + '" stroke-width=".6"/>');

    /* The legend: before a battle a white saltire showed in a blue sky.
       Two long banks of cloud drift in from either side over the homepage
       hero and each page opener, cross into a saltire, hold, and drift
       apart, once a page. Under the type; never under reduced motion. */
    function skySaltire(kit) {
        if (kit.reduced) return;
        var hosts = Array.prototype.slice.call(document.querySelectorAll('.welcome-area, .breadcrumb-area, .kr-opener'));
        hosts.forEach(function (host) {
            if (host.querySelector('.kr-season-cloudcross')) return;
            var el = document.createElement('div');
            el.className = 'kr-season-cloudcross';
            el.setAttribute('aria-hidden', 'true');
            el.innerHTML = '<span class="kr-season-cloudcross__band kr-season-cloudcross__band--a"></span>' +
                '<span class="kr-season-cloudcross__band kr-season-cloudcross__band--b"></span>';
            // The cross runs corner to corner of the banner, as long as its diagonal.
            var r = host.getBoundingClientRect();
            if (r.width && r.height) {
                el.style.setProperty('--kr-season-cloudcross-turn',
                    Math.min(64, Math.max(14, Math.atan2(r.height, r.width) * 180 / Math.PI)).toFixed(1) + 'deg');
                el.style.setProperty('--kr-season-cloudcross-len', Math.round(Math.sqrt(r.width * r.width + r.height * r.height)) + 'px');
            }
            host.insertBefore(el, host.querySelector(':scope > .container, :scope > .welcome-slides, :scope > .kr-opener__inner') ||
                host.firstChild);
            el.lastChild.addEventListener('animationend', function () { el.remove(); });
        });
    }

    K.dress({
        // The ribbon's card (season.js, ribbon).
        about: { short: 'St Andrew\'s', when: '30 November',
            text: 'Scotland\'s patron saint. The story goes that before a battle in the ninth century, King Óengus II saw a white saltire against a blue sky, and that\'s where the flag comes from. It\'s been an official holiday in Scotland since 2007.',
            link: 'https://en.wikipedia.org/wiki/Saint_Andrew%27s_Day' },
        corner: buntingArt, dangler: FISH,
        leaves: { kind: 'fall', colours: CONFETTI, per1000: 18, shapes: [SALTIRE, SCRAP], tumble: false, size: [10, 18] },
        // The puffin's shore has oystercatchers on it, the pipes play; the
        // coo keeps its peace (no freely licensed lowing to be had).
        patch: [{ art: COO, size: 'big', sound: '' },
                { art: PUFFIN, size: 'small', sound: 'shore' },
                { art: PIPES, size: 'mid', sound: 'pipes' }],
        strew: [pebble(14, '#9aa3a8'), stickFlag(22, -6), pebble(11, '#b8b0a2'), stickFlag(18, 8), pebble(9, '#7d8a90')],
        puff: 'kr-season-puff--scatter kr-season-puff--saltire',
        flyer: GANNET, flight: 'kr-season-flyer--gannet',
        favicon: SALTIRE_ICON, moonmark: MOON_SALTIRE,
        // A flag every 34px of string, flown out once the reader has passed.
        track: { kind: 'bunting', mode: 'bits', every: 34, bit: function () { return BUNTING; } },
        map: { places: ['Scotland', 'Fife'], badge: MAP_FLAG },
        lost: {
            title: 'This Page Is Lost in the Haar',
            lede: 'A sea fog has rolled in off the North Sea, and whatever stood at this address is somewhere inside it.',
            caption: 'While it clears, have one of my photographs of Scotland. '
        },
        extra: skySaltire,
        // A saltire-blue pointer with a small saltire flag at its tail.
        cursor: K.cursor('#5ea4ea', '<rect x=".4" y="2.4" width="11.2" height="7.2" fill="' + BLUE + '" stroke="#0b2540" stroke-width=".8"/>' +
            '<path d="M.8 2.8L11.2 9.2M11.2 2.8L.8 9.2" stroke="' + WHITE + '" stroke-width="1.5"/>', '#0b2540')
    });
})();
