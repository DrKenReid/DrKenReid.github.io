/*
 * kr-viz.js - the shared engine behind the Algorithms, Live and Learning,
 * Live demos. Spec and rationale: blog/VIZ-ENGINE.md.
 *
 * It owns the chrome: canvas sizing and devicePixelRatio, the palette and
 * its theme rebind, the run loop and speed, controls, stat tiles, charts,
 * and the behaviours no post remembered to write (reduced motion, pausing
 * offscreen, announcing the status line, a handle tests can drive).
 *
 * It does not own the algorithm or the drawing. A post supplies init, step
 * and draw as plain functions, and those stay readable in view-source.
 *
 * No dependencies, no build step.
 */
(function (global) {
  'use strict';

  var TOKENS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8',
                'ink', 'muted', 'grid', 'surface', 'border', 'cell'];
  var STACK_BELOW = 480;   // chart panes stack below this canvas width

  /* Seeded PRNG. Every demo runs from a seed so a reader who reloads sees
     the same run, and so a test can reproduce one. */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function readColors(el) {
    var cs = getComputedStyle(el), out = {};
    for (var i = 0; i < TOKENS.length; i++) {
      out[TOKENS[i]] = cs.getPropertyValue('--viz-' + TOKENS[i]).trim();
    }
    return out;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function mount(target, cfg) {
    var root = typeof target === 'string' ? document.querySelector(target) : target;
    if (!root) return null;

    var colors = readColors(root);
    var canvases = {};
    var controls = {};
    var statEls = {};
    var samples = [];
    var maxSamples = cfg.maxSamples || 300;
    var seed = cfg.seed || 1;
    var rng = mulberry32(seed);
    var iteration = 0, running = false, finished = false;
    var raf = null, lastT = 0, acc = 0, visible = true, userPaused = false;

    var reduce = global.matchMedia &&
                 global.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // While the controls are being built there is no state to redraw and no
    // ctx to restart, so their change handlers only record the value.
    var booting = true;
    var reduceNotice = '';

    /* ---- controls, stats, buttons ------------------------------------ */

    var slot = {
      toolbar: root.querySelector('[data-kr-toolbar]'),
      sliders: root.querySelector('[data-kr-sliders]'),
      stats: root.querySelector('[data-kr-stats]')
    };

    var statusEl = null;
    if (slot.toolbar) {
      statusEl = el('span', 'kr-status');
      // the one readout worth announcing; the tiles would be noise
      statusEl.setAttribute('aria-live', 'polite');
    }

    var runBtn = null;
    function addButton(spec) {
      var s = typeof spec === 'string' ? {id: spec} : spec;
      var label = s.label || (s.id === 'run' ? 'Pause' :
                              s.id.charAt(0).toUpperCase() + s.id.slice(1));
      var b = el('button', 'kr-btn' + (s.id === 'run' ? ' kr-run' : ' secondary'), label);
      b.type = 'button';
      b.addEventListener('click', function () {
        // an explicit handler wins, so a post can give Restart its own
        // meaning (a fresh draw rather than a replay of the same seed)
        if (s.onClick) { s.onClick(api); }
        else if (s.id === 'run') { userPaused = running; running ? pause() : run(); }
        else if (s.id === 'restart') { restart(); }
      });
      slot.toolbar.appendChild(b);
      if (s.id === 'run') runBtn = b;
      return b;
    }

    function addControl(spec) {
      var s = typeof spec === 'string' ? {id: spec} : spec;
      if (s.id === 'speed') {
        s = {id: 'speed', label: s.label || 'Speed', min: s.min || 1,
             max: s.max || 40, value: s.value || 6, unit: '/s'};
      }
      if (s.type === 'select') {
        var slab = el('label');
        slab.appendChild(document.createTextNode(s.label + ' '));
        var sel = document.createElement('select');
        (s.options || []).forEach(function (o) {
          var opt = document.createElement('option');
          opt.value = o.value != null ? o.value : o;
          opt.textContent = o.label != null ? o.label : o;
          sel.appendChild(opt);
        });
        sel.value = s.value != null ? s.value : sel.value;
        slab.appendChild(sel);
        slot.toolbar.appendChild(slab);
        controls[s.id] = sel.value;
        sel.addEventListener('change', function () {
          controls[s.id] = sel.value;
          if (s.restart === false) redraw(); else restart();
        });
        return;
      }
      if (s.type === 'check') {
        var lab = el('label');
        var box = document.createElement('input');
        box.type = 'checkbox'; box.checked = !!s.value;
        lab.appendChild(box);
        lab.appendChild(document.createTextNode(' ' + s.label));
        slot.toolbar.appendChild(lab);
        controls[s.id] = !!s.value;
        box.addEventListener('change', function () {
          controls[s.id] = box.checked;
          if (s.restart) restart(); else redraw();
        });
        return;
      }
      var label = el('label');
      label.appendChild(document.createTextNode(s.label + ' '));
      var input = document.createElement('input');
      input.type = 'range';
      input.min = s.min; input.max = s.max; input.step = s.step || 1;
      input.value = s.value;
      var val = el('span', 'val');
      label.appendChild(input);
      label.appendChild(document.createTextNode(' '));
      label.appendChild(val);
      slot.sliders.appendChild(label);
      controls[s.id] = Number(s.value);
      function sync() {
        controls[s.id] = Number(input.value);
        val.textContent = s.fmt ? s.fmt(controls[s.id])
                                : input.value + (s.unit || '');
        if (booting) return;
        if (s.restart) restart(); else redraw();
      }
      input.addEventListener('input', sync);
      sync();
    }

    function addStat(s) {
      var tile = el('div', 'kr-stat');
      var lbl = el('span', 'kr-stat-lbl');
      if (s.tone) {
        var sw = el('span', 'kr-swatch');
        sw.style.background = 'var(--viz-' + s.tone + ')';
        lbl.appendChild(sw);
      }
      lbl.appendChild(document.createTextNode(s.label));
      var v = el('span', 'kr-stat-val', '0');
      tile.appendChild(lbl); tile.appendChild(v);
      slot.stats.appendChild(tile);
      statEls[s.id] = {el: v, fmt: s.fmt};
    }

    (cfg.buttons || []).forEach(addButton);
    (cfg.controls || []).forEach(addControl);
    // the status sits last: it carries margin-left:auto, so anything appended
    // after it would be pushed to the far right with it
    if (statusEl) slot.toolbar.appendChild(statusEl);
    (cfg.stats || []).forEach(addStat);

    /* ---- canvases ---------------------------------------------------- */

    Object.keys(cfg.canvases || {}).forEach(function (name) {
      var spec = cfg.canvases[name];
      var node = typeof spec.el === 'string'
        ? (root.querySelector(spec.el) || document.querySelector(spec.el))
        : spec.el;
      canvases[name] = {node: node, spec: spec, g: null, w: 0, h: 0};
    });

    function fit() {
      var dpr = global.devicePixelRatio || 1;
      Object.keys(canvases).forEach(function (name) {
        var c = canvases[name];
        if (!c.node) return;
        var w = c.node.clientWidth || 600;
        var spec = (w < STACK_BELOW && c.spec.mobile) ? c.spec.mobile : c.spec;
        var h = typeof spec.height === 'function' ? spec.height(w) : spec.height;
        h = Math.round(h);
        c.node.style.height = h + 'px';
        c.node.width = Math.round(w * dpr);
        c.node.height = Math.round(h * dpr);
        var g = c.node.getContext('2d');
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        c.g = g; c.w = w; c.h = h;
      });
    }

    /* ---- charts ------------------------------------------------------ */

    function drawCharts() {
      (cfg.charts || []).forEach(function (chart) {
        var c = canvases[chart.canvas];
        if (!c || !c.g) return;
        var g = c.g;
        g.clearRect(0, 0, c.w, c.h);
        g.font = '600 9px Poppins, sans-serif';
        var panes = chart.panes || [];
        if (panes.length === 1) { drawPane(g, panes[0], 0, 0, c.w, c.h); return; }
        if (c.w < STACK_BELOW) {
          var gap = 14, ph = (c.h - gap * (panes.length - 1)) / panes.length;
          panes.forEach(function (p, i) { drawPane(g, p, 0, i * (ph + gap), c.w, ph); });
        } else {
          var gx = 20, pw = (c.w - gx * (panes.length - 1)) / panes.length;
          panes.forEach(function (p, i) { drawPane(g, p, i * (pw + gx), 0, pw, c.h); });
        }
      });
    }

    function drawPane(g, pane, x, y, w, h) {
      // a pane whose data is not a time series (an elbow curve, say) draws
      // itself; it still gets the engine's layout and palette
      if (pane.draw) { pane.draw(g, x, y, w, h, colors, samples); return; }
      var series = pane.series || [];
      var padL = pane.yTicks ? 34 : 30, padT = 16, padB = 12;
      var x0 = x + padL, x1 = x + w, yTop = y + padT, yBot = y + h - padB;
      var vals = [];
      samples.forEach(function (s) {
        series.forEach(function (se) {
          var v = s[se.key];
          if (typeof v === 'number' && isFinite(v)) vals.push(v);
        });
      });
      var lo = pane.yMin != null ? pane.yMin : (vals.length ? Math.min.apply(null, vals) : 0);
      var hi = pane.yMax != null ? pane.yMax : (vals.length ? Math.max.apply(null, vals) : 1);
      if (pane.log) { lo = Math.max(lo, 1e-12); hi = Math.max(hi, lo * 10); }
      if (hi === lo) hi = lo + 1;

      function ypos(v) {
        if (pane.log) {
          var l = Math.log10(Math.max(v, 1e-12)), a = Math.log10(lo), b = Math.log10(hi);
          return yBot - (l - a) / (b - a) * (yBot - yTop);
        }
        return yBot - (v - lo) / (hi - lo) * (yBot - yTop);
      }

      g.fillStyle = colors.muted;
      g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      if (pane.label) g.fillText(pane.label, x, y + 9);

      var ticks;
      if (pane.yTicks) {
        ticks = pane.yTicks.map(function (t, i) { return {v: i + 1, text: t}; });
      } else if (pane.log) {
        // powers of ten, so self-scaling convergence reads as a straight line
        var p0 = Math.floor(Math.log10(lo)), p1 = Math.ceil(Math.log10(hi));
        var stepP = Math.max(1, Math.ceil((p1 - p0) / 3));
        ticks = [];
        for (var pw = p0; pw <= p1; pw += stepP) {
          ticks.push({v: Math.pow(10, pw), text: pw === 0 ? '1' : '1e' + pw});
        }
      } else if (Number.isInteger(lo) && Number.isInteger(hi) && hi - lo <= 4) {
        // a small count range: label whole numbers, not 0.50 of a visit
        ticks = [];
        for (var t = lo; t <= hi; t++) ticks.push({v: t, text: String(t)});
      } else {
        ticks = [{v: lo, text: fmtTick(lo)},
                 {v: (lo + hi) / 2, text: fmtTick((lo + hi) / 2)},
                 {v: hi, text: fmtTick(hi)}];
      }
      ticks.forEach(function (t) {
        var gy = ypos(t.v);
        g.strokeStyle = colors.grid; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x0, gy); g.lineTo(x1, gy); g.stroke();
        g.fillStyle = colors.muted; g.textAlign = 'right';
        g.fillText(t.text, x0 - 5, gy + 3);
        g.textAlign = 'left';
      });

      if (samples.length > 1) {
        var stepX = (x1 - x0) / (samples.length - 1);
        series.forEach(function (se) {
          g.beginPath();
          var started = false;
          for (var i = 0; i < samples.length; i++) {
            var v = samples[i][se.key];
            if (typeof v !== 'number' || !isFinite(v)) continue;
            var px = x0 + i * stepX, py = ypos(v);
            if (!started) { g.moveTo(px, py); started = true; }
            else if (se.step) { g.lineTo(px, ypos(samples[i - 1][se.key])); g.lineTo(px, py); }
            else { g.lineTo(px, py); }
          }
          g.strokeStyle = colors[se.tone || 's1'];
          g.lineWidth = se.width || 1.6;
          g.stroke();
          if (se.fill) {
            g.lineTo(x0 + (samples.length - 1) * stepX, yBot);
            g.lineTo(x0, yBot);
            g.closePath();
            g.globalAlpha = 0.12; g.fillStyle = colors[se.tone || 's1']; g.fill();
            g.globalAlpha = 1;
          }
        });
      }

      var legend = series.filter(function (s) { return s.label; });
      if (legend.length) {
        var lx = x1;
        for (var i = legend.length - 1; i >= 0; i--) {
          var s2 = legend[i];
          g.textAlign = 'right';
          g.fillStyle = colors.muted;
          g.fillText(s2.label, lx, y + 9);
          var tw = g.measureText(s2.label).width;
          g.fillStyle = colors[s2.tone || 's1'];
          g.fillRect(lx - tw - 12, y + 4, 8, 3);
          lx -= tw + 22;
        }
        g.textAlign = 'left';
      }
    }

    function fmtTick(v) {
      if (Math.abs(v) >= 10000) return v.toExponential(0);
      if (Number.isInteger(v)) return String(v);
      return v.toFixed(Math.abs(v) < 1 ? 2 : 1);
    }

    /* ---- the context handed to the post ------------------------------ */

    var ctx = {
      canvas: canvases,
      colors: colors,
      controls: controls,
      rng: rng,
      state: null,
      iteration: 0,
      dt: 0.016,             // seconds since the last frame, for eased motion
      phase: 1,              // 0..1 progress toward the next step
      set: function (id, v) {
        var s = statEls[id];
        if (s) s.el.textContent = s.fmt ? s.fmt(v) : String(v);
      },
      record: function (obj) {
        samples.push(obj);
        if (samples.length > maxSamples) samples.shift();
      },
      status: function (text) { if (statusEl) statusEl.textContent = text || ''; },
      finish: function (text) { finished = true; pause(); if (text) ctx.status(text); },
      samples: function () { return samples; }
    };

    /* ---- loop -------------------------------------------------------- */

    function redraw() {
      if (!ctx.state) return;
      Object.keys(canvases).forEach(function (n) {
        var c = canvases[n];
        if (c.g) c.g.clearRect(0, 0, c.w, c.h);
      });
      cfg.draw(ctx);
      drawCharts();
      // a post that writes its own status (a move counter, say) would
      // otherwise overwrite the reason it is sitting still
      if (reduceNotice && !running && statusEl) statusEl.textContent = reduceNotice;
    }

    function doStep() {
      if (finished) return;
      cfg.step(ctx);
      iteration++;
      ctx.iteration = iteration;
    }

    function frame(ts) {
      if (!running) return;
      if (!lastT) lastT = ts;
      var dt = ts - lastT; lastT = ts;
      ctx.dt = Math.min(0.1, dt / 1000);
      acc += dt;
      // steps per second: a function of the controls if the post supplies
      // one (log-scaled sliders), else the speed slider, else a fixed rate
      var rate = typeof cfg.speed === 'function' ? cfg.speed(controls)
               : (controls.speed || cfg.speed || 6);
      var interval = 1000 / Math.max(0.1, rate), guard = 0;
      // the cap has to scale with the rate, or a demo asking for 1000 steps
      // a second silently runs at 8 a frame
      var cap = cfg.maxStepsPerFrame || Math.max(8, Math.ceil(rate / 20));
      while (acc >= interval && guard++ < cap) { acc -= interval; doStep(); }
      // how far the clock has travelled toward the next step, so a demo can
      // glide between discrete steps instead of jumping
      ctx.phase = Math.max(0, Math.min(1, acc / interval));
      if (acc > interval * 4) acc = 0;
      redraw();
      raf = global.requestAnimationFrame(frame);
    }

    function run() {
      if (running || finished) return;
      reduceNotice = '';
      running = true; lastT = 0;
      if (runBtn) runBtn.textContent = 'Pause';
      ctx.status('');
      raf = global.requestAnimationFrame(frame);
    }

    function pause() {
      running = false;
      if (raf) global.cancelAnimationFrame(raf);
      if (runBtn) runBtn.textContent = 'Play';
    }

    function restart() {
      samples.length = 0;
      iteration = 0; ctx.iteration = 0; finished = false;
      rng = mulberry32(seed); ctx.rng = rng;
      ctx.status('');
      ctx.state = cfg.init(ctx);
      redraw();
      if (runBtn) runBtn.textContent = running ? 'Pause' : 'Play';
    }

    /* ---- environment ------------------------------------------------- */

    global.addEventListener('resize', function () { fit(); redraw(); });

    new MutationObserver(function () {
      colors = readColors(root);
      ctx.colors = colors;
      redraw();
    }).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});

    // a demo near the top of a long post should not run while the reader is
    // three thousand words further down
    if (global.IntersectionObserver) {
      new global.IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (!visible) { if (running) { pause(); if (runBtn) runBtn.textContent = 'Pause'; } }
        else if (!userPaused && !finished) run();
      }, {threshold: 0.05}).observe(root);
    }

    /* ---- the handle tests drive -------------------------------------- */

    var api = {
      run: run,
      pause: function () { userPaused = true; pause(); },
      restart: restart,
      draw: redraw,          // for a post that mutates state from its own input handler
      seed: function (n) { seed = n; restart(); },
      stepTo: function (n) {
        pause();
        if (n < iteration) restart();
        while (iteration < n && !finished) doStep();
        redraw();
        return iteration;
      },
      read: function () {
        var stats = {};
        Object.keys(statEls).forEach(function (k) { stats[k] = statEls[k].el.textContent; });
        return {iteration: iteration, finished: finished, stats: stats,
                controls: JSON.parse(JSON.stringify(controls)),
                status: statusEl ? statusEl.textContent : ''};
      },
      ctx: ctx
    };
    root.krViz = api;

    /* ---- go ---------------------------------------------------------- */

    fit();
    booting = false;
    ctx.state = cfg.init(ctx);
    redraw();
    if (reduce) {
      // the preference is set: show the first frame, let the reader start it
      userPaused = true;
      if (runBtn) runBtn.textContent = 'Play';
      reduceNotice = 'Paused for reduced motion.';
      ctx.status(reduceNotice);
    } else if (cfg.autostart !== false) {
      run();
    } else {
      // a demo that waits for its own Start button must not be started by
      // the visibility observer either
      userPaused = true;
      if (runBtn) runBtn.textContent = 'Play';
    }
    return api;
  }

  global.KRViz = {mount: mount, rng: mulberry32, colors: readColors};
})(window);
