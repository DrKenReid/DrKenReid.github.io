/**
 * The demo engine's run state (js/kr-viz.js), run with Node's own test
 * runner:  node --test "tests/js/*.test.js"
 *
 * What a reader sees of it is one button label and whether the canvas
 * moves, and each of these has been wrong on the live site: a finished
 * demo offered Play and Play did nothing, Restart after a finish came
 * back paused, demos started on the first visible pixel of a panel and
 * had finished before the reader scrolled to them, and on a phone turned
 * on its side the canvas was taller than the screen. The browser suites
 * drive the same handle (smoke_test.py, viz_verify.py); this pins the
 * rules themselves, frame by frame, without a browser.
 *
 * The second half holds the link to a run and full screen. A link's
 * fragment is text from a stranger, so most of it is what the engine must
 * refuse: another demo's id, a control it never built, a number outside a
 * slider's range, an option a select does not have, markup.
 *
 * The engine is a browser global script, so it runs in a vm with a stub
 * document just large enough to mount a demo: elements that keep their
 * children and listeners, a 2D context that ignores drawing, and
 * requestAnimationFrame, IntersectionObserver, timers, the address, the
 * clipboard and the Fullscreen API that the test drives by hand.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'kr-viz.js'), 'utf8');

function makeEl(tag) {
    const listeners = {};
    const attrs = {};
    return {
        tagName: String(tag).toUpperCase(), className: '', textContent: '',
        children: [], style: {}, value: '', checked: false, id: '',
        hidden: false, innerHTML: '', scrolled: 0, focused: false,
        scrollIntoView() { this.scrolled++; },
        focus() { this.focused = true; },
        appendChild(c) { this.children.push(c); c.parentNode = this; return c; },
        addEventListener(t, f) { (listeners[t] = listeners[t] || []).push(f); },
        dispatchEvent(ev) { (listeners[ev.type] || []).forEach(f => f(ev)); return true; },
        setAttribute(k, v) { attrs[k] = String(v); },
        getAttribute(k) { return k in attrs ? attrs[k] : null; },
        click() { (listeners.click || []).forEach(f => f({ type: 'click' })); },
        getBoundingClientRect() { return { left: 0, top: 0, width: 600, height: 300 }; },
    };
}

/* A 2D context that accepts any call and draws nothing. */
function fakeContext() {
    return new Proxy({}, {
        get: (t, k) => (k in t ? t[k] : k === 'measureText' ? () => ({ width: 10 }) : () => {}),
        set: (t, k, v) => { t[k] = v; return true; },
    });
}

const PAGE_URL = 'https://kenreid.test/blog/demo.html';

/* A page with one demo mount, #demo: a main canvas, a chart canvas and the
   three slots. `screen` and `width` are the root element's clientHeight and
   clientWidth, `reduce` the reduced-motion preference, `hash` the fragment
   the page was opened with, `clipboard` a navigator.clipboard, and
   `fullscreen` whether the browser can put an element full screen. */
