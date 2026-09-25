/**
 * live-covers.js — the engine behind the hover sketches.
 *
 * A card for a post, or any element carrying data-live="<key>", gets a
 * canvas laid over it on mouseenter or keyboard focus, running a small
 * sketch keyed by the post's slug or the key. The sketches themselves
 * live in js/covers.js (one per post, the interactive posts' being
 * miniatures of their demos) and js/covers-site.js (the rest of the
 * site) and register here with define(). Everything stops and is
 * removed on leave.
 *
 * The engine binds on its own: it scans the page once, watches the DOM
 * for cards rendered later, and rescans when a sketch file registers,
 * so no page or renderer calls it. shared-components.js loads the three
 * files on the first sign of a pointer, and only where hover exists.
 *
 * Sketches count frames; the engine steps them at a fixed sixty a
 * second whatever the display's refresh rate, so a sketch runs at the
 * same speed on a 60 Hz monitor, a 120 Hz laptop and a throttled tab.
 *
 * Touch devices have no hover, and reduced-motion readers asked for
 * stillness; both get the static cover.
 *
 * Writing a sketch: .github/docs/COMPONENTS.md, "The hover sketch".
 * Design notes: "Every Card Has a Sketch",
 * https://www.kenreid.co.uk/blog/every-card-has-a-sketch.html
 */
