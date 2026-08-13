# The viz engine (Algorithms, Live and Learning, Live)

Status: built and in use by all 14 interactive posts (15 mounts, since
simulated annealing hosts two widgets). The CSS half is the `.kr-viz`
component in `style.css`; the JavaScript half is `js/kr-viz.js`.

Two migration routes proved useful. A widget whose chrome is standard was
rewritten against the contract below. A widget with its own layout, or one
too large to retype safely, kept its algorithm, drawing and controls where
they were, and only had the boilerplate removed: `vizColors` became a shim
over the engine's palette, the canvas contexts got bound per frame, and the
old buttons drove the mount through its handle. Ant colony and simulated
annealing went that way.

## Why

Measured across the 14 canvas widgets before any of this started:

| | count |
|---|---|
| lines of widget JavaScript | ~7,400 |
| `fitOne` copies, byte-identical | 14 |
| `mulberry32` copies (4 variants, drifted) | 16 |
| `vizColors` copies (5 variants, drifted) | 16 |
| `drawChart` copies, no two the same | 16 |
| hand-written `textContent =` stat updates | 201 |
| slider and button wirings | 96 |

The drift is the part that matters. Five versions of the palette reader
exist because there was nowhere to put one.

## Division of labour

The engine owns the chrome: layout, sizing, theme, the run loop, controls,
stat tiles, charts, and the cross-cutting behaviours below.

The post owns the algorithm and the drawing. `init`, `step` and `draw` stay
in the post as plain functions a reader can follow. A post that becomes a
configuration file has lost the thing it was written to teach.

## The contract

```js
KRViz.mount('#vns-demo', {
  seed: 20260812,

  canvases: {
    map:   {height: w => Math.max(250, Math.min(380, w * 0.62))},
    chart: {height: 150, mobile: {height: 320}, class: 'kr-chart'}
  },

  controls: [
    {id: 'cities', label: 'Cities', min: 30, max: 70, step: 5, value: 40},
    {id: 'kmax',   label: 'k max',  min: 1,  max: 4,  value: 4},
    {id: 'plain',  label: 'plain local search', type: 'check'},
    'speed'                                  // steps per second, see below
  ],

  buttons: ['run', 'restart', {id: 'new', label: 'New cities'}],

  stats: [
    {id: 'len', label: 'Tour length', tone: 's1'},
    {id: 'gap', label: 'Gap vs best', tone: 's2', fmt: v => v.toFixed(1) + '%'},
    {id: 'k',   label: 'Current k'}
  ],

  charts: [{
    canvas: 'chart',
    panes: [
      {label: 'TOUR LENGTH', series: [{key: 'now', tone: 's1'}, {key: 'best', tone: 's2'}]},
      {label: 'NEIGHBOURHOOD k', series: [{key: 'k', tone: 's3'}], step: true,
       yTicks: ['N1', 'N2', 'N3', 'N4']}
    ]
  }],

  init(ctx) { /* build state from ctx.controls and ctx.rng, return it */ },
  step(ctx) { /* advance one iteration, then ctx.record({now, best, k}) */ },
  draw(ctx) { /* draw state on ctx.canvas.map with ctx.colors */ }
});
```

`ctx` carries `controls` (current values), `rng` (seeded), `canvas` (contexts
by name, already scaled for devicePixelRatio), `colors` (resolved tokens),
`state` (whatever `init` returned), `iteration`, `set(id, value)` for stat
tiles and `record(obj)` for chart series.

## Cross-cutting behaviour the engine must own

These are the reasons the engine exists as much as the deduplication is.

**Reduced motion.** `style.css` honours `prefers-reduced-motion` in 11
places; not one of the 14 widgets does, and 13 of them autostart. Under the
reduced-motion preference the engine mounts paused, draws the first frame so
the widget is not a blank box, and leaves the run button as the way in.

**Pause when offscreen.** No widget does this today. One
`IntersectionObserver` in the engine stops the loop when the widget scrolls
out of view and resumes it on return. A demo near the top of a 3,000 word
post currently runs for the whole read.

**Announce the status line, and only that.** The visible `.kr-status` is not
itself a live region. Posts that write a counter every step were mutating it
around fifty times a second (measured: 121 mutations in two seconds on the
belt demo, 102 on VNS, 99 on hyper-heuristics), which makes a screen reader
useless. Announcements go instead to a hidden `.kr-sr-only` region, throttled
to at most one every 1.2 seconds, always carrying the latest text rather than
whichever landed on the tick. Stat tiles stay silent while running; five
counters updating every frame is noise, not information.

**Say what it found.** On `ctx.finish()` the engine announces immediately and
appends a summary built from the stat tiles ("Finished. Iterations 412, best
1,284"). The `aria-label` on a canvas describes what the demo *is*; without
this a screen reader never learns what it *did*.

**Keyboard access to a clickable canvas.** A canvas marked `.kr-interactive`
gets `tabindex="0"`, an `aria-describedby` hint naming the keys, and a drawn
cursor. Arrow keys move the cursor (Shift for finer steps), Enter or Space
acts at it, Escape hides it. The engine replays the same `pointerdown`,
`pointerup` and `click` events the post already handles at the cursor
position, so no post writes key handling of its own. Before this, eight
canvases advertised "click or tap to add points" in their own labels with no
keyboard path to it at all: a WCAG 2.1.1 failure, Level A.

**A deterministic test handle.** The engine exposes on the mount element:

```js
el.krViz = {
  pause(), run(), restart(),
  seed(n),            // reseed and restart
  stepTo(n),          // run synchronously to iteration n, drawing once
  read()              // {iteration, stats: {...}, controls: {...}}
}
```

This is what makes verification cheap. The CSS migration needed masked
screenshots, hidden readouts and a blind settle delay per page because the
demos could not be frozen. With `stepTo`, a check seeds a run, advances to a
known iteration and compares directly. It also lets `smoke_test.py` assert
that a demo converges, which BLOG-COMPONENTS 19 asks for and no post does.

## Speed

Speed is currently four incompatible things: 1 to 30, 10 to 600, 100 to
3000, and 0 to 100 mapped onto steps per second with a "k" suffix. The
engine standardises on **steps per second**, and decides for itself how many
steps to run per frame to hit it. A post that wants a different range sets
`speed: {min, max, value}`; the unit does not change.

## Charts

One renderer, configured rather than rewritten. It must cover what the 16
existing charts already do between them: one to three series over
iterations, linear or log y, a second pane that stacks below roughly 480px
instead of sitting beside, categorical y ticks (the k ladder), step plots as
well as lines, a legend built from the series list, and axis labels drawn
from resolved tokens so a theme flip restyles it.

## Canvas sizing

Height is a function of measured width, never a constant, per the rules
already in BLOG-COMPONENTS 19. The engine applies devicePixelRatio, redraws
on resize, and rebuilds the palette when `data-theme` changes on the root.

## What the engine will not do

- Own the algorithms. `step` stays in the post.
- Own the drawing. `draw` stays in the post.
- Replace bespoke widget furniture. Pills, boards, legends and grids keep
  the post's own prefix and live in its `<style>`.

## Rollout

Prototype against one unpublished draft end to end, compare the before and
after line counts, and only then decide whether it spreads. Nine of the
fourteen widgets are still drafts, so the engine can be proven without
touching a published post. Published posts get migrated one at a time, each
verified with the harness, as the CSS component was.