function page({ screen = 900, width = 1440, reduce = false, hash = '',
                clipboard = null, fullscreen = false } = {}) {
    const frames = new Map();
    let nextFrame = 1;
    const observers = [];
    const heard = { window: {}, document: {} };
    const hear = (who) => (t, f) => { (heard[who][t] = heard[who][t] || []).push(f); };
    const fire = (who, t) => (heard[who][t] || []).forEach(f => f({ type: t }));
    const timers = [];
    const logged = [];
    const canvas = (cls) => Object.assign(makeEl('canvas'), {
        className: cls, clientWidth: 600, getContext: fakeContext,
    });
    const main = canvas('');
    const chart = canvas('kr-chart');
    const slots = {
        '[data-kr-toolbar]': makeEl('div'),
        '[data-kr-sliders]': makeEl('div'),
        '[data-kr-stats]': makeEl('div'),
        '#main': main,
        '#chart': chart,
    };
    const root = Object.assign(makeEl('div'), { id: 'demo', querySelector: (s) => slots[s] || null });
    main.parentNode = root;
    chart.parentNode = root;
    const doc = {
        createElement: makeEl,
        createTextNode: (t) => ({ textContent: t }),
        querySelector: () => null,
        documentElement: { clientHeight: screen, clientWidth: width },
        addEventListener: hear('document'),
        fullscreenEnabled: fullscreen,
        fullscreenElement: null,
        exitFullscreen() { full(null); return Promise.resolve(); },
    };
    /* Enter or leave full screen as the browser would: the element, then
       the event. Escape is full(null) with no click behind it. */
    function full(element) {
        doc.fullscreenElement = element;
        fire('document', 'fullscreenchange');
    }
    if (fullscreen) root.requestFullscreen = () => { full(root); return Promise.resolve(); };
    const window = {
        devicePixelRatio: 1,
        innerHeight: screen,
        innerWidth: width,
        addEventListener: hear('window'),
        location: { hash, href: PAGE_URL + hash },
        history: { state: null, replaceState(state, title, url) { window.location.href = url; } },
        navigator: clipboard ? { clipboard } : {},
        URLSearchParams,
        matchMedia: () => ({ matches: reduce }),
        requestAnimationFrame(cb) { frames.set(nextFrame, cb); return nextFrame++; },
        cancelAnimationFrame(id) { frames.delete(id); },
        IntersectionObserver: class {
            constructor(cb, opts) { this.cb = cb; this.opts = opts; observers.push(this); }
            observe(target) { this.target = target; }
        },
    };
    const keep = (...args) => { logged.push(args.join(' ')); };
    const context = vm.createContext({
        window,
        document: doc,
        getComputedStyle: () => ({
            getPropertyValue: (n) => (n === '--kr-bar-h' ? '70px' : '#123456'),
        }),
        MutationObserver: class { observe() {} },
        // timers wait for elapse(), and anything the engine logs is kept
        setTimeout: (f) => timers.push(f),
        clearTimeout: (id) => { if (id) timers[id - 1] = null; },
        console: { log: keep, info: keep, warn: keep, error: keep, debug: keep },
    });
    vm.runInContext(SOURCE, context, { filename: 'kr-viz.js' });

    let clock = 0;
    return {
        KRViz: window.KRViz, root, main, chart, toolbar: slots['[data-kr-toolbar]'],
        window, document: doc, logged, full,
        sliders: slots['[data-kr-sliders]'],
        /* Run every timer that is waiting. */
        elapse() { timers.splice(0).forEach(f => f && f()); },
        /* Change the fragment in place, as a pasted link or a click on a
           contents entry does. */
        go(fragment) {
            window.location.hash = fragment;
            window.location.href = PAGE_URL + fragment;
            fire('window', 'hashchange');
        },
        /* The window's load event. */
        load() { fire('window', 'load'); },
        /* Run `n` animation frames `ms` apart. */
        tick(n = 1, ms = 100) {
            for (let i = 0; i < n; i++) {
                clock += ms;
                const due = [...frames.entries()];
                frames.clear();
                due.forEach(([, cb]) => cb(clock));
            }
        },
        /* Tell the observer watching `target` that `ratio` of it is on screen. */
        see(target, ratio) {
            observers.filter(o => o.target === target).forEach(o => o.cb([{
                target, isIntersecting: ratio > 0, intersectionRatio: ratio,
            }]));
        },
    };
}

/* A demo that steps a counter and finishes at `finishAt`, at 10 steps a
   second (one step per 100ms frame). */
function mount(p, { finishAt = Infinity, mainHeight = 440 } = {}) {
    const viz = p.KRViz.mount(p.root, {
        speed: 10,
        canvases: {
            main: { el: '#main', height: () => mainHeight },
            chart: { el: '#chart', height: 120 },
        },
        buttons: ['run', 'step', 'restart'],
        stats: [{ id: 'n', label: 'Count' }],
        charts: [{ canvas: 'chart', panes: [{ series: [{ key: 'n' }] }] }],
        init: () => ({ n: 0 }),
        step: (ctx) => {
            ctx.state.n++;
            ctx.set('n', ctx.state.n);
            if (ctx.state.n >= finishAt) ctx.finish('Done.');
        },
        draw: () => {},
    });
    const button = (label) => p.toolbar.children.find(b => b.tagName === 'BUTTON' && b.textContent === label);
    const runButton = p.toolbar.children.find(b => / kr-run/.test(b.className));
    return { viz, button, runButton };
}