(function () {
    'use strict';

    /* ---------------------------------------------------------- the kit
       Shared by every sketch: the palette, a seeded random source, a
       handful of drawing calls and the small arithmetic that every
       sketch otherwise reinvents. */
    var C = { a: '#ff9696', b: '#ffe89e', ink: 'rgba(255,255,255,0.85)', dim: 'rgba(255,255,255,0.32)',
              red: '#fc6060', green: '#7dd3a5', blue: '#8fb4e6', veil: 'rgba(14,14,14,0.66)' };
    var TAU = 6.2832;

    function hash(str) {
        var h = 2166136261;
        for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
        return h >>> 0;
    }
    function rng(seed) {
        var a = seed >>> 0;
        return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    function dot(ctx, x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
    function text(ctx, str, x, y, size, fill, weight, align, family) {
        ctx.fillStyle = fill || C.ink;
        ctx.font = (weight || 500) + ' ' + size + 'px ' + (family || 'Poppins, sans-serif');
        ctx.textAlign = align || 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(str, x, y);
    }
    function line(ctx, x1, y1, x2, y2, stroke, width) {
        ctx.strokeStyle = stroke || C.dim; ctx.lineWidth = width || 1;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    }
    function rect(ctx, x, y, w, h, fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
    function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
    function ease(t) { t = clamp01(t); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
    /** Where a frame counter sits in a cycle, 0 to 1. */
    function phase(t, cycle) { return (t % cycle) / cycle; }
    /** A palette colour ('#rrggbb' or 'rgb(a)(...)') at a given opacity. */
    function alpha(colour, a) {
        var m = /^#([0-9a-f]{6})$/i.exec(colour);
        if (m) { var n = parseInt(m[1], 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
        var p = String(colour).match(/[\d.]+/g);
        return p && p.length >= 3 ? 'rgba(' + p[0] + ',' + p[1] + ',' + p[2] + ',' + a + ')' : colour;
    }

    /* A bumpy 2D landscape shared by the population-based demos, plus a
       cheap shaded background for it drawn once per mount. */
    function makeLandscape(rnd) {
        var bumps = [];
        for (var i = 0; i < 5; i++) bumps.push([rnd(), rnd(), 0.08 + rnd() * 0.16, 0.4 + rnd() * 0.8]);
        var opt = [0.25 + rnd() * 0.5, 0.25 + rnd() * 0.5];
        function f(x, y) {
            var v = 2.2 * Math.hypot(x - opt[0], y - opt[1]);
            for (var i = 0; i < bumps.length; i++) {
                var b = bumps[i], d = Math.hypot(x - b[0], y - b[1]);
                v -= b[3] * Math.exp(-(d * d) / (2 * b[2] * b[2]));
            }
            return v;
        }
        function shade(w, h) {
            var c = document.createElement('canvas'); c.width = w; c.height = h;
            var g = c.getContext('2d'), cell = Math.max(4, Math.round(w / 56));
            var vals = [], mn = Infinity, mx = -Infinity;
            for (var y = 0; y < h; y += cell) for (var x = 0; x < w; x += cell) {
                var v = f(x / w, y / h); vals.push(v); if (v < mn) mn = v; if (v > mx) mx = v;
            }
            var k = 0;
            for (var yy = 0; yy < h; yy += cell) for (var xx = 0; xx < w; xx += cell) {
                var t = (vals[k++] - mn) / (mx - mn || 1);
                g.fillStyle = 'rgba(255,' + Math.round(150 + 80 * t) + ',' + Math.round(150 - 60 * t) + ',' + (0.06 + 0.14 * (1 - t)).toFixed(3) + ')';
                g.fillRect(xx, yy, cell, cell);
            }
            return c;
        }
        return { f: f, opt: opt, shade: shade };
    }

    /* ----------------------------------------------------- the registry */
    var KINDS = {};
    var rescan = null;

    /** Register a sketch: factory(w, h, rnd, arg) returns {step, draw, veil?}.
        Cards already on the page that were waiting for this slug bind on
        the next frame. */
    function define(slug, factory) {
        KINDS[slug] = factory;
        if (!rescan) rescan = requestAnimationFrame(function () { rescan = null; scan(document.body); });
    }
    function kindFor(href) {
        var slug = (href || '').split('/').pop().replace(/\.html$/, '');
        return KINDS[slug] ? slug : null;
    }
    /** A sketch instance on its own, for tests: the same call the engine makes. */
    function make(kind, w, h, seed, arg) {
        if (!KINDS[kind]) return null;
        return KINDS[kind](w, h, rng(seed >>> 0), arg === undefined ? null : arg);
    }

    /* ------------------------------------------------------------ runtime */
    var STEP = 1000 / 60, MAX_STEPS = 4;
    var SELECTOR = 'a.blog-card, .single-post-area[data-href], [data-live]';
    var runs = new WeakMap();      // card -> the running sketch
    var bound = new WeakSet();     // cards with listeners

    function still() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
    function canRun() {
        if (still()) return false;
        if (window.matchMedia && window.matchMedia('(hover: none)').matches) return false;
        return true;
    }

    /* Any element with data-live="<key>" is a host in its own right: the
       canvas is laid over it (or under its text with data-live-under), and
       data-live-arg carries JSON for sketches that need a parameter, such
       as a place's coordinates. A card's canvas box is its cover. */
    function hostOf(card) {
        return card.querySelector('[data-live-host]') || card.querySelector('.blog-card-img, .post-thumbnail') ||
            (card.hasAttribute('data-live') ? card : null);
    }
    function hrefOf(card) {
        return card.getAttribute('data-live-href') || card.getAttribute('href') || card.getAttribute('data-href') || '';
    }
    function kindOf(card) {
        var key = card.getAttribute('data-live');
        if (key && KINDS[key]) return key;
        return kindFor(hrefOf(card));
    }

    function start(card) {
        if (runs.has(card) || still()) return;
        var host = hostOf(card);
        if (!host) return;
        var box = host.getBoundingClientRect();
        if (!box.width || !box.height) return;
        var kind = kindOf(card);
        if (!kind) return;
        var arg = null;
        try { arg = JSON.parse(card.getAttribute('data-live-arg') || 'null'); } catch (e) { arg = null; }
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var c = document.createElement('canvas');
        c.className = 'kr-live-cover' + (card.hasAttribute('data-live-under') ? ' kr-live-cover--under' : '');
        c.width = Math.round(box.width * dpr);
        c.height = Math.round(box.height * dpr);
        c.setAttribute('aria-hidden', 'true');
        c.setAttribute('data-kind', kind);
        host.appendChild(c);
        var ctx = c.getContext('2d');
        ctx.scale(dpr, dpr);
        var href = hrefOf(card);
        var algo = KINDS[kind](box.width, box.height, rng(hash(href || kind)), arg);
        // Under-mode hosts become a dark stage while running (the veil
        // stays on whatever the sketch asked) and their text turns light.
        var veil = algo.veil !== false || card.hasAttribute('data-live-under');
        var run = { raf: 0, stop: false, last: 0, acc: STEP, canvas: c };
        runs.set(card, run);
        card.classList.add('kr-live-on');

        function paint() {
            ctx.clearRect(0, 0, box.width, box.height);
            if (veil) { ctx.fillStyle = C.veil; ctx.fillRect(0, 0, box.width, box.height); }
            algo.draw(ctx);
        }
        // Fixed-rate stepping: however often the display paints, the
        // sketch advances sixty times a second, a few steps at most per
        // frame so a stalled tab does not fast-forward on return.
        function frame(ts) {
            if (run.stop) return;
            if (run.last) run.acc += Math.min(100, ts - run.last);
            run.last = ts;
            var steps = 0;
            while (run.acc >= STEP && steps < MAX_STEPS) { algo.step(); run.acc -= STEP; steps++; }
            if (run.acc > STEP * MAX_STEPS) run.acc = 0;
            if (steps) paint();
            run.raf = requestAnimationFrame(frame);
        }
        run.raf = requestAnimationFrame(frame);
        requestAnimationFrame(function () { c.classList.add('is-on'); });
    }

    function stop(card) {
        var run = runs.get(card);
        if (!run) return;
        run.stop = true;
        cancelAnimationFrame(run.raf);
        runs.delete(card);
        card.classList.remove('kr-live-on');
        run.canvas.remove();
    }

    function bind(card) {
        if (bound.has(card) || !kindOf(card)) return;
        bound.add(card);
        card.classList.add('kr-live-card');
        if (card.hasAttribute('data-live')) card.classList.add('kr-live-host');
        card.addEventListener('mouseenter', function () { start(card); });
        card.addEventListener('mouseleave', function () { stop(card); });
        card.addEventListener('focusin', function () { start(card); });
        card.addEventListener('focusout', function () { stop(card); });
        // The sketch files load lazily, on the first pointermove, so a
        // cursor that arrives in one motion can cross into the card and
        // fire mouseenter before this function ever runs; that event is
        // gone by the time the listener above exists to catch it, and
        // nothing plays until a second hover. Catch up immediately if the
        // pointer (or keyboard focus) is already sitting on the card.
        if ((card.matches && card.matches(':hover')) || card === document.activeElement) start(card);
    }

    /** Bind every card and host inside root (root included). */
    function scan(root) {
        if (!root || !root.querySelectorAll || !canRun()) return;
        if (root.matches && root.matches(SELECTOR)) bind(root);
        var found = root.querySelectorAll(SELECTOR);
        for (var i = 0; i < found.length; i++) bind(found[i]);
    }

    /* Cards a script renders later bind as they arrive. */
    function watch() {
        if (!('MutationObserver' in window)) return;
        var queue = [], flush = null;
        new MutationObserver(function (records) {
            for (var r = 0; r < records.length; r++) {
                var added = records[r].addedNodes;
                for (var i = 0; i < added.length; i++) if (added[i].nodeType === 1) queue.push(added[i]);
            }
            if (queue.length && !flush) {
                flush = requestAnimationFrame(function () {
                    flush = null;
                    var batch = queue; queue = [];
                    for (var i = 0; i < batch.length; i++) if (batch[i].isConnected) scan(batch[i]);
                });
            }
        }).observe(document.body, { childList: true, subtree: true });
    }

    function boot() { scan(document.body); watch(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();

    window.krLiveCovers = {
        define: define, kindFor: kindFor, make: make,
        attach: function (root) { scan(root || document.body); },   // older callers; binding is automatic
        get kinds() { return Object.keys(KINDS); },
        helpers: { C: C, TAU: TAU, dot: dot, text: text, line: line, rect: rect, ease: ease, clamp01: clamp01,
                   phase: phase, alpha: alpha, hash: hash, rng: rng, makeLandscape: makeLandscape }
    };
}());
