# The viz engine

The interactive posts (the Algorithms, Live and Research, Live series) run
their simulations on one engine: `js/kr-viz.js` for the behaviour and the
`.kr-viz` component in `style.css` §12 for the chrome. A post supplies its
algorithm and its drawing; the engine supplies everything else.
`git grep -l "KRViz.mount" blog` lists the posts that use it.
(The essay: [How the Interactive Posts Work](https://www.kenreid.co.uk/blog/how-the-interactive-posts-work.html).)

- [Why](#why): what the engine is for, and the behaviours it owns.
- [Reference](#reference): markup, options, the context, the handle,
  keyboard, reduced motion, a complete example, and how to check a demo.

## Why

Measured across the fourteen canvas widgets before the engine was
written:

| | count |
|---|---|
| lines of widget JavaScript | ~7,400 |
| `fitOne` copies, byte-identical | 14 |
| seeded random generator copies (4 variants, drifted) | 16 |
| `vizColors` copies (5 variants, drifted) | 16 |
| `drawChart` copies, no two the same | 16 |
| hand-written `textContent =` stat updates | 201 |
| slider and button wirings | 96 |

The drift is the part that matters. Five versions of the palette reader
existed because there was nowhere to put one, and every fix to one of
them had to be found and made fourteen times.

### Who owns what

The engine owns the chrome: canvas sizing and pixel density, the palette
and its theme changes, the run loop and speed, the controls, the stat
tiles, the charts, and the behaviours below.

The post owns the algorithm and the drawing. `init`, `step` and `draw`
stay in the post as plain functions a reader can follow in view-source.
A post that turned into a configuration file would have lost the thing
it was written to teach.

What the engine does not do: own an algorithm, own the drawing, or
replace furniture particular to one demo. Pills, boards, legends and grids
keep the post's own class prefix (`.vns-pill`) and live in the post's
`<style>`.

### Behaviours no post has to remember

These are as much the reason for the engine as the deduplication.

**Reduced motion.** Under `prefers-reduced-motion` a demo mounts paused,
draws its first frame so it is not a blank box, and says "Paused for
reduced motion." The Play button is the way in. Before the engine, not
one widget did this, and thirteen autostarted.

**Pausing offscreen.** An `IntersectionObserver` stops the loop when the
demo scrolls out of view and resumes it on return, unless the reader
paused it. A demo near the top of a long post no longer runs for the
whole read.

**Announcing the status, and only that.** The visible status line is not
a live region. Posts that wrote a counter every step were changing it
around fifty times a second (121 mutations in two seconds on one demo),
which makes a screen reader useless. Announcements go to a hidden
`.kr-sr-only` region instead, at most one every 1.2 seconds, always the
latest text. Stat tiles stay silent while running.

**Saying what it found.** `ctx.finish(text)` pauses the run and announces
at once, with a summary built from the stat tiles ("Finished. Iteration
412, Best 1,284"). A canvas's `aria-label` says what the demo is; this
says what it did.

**Keyboard access to a clickable canvas.** A canvas with
`.kr-interactive` gets `tabindex="0"`, a hidden hint naming the keys, and
a drawn cursor. The engine replays the post's own `pointerdown`,
`pointerup` and `click` handlers at the cursor, so no post writes key
handling. Before this, eight canvases invited readers to "click or tap"
with no keyboard path at all, a WCAG 2.1.1 failure.

**A deterministic handle for tests.** Every mount exposes `el.krViz`
([below](#the-handle)): seed a run, step it to an iteration without
drawing every frame, read the tiles. That is what lets the smoke suite
assert that a demo converges and is reproducible, rather than only that
it drew something.

**One meaning of speed.** Speed was four incompatible scales across the
widgets. It is now steps per second everywhere; the engine decides how
many steps to run in each frame to hit it.

**One chart renderer**, configured rather than rewritten: one to three
series over iterations, linear or log scale, categorical ticks, step
plots, fills, a legend from the series labels, and a second pane that
stacks under the first below 480px instead of squeezing beside it.

**Canvas sizing.** Height is a function of the measured width, never a
constant, so a phone gets a taller canvas instead of a squashed strip.
The backing store follows `devicePixelRatio` up to `MAX_DPR` (2), is
reallocated only when the box or the density changes (a phone's address
bar firing `resize` no longer blanks a paused demo), and the palette is
read again when the theme changes.

### How the demos moved onto it

A widget with standard chrome was rewritten against the options below. A
widget with its own layout, or one too large to retype safely, kept its
algorithm, drawing and controls, and only lost its boilerplate: its
palette reader became a shim over the engine's, its canvas contexts were
bound per frame, and its own buttons drove the mount through its handle.
The ant colony and simulated annealing demos went that way, which is why
their markup differs from the rest.

## Reference

### Markup

```html
<div class="kr-viz" id="hello-demo">
  <canvas id="helloMain" class="kr-interactive" height="300" role="img"
          aria-label="What is drawn, and what clicking it does"></canvas>
  <div class="kr-toolbar" data-kr-toolbar></div>
  <div class="kr-sliders" data-kr-sliders></div>
  <div class="kr-stats" data-kr-stats></div>
  <canvas id="helloChart" class="kr-chart" height="120" role="img"
          aria-label="What the chart plots"></canvas>
  <p class="kr-note">What the reader is looking at.</p>
</div>
<script src="../js/kr-viz.js?v=<stamp>"></script>
<script>/* the mount, below */</script>
```

- The three `data-kr-*` slots are where the engine builds its chrome.
  Sliders go in `data-kr-sliders`; buttons, the status line, and select
  and checkbox controls go in `data-kr-toolbar`; stat tiles go in
  `data-kr-stats`. Leave a slot out only when you pass no options for it:
  the engine appends to each slot without checking, so buttons without a
  `data-kr-toolbar` slot throw at mount. (The status line alone is
  skipped when there is no toolbar.)
- The `height` attributes are a no-JavaScript fallback; the engine sets
  the real height from the width.
- Every canvas has `role="img"` and an `aria-label` that says what is
  drawn and, if it takes input, what tapping does. It is all a screen
  reader gets while the demo runs, so it earns its length.
- `.kr-interactive` on a canvas that takes clicks or taps: the crosshair
  cursor and keyboard operation. Not on the chart.
- `.kr-drag` only on a canvas dragged in two dimensions. It sets
  `touch-action: none`, which on a phone, where these demos are full width
  and nearly square, would trap a reader trying to scroll past a
  tap-only canvas.
- Include `js/kr-viz.js` before the post's script. It is one of the
  audit's `OPTIONAL_POST_SCRIPTS`, and `generate_post_facets.py` marks the
  post `interactive` (the blog's "posts with a live demo" filter) when it
  calls `KRViz.mount`. The `.kr-viz` class alone does not count, because
  the frame also hosts static figures.

### Colours

The engine reads `--viz-s1` to `--viz-s8` (series) and `--viz-ink`,
`--viz-muted`, `--viz-grid`, `--viz-surface`, `--viz-border`,
`--viz-cell` from the mount element with `getComputedStyle`, and reads
them again whenever `data-theme` changes, so the canvas restyles with the
page. §12 sets `s1` to `s4` (blue, green, amber, red) and the surface
tokens for both themes. A post that needs other series colours sets them
on its container, in both themes:

```css
.kr-viz { --viz-s1: #2a78d6; }
[data-theme="dark"] .kr-viz { --viz-s1: #4a97ef; }
```

In a drawing, read them from `ctx.colors` (`ctx.colors.s1`,
`ctx.colors.ink`), never as literals.

### KRViz.mount(target, options)

`target` is a selector or an element. Returns the handle, or `null` when
the target is not on the page.

| Option | Default | Meaning |
|---|---|---|
| `seed` | 1 | seed for `ctx.rng`; the same seed gives the same run |
| `canvases` | | `{name: {el, height, mobile}}`: `el` a selector (looked up inside the mount first) or an element; `height` a number or a function of the measured width; `mobile: {height}` replaces it below 480px |
| `buttons` | | `'run'` (Pause/Play), `'restart'`, or `{id, label, onClick(handle)}`; an `onClick` replaces the default behaviour |
| `controls` | | sliders `{id, label, min, max, step, value, fmt, unit, restart}`; `'speed'` (or `{id: 'speed', min, max, value}`) for steps per second; `{id, label, type: 'check', value, restart}`; `{id, label, type: 'select', options, value, restart}`. A slider or checkbox redraws on change and restarts only with `restart: true`; a select restarts unless `restart: false` |
| `stats` | | `{id, label, tone, fmt}`: a tile; `tone` (`'s1'`...) adds a swatch |
| `charts` | | `[{canvas, panes: [...]}]`, see below |
| `speed` | 6 | steps per second when there is no speed slider, or a function of `ctx.controls` (for log-scaled sliders) |
| `maxStepsPerFrame` | `max(8, ceil(rate / 20))` | cap on steps in one frame, for a demo whose progress should be watchable rather than instant |
| `maxSamples` | 300 | how many `record()` samples the charts keep |
| `autostart` | true | `false`: wait for Play (and the visibility observer will not start it either) |
| `init(ctx)` | required | build the state from `ctx.controls` and `ctx.rng`; return it |
| `step(ctx)` | required | advance one iteration of `ctx.state`; call `ctx.record`, `ctx.set` |
| `draw(ctx)` | required | draw `ctx.state` on the canvases; called on a cleared canvas |

A chart pane is `{label, series: [{key, tone, label, step, fill, width}], log, yMin, yMax, yTicks}`.
`key` names a field of the objects passed to `ctx.record`; `step: true`
draws a series as steps; `fill: true` shades under it; `yTicks` is a list
of category labels for the values 1, 2, 3...; `log: true` puts the
y axis on powers of ten. A pane with `draw(g, x, y, w, h, colors, samples)`
draws itself and still gets the engine's layout and palette.

### The context

`ctx`, passed to `init`, `step` and `draw`:

| Member | Meaning |
|---|---|
| `ctx.canvas.<name>` | `{node, g, w, h, dpr}`: the element, its 2D context already scaled for the pixel ratio, and its size in CSS pixels |
| `ctx.colors` | the resolved `--viz-*` palette |
| `ctx.controls` | the current value of every control, by id |
| `ctx.rng()` | the seeded random source, 0 to 1; reset on restart |
| `ctx.state` | whatever `init` returned |
| `ctx.iteration` | steps taken since the last restart |
| `ctx.dt` | seconds since the last frame (at most 0.1), for eased motion |
| `ctx.phase` | 0 to 1, how far the clock has run toward the next step, so a drawing can glide between discrete steps |
| `ctx.set(id, value)` | write a stat tile (through its `fmt`) |
| `ctx.record(obj)` | add a sample for the charts |
| `ctx.status(text)` | the visible status line, announced politely |
| `ctx.finish(text)` | stop for good, and announce the result with the tiles' values |
| `ctx.samples()` | the recorded samples |

Never call `Math.random()` in a demo: take everything random from
`ctx.rng`, so a reload, a restart and a test all see the same run.

### The handle

The object `mount` returns is also on the element as `el.krViz`:

| Method | Does |
|---|---|
| `run()` | start or resume |
| `pause()` | pause (and remember that the reader paused it) |
| `restart()` | re-seed, rebuild the state with `init`, redraw |
| `draw()` | redraw now, for a post that changes the state from its own input handler |
| `seed(n)` | set a new seed and restart |
| `stepTo(n)` | pause, then step synchronously to iteration `n` (restarting first if `n` is behind, stopping early if the run finishes), drawing once; returns the iteration reached |
| `read()` | `{iteration, finished, stats, controls, status}` |
| `ctx` | the context above |

`KRViz.rng(seed)` is the same seeded generator for code outside a mount,
and `KRViz.colors(el)` reads the palette from any element.

### Keyboard

On a canvas with `.kr-interactive`: Tab focuses it and shows the cursor;
the arrow keys move it (Shift for finer steps); Enter or Space acts at the
cursor, by replaying the post's pointer events there; Escape hides the
cursor. Handle `pointerdown`, `pointerup` or `click` in the post and the
keyboard works with no further code.

### A complete example

```html
<div class="kr-viz" id="hello-demo">
  <canvas id="helloMain" class="kr-interactive" height="300" role="img"
          aria-label="Dots drifting toward the centre. Click to add a dot."></canvas>
  <div class="kr-toolbar" data-kr-toolbar></div>
  <div class="kr-sliders" data-kr-sliders></div>
  <div class="kr-stats" data-kr-stats></div>
  <canvas id="helloChart" class="kr-chart" height="120" role="img"
          aria-label="Chart of the mean distance to the centre over time"></canvas>
</div>
<script src="../js/kr-viz.js?v=<stamp>"></script>
<script>
(function () {
  'use strict';
  var viz = KRViz.mount('#hello-demo', {
    seed: 20260924,
    canvases: {
      main:  {el: '#helloMain', height: function (w) { return Math.max(220, Math.min(320, w * 0.5)); }},
      chart: {el: '#helloChart', height: 120, mobile: {height: 160}}
    },
    buttons: ['run', 'restart'],
    controls: [{id: 'n', label: 'Dots', min: 5, max: 60, value: 20, restart: true}, 'speed'],
    stats: [{id: 'mean', label: 'Mean distance', tone: 's1', fmt: function (v) { return v.toFixed(1); }}],
    charts: [{canvas: 'chart', panes: [{label: 'MEAN DISTANCE', yMin: 0, series: [{key: 'mean', tone: 's1'}]}]}],

    init: function (ctx) {
      var dots = [];
      for (var i = 0; i < ctx.controls.n; i++) dots.push({x: ctx.rng(), y: ctx.rng()});
      return {dots: dots};
    },
    step: function (ctx) {
      var sum = 0;
      ctx.state.dots.forEach(function (d) {
        d.x += (0.5 - d.x) * 0.05; d.y += (0.5 - d.y) * 0.05;
        sum += Math.hypot(d.x - 0.5, d.y - 0.5);
      });
      var mean = 100 * sum / ctx.state.dots.length;
      ctx.set('mean', mean);
      ctx.record({mean: mean});
      if (mean < 0.5) ctx.finish('Every dot has reached the centre.');
    },
    draw: function (ctx) {
      var c = ctx.canvas.main;
      c.g.fillStyle = ctx.colors.s1;
      ctx.state.dots.forEach(function (d) {
        c.g.beginPath(); c.g.arc(d.x * c.w, d.y * c.h, 4, 0, Math.PI * 2); c.g.fill();
      });
    }
  });
  if (!viz) return;

  // A click adds a dot; the engine replays this for keyboard users too.
  document.getElementById('helloMain').addEventListener('click', function (e) {
    var r = e.currentTarget.getBoundingClientRect();
    viz.ctx.state.dots.push({x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height});
    viz.draw();
  });
})();
</script>
```

### Layout rules

- Never give a canvas a fixed rendered height; compute it from the width
  (`Math.max(250, Math.min(360, w * 0.55))` is a common shape).
- Two panes side by side on a desktop stack below 480px, with the canvas
  taller to compensate (`mobile: {height}`). Draw a pane with a function
  of its rectangle (`drawPane(x, y, w, h)`) so both layouts share one code
  path; the engine's own chart panes already do.
- Sliders go full width on a phone and the stat tiles reflow, both in
  §12. Do not restate either in the post.

### Checking a demo

- `python .github/scripts/viz_verify.py blog/tabu-search-live.html "#tabu-demo"`
  drives one demo through its handle in dark at 1200px and light at
  360px. It fails when the same seed and iteration give two different
  readouts, when `stepTo` lands on the wrong iteration, when something
  overflows, when a canvas is squashed, when the console logs an error,
  when an engine-owned status line is not a polite live region, or when
  the demo keeps running under reduced motion. It only prints the
  readout at iterations 1 and 120, and the buttons, sliders and tiles it
  found, so progress and the chrome are yours to read. Use it while
  building a demo.
- The smoke suite finds every post with a `<canvas>` by itself and checks
  it at 360px (`check_mobile`), for progress and reproducibility
  (`check_converges`), for keyboard operation, announced slider values and
  a quiet live region (`check_a11y`), and paused under reduced motion
  (`check_reduced_motion`).
- `check_post_template.py` then holds the post to the site's post template
  like any other.