test('a demo waits for half its main canvas before it starts', () => {
    const p = page();
    const { viz, runButton } = mount(p);
    p.tick(3);
    assert.equal(viz.read().iteration, 0, 'mounting alone does not start it');
    assert.equal(runButton.textContent, 'Play');

    p.see(p.root, 0.05);          // a strip of the panel at the foot of the screen
    p.see(p.main, 0.2);
    p.tick(3);
    assert.equal(viz.read().iteration, 0, 'a strip of the panel does not start it');

    p.see(p.main, 0.5);
    p.tick(4);
    assert.ok(viz.read().iteration > 0, 'half the canvas starts it');
    assert.equal(runButton.textContent, 'Pause');

    p.see(p.main, 0);             // canvas gone, sliders and chart still on screen
    const before = viz.read().iteration;
    p.tick(3);
    assert.ok(viz.read().iteration > before, 'it keeps running while the panel is on screen');

    p.see(p.root, 0);             // the whole panel gone
    const gone = viz.read().iteration;
    p.tick(3);
    assert.equal(viz.read().iteration, gone, 'it pauses once none of it is on screen');
    assert.equal(runButton.textContent, 'Play');
});

test('a finished demo offers Run again, and one press runs it again', () => {
    const p = page();
    const { viz, runButton } = mount(p, { finishAt: 3 });
    p.see(p.root, 1); p.see(p.main, 1);
    p.tick(10);
    assert.equal(viz.read().finished, true);
    assert.equal(runButton.textContent, 'Run again');

    runButton.click();
    assert.equal(viz.read().finished, false);
    assert.equal(viz.read().iteration, 0);
    assert.equal(runButton.textContent, 'Pause');
    p.tick(3);
    assert.ok(viz.read().iteration > 0, 'the new run is playing');
});

test('Restart plays on unless the reader paused', () => {
    const p = page();
    const { viz, button, runButton } = mount(p, { finishAt: 3 });
    p.see(p.root, 1); p.see(p.main, 1);
    p.tick(10);
    assert.equal(viz.read().finished, true);

    button('Restart').click();
    assert.equal(runButton.textContent, 'Pause', 'a finished demo restarts playing');
    p.tick(2);
    assert.ok(viz.read().iteration > 0);

    runButton.click();            // the reader pauses
    assert.equal(runButton.textContent, 'Play');
    button('Restart').click();
    p.tick(3);
    assert.equal(viz.read().iteration, 0, 'a paused demo restarts paused');
    assert.equal(runButton.textContent, 'Play');
});

test('Step takes one step, pauses, and survives scrolling away and back', () => {
    const p = page();
    const { viz, button, runButton } = mount(p);
    p.see(p.root, 1); p.see(p.main, 1);
    p.tick(3);
    const at = viz.read().iteration;

    button('Step').click();
    assert.equal(viz.read().iteration, at + 1);
    assert.equal(runButton.textContent, 'Play');
    p.tick(3);
    assert.equal(viz.read().iteration, at + 1, 'it stays paused');

    p.see(p.root, 0); p.see(p.main, 0);
    p.see(p.root, 1); p.see(p.main, 1);
    p.tick(3);
    assert.equal(viz.read().iteration, at + 1, 'coming back does not restart it');
});

test('Step on a finished demo starts it over one step at a time', () => {
    const p = page();
    const { viz, button } = mount(p, { finishAt: 3 });
    viz.stepTo(10);
    assert.equal(viz.read().finished, true);
    button('Step').click();
    assert.equal(viz.read().iteration, 1);
    assert.equal(viz.read().finished, false);
});

