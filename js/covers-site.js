/**
 * covers-site.js — hover sketches for the rest of the site.
 *
 * The same engine as the blog cards (js/live-covers.js) runs these over
 * anything carrying data-live="<key>": the homepage stat tiles and
 * Explore links, the About page's hobby cards, the publications on the
 * data science page, the book wall (by genre) and the gallery tiles'
 * globe badge. Keys are grouped by prefix; a host names
 * its sketch in markup, so adding one is an attribute, not a script.
 */
(function () {
    'use strict';
    if (!window.krLiveCovers) return;
    var H = window.krLiveCovers.helpers, def = window.krLiveCovers.define;
    var C = H.C, dot = H.dot, text = H.text, line = H.line, rect = H.rect, ease = H.ease;
    var TAU = H.TAU;

    // Lowercase letters rain down and pile into a growing heap along the bottom.
    def('stat:words', function (w, h, rnd) {
        var letters = 'abcdefghijklmnopqrstuvwxyz';
        var falling = [], settled = [], heap = 0, t = 0;
        return {
            step: function () {
                t++;
                if (t % 6 === 0) falling.push({ x: rnd() * w, y: -10, vy: 1 + rnd() * 0.6, ch: letters.charAt((rnd() * 26) | 0) });
                for (var i = falling.length - 1; i >= 0; i--) {
                    var p = falling[i];
                    p.y += p.vy;
                    if (p.y >= h - heap) {
                        settled.push({ x: p.x, y: h - heap, ch: p.ch });
                        heap += 0.9;
                        falling.splice(i, 1);
                    }
                }
                if (heap > h * 0.5) { settled = []; heap = 0; }
            },
            draw: function (ctx) {
                var fs = Math.max(8, Math.min(10, w * 0.03));
                for (var i = 0; i < settled.length; i++) text(ctx, settled[i].ch, settled[i].x, settled[i].y, fs, C.dim, 400, 'left', 'Lora, Georgia, serif');
                for (var j = 0; j < falling.length; j++) text(ctx, falling[j].ch, falling[j].x, falling[j].y, fs, C.ink, 400, 'left', 'Lora, Georgia, serif');
            },
            veil: false
        };
    });

    // A camera aperture of overlapping blades opens and closes, flashing bright at full open.
    def('stat:photos', function (w, h, rnd) {
        var n = 7, cx = w / 2, cy = h * 0.5, R = Math.min(w, h) * 0.34, t = 0;
        return {
            step: function () { t++; },
            draw: function (ctx) {
                var op = (Math.sin(t / 45) + 1) / 2;
                var base = R * (0.06 + 0.85 * op);
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                for (var i = 0; i < n; i++) {
                    var a = i * (TAU / n);
                    var a1 = a - (TAU / n) * 0.7, a2 = a + (TAU / n) * 0.7;
                    ctx.beginPath();
                    ctx.moveTo(cx + Math.cos(a) * base, cy + Math.sin(a) * base);
                    ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R);
                    ctx.lineTo(cx + Math.cos(a2) * R, cy + Math.sin(a2) * R);
                    ctx.closePath(); ctx.fill();
                }
                ctx.strokeStyle = C.dim; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke();
                if (op > 0.93) rect(ctx, 0, 0, w, h, 'rgba(255,255,255,' + (((op - 0.93) / 0.07) * 0.5).toFixed(2) + ')');
            },
            veil: false
        };
    });

    // A book seen from above turns its pages, right to left, one after another.
    def('stat:books', function (w, h, rnd) {
        var spine = w * 0.5, top = h * 0.18, bh = h * 0.64, pw = w * 0.34, t = 0, CYCLE = 70;
        return {
            step: function () { t = (t + 1) % CYCLE; },
            draw: function (ctx) {
                rect(ctx, spine - pw, top, pw, bh, 'rgba(255,255,255,0.18)');
                rect(ctx, spine, top, pw, bh, 'rgba(255,255,255,0.18)');
                line(ctx, spine, top, spine, top + bh, C.dim, 1);
                var p = t / CYCLE, sx = Math.cos(p * Math.PI);
                ctx.save();
                ctx.translate(spine, top + bh / 2);
                ctx.scale(sx, 1);
                ctx.fillStyle = 'rgba(255,232,158,' + (0.25 + 0.35 * Math.abs(Math.sin(p * Math.PI))).toFixed(2) + ')';
                ctx.fillRect(0, -bh / 2, pw, bh);
                ctx.restore();
            },
            veil: false
        };
    });

    // A 16-bar equaliser along the bottom, each bar easing toward a fresh random target.
    def('stat:scrobbles', function (w, h, rnd) {
        var n = 16, bars = [], t = 0;
        for (var i = 0; i < n; i++) bars.push({ cur: rnd() * 0.5, tgt: rnd() });
        return {
            step: function () {
                t++;
                if (t % 20 === 0) for (var i = 0; i < n; i++) bars[i].tgt = 0.15 + rnd() * 0.85;
                for (var j = 0; j < n; j++) bars[j].cur += (bars[j].tgt - bars[j].cur) * 0.12;
            },
            draw: function (ctx) {
                var gap = w * 0.015, bw = (w - gap * (n + 1)) / n;
                for (var i = 0; i < n; i++) {
                    var bh = bars[i].cur * h * 0.7;
                    var col = i % 2 === 0 ? C.b : C.a;
                    rect(ctx, gap + i * (bw + gap), h - bh, bw, bh, col);
                }
            },
            veil: false
        };
    });

    // An opening quotation mark fades in, dashes type out beside it, then a closing mark; repeats.
    def('stat:quotes', function (w, h, rnd) {
        var t = 0, CYCLE = 150, maxDash = 10;
        return {
            step: function () { t = (t + 1) % CYCLE; },
            draw: function (ctx) {
                var oa = Math.max(0, Math.min(1, t / 15));
                var fadeOut = t > CYCLE - 15 ? Math.max(0, (CYCLE - t) / 15) : 1;
                var a = oa * fadeOut;
                var fs = Math.max(20, Math.min(34, w * 0.09));
                text(ctx, '“', w * 0.14, h * 0.62, fs, 'rgba(255,232,158,' + a.toFixed(2) + ')', 700, 'left', 'Lora, Georgia, serif');
                var dashProg = Math.max(0, Math.min(1, (t - 20) / 60));
                var nd = Math.round(dashProg * maxDash);
                var dashStr = '';
                for (var i = 0; i < nd; i++) dashStr += '– ';
                text(ctx, dashStr, w * 0.14 + fs * 0.7, h * 0.6, fs * 0.35, 'rgba(255,255,255,' + (0.6 * a).toFixed(2) + ')', 400, 'left');
                var ca = Math.max(0, Math.min(1, (t - 95) / 15)) * fadeOut;
                text(ctx, '”', w * 0.14 + fs * 0.7 + nd * fs * 0.4, h * 0.62, fs, 'rgba(255,232,158,' + ca.toFixed(2) + ')', 700, 'left', 'Lora, Georgia, serif');
            },
            veil: false
        };
    });

    // Five star outlines fill left to right with gold, each sweeping in, then empty again.
    def('stat:reviews', function (w, h, rnd) {
        var t = 0, CYCLE = 220, n = 5;
        function starPath(ctx, cx, cy, r) {
            ctx.beginPath();
            for (var i = 0; i < 10; i++) {
                var rad = i % 2 === 0 ? r : r * 0.45;
                var a = -Math.PI / 2 + i * Math.PI / 5;
                var x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath();
        }
        return {
            step: function () { t = (t + 1) % CYCLE; },
            draw: function (ctx) {
                var prog;
                if (t < 150) prog = (t / 150) * n;
                else if (t < 170) prog = n;
                else prog = n * (1 - (t - 170) / 50);
                var r = Math.min(w / (n * 2.4), h * 0.32);
                var gap = w / n;
                for (var i = 0; i < n; i++) {
                    var cx = gap * (i + 0.5), cy = h * 0.55;
                    starPath(ctx, cx, cy, r);
                    ctx.strokeStyle = C.dim; ctx.lineWidth = 1; ctx.stroke();
                    var frac = Math.max(0, Math.min(1, prog - i));
                    if (frac > 0) {
                        ctx.save();
                        starPath(ctx, cx, cy, r);
                        ctx.clip();
                        ctx.fillStyle = C.b;
                        ctx.fillRect(cx - r, cy - r, 2 * r * frac, 2 * r);
                        ctx.restore();
                    }
                }
            },
            veil: false
        };
    });

    // A cursor types justified lines of dashes, occasionally backspaces a word, then the page scrolls.
    def('explore:blog', function (w, h, rnd) {
        var t = 0, marginX = w * 0.1, lineW = w * 0.8, lineH = h * 0.11, top = h * 0.12;
        var lines = [[]], deleteAt = 0;
        function segW() { return lineW * (0.06 + rnd() * 0.14); }
        return {
            step: function () {
                t++;
                if (t % 4 !== 0) return;
                var cur = lines[lines.length - 1];
                if (t === deleteAt && cur.length > 1) { cur.pop(); deleteAt = 0; return; }
                var sw = segW();
                var used = 0;
                for (var i = 0; i < cur.length; i++) used += cur[i] + lineW * 0.02;
                if (used + sw > lineW) {
                    lines.push([]);
                    if (lines.length > Math.floor((h - top) / lineH)) lines.shift();
                    if (rnd() < 0.3) deleteAt = t + 30;
                } else {
                    cur.push(sw);
                }
            },
            draw: function (ctx) {
                for (var li = 0; li < lines.length; li++) {
                    var y = top + li * lineH, x = marginX;
                    for (var si = 0; si < lines[li].length; si++) {
                        rect(ctx, x, y, lines[li][si], lineH * 0.18, C.dim);
                        x += lines[li][si] + lineW * 0.02;
                    }
                    if (li === lines.length - 1 && (t % 30) < 15) rect(ctx, x, y - lineH * 0.05, 2, lineH * 0.3, C.ink);
                }
            }
        };
    });

    // A viewfinder's focus brackets hunt, then lock gold on a spot with a shutter flash.
    def('explore:photography', function (w, h, rnd) {
        var t = 0, CYCLE = 160, cx = w * 0.5, cy = h * 0.5, tx = w * 0.5, ty = h * 0.5, flash = 0;
        function pick() { tx = w * (0.22 + rnd() * 0.56); ty = h * (0.22 + rnd() * 0.56); }
        pick();
        return {
            step: function () {
                t = (t + 1) % CYCLE;
                if (t === 0) pick();
                cx += (tx - cx) * 0.08;
                cy += (ty - cy) * 0.08;
                if (t === 120) flash = 14;
                if (flash > 0) flash--;
            },
            draw: function (ctx) {
                var locked = t > 100 && t < 140, s = Math.min(w, h) * 0.24, arm = s * 0.32;
                ctx.strokeStyle = locked ? C.b : C.ink; ctx.lineWidth = 2;
                var pts = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
                for (var i = 0; i < pts.length; i++) {
                    var dx = pts[i][0], dy = pts[i][1], x0 = cx + dx * s, y0 = cy + dy * s;
                    ctx.beginPath();
                    ctx.moveTo(x0, y0 - dy * arm); ctx.lineTo(x0, y0); ctx.lineTo(x0 - dx * arm, y0);
                    ctx.stroke();
                }
                if (locked) rect(ctx, cx - s * 0.45, cy - s * 0.45, s * 0.9, s * 0.9, 'rgba(255,232,158,0.14)');
                if (flash) rect(ctx, 0, 0, w, h, 'rgba(255,255,255,' + ((flash / 14) * 0.6).toFixed(2) + ')');
            }
        };
    });

    // Scatter points appear one by one, a regression line rotates into fit, then residuals drop.
    def('explore:data-science', function (w, h, rnd) {
        var n = 30, pts = [], t = 0, CYCLE = 260;
        var mx = w * 0.1, my = h * 0.1, pw = w * 0.8, ph = h * 0.7;
        var i, sx = 0, sy = 0, sxy = 0, sxx = 0;
        for (i = 0; i < n; i++) {
            var x = rnd();
            var y = Math.max(0, Math.min(1, 0.75 - 0.5 * x + (rnd() - 0.5) * 0.3));
            pts.push({ x: x, y: y });
        }
        for (i = 0; i < n; i++) { sx += pts[i].x; sy += pts[i].y; sxy += pts[i].x * pts[i].y; sxx += pts[i].x * pts[i].x; }
        var slope = (n * sxy - sx * sy) / (n * sxx - sx * sx), inter = (sy - slope * sx) / n;
        return {
            step: function () { t = (t + 1) % CYCLE; },
            draw: function (ctx) {
                var shown = Math.min(n, Math.floor((t / 90) * n)), k;
                for (k = 0; k < shown; k++) {
                    dot(ctx, mx + pts[k].x * pw, my + (1 - pts[k].y) * ph, 3, C.a);
                }
                if (t > 100) {
                    var lp = Math.max(0, Math.min(1, (t - 100) / 40));
                    var s2 = slope * ease(lp);
                    var y0 = my + (1 - inter) * ph, y1 = my + (1 - (inter + s2)) * ph;
                    line(ctx, mx, y0, mx + pw, y1, C.b, 2);
                    if (t > 160) {
                        var rp = Math.max(0, Math.min(1, (t - 160) / 60));
                        for (k = 0; k < n; k++) {
                            var px2 = mx + pts[k].x * pw, py2 = my + (1 - pts[k].y) * ph;
                            var lineY = my + (1 - (inter + slope * pts[k].x)) * ph;
                            line(ctx, px2, py2, px2, py2 + (lineY - py2) * rp, 'rgba(255,255,255,0.3)', 1);
                        }
                    }
                }
            }
        };
    });

    // A vinyl record spins under a tone arm, grooves turning, a note drifting up now and then.
    def('explore:hobbies', function (w, h, rnd) {
        var cx = w * 0.42, cy = h * 0.55, R = Math.min(w, h) * 0.34, t = 0, notes = [];
        return {
            step: function () {
                t++;
                if (t % 70 === 0) notes.push({ x: cx + R * 0.6, y: cy, life: 60 });
                for (var i = notes.length - 1; i >= 0; i--) { notes[i].y -= 0.6; notes[i].x += 0.15; notes[i].life--; if (notes[i].life <= 0) notes.splice(i, 1); }
            },
            draw: function (ctx) {
                var ang = (t * 0.05) % TAU;
                ctx.save(); ctx.translate(cx, cy); ctx.rotate(ang);
                ctx.strokeStyle = C.dim;
                for (var r = R * 0.35; r < R; r += R * 0.09) { ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.lineWidth = 1; ctx.stroke(); }
                dot(ctx, 0, 0, R * 0.28, C.b);
                dot(ctx, 0, 0, R * 0.04, 'rgba(20,20,20,0.8)');
                ctx.restore();
                var armX = w * 0.86, armY = h * 0.12, tipX = cx + R * 0.5, tipY = cy - R * 0.1;
                line(ctx, armX, armY, tipX, tipY, C.ink, 3);
                dot(ctx, armX, armY, 4, C.ink);
                for (var i = 0; i < notes.length; i++) text(ctx, '♪', notes[i].x, notes[i].y, 12, 'rgba(255,255,255,' + (notes[i].life / 60).toFixed(2) + ')', 400, 'left');
            }
        };
    });

    // A dot travels station to station along a six-stop line, filling each gold as it passes.
    def('explore:series', function (w, h, rnd) {
        var n = 6, t = 0, CYCLE = n * 40, stations = [];
        for (var i = 0; i < n; i++) stations.push({ x: w * (0.12 + i * (0.76 / (n - 1))), y: h * 0.5 });
        return {
            step: function () { t = (t + 1) % CYCLE; },
            draw: function (ctx) {
                for (var i = 0; i < n - 1; i++) line(ctx, stations[i].x, stations[i].y, stations[i + 1].x, stations[i + 1].y, C.dim, 3);
                var seg = Math.floor(t / 40), p = ease((t % 40) / 40);
                var a = stations[Math.min(seg, n - 1)], b = stations[Math.min(seg + 1, n - 1)];
                var dx = a.x + (b.x - a.x) * p, dy = a.y + (b.y - a.y) * p;
                for (var s = 0; s < n; s++) {
                    var passed = s <= seg;
                    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
                    dot(ctx, stations[s].x, stations[s].y, 6, passed ? C.b : 'rgba(255,255,255,0.5)');
                    ctx.beginPath(); ctx.arc(stations[s].x, stations[s].y, 6, 0, TAU); ctx.stroke();
                }
                dot(ctx, dx, dy, 5, C.a);
            }
        };
    });

    // A map pin drops onto a spot, then a second, then a dashed line joins them; repeats.
    def('explore:about', function (w, h, rnd) {
        var t = 0, CYCLE = 200;
        var p1 = { x: w * 0.28, y: h * 0.3 }, p2 = { x: w * 0.72, y: h * 0.62 };
        function pinY(dropT, target) {
            var p = Math.max(0, Math.min(1, dropT / 25));
            return -h * 0.3 + (target + h * 0.3) * ease(p);
        }
        return {
            step: function () { t = (t + 1) % CYCLE; },
            draw: function (ctx) {
                if (t > 10) {
                    var y1 = pinY(t - 10, p1.y);
                    dot(ctx, p1.x, y1, 6, C.red);
                    line(ctx, p1.x, y1 - 6, p1.x, y1 - 16, C.red, 2);
                }
                if (t > 70) {
                    var y2 = pinY(t - 70, p2.y);
                    dot(ctx, p2.x, y2, 6, C.red);
                    line(ctx, p2.x, y2 - 6, p2.x, y2 - 16, C.red, 2);
                }
                if (t > 130) {
                    var lp = Math.max(0, Math.min(1, (t - 130) / 30));
                    ctx.setLineDash([4, 4]);
                    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p1.x + (p2.x - p1.x) * lp, p1.y + (p2.y - p1.y) * lp);
                    ctx.stroke(); ctx.setLineDash([]);
                }
            }
        };
    });

    // Six guitar strings; every ~50 frames one is plucked and rings as a decaying standing wave.
    def('hobby:music', function (w, h, rnd) {
        var strings = 6, t = 0, active = 0, pluckAt = 0;
        return {
            step: function () { t++; if (t % 50 === 0) { active = (active + 1) % strings; pluckAt = t; } },
            draw: function (ctx) {
                for (var i = 0; i < strings; i++) {
                    var y = h * (0.15 + 0.7 * i / (strings - 1));
                    if (i === active) {
                        var el = t - pluckAt, env = Math.exp(-el * 0.06) * Math.sin(el * 0.6);
                        ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.beginPath();
                        var segs = 24;
                        for (var s = 0; s <= segs; s++) {
                            var x = w * 0.08 + (w * 0.84) * s / segs;
                            var yy = y + Math.sin(s / segs * Math.PI) * env * h * 0.05;
                            s ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
                        }
                        ctx.stroke();
                        if (el < 8) dot(ctx, w * 0.08, y, 3, C.b);
                    } else {
                        line(ctx, w * 0.08, y, w * 0.92, y, C.dim, 1);
                    }
                }
            }
        };
    });

    // A greeting cycles through languages, deleting and retyping letter by letter behind a blinking cursor.
    def('hobby:language', function (w, h, rnd) {
        var words = ['hello', 'hola', 'bonjour', 'hallo', 'ciao'];
        var names = ['English', 'Spanish', 'French', 'German', 'Italian'];
        var wi = 0, cur = 'hello', target = 'hola', mode = 'pause', t = 0, hold = 0;
        return {
            step: function () {
                t++;
                if (mode === 'pause') { hold++; if (hold > 40) { hold = 0; mode = cur.length ? 'delete' : 'type'; } return; }
                if (t % 6 !== 0) return;
                if (mode === 'delete') {
                    if (cur.length > 0) cur = cur.slice(0, -1);
                    else { wi = (wi + 1) % words.length; target = words[wi]; mode = 'type'; }
                } else if (mode === 'type') {
                    if (cur.length < target.length) cur = target.slice(0, cur.length + 1);
                    else mode = 'pause';
                }
            },
            draw: function (ctx) {
                var size = Math.max(14, Math.min(28, w * 0.09));
                var blink = (t % 40) < 20;
                text(ctx, cur + (blink ? '|' : ' '), w * 0.5, h * 0.45, size, C.ink, 600, 'center');
                text(ctx, names[wi], w * 0.5, h * 0.72, Math.max(8, Math.min(12, w * 0.035)), C.dim, 400, 'center');
            }
        };
    });

    // A pot on a hob: bubbles rise and pop, steam wisps drift and fade, the surface wobbles.
    def('hobby:cooking', function (w, h, rnd) {
        var t = 0, bubbles = [], steam = [];
        var potX = w * 0.3, potY = h * 0.5, potW = w * 0.4, potH = h * 0.35;
        return {
            step: function () {
                t++;
                if (t % 14 === 0) bubbles.push({ x: potX + potW * (0.2 + 0.6 * rnd()), y: potY + potH - 2, r: 1 + rnd() * 2 });
                bubbles.forEach(function (b) { b.y -= 1.2; });
                bubbles = bubbles.filter(function (b) { return b.y > potY + 4; });
                if (t % 30 === 0) steam.push({ x: potX + potW * (0.3 + 0.4 * rnd()), y: potY, age: 0 });
                steam.forEach(function (s) { s.age++; s.y -= 1; });
                steam = steam.filter(function (s) { return s.age < 60; });
            },
            draw: function (ctx) {
                var wob = Math.sin(t * 0.15) * 2;
                line(ctx, potX, potY + potH, potX + potW, potY + potH, C.dim, 2);
                line(ctx, potX, potY, potX, potY + potH, C.ink, 2);
                line(ctx, potX + potW, potY, potX + potW, potY + potH, C.ink, 2);
                line(ctx, potX - 4, potY + wob, potX + potW + 4, potY + wob, C.blue, 1.5);
                bubbles.forEach(function (b) { dot(ctx, b.x, b.y, b.r, 'rgba(255,255,255,0.5)'); });
                steam.forEach(function (s) {
                    ctx.globalAlpha = Math.max(0, 1 - s.age / 60);
                    ctx.strokeStyle = C.dim; ctx.lineWidth = 1; ctx.beginPath();
                    ctx.moveTo(s.x - 3, s.y + 10); ctx.quadraticCurveTo(s.x + 4, s.y + 5, s.x - 2, s.y);
                    ctx.stroke(); ctx.globalAlpha = 1;
                });
            }
        };
    });

    // A line of handwriting wanders across the page, a word gets struck through, then the page clears.
    def('hobby:writing', function (w, h, rnd) {
        var t = 0, li = 0, prog = 0, struck = false, pause = 0;
        var lineY = function (i) { return h * (0.25 + 0.18 * i); };
        return {
            step: function () {
                t++;
                if (pause > 0) { pause--; return; }
                if (li >= 4) { if (t % 80 === 0) { li = 0; prog = 0; struck = false; } return; }
                prog += 3;
                if (prog > w * 0.8) {
                    if (li === 1 && !struck) { struck = true; pause = 25; return; }
                    li++; prog = 0; pause = 15;
                }
            },
            draw: function (ctx) {
                for (var i = 0; i < 4; i++) {
                    if (i > li) continue;
                    var y = lineY(i), maxX = i < li ? w * 0.8 : prog;
                    ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5; ctx.beginPath();
                    var segs = 30, drawn = Math.min(segs, Math.floor(segs * maxX / (w * 0.8)));
                    for (var s = 0; s <= drawn; s++) {
                        var x = w * 0.1 + (w * 0.8) * s / segs;
                        var yy = y + Math.sin(s * 0.9 + i) * h * 0.02;
                        s ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
                    }
                    ctx.stroke();
                    if (i === 1 && struck) line(ctx, w * 0.3, y, w * 0.55, y, C.red, 2);
                }
            }
        };
    });

    // A server rack of blinking LEDs beside a scrolling throughput trace.
    def('hobby:homelab', function (w, h, rnd) {
        var units = 6, leds = 8, t = 0, states = [], u, l;
        for (u = 0; u < units; u++) { var row = []; for (l = 0; l < leds; l++) row.push(rnd() < 0.5 ? 1 : 0); states.push(row); }
        var trace = []; for (var i = 0; i < 40; i++) trace.push(0.3 + rnd() * 0.4);
        return {
            step: function () {
                t++;
                if (t % 6 === 0) {
                    var uu = (rnd() * units) | 0, ll = (rnd() * leds) | 0;
                    var r = rnd(); states[uu][ll] = r < 0.05 ? 2 : r < 0.15 ? 3 : 1;
                }
                if (t % 8 === 0) { trace.shift(); trace.push(Math.max(0.05, Math.min(0.95, trace[trace.length - 1] + (rnd() - 0.5) * 0.3))); }
            },
            draw: function (ctx) {
                var rackX = w * 0.06, rackW = w * 0.4, unitH = h * 0.75 / units;
                for (var uu = 0; uu < units; uu++) {
                    var uy = h * 0.12 + uu * unitH;
                    rect(ctx, rackX, uy, rackW, unitH - 3, 'rgba(255,255,255,0.06)');
                    for (var ll = 0; ll < leds; ll++) {
                        var lx = rackX + 6 + ll * (rackW - 12) / leds;
                        var st = states[uu][ll];
                        var col = st === 2 ? C.red : st === 3 ? C.b : st === 1 ? C.green : 'rgba(255,255,255,0.15)';
                        dot(ctx, lx, uy + unitH / 2, Math.max(1.2, w * 0.006), col);
                    }
                }
                var gx = w * 0.55, gw = w * 0.4, gy = h * 0.2, gh = h * 0.55;
                ctx.strokeStyle = C.blue; ctx.lineWidth = 1.5; ctx.beginPath();
                trace.forEach(function (v, i) { var x = gx + gw * i / (trace.length - 1), y = gy + gh * (1 - v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
                ctx.stroke();
            }
        };
    });

    // A cat seen from behind, low right, its tail swishing and an ear twitching now and then.
    def('hobby:pets', function (w, h, rnd) {
        var t = 0, earTwitchAt = -100;
        var bx = w * 0.68, by = h * 0.75;
        return {
            step: function () { t++; if (t % 90 === 0) earTwitchAt = t; },
            draw: function (ctx) {
                var sw = Math.sin(t * 0.06) * w * 0.12;
                ctx.strokeStyle = C.ink; ctx.lineWidth = Math.max(2, w * 0.015); ctx.lineCap = 'round';
                ctx.beginPath(); ctx.moveTo(bx, by);
                ctx.quadraticCurveTo(bx - w * 0.1, by - h * 0.25, bx - w * 0.18 + sw, by - h * 0.4);
                ctx.stroke();
                ctx.fillStyle = 'rgba(255,255,255,0.75)';
                ctx.beginPath(); ctx.ellipse(bx, by, w * 0.12, h * 0.16, 0, 0, TAU); ctx.fill();
                var hy = by - h * 0.22;
                ctx.beginPath(); ctx.ellipse(bx, hy, w * 0.08, h * 0.09, 0, 0, TAU); ctx.fill();
                var et = (t - earTwitchAt < 10 && t - earTwitchAt >= 0) ? Math.sin((t - earTwitchAt) * 0.8) * 0.3 : 0;
                ctx.save(); ctx.translate(bx - w * 0.05, hy - h * 0.08); ctx.rotate(-0.3 + et);
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-w * 0.03, -h * 0.07); ctx.lineTo(w * 0.02, -h * 0.02); ctx.closePath(); ctx.fill();
                ctx.restore();
                ctx.save(); ctx.translate(bx + w * 0.05, hy - h * 0.08); ctx.rotate(0.3 - et);
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 0.03, -h * 0.07); ctx.lineTo(-w * 0.02, -h * 0.02); ctx.closePath(); ctx.fill();
                ctx.restore();
            }
        };
    });

    // A conveyor belt of chevrons carries items into an assembler that pulses when it takes one.
    def('hobby:gaming', function (w, h, rnd) {
        var t = 0, items = [], pulse = 0;
        var beltY = h * 0.6, beltX0 = w * 0.08, beltX1 = w * 0.65, boxX = w * 0.72, boxW = w * 0.18, boxH = h * 0.3, boxY = h * 0.45;
        return {
            step: function () {
                t++;
                if (t % 45 === 0) items.push({ x: beltX0 });
                items.forEach(function (it) { it.x += 1.5; });
                items = items.filter(function (it) {
                    if (it.x >= boxX) { pulse = 12; return false; }
                    return true;
                });
                if (pulse > 0) pulse--;
            },
            draw: function (ctx) {
                line(ctx, beltX0, beltY, beltX1, beltY, C.dim, 2);
                var chevW = 14, off = (t * 1.5) % chevW;
                ctx.strokeStyle = C.dim; ctx.lineWidth = 1.5;
                for (var x = beltX0 - off; x < beltX1; x += chevW) {
                    ctx.beginPath(); ctx.moveTo(x, beltY + 6); ctx.lineTo(x + chevW * 0.5, beltY - 2); ctx.lineTo(x + chevW, beltY + 6); ctx.stroke();
                }
                items.forEach(function (it) { rect(ctx, it.x - 5, beltY - 16, 10, 10, C.a); });
                var scale = 1 + (pulse / 12) * 0.15;
                var bw = boxW * scale, bh = boxH * scale;
                rect(ctx, boxX - (bw - boxW) / 2, boxY - (bh - boxH) / 2, bw, bh, pulse > 0 ? 'rgba(255,232,158,0.5)' : 'rgba(255,255,255,0.15)');
            }
        };
    });

    // Token bars stream into a hub, which fans branches out to six field labels.
    def('pub:llm-outlook', function (w, h, rnd) {
        var t = 0, labels = ['biology', 'physics', 'chemistry', 'maths', 'medicine', 'code'];
        var hx = w * 0.26, hy = h * 0.5;
        return {
            step: function () { t = (t + 1) % 360; },
            draw: function (ctx) {
                for (var i = 0; i < 6; i++) {
                    var x = ((t * 3 + i * 36) % (hx - 8)) + 2;
                    rect(ctx, x, hy - 12 + (i % 3) * 10 - 10, 6, 4, C.dim);
                }
                var pulse = 4 + 2 * Math.abs(Math.sin(t / 12));
                dot(ctx, hx, hy, pulse, C.b);
                var reveal = Math.floor(t / 55) % 7;
                for (var j = 0; j < 6 && j < reveal; j++) {
                    var nx = w * (0.5 + 0.46 * (j / 5)), ny = h * (j % 2 === 0 ? 0.22 : 0.78);
                    line(ctx, hx, hy, nx, ny, C.dim, 1);
                    dot(ctx, nx, ny, 2.5, C.a);
                    text(ctx, labels[j], nx, ny + (j % 2 === 0 ? -8 : 14), Math.max(8, Math.min(11, w * 0.017)), C.dim, 500, 'center');
                }
            }
        };
    });

    // A DNA strand scrolls by while two hyperparameter dials turn and a score bar eases toward a new best.
    def('pub:genomic', function (w, h, rnd) {
        var t = 0, bases = 'ACGT', score = 0.4, target = 0.4, best = 0.4, gold = false;
        var seq = []; for (var i = 0; i < 40; i++) seq.push(bases[Math.floor(rnd() * 4)]);
        return {
            step: function () {
                t++;
                if (t % 70 === 0) {
                    target = rnd(); gold = target > best;
                    if (gold) best = target;
                }
                score += (target - score) * 0.06;
            },
            draw: function (ctx) {
                var fs = Math.max(8, Math.min(11, w * 0.018));
                for (var i = 0; i < seq.length; i++) {
                    var x = w - ((t * 1.4 + i * 16) % (w + 16));
                    if (x > -12 && x < w + 12) text(ctx, seq[i], x, h - 8, fs, C.dim, 500, 'left', 'ui-monospace, monospace');
                }
                var a1 = (t / 50) % TAU, a2 = (t / 65 + 1.6) % TAU;
                drawDial(ctx, w * 0.2, h * 0.32, Math.min(w, h) * 0.14, a1);
                drawDial(ctx, w * 0.45, h * 0.32, Math.min(w, h) * 0.14, a2);
                var bx = w * 0.72, bw = w * 0.22, bh = h * 0.4;
                rect(ctx, bx, h * 0.12, bw, bh, 'rgba(255,255,255,0.12)');
                var fillH = bh * score;
                rect(ctx, bx, h * 0.12 + bh - fillH, bw, fillH, gold && target === best ? C.b : C.a);
            }
        };
        function drawDial(ctx, cx, cy, r, ang) {
            ctx.strokeStyle = C.dim; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r, 0.6 * Math.PI, 2.4 * Math.PI); ctx.stroke();
            line(ctx, cx, cy, cx + Math.cos(ang) * r * 0.8, cy + Math.sin(ang) * r * 0.8, C.blue, 2);
            dot(ctx, cx, cy, 2, C.blue);
        }
    });

    // Compiler-pass boxes periodically swap places while a size bar shrinks or grows.
    def('pub:llvm', function (w, h, rnd) {
        var names = ['inline', 'gvn', 'licm', 'sccp', 'dce', 'loop', 'simp', 'mem', 'jump', 'instc'];
        var order = []; for (var i = 0; i < 10; i++) order.push(i);
        var t = 0, swapA = 0, swapB = 1, swapT = 0, size = 0.7;
        return {
            step: function () {
                t++;
                if (t % 40 === 0) {
                    swapA = Math.floor(rnd() * 10); swapB = Math.floor(rnd() * 10);
                    if (swapB === swapA) swapB = (swapB + 1) % 10;
                    swapT = 1;
                    var tmp = order[swapA]; order[swapA] = order[swapB]; order[swapB] = tmp;
                    size = Math.max(0.15, Math.min(0.95, size + (rnd() < 0.75 ? -1 : 1) * (0.03 + rnd() * 0.05)));
                }
                if (swapT > 0) swapT = Math.max(0, swapT - 0.06);
            },
            draw: function (ctx) {
                var bw = w * 0.075, gap = w * 0.02, x0 = w * 0.03, fs = Math.max(7, Math.min(9, w * 0.014));
                for (var i = 0; i < 10; i++) {
                    var wobble = (i === swapA || i === swapB) ? Math.sin(swapT * Math.PI) * gap * (i === swapA ? 1 : -1) : 0;
                    var x = x0 + i * (bw + gap) + wobble;
                    rect(ctx, x, h * 0.35, bw, h * 0.3, 'rgba(255,255,255,0.14)');
                    text(ctx, names[order[i]], x + bw / 2, h * 0.35 + h * 0.3 / 2 + fs * 0.3, fs, C.ink, 500, 'center');
                }
                var bx = w * 0.9, bh = h * 0.6 * size;
                text(ctx, 'size', bx, h * 0.22, 8, C.dim, 500, 'center');
                rect(ctx, bx - 6, h * 0.8 - bh, 12, bh, C.green);
            }
        };
    });

    // A roster grid gets swept by local search, then perturbed in a block, while conflicts drift down.
    def('pub:hybrid', function (w, h, rnd) {
        var cols = 12, rows = 7, cells = [], t = 0, conflicts = 9;
        for (var r = 0; r < rows; r++) { cells.push([]); for (var c = 0; c < cols; c++) cells[r].push(Math.floor(rnd() * 3)); }
        return {
            step: function () {
                t = (t + 1) % 240;
                if (t % 4 === 0) conflicts = Math.max(1, conflicts - 0.15);
                var phase = t < 140 ? 'sweep' : 'perturb';
                if (phase === 'sweep' && t % 6 === 0) {
                    var row = Math.floor((t / 6) % rows);
                    for (var c = 0; c < cols; c++) if (rnd() < 0.3) cells[row][c] = Math.floor(rnd() * 3);
                } else if (phase === 'perturb' && t === 140) {
                    var r0 = Math.floor(rnd() * (rows - 2)), c0 = Math.floor(rnd() * (cols - 3));
                    for (var rr = r0; rr < r0 + 2; rr++) for (var cc = c0; cc < c0 + 3; cc++) cells[rr][cc] = Math.floor(rnd() * 3);
                    conflicts += 1.5;
                }
            },
            draw: function (ctx) {
                var cw = w * 0.92 / cols, ch = h * 0.7 / rows, x0 = w * 0.04, y0 = h * 0.08;
                var palette = [C.blue, C.green, 'rgba(255,255,255,0.2)'];
                for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) rect(ctx, x0 + c * cw, y0 + r * ch, cw - 1, ch - 1, palette[cells[r][c]]);
                var curX = t < 140 ? w * 0.03 : x0;
                dot(ctx, curX, y0 - 4, 2, t < 140 ? C.b : C.a);
                text(ctx, 'conflicts ' + Math.round(conflicts), w * 0.96, h * 0.06, 8, C.dim, 500, 'right');
            }
        };
    });

    // Satellite tiles fill in one by one, then the month label steps and the grid refills.
    def('pub:batchplanet', function (w, h, rnd) {
        var cols = 6, rows = 4, filled = [], t = 0, month = 0, shades = [];
        var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
        for (var i = 0; i < cols * rows; i++) { filled.push(false); shades.push(rnd() < 0.6 ? C.green : C.blue); }
        return {
            step: function () {
                t++;
                var n = Math.floor(t / 8);
                if (n <= cols * rows && t % 8 === 0) filled[n - 1] = true;
                if (t > (cols * rows + 6) * 8) {
                    t = 0; month = (month + 1) % months.length;
                    for (var i = 0; i < filled.length; i++) { filled[i] = false; shades[i] = rnd() < 0.6 ? C.green : C.blue; }
                }
            },
            draw: function (ctx) {
                var tw = w * 0.9 / cols, th = h * 0.72 / rows, x0 = w * 0.05, y0 = h * 0.08;
                for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) {
                    var idx = r * cols + c;
                    rect(ctx, x0 + c * tw, y0 + r * th, tw - 2, th - 2, filled[idx] ? shades[idx] : 'rgba(255,255,255,0.08)');
                }
                text(ctx, months[month] + ' 2026', w * 0.95, h * 0.94, 9, C.dim, 500, 'right');
            }
        };
    });

    // An ECG trace scrolls with heart rate tied to a row of rising and falling word-arousal bars.
    def('pub:hrv', function (w, h, rnd) {
        var t = 0, bars = []; for (var i = 0; i < 24; i++) bars.push(0.3 + rnd() * 0.3);
        return {
            step: function () {
                t++;
                if (t % 5 === 0) { bars.shift(); bars.push(Math.max(0.1, Math.min(1, bars[bars.length - 1] + (rnd() - 0.5) * 0.5))); }
            },
            draw: function (ctx) {
                var arousal = 0; for (var i = 0; i < bars.length; i++) arousal += bars[i]; arousal /= bars.length;
                var period = 34 - arousal * 20, baseY = h * 0.32;
                ctx.strokeStyle = C.red; ctx.lineWidth = 1.5; ctx.beginPath();
                for (var x = 0; x < w; x++) {
                    var phase = (x + t * 2) % period;
                    var y = baseY;
                    if (phase < 3) y = baseY - phase * 10;
                    else if (phase < 6) y = baseY - (6 - phase) * 10;
                    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                }
                ctx.stroke();
                var bw = w / bars.length;
                for (var j = 0; j < bars.length; j++) rect(ctx, j * bw, h - bars[j] * h * 0.4, bw - 1, bars[j] * h * 0.4, C.blue);
            }
        };
    });

    // A compass needle swings, settles on a gold heading, then a dashed route draws out to it.
    def('genre:fantasy', function (w, h, rnd) {
        var t = 0, target = rnd() * TAU, settle = 0;
        return {
            step: function () {
                t = (t + 1) % 260;
                if (t === 0) target = rnd() * TAU;
                settle = ease(Math.min(1, t / 140));
            },
            draw: function (ctx) {
                var cx = w * 0.5, cy = h * 0.42, r = Math.min(w, h) * 0.3;
                ctx.strokeStyle = C.dim; ctx.lineWidth = 1;
                for (var i = 0; i < 8; i++) { var a = (i / 8) * TAU; line(ctx, cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r, C.dim, 1); }
                var wobble = (1 - settle) * Math.sin(t * 0.6) * 1.2;
                var ang = target * settle + wobble;
                var gx = cx + Math.cos(target) * r, gy = cy + Math.sin(target) * r;
                if (settle > 0.7) dot(ctx, gx, gy, 3, C.b);
                line(ctx, cx, cy, cx + Math.cos(ang) * r * 0.85, cy + Math.sin(ang) * r * 0.85, C.a, 2);
                dot(ctx, cx, cy, 2, C.ink);
                if (settle >= 1 && t > 150) {
                    ctx.strokeStyle = C.b; ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
                    var p = Math.min(1, (t - 150) / 90);
                    line(ctx, cx, cy, cx + (gx - cx) * p, cy + (gy - cy) * p, C.b, 1.5);
                    ctx.setLineDash([]);
                }
            }
        };
    });

    // Stars rush outward past a small ship, with a hyperspace streak burst every few seconds.
    def('genre:scifi', function (w, h, rnd) {
        var t = 0, stars = []; for (var i = 0; i < 50; i++) stars.push([rnd() * TAU, 2 + rnd() * 30]);
        return {
            step: function () {
                t++;
                for (var i = 0; i < stars.length; i++) { stars[i][1] += 1.6 + (t % 200 > 185 ? 8 : 0); if (stars[i][1] > Math.max(w, h) * 0.6) stars[i][1] = 2; }
            },
            draw: function (ctx) {
                var cx = w * 0.5, cy = h * 0.4, burst = t % 200 > 185;
                for (var i = 0; i < stars.length; i++) {
                    var a = stars[i][0], d = stars[i][1];
                    var x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
                    if (burst) line(ctx, cx + Math.cos(a) * d * 0.5, cy + Math.sin(a) * d * 0.5, x, y, C.ink, 1.5);
                    else dot(ctx, x, y, 1.2, C.ink);
                }
                ctx.fillStyle = C.dim;
                ctx.beginPath(); ctx.moveTo(cx, h * 0.78); ctx.lineTo(cx - 10, h * 0.86); ctx.lineTo(cx + 10, h * 0.86); ctx.closePath(); ctx.fill();
            }
        };
    });

    // A highlighter sweeps across page lines, a margin note appears, and the page then turns.
    def('genre:nonfiction', function (w, h, rnd) {
        var t = 0, lines = 7;
        return {
            step: function () { t = (t + 1) % 260; },
            draw: function (ctx) {
                var x0 = w * 0.14, x1 = w * 0.86, y0 = h * 0.12, gap = h * 0.75 / lines;
                var turning = t > 220;
                var fade = turning ? Math.max(0, 1 - (t - 220) / 40) : 1;
                for (var i = 0; i < lines; i++) {
                    var y = y0 + i * gap;
                    line(ctx, x0, y, x0 + (x1 - x0) * (0.6 + 0.4 * ((i * 7) % 5) / 5), y, 'rgba(255,255,255,' + (0.3 * fade).toFixed(2) + ')', 2);
                }
                var hlLine = Math.floor(t / 90) % 2, hlY = y0 + hlLine * gap * 3, prog = Math.min(1, (t % 90) / 60);
                if (fade > 0) rect(ctx, x0, hlY - 5, (x1 - x0) * prog, 8, 'rgba(255,232,158,' + (0.5 * fade).toFixed(2) + ')');
                if (prog >= 1) for (var n = 0; n < 2; n++) line(ctx, x1 + 6, hlY - 4 + n * 5, x1 + 22, hlY - 4 + n * 5, 'rgba(255,150,150,' + (0.7 * fade).toFixed(2) + ')', 1.5);
            }
        };
    });

    // A page flips via a curving bezier fold, revealing fresh lines underneath.
    def('genre:fiction', function (w, h, rnd) {
        var t = 0;
        return {
            step: function () { t = (t + 1) % 120; },
            draw: function (ctx) {
                var lines = 6, x0 = w * 0.14, x1 = w * 0.86, y0 = h * 0.12, gap = h * 0.75 / lines;
                for (var i = 0; i < lines; i++) { var y = y0 + i * gap; line(ctx, x0, y, x0 + (x1 - x0) * (0.55 + 0.4 * ((i * 3) % 4) / 4), y, C.dim, 2); }
                var p = t / 120, flip = Math.sin(p * Math.PI);
                if (flip > 0.02) {
                    var foldX = x1 - (x1 - x0) * p;
                    var ctrlX = foldX + flip * (x1 - x0) * 0.5;
                    ctx.fillStyle = 'rgba(255,255,255,' + (0.12 + 0.1 * flip).toFixed(2) + ')';
                    ctx.beginPath(); ctx.moveTo(x1, y0 - 6);
                    ctx.quadraticCurveTo(ctrlX, y0 + (y0 + gap * lines) * 0.5, foldX, y0 + gap * lines);
                    ctx.lineTo(x1, y0 + gap * lines); ctx.closePath(); ctx.fill();
                }
            }
        };
    });

    // A slowly rotating globe with latitude/longitude lines and a pulsing marker at the given coordinate.
    def('gallery:globe', function (w, h, rnd, arg) {
        var t = 0, lat = 56.1, lng = -3.9;
        if (arg && typeof arg.lat === 'number' && typeof arg.lng === 'number') { lat = arg.lat; lng = arg.lng; }
        var latR = lat * Math.PI / 180, lng0 = lng * Math.PI / 180;
        return {
            step: function () { t++; },
            draw: function (ctx) {
                var cx = w * 0.5, cy = h * 0.5, R = Math.min(w, h) * 0.45;
                var rot = t / 300, wobble = Math.sin(t / 60) * (25 * Math.PI / 180);
                dot(ctx, cx, cy, R, 'rgba(255,255,255,0.06)');
                ctx.strokeStyle = C.dim; ctx.lineWidth = 0.75;
                for (var i = 1; i <= 3; i++) { var ry = R * (i / 4); ctx.beginPath(); ctx.ellipse(cx, cy, R, ry * 0, 0, 0, TAU); }
                for (var i2 = -1; i2 <= 1; i2++) {
                    ctx.beginPath(); ctx.ellipse(cx, cy, Math.abs(R * Math.cos(i2 * 0.9 + rot)) + 0.5, R, 0, 0, TAU); ctx.stroke();
                }
                for (var la = 1; la <= 2; la++) {
                    var yy = cy - R * (la / 3);
                    ctx.beginPath(); ctx.ellipse(cx, yy, R * Math.sqrt(1 - (la / 3) * (la / 3)), R * 0.18, 0, 0, TAU); ctx.stroke();
                    yy = cy + R * (la / 3);
                    ctx.beginPath(); ctx.ellipse(cx, yy, R * Math.sqrt(1 - (la / 3) * (la / 3)), R * 0.18, 0, 0, TAU); ctx.stroke();
                }
                var faceAng = rot + wobble;
                var px = R * Math.cos(latR) * Math.sin(faceAng);
                var py = -R * Math.sin(latR);
                var visible = Math.cos(faceAng) * Math.cos(lng0 * 0 + 0) >= -0.15;
                var pr = 2 + 2 * Math.abs(Math.sin(t / 10));
                if (visible) dot(ctx, cx + px, cy + py, pr, C.red);
            },
            veil: false
        };
    });

    // Post cards stack up one at a time, newest on top.
    def('stat:posts', function (w, h, rnd) {
        var t = 0, n = 9;
        return {
            step: function () { t = (t + 1) % 260; },
            draw: function (ctx) {
                for (var i = 0; i < n; i++) {
                    var p = ease(Math.min(1, Math.max(0, (t - i * 18) / 30)));
                    if (p <= 0) continue;
                    var x = w * 0.2 + (i % 3) * w * 0.22, y = h * 0.95 - Math.floor(i / 3) * h * 0.24 - p * 4;
                    ctx.globalAlpha = 0.25 + 0.5 * p;
                    rect(ctx, x, y - h * 0.16, w * 0.18, h * 0.16, i === n - 1 ? C.b : 'rgba(255,255,255,0.7)');
                    rect(ctx, x + 3, y - h * 0.05, w * 0.1, 2, 'rgba(0,0,0,0.6)');
                    ctx.globalAlpha = 1;
                }
            }
        };
    });
}());
