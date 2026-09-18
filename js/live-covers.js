/**
 * live-covers.js — cards for interactive posts run a miniature of their
 * own demo when hovered.
 *
 * On the blog listing, the series index and the series pages, a card for
 * a post with a live demo gets a canvas laid over its cover on mouseenter
 * (or keyboard focus). What runs in it is a compact version of that
 * post's demo, keyed by slug: the ant colony post shows ants laying
 * pheromone, the tabu post shows queens on a board, the roster post shows
 * a roster being ruined and rebuilt. The posts keep their real engines
 * inline in their own source, which is the point of those posts; these
 * are sketches in the same spirit, each a few dozen lines, sharing the
 * site's colours. Everything stops and is removed on leave.
 *
 * Touch devices have no hover, and reduced-motion readers asked for
 * stillness; both get the static cover.
 */
(function () {
    'use strict';

    var C = { a: '#ff9696', b: '#ffe89e', ink: 'rgba(255,255,255,0.85)', dim: 'rgba(255,255,255,0.32)',
              red: '#fc6060', green: '#7dd3a5', blue: '#8fb4e6', veil: 'rgba(14,14,14,0.66)' };

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
    function dot(ctx, x, y, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); }

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

    /* ---------------------------------------------------------- the demos */
    var KINDS = {};

    KINDS['ant-colony-live'] = function (w, h, rnd) {
        var n = 12, nodes = [[w * 0.06, h * 0.5]];
        for (var i = 1; i < n - 1; i++) nodes.push([w * (0.15 + 0.7 * rnd()), h * (0.12 + 0.76 * rnd())]);
        nodes.push([w * 0.94, h * 0.5]);
        var edges = [], tau = {};
        for (var a = 0; a < n; a++) for (var b = a + 1; b < n; b++) {
            var d = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1]);
            if (d < w * 0.34) { edges.push([a, b, d]); tau[a + '-' + b] = 0.2; }
        }
        function adj(i) { return edges.filter(function (e) { return e[0] === i || e[1] === i; }); }
        var ants = [];
        for (var k = 0; k < 14; k++) ants.push({ at: 0, to: null, t: 0, fwd: true, path: [] });
        function key(a, b) { return a < b ? a + '-' + b : b + '-' + a; }
        return {
            step: function () {
                ants.forEach(function (ant) {
                    if (ant.to === null) {
                        var opts = adj(ant.at), sum = 0, ws = [];
                        opts.forEach(function (e) { var o = e[0] === ant.at ? e[1] : e[0];
                            var bias = ant.fwd ? (nodes[o][0] - nodes[ant.at][0]) / w + 0.5 : (nodes[ant.at][0] - nodes[o][0]) / w + 0.5;
                            var wgt = Math.pow(tau[key(ant.at, o)], 1.5) * Math.max(0.05, bias) / e[2]; ws.push([o, wgt]); sum += wgt; });
                        var r = rnd() * sum, pick = ws[ws.length - 1][0];
                        for (var i = 0; i < ws.length; i++) { r -= ws[i][1]; if (r <= 0) { pick = ws[i][0]; break; } }
                        ant.to = pick; ant.t = 0;
                    } else {
                        ant.t += 0.05;
                        if (ant.t >= 1) {
                            tau[key(ant.at, ant.to)] += 0.06;
                            ant.at = ant.to; ant.to = null;
                            if (ant.at === n - 1) ant.fwd = false; else if (ant.at === 0) ant.fwd = true;
                        }
                    }
                });
                Object.keys(tau).forEach(function (k) { tau[k] = Math.max(0.05, tau[k] * 0.992); });
            },
            draw: function (ctx) {
                edges.forEach(function (e) {
                    var t = Math.min(1, tau[key(e[0], e[1])]);
                    ctx.strokeStyle = 'rgba(255,232,158,' + (0.08 + 0.8 * t).toFixed(3) + ')';
                    ctx.lineWidth = 0.6 + 2.4 * t; ctx.beginPath();
                    ctx.moveTo(nodes[e[0]][0], nodes[e[0]][1]); ctx.lineTo(nodes[e[1]][0], nodes[e[1]][1]); ctx.stroke();
                });
                nodes.forEach(function (p, i) { dot(ctx, p[0], p[1], i === 0 || i === n - 1 ? 5 : 2.5, i === 0 ? C.green : i === n - 1 ? C.red : C.ink); });
                ants.forEach(function (ant) {
                    var p = nodes[ant.at], q = ant.to === null ? p : nodes[ant.to];
                    dot(ctx, p[0] + (q[0] - p[0]) * ant.t, p[1] + (q[1] - p[1]) * ant.t, 2, C.a);
                });
            }
        };
    };

    KINDS['cma-es-live'] = function (w, h, rnd) {
        var L = makeLandscape(rnd), bg = L.shade(w, h);
        var m = [0.12 + rnd() * 0.2, 0.15 + rnd() * 0.7], sig = 0.22, ang = rnd() * 3.14, ratio = 1, samples = [], gen = 0;
        function sample() {
            samples = [];
            for (var i = 0; i < 24; i++) {
                var u = (rnd() + rnd() + rnd() - 1.5) * 1.6, v = (rnd() + rnd() + rnd() - 1.5) * 1.6 * ratio;
                var x = m[0] + sig * (u * Math.cos(ang) - v * Math.sin(ang)), y = m[1] + sig * (u * Math.sin(ang) + v * Math.cos(ang));
                samples.push([x, y, L.f(x, y)]);
            }
            samples.sort(function (a, b) { return a[2] - b[2]; });
        }
        sample();
        return {
            step: function () {
                gen++;
                if (gen % 6) return;
                var best = samples.slice(0, 8), mx = 0, my = 0;
                best.forEach(function (s) { mx += s[0]; my += s[1]; });
                mx /= best.length; my /= best.length;
                var dx = mx - m[0], dy = my - m[1];
                m = [m[0] + dx * 0.9, m[1] + dy * 0.9];
                ang = Math.atan2(dy, dx);
                ratio = Math.max(0.35, ratio * 0.97);
                sig = Math.max(0.025, sig * 0.93);
                if (sig <= 0.026 && rnd() < 0.05) { sig = 0.22; ratio = 1; m = [0.12 + rnd() * 0.2, 0.15 + rnd() * 0.7]; }
                sample();
            },
            draw: function (ctx) {
                ctx.drawImage(bg, 0, 0);
                ctx.save(); ctx.translate(m[0] * w, m[1] * h); ctx.rotate(ang);
                ctx.strokeStyle = C.b; ctx.lineWidth = 1.4; ctx.beginPath();
                ctx.ellipse(0, 0, sig * w * 1.6, sig * w * 1.6 * ratio, 0, 0, 6.2832); ctx.stroke();
                ctx.restore();
                samples.forEach(function (s, i) { dot(ctx, s[0] * w, s[1] * h, 2, i < 8 ? C.ink : C.blue); });
                dot(ctx, L.opt[0] * w, L.opt[1] * h, 3, C.red);
            }
        };
    };

    KINDS['differential-evolution-live'] = function (w, h, rnd) {
        var L = makeLandscape(rnd), bg = L.shade(w, h), pop = [], vec = null;
        for (var i = 0; i < 22; i++) { var x = rnd(), y = rnd(); pop.push([x, y, L.f(x, y)]); }
        return {
            step: function () {
                for (var k = 0; k < 2; k++) {
                    var i = (rnd() * pop.length) | 0, a = pop[(rnd() * pop.length) | 0], b = pop[(rnd() * pop.length) | 0], c = pop[(rnd() * pop.length) | 0];
                    var tx = a[0] + 0.7 * (b[0] - c[0]), ty = a[1] + 0.7 * (b[1] - c[1]);
                    tx = Math.min(1, Math.max(0, tx)); ty = Math.min(1, Math.max(0, ty));
                    var tf = L.f(tx, ty);
                    vec = [b, c, [tx, ty]];
                    if (tf < pop[i][2]) pop[i] = [tx, ty, tf];
                }
                if (rnd() < 0.004) for (var j = 0; j < pop.length; j++) { var x = rnd(), y = rnd(); pop[j] = [x, y, L.f(x, y)]; }
            },
            draw: function (ctx) {
                ctx.drawImage(bg, 0, 0);
                if (vec) { ctx.strokeStyle = C.dim; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(vec[0][0] * w, vec[0][1] * h); ctx.lineTo(vec[1][0] * w, vec[1][1] * h); ctx.stroke(); dot(ctx, vec[2][0] * w, vec[2][1] * h, 2.5, C.b); }
                pop.forEach(function (p) { dot(ctx, p[0] * w, p[1] * h, 2.4, C.ink); });
                dot(ctx, L.opt[0] * w, L.opt[1] * h, 3, C.red);
            }
        };
    };

    KINDS['evolution-live'] = function (w, h, rnd) {
        var FW = 40, FH = 40, fitC = document.createElement('canvas'); fitC.width = FW; fitC.height = FH;
        var fit = fitC.getContext('2d', { willReadFrequently: true });
        fit.fillStyle = '#000'; fit.fillRect(0, 0, FW, FH); fit.fillStyle = '#fff'; fit.font = '700 36px Poppins, sans-serif';
        fit.textAlign = 'center'; fit.textBaseline = 'middle'; fit.fillText('K', FW / 2, FH / 2 + 2);
        var td = fit.getImageData(0, 0, FW, FH).data, target = [];
        for (var i = 0; i < td.length; i += 4) target.push(td[i] / 255);
        function shape() { var cx = rnd(), cy = rnd(), s = 0.05 + rnd() * 0.25;
            return { x: [cx + (rnd() - 0.5) * s, cx + (rnd() - 0.5) * s, cx + (rnd() - 0.5) * s], y: [cy + (rnd() - 0.5) * s, cy + (rnd() - 0.5) * s, cy + (rnd() - 0.5) * s], a: 0.1 + rnd() * 0.4 }; }
        var genome = []; for (var g = 0; g < 26; g++) genome.push(shape());
        function paint(gn, ctx, W, H, fill) {
            ctx.clearRect(0, 0, W, H);
            gn.forEach(function (s) { ctx.fillStyle = fill(s.a); ctx.beginPath(); ctx.moveTo(s.x[0] * W, s.y[0] * H); ctx.lineTo(s.x[1] * W, s.y[1] * H); ctx.lineTo(s.x[2] * W, s.y[2] * H); ctx.closePath(); ctx.fill(); });
        }
        function score(gn) {
            paint(gn, fit, FW, FH, function (a) { return 'rgba(255,255,255,' + a + ')'; });
            var d = fit.getImageData(0, 0, FW, FH).data, e = 0;
            for (var i = 0, p = 0; i < d.length; i += 4, p++) { var v = d[i] / 255 * d[i + 3] / 255 - target[p]; e += v * v; }
            return e;
        }
        var best = score(genome), stalled = 0;
        return {
            step: function () {
                for (var k = 0; k < 14; k++) {
                    var cand = genome.map(function (s) { return { x: s.x.slice(), y: s.y.slice(), a: s.a }; });
                    var s = cand[(rnd() * cand.length) | 0], v = (rnd() * 3) | 0;
                    if (rnd() < 0.7) { s.x[v] += (rnd() - 0.5) * 0.12; s.y[v] += (rnd() - 0.5) * 0.12; } else s.a = Math.min(0.8, Math.max(0.05, s.a + (rnd() - 0.5) * 0.15));
                    var sc = score(cand);
                    if (sc < best) { best = sc; genome = cand; stalled = 0; } else stalled++;
                }
                if (stalled > 1500) { genome = []; for (var g = 0; g < 26; g++) genome.push(shape()); best = score(genome); stalled = 0; }
            },
            draw: function (ctx) {
                var side = Math.min(w, h) * 0.86, ox = (w - side) / 2, oy = (h - side) / 2;
                ctx.save(); ctx.translate(ox, oy);
                paint(genome, ctx, side, side, function (a) { return 'rgba(255,200,160,' + a + ')'; });
                ctx.restore();
            }
        };
    };

    KINDS['factorio-live'] = function (w, h, rnd) {
        var cols = 22, rows = Math.max(8, Math.round(cols * h / w)), cw = w / cols, ch = h / rows;
        var start = [0, (rows / 2) | 0], goal = [cols - 1, (rows / 2) | 0], walls = {};
        for (var i = 0; i < cols * rows * 0.14; i++) { var x = 2 + ((rnd() * (cols - 4)) | 0), y = (rnd() * rows) | 0; walls[x + ',' + y] = 1; }
        // three walls across the middle row so the straight run is never open
        [5, 11, 17].forEach(function (x) { walls[x + ',' + start[1]] = 1; });
        var path = [start.slice()], done = 0, seen = {}, age = 0;
        function reset() { path = [start.slice()]; seen = {}; done = 0; age = 0; }
        return {
            step: function () {
                if (done) { if (++done > 70) reset(); return; }
                if (++age > 500) { reset(); return; }
                var c = path[path.length - 1], cands = [[1, 0], [0, 1], [0, -1], [-1, 0]].map(function (d) { return [c[0] + d[0], c[1] + d[1]]; })
                    .filter(function (p) { return p[0] >= 0 && p[0] < cols && p[1] >= 0 && p[1] < rows && !walls[p[0] + ',' + p[1]] && !seen[p[0] + ',' + p[1]]; });
                if (!cands.length) {
                    // dead end: rip up the last few belts and try another way from there
                    for (var b = 0; b < 3 && path.length > 1; b++) { var gone = path.pop(); delete seen[gone[0] + ',' + gone[1]]; }
                    seen[c[0] + ',' + c[1]] = 1;
                    return;
                }
                cands.sort(function (p, q) { return (Math.abs(p[0] - goal[0]) + Math.abs(p[1] - goal[1]) + rnd() * 2.5) - (Math.abs(q[0] - goal[0]) + Math.abs(q[1] - goal[1]) + rnd() * 2.5); });
                var n = cands[0]; seen[n[0] + ',' + n[1]] = 1; path.push(n);
                if (n[0] === goal[0] && n[1] === goal[1]) done = 1;
            },
            draw: function (ctx) {
                ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1;
                for (var x = 0; x <= cols; x++) { ctx.beginPath(); ctx.moveTo(x * cw, 0); ctx.lineTo(x * cw, h); ctx.stroke(); }
                for (var y = 0; y <= rows; y++) { ctx.beginPath(); ctx.moveTo(0, y * ch); ctx.lineTo(w, y * ch); ctx.stroke(); }
                ctx.fillStyle = 'rgba(255,255,255,0.18)';
                Object.keys(walls).forEach(function (k) { var p = k.split(','); ctx.fillRect(p[0] * cw + 1, p[1] * ch + 1, cw - 2, ch - 2); });
                // items ride the finished belt: a moving bright cell every four
                path.forEach(function (p, i) { var lit = done ? (i + (done >> 1)) % 4 === 0 : i === path.length - 1; ctx.fillStyle = lit ? C.b : 'rgba(255,232,158,0.55)'; ctx.fillRect(p[0] * cw + 2, p[1] * ch + 2, cw - 4, ch - 4); });
                ctx.fillStyle = C.green; ctx.fillRect(start[0] * cw + 1, start[1] * ch + 1, cw - 2, ch - 2);
                ctx.fillStyle = C.red; ctx.fillRect(goal[0] * cw + 1, goal[1] * ch + 1, cw - 2, ch - 2);
            }
        };
    };

    KINDS['genetic-programming-live'] = function (w, h, rnd) {
        var A = 0.6 + rnd() * 0.5, B = 1.5 + rnd() * 2, P = rnd() * 6.28, Q = (rnd() - 0.5) * 0.6;
        function target(x) { return A * Math.sin(B * x + P) + Q * x; }
        var pts = []; for (var i = 0; i < 16; i++) { var x = -3 + 6 * (i + 0.5) / 16; pts.push([x, target(x)]); }
        var cand = [rnd(), rnd() * 3, rnd() * 6, 0], best = err(cand), stalled = 0;
        function model(c, x) { return c[0] * Math.sin(c[1] * x + c[2]) + c[3] * x; }
        function err(c) { var e = 0; pts.forEach(function (p) { var d = model(c, p[0]) - p[1]; e += d * d; }); return e; }
        function X(x) { return (x + 3) / 6 * w; } function Y(y) { return h / 2 - y * h * 0.22; }
        return {
            step: function () {
                for (var k = 0; k < 6; k++) {
                    var c = cand.slice(), i = (rnd() * 4) | 0; c[i] += (rnd() - 0.5) * (stalled > 300 ? 0.08 : 0.4);
                    var e = err(c); if (e < best) { best = e; cand = c; stalled = 0; } else stalled++;
                }
                if (stalled > 1200) { cand = [rnd(), rnd() * 3, rnd() * 6, 0]; best = err(cand); stalled = 0; }
            },
            draw: function (ctx) {
                ctx.strokeStyle = C.b; ctx.lineWidth = 1.8; ctx.beginPath();
                for (var px = 0; px <= w; px += 3) { var x = -3 + 6 * px / w, y = Y(model(cand, x)); px ? ctx.lineTo(px, y) : ctx.moveTo(px, y); }
                ctx.stroke();
                pts.forEach(function (p) { dot(ctx, X(p[0]), Y(p[1]), 3, C.ink); });
            }
        };
    };

    KINDS['particle-swarm-live'] = function (w, h, rnd) {
        var L = makeLandscape(rnd), bg = L.shade(w, h), n = 40, ps = [], gb = null, gbf = Infinity, t = 0;
        for (var i = 0; i < n; i++) { var x = rnd(), y = rnd(); ps.push({ x: x, y: y, vx: 0, vy: 0, bx: x, by: y, bf: L.f(x, y) }); }
        return {
            step: function () {
                t++;
                ps.forEach(function (p) { var f = L.f(p.x, p.y); if (f < p.bf) { p.bf = f; p.bx = p.x; p.by = p.y; } if (f < gbf) { gbf = f; gb = [p.x, p.y]; } });
                ps.forEach(function (p) {
                    p.vx = 0.72 * p.vx + 0.9 * rnd() * (p.bx - p.x) * 0.06 + 1.1 * rnd() * (gb[0] - p.x) * 0.06;
                    p.vy = 0.72 * p.vy + 0.9 * rnd() * (p.by - p.y) * 0.06 + 1.1 * rnd() * (gb[1] - p.y) * 0.06;
                    p.x = Math.min(1, Math.max(0, p.x + p.vx)); p.y = Math.min(1, Math.max(0, p.y + p.vy));
                });
                if (t % 900 === 0) { gbf = Infinity; ps.forEach(function (p) { p.x = rnd(); p.y = rnd(); p.vx = p.vy = 0; p.bf = Infinity; }); }
            },
            draw: function (ctx) {
                ctx.drawImage(bg, 0, 0);
                ps.forEach(function (p) { ctx.strokeStyle = C.dim; ctx.beginPath(); ctx.moveTo(p.x * w, p.y * h); ctx.lineTo((p.x - p.vx * 4) * w, (p.y - p.vy * 4) * h); ctx.stroke(); dot(ctx, p.x * w, p.y * h, 2.2, C.ink); });
                if (gb) { ctx.strokeStyle = C.b; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(gb[0] * w, gb[1] * h, 7, 0, 6.2832); ctx.stroke(); }
                dot(ctx, L.opt[0] * w, L.opt[1] * h, 3, C.red);
            }
        };
    };

    KINDS['ruin-and-recreate-live'] = function (w, h, rnd) {
        var rows = 12, cols = 14, cw = w / cols, ch = h / rows, SHIFT = ['rgba(255,255,255,0.06)', 'rgba(143,180,230,0.55)', 'rgba(125,211,165,0.55)', 'rgba(255,232,158,0.55)'];
        var grid = [], ruin = null, phase = 0;
        for (var r = 0; r < rows; r++) { grid.push([]); for (var c = 0; c < cols; c++) grid[r].push(rnd() < 0.3 ? 0 : 1 + ((rnd() * 3) | 0)); }
        return {
            step: function () {
                phase++;
                if (phase % 22 === 1) { ruin = { r: (rnd() * (rows - 3)) | 0, c: (rnd() * (cols - 4)) | 0, rs: 2 + ((rnd() * 2) | 0), cs: 3 + ((rnd() * 3) | 0), t: 0 }; }
                if (ruin) {
                    ruin.t++;
                    if (ruin.t < 8) { for (var r = ruin.r; r < ruin.r + ruin.rs; r++) for (var c = ruin.c; c < ruin.c + ruin.cs; c++) grid[r][c] = -1; }
                    else { var rr = ruin.r + ((rnd() * ruin.rs) | 0), cc = ruin.c + ((rnd() * ruin.cs) | 0); if (grid[rr][cc] === -1) grid[rr][cc] = rnd() < 0.3 ? 0 : 1 + ((rnd() * 3) | 0);
                        var left = 0; for (var r2 = ruin.r; r2 < ruin.r + ruin.rs; r2++) for (var c2 = ruin.c; c2 < ruin.c + ruin.cs; c2++) if (grid[r2][c2] === -1) left++;
                        if (!left) ruin = null; }
                }
            },
            draw: function (ctx) {
                for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
                    var v = grid[r][c];
                    ctx.fillStyle = v === -1 ? 'rgba(252,96,96,0.28)' : SHIFT[v];
                    ctx.fillRect(c * cw + 1, r * ch + 1, cw - 2, ch - 2);
                }
                if (ruin) { ctx.strokeStyle = C.red; ctx.lineWidth = 1.5; ctx.strokeRect(ruin.c * cw + 0.5, ruin.r * ch + 0.5, ruin.cs * cw - 1, ruin.rs * ch - 1); }
            }
        };
    };

    KINDS['simulated-annealing-live'] = function (w, h, rnd) {
        var terms = []; for (var k = 0; k < 6; k++) terms.push([1 + k * 1.9, rnd() * 6.283, 0.6 / (k + 1)]);
        function land(x) { var y = 0; for (var i = 0; i < terms.length; i++) y += Math.sin(x * terms[i][0] + terms[i][1]) * terms[i][2]; return y; }
        var x = rnd() * 6.283, T = 1.2, gx = x, trail = [];
        function Y(v) { return h * 0.55 + land(v) * h * 0.28; }
        return {
            step: function () {
                for (var k = 0; k < 4; k++) {
                    var c = x + (rnd() - 0.5) * 0.8; if (c < 0) c += 6.283; if (c > 6.283) c -= 6.283;
                    var dE = land(x) - land(c);              // lower is better: a marble seeking the floor
                    if (dE > 0 || rnd() < Math.exp(dE / T)) { x = c; trail.push(x); if (trail.length > 50) trail.shift(); }
                    var g = gx + (rnd() - 0.5) * 0.3; if (g >= 0 && g <= 6.283 && land(g) < land(gx)) gx = g;   // greedy never climbs
                }
                T = Math.max(0.03, T * 0.995);
                if (T <= 0.031 && rnd() < 0.004) { T = 1.2; gx = rnd() * 6.283; }
            },
            draw: function (ctx) {
                ctx.strokeStyle = C.dim; ctx.lineWidth = 1.2; ctx.beginPath();
                for (var px = 0; px <= w; px += 2) { var yy = Y(px / w * 6.283); px ? ctx.lineTo(px, yy) : ctx.moveTo(px, yy); }
                ctx.stroke();
                trail.forEach(function (tx) { dot(ctx, tx / 6.283 * w, Y(tx), 1.5, 'rgba(255,150,150,0.35)'); });
                dot(ctx, gx / 6.283 * w, Y(gx) - 4, 4, C.blue);
                dot(ctx, x / 6.283 * w, Y(x) - 4, 4, C.b);
            }
        };
    };

    KINDS['tabu-search-live'] = function (w, h, rnd) {
        var N = 8, side = Math.min(w, h) * 0.9, sq = side / N, ox = (w - side) / 2, oy = (h - side) / 2;
        var q = []; for (var c = 0; c < N; c++) q.push((rnd() * N) | 0);
        var tabu = {}, tick = 0, moved = null;
        function conflicts(qq) { var n = 0; for (var a = 0; a < N; a++) for (var b = a + 1; b < N; b++) if (qq[a] === qq[b] || Math.abs(qq[a] - qq[b]) === b - a) n++; return n; }
        return {
            step: function () {
                tick++; if (tick % 9) return;
                var cur = conflicts(q), best = null;
                for (var c = 0; c < N; c++) for (var r = 0; r < N; r++) {
                    if (r === q[c] || tabu[c + ',' + r] > tick) continue;
                    var t = q.slice(); t[c] = r; var v = conflicts(t);
                    if (best === null || v < best[2] || (v === best[2] && rnd() < 0.3)) best = [c, r, v];
                }
                if (!best) return;
                tabu[best[0] + ',' + q[best[0]]] = tick + 45;      // the square just left is banned for a while
                q[best[0]] = best[1]; moved = [best[0], tick];
                if (cur === 0 && rnd() < 0.02) { for (var i = 0; i < N; i++) q[i] = (rnd() * N) | 0; tabu = {}; }
            },
            draw: function (ctx) {
                for (var c = 0; c < N; c++) for (var r = 0; r < N; r++) {
                    var frost = tabu[c + ',' + r] > tick ? Math.min(1, (tabu[c + ',' + r] - tick) / 45) : 0;
                    ctx.fillStyle = (c + r) % 2 ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.04)';
                    ctx.fillRect(ox + c * sq, oy + r * sq, sq, sq);
                    if (frost) { ctx.fillStyle = 'rgba(143,180,230,' + (0.35 * frost).toFixed(2) + ')'; ctx.fillRect(ox + c * sq, oy + r * sq, sq, sq); }
                }
                ctx.strokeStyle = 'rgba(252,96,96,0.7)'; ctx.lineWidth = 1;
                for (var a = 0; a < N; a++) for (var b = a + 1; b < N; b++) if (q[a] === q[b] || Math.abs(q[a] - q[b]) === b - a) {
                    ctx.beginPath(); ctx.moveTo(ox + (a + 0.5) * sq, oy + (q[a] + 0.5) * sq); ctx.lineTo(ox + (b + 0.5) * sq, oy + (q[b] + 0.5) * sq); ctx.stroke();
                }
                for (var i = 0; i < N; i++) dot(ctx, ox + (i + 0.5) * sq, oy + (q[i] + 0.5) * sq, sq * 0.3, moved && moved[0] === i && tick - moved[1] < 8 ? C.b : C.ink);
            }
        };
    };

    KINDS['variable-neighbourhood-search-live'] = function (w, h, rnd) {
        var n = 26, pts = [], order = [], hot = [], tick = 0;
        for (var i = 0; i < n; i++) { pts.push([w * (0.06 + 0.88 * rnd()), h * (0.1 + 0.8 * rnd())]); order.push(i); }
        function d(i, j) { var a = pts[order[i]], b = pts[order[j]]; return Math.hypot(a[0] - b[0], a[1] - b[1]); }
        return {
            step: function () {
                tick++;
                for (var k = 0; k < 6; k++) {
                    var i = 1 + Math.floor(rnd() * (n - 2)), j = 1 + Math.floor(rnd() * (n - 2));
                    if (i > j) { var t = i; i = j; j = t; }
                    if (j - i < 1) continue;
                    if (d(i - 1, j) + d(i, (j + 1) % n) < d(i - 1, i) + d(j, (j + 1) % n)) {
                        var seg = order.slice(i, j + 1).reverse(); for (var s = 0; s < seg.length; s++) order[i + s] = seg[s];
                        hot = [[order[i - 1], order[i]], [order[j], order[(j + 1) % n]], tick];
                    }
                }
                if (rnd() < 0.003) { var a = 1 + ((rnd() * (n - 2)) | 0), b = 1 + ((rnd() * (n - 2)) | 0); var tmp = order[a]; order[a] = order[b]; order[b] = tmp; }  // a shake: a bigger neighbourhood
            },
            draw: function (ctx) {
                ctx.strokeStyle = C.b; ctx.lineWidth = 1.5; ctx.beginPath();
                for (var i = 0; i <= n; i++) { var p = pts[order[i % n]]; i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); }
                ctx.stroke();
                if (hot.length && tick - hot[2] < 30) { ctx.strokeStyle = C.red; ctx.lineWidth = 2.5; for (var e = 0; e < 2; e++) { ctx.beginPath(); ctx.moveTo(pts[hot[e][0]][0], pts[hot[e][0]][1]); ctx.lineTo(pts[hot[e][1]][0], pts[hot[e][1]][1]); ctx.stroke(); } }
                pts.forEach(function (p) { dot(ctx, p[0], p[1], 2.2, C.ink); });
            }
        };
    };

    /* The feedback post's widget is a budget, not an algorithm: three
       checks pass one by one, a budget of attempts drains, a date arrives,
       and it starts over. */
    KINDS['leading-a-horse-to-water'] = function (w, h, rnd) {
        var t = 0, cycle = 420;
        return {
            step: function () { t = (t + 1) % cycle; },
            draw: function (ctx) {
                var pad = w * 0.12, y0 = h * 0.28, rowH = h * 0.14;
                ['Did they understand it?', 'Can they do it?', 'Do they want to?'].forEach(function (label, i) {
                    var on = t > 40 + i * 50; var y = y0 + i * rowH;
                    ctx.strokeStyle = on ? C.green : C.dim; ctx.lineWidth = 1.5; ctx.strokeRect(pad, y - 6, 12, 12);
                    if (on) { ctx.strokeStyle = C.green; ctx.beginPath(); ctx.moveTo(pad + 2, y); ctx.lineTo(pad + 5, y + 4); ctx.lineTo(pad + 10, y - 4); ctx.stroke(); }
                    ctx.fillStyle = on ? C.ink : C.dim; ctx.font = '500 ' + Math.max(9, Math.min(h * 0.075, w * 0.045)) + 'px Poppins, sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(label, pad + 22, y);
                });
                var by = h * 0.78, bw = w - pad * 2, frac = Math.max(0, 1 - Math.max(0, t - 200) / 200);
                ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fillRect(pad, by, bw, 6);
                ctx.fillStyle = frac > 0.3 ? C.b : C.red; ctx.fillRect(pad, by, bw * frac, 6);
                ctx.fillStyle = C.dim; ctx.font = '600 ' + Math.max(9, h * 0.06) + 'px Poppins, sans-serif'; ctx.fillText('BUDGET', pad, by - 10);
            }
        };
    };

    function kindFor(href) {
        var slug = (href || '').split('/').pop().replace(/\.html$/, '');
        return KINDS[slug] ? slug : null;
    }

    /* -------------------------------------------------------------- runtime */
    function canRun() {
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
        if (window.matchMedia && window.matchMedia('(hover: none)').matches) return false;
        return true;
    }

    function start(card) {
        if (card._live) return;
        var host = card.querySelector('.blog-card-img, .post-thumbnail');
        if (!host) return;
        var rect = host.getBoundingClientRect();
        if (!rect.width) return;
        var href = card.getAttribute('data-live-href') || card.getAttribute('href') || card.getAttribute('data-href') || '';
        var kind = kindFor(href);
        if (!kind) return;
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var c = document.createElement('canvas');
        c.className = 'kr-live-cover';
        c.width = Math.round(rect.width * dpr);
        c.height = Math.round(rect.height * dpr);
        c.setAttribute('aria-hidden', 'true');
        c.setAttribute('data-kind', kind);
        host.appendChild(c);
        var ctx = c.getContext('2d');
        ctx.scale(dpr, dpr);
        var algo = KINDS[kind](rect.width, rect.height, rng(hash(href)));
        var run = { raf: 0, stop: false };
        card._live = run;
        requestAnimationFrame(function frame() {
            if (run.stop) return;
            algo.step();
            ctx.clearRect(0, 0, rect.width, rect.height);
            ctx.fillStyle = C.veil;
            ctx.fillRect(0, 0, rect.width, rect.height);
            algo.draw(ctx);
            run.raf = requestAnimationFrame(frame);
        });
        requestAnimationFrame(function () { c.classList.add('is-on'); });
    }

    function stop(card) {
        var run = card._live;
        if (!run) return;
        run.stop = true;
        cancelAnimationFrame(run.raf);
        card._live = null;
        var c = card.querySelector('.kr-live-cover');
        if (c) c.remove();
    }

    /** Attach to every card inside `root` for which isLive(href, card) holds
        and a sketch exists for the post. */
    function attach(root, isLive) {
        if (!root || !canRun()) return;
        var cards = root.querySelectorAll('a.blog-card, .single-post-area[data-href]');
        Array.prototype.forEach.call(cards, function (card) {
            var href = card.getAttribute('href') || card.getAttribute('data-href') || '';
            if (!isLive(href, card)) return;
            if (!kindFor(card.getAttribute('data-live-href') || href)) return;
            card.classList.add('kr-live-card');
            card.addEventListener('mouseenter', function () { start(card); });
            card.addEventListener('mouseleave', function () { stop(card); });
            card.addEventListener('focusin', function () { start(card); });
            card.addEventListener('focusout', function () { stop(card); });
        });
    }

    window.krLiveCovers = { attach: attach, kindFor: kindFor, kinds: Object.keys(KINDS) };
}());