test('stepTo backwards leaves the demo paused, for the tests that drive it', () => {
    const p = page();
    const { viz, runButton } = mount(p);
    p.see(p.root, 1); p.see(p.main, 1);
    viz.stepTo(5);
    viz.stepTo(2);
    p.tick(5);
    assert.equal(viz.read().iteration, 2);
    assert.equal(runButton.textContent, 'Play');
});

test('reduced motion mounts paused and the observer leaves it paused', () => {
    const p = page({ reduce: true });
    const { viz, runButton } = mount(p);
    p.see(p.root, 1); p.see(p.main, 1);
    p.tick(5);
    assert.equal(viz.read().iteration, 0);
    assert.equal(viz.read().status, 'Paused for reduced motion.');
    assert.equal(runButton.textContent, 'Play');
});

test('on a short screen a drawing canvas is held under the screen, a chart is not', () => {
    // 844 x 390: 0.65 of the 320px under the 70px header
    const short = page({ screen: 390, width: 844 });
    mount(short, { mainHeight: 440 });
    assert.equal(short.main.style.height, '208px');
    assert.equal(short.chart.style.height, '120px');

    const tall = page({ screen: 900 });
    mount(tall, { mainHeight: 440 });
    assert.equal(tall.main.style.height, '440px', 'an ordinary screen is not capped');

    const tiny = page({ screen: 250, width: 600 });
    mount(tiny, { mainHeight: 440 });
    assert.equal(tiny.main.style.height, '160px', 'never below SHORT_MIN');

    // an upright phone scrolls past a tall canvas, and a narrow canvas's
    // stacked panes need their height (the tree under the plot in GP)
    const upright = page({ screen: 553, width: 375 });
    mount(upright, { mainHeight: 433 });
    assert.equal(upright.main.style.height, '433px', 'an upright screen is not capped');
});

/* ---- a link to a run ---------------------------------------------------- */

/* A seeded demo with one of each control: a select, a checkbox, a slider
   in steps of 5, one in steps of 0.05, one whose top value is off its own
   steps, and the speed slider. Its state keeps the first random number, so
   a test can tell which seed the run was built from. */
function mountShared(p, extra = {}) {
    const viz = p.KRViz.mount(p.root, Object.assign({
        seed: 7,
        canvases: {
            main: { el: '#main', height: () => 300 },
            chart: { el: '#chart', height: 120 },
        },
        buttons: ['run', 'restart'],
        controls: [
            { id: 'land', type: 'select', label: 'Landscape', value: 'bowl',
              options: [{ value: 'bowl', label: 'Bowl' }, { value: 'egg carton', label: 'Egg carton' }] },
            { id: 'elite', type: 'check', label: 'Elitism', value: true },
            { id: 'n', label: 'Swarm size', min: 5, max: 80, step: 5, value: 30, restart: true },
            { id: 'w', label: 'Inertia', min: 0, max: 1, step: 0.05, value: 0.7 },
            { id: 'k', label: 'Neighbours', min: 0, max: 10, step: 4, value: 4 },
            'speed',
        ],
        init: (ctx) => ({ n: 0, first: ctx.rng() }),
        step: (ctx) => { ctx.state.n++; },
        draw: () => {},
    }, extra));
    const runButton = p.toolbar.children.find(b => / kr-run/.test(b.className));
    return { viz, runButton, tool: (label) => tool(p, label) };
}

const DEFAULTS = { land: 'bowl', elite: true, n: 30, w: 0.7, k: 4, speed: 6 };
const DEFAULT_LINK = '#run:demo:7&land=bowl&elite=1&n=30&w=0.7&k=4&speed=6';
const COPY = 'Copy link to this run';

/* One of the engine's tool buttons, wherever it put the group, by label. */
function tool(p, label) {
    const group = [...p.toolbar.children, ...p.root.children].find(c => c.className === 'kr-tools');
    return group ? group.children.find(b => b.getAttribute('aria-label') === label) : undefined;
}

const liveRegion = (p) => p.root.children.find(c => c.getAttribute('aria-live') === 'polite');
const copyNote = (p) => p.toolbar.children.find(c => c.className === 'kr-tools').children[0];
const firstOf = (p, seed) => p.KRViz.rng(seed)();
/* The controls as an object of this realm (the engine's come from the vm). */
const controlsOf = (viz) => ({ ...viz.read().controls });
/* Promise callbacks (the clipboard's answer) have run by the time this resolves. */
const settled = () => new Promise(resolve => setImmediate(resolve));

