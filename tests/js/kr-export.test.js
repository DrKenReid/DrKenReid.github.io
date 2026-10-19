/**
 * The address printed under a saved diagram and the file it is saved as
 * (window.krExport in js/kr-export.js), run with Node's own test runner:
 * node --test "tests/js/*.test.js"
 *
 * The address is the page's canonical URL as a reader would type it:
 * no scheme, no "www.", no ".html" (GitHub Pages serves the page
 * without it), so a diagram passed around on its own still says where
 * it came from. The drawing itself needs a browser; the smoke suite and
 * a look at the saved file cover that.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'kr-export.js'), 'utf8');

function load() {
    const context = { window: {} };
    vm.createContext(context);
    vm.runInContext(SOURCE, context);
    return context.window.krExport;
}

test('the watermark is the canonical address without scheme, www or .html', () => {
    const { watermark } = load();
    assert.equal(watermark('https://www.kenreid.co.uk/blog/leading-a-horse-to-water.html'),
        'kenreid.co.uk/blog/leading-a-horse-to-water');
    assert.equal(watermark('http://kenreid.co.uk/series-research-live.html?x=1#top'),
        'kenreid.co.uk/series-research-live');
    assert.equal(watermark('https://www.kenreid.co.uk/index.html'), 'kenreid.co.uk');
    assert.equal(watermark('https://www.kenreid.co.uk/'), 'kenreid.co.uk');
    assert.equal(watermark(''), 'kenreid.co.uk');
});

test('the file is named for the site, the page and the diagram', () => {
    const { fileName } = load();
    const href = 'https://www.kenreid.co.uk/blog/hidden-cost-of-cobalt-congo.html';
    assert.equal(fileName(href, 'Cobalt supply chain'),
        'kenreid-hidden-cost-of-cobalt-congo-cobalt-supply-chain.png');
    assert.equal(fileName(href, "When the horse won't drink"),
        'kenreid-hidden-cost-of-cobalt-congo-when-the-horse-won-t-drink.png');
    assert.equal(fileName(href, ''), 'kenreid-hidden-cost-of-cobalt-congo-diagram.png');
    assert.equal(fileName('https://www.kenreid.co.uk/', 'x'), 'kenreid-home-x.png');
});

test('a long label is cut at a word, 48 characters at most', () => {
    const { fileName } = load();
    const name = fileName('https://www.kenreid.co.uk/blog/a.html',
        'A very long caption that keeps going well past any sensible length for a file');
    const label = name.replace(/^kenreid-a-/, '').replace(/\.png$/, '');
    assert.ok(label.length <= 48, label);
    assert.ok(!label.endsWith('-'), label);
    assert.equal(label, 'a-very-long-caption-that-keeps-going-well-past');
});
