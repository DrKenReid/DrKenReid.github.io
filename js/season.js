/**
 * season.js: the engine that dresses the site for a season (KR_SEASONS in
 * shared-components.js), fetched by that file only while one is on (with
 * the seasons turned off, never), with the season's own art after it
 * (js/seasons/<key>.js), so a reader only ever fetches one season's
 * pictures. The colours are the season's own stylesheet's
 * (css/seasons/<key>.css, keyed on html[data-season]), the shared rules
 * css/season.css's; this adds the things.
 *
 * A season's file calls krSeasonKit.dress(dress) once. Every season
 * dresses the same pieces, each with its own art, and may add a feature
 * of its own (dress.extra):
 *   corner    something in the corner (a 64 x 64 drawing, stroked in
 *             --kr-season-line) with `dangler` (a 20 x 20 drawing) hanging
 *             below it on a thread, in the header bar's corner or the
 *             opener's
 *   leaves    things in the air over the page openers and the homepage
 *             hero, drawn on a canvas: { kind, colours, per1000, shapes,
 *             tumble, glow, size, rate }. kind is 'fall' (leaves, snow),
 *             'rise' (embers, lanterns), 'twinkle' (stars, fireflies:
 *             drifting and pulsing) or 'fireworks' (rockets that burst,
 *             `rate` bursts a second per 1000px of width); shapes are
 *             paths on a 24 x 24 box, the first drawn 70% of the time
 *   patch     three things sitting on the footer ({ art, size: big, mid
 *             or small, sound }), with `strew` (five bits of markup,
 *             each usually kit.bit) between them; a click flares one,
 *             bursts `puff` from it (its classes: 'kr-season-puff--scatter
 *             kr-season-puff--<kind>' tosses three bits out, sized and
 *             coloured by the season's sheet) and, with sounds on, plays
 *             sounds/<sound>.mp3
 *   flyer     a drawing that crosses the screen once, as the footer comes
 *             into view, flying the way `flight` (a class) says
 *   favicon   the tab's icon (a whole svg); moonmark, a path that crosses
 *             the theme button's full moon while it is hovered
 *   track     what stands in for a post's reading bar: { kind, mode, tip,
 *             every, bit }. mode 'burn' shrinks from the left as the
 *             reader goes (a candle, a fuse), 'fill' grows from the left
 *             (a beam, a ribbon), both with `tip` at the reader; 'bits'
 *             hangs bit(i) every `every` px and marks those the reader has
 *             passed (leaves fall, icicles grow)
 *   fog       false for none; otherwise style.css's tokens say in which
 *             themes it shows along the foot of the homepage hero and the
 *             gallery's opener
 *   map       the photo map: rims, the tiles dusked, and `badge` on each
 *             place the season owns, by photo tag ({ tag, min, share }: at
 *             least min of its frames and share of all it has) or by name
 *             ({ places: [words in the region's name] })
 *   lost      the 404 page's title, lede and caption
 *   cursor    the pointer, where the reader has a mouse: a whole svg of
 *             at most 32 x 32 with its hotspot ({ svg, x, y }), usually
 *             kit.cursor(fill, emblem); links keep the hand
 *   backdrop  behind a page's content (a post's article), the season's
 *             shapes drifting in the margins beside it, at three depths, sliding at
 *             their own pace as the page scrolls; by default the shapes
 *             and colours of the things in the air (dots left out), or
 *             { shapes, colours } of its own (colours may be one list per
 *             shape); false for none
 *   about     a holiday's card ({ short, when, text, link }): a ribbon
 *             across the bottom left corner of the screen, labelled short,
 *             that opens a card about the day on hover, keyboard focus or
 *             a tap. The four seasons have none.
 *   extra     function (kit), run after the rest: the season's own toys;
 *             kit.walker(art, kind) sends something along the footer's edge,
 *             kit.onFooter(fn) runs fn once the footer comes into view
 * The palette's random frame (krSeasonTreats) comes from krPhotoPool.
 *
 * Toys: a click sends the dangling thing down its thread and back, and
 * bursts something from a patch piece, which with sounds on also plays a
 * recording (credited on the colophon). Sounds are off until the reader
 * turns them on, from a holiday ribbon's card or the address:
 * ?season-sounds=on (the palette's "Turn on ... sounds") stores it on this
 * device, ?season-sounds=off clears it (?spooky-sounds= was its first
 * name); either is taken out of the address. A recording is fetched only
 * when it first plays.
 *
 * Every piece but a holiday's ribbon is aria-hidden decoration that sits
 * over no post text, gallery tile, lightbox or slideshow, and is left out
 * of print (§23).
 * Only the dangling thing and the patch take clicks, and nothing takes
 * focus. Under reduced motion nothing moves: the leaves lie where they
 * fell (or hang still), no flyer crosses, a clicked piece only makes its
 * sound and the dangling thing stays put; an extra keeps the same rule
 * (kit.reduced). The canvases draw only while on screen and the tab is
 * visible.
 *
 * Classes only this file applies (css/season.css):
 * .kr-season-corner (--bar, --opener, __art), .kr-season-dangler (--drop,
 * __body), .kr-season-leaves, .kr-season-patch (__big, __mid, __small),
 * .kr-season-leaf, .kr-season-lit, .kr-season-puff, .kr-season-flyer,
 * .kr-season-moonmark, .kr-season-track (--burn, --fill, --bits, --out,
 * --<kind>, __rest, __tip, __bit, __bit--passed), .kr-season-tracked,
 * .kr-season-fog (__layer, __layer--far), .kr-season-map, .kr-season-badge,
 * .kr-season-walker (--<kind>, --gone, __tail), .kr-season-backdrop (__item,
 * __art) and .kr-season-backdrop-host, .kr-season-ribbon (__sash),
 * .kr-season-about (__title, __when, __text, __more), and
 * .kr-season-cursor on <html> (with --kr-season-cursor) for the pointer.
 * The seasons' files apply the rest (each names its own).
 */