/* Every string the engine left in the page, to look for a stranger's. */
function written(node, out = []) {
    ['textContent', 'innerHTML', 'value', 'className', 'id'].forEach(k => out.push(String(node[k])));
    (node.children || []).forEach(c => written(c, out));
    return out.join('\n');
}

test('a link names the demo, its seed and every control', () => {
    const p = page();
    const { viz } = mountShared(p);
    assert.equal(viz.link(), DEFAULT_LINK);

    const slider = p.sliders.children[0].children.find(c => c.type === 'range');
    slider.value = 55;
    slider.dispatchEvent({ type: 'input' });
    viz.seed(20260807);
    assert.equal(viz.link(), '#run:demo:20260807&land=bowl&elite=1&n=55&w=0.7&k=4&speed=6');
});

test('a link is escaped: an id or an option cannot break out of its field', () => {
    const awkward = {
        controls: [{ id: 'a&b', type: 'select', label: 'Pick', value: 'x=1&y', options: ['x=1&y', 'plain'] }],
    };
    const p = page();
    p.root.id = 'my demo&x=1';
    assert.equal(mountShared(p, awkward).viz.link(), '#run:my%20demo%26x%3D1:7&a%26b=x%3D1%26y');

    // and it comes back as written
    const again = page({ hash: '#run:my%20demo%26x%3D1:9&a%26b=plain' });
    again.root.id = 'my demo&x=1';
    assert.equal(mountShared(again, awkward).viz.read().controls['a&b'], 'plain');
});

test('opening a link restores the seed and the controls before the first frame', () => {
    const link = '#run:demo:42&land=egg%20carton&elite=0&n=55&w=0.25&k=8&speed=12';
    const p = page({ hash: link });
    const { viz, runButton } = mountShared(p);
    assert.deepEqual(controlsOf(viz),
        { land: 'egg carton', elite: false, n: 55, w: 0.25, k: 8, speed: 12 });
    assert.equal(viz.ctx.state.first, firstOf(p, 42), 'the first state was built from the seed in the link');
    assert.equal(viz.link(), link, 'and the demo now gives the same link back');
    assert.equal(p.root.scrolled, 1, 'the page goes to the demo');
    p.load();
    assert.equal(p.root.scrolled, 2, 'and again once everything above it has loaded');

    // from there it is an ordinary mount: it waits to be on screen
    p.tick(3);
    assert.equal(viz.read().iteration, 0);
    p.see(p.root, 1); p.see(p.main, 1);
    p.tick(3);
    assert.ok(viz.read().iteration > 0);
    assert.equal(runButton.textContent, 'Pause');
    assert.deepEqual(p.logged, []);
});

test('a slider takes a number from a link only inside its range and on its steps', () => {
    const open = (query) => {
        const p = page({ hash: '#run:demo:7&' + query });
        return mountShared(p).viz.read().controls;
    };
    assert.equal(open('n=500').n, 80, 'above the maximum');
    assert.equal(open('n=-3').n, 5, 'below the minimum');
    assert.equal(open('n=33').n, 35, 'between steps, to the nearer');
    assert.equal(open('n=32').n, 30);
    assert.equal(open('w=0.33').w, 0.35, 'a fractional step, without float dust');
    assert.equal(open('w=7').w, 1);
    assert.equal(open('k=10').k, 8, 'a maximum that is off the steps is not reached');
    assert.equal(open('speed=9999').speed, 40, 'the speed slider is a slider like any other');
    assert.equal(open('n=55.0').n, 55);
});

