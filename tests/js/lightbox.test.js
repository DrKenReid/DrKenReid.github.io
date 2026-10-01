/**
 * The photographs' lightbox helpers (js/lightbox.js): the caption markup
 * the gallery and the photo map share, and which thumbnail stands in for
 * a full frame while it loads. Run with Node's own runner:
 *   node --test "tests/js/*.test.js"
 *
 * lightbox.js runs after shared-components.js in the vm context that
 * tests/js/runtime.js builds, as it does on a page, with a jQuery that
 * has no Magnific, so it binds nothing and only defines its helpers.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT, loadRuntime } = require('./runtime.js');

const rt = loadRuntime('/gallery.html');
rt.window.jQuery = { fn: {} };
vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'lightbox.js'), 'utf8'), rt, { filename: 'lightbox.js' });
const caption = rt.window.krLightboxCaption;
const source = rt.window.krLightboxPreview.source;

// The link Magnific holds for an item, reduced to the one call made on it.
function link(imgSrc) {
    return [{ querySelector: () => (imgSrc ? { currentSrc: imgSrc } : null) }];
}

test('krLightboxCaption: words escaped, and carried whole for the announcement', () => {
    const html = caption({ text: 'Nature · <b>"Arbor"</b>', stem: '12' });
    assert.ok(!html.includes('<b>'), html);
    assert.match(html, /data-caption="Nature · &lt;b&gt;&quot;Arbor&quot;&lt;\/b&gt;"/);
    // The words and the number are one run of text.
    assert.match(html, /^<span class="kr-lightbox-what"><span class="kr-lightbox-words"[^>]*>[^<]*<\/span> <span class="kr-lightbox-num">#12<\/span><\/span>/);
});

test('krLightboxCaption: a place links to the map, and Copy link defaults to the gallery', () => {
    const html = caption({ text: 'Ann Arbor', stem: '12', place: 'Ann Arbor, Michigan' });
    assert.match(html, /href="\/map\.html\?region=Ann%20Arbor%2C%20Michigan"/);
    assert.ok(!html.includes('Open in the gallery'), html);
    assert.match(html, /<button type="button" class="kr-lightbox-copy" data-url="\/gallery\.html\?photo=12">Copy link<\/button>$/);
});

test('krLightboxCaption: the map asks for a gallery link; a given url is what Copy link copies', () => {
    const html = caption({ stem: '7', gallery: true, url: 'gallery.html?photo=7&tag=bw' });
    assert.ok(!html.includes('kr-lightbox-words'), 'no words, no words span');
    assert.match(html, /<a class="kr-lightbox-link" href="\/gallery\.html\?photo=7">Open in the gallery &rarr;<\/a>/);
    assert.match(html, /data-url="gallery\.html\?photo=7&amp;tag=bw"/);
    assert.ok(!html.includes('map.html'), html);
});

test('krLightboxPreview.source: the thumbnail the reader clicked', () => {
    const src = rt.KR_RELEASE + '12.png';
    assert.equal(source({ src, el: link('https://www.kenreid.co.uk/img/photography/thumb/12.webp') }),
        'https://www.kenreid.co.uk/img/photography/thumb/12.webp');
});

test('krLightboxPreview.source: the repository thumbnail of a release frame opened from data', () => {
    assert.equal(source({ src: rt.KR_RELEASE + '12.png' }), '/img/photography/thumb/12.webp');
    // A post in full resolution mode shows the original in its link: that
    // is the file being opened, not a smaller stand-in.
    assert.equal(source({ src: rt.KR_RELEASE + '12.png', el: link(rt.KR_RELEASE + '12.png') }),
        '/img/photography/thumb/12.webp');
});

test('krLightboxPreview.source: nothing for an image that is its own link', () => {
    assert.equal(source({ src: '/blog/img/chart.png', el: link('https://www.kenreid.co.uk/blog/img/chart.png') }), '');
    assert.equal(source({ src: '/blog/img/chart.png' }), '');
    assert.equal(source({ src: rt.KR_RELEASE + '../evil.png' }), '');
});
