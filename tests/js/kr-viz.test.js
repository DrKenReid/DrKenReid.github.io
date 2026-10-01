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
 * The engine is a browser global script, so it runs in a vm with a stub
 * document just large enough to mount a demo: elements that keep their
 * children and listeners, a 2D context that ignores drawing, and
 * requestAnimationFrame and IntersectionObserver that the test drives by
 * hand.
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

/* A page with one demo mount: a main canvas, a chart canvas and the three
   slots. `screen` and `width` are the root element's clientHeight and
   clientWidth, `reduce` the reduced-motion preference. */
function page({ screen = 900, width = 1440, reduce = false } = {}) {
    const frames = new Map();
    let nextFrame = 1;
    const observers = [];
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
    const root = Object.assign(makeEl('div'), { querySelector: (s) => slots[s] || null });
    const window = {
        devicePixelRatio: 1,
        innerHeight: screen,
        innerWidth: width,
        addEventListener() {},
        matchMedia: () => ({ matches: reduce }),
        requestAnimationFrame(cb) { frames.set(nextFrame, cb); return nextFrame++; },
        cancelAnimationFrame(id) { frames.delete(id); },
        IntersectionObserver: class {
            constructor(cb, opts) { this.cb = cb; this.opts = opts; observers.push(this); }
            observe(target) { this.target = target; }
        },
    };
    const context = vm.createContext({
        window,
        document: {
            createElement: makeEl,
            createTextNode: (t) => ({ textContent: t }),
            querySelector: () => null,
            documentElement: { clientHeight: screen, clientWidth: width },
        },
        getComputedStyle: () => ({
            getPropertyValue: (n) => (n === '--kr-bar-h' ? '70px' : '#123456'),
        }),
        MutationObserver: class { observe() {} },
        setTimeout, clearTimeout, console,
    });
    vm.runInContext(SOURCE, context, { filename: 'kr-viz.js' });

    let clock = 0;
    return {
        KRViz: window.KRViz, root, main, chart, toolbar: slots['[data-kr-toolbar]'],
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
