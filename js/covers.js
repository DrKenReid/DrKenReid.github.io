/**
 * covers.js — one hover sketch per post that is not an algorithm demo.
 *
 * js/live-covers.js runs whatever is registered here over a card's cover
 * while it is hovered. Each sketch is a small picture of what the post is
 * about (a viewfinder hunting a stranger, a dam holding, dates snapping
 * into ISO order), a few dozen lines each, drawn with the shared helpers
 * so they all speak the same palette. The algorithm posts keep their
 * sketches in live-covers.js itself.
 *
 * .github/scripts/check_live_covers.py fails the build when a post has
 * no sketch, so a new post needs one before it can ship.
 */
(function () {
    'use strict';
    if (!window.krLiveCovers) return;
    var H = window.krLiveCovers.helpers, def = window.krLiveCovers.define;
    var C = H.C, dot = H.dot, text = H.text, line = H.line, rect = H.rect, ease = H.ease;
    var TAU = 6.2832;

    /* ---------------------------------------------------- photography */

    // A viewfinder wanders a street of passers-by, locks on one, and the
    // shutter fires.
    def('photographing-strangers', function (w, h, rnd) {
        var people = [], t = 0, lock = -1, flash = 0;
        for (var i = 0; i < 9; i++) people.push({ x: rnd() * w, v: (rnd() < 0.5 ? -1 : 1) * (0.3 + rnd() * 0.5), s: 0.8 + rnd() * 0.4 });
        var vf = { x: w / 2, y: h * 0.55 };
        return {
            step: function () {
                t++;
                people.forEach(function (p) { p.x += p.v; if (p.x < -20) p.x = w + 20; if (p.x > w + 20) p.x = -20; });
                if (flash > 0) flash--;
                if (t % 150 === 40) lock = (rnd() * people.length) | 0;
                if (t % 150 === 110) { flash = 12; }
                if (t % 150 === 130) lock = -1;
                var target = lock >= 0 ? people[lock] : null;
                var tx = target ? target.x : w / 2 + Math.sin(t / 60) * w * 0.3;
                vf.x += (tx - vf.x) * 0.12;
            },
            draw: function (ctx) {
                line(ctx, 0, h * 0.78, w, h * 0.78, C.dim, 1);
                people.forEach(function (p, i) {
                    var hh = 44 * p.s, y = h * 0.78;
                    ctx.fillStyle = i === lock ? C.a : 'rgba(255,255,255,0.55)';
                    ctx.beginPath(); ctx.arc(p.x, y - hh, 5 * p.s, 0, TAU); ctx.fill();
                    ctx.fillRect(p.x - 5 * p.s, y - hh + 6, 10 * p.s, hh - 6);
                });
                var s = 64;
                ctx.strokeStyle = lock >= 0 ? C.b : C.ink; ctx.lineWidth = 2;
                [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
                    ctx.beginPath(); ctx.moveTo(vf.x + c[0] * s / 2, vf.y + c[1] * (s / 2 - 14)); ctx.lineTo(vf.x + c[0] * s / 2, vf.y + c[1] * s / 2); ctx.lineTo(vf.x + c[0] * (s / 2 - 14), vf.y + c[1] * s / 2); ctx.stroke();
                });
                if (flash) rect(ctx, 0, 0, w, h, 'rgba(255,255,255,' + (flash / 12 * 0.7).toFixed(2) + ')');
            }
        };
    });

    // A derelict facade: windows go dark one by one and ivy climbs.
    def('abandoned-places-i-photograph', function (w, h, rnd) {
        var cols = 6, rows = 3, lit = [], t = 0, vines = [];
        for (var i = 0; i < cols * rows; i++) lit.push(1);
        for (var v = 0; v < 4; v++) vines.push({ x: w * (0.1 + 0.8 * rnd()), pts: [], k: rnd() * 10 });
        return {
            step: function () {
                t++;
                if (t % 26 === 0) { var on = lit.map(function (l, i) { return l ? i : -1; }).filter(function (i) { return i >= 0; }); if (on.length) lit[on[(rnd() * on.length) | 0]] = 0; else if (t % 260 === 0) lit = lit.map(function () { return 1; }); }
                vines.forEach(function (v) { if (v.pts.length < 60 && t % 3 === 0) v.pts.push([v.x + Math.sin((v.pts.length + v.k) * 0.4) * 10, h - v.pts.length * 3]); });
            },
            draw: function (ctx) {
                rect(ctx, w * 0.12, h * 0.18, w * 0.76, h * 0.82, 'rgba(255,255,255,0.08)');
                for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
                    var x = w * 0.16 + c * (w * 0.68 / cols), y = h * 0.26 + r * (h * 0.22);
                    rect(ctx, x, y, w * 0.68 / cols - 10, h * 0.15, lit[r * cols + c] ? 'rgba(255,232,158,0.75)' : 'rgba(0,0,0,0.5)');
                }
                vines.forEach(function (v) { ctx.strokeStyle = C.green; ctx.lineWidth = 2; ctx.beginPath(); v.pts.forEach(function (p, i) { i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }); ctx.stroke(); });
            }
        };
    });

    // Photographs plotted onto a sketch of two continents, count badges popping.
    def('putting-my-photos-on-a-map', function (w, h, rnd) {
        var land = [];
        for (var i = 0; i < 90; i++) land.push([w * (0.05 + rnd() * 0.32), h * (0.18 + rnd() * 0.6)]);
        for (var j = 0; j < 90; j++) land.push([w * (0.55 + rnd() * 0.4), h * (0.12 + rnd() * 0.5)]);
        var pins = [], t = 0;
        return {
            step: function () { t++; if (t % 22 === 0 && pins.length < 14) { var p = land[(rnd() * land.length) | 0]; pins.push({ x: p[0], y: p[1], n: 1 + ((rnd() * 28) | 0), a: 0 }); } pins.forEach(function (p) { p.a = Math.min(1, p.a + 0.08); }); if (t % 400 === 0) pins = []; },
            draw: function (ctx) {
                land.forEach(function (p) { dot(ctx, p[0], p[1], 2.2, 'rgba(255,255,255,0.14)'); });
                pins.forEach(function (p) { var r = 9 * ease(p.a); dot(ctx, p.x, p.y, r + 2, C.ink); dot(ctx, p.x, p.y, r, C.red); if (p.a > 0.9) text(ctx, p.n, p.x, p.y + 1, 9, '#fff', 700, 'center'); });
            }
        };
    });

    // A repository gauge fills to its 1 GB cap while originals drift off to a release.
    def('hosting-photography-on-github-for-free', function (w, h, rnd) {
        var t = 0, frames = [];
        return {
            step: function () { t++; if (t % 14 === 0) frames.push({ x: w * 0.3, y: h * 0.3 + rnd() * h * 0.4, big: rnd() < 0.5 }); frames.forEach(function (f) { if (f.big) { f.x += 2.2; } else { f.x -= 1.6; } }); frames = frames.filter(function (f) { return f.x > 10 && f.x < w - 10; }); },
            draw: function (ctx) {
                var cap = 0.42 + 0.02 * Math.sin(t / 30);
                rect(ctx, w * 0.06, h * 0.2, w * 0.14, h * 0.6, 'rgba(255,255,255,0.1)');
                rect(ctx, w * 0.06, h * 0.8 - h * 0.6 * cap, w * 0.14, h * 0.6 * cap, C.b);
                text(ctx, 'repo', w * 0.13, h * 0.9, 10, C.dim, 600, 'center');
                text(ctx, '1 GB', w * 0.13, h * 0.14, 9, C.ink, 600, 'center');
                rect(ctx, w * 0.78, h * 0.2, w * 0.16, h * 0.6, 'rgba(255,255,255,0.1)');
                text(ctx, 'release', w * 0.86, h * 0.9, 10, C.dim, 600, 'center');
                frames.forEach(function (f) { var s = f.big ? 22 : 9; rect(ctx, f.x - s / 2, f.y - s * 0.33, s, s * 0.66, f.big ? C.a : C.ink); });
            }
        };
    });

    // Thumbnails fly into ten category buckets.
    def('photo-tagging-with-clip', function (w, h, rnd) {
        var buckets = 10, items = [], t = 0;
        return {
            step: function () { t++; if (t % 9 === 0) items.push({ x: w / 2, y: -10, k: (rnd() * buckets) | 0, p: 0 }); items.forEach(function (it) { it.p = Math.min(1, it.p + 0.035); }); items = items.filter(function (it) { return it.p < 1 || t % 300 < 150; }); if (items.length > 40) items.shift(); },
            draw: function (ctx) {
                for (var b = 0; b < buckets; b++) { var bx = w * (0.06 + b * 0.88 / (buckets - 1)); rect(ctx, bx - 10, h * 0.84, 20, 3, C.dim); }
                items.forEach(function (it) { var e = ease(it.p), bx = w * (0.06 + it.k * 0.88 / (buckets - 1)); var x = it.x + (bx - it.x) * e, y = -10 + (h * 0.8 + 10) * e; rect(ctx, x - 7, y - 5, 14, 10, e > 0.95 ? C.b : C.a); });
                text(ctx, 'CLIP', w / 2, h * 0.14, 12, C.dim, 700, 'center');
            }
        };
    });

    // One email, two Kens: a plane threads from Scotland to the Italian Alps.
    def('mistaken-identity-italy', function (w, h, rnd) {
        var t = 0, peaks = []; for (var i = 0; i < 7; i++) peaks.push([w * (0.62 + i * 0.055), h * (0.5 + rnd() * 0.25)]);
        return {
            step: function () { t = (t + 1) % 360; },
            draw: function (ctx) {
                ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * 0.6, h * 0.82); peaks.forEach(function (p) { ctx.lineTo(p[0], p[1]); }); ctx.lineTo(w * 0.98, h * 0.82); ctx.stroke();
                rect(ctx, w * 0.08, h * 0.3, 40, 26, 'rgba(255,255,255,0.15)'); text(ctx, '@', w * 0.08 + 20, h * 0.3 + 13, 14, C.a, 700, 'center');
                var p = ease(Math.min(1, t / 240)), x = w * 0.12 + (w * 0.74 - w * 0.12) * p, y = h * 0.42 - Math.sin(p * 3.1416) * h * 0.25;
                ctx.strokeStyle = C.dim; ctx.setLineDash([3, 5]); ctx.beginPath(); for (var q = 0; q <= p; q += 0.04) ctx.lineTo(w * 0.12 + (w * 0.74 - w * 0.12) * q, h * 0.42 - Math.sin(q * 3.1416) * h * 0.25); ctx.stroke(); ctx.setLineDash([]);
                dot(ctx, x, y, 4, C.b);
            }
        };
    });

    /* ----------------------------------------------------- site building */

    // A focus ring tabs through controls; the skip link is the first stop.
    def('making-this-website-accessible', function (w, h, rnd) {
        var stops = [[w * 0.5, h * 0.14, 90, 18, 'skip to content'], [w * 0.2, h * 0.4, 50, 16, ''], [w * 0.45, h * 0.4, 50, 16, ''], [w * 0.7, h * 0.4, 50, 16, ''], [w * 0.3, h * 0.7, 120, 16, ''], [w * 0.7, h * 0.7, 60, 16, '']];
        var i = 0, t = 0, ring = { x: stops[0][0], y: stops[0][1], w: stops[0][2] };
        return {
            step: function () { t++; if (t % 45 === 0) i = (i + 1) % stops.length; var s = stops[i]; ring.x += (s[0] - ring.x) * 0.25; ring.y += (s[1] - ring.y) * 0.25; ring.w += (s[2] - ring.w) * 0.25; },
            draw: function (ctx) {
                stops.forEach(function (s, k) { rect(ctx, s[0] - s[2] / 2, s[1] - s[3] / 2, s[2], s[3], k === i ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'); if (s[4]) text(ctx, s[4], s[0], s[1], 9, C.ink, 600, 'center'); });
                ctx.strokeStyle = C.b; ctx.lineWidth = 2.5; ctx.strokeRect(ring.x - ring.w / 2 - 4, ring.y - 12, ring.w + 8, 24);
                text(ctx, 'Tab', w * 0.9, h * 0.9, 10, C.dim, 600, 'center');
            }
        };
    });

    // Sliders push a wave around: the chassis under the interactive posts.
    def('how-the-interactive-posts-work', function (w, h, rnd) {
        var t = 0, amp = 0.5, freq = 2, ta = amp, tf = freq;
        return {
            step: function () { t++; if (t % 90 === 0) { ta = 0.2 + rnd() * 0.8; tf = 1 + rnd() * 4; } amp += (ta - amp) * 0.05; freq += (tf - freq) * 0.05; },
            draw: function (ctx) {
                ctx.strokeStyle = C.a; ctx.lineWidth = 2; ctx.beginPath();
                for (var x = 0; x <= w; x += 3) { var y = h * 0.42 + Math.sin(x / w * freq * TAU + t * 0.06) * h * 0.22 * amp; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
                ctx.stroke();
                [['amp', amp], ['freq', (freq - 1) / 4]].forEach(function (s, i) { var y = h * (0.78 + i * 0.12); line(ctx, w * 0.2, y, w * 0.8, y, C.dim, 2); dot(ctx, w * 0.2 + w * 0.6 * s[1], y, 5, C.b); text(ctx, s[0], w * 0.12, y, 9, C.dim, 600, 'center'); });
            }
        };
    });

    // A calendar's Mondays light up and the scrobble count ticks upward.
    def('letting-robots-update-your-homepage', function (w, h, rnd) {
        var t = 0, n = 49712, week = 0;
        return {
            step: function () { t++; if (t % 40 === 0) { week = (week + 1) % 5; n += 30 + ((rnd() * 40) | 0); } },
            draw: function (ctx) {
                for (var r = 0; r < 5; r++) for (var c = 0; c < 7; c++) { var on = c === 0 && r === week; rect(ctx, w * 0.08 + c * w * 0.07, h * 0.2 + r * h * 0.14, w * 0.06, h * 0.11, on ? C.b : (c === 0 ? 'rgba(255,232,158,0.3)' : 'rgba(255,255,255,0.1)')); }
                text(ctx, 'Mon 06:00 UTC', w * 0.3, h * 0.12, 9, C.dim, 600, 'center');
                text(ctx, n.toLocaleString(), w * 0.78, h * 0.42, 22, C.ink, 700, 'center');
                text(ctx, 'scrobbles', w * 0.78, h * 0.6, 10, C.dim, 600, 'center');
                var k = (t % 40) / 40; if (k < 0.3) text(ctx, 'commit', w * 0.78, h * 0.8, 9, C.green, 700, 'center');
            }
        };
    });

    // Fifty bars grow, one per post, the way the infographic drew itself.
    def('50-blogs-an-infographic', function (w, h, rnd) {
        var bars = []; for (var i = 0; i < 50; i++) bars.push(0.2 + rnd() * 0.8);
        var t = 0;
        return {
            step: function () { t = (t + 1) % 260; },
            draw: function (ctx) {
                var shown = Math.min(50, (t / 3) | 0), bw = (w * 0.86) / 50;
                for (var i = 0; i < shown; i++) { var bh = h * 0.6 * bars[i]; rect(ctx, w * 0.07 + i * bw, h * 0.82 - bh, bw - 1.5, bh, i % 10 === 9 ? C.a : C.b); }
                text(ctx, shown + ' posts', w * 0.5, h * 0.12, 12, C.ink, 700, 'center');
            }
        };
    });

    // A page mock flips theme with a circular wipe and never a white flash.
    def('dark-mode-that-doesnt-flash', function (w, h, rnd) {
        var t = 0, r = 0, dark = true;
        return {
            step: function () { t++; if (t % 120 === 0) { r = 0; dark = !dark; } r = Math.min(1, r + 0.03); },
            draw: function (ctx) {
                var bgFrom = dark ? '#f5f0e8' : '#1a1a1a', bgTo = dark ? '#1a1a1a' : '#f5f0e8', ink = dark ? '#1a1a1a' : '#f5f0e8', inkTo = dark ? '#f5f0e8' : '#1a1a1a';
                rect(ctx, w * 0.1, h * 0.1, w * 0.8, h * 0.8, bgFrom);
                ctx.save(); ctx.beginPath(); ctx.arc(w * 0.86, h * 0.16, ease(r) * w * 0.95, 0, TAU); ctx.clip();
                rect(ctx, w * 0.1, h * 0.1, w * 0.8, h * 0.8, bgTo); ctx.restore();
                for (var i = 0; i < 5; i++) { ctx.save(); ctx.beginPath(); ctx.arc(w * 0.86, h * 0.16, ease(r) * w * 0.95, 0, TAU); ctx.clip(); rect(ctx, w * 0.18, h * (0.3 + i * 0.11), w * (0.3 + 0.3 * ((i * 7) % 3) / 2), 5, inkTo); ctx.restore(); }
                for (var j = 0; j < 5; j++) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.arc(w * 0.86, h * 0.16, ease(r) * w * 0.95, 0, TAU, true); ctx.clip(); rect(ctx, w * 0.18, h * (0.3 + j * 0.11), w * (0.3 + 0.3 * ((j * 7) % 3) / 2), 5, ink); ctx.restore(); }
                dot(ctx, w * 0.86, h * 0.16, 6, C.b);
            }
        };
    });

    // An iceberg: a post above the waterline, its metadata scrolling beneath.
    def('invisible-half-of-a-blog-post', function (w, h, rnd) {
        var tags = ['og:title', 'og:image', 'twitter:card', 'canonical', 'JSON-LD', 'description', 'og:url', 'article:published', 'feed', 'sitemap'], t = 0;
        return {
            step: function () { t++; },
            draw: function (ctx) {
                var wl = h * 0.36;
                rect(ctx, w * 0.3, h * 0.12, w * 0.4, wl - h * 0.12, 'rgba(255,255,255,0.18)');
                text(ctx, 'the post', w * 0.5, h * 0.24, 11, C.ink, 700, 'center');
                ctx.strokeStyle = C.blue; ctx.lineWidth = 1.5; ctx.beginPath(); for (var x = 0; x <= w; x += 4) { var y = wl + Math.sin(x / 18 + t / 9) * 2; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
                ctx.save(); ctx.beginPath(); ctx.rect(0, wl, w, h - wl); ctx.clip();
                rect(ctx, w * 0.2, wl, w * 0.6, h * 0.62, 'rgba(143,180,230,0.14)');
                tags.forEach(function (tg, i) { var y = wl + 16 + ((i * 20 + t * 0.4) % (h * 0.62)); text(ctx, tg, w * 0.5, y, 9, 'rgba(255,255,255,0.7)', 500, 'center', 'ui-monospace, monospace'); });
                ctx.restore();
            }
        };
    });

    // The palette types a query and the results filter down.
    def('ctrl-k-for-a-static-site', function (w, h, rnd) {
        var items = ['Ant Colony, Live', 'About', 'Gallery: wildlife', 'Photo map', 'Simulated Annealing, Live', 'Contact', 'Colophon', 'Tabu Search, Live'], q = 'live', t = 0;
        return {
            step: function () { t = (t + 1) % 220; },
            draw: function (ctx) {
                var typed = q.slice(0, Math.min(q.length, (t / 16) | 0));
                rect(ctx, w * 0.1, h * 0.08, w * 0.8, h * 0.84, 'rgba(255,255,255,0.08)');
                rect(ctx, w * 0.14, h * 0.13, w * 0.72, 24, 'rgba(0,0,0,0.35)');
                text(ctx, typed + (t % 30 < 15 ? '|' : ''), w * 0.17, h * 0.13 + 12, 12, C.ink, 500);
                text(ctx, 'Ctrl K', w * 0.82, h * 0.13 + 12, 9, C.dim, 700, 'center');
                var shown = items.filter(function (s) { return !typed || s.toLowerCase().indexOf(typed) !== -1; });
                shown.slice(0, 5).forEach(function (s, i) { text(ctx, s, w * 0.17, h * 0.36 + i * 20, 10, i === 0 ? C.b : C.ink, i === 0 ? 700 : 500); });
            }
        };
    });

    // Braces around JSON rows; the rows fan out into cards.
    def('blog-engine-in-one-json-file', function (w, h, rnd) {
        var t = 0, rows = ['"title"', '"date"', '"tags"', '"excerpt"', '"url"'];
        return {
            step: function () { t = (t + 1) % 240; },
            draw: function (ctx) {
                text(ctx, '{', w * 0.12, h * 0.5, 44, C.dim, 300, 'center', 'ui-monospace, monospace');
                rows.forEach(function (r, i) { text(ctx, r + ':', w * 0.2, h * (0.22 + i * 0.14), 10, C.a, 500, 'left', 'ui-monospace, monospace'); });
                text(ctx, '}', w * 0.44, h * 0.5, 44, C.dim, 300, 'center', 'ui-monospace, monospace');
                var p = ease(Math.min(1, t / 120));
                for (var k = 0; k < 3; k++) { var x = w * 0.42 + (w * 0.56 + k * w * 0.16 - w * 0.42) * p, y = h * (0.2 + k * 0.26); rect(ctx, x, y, w * 0.14, h * 0.2, 'rgba(255,255,255,' + (0.1 + 0.25 * p).toFixed(2) + ')'); rect(ctx, x + 4, y + h * 0.13, w * 0.09, 3, C.b); }
                text(ctx, 'posts.json', w * 0.28, h * 0.92, 9, C.dim, 600, 'center');
            }
        };
    });

    // A checklist of tests turns green, one goes red and is fixed.
    def('my-website-has-a-test-suite', function (w, h, rnd) {
        var names = ['links resolve', 'og:image exists', 'json-ld parses', 'css build current', 'demos render', 'feed valid', 'a11y basics'], t = 0, bad = 4;
        return {
            step: function () { t = (t + 1) % 320; if (t === 0) bad = (rnd() * names.length) | 0; },
            draw: function (ctx) {
                names.forEach(function (n, i) {
                    var y = h * (0.14 + i * 0.12), done = t > 20 + i * 22, fixed = t > 230;
                    var state = !done ? 0 : (i === bad && !fixed ? 2 : 1);
                    dot(ctx, w * 0.12, y, 6, state === 0 ? 'rgba(255,255,255,0.15)' : state === 1 ? C.green : C.red);
                    if (state === 1) { ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w * 0.12 - 3, y); ctx.lineTo(w * 0.12 - 1, y + 3); ctx.lineTo(w * 0.12 + 4, y - 3); ctx.stroke(); }
                    text(ctx, n, w * 0.18, y, 10, state === 2 ? C.red : C.ink, state === 2 ? 700 : 500);
                });
                text(ctx, t > 230 ? 'all green' : (t > 20 + bad * 22 ? '1 failure' : 'running'), w * 0.85, h * 0.14, 10, t > 230 ? C.green : C.dim, 700, 'center');
            }
        };
    });

    // A thread of speech bubbles fills in, no database anywhere.
    def('free-comments-via-github-discussions', function (w, h, rnd) {
        var bubbles = [], t = 0;
        return {
            step: function () { t++; if (t % 36 === 0 && bubbles.length < 6) bubbles.push({ side: bubbles.length % 2, len: 0.4 + rnd() * 0.5, a: 0 }); bubbles.forEach(function (b) { b.a = Math.min(1, b.a + 0.08); }); if (t % 400 === 0) bubbles = []; },
            draw: function (ctx) {
                bubbles.forEach(function (b, i) { var y = h * 0.1 + i * h * 0.14, bw = w * 0.5 * b.len, x = b.side ? w * 0.9 - bw : w * 0.1; ctx.globalAlpha = ease(b.a); rect(ctx, x, y, bw, h * 0.1, b.side ? 'rgba(255,150,150,0.55)' : 'rgba(255,255,255,0.2)'); rect(ctx, x + 8, y + h * 0.045, bw * 0.7, 3, C.ink); ctx.globalAlpha = 1; });
                text(ctx, 'giscus', w * 0.5, h * 0.94, 9, C.dim, 700, 'center');
            }
        };
    });

    // Two glyphs: the outside request is struck through and the file shrinks 75 KB to 1.5 KB.
    def('self-hosting-your-fonts', function (w, h, rnd) {
        var t = 0;
        return {
            step: function () { t = (t + 1) % 260; },
            draw: function (ctx) {
                text(ctx, 'Aa', w * 0.22, h * 0.42, 44, C.ink, 600, 'center', 'Lora, Georgia, serif');
                text(ctx, 'Aa', w * 0.5, h * 0.42, 44, C.a, 600, 'center');
                var p = ease(Math.min(1, t / 160));
                var kb = 75 - 73.5 * p;
                rect(ctx, w * 0.7, h * 0.3, w * 0.22 * (kb / 75), 14, C.b);
                text(ctx, kb.toFixed(kb < 5 ? 1 : 0) + ' KB', w * 0.81, h * 0.55, 11, C.ink, 700, 'center');
                text(ctx, 'icons', w * 0.81, h * 0.7, 9, C.dim, 600, 'center');
                text(ctx, 'fonts.googleapis.com', w * 0.5, h * 0.86, 9, C.dim, 500, 'center');
                if (t > 40) line(ctx, w * 0.22, h * 0.86, w * 0.78, h * 0.86, C.red, 2);
            }
        };
    });

    // The signal drops; the page keeps coming out of the cache.
    def('reading-this-site-offline', function (w, h, rnd) {
        var t = 0;
        return {
            step: function () { t = (t + 1) % 300; },
            draw: function (ctx) {
                var off = t > 90;
                for (var i = 0; i < 3; i++) { ctx.strokeStyle = off ? 'rgba(255,255,255,0.15)' : C.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(w * 0.2, h * 0.5, 10 + i * 10, 3.6, 5.8); ctx.stroke(); }
                dot(ctx, w * 0.2, h * 0.5, 3, off ? C.red : C.ink);
                if (off) line(ctx, w * 0.1, h * 0.7, w * 0.3, h * 0.28, C.red, 2.5);
                rect(ctx, w * 0.45, h * 0.3, w * 0.16, h * 0.4, 'rgba(255,255,255,0.12)'); text(ctx, 'cache', w * 0.53, h * 0.5, 9, C.dim, 700, 'center');
                var k = ((t * 1.5) % 100) / 100;
                rect(ctx, w * 0.62 + w * 0.22 * k, h * 0.42, 14, 18, C.b);
                rect(ctx, w * 0.86, h * 0.26, w * 0.1, h * 0.48, 'rgba(255,255,255,0.18)');
                text(ctx, off ? 'offline, still reading' : 'online', w * 0.5, h * 0.9, 9, off ? C.b : C.dim, 700, 'center');
            }
        };
    });

    // Markup on the left types itself; the page on the right sets each
    // line as it lands: a heading, justified rules, a proper sum.
    def('why-i-love-latex', function (w, h, rnd) {
        var src = ['\\section{Why}', 'Because', '$\\sum_{i=1}^{n} x_i$', 'is beautiful.'], t = 0, PER = 26, HOLD = 150;
        return {
            step: function () { t = (t + 1) % (src.length * PER + HOLD); },
            draw: function (ctx) {
                var done = Math.min(src.length, (t / PER) | 0), partial = (t % PER) / PER;
                var mono = 'ui-monospace, Menlo, Consolas, monospace', fs = Math.max(8, Math.min(11, w * 0.028));
                for (var i = 0; i < src.length; i++) {
                    if (i > done) break;
                    var str = i < done ? src[i] : src[i].slice(0, Math.ceil(src[i].length * partial));
                    text(ctx, str, w * 0.06, h * (0.2 + i * 0.16), fs, C.a, 500, 'left', mono);
                    if (i === done && (t % 20) < 10) text(ctx, '|', w * 0.06 + ctx.measureText(str).width + 2, h * (0.2 + i * 0.16), fs, C.ink, 500, 'left', mono);
                }
                // the page
                var px = w * 0.56, py = h * 0.1, pw = w * 0.38, ph = h * 0.8;
                rect(ctx, px, py, pw, ph, '#f5f0e8');
                rect(ctx, px + 3, py + 3, pw, ph, 'rgba(0,0,0,0.25)'); rect(ctx, px, py, pw, ph, '#f5f0e8');
                var set = done + (partial > 0.99 ? 1 : 0), inner = px + pw * 0.12, iw = pw * 0.76, y = py + ph * 0.16;
                if (set >= 1) { text(ctx, 'Why', inner, y, Math.max(9, pw * 0.11), '#1f1b17', 700, 'left', 'Lora, Georgia, serif'); y += ph * 0.16; }
                if (set >= 2) { [1, 0.92, 1][0]; for (var l = 0; l < 3; l++) { rect(ctx, inner, y, iw * (l === 2 ? 0.55 : 1), 1.5, '#4a443c'); y += ph * 0.07; } y += ph * 0.03; }
                if (set >= 3) { text(ctx, '\u2211', inner + iw * 0.5 - pw * 0.12, y + ph * 0.05, Math.max(12, pw * 0.16), '#1f1b17', 400, 'center', 'Lora, Georgia, serif'); text(ctx, 'x', inner + iw * 0.5 + pw * 0.06, y + ph * 0.05, Math.max(8, pw * 0.09), '#1f1b17', 400, 'center', 'Lora, Georgia, serif'); text(ctx, 'i', inner + iw * 0.5 + pw * 0.12, y + ph * 0.09, Math.max(6, pw * 0.06), '#1f1b17', 400, 'center', 'Lora, Georgia, serif'); y += ph * 0.2; }
                if (set >= 4) { for (var m = 0; m < 3; m++) { rect(ctx, inner, y, iw * (m === 2 ? 0.4 : 1), 1.5, '#4a443c'); y += ph * 0.07; } }
                if (t > src.length * PER + 10) text(ctx, 'pdflatex: ok', w * 0.06, h * 0.08, fs, C.green, 700, 'left', mono);
            }
        };
    });

    // An equaliser plays and the counter climbs to fifty thousand.
    def('what-50000-scrobbles-say-about-me', function (w, h, rnd) {
        var bars = [], t = 0; for (var i = 0; i < 24; i++) bars.push(rnd());
        return {
            step: function () { t++; bars = bars.map(function (b) { return Math.max(0.05, Math.min(1, b + (rnd() - 0.5) * 0.25)); }); },
            draw: function (ctx) {
                var bw = w * 0.8 / 24;
                bars.forEach(function (b, i) { var bh = h * 0.42 * b; rect(ctx, w * 0.1 + i * bw, h * 0.72 - bh, bw - 2, bh, i % 3 ? C.b : C.a); });
                var n = Math.min(50000, (t * 137) % 60000);
                text(ctx, n.toLocaleString(), w * 0.5, h * 0.2, 20, C.ink, 700, 'center');
                text(ctx, 'plays', w * 0.5, h * 0.88, 9, C.dim, 600, 'center');
            }
        };
    });

    // Four "learner types" fill; the test scores come out level.
    def('why-you-arent-a-visual-learner', function (w, h, rnd) {
        var labels = ['V', 'A', 'R', 'K'], t = 0;
        return {
            step: function () { t = (t + 1) % 300; },
            draw: function (ctx) {
                labels.forEach(function (l, i) {
                    var x = w * (0.2 + i * 0.2), quiz = [0.9, 0.4, 0.55, 0.3][i], score = 0.62;
                    var p = ease(Math.min(1, t / 80)), q = ease(Math.max(0, (t - 120) / 80));
                    var v = quiz * p + (score - quiz * p) * q;
                    rect(ctx, x - 16, h * 0.78 - h * 0.55 * v, 32, h * 0.55 * v, q > 0.5 ? C.b : C.a);
                    text(ctx, l, x, h * 0.88, 11, C.ink, 700, 'center');
                });
                text(ctx, t < 120 ? 'the quiz says' : 'the tests say', w * 0.5, h * 0.1, 10, C.dim, 600, 'center');
            }
        };
    });

    // A dial-up bar creeps, windows pop, and the whole thing fades to static.
    def('life-and-death-of-the-early-internet', function (w, h, rnd) {
        var t = 0, wins = [];
        return {
            step: function () { t = (t + 1) % 360; if (t === 0) wins = []; if (t > 100 && t % 30 === 0 && wins.length < 5) wins.push({ x: w * (0.1 + rnd() * 0.5), y: h * (0.1 + rnd() * 0.5) }); },
            draw: function (ctx) {
                for (var y = 0; y < h; y += 4) rect(ctx, 0, y, w, 1, 'rgba(255,255,255,0.05)');
                var p = Math.min(1, t / 100);
                rect(ctx, w * 0.2, h * 0.5, w * 0.6, 12, 'rgba(255,255,255,0.15)'); rect(ctx, w * 0.2, h * 0.5, w * 0.6 * p, 12, C.b);
                text(ctx, p < 1 ? 'Connecting at 56 kbps' + '.'.repeat((t / 10) % 4 | 0) : 'Connected', w * 0.5, h * 0.4, 10, C.ink, 600, 'center');
                wins.forEach(function (win) { rect(ctx, win.x, win.y, w * 0.3, h * 0.28, 'rgba(255,255,255,0.18)'); rect(ctx, win.x, win.y, w * 0.3, 8, C.blue); });
                if (t > 300) rect(ctx, 0, 0, w, h, 'rgba(0,0,0,' + ((t - 300) / 60).toFixed(2) + ')');
            }
        };
    });

    // Dates in every format scramble, then snap into one sortable column.
    def('iso-8601-date-cult', function (w, h, rnd) {
        var messy = ['12/05/2026', '05/12/2026', 'May 12, 2026', '12.5.26', '5-12-2026', '12 May 2026'], t = 0;
        return {
            step: function () { t = (t + 1) % 300; },
            draw: function (ctx) {
                var p = ease(Math.max(0, (t - 100) / 100));
                messy.forEach(function (d, i) {
                    var x0 = w * (0.1 + rnd() * 0), y0 = h * (0.12 + i * 0.14), x = w * 0.12 + (w * 0.55 - w * 0.12) * p;
                    var jit = (1 - p) * Math.sin(t / 7 + i) * 3;
                    text(ctx, p > 0.9 ? '2026-05-12' : d, x + jit, y0, 11, p > 0.9 ? C.b : C.ink, p > 0.9 ? 700 : 500, 'left', 'ui-monospace, monospace');
                });
                text(ctx, p > 0.9 ? 'sortable' : 'ambiguous', w * 0.5, h * 0.94, 9, p > 0.9 ? C.green : C.red, 700, 'center');
            }
        };
    });

    // A rainbow chart becomes an accessible one: fewer hues, patterns, labels.
    def('accessibility-first-product-design-data-science', function (w, h, rnd) {
        var vals = [0.5, 0.8, 0.35, 0.65, 0.9], t = 0, rainbow = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5'];
        return {
            step: function () { t = (t + 1) % 280; },
            draw: function (ctx) {
                var fixed = t > 140, bw = w * 0.12, grow = ease(Math.min(1, (t % 140) / 40));
                vals.forEach(function (v, i) {
                    var x = w * 0.14 + i * w * 0.16, bh = h * 0.55 * v * grow;
                    rect(ctx, x, h * 0.8 - bh, bw, bh, fixed ? (i % 2 ? C.b : C.a) : rainbow[i]);
                    if (fixed && i % 2) { ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; for (var s = 0; s < bh; s += 6) line(ctx, x, h * 0.8 - bh + s, x + bw, h * 0.8 - bh + s, 'rgba(0,0,0,0.45)', 1); }
                    if (fixed) text(ctx, Math.round(v * 100), x + bw / 2, h * 0.8 - bh - 8, 8, C.ink, 700, 'center');
                });
                text(ctx, fixed ? 'labels, pattern, contrast' : 'colour alone', w * 0.5, h * 0.1, 9, fixed ? C.green : C.red, 700, 'center');
            }
        };
    });

    /* ------------------------------------------------- thinking and society */

    // A fear meter driven by headlines: the rare and vivid beat the common.
    def('the-availability-heuristic-runs-the-news', function (w, h, rnd) {
        var t = 0, fear = 0.2, items = [];
        for (var i = 0; i < 4; i++) items.push({ vivid: i % 2 === 1, x: w * (0.2 + i * 0.3), y: h * (0.2 + rnd() * 0.3) });
        return {
            step: function () { t++; if (t % 50 === 0) items.push({ vivid: rnd() < 0.5, x: w, y: h * (0.2 + rnd() * 0.3) }); items.forEach(function (it) { it.x -= 2.4; }); items = items.filter(function (it) { return it.x > -80; }); var want = items.some(function (it) { return it.vivid && it.x < w * 0.6; }) ? 0.9 : 0.2; fear += (want - fear) * 0.05; },
            draw: function (ctx) {
                items.forEach(function (it) { rect(ctx, it.x, it.y - 7, 70, 14, it.vivid ? C.red : 'rgba(255,255,255,0.2)'); if (it.vivid) text(ctx, 'BREAKING', it.x + 35, it.y, 7, '#fff', 700, 'center'); });
                rect(ctx, w * 0.1, h * 0.78, w * 0.8, 10, 'rgba(255,255,255,0.12)'); rect(ctx, w * 0.1, h * 0.78, w * 0.8 * fear, 10, fear > 0.5 ? C.red : C.green);
                text(ctx, 'felt risk', w * 0.5, h * 0.92, 9, C.dim, 600, 'center');
                text(ctx, 'actual', w * 0.1 + w * 0.8 * 0.2, h * 0.7, 8, C.dim, 600, 'center'); line(ctx, w * 0.1 + w * 0.8 * 0.2, h * 0.74, w * 0.1 + w * 0.8 * 0.2, h * 0.9, C.dim, 1);
            }
        };
    });

    // A lens sweeps a scatter and only the agreeing points light up.
    def('confirmation-bias-is-the-mother-bias', function (w, h, rnd) {
        var pts = [], t = 0; for (var i = 0; i < 60; i++) pts.push([w * (0.08 + rnd() * 0.84), h * (0.12 + rnd() * 0.7)]);
        return {
            step: function () { t++; },
            draw: function (ctx) {
                var lx = w * 0.5 + Math.sin(t / 50) * w * 0.3, ly = h * 0.45 + Math.cos(t / 70) * h * 0.2;
                line(ctx, w * 0.08, h * 0.7, w * 0.92, h * 0.2, C.b, 1.5);
                pts.forEach(function (p) { var near = Math.hypot(p[0] - lx, p[1] - ly) < 48; var above = p[1] < h * 0.7 - (p[0] - w * 0.08) / (w * 0.84) * h * 0.5 + 12 && p[1] > h * 0.7 - (p[0] - w * 0.08) / (w * 0.84) * h * 0.5 - 12; dot(ctx, p[0], p[1], near && above ? 3.5 : 2, near ? (above ? C.b : 'rgba(255,255,255,0.12)') : 'rgba(255,255,255,0.35)'); });
                ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(lx, ly, 48, 0, TAU); ctx.stroke();
                text(ctx, 'confidence ' + Math.min(99, 60 + ((t / 8) % 40) | 0) + '%', w * 0.5, h * 0.92, 9, C.dim, 600, 'center');
            }
        };
    });

    // The tolerant circle holds only while it pushes back.
    def('the-paradox-of-tolerance', function (w, h, rnd) {
        var t = 0, intr = [], r = h * 0.3;
        for (var i = 0; i < 8; i++) intr.push({ a: rnd() * TAU, d: h * 0.55 });
        return {
            step: function () { t++; intr.forEach(function (o) { o.d -= 0.5; if (o.d < r + 6) { o.d = r + 6; } }); if (t % 200 > 120) { intr.forEach(function (o) { if (o.d < r + 30) o.d += 3; }); } },
            draw: function (ctx) {
                var cx = w / 2, cy = h / 2;
                ctx.strokeStyle = t % 200 > 120 ? C.b : C.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke();
                for (var i = 0; i < 12; i++) dot(ctx, cx + Math.cos(i / 12 * TAU) * r * 0.55, cy + Math.sin(i / 12 * TAU) * r * 0.55, 3, 'rgba(255,255,255,0.6)');
                intr.forEach(function (o) { dot(ctx, cx + Math.cos(o.a) * o.d, cy + Math.sin(o.a) * o.d, 5, C.red); });
                text(ctx, t % 200 > 120 ? 'the circle pushes back' : 'the circle is patient', w / 2, h * 0.93, 9, C.dim, 600, 'center');
            }
        };
    });

    // A galaxy of stars, a pulse sent out, and nothing comes back.
    def('the-fermi-paradox-and-the-great-silence', function (w, h, rnd) {
        var stars = [], t = 0; for (var i = 0; i < 140; i++) stars.push([rnd() * w, rnd() * h, 0.5 + rnd() * 1.4]);
        return {
            step: function () { t = (t + 1) % 260; },
            draw: function (ctx) {
                stars.forEach(function (s) { dot(ctx, s[0], s[1], s[2], 'rgba(255,255,255,' + (0.3 + 0.5 * Math.abs(Math.sin(t / 40 + s[0]))).toFixed(2) + ')'); });
                var r = t * 2.2; ctx.strokeStyle = 'rgba(255,232,158,' + Math.max(0, 1 - t / 220).toFixed(2) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(w * 0.5, h * 0.5, r, 0, TAU); ctx.stroke();
                dot(ctx, w * 0.5, h * 0.5, 3, C.b);
                if (t > 200) text(ctx, '...', w * 0.5, h * 0.5 - 16, 14, C.dim, 700, 'center');
            }
        };
    });

    // A dam holds. Nothing happens. A counter of nothing-happening climbs.
    def('prevention-of-failure-is-unseen', function (w, h, rnd) {
        var t = 0, level = 0.7;
        return {
            step: function () { t++; level = 0.68 + Math.sin(t / 40) * 0.04; },
            draw: function (ctx) {
                ctx.fillStyle = 'rgba(143,180,230,0.5)'; ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(0, h * (1 - level)); for (var x = 0; x <= w * 0.5; x += 5) ctx.lineTo(x, h * (1 - level) + Math.sin(x / 14 + t / 8) * 2); ctx.lineTo(w * 0.5, h); ctx.closePath(); ctx.fill();
                rect(ctx, w * 0.5, h * 0.2, w * 0.08, h * 0.8, C.ink);
                for (var i = 0; i < 3; i++) rect(ctx, w * 0.66 + i * w * 0.1, h * 0.72, w * 0.06, h * 0.28, 'rgba(255,255,255,0.35)');
                text(ctx, 'disasters: 0', w * 0.78, h * 0.3, 10, C.ink, 700, 'center');
                text(ctx, 'days quiet: ' + (3650 + (t / 30 | 0)), w * 0.78, h * 0.45, 9, C.dim, 600, 'center');
            }
        };
    });

    // A factory's stack against one person's tote bag, to scale.
    def('individualization-of-responsibility', function (w, h, rnd) {
        var puffs = [], t = 0;
        return {
            step: function () { t++; if (t % 6 === 0) puffs.push({ x: w * 0.24, y: h * 0.28, r: 4, a: 0.6 }); puffs.forEach(function (p) { p.y -= 0.8; p.x += 0.6; p.r += 0.25; p.a -= 0.01; }); puffs = puffs.filter(function (p) { return p.a > 0; }); },
            draw: function (ctx) {
                rect(ctx, w * 0.08, h * 0.5, w * 0.3, h * 0.5, 'rgba(255,255,255,0.18)'); rect(ctx, w * 0.2, h * 0.28, w * 0.07, h * 0.24, 'rgba(255,255,255,0.25)');
                puffs.forEach(function (p) { dot(ctx, p.x, p.y, p.r, 'rgba(255,255,255,' + p.a.toFixed(2) + ')'); });
                dot(ctx, w * 0.78, h * 0.66, 5, C.ink); rect(ctx, w * 0.78 - 4, h * 0.7, 8, h * 0.18, C.ink); rect(ctx, w * 0.78 + 6, h * 0.78, 8, 10, C.b);
                rect(ctx, w * 0.55, h * 0.12, w * 0.3 * 0.71, 6, C.red); text(ctx, '71%', w * 0.9, h * 0.15, 9, C.ink, 700, 'center');
                rect(ctx, w * 0.55, h * 0.22, 2, 6, C.b); text(ctx, 'you', w * 0.62, h * 0.25, 9, C.dim, 600, 'left');
            }
        };
    });

    // Ore comes out of the ground; a battery above it fills.
    def('hidden-cost-of-cobalt-congo', function (w, h, rnd) {
        var t = 0, ore = [];
        return {
            step: function () { t++; if (t % 12 === 0) ore.push({ x: w * (0.3 + rnd() * 0.4), y: h * 0.95, p: 0 }); ore.forEach(function (o) { o.p += 0.012; }); ore = ore.filter(function (o) { return o.p < 1; }); },
            draw: function (ctx) {
                rect(ctx, 0, h * 0.6, w, h * 0.4, 'rgba(120,90,60,0.35)');
                for (var i = 0; i < 4; i++) rect(ctx, w * (0.15 + i * 0.22), h * 0.62, 3, h * 0.36, 'rgba(0,0,0,0.5)');
                ore.forEach(function (o) { var e = ease(o.p); dot(ctx, o.x + (w * 0.5 - o.x) * e, o.y + (h * 0.3 - o.y) * e, 4, '#8fb4e6'); });
                var fill = 0.4 + 0.5 * Math.abs(Math.sin(t / 90));
                ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(w * 0.35, h * 0.18, w * 0.3, h * 0.22); rect(ctx, w * 0.65, h * 0.25, 5, h * 0.08, C.ink);
                rect(ctx, w * 0.36, h * 0.19, w * 0.28 * fill, h * 0.2, fill > 0.8 ? C.green : C.b);
                text(ctx, 'Co', w * 0.5, h * 0.52, 10, C.ink, 700, 'center');
            }
        };
    });

    // A token stream against a kettle: the numbers, side by side.
    def('ethics-of-llm-use-not-llms', function (w, h, rnd) {
        var t = 0, toks = [];
        return {
            step: function () { t++; if (t % 4 === 0) toks.push({ x: w * 0.1, y: h * 0.28, w: 6 + rnd() * 14 }); toks.forEach(function (k) { k.x += 2.6; }); toks = toks.filter(function (k) { return k.x < w * 0.9; }); },
            draw: function (ctx) {
                toks.forEach(function (k) { rect(ctx, k.x, k.y - 4, k.w, 8, C.a); });
                text(ctx, 'one answer', w * 0.5, h * 0.14, 9, C.dim, 600, 'center');
                var bars = [['answer', 0.03], ['search x10', 0.08], ['kettle', 0.6], ['drive 1 km', 1]];
                bars.forEach(function (b, i) { var y = h * (0.46 + i * 0.13); rect(ctx, w * 0.36, y - 4, w * 0.56 * b[1], 8, i === 0 ? C.a : 'rgba(255,255,255,0.3)'); text(ctx, b[0], w * 0.33, y, 8, C.ink, 500, 'right'); });
            }
        };
    });

    // Code lines type, a suggestion ghosts in, and the problem is split into blocks.
    def('why-learn-to-code-age-of-ai', function (w, h, rnd) {
        var t = 0;
        return {
            step: function () { t = (t + 1) % 300; },
            draw: function (ctx) {
                var p = ease(Math.min(1, t / 120));
                rect(ctx, w * 0.1, h * 0.14, w * 0.8, h * 0.18, 'rgba(255,255,255,0.14)'); text(ctx, 'the problem', w * 0.5, h * 0.23, 10, C.ink, 700, 'center');
                for (var i = 0; i < 3; i++) { var x = w * (0.1 + i * 0.28), y = h * 0.14 + (h * 0.42 - h * 0.14) * p; rect(ctx, x, y, w * 0.24, h * 0.14, 'rgba(255,232,158,' + (0.2 + 0.4 * p).toFixed(2) + ')'); }
                for (var j = 0; j < 4; j++) rect(ctx, w * 0.12, h * (0.66 + j * 0.07), w * (0.2 + 0.25 * ((j * 5) % 3) / 2) * Math.min(1, Math.max(0, (t - 150 - j * 25) / 25)), 4, C.ink);
                if (t > 260) text(ctx, 'ghost: accept?', w * 0.72, h * 0.72, 8, C.dim, 500, 'center');
            }
        };
    });

    // A knowledge graph grows, node by node, all on one machine.
    def('second-brain-local-llm-professional', function (w, h, rnd) {
        var nodes = [[w / 2, h / 2]], edges = [], t = 0;
        return {
            step: function () { t++; if (t % 20 === 0 && nodes.length < 22) { var p = nodes[(rnd() * nodes.length) | 0], a = rnd() * TAU, d = 30 + rnd() * 40; var n = [Math.min(w - 10, Math.max(10, p[0] + Math.cos(a) * d)), Math.min(h - 10, Math.max(10, p[1] + Math.sin(a) * d))]; nodes.push(n); edges.push([p, n]); } if (t % 600 === 0) { nodes = [[w / 2, h / 2]]; edges = []; } },
            draw: function (ctx) {
                edges.forEach(function (e) { line(ctx, e[0][0], e[0][1], e[1][0], e[1][1], C.dim, 1); });
                nodes.forEach(function (n, i) { dot(ctx, n[0], n[1], i ? 3 : 6, i ? C.ink : C.b); });
                ctx.strokeStyle = C.dim; ctx.setLineDash([4, 4]); ctx.strokeRect(6, 6, w - 12, h - 12); ctx.setLineDash([]);
                text(ctx, 'local', w - 26, h - 14, 8, C.dim, 700, 'center');
            }
        };
    });

    // A population of dots huddles while a single big arrow takes the spotlight.
    def('evolutionary-computation-identity-crisis', function (w, h, rnd) {
        var pop = [], t = 0; for (var i = 0; i < 30; i++) pop.push({ x: w * (0.1 + rnd() * 0.35), y: h * (0.2 + rnd() * 0.6), vx: 0, vy: 0 });
        return {
            step: function () { t++; pop.forEach(function (p) { p.vx += (rnd() - 0.5) * 0.3; p.vy += (rnd() - 0.5) * 0.3; p.vx *= 0.9; p.vy *= 0.9; p.x = Math.min(w * 0.45, Math.max(w * 0.08, p.x + p.vx)); p.y = Math.min(h * 0.85, Math.max(h * 0.15, p.y + p.vy)); }); },
            draw: function (ctx) {
                var glow = 0.5 + 0.5 * Math.sin(t / 30);
                ctx.fillStyle = 'rgba(255,232,158,' + (0.08 + 0.1 * glow).toFixed(2) + ')'; ctx.beginPath(); ctx.moveTo(w * 0.75, 0); ctx.lineTo(w * 0.55, h); ctx.lineTo(w * 0.95, h); ctx.closePath(); ctx.fill();
                ctx.strokeStyle = C.b; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(w * 0.75, h * 0.25); ctx.lineTo(w * 0.75, h * 0.72); ctx.moveTo(w * 0.66, h * 0.62); ctx.lineTo(w * 0.75, h * 0.72); ctx.lineTo(w * 0.84, h * 0.62); ctx.stroke();
                text(ctx, 'GenAI', w * 0.75, h * 0.86, 9, C.b, 700, 'center');
                pop.forEach(function (p) { dot(ctx, p.x, p.y, 2.5, C.ink); });
                text(ctx, 'EC', w * 0.26, h * 0.93, 9, C.dim, 700, 'center');
            }
        };
    });

    /* ------------------------------------------------------- personal */

    // A staircase up; the line labelled otherwise is crossed out.
    def('my-teacher-said-i-shouldnt-go-to-university', function (w, h, rnd) {
        var t = 0;
        return {
            step: function () { t = (t + 1) % 260; },
            draw: function (ctx) {
                var steps = 7, p = Math.min(1, t / 200);
                for (var i = 0; i < steps; i++) rect(ctx, w * 0.12 + i * w * 0.11, h * 0.85 - i * h * 0.1, w * 0.11, 4, 'rgba(255,255,255,0.35)');
                var k = p * (steps - 1), x = w * 0.12 + k * w * 0.11 + w * 0.05, y = h * 0.85 - Math.floor(k) * h * 0.1 - 10;
                dot(ctx, x, y - 8, 4, C.b); rect(ctx, x - 3, y - 4, 6, 12, C.b);
                text(ctx, 'manual labour', w * 0.32, h * 0.2, 9, C.dim, 600, 'center'); line(ctx, w * 0.14, h * 0.2, w * 0.5, h * 0.2, C.red, 2);
                if (p > 0.95) text(ctx, 'PhD', w * 0.86, h * 0.2, 12, C.ink, 700, 'center');
            }
        };
    });

    // Two dots climb the mountain together; near the top one carries the other.
    def('frodo-sam-and-love', function (w, h, rnd) {
        var t = 0;
        return {
            step: function () { t = (t + 1) % 330; },
            draw: function (ctx) {
                ctx.strokeStyle = C.dim; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, h * 0.9); ctx.quadraticCurveTo(w * 0.5, h * 0.9, w * 0.82, h * 0.2); ctx.lineTo(w, h * 0.35); ctx.stroke();
                var p = Math.min(1, t / 280), x = w * 0.82 * p, y = h * 0.9 - (h * 0.7) * p * p;
                var carry = p > 0.7;
                dot(ctx, x - (carry ? 0 : 9), y - (carry ? 16 : 6), 4, C.a);
                dot(ctx, x + (carry ? 0 : 7), y - 6, 4.5, C.b);
                if (p > 0.97) dot(ctx, w * 0.84, h * 0.16, 3, C.red);
            }
        };
    });

    // A week grid gets filled; the score under it keeps falling.
    def('optimizing-your-schedule', function (w, h, rnd) {
        var cells = [], t = 0, score = 40; for (var i = 0; i < 35; i++) cells.push(rnd() < 0.5 ? (1 + (rnd() * 3 | 0)) : 0);
        return {
            step: function () { t++; if (t % 6 === 0) { var a = (rnd() * 35) | 0, b = (rnd() * 35) | 0; var tmp = cells[a]; cells[a] = cells[b]; cells[b] = tmp; score = Math.max(3, score - (rnd() < 0.7 ? 1 : 0)); } if (t % 500 === 0) score = 40; },
            draw: function (ctx) {
                var cw = w * 0.8 / 7, ch = h * 0.55 / 5;
                cells.forEach(function (c, i) { rect(ctx, w * 0.1 + (i % 7) * cw + 1, h * 0.14 + Math.floor(i / 7) * ch + 1, cw - 2, ch - 2, c === 0 ? 'rgba(255,255,255,0.08)' : [0, C.b, C.blue, C.green][c]); });
                text(ctx, 'conflicts: ' + score, w * 0.5, h * 0.86, 10, score < 6 ? C.green : C.ink, 700, 'center');
            }
        };
    });

    // An energy bar drains and refills across a day of blocks.
    def('optimizing-your-schedule-ii', function (w, h, rnd) {
        var blocks = [[0.05, 0.2, -0.4, 'deep work'], [0.28, 0.1, 0.3, 'walk'], [0.42, 0.22, -0.5, 'meetings'], [0.68, 0.1, 0.5, 'nap'], [0.8, 0.15, -0.2, 'admin']], t = 0;
        return {
            step: function () { t = (t + 1) % 320; },
            draw: function (ctx) {
                var p = t / 300, energy = 0.9;
                blocks.forEach(function (b) { var done = Math.min(1, Math.max(0, (p - b[0]) / b[1])); energy += b[2] * done; rect(ctx, w * (0.05 + b[0] * 0.9), h * 0.3, w * b[1] * 0.9 - 2, h * 0.16, b[2] < 0 ? 'rgba(255,150,150,0.5)' : 'rgba(125,211,165,0.5)'); text(ctx, b[3], w * (0.05 + (b[0] + b[1] / 2) * 0.9), h * 0.38, 7, C.ink, 600, 'center'); });
                energy = Math.max(0.05, Math.min(1, energy));
                line(ctx, w * (0.05 + Math.min(1, p) * 0.9), h * 0.26, w * (0.05 + Math.min(1, p) * 0.9), h * 0.5, C.b, 2);
                rect(ctx, w * 0.1, h * 0.7, w * 0.8, 10, 'rgba(255,255,255,0.12)'); rect(ctx, w * 0.1, h * 0.7, w * 0.8 * energy, 10, energy < 0.3 ? C.red : C.green);
                text(ctx, 'energy', w * 0.5, h * 0.88, 9, C.dim, 600, 'center');
            }
        };
    });

    // A golden record drifts out among the stars, leaving a fading trail.
    def('what-we-leave-behind', function (w, h, rnd) {
        var stars = [], t = 0; for (var i = 0; i < 70; i++) stars.push([rnd() * w, rnd() * h, 0.5 + rnd()]);
        return {
            step: function () { t = (t + 1) % 400; },
            draw: function (ctx) {
                stars.forEach(function (s) { dot(ctx, s[0], s[1], s[2], 'rgba(255,255,255,0.45)'); });
                var x = w * 0.1 + (w * 0.8) * (t / 400), y = h * 0.55 - Math.sin(t / 400 * 3.14) * h * 0.2;
                for (var k = 1; k < 30; k++) { var tx = x - k * 3.5; if (tx > 0) dot(ctx, tx, y + Math.sin(k / 3) * 1.5, 1.2, 'rgba(255,232,158,' + (0.5 - k / 60).toFixed(2) + ')'); }
                ctx.save(); ctx.translate(x, y); ctx.rotate(t / 20); dot(ctx, 0, 0, 12, C.b); dot(ctx, 0, 0, 3, '#1a1a1a'); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; for (var r = 5; r < 12; r += 2) { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke(); } ctx.restore();
            }
        };
    });

    // An hourglass runs while a list of "one day" items either get a date or fade.
    def('what-was-i-made-for', function (w, h, rnd) {
        var items = ['learn piano', 'write the book', 'run a marathon', 'see Japan', 'plant a garden'], t = 0, fate = [1, 0, 1, 1, 0];
        return {
            step: function () { t = (t + 1) % 340; },
            draw: function (ctx) {
                var p = t / 340;
                ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(w * 0.12, h * 0.2); ctx.lineTo(w * 0.28, h * 0.2); ctx.lineTo(w * 0.15, h * 0.5); ctx.lineTo(w * 0.28, h * 0.8); ctx.lineTo(w * 0.12, h * 0.8); ctx.lineTo(w * 0.25, h * 0.5); ctx.closePath(); ctx.stroke();
                rect(ctx, w * 0.155, h * 0.5 - h * 0.28 * (1 - p), w * 0.09, h * 0.28 * (1 - p), C.b);
                rect(ctx, w * 0.14, h * 0.8 - h * 0.26 * p, w * 0.12, h * 0.26 * p, C.b);
                items.forEach(function (it, i) { var y = h * (0.18 + i * 0.16), reached = p > 0.15 + i * 0.16; var fade = reached && !fate[i]; ctx.globalAlpha = fade ? Math.max(0.15, 1 - (p - 0.15 - i * 0.16) * 4) : 1; text(ctx, it, w * 0.4, y, 10, reached && fate[i] ? C.ink : C.dim, reached && fate[i] ? 700 : 500); if (reached && fate[i]) text(ctx, 'Sat 10am', w * 0.92, y, 8, C.green, 700, 'right'); ctx.globalAlpha = 1; });
            }
        };
    });

    // A chopper comes in over the tents, rotor turning.
    def('mash-modern-perspective', function (w, h, rnd) {
        var t = 0;
        return {
            step: function () { t = (t + 1) % 360; },
            draw: function (ctx) {
                for (var i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(125,211,165,0.45)'; ctx.beginPath(); ctx.moveTo(w * (0.08 + i * 0.24), h * 0.88); ctx.lineTo(w * (0.18 + i * 0.24), h * 0.66); ctx.lineTo(w * (0.28 + i * 0.24), h * 0.88); ctx.closePath(); ctx.fill(); }
                text(ctx, '4077', w * 0.5, h * 0.95, 9, C.dim, 700, 'center');
                var p = ease(Math.min(1, t / 240)), x = w * 0.1 + w * 0.5 * p, y = h * 0.1 + h * 0.42 * p;
                rect(ctx, x - 14, y, 28, 10, C.ink); rect(ctx, x + 12, y + 2, 22, 3, C.ink); rect(ctx, x - 8, y - 6, 3, 6, C.ink);
                ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); var a = t * 0.9; ctx.moveTo(x + Math.cos(a) * 26, y - 6 + Math.sin(a) * 3); ctx.lineTo(x - Math.cos(a) * 26, y - 6 - Math.sin(a) * 3); ctx.stroke();
                if (t > 250) rect(ctx, x - 22, y + 12, 44, 2, C.red);
            }
        };
    });

    // An Orbital turns slowly while a Mind's ship slides past.
    def('the-culture-series', function (w, h, rnd) {
        var t = 0;
        return {
            step: function () { t++; },
            draw: function (ctx) {
                var cx = w * 0.5, cy = h * 0.5;
                ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.35); ctx.rotate(t / 200);
                ctx.strokeStyle = C.b; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, h * 0.42, 0, TAU); ctx.stroke();
                ctx.strokeStyle = 'rgba(125,211,165,0.8)'; ctx.lineWidth = 2; for (var i = 0; i < 8; i++) { ctx.beginPath(); ctx.arc(0, 0, h * 0.42, i / 8 * TAU, i / 8 * TAU + 0.35); ctx.stroke(); }
                ctx.restore();
                var sx = (t * 1.3) % (w + 60) - 30; rect(ctx, sx, h * 0.18, 34, 5, C.ink); text(ctx, 'GSV', sx + 17, h * 0.1, 7, C.dim, 700, 'center');
            }
        };
    });

    // Fifty notes travel back along a timeline to a younger dot.
    def('advice-to-my-younger-self', function (w, h, rnd) {
        var notes = [], t = 0;
        return {
            step: function () { t++; if (t % 16 === 0) notes.push({ p: 0, y: h * (0.25 + rnd() * 0.3) }); notes.forEach(function (n) { n.p += 0.012; }); notes = notes.filter(function (n) { return n.p < 1; }); },
            draw: function (ctx) {
                line(ctx, w * 0.1, h * 0.75, w * 0.9, h * 0.75, C.dim, 2);
                dot(ctx, w * 0.12, h * 0.75, 5, C.a); text(ctx, '18', w * 0.12, h * 0.88, 9, C.dim, 600, 'center');
                dot(ctx, w * 0.88, h * 0.75, 7, C.b); text(ctx, 'now', w * 0.88, h * 0.88, 9, C.dim, 600, 'center');
                notes.forEach(function (n) { var e = ease(n.p), x = w * 0.88 - (w * 0.76) * e, y = n.y - Math.sin(e * 3.14) * 10; rect(ctx, x - 8, y - 5, 16, 10, 'rgba(255,255,255,0.8)'); });
                text(ctx, Math.min(50, (t / 16) | 0) + ' / 50', w * 0.5, h * 0.12, 10, C.ink, 700, 'center');
            }
        };
    });

    // A stack of thirteen books; one at a time flies to the friend it suits.
    def('books-i-recommend-to-friends', function (w, h, rnd) {
        var t = 0, flights = [], friends = 4;
        return {
            step: function () { t++; if (t % 40 === 0) flights.push({ k: (rnd() * friends) | 0, p: 0, c: rnd() < 0.5 ? C.a : C.b }); flights.forEach(function (f) { f.p += 0.03; }); flights = flights.filter(function (f) { return f.p < 1; }); },
            draw: function (ctx) {
                for (var i = 0; i < 13; i++) rect(ctx, w * 0.12, h * 0.86 - i * 6, w * 0.16 - (i % 3) * 6, 5, i % 2 ? C.a : C.b);
                for (var f = 0; f < friends; f++) { var fx = w * (0.5 + f * 0.14); dot(ctx, fx, h * 0.5, 6, C.ink); rect(ctx, fx - 4, h * 0.54, 8, 14, C.ink); }
                flights.forEach(function (fl) { var e = ease(fl.p), fx = w * (0.5 + fl.k * 0.14); var x = w * 0.2 + (fx - w * 0.2) * e, y = h * 0.8 - Math.sin(e * 3.14) * h * 0.4 - (h * 0.8 - h * 0.62) * e; rect(ctx, x - 7, y - 4, 14, 8, fl.c); });
            }
        };
    });

    // A cursor writes, deletes, writes; the word count climbs anyway.
    def('how-to-write-a-blog', function (w, h, rnd) {
        var t = 0, lines = [], cur = 0;
        return {
            step: function () { t++; if (rnd() < 0.08) cur = Math.max(0, cur - 8); else cur += 1.4; if (cur > w * 0.7) { lines.push(cur); cur = 0; if (lines.length > 6) lines.shift(); } },
            draw: function (ctx) {
                lines.forEach(function (l, i) { rect(ctx, w * 0.12, h * (0.16 + i * 0.1), l, 3, 'rgba(255,255,255,0.55)'); });
                var y = h * (0.16 + lines.length * 0.1);
                rect(ctx, w * 0.12, y, cur, 3, C.ink); if (t % 40 < 20) rect(ctx, w * 0.12 + cur + 2, y - 6, 2, 14, C.b);
                text(ctx, (Math.round((lines.reduce(function (a, b) { return a + b; }, 0) + cur) / 3) + t / 5 | 0) + ' words', w * 0.85, h * 0.92, 9, C.dim, 600, 'right');
            }
        };
    });

    // The Atlantic crossed, a dot from Stirling to Lansing, and the snow arrives.
    def('from-scotland-to-michigan', function (w, h, rnd) {
        var t = 0, flakes = []; for (var i = 0; i < 30; i++) flakes.push([rnd() * w, rnd() * h, 0.3 + rnd() * 0.7]);
        return {
            step: function () { t = (t + 1) % 400; flakes.forEach(function (f) { f[1] += f[2]; f[0] += Math.sin(t / 20 + f[1]) * 0.3; if (f[1] > h) f[1] = -4; }); },
            draw: function (ctx) {
                var p = ease(Math.min(1, t / 260));
                dot(ctx, w * 0.82, h * 0.32, 8, 'rgba(255,255,255,0.2)'); text(ctx, 'Stirling', w * 0.82, h * 0.18, 8, C.dim, 600, 'center');
                dot(ctx, w * 0.2, h * 0.4, 8, 'rgba(255,255,255,0.2)'); text(ctx, 'Lansing', w * 0.2, h * 0.26, 8, C.dim, 600, 'center');
                ctx.strokeStyle = C.b; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(w * 0.82, h * 0.32); ctx.quadraticCurveTo(w * 0.5, h * 0.05, w * 0.82 + (w * 0.2 - w * 0.82) * p, h * 0.32 + (h * 0.4 - h * 0.32) * p); ctx.stroke(); ctx.setLineDash([]);
                dot(ctx, w * 0.82 + (w * 0.2 - w * 0.82) * p, h * 0.32 + (h * 0.4 - h * 0.32) * p, 4, C.a);
                if (p > 0.9) flakes.forEach(function (f) { dot(ctx, f[0], f[1], 1.5, 'rgba(255,255,255,0.8)'); });
            }
        };
    });

    /* ---------------------------------------------------- books and media */

    // A dungeon grid, a crawler and a cat, and the XP bar that will not stop filling.
    def('dungeon-crawler-carl-litrpg-dignity', function (w, h, rnd) {
        var t = 0, xp = 0, lvl = 1, px = 2, py = 2;
        return {
            step: function () { t++; if (t % 12 === 0) { px = Math.max(0, Math.min(9, px + ((rnd() * 3) | 0) - 1)); py = Math.max(0, Math.min(4, py + ((rnd() * 3) | 0) - 1)); xp += 0.09; if (xp >= 1) { xp = 0; lvl++; } } },
            draw: function (ctx) {
                var cw = w * 0.8 / 10, ch = h * 0.5 / 5;
                for (var y = 0; y < 5; y++) for (var x = 0; x < 10; x++) rect(ctx, w * 0.1 + x * cw + 1, h * 0.12 + y * ch + 1, cw - 2, ch - 2, (x + y) % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.1)');
                dot(ctx, w * 0.1 + (px + 0.5) * cw, h * 0.12 + (py + 0.5) * ch, 6, C.b);
                dot(ctx, w * 0.1 + (px + 1.2) * cw, h * 0.12 + (py + 0.6) * ch, 4, C.a);
                rect(ctx, w * 0.1, h * 0.74, w * 0.8, 8, 'rgba(255,255,255,0.12)'); rect(ctx, w * 0.1, h * 0.74, w * 0.8 * xp, 8, C.green);
                text(ctx, 'Level ' + lvl + (xp < 0.1 && lvl > 1 ? '  LEVEL UP' : ''), w * 0.5, h * 0.9, 10, xp < 0.1 && lvl > 1 ? C.b : C.ink, 700, 'center');
            }
        };
    });

    // Fifteen years of calendar pages, all blank, and a quill that hovers.
    def('fifteen-years-of-silence-rothfuss-doors-of-stone', function (w, h, rnd) {
        var t = 0;
        return {
            step: function () { t++; },
            draw: function (ctx) {
                for (var i = 0; i < 15; i++) { var x = w * 0.08 + (i % 8) * w * 0.11, y = h * (i < 8 ? 0.16 : 0.44); rect(ctx, x, y, w * 0.09, h * 0.2, 'rgba(255,255,255,0.12)'); text(ctx, 2011 + i, x + w * 0.045, y + h * 0.1, 7, C.dim, 600, 'center'); }
                var qx = w * 0.5 + Math.sin(t / 40) * w * 0.25, qy = h * 0.78 + Math.sin(t / 17) * 3;
                line(ctx, qx, qy, qx + 22, qy - 30, C.b, 2.5); dot(ctx, qx, qy, 2, C.ink);
                text(ctx, 'Book 3', w * 0.5, h * 0.93, 9, C.dim, 700, 'center');
            }
        };
    });

    // Every rating piles onto four stars; the bars say what the stars cannot.
    def('rating-systems', function (w, h, rnd) {
        var counts = [0, 0, 0, 0, 0], t = 0;
        return {
            step: function () { t++; if (t % 3 === 0) { var r = rnd(); counts[r < 0.02 ? 0 : r < 0.08 ? 1 : r < 0.3 ? 2 : r < 0.78 ? 3 : 4]++; } if (t % 700 === 0) counts = [0, 0, 0, 0, 0]; },
            draw: function (ctx) {
                var mx = Math.max.apply(null, counts) || 1;
                counts.forEach(function (c, i) { var bh = h * 0.6 * c / mx, x = w * (0.14 + i * 0.17); rect(ctx, x, h * 0.8 - bh, w * 0.12, bh, i === 3 ? C.b : 'rgba(255,255,255,0.35)'); text(ctx, '★'.repeat(i + 1), x + w * 0.06, h * 0.9, 7, C.ink, 500, 'center'); });
                text(ctx, counts.reduce(function (a, b) { return a + b; }, 0) + ' rated', w * 0.5, h * 0.1, 10, C.dim, 600, 'center');
            }
        };
    });

    // One book inflates to 300 pages; the other grows footnotes instead.
    def('self-help-books', function (w, h, rnd) {
        var t = 0;
        return {
            step: function () { t = (t + 1) % 300; },
            draw: function (ctx) {
                var p = ease(Math.min(1, t / 200));
                var th = 10 + 60 * p; rect(ctx, w * 0.2, h * 0.7 - th, w * 0.2, th, C.a); text(ctx, Math.round(20 + 280 * p) + ' pages', w * 0.3, h * 0.82, 9, C.ink, 600, 'center'); text(ctx, 'one idea', w * 0.3, h * 0.92, 8, C.dim, 500, 'center');
                rect(ctx, w * 0.6, h * 0.7 - 34, w * 0.2, 34, C.b); text(ctx, 'sources', w * 0.7, h * 0.82, 9, C.ink, 600, 'center');
                var n = (p * 14) | 0; for (var i = 0; i < n; i++) text(ctx, '[' + (i + 1) + ']', w * 0.61 + (i % 5) * 14, h * 0.7 - 34 - 8 - Math.floor(i / 5) * 10, 6, C.green, 700);
            }
        };
    });

    // A waveform reads a book aloud: the text comes through as sound.
    def('in-defense-of-audiobooks', function (w, h, rnd) {
        var t = 0;
        return {
            step: function () { t++; },
            draw: function (ctx) {
                rect(ctx, w * 0.1, h * 0.3, w * 0.18, h * 0.42, 'rgba(255,255,255,0.18)'); rect(ctx, w * 0.1, h * 0.3, 4, h * 0.42, C.b);
                for (var l = 0; l < 5; l++) rect(ctx, w * 0.14, h * (0.36 + l * 0.07), w * 0.1, 2, C.dim);
                ctx.strokeStyle = C.a; ctx.lineWidth = 2; ctx.beginPath();
                for (var x = w * 0.34; x <= w * 0.92; x += 2) { var k = (x - w * 0.34) / (w * 0.58); var env = Math.sin(k * 3.14) * (0.5 + 0.5 * Math.sin(t / 9 + k * 12)); var y = h * 0.5 + Math.sin(x / 3 + t / 2) * h * 0.22 * env; x === w * 0.34 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
                ctx.stroke();
                text(ctx, 'still reading', w * 0.63, h * 0.9, 9, C.dim, 600, 'center');
            }
        };
    });

    // Two debt piles shrink in different orders; a snowball rolls and grows.
    def('snowball-vs-avalanche', function (w, h, rnd) {
        var t = 0;
        return {
            step: function () { t = (t + 1) % 320; },
            draw: function (ctx) {
                var p = t / 300, debts = [0.3, 0.5, 0.9];
                [['snowball', [0, 1, 2]], ['avalanche', [2, 1, 0]]].forEach(function (m, k) {
                    var paid = p * 1.7, y0 = h * (0.28 + k * 0.38);
                    text(ctx, m[0], w * 0.06, y0 - 14, 8, C.dim, 700, 'left');
                    m[1].forEach(function (di, order) { var d = debts[di], left = d; var before = m[1].slice(0, order).reduce(function (a, j) { return a + debts[j]; }, 0); left = Math.max(0, Math.min(d, d - (paid - before))); rect(ctx, w * (0.06 + di * 0.24), y0, w * 0.2 * left, 10, left < d ? C.b : 'rgba(255,255,255,0.3)'); });
                });
                var bx = w * 0.12 + w * 0.7 * p; dot(ctx, bx, h * 0.5 - 6 - 8 * p, 4 + 8 * p, 'rgba(255,255,255,0.85)');
            }
        };
    });

    // Project cards fill the empty portfolio, one stage at a time.
    def('no-idea-no-problem-data-science-portfolio', function (w, h, rnd) {
        var t = 0, stages = ['data', 'clean', 'model', 'chart', 'write-up'];
        return {
            step: function () { t = (t + 1) % 330; },
            draw: function (ctx) {
                for (var i = 0; i < 6; i++) { var x = w * (0.08 + (i % 3) * 0.3), y = h * (0.12 + Math.floor(i / 3) * 0.4), on = t > 30 + i * 45; rect(ctx, x, y, w * 0.26, h * 0.32, on ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'); if (on) { rect(ctx, x + 6, y + 8, w * 0.14, 4, C.b); for (var s = 0; s < 3; s++) rect(ctx, x + 6 + s * 12, y + h * 0.2, 8, 8, C.a); } }
                text(ctx, stages[Math.min(4, (t / 66) | 0)], w * 0.5, h * 0.94, 9, C.dim, 700, 'center');
            }
        };
    });
}());