(function () {
    'use strict';

    var season = typeof krSeason === 'function' ? krSeason() : null;
    if (!season) return;

    var reduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Autumn: rust, pumpkin, amber, ochre, oxblood, gold.
    var LEAF_COLOURS = ['#c4512a', '#e07a2e', '#e8a33d', '#b7782a', '#8c3b1f', '#d9b44a'];

    // A maple leaf on a 24 x 24 box, point up, its stem to (12, 23).
    var MAPLE = 'M12 1.5l1.7 4.4 3.3-1.7-.9 4.3 4.3-.6-2.5 3.3 3.6 1.7-4.5 1.1 1 3-3.7-1.4-1.6 1.9' +
        '-.2-2.2-.5 0-.2 2.2-1.6-1.9-3.7 1.4 1-3-4.5-1.1 3.6-1.7-2.5-3.3 4.3.6-.9-4.3 3.3 1.7z';
    // An oak-ish oval leaf on the same box.
    var OVAL = 'M12 2c4.5 3 6 7.5 5 12-.6 2.8-2.6 5.3-5 6.5-2.4-1.2-4.4-3.7-5-6.5C6 9.5 7.5 5 12 2z';
    // A round dot on the same box (snow, a spark, a star far off).
    var DOT = 'M8.5 12a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0z';

    /* A thin bar from (x0, y0), len long at deg, wide across, as a closed
       path: the stroke of a drawing that must be filled (a canvas shape). */
    function bar(x0, y0, len, deg, wide) {
        var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
        var nx = -s * wide / 2, ny = c * wide / 2;
        var x1 = x0 + c * len, y1 = y0 + s * len;
        return 'M' + [x0 + nx, y0 + ny].map(fix).join(' ') + 'L' +
            [x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny].map(fix).join(' ') + 'z';
    }
    function fix(v) { return v.toFixed(2); }

    // A twig reaching in from the corner of the 64 x 64 corner box, with
    // two side shoots: the fall, winter, spring and summer hang theirs on it.
    var TWIG = 'M64 2C52 6 41 10 31 17S13 31 6 41M45 9c-2 6-2 11 1 16M26 21c-6-1-11 1-15 4';

    /* A six-armed snowflake of radius r about (cx, cy), as one filled
       path: each arm a thin bar with a pair of short side bars. */
    function flake(cx, cy, r) {
        var d = '';
        for (var i = 0; i < 6; i++) {
            var deg = i * 60 - 90;
            d += bar(cx, cy, r, deg, r * 0.16);
            var a = deg * Math.PI / 180;
            var bx = cx + Math.cos(a) * r * 0.55, by = cy + Math.sin(a) * r * 0.55;
            d += bar(bx, by, r * 0.36, deg - 45, r * 0.12) + bar(bx, by, r * 0.36, deg + 45, r * 0.12);
        }
        return d;
    }

    /* A star of `points` points, outer radius r and inner r * pinch, about
       (cx, cy), one point straight up. */
    function star(cx, cy, r, points, pinch) {
        var d = '';
        for (var i = 0; i < points * 2; i++) {
            var a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
            var rr = i % 2 ? r * (pinch || 0.45) : r;
            d += (i ? 'L' : 'M') + fix(cx + Math.cos(a) * rr) + ' ' + fix(cy + Math.sin(a) * rr);
        }
        return d + 'z';
    }

    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    function svg(className, viewBox, body) {
        return '<svg class="' + className + '" viewBox="' + viewBox + '" aria-hidden="true" focusable="false">' +
            body + '</svg>';
    }

    /* A pumpkin on a 64 x 56 box, in its lobes', middle's and ribs'
       colours. A jack-o'-lantern's cut-outs carry .kr-season-glow, which
       flickers; face null is a plain pumpkin. */
    var ORANGE = ['#c9581a', '#e5761f', '#b44f15'];
    function pumpkin(face, colours) {
        var c = colours || ORANGE;
        var faces = [
            // triangle eyes, a toothy grin
            '<path class="kr-season-glow" d="M17 28l5-8 5 8zM37 28l5-8 5 8zM30 33l2-4 2 4z' +
            'M16 37c5 10 27 10 32 0l-4 1-2 4-3-3-3 3-3-3-3 3-3-3-3 3-2-4z"/>',
            // round eyes, an O of a mouth
            '<path class="kr-season-glow" d="M19 26a4 4 0 1 0 8 0a4 4 0 1 0-8 0zM37 26a4 4 0 1 0 8 0a4 4 0 1 0-8 0z' +
            'M27 41a5 6 0 1 0 10 0a5 6 0 1 0-10 0z"/>',
            // slanted eyes, a crooked smile
            '<path class="kr-season-glow" d="M17 22l10 4-8 4zM47 22l-10 4 8 4z' +
            'M18 39c6 6 22 6 28-2l-5 1-2 3-3-2-4 3-3-3-4 2-2-3z"/>'
        ];
        return svg('kr-season-pumpkin', '0 0 64 56',
            '<path d="M31 11c-.5-4 1-8 5-10l2.5 2.5c-3 1.5-4 4-4 7.5z" fill="#5b6b2c"/>' +
            '<ellipse cx="20" cy="33" rx="15" ry="19" fill="' + c[0] + '"/>' +
            '<ellipse cx="44" cy="33" rx="15" ry="19" fill="' + c[0] + '"/>' +
            '<ellipse cx="32" cy="32" rx="15" ry="21" fill="' + c[1] + '"/>' +
            '<path d="M26 13c-4 6-4 33 0 39M38 13c4 6 4 33 0 39" fill="none" stroke="' + c[2] + '" stroke-width="1.4"/>' +
            (face === null ? '' : faces[face % faces.length]));
    }

    // A small drawing of `path` (24 x 24) for between the patch's pieces.
    function leaf(path, colour, size, turn) {
        return bit(24, 24, size, turn, '<path d="' + path + '" fill="' + colour + '"/>' +
            '<path d="M12 14v9" stroke="' + colour + '" stroke-width="1.2"/>');
    }

    /* One bit for the strew (or anywhere a small drawing lies on the
       page): an svg of viewBox 0 0 vw vh, w px wide and as tall as that
       makes it, turned `turn` degrees. */
    function bit(vw, vh, w, turn, body) {
        return '<svg class="kr-season-leaf" viewBox="0 0 ' + vw + ' ' + vh + '" width="' + w + '" height="' + fix(w * vh / vw) + '"' +
            (turn ? ' style="transform: rotate(' + turn + 'deg)"' : '') + ' aria-hidden="true" focusable="false">' + body + '</svg>';
    }

    // A leaf placed inside a larger drawing: centred on (x, y), turned, scaled.
    function leafAt(path, colour, x, y, turn, scale) {
        return '<g transform="translate(' + x + ' ' + y + ') rotate(' + turn + ') scale(' + scale + ') translate(-12 -12)">' +
            '<path d="' + path + '" fill="' + colour + '"/></g>';
    }

    // Five leaves to lie between the pumpkins on the footer.
    function strewnLeaves(c) {
        return [leaf(MAPLE, c[0], 18, -30), leaf(OVAL, c[2], 16, 70), leaf(MAPLE, c[4], 14, 20),
            leaf(MAPLE, c[3], 17, -60), leaf(OVAL, c[1], 13, 110)];
    }

    var dress = null;

    /* ------------------------------------------------------------------ *
     * The corner, with its thing dangling below
     * ------------------------------------------------------------------ */

    /* Two of them: one in the header bar's corner, shown where the screen
       is wide enough to leave the bar's controls clear of it, and one in
       the top corner of the page's opener, under the bar, shown where it
       is not (style.css picks). */
    function corners() {
        var header = document.querySelector('.header-area');
        if (header && !header.querySelector('.kr-season-corner')) {
            header.appendChild(corner('kr-season-corner kr-season-corner--bar'));
        }
        var opener = document.querySelector('.breadcrumb-area, .kr-opener, .welcome-area');
        if (opener && !opener.querySelector('.kr-season-corner')) {
            opener.appendChild(corner('kr-season-corner kr-season-corner--opener'));
        }
    }

    function corner(className) {
        var el = document.createElement('div');
        el.className = className;
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = svg('kr-season-corner__art', '0 0 64 64', dress.corner()) +
            '<span class="kr-season-dangler">' + dress.dangler + '</span>';
        return el;
    }

    /* ------------------------------------------------------------------ *
     * Things in the air over the openers
     * ------------------------------------------------------------------ */

    /* The things in the air: dress.leaves, or, for a season that wants a
       different sky in each theme, dress.leaves.light and .dark (summer:
       seeds by day, fireflies by night), swapped when the theme changes. */
    function airCfg() {
        var l = dress.leaves;
        if (!l.light) return l;
        return document.documentElement.getAttribute('data-theme') === 'dark' ? l.dark : l.light;
    }

    var paths = null, pathsOf = null, pathsGen = 0;

    function leafPaths() {
        var cfg = airCfg();
        if (pathsOf !== cfg && window.Path2D) {
            paths = cfg.shapes.map(function (d) { return new Path2D(d); });
            pathsOf = cfg;
            pathsGen++;
        }
        return paths;
    }

    /* A glowing shape is drawn once into a sprite of its own, glow and
       all, and stamped from there: a canvas blur on every particle in
       every frame is the costliest thing on the page. */
    var SPRITE = 48, SPRITE_PAD = 12;
    var sprites = {};

    function sprite(shape, colour, blur) {
        var key = (shape < 0 ? 'dot' : pathsGen + '.' + shape) + ' ' + colour + ' ' + blur;
        if (sprites[key]) return sprites[key];
        var c = document.createElement('canvas');
        c.width = c.height = SPRITE + SPRITE_PAD * 2;
        var g = c.getContext('2d');
        g.translate(SPRITE_PAD, SPRITE_PAD);
        g.shadowColor = colour;
        g.shadowBlur = blur;
        g.fillStyle = colour;
        if (shape < 0) {
            g.beginPath();
            g.arc(SPRITE / 2, SPRITE / 2, SPRITE / 4, 0, Math.PI * 2);
            g.fill();
        } else {
            g.scale(SPRITE / 24, SPRITE / 24);
            g.fill(leafPaths()[shape]);
        }
        return (sprites[key] = c);
    }

    function makeLeaf(w, h, anywhere) {
        var cfg = airCfg(), colours = cfg.colours, size = cfg.size || [16, 32];
        var rise = cfg.kind === 'rise', twinkle = cfg.kind === 'twinkle';
        var start = rise ? h + 30 + Math.random() * h * 0.5 : -30 - Math.random() * h * 0.5;
        var n = leafPaths().length;
        return {
            x: Math.random() * w,
            y: anywhere || twinkle ? Math.random() * h : start,
            size: size[0] + Math.random() * (size[1] - size[0]),
            fall: twinkle ? (Math.random() - 0.5) * 6 : (rise ? -1 : 1) * (18 + Math.random() * 26),  // px a second
            drift: twinkle ? (Math.random() - 0.5) * 8 : -6 + Math.random() * 18,  // a breeze, mostly rightward
            swayAmp: twinkle ? 4 + Math.random() * 8 : 14 + Math.random() * 22,
            swaySpeed: 0.6 + Math.random() * 1.1,
            phase: Math.random() * Math.PI * 2,
            spin: cfg.tumble ? (Math.random() - 0.5) * 1.6 : 0,
            turn: cfg.tumble ? Math.random() * Math.PI * 2 : 0,
            flutter: 1.5 + Math.random() * 2.5,
            pulse: 0.7 + Math.random() * 1.6,
            colour: colours[(Math.random() * colours.length) | 0],
            shape: Math.random() < 0.7 || n < 2 ? 0 : 1 + ((Math.random() * (n - 1)) | 0)
        };
    }

    function drawLeaf(ctx, l, t) {
        var shapes = leafPaths(), cfg = airCfg();
        if (!shapes) return;
        var x = l.x + Math.sin(t * l.swaySpeed + l.phase) * l.swayAmp;
        ctx.save();
        ctx.translate(x, l.y);
        ctx.rotate(l.turn + t * l.spin);
        // Turning over in the air: squash one axis with a cosine.
        if (cfg.tumble) ctx.scale(Math.max(0.15, Math.abs(Math.cos(t * l.flutter + l.phase))), 1);
        ctx.globalAlpha = cfg.kind === 'twinkle' ? 0.25 + 0.7 * (0.5 + 0.5 * Math.sin(t * l.pulse + l.phase)) : 0.92;
        if (cfg.glow) {
            var k = l.size / SPRITE;
            ctx.drawImage(sprite(l.shape, l.colour, 24), -(SPRITE / 2 + SPRITE_PAD) * k, -(SPRITE / 2 + SPRITE_PAD) * k,
                (SPRITE + SPRITE_PAD * 2) * k, (SPRITE + SPRITE_PAD * 2) * k);
        } else {
            ctx.scale(l.size / 24, l.size / 24);
            ctx.translate(-12, -12);
            ctx.fillStyle = l.colour;
            ctx.fill(shapes[l.shape]);
        }
        ctx.restore();
    }

    /* Fireworks: rockets climb from the foot and burst into sparks that
       fall and fade. Each spark is a dot; the colours are the season's.
       Every slowing is per second, not per frame, so a fast screen draws
       the same show; a rocket that has not burst in three seconds bursts
       where it is. */
    var ROCKET_LIFE = 3;

    function makeRocket(w, h) {
        var colours = airCfg().colours;
        return { x: w * (0.1 + Math.random() * 0.8), y: h + 10, vy: -(h * 0.9 + Math.random() * h * 0.5), age: 0,
            top: h * (0.15 + Math.random() * 0.35), colour: colours[(Math.random() * colours.length) | 0] };
    }

    function burst(r, sparks) {
        var n = 28 + ((Math.random() * 14) | 0), speed = 60 + Math.random() * 70;
        for (var i = 0; i < n; i++) {
            var a = i / n * Math.PI * 2 + Math.random() * 0.2;
            var v = speed * (0.75 + Math.random() * 0.35);
            sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0,
                life: 1.1 + Math.random() * 0.7, colour: r.colour });
        }
    }

    function drawSpark(ctx, x, y, size, colour, alpha, glow) {
        ctx.globalAlpha = alpha;
        if (glow) {
            var s = size * 4 * (SPRITE + SPRITE_PAD * 2) / SPRITE;
            ctx.drawImage(sprite(-1, colour, 16), x - s / 2, y - s / 2, s, s);
            return;
        }
        ctx.fillStyle = colour;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
    }

    // Each canvas's refill, for when the theme changes the sky.
    var skies = [];

    function fallingLeaves(host, before) {
        if (!host || host.querySelector('.kr-season-leaves') || !leafPaths()) return;
        var canvas = document.createElement('canvas');
        canvas.className = 'kr-season-leaves';
        canvas.setAttribute('aria-hidden', 'true');
        host.insertBefore(canvas, before || host.firstChild);
        var ctx = canvas.getContext('2d');
        var w = 0, h = 0, leaves = [], rockets = [], sparks = [], visible = false, frame = 0, last = 0, clock = 0, due = 0;

        function size() {
            var rect = host.getBoundingClientRect();
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = rect.width; h = rect.height;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            var want = Math.max(6, Math.round(w / 1000 * airCfg().per1000));
            while (leaves.length < want) leaves.push(makeLeaf(w, h, true));
            leaves.length = want;
            if (reduced) still();
        }

        skies.push(function () {
            leaves = [];
            rockets = [];
            sparks = [];
            size();
        });

        /* Reduced motion: leaves and snow have landed along the foot of the
           banner, risers and twinklers hang where they are, and fireworks
           are three bursts held open. */
        function still() {
            var cfg = airCfg();
            ctx.clearRect(0, 0, w, h);
            if (cfg.kind === 'fireworks') {
                [0.2, 0.5, 0.8].forEach(function (fx, k) {
                    var colour = cfg.colours[k % cfg.colours.length];
                    for (var i = 0; i < 24; i++) {
                        var a = i / 24 * Math.PI * 2, r = h * 0.12;
                        drawSpark(ctx, fx * w + Math.cos(a) * r, h * 0.35 + Math.sin(a) * r, 1.6, colour, 0.85);
                    }
                });
                ctx.globalAlpha = 1;
                return;
            }
            var lands = !cfg.kind || cfg.kind === 'fall';
            leaves.forEach(function (l, i) {
                var rest = { x: lands ? (i + 0.5) / leaves.length * w + (l.x % 40) - 20 : l.x,
                    y: lands ? h - 6 - (l.size * 0.4) : l.y,
                    swayAmp: 0, swaySpeed: 0, phase: Math.PI / 2, spin: 0, turn: l.turn, flutter: 0, pulse: 0,
                    size: l.size, colour: l.colour, shape: l.shape };
                drawLeaf(ctx, rest, 0);
            });
        }

        function tick(now) {
            frame = 0;
            if (!visible || document.hidden) return;
            var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
            var cfg = airCfg();
            last = now;
            clock += dt;
            ctx.clearRect(0, 0, w, h);
            if (cfg.kind === 'fireworks') fly(dt, cfg);
            else {
                leaves.forEach(function (l, i) {
                    l.y += l.fall * dt;
                    l.x += l.drift * dt;
                    if (cfg.kind === 'twinkle') {
                        // Drifters wrap round the banner rather than leave it.
                        l.x = (l.x + w) % w;
                        l.y = (l.y + h) % h;
                    } else if (l.y > h + 30 || l.y < -60 || l.x > w + 60 || l.x < -60) {
                        leaves[i] = l = makeLeaf(w, h, false);
                    }
                    drawLeaf(ctx, l, clock);
                });
            }
            frame = requestAnimationFrame(tick);
        }

        function fly(dt, cfg) {
            due -= dt;
            if (due <= 0) {
                rockets.push(makeRocket(w, h));
                due = (0.6 + Math.random() * 0.8) / Math.max(0.3, (cfg.rate || 0.8) * w / 1000);
            }
            var slow = Math.pow(0.985, dt * 60), drag = Math.pow(0.97, dt * 60);
            rockets = rockets.filter(function (r) {
                r.age += dt;
                r.y += r.vy * dt;
                r.vy *= slow;
                drawSpark(ctx, r.x, r.y, 1.8, r.colour, 0.9);
                if (r.y > r.top && r.age < ROCKET_LIFE) return true;
                burst(r, sparks);
                return false;
            });
            sparks = sparks.filter(function (s) {
                s.age += dt;
                s.vx *= drag;
                s.vy = s.vy * drag + 60 * dt;
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                var left = 1 - s.age / s.life;
                if (left <= 0) return false;
                drawSpark(ctx, s.x, s.y, 1.7, s.colour, left, cfg.glow);
                return true;
            });
            ctx.globalAlpha = 1;
        }

        function start() {
            if (reduced || frame || !visible || document.hidden) return;
            last = 0;
            frame = requestAnimationFrame(tick);
        }

        size();
        if (window.ResizeObserver) new ResizeObserver(size).observe(host);
        if (reduced) return;
        if (window.IntersectionObserver) {
            new IntersectionObserver(function (entries) {
                visible = entries[entries.length - 1].isIntersecting;
                start();
            }).observe(host);
        } else {
            visible = true;
            start();
        }
        document.addEventListener('visibilitychange', start);
    }

    function leavesEverywhere() {
        Array.prototype.forEach.call(document.querySelectorAll('.breadcrumb-area'), function (el) {
            fallingLeaves(el);
        });
        Array.prototype.forEach.call(document.querySelectorAll('.kr-opener'), function (el) {
            fallingLeaves(el, el.querySelector('.kr-opener__inner'));
        });
        var hero = document.querySelector('.welcome-area');
        if (hero) fallingLeaves(hero, null);
        // A sky for each theme: a theme switch refills every canvas.
        if (dress.leaves.light && window.MutationObserver) {
            new MutationObserver(function () {
                skies.forEach(function (refill) { refill(); });
            }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        }
    }

    /* ------------------------------------------------------------------ *
     * The patch on the footer, and the flyer
     * ------------------------------------------------------------------ */

    function pumpkinPatch() {
        var footer = document.querySelector('.kr-footer');
        if (!footer || footer.querySelector('.kr-season-patch')) return;
        var c = dress.strew, p = dress.patch;
        var patch = document.createElement('div');
        patch.className = 'kr-season-patch';
        patch.setAttribute('aria-hidden', 'true');
        patch.innerHTML = c[0] +
            '<span class="kr-season-patch__' + p[0].size + '">' + p[0].art + '</span>' + c[1] +
            '<span class="kr-season-patch__' + p[1].size + '">' + p[1].art + '</span>' + c[2] +
            '<span class="kr-season-patch__' + p[2].size + '">' + p[2].art + '</span>' + c[3] + c[4];
        footer.insertBefore(patch, footer.firstChild);
        Array.prototype.forEach.call(patch.querySelectorAll('.kr-season-patch > span'), function (el, i) {
            el.addEventListener('click', function () { poke(el, p[i].sound); });
        });

        if (!reduced && dress.flyer) onFooter(flyer, 0.1);
    }

    /* fn(footer), once, when the footer first comes into view (at least
       `share` of it); never where IntersectionObserver is missing. */
    function onFooter(fn, share) {
        var footer = document.querySelector('.kr-footer');
        if (!footer || !window.IntersectionObserver) return;
        var watch = new IntersectionObserver(function (entries) {
            if (!entries[0].isIntersecting) return;
            watch.disconnect();
            fn(footer);
        }, { threshold: share || 0.2 });
        watch.observe(footer);
    }

    function flyer() {
        var el = document.createElement('div');
        el.className = 'kr-season-flyer' + (dress.flight ? ' ' + dress.flight : '');
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = dress.flyer;
        document.body.appendChild(el);
        el.addEventListener('animationend', function (e) {
            if (e.target === el) el.remove();
        });
    }

    /* ------------------------------------------------------------------ *
     * Toys: the dangling thing drops, a patch piece bursts (and sounds)
     * ------------------------------------------------------------------ */

    var SOUND_KEY = 'kr-season-sound';
    var SOUND_PARAMS = ['season-sounds', 'spooky-sounds'];
    var sounds = {};

    function soundsOn() {
        try { return localStorage.getItem(SOUND_KEY) === 'on'; } catch (e) { return false; }
    }

    /* ?season-sounds=on|off, from the palette: stored on this device, then
       taken out of the address so a copied link does not carry it. */
    function soundSwitch() {
        var q = new URLSearchParams(location.search);
        var flag = null;
        SOUND_PARAMS.forEach(function (name) {
            if (q.has(name)) { flag = flag || q.get(name); q.delete(name); }
        });
        if (flag !== 'on' && flag !== 'off') return;
        try {
            if (flag === 'on') localStorage.setItem(SOUND_KEY, 'on');
            else localStorage.removeItem(SOUND_KEY);
        } catch (e) {}
        var rest = q.toString();
        history.replaceState(history.state, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
    }
    window.krSeasonSounds = { on: soundsOn };

    function play(name) {
        if (!name || !soundsOn() || !window.Audio) return;
        var a = sounds[name] || (sounds[name] = new Audio(siteRootPrefix() + 'sounds/' + name + '.mp3'));
        a.volume = 0.6;
        a.currentTime = 0;
        var p = a.play();
        if (p && p.catch) p.catch(function () {});
    }

    function poke(el, sound) {
        play(sound);
        el.classList.remove('kr-season-lit');
        void el.offsetWidth;            // restart the flare on a second click
        el.classList.add('kr-season-lit');
        if (reduced) return;
        var puff = document.createElement('span');
        puff.className = 'kr-season-puff' + (dress.puff ? ' ' + dress.puff : '');
        el.appendChild(puff);
        // Its own animation's end, not one of its ::before/::after bits'.
        puff.addEventListener('animationend', function (e) {
            if (e.target === puff && !e.pseudoElement) puff.remove();
        });
    }

    function danglers() {
        if (reduced) return;
        Array.prototype.forEach.call(document.querySelectorAll('.kr-season-dangler'), function (s) {
            s.addEventListener('click', function () { s.classList.add('kr-season-dangler--drop'); });
            s.addEventListener('animationend', function (e) {
                if (e.animationName === 'kr-season-drop') s.classList.remove('kr-season-dangler--drop');
            });
        });
    }

    /* ------------------------------------------------------------------ *
     * The track on a post's reading bar
     * ------------------------------------------------------------------ */

    /* The reading bar (renderReadingProgress) stays the measure, hidden:
       this reads its scaleX and draws the track to match. 'burn' shrinks
       the rest from the left (a candle's wax is what is left to read),
       'fill' grows it (a beam reaches as far as the reader has), each
       with its tip at the reader, gone at the end mark. 'bits' is a line
       with things along it (track.bit, one per track.every px) that change
       as the reader passes them, and change back on the way up: a twig
       drops its leaves, the eaves grow icicles. */
    function track() {
        if (!dress.track || !document.querySelector('.blog-post, .story-post')) return;
        var bar = document.querySelector('.kr-progress-bar');
        if (!bar) {
            // The bar is built on DOMContentLoaded, maybe after this ran.
            var wait = new MutationObserver(function () {
                if (document.querySelector('.kr-progress-bar')) { wait.disconnect(); track(); }
            });
            wait.observe(document.body, { childList: true });
            setTimeout(function () { wait.disconnect(); }, 8000);
            return;
        }
        if (document.querySelector('.kr-season-track')) return;
        var spec = dress.track, mode = spec.mode;
        var el = document.createElement('div');
        el.className = 'kr-season-track kr-season-track--' + mode + ' kr-season-track--' + spec.kind;
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<span class="kr-season-track__rest"></span>' +
            (spec.tip ? '<span class="kr-season-track__tip">' + spec.tip + '</span>' : '');
        document.body.appendChild(el);
        bar.classList.add('kr-season-tracked');
        var rest = el.querySelector('.kr-season-track__rest');
        var tip = el.querySelector('.kr-season-track__tip');
        var bits = [];

        var width = el.clientWidth, passed = -1;

        function hang() {
            // One bit per spec.every px, spaced evenly along the line.
            var want = Math.max(6, Math.round(width / spec.every));
            if (bits.length === want) return;
            bits.forEach(function (b) { b.remove(); });
            bits = [];
            for (var i = 0; i < want; i++) {
                var b = document.createElement('span');
                b.className = 'kr-season-track__bit';
                b.style.left = ((i + 0.5) / want * 100).toFixed(2) + '%';
                b.innerHTML = spec.bit(i);
                el.appendChild(b);
                bits.push(b);
            }
            passed = -1;
        }

        /* On each move of the reading bar: no layout is read here (the
           width is kept from the last resize), and of the bits only those
           between the old and the new count change. */
        function draw() {
            var m = /scaleX\(([\d.e-]+)\)/.exec(bar.style.transform || '');
            var done = m ? Math.min(1, Math.max(0, parseFloat(m[1]))) : 0;
            if (mode === 'bits') {
                hang();
                var now = 0;
                while (now < bits.length && done >= (now + 0.5) / bits.length) now++;
                var from = passed < 0 ? 0 : Math.min(passed, now);
                var to = passed < 0 ? bits.length : Math.max(passed, now);
                for (var i = from; i < to; i++) {
                    bits[i].classList.toggle('kr-season-track__bit--passed', i < now);
                }
                passed = now;
                return;
            }
            rest.style.transform = 'scaleX(' + (mode === 'burn' ? 1 - done : done) + ')';
            if (tip) tip.style.transform = 'translateX(' + Math.max(6, Math.min(width - 6, done * width)).toFixed(1) + 'px)';
            el.classList.toggle('kr-season-track--out', done >= 0.999);
        }
        draw();
        new MutationObserver(draw).observe(bar, { attributes: true, attributeFilter: ['style'] });
        window.addEventListener('resize', function () {
            width = el.clientWidth;
            draw();
        });
    }

    /* ------------------------------------------------------------------ *
     * Fog (style.css says in which themes: --kr-season-fog-display)
     * ------------------------------------------------------------------ */

    function fog() {
        if (dress.fog === false) return;
        var hosts = [document.querySelector('.welcome-area')];
        if (/\/gallery(\.html)?$/.test(location.pathname)) hosts.push(document.querySelector('.breadcrumb-area'));
        hosts.forEach(function (host) {
            if (!host || host.querySelector('.kr-season-fog')) return;
            var el = document.createElement('div');
            el.className = 'kr-season-fog';
            el.setAttribute('aria-hidden', 'true');
            el.innerHTML = '<span class="kr-season-fog__layer kr-season-fog__layer--far"></span>' +
                '<span class="kr-season-fog__layer"></span>';
            host.insertBefore(el, host.querySelector(':scope > .container'));
        });
    }

    /* ------------------------------------------------------------------ *
     * The photo map
     * ------------------------------------------------------------------ */

    /* map.html's markers are Leaflet icons titled with their place's name.
       A place the season owns gets its badge: by tag (at least map.min of
       its frames carry map.tag, and map.share of all it has) or by name
       (a word of map.places in it). The markers arrive after their data
       does, so watch for them. */
    function markMap() {
        var mapEl = document.getElementById('photo-map');
        var rule = dress.map;
        if (!mapEl || !rule || !window.fetch) return;
        mapEl.classList.add('kr-season-map');
        var root = siteRootPrefix();
        Promise.all([
            fetch(root + 'data/photo-locations.json').then(function (r) { return r.json(); }),
            rule.tag ? fetch(root + 'data/photo-tags.json').then(function (r) { return r.json(); }) : {}
        ]).then(function (got) {
            var tags = got[1] || {};
            var owned = {};
            (got[0].regions || []).forEach(function (region) {
                if (rule.places) {
                    if (rule.places.some(function (word) { return region.name.indexOf(word) !== -1; })) owned[region.name] = true;
                    return;
                }
                var photos = region.photos || [];
                var n = photos.filter(function (stem) {
                    return (tags[stem] || []).indexOf(rule.tag) !== -1;
                }).length;
                if (n >= rule.min && n >= photos.length * rule.share) owned[region.name] = true;
            });
            function mark() {
                Array.prototype.forEach.call(mapEl.querySelectorAll('.kr-map-pin'), function (pin) {
                    var marker = pin.querySelector('.kr-map-marker');
                    if (!marker || !owned[pin.title] || marker.querySelector('.kr-season-badge')) return;
                    var badge = document.createElement('span');
                    badge.className = 'kr-season-badge';
                    badge.setAttribute('aria-hidden', 'true');
                    badge.innerHTML = rule.badge;
                    marker.appendChild(badge);
                });
            }
            mark();
            new MutationObserver(mark).observe(mapEl.querySelector('.leaflet-marker-pane') || mapEl,
                { childList: true, subtree: true });
        }).catch(function () {});
    }

    /* ------------------------------------------------------------------ *
     * Small things: the tab icon, the moon, the 404 page
     * ------------------------------------------------------------------ */

    function favicon() {
        var link = document.querySelector('link[rel="icon"]');
        if (!link || !dress.favicon) return;
        link.setAttribute('type', 'image/svg+xml');
        link.setAttribute('href', 'data:image/svg+xml,' + encodeURIComponent(dress.favicon));
    }

    function moon() {
        var icon = document.querySelector('.theme-toggle__icon--moon');
        if (!icon || !dress.moonmark) return;
        icon.innerHTML = '<circle cx="12" cy="12" r="8.4"/>' +
            '<path class="kr-season-moonmark" d="' + dress.moonmark + '"/>';
    }

    function lost() {
        if (!document.getElementById('kr-lost-canvas')) return;
        var title = document.querySelector('.page-title');
        if (title) title.textContent = dress.lost.title;
        var lede = document.querySelector('.kr-lost__lede');
        if (lede) {
            lede.innerHTML = dress.lost.lede + ' <a href="/contact.html">Tell me if something should be here.</a>';
        }
        var caption = document.getElementById('lost-photo-caption');
        if (caption && caption.firstChild && caption.firstChild.nodeType === 3) {
            caption.firstChild.nodeValue = dress.lost.caption;
        }
    }

    function treats() {
        if (typeof krPhotoPool !== 'function') return;
        krPhotoPool().then(function (files) {
            window.krSeasonTreats = (files || []).map(function (f) {
                return String(f).replace(/\.[^.]+$/, '');
            });
        }).catch(function () {});
    }

    /* Whether the stylesheet this page has knows the decorations. A copy
       cached from before a season's rules existed would leave every
       picture below unstyled, page-sized; then the colours change alone. */
    function styled() {
        var probe = document.createElement('div');
        probe.className = 'kr-season-corner';
        probe.hidden = true;
        document.body.appendChild(probe);
        var ok = getComputedStyle(probe).position === 'absolute';
        probe.remove();
        return ok;
    }

    /* An arrow pointer in the season's colour, with `emblem` (markup on
       a 12 x 12 box) at its tail: a whole cursor for dress.cursor, its
       hotspot at the tip (2, 2). A dark edge inside a pale one keeps it
       seen on either theme; an emblem wants the same. */
    function cursorArt(fill, emblem, edge) {
        return {
            svg: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">' +
                '<path d="M2 2v20l5.5-5 3.5 8 3-1.4-3.4-7.8H18z" fill="none" stroke="#ffffff" stroke-width="3.6"' +
                ' stroke-linejoin="round" stroke-opacity=".85"/>' +
                '<path d="M2 2v20l5.5-5 3.5 8 3-1.4-3.4-7.8H18z" fill="' + fill + '" stroke="' + (edge || '#1b1b1b') +
                '" stroke-width="1.4" stroke-linejoin="round"/>' +
                (emblem ? '<g transform="translate(18 18)">' + emblem + '</g>' : '') + '</svg>',
            x: 2, y: 2
        };
    }

    /* The season's pointer, for mice (style.css applies it under
       pointer: fine, and links keep their hand). */
    function pointer() {
        var c = dress.cursor;
        if (!c) return;
        var root = document.documentElement;
        root.style.setProperty('--kr-season-cursor',
            'url("data:image/svg+xml,' + encodeURIComponent(c.svg) + '") ' + c.x + ' ' + c.y + ', auto');
        root.classList.add('kr-season-cursor');
    }

    /* A walker: once the footer is in view, `art` comes along its top
       edge from the left, stops a while by the patch, and goes off right;
       a click hurries it away (--gone). `kind` names it for style.css
       (kr-season-walker--<kind>: its size and pace). Not under reduced
       motion. */
    function walker(art, kind) {
        if (reduced) return;
        onFooter(function (footer) {
            var el = document.createElement('span');
            el.className = 'kr-season-walker kr-season-walker--' + kind;
            el.setAttribute('aria-hidden', 'true');
            el.innerHTML = art;
            footer.appendChild(el);
            el.addEventListener('click', function () {
                // Off from where it stands, not from where its walk began.
                el.style.setProperty('--kr-season-from', getComputedStyle(el).transform);
                el.classList.add('kr-season-walker--gone');
            });
            el.addEventListener('animationend', function (e) {
                if (e.target === el) el.remove();
            });
        });
    }

    /* ------------------------------------------------------------------ *
     * The backdrop in a post's margins
     * ------------------------------------------------------------------ */

    /* Behind a page's content (a post's article; elsewhere all of
       <main>, below the opener), in the margins either side of its
       container and never under the text: the season's shapes,
       one every BACKDROP_EVERY px down each margin (spaced out further
       on a long page), at three depths. Each
       sways on its own (CSS), and slides by its depth as the page scrolls
       (--kr-season-scroll, the viewport's middle in the host's own
       coordinates, against each shape's --kr-season-y), so the near ones
       pass faster than the far ones. Margins narrower than BACKDROP_MIN
       get nothing, so phones get nothing. Under reduced motion they hold
       still. */
    var BACKDROP_EVERY = 230, BACKDROP_MIN = 48, BACKDROP_MOST = 60, DEPTHS = [0.12, 0.26, 0.42];

    function backdropCfg() {
        if (dress.backdrop) return dress.backdrop;
        var air = airCfg();
        var shapes = air.shapes.filter(function (d) { return d !== DOT; });
        return shapes.length ? { shapes: shapes, colours: air.colours } : null;
    }

    function backdrop() {
        if (dress.backdrop === false) return;
        // A post: its article section. Anywhere else: the whole of <main>,
        // where anything opaque (a photograph, the map, a band of colour)
        // covers the shapes and they show only in the plain margins; not a
        // page whose content runs the full width (the gallery's grid).
        var post = document.querySelector('.blog-post, .story-post');
        var host = post ? post.closest('#main-content-body') : document.querySelector('main');
        if (!host || host.querySelector('.kr-season-backdrop') ||
            (!post && host.querySelector('.container-fluid'))) return;
        host.classList.add('kr-season-backdrop-host');
        var layer = document.createElement('div');
        layer.className = 'kr-season-backdrop';
        layer.setAttribute('aria-hidden', 'true');
        host.insertBefore(layer, host.firstChild);
        var built = '';

        function place() {
            var cfg = backdropCfg();
            var box = host.querySelector('.container') || host;
            var w = host.clientWidth, h = host.scrollHeight;
            // Below the page's opening photograph, which has its own sky.
            var opener = post ? null : host.querySelector('.breadcrumb-area, .kr-opener, .welcome-area');
            var from = opener ? opener.offsetTop + opener.offsetHeight : 0;
            var gutter = (w - box.getBoundingClientRect().width) / 2;
            var key = [w, h, cfg && cfg.shapes.length].join(' ');
            if (key === built) return;
            built = key;
            if (!cfg || gutter < BACKDROP_MIN) { layer.innerHTML = ''; return; }
            var size = Math.max(18, Math.min(56, gutter * 0.5));
            // Room on each side, short of a fixed rail that reaches into it
            // (the contents list; the share buttons, which the wide post
            // layout swaps for a row at the end): never behind its text.
            var room = [gutter, gutter];
            var wide = typeof krWidePost === 'function' && krWidePost().matches;
            Array.prototype.forEach.call(document.querySelectorAll(wide ? '.kr-toc' : '.kr-toc, .kr-share-rail'), function (rail) {
                var r = rail.getBoundingClientRect();
                if (!r.width || getComputedStyle(rail).display === 'none') return;
                if (r.left < gutter) room[0] = Math.min(room[0], r.left - 8);
                if (r.right > w - gutter) room[1] = Math.min(room[1], w - r.right - 8);
            });
            var html = '';
            // Further apart on a long page (the quote wall): at most
            // BACKDROP_MOST down each side, to keep each scroll cheap.
            var every = Math.max(BACKDROP_EVERY, (h - from) / BACKDROP_MOST);
            for (var y = from + every * 0.4, i = 0; y < h - size; y += every, i++) {
                [0, 1].forEach(function (side) {
                    if (room[side] < size * 0.8) return;
                    // Seeded by the shape's place, so a fresh layout (an image
                    // loading, a resize) puts every shape back where it was.
                    var n = i * 2 + side, k = 0;
                    var rand = function () { var v = Math.sin(n * 91.7 + ++k * 12.9898) * 43758.5453; return v - Math.floor(v); };
                    var depth = DEPTHS[(i + side * 2 + (rand() * 2 | 0)) % DEPTHS.length];
                    var s = Math.min(size * (0.6 + depth), room[side] - 8);
                    var x = Math.min(room[side] * (0.12 + rand() * 0.6) - s / 2, room[side] - s - 4);
                    var top = y + (rand() - 0.5) * every * 0.6;
                    // A shape's own colours (one list per shape), or the season's.
                    var shape = (rand() * cfg.shapes.length) | 0;
                    var colours = Array.isArray(cfg.colours[0]) ? cfg.colours[shape] : cfg.colours;
                    html += '<span class="kr-season-backdrop__item" style="' + (side ? 'right' : 'left') + ': ' + Math.max(4, x).toFixed(0) +
                        'px; top: ' + top.toFixed(0) + 'px; width: ' + s.toFixed(0) + 'px; opacity: ' + (0.35 + depth).toFixed(2) +
                        '; --kr-season-y: ' + (top + s / 2).toFixed(0) + '; --kr-season-depth: ' + depth + '">' +
                        '<svg class="kr-season-backdrop__art" viewBox="0 0 24 24" style="animation-delay: -' + (rand() * 9).toFixed(1) +
                        's; animation-duration: ' + (7 + rand() * 6).toFixed(1) + 's" aria-hidden="true" focusable="false">' +
                        '<path d="' + cfg.shapes[shape] + '" fill="' +
                        colours[(rand() * colours.length) | 0] + '"/></svg></span>';
                });
            }
            layer.innerHTML = html;
            scrolled();
        }

        var frame = 0;
        function scrolled() {
            frame = 0;
            var top = host.getBoundingClientRect().top;
            layer.style.setProperty('--kr-season-scroll', (innerHeight / 2 - top).toFixed(0));
        }

        place();
        if (window.ResizeObserver) new ResizeObserver(function () { place(); }).observe(host);
        // The contents rail may come after this did: measure again at load.
        window.addEventListener('load', function () { built = ''; place(); });
        skies.push(function () { built = ''; place(); });
        if (reduced) return;
        window.addEventListener('scroll', function () {
            if (!frame) frame = requestAnimationFrame(scrolled);
        }, { passive: true });
    }

    /* ------------------------------------------------------------------ *
     * A holiday's ribbon, and the card it opens
     * ------------------------------------------------------------------ */

    /* The one piece that is not decoration: a real button, in the Tab
       order, named by its label. The card opens while the mouse is over
       the ribbon or the card, while the button has keyboard focus, or
       when it is clicked or tapped (and then stays until clicked again,
       Escape, or a click elsewhere). Hidden, it is .kr-offstage, out of
       the Tab order. Under the text, the reader's two switches, small
       ghost buttons: the sounds (stored as ?season-sounds= stores them,
       no reload; an action label, as the theme toggle) and the
       decorations, off on this device (it reloads the page with
       ?season=off, which the palette and the colophon's seasons calendar
       turn back on). */
    function ribbon() {
        var a = dress.about;
        if (!a || document.querySelector('.kr-season-ribbon')) return;
        var off = new URLSearchParams(location.search);
        off.set('season', 'off');
        var el = document.createElement('div');
        el.className = 'kr-season-ribbon';
        el.innerHTML = '<button type="button" class="kr-season-ribbon__sash" aria-expanded="false"' +
            ' aria-controls="kr-season-about" aria-label="About ' + season.label + '"><span>' + a.short + '</span></button>' +
            '<div class="kr-season-about kr-offstage" id="kr-season-about" role="group" aria-label="' + season.label + '">' +
            '<p class="kr-season-about__title">' + season.label + '</p>' +
            '<p class="kr-season-about__when">' + a.when + '</p>' +
            '<p class="kr-season-about__text">' + a.text + '</p>' +
            (a.link ? '<a class="kr-season-about__more" href="' + a.link + '">Read more about ' + season.label + '</a>' : '') +
            '<div class="kr-season-about__switches kr-btn-row kr-btn-row--start">' +
            '<button type="button" class="kr-season-about__sound kr-btn kr-btn--ghost kr-btn--sm"></button>' +
            '<button type="button" class="kr-season-about__off kr-btn kr-btn--ghost kr-btn--sm">Turn off the decorations</button></div>' +
            '</div>';
        document.body.appendChild(el);
        var sash = el.firstChild, card = el.lastChild;
        var pinned = false, hovered = false, leave = 0;

        var sound = card.querySelector('.kr-season-about__sound');
        function soundLabel() { sound.textContent = soundsOn() ? 'Turn the sounds off' : 'Turn the sounds on'; }
        soundLabel();
        sound.addEventListener('click', function () {
            try {
                if (soundsOn()) localStorage.removeItem(SOUND_KEY);
                else localStorage.setItem(SOUND_KEY, 'on');
            } catch (e) {}
            soundLabel();
        });
        card.querySelector('.kr-season-about__off').addEventListener('click', function () {
            location.href = location.pathname + '?' + off + location.hash;
        });

        function show(on) {
            card.classList.toggle('is-visible', on);
            sash.setAttribute('aria-expanded', on ? 'true' : 'false');
        }
        function update() { show(pinned || hovered || el.contains(document.activeElement) && sash.matches(':focus-visible') || card.contains(document.activeElement)); }

        sash.addEventListener('click', function () {
            pinned = !pinned;
            hovered = false;
            show(pinned);
        });
        el.addEventListener('pointerenter', function (e) {
            if (e.pointerType !== 'mouse') return;
            clearTimeout(leave);
            hovered = true;
            update();
        });
        el.addEventListener('pointerleave', function (e) {
            if (e.pointerType !== 'mouse') return;
            leave = setTimeout(function () { hovered = false; update(); }, 250);
        });
        el.addEventListener('focusin', update);
        el.addEventListener('focusout', function () { setTimeout(update, 0); });
        el.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            pinned = hovered = false;
            if (card.contains(document.activeElement)) sash.focus();
            show(false);
        });
        document.addEventListener('click', function (e) {
            if (!pinned || el.contains(e.target)) return;
            pinned = false;
            update();
        });
        // On a phone the sash crosses the text in the corner, so once the
        // reader is half a screen down it tucks into a dog-ear (CSS only
        // below 768px), and comes back out at the top of the page.
        var tucked = false, queued = false;
        function tuck() {
            queued = false;
            var on = window.scrollY > window.innerHeight / 2;
            if (on !== tucked) el.classList.toggle('kr-season-ribbon--tucked', tucked = on);
        }
        window.addEventListener('scroll', function () {
            if (!queued) { queued = true; requestAnimationFrame(tuck); }
        }, { passive: true });
        tuck();
    }

    /* What a season's file is given: the shapes and drawings above to
       build its art from, the switches the engine reads, and dress()
       to hand its pieces over. */
    var kit = window.krSeasonKit = {
        season: season, reduced: reduced, ready: ready, svg: svg, play: play,
        soundsOn: soundsOn, bar: bar, flake: flake, star: star, pumpkin: pumpkin,
        leaf: leaf, leafAt: leafAt, bit: bit, strewnLeaves: strewnLeaves, cursor: cursorArt, walker: walker,
        onFooter: onFooter, fix: fix,
        MAPLE: MAPLE, OVAL: OVAL, DOT: DOT, TWIG: TWIG, LEAF_COLOURS: LEAF_COLOURS,
        dress: function (d) {
            if (dress) return;
            dress = d;
            whenSheet(function () { ready(dressPage); });
        }
    };

    /* Both stylesheets (css/season.css and css/seasons/<key>.css, which
       shared-components.js adds) must be in before anything is drawn, or
       the pieces would show unstyled for a moment; if either fails,
       nothing is drawn. */
    function whenSheet(fn) {
        var waiting = ['kr-season-shared-css', 'kr-season-css'].map(function (id) {
            return document.getElementById(id);
        }).filter(function (link) { return link && !link.sheet; });
        var left = waiting.length;
        if (!left) { fn(); return; }
        waiting.forEach(function (link) {
            link.addEventListener('load', function () { if (!--left) fn(); });
        });
    }

    // Every piece, in the order they are drawn, then the season's own.
    function dressPage() {
        soundSwitch();
        if (!styled()) return;
        corners();
        danglers();
        leavesEverywhere();
        fog();
        pumpkinPatch();
        track();
        backdrop();
        markMap();
        favicon();
        moon();
        lost();
        treats();
        pointer();
        ribbon();
        if (dress.extra) dress.extra(kit);
    }
})();