test('a link is refused where it does not fit, and nothing is logged', () => {
    const untouched = (hash, why) => {
        const p = page({ hash });
        const { viz } = mountShared(p);
        assert.deepEqual(controlsOf(viz), DEFAULTS, why);
        assert.equal(viz.link(), DEFAULT_LINK, why);
        assert.deepEqual(p.logged, [], why);
        return p;
    };
    // not a link to a run at all
    assert.equal(untouched('#some-heading', 'a heading anchor').root.scrolled, 0);
    assert.equal(untouched('', 'no fragment').root.scrolled, 0);
    assert.equal(untouched('#run', 'the word alone').root.scrolled, 0);
    assert.equal(untouched('#run=demo&seed=42&n=55', 'another syntax').root.scrolled, 0);
    // another demo's link: this one neither changes nor takes the page
    assert.equal(untouched('#run:other:42&n=55', 'another id').root.scrolled, 0);
    assert.equal(untouched('#run:demo2:42&n=55', 'an id that only starts the same').root.scrolled, 0);
    // a seed that is not a short whole number refuses the whole link
    untouched('#run:demo:4x2&n=55', 'letters in the seed');
    untouched('#run:demo:-42&n=55', 'a negative seed');
    untouched('#run:demo:12345678901&n=55', 'an eleven-digit seed');
    untouched('#run:demo:&n=55', 'an empty seed');
    untouched('#run:demo:42:9&n=55', 'a third field');
    // values no control would give
    untouched('#run:demo:7&n=1e3&w=abc&k=&speed=0x10', 'numbers that are not plain decimals');
    untouched('#run:demo:7&n=%2055&w=0.5px&k=Infinity&speed=NaN', 'padded, suffixed, not finite');
    untouched('#run:demo:7&land=volcano&elite=yes', 'an option the select lacks, a checkbox that is not 0 or 1');
    untouched('#run:demo:7&land=Bowl&elite=true', 'options are matched to the letter');
    untouched('#run:demo:7&land=%E0%A4%A&n=%&w=%zz', 'broken percent escapes');
    untouched('#run:demo:7&bogus=1&toString=2&__proto__=3&constructor=4', 'controls it never built');
});

test('a link changes what it can and leaves the rest', () => {
    const p = page({ hash: '#run:demo:42&bogus=1&n=55&land=volcano&elite=0&w=abc' });
    const { viz } = mountShared(p);
    assert.deepEqual(controlsOf(viz), Object.assign({}, DEFAULTS, { n: 55, elite: false }));
    assert.equal(viz.ctx.state.first, firstOf(p, 42));
    assert.ok(!('bogus' in viz.read().controls));

    const bare = page({ hash: '#run:demo' });
    assert.equal(mountShared(bare).viz.link(), DEFAULT_LINK, 'the id alone keeps the seed and the controls');
    assert.equal(bare.root.scrolled, 1, 'and still takes the page to the demo');
});

test('markup in a link never reaches the page', () => {
    const shout = '%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E';
    const p = page({ hash: '#run:demo:7&land=' + shout + '&n=' + shout + '&elite=' + shout + '&' + shout + '=1' });
    const { viz } = mountShared(p);
    assert.deepEqual(controlsOf(viz), DEFAULTS);
    assert.ok(!/onerror|<img/.test(written(p.root)), 'no element holds it, as text or as markup');
    assert.deepEqual(p.logged, []);
});

test('a link pasted into the open page restarts the demo on it', () => {
    const p = page();
    const { viz, runButton } = mountShared(p);
    p.see(p.root, 1); p.see(p.main, 1);
    p.tick(5);
    assert.ok(viz.read().iteration > 0);

    p.go('#run:demo:99&n=10');
    assert.equal(viz.read().controls.n, 10);
    assert.equal(viz.read().iteration, 0, 'from the start');
    assert.equal(viz.ctx.state.first, firstOf(p, 99), 'on the seed in the link');
    assert.equal(p.root.scrolled, 1);
    p.tick(3);
    assert.ok(viz.read().iteration > 0, 'and it plays on, as after Restart');

    runButton.click();            // the reader pauses
    p.go('#run:demo:5&n=20');
    p.tick(3);
    assert.equal(viz.read().controls.n, 20);
    assert.equal(viz.read().iteration, 0, 'a paused demo takes the link and stays paused');

    p.go('#some-heading');        // the contents rail
    p.go('#run:other:1&n=80');
    assert.equal(viz.read().controls.n, 20, 'a heading or another demo changes nothing');
    assert.equal(p.root.scrolled, 2);
});

