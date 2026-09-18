/**
 * hero-evolve.js — the research slide's headline paints itself.
 *
 * A (1+1) evolution strategy: hold one candidate picture made of
 * translucent triangles, mutate a copy, keep the copy only if it matches
 * the target better, repeat. The target is the words "Hi, I'm Ken."
 * rendered offscreen, so the headline emerges out of noise rather than
 * being drawn. Same family of algorithm as the Evolution, Live post, cut
 * down to something that belongs in a hero: no controls, no population
 * grid, no chart.
 *
 * Three things keep it cheap enough to sit on the homepage:
 *   - fitness is scored on a 176x48 offscreen canvas, never the display one
 *   - the display canvas is only repainted when a mutation is accepted
 *   - the loop does no work at all while its carousel slide is off screen,
 *     and idles once it stops improving, restarting only when the slide
 *     comes back round
 *
 * Accessibility: the real heading is in the DOM as visually-hidden text,
 * the canvas is aria-hidden decoration, and prefers-reduced-motion skips
 * the search entirely and draws the words as type instead.
 */
(function () {
    'use strict';

    var SHAPES = 78;
    var FIT_W = 176;              // fitness resolution, not display resolution
    var FIT_H = 48;
    var EVALS_PER_FRAME = 170;
    var STALL_LIMIT = 1800;       // evaluations with no improvement = converged
    var REPLAY_DELAY = 420;       // ms after the slide arrives before restarting
    var TEXT = "Hi, I'm Ken.";

    // Endpoints of --kr-photo-gradient. Colour is not evolved, only mixed
    // along this ramp, which keeps the result on-palette and drops three
    // dimensions out of the search.
    var RAMP = [[255, 150, 150], [255, 232, 158]];

    function mix(t) {
        return [
            Math.round(RAMP[0][0] + (RAMP[1][0] - RAMP[0][0]) * t),
            Math.round(RAMP[0][1] + (RAMP[1][1] - RAMP[0][1]) * t),
            Math.round(RAMP[0][2] + (RAMP[1][2] - RAMP[0][2]) * t)
        ];
    }

    function rand(a, b) { return a + Math.random() * (b - a); }

    function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

    /** Target luminance, plus the coordinates of the ink in it. */
    function buildTarget() {
        var c = document.createElement('canvas');
        c.width = FIT_W;
        c.height = FIT_H;
        var x = c.getContext('2d', { willReadFrequently: true });
        x.fillStyle = '#000';
        x.fillRect(0, 0, FIT_W, FIT_H);
        x.fillStyle = '#fff';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        // Shrink to fit rather than trusting one size across font stacks.
        var size = 40;
        do {
            x.font = '700 ' + size + 'px Poppins, sans-serif';
            if (x.measureText(TEXT).width <= FIT_W - 10) break;
            size -= 1;
        } while (size > 8);
        x.fillText(TEXT, FIT_W / 2, FIT_H / 2 + 1);

        var d = x.getImageData(0, 0, FIT_W, FIT_H).data;
        var target = new Float32Array(FIT_W * FIT_H);
        var ink = [];
        for (var i = 0, px = 0; i < d.length; i += 4, px++) {
            var v = (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255;
            target[px] = v;
            if (v > 0.5) ink.push([(px % FIT_W) / FIT_W, Math.floor(px / FIT_W) / FIT_H]);
        }
        return { lum: target, ink: ink };
    }

    function randomShape(ink) {
        // Land near a lit pixel of the target, not on it. Seeding exactly on
        // the ink converges so fast that the first painted frame already
        // reads, and the headline appears rather than arriving. The jitter
        // buys back a second of visible sharpening without giving up the
        // speed: the search still starts in the right neighbourhood.
        var seed = ink && ink.length ? ink[(Math.random() * ink.length) | 0] : null;
        var cx = seed ? clamp01(seed[0] + rand(-0.07, 0.07)) : Math.random();
        var cy = seed ? clamp01(seed[1] + rand(-0.18, 0.18)) : Math.random();
        var s = rand(0.03, 0.12);
        return {
            x: [clamp01(cx + rand(-s, s)), clamp01(cx + rand(-s, s)), clamp01(cx + rand(-s, s))],
            y: [clamp01(cy + rand(-s, s)), clamp01(cy + rand(-s, s)), clamp01(cy + rand(-s, s))],
            t: Math.random(),
            a: rand(0.15, 0.5)
        };
    }

    function cloneShape(s) {
        return { x: s.x.slice(), y: s.y.slice(), t: s.t, a: s.a };
    }

    function paint(genome, ctx, w, h) {
        ctx.clearRect(0, 0, w, h);
        for (var i = 0; i < genome.length; i++) {
            var s = genome[i];
            var c = mix(s.t);
            ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + s.a + ')';
            ctx.beginPath();
            ctx.moveTo(s.x[0] * w, s.y[0] * h);
            ctx.lineTo(s.x[1] * w, s.y[1] * h);
            ctx.lineTo(s.x[2] * w, s.y[2] * h);
            ctx.closePath();
            ctx.fill();
        }
    }

    function mutate(genome, scale) {
        var s = genome[(Math.random() * genome.length) | 0];
        var roll = Math.random();
        if (roll < 0.6) {
            var v = (Math.random() * 3) | 0;
            s.x[v] = clamp01(s.x[v] + rand(-0.09, 0.09) * scale);
            s.y[v] = clamp01(s.y[v] + rand(-0.16, 0.16) * scale);
        } else if (roll < 0.85) {
            s.a = Math.min(0.72, Math.max(0.02, s.a + rand(-0.09, 0.09) * scale));
        } else {
            s.t = clamp01(s.t + rand(-0.25, 0.25) * scale);
        }
    }

    /* Coarse moves while progress is easy, fine ones once it is not. */
    function stepScale(stalled) {
        var t = stalled / STALL_LIMIT;
        return Math.max(0.16, 1 - t * 0.92);
    }

    function start(canvas) {
        if (canvas.dataset.krEvolving === '1') return;
        canvas.dataset.krEvolving = '1';

        var view = canvas.getContext('2d');
        var fitCanvas = document.createElement('canvas');
        fitCanvas.width = FIT_W;
        fitCanvas.height = FIT_H;
        var fit = fitCanvas.getContext('2d', { willReadFrequently: true });

        var built = buildTarget();
        var target = built.lum;
        var genome = [];

        function seedGenome() {
            var g = [];
            for (var i = 0; i < SHAPES; i++) g.push(randomShape(built.ink));
            return g;
        }
        genome = seedGenome();

        function score(g) {
            paint(g, fit, FIT_W, FIT_H);
            var d = fit.getImageData(0, 0, FIT_W, FIT_H).data;
            var err = 0;
            for (var i = 0, p = 0; i < d.length; i += 4, p++) {
                // Composited over black, so luminance alone is the signal.
                var lum = (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722) / 255;
                var diff = lum * (d[i + 3] / 255) - target[p];
                err += diff * diff;
            }
            return err;
        }

        function sizeView() {
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            var rect = canvas.getBoundingClientRect();
            if (!rect.width) return false;
            canvas.width = Math.round(rect.width * dpr);
            canvas.height = Math.round(rect.height * dpr);
            return true;
        }

        function repaint() {
            if (canvas.width) paint(genome, view, canvas.width, canvas.height);
        }

        /** The words as type, in the same gradient the triangles mix from. */
        function paintStatic() {
            if (!canvas.width) return;
            var w = canvas.width, h = canvas.height;
            view.clearRect(0, 0, w, h);
            var g = view.createLinearGradient(0, 0, w, 0);
            g.addColorStop(0, 'rgb(' + RAMP[0].join(',') + ')');
            g.addColorStop(1, 'rgb(' + RAMP[1].join(',') + ')');
            view.fillStyle = g;
            view.textAlign = 'center';
            view.textBaseline = 'middle';
            var size = Math.round(h * 0.55);
            do {
                view.font = '700 ' + size + 'px Poppins, sans-serif';
                if (view.measureText(TEXT).width <= w * 0.96) break;
                size -= 2;
            } while (size > 10);
            view.fillText(TEXT, w / 2, h / 2);
        }

        sizeView();
        var best = score(genome);
        repaint();

        var reduced = window.matchMedia &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced) {
            // Draw the destination and stop. Running the search to
            // convergence here instead would mean tens of thousands of
            // getImageData calls on the main thread before first paint,
            // which is a frozen tab, not a considerate one.
            paintStatic();
            return;
        }

        var stalled = 0;
        var dirty = false;
        var wasActive = false;
        var replayAt = 0;

        function restart() {
            genome = seedGenome();
            best = score(genome);
            stalled = 0;
            repaint();
        }

        function active() {
            var item = canvas.closest ? canvas.closest('.owl-item') : null;
            // Outside a carousel, or in one that has not initialised, just run.
            if (!item) return true;
            return item.classList.contains('active');
        }

        function step() {
            var on = active();

            // Arriving on the slide restarts the search, so the headline is
            // built in front of whoever is looking at it rather than being
            // already finished from a previous pass.
            if (on && !wasActive) replayAt = performance.now() + REPLAY_DELAY;
            wasActive = on;

            if (!on) {
                requestAnimationFrame(step);  // off screen: spend nothing
                return;
            }
            if (replayAt) {
                if (performance.now() < replayAt) {
                    requestAnimationFrame(step);
                    return;
                }
                replayAt = 0;
                restart();
            }
            if (stalled > STALL_LIMIT) {
                requestAnimationFrame(step);  // settled: wait for the next visit
                return;
            }
            var scale = stepScale(stalled);
            for (var e = 0; e < EVALS_PER_FRAME; e++) {
                var cand = genome.map(cloneShape);
                mutate(cand, scale);
                var s2 = score(cand);
                if (s2 < best) {
                    best = s2;
                    genome = cand;
                    stalled = 0;
                    dirty = true;
                } else {
                    stalled++;
                }
            }
            if (dirty) { repaint(); dirty = false; }
            requestAnimationFrame(step);
        }

        var resizeTimer;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                if (sizeView()) repaint();
            }, 200);
        });

        requestAnimationFrame(step);
    }

    function init() {
        var canvases = document.querySelectorAll('.kr-hero-evolve');
        if (!canvases.length) return;
        // The carousel clones slides to loop, so every copy gets its own run.
        Array.prototype.forEach.call(canvases, function (c) { start(c); });
    }

    // Poppins decides the target's shape, so wait for it where we can.
    if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(init).catch(init);
    } else if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}());