test('under reduced motion a restored run waits on its first frame', () => {
    const p = page({ reduce: true, hash: '#run:demo:42&n=55' });
    const { viz, runButton } = mountShared(p);
    p.see(p.root, 1); p.see(p.main, 1);
    p.tick(5);
    assert.equal(viz.read().controls.n, 55);
    assert.equal(viz.read().iteration, 0);
    assert.equal(viz.read().status, 'Paused for reduced motion.');
    assert.equal(runButton.textContent, 'Play');
});

test('a demo with nothing to put in a link has no link button', () => {
    const plain = page();
    const { viz } = mount(plain);                 // no seed, no controls
    assert.equal(tool(plain, COPY), undefined);
    assert.equal(viz.link(), '');

    const seeded = page();
    const walk = seeded.KRViz.mount(seeded.root, {
        seed: 20261103, canvases: { main: { el: '#main', height: 200 } }, buttons: ['run'],
        init: () => ({}), step: () => {}, draw: () => {},
    });
    assert.ok(tool(seeded, COPY), 'a seed alone is worth a link');
    assert.equal(walk.link(), '#run:demo:20261103');

    const unseeded = page();
    const calc = unseeded.KRViz.mount(unseeded.root, {
        canvases: { main: { el: '#main', height: 200 } },
        controls: [{ id: 'pay', label: 'Payment', min: 120, max: 400, step: 10, value: 220 }],
        init: () => ({}), step: () => {}, draw: () => {},
    });
    assert.equal(calc.link(), '#run:demo&pay=220', 'controls alone, with no seed in it');

    const optedOut = page({ hash: '#run:demo:42&n=55' });
    const silent = mountShared(optedOut, { share: false });
    assert.equal(silent.tool(COPY), undefined);
    assert.equal(silent.viz.link(), '');
    assert.equal(silent.viz.read().controls.n, 30, 'and it takes no link either');

    const nameless = page();
    nameless.root.id = '';
    assert.equal(mountShared(nameless).tool(COPY), undefined, 'a mount with no id cannot be named in one');
});

test('Copy link puts the link on the clipboard, shows it and says it once', async () => {
    const copied = [];
    const p = page({
        hash: '#some-heading',
        clipboard: { writeText: (t) => { copied.push(t); return Promise.resolve(); } },
    });
    const button = mountShared(p).tool(COPY);
    assert.equal(button.tagName, 'BUTTON');
    assert.equal(button.type, 'button');
    assert.equal(button.getAttribute('aria-pressed'), null);
    assert.equal(copyNote(p).hidden, true);

    button.click();
    await settled();
    assert.deepEqual(copied, [PAGE_URL + DEFAULT_LINK], 'the page, without the fragment it had');
    assert.equal(copyNote(p).textContent, 'Link copied');
    assert.equal(copyNote(p).hidden, false);
    assert.equal(liveRegion(p).textContent, 'Link copied');
    assert.equal(copyNote(p).getAttribute('aria-live'), null, 'the note is not a second live region');
    assert.equal(p.window.location.href, PAGE_URL + '#some-heading', 'the address is left alone');

    p.elapse();
    assert.equal(copyNote(p).hidden, true, 'the note goes again');
});

test('with no clipboard, or a refusal, the link goes to the address bar', async () => {
    const none = page();
    mountShared(none).tool(COPY).click();
    assert.equal(none.window.location.href, PAGE_URL + DEFAULT_LINK);
    assert.equal(copyNote(none).textContent, 'Link is in the address bar');
    assert.equal(liveRegion(none).textContent, 'Link is in the address bar');

    const refused = page({ clipboard: { writeText: () => Promise.reject(new Error('denied')) } });
    mountShared(refused).tool(COPY).click();
    await settled();
    assert.equal(refused.window.location.href, PAGE_URL + DEFAULT_LINK);
    assert.equal(copyNote(refused).textContent, 'Link is in the address bar');
    assert.deepEqual(refused.logged, []);
});

/* ---- full screen -------------------------------------------------------- */

const ENTER = 'Enter fullscreen';
const EXIT = 'Exit fullscreen';

test('there is no full-screen button where an element cannot go full screen', () => {
    const phone = page();                         // no requestFullscreen
    mountShared(phone);
    assert.equal(tool(phone, ENTER), undefined);

    const optedOut = page({ fullscreen: true });
    mountShared(optedOut, { fullscreen: false });
    assert.equal(tool(optedOut, ENTER), undefined);
});

test('the full-screen button enters, leaves, and names what it will do', () => {
    const p = page({ fullscreen: true });
    mountShared(p);
    const button = tool(p, ENTER);
    assert.equal(button.getAttribute('aria-pressed'), null, 'an action label, not a pressed state');

    button.click();
    assert.equal(p.document.fullscreenElement, p.root);
    assert.equal(button.getAttribute('aria-label'), EXIT);
    assert.equal(button.focused, true, 'focus stays on the button');

    button.click();
    assert.equal(p.document.fullscreenElement, null);
    assert.equal(button.getAttribute('aria-label'), ENTER);

    button.click();
    p.full(null);                                 // Escape
    assert.equal(button.getAttribute('aria-label'), ENTER, 'Escape flips the label back too');
});

test('full screen, the main canvas is drawn at the height the frame gives it', () => {
    const p = page({ fullscreen: true });
    mountShared(p);
    assert.match(p.main.className, /(^| )kr-lead( |$)/);
    assert.equal(p.main.height, 300);

    p.main.clientHeight = 700;                    // what the stretched box measures
    tool(p, ENTER).click();
    p.tick();
    assert.equal(p.main.style.height, '300px', 'the height the post asked for is the least it can be');
    assert.equal(p.main.height, 700, 'the drawing uses the height it was given');
    assert.equal(p.chart.height, 120, 'a chart keeps its height');

    p.main.clientHeight = 300;
    tool(p, EXIT).click();
    p.tick();
    assert.equal(p.main.height, 300, 'and back');
});

test('a main canvas inside a grid of the post does not stretch', () => {
    const p = page({ fullscreen: true });
    p.main.parentNode = makeEl('div');
    mountShared(p);
    assert.doesNotMatch(p.main.className, /kr-lead/);
    p.main.clientHeight = 700;
    tool(p, ENTER).click();
    p.tick();
    assert.equal(p.main.height, 300);
});

test('full screen, a frame a little taller than the screen shortens its main canvas to fit', () => {
    /* The frame's scrollHeight with the canvas at its 300px, on a screen
       `screen` tall; `given` is what the shortened box then measures. */
    const enter = (screen, content, given) => {
        const p = page({ fullscreen: true });
        mountShared(p);
        Object.assign(p.root, { clientHeight: screen, scrollHeight: content });
        p.main.clientHeight = given;
        tool(p, ENTER).click();
        p.tick();
        return p.main;
    };
    const fitted = enter(900, 950, 250);
    assert.equal(fitted.style.height, '250px', '50px over: 50px shorter');
    assert.equal(fitted.height, 250);

    assert.equal(enter(900, 1040, 160).style.height, '160px', 'down to SHORT_MIN');
    assert.equal(enter(900, 1041, 300).style.height, '300px', 'and no further');

    // an upright phone: nothing would make it fit, so it keeps its height and the frame scrolls
    const phone = enter(780, 1300, 300);
    assert.equal(phone.style.height, '300px');
    assert.equal(phone.height, 300);
});

test('a mount with no toolbar gets full screen at its foot, and no link button', () => {
    const p = page({ fullscreen: true });
    p.root.querySelector = (s) => (s === '#main' ? p.main : null);
    const viz = p.KRViz.mount(p.root, {
        seed: 12345, canvases: { main: { el: '#main', height: 300 } },
        init: () => ({}), step: () => {}, draw: () => {},
    });
    assert.ok(tool(p, ENTER));
    assert.equal(tool(p, COPY), undefined);
    assert.equal(viz.link(), '');
});
