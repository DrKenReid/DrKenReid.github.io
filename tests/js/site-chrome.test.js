/**
 * The site chrome's data and pure helpers (js/shared-components.js): the
 * site map the footer and palette read, the pager's page list, the topic
 * rows' selection and the prerender rules. Run with Node's own runner:
 *   node --test "tests/js/*.test.js"
 *
 * shared-components.js runs as it would on the homepage, in the vm
 * context tests/js/runtime.js builds; nothing here touches the DOM.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, loadRuntime } = require('./runtime.js');

const rt = loadRuntime('/index.html');
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'posts.json'), 'utf8'));

test('KR_PAGES: unique keys, pages that exist, known footer slots', () => {
    const keys = new Set();
    for (const page of rt.KR_PAGES) {
        assert.ok(!keys.has(page.key), `duplicate key ${page.key}`);
        keys.add(page.key);
        assert.match(page.href, /^[a-z_-]+\.html$/, page.href);
        assert.ok(fs.existsSync(path.join(ROOT, page.href)), `${page.href} does not exist`);
        assert.ok(page.label && page.blurb, `${page.key} needs a label and a blurb`);
        assert.ok(['explore', 'fine', false].includes(page.inFooter), `${page.key}: inFooter ${page.inFooter}`);
        assert.equal(typeof page.inPalette, 'boolean', `${page.key}: inPalette`);
    }
});

test('KR_PAGES: a parent is another listed page in the same footer slot', () => {
    const byKey = new Map(rt.KR_PAGES.map(p => [p.key, p]));
    for (const page of rt.KR_PAGES.filter(p => p.parent)) {
        const parent = byKey.get(page.parent);
        assert.ok(parent && parent !== page, `${page.key}: no page with key ${page.parent}`);
        assert.equal(parent.inFooter, page.inFooter, `${page.key} and ${page.parent} share a footer slot`);
        assert.ok(!parent.parent, `${page.parent} is itself filed under a page; the footer nests one level`);
    }
});

test('KR_PAGES: the series index is in the footer and the palette', () => {
    const series = rt.KR_PAGES.find(p => p.href === 'series.html');
    assert.ok(series, 'series.html is missing from KR_PAGES');
    assert.equal(series.inFooter, 'explore');
    assert.equal(series.inPalette, true);
});

test('krPageList: every page up to seven, then ends, neighbours and gaps', () => {
    assert.deepEqual([...rt.krPageList(1, 1)], [1]);
    assert.deepEqual([...rt.krPageList(3, 7)], [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual([...rt.krPageList(1, 12)], [1, 2, '…', 11, 12]);
    assert.deepEqual([...rt.krPageList(4, 12)], [1, 2, 3, 4, 5, '…', 11, 12]);
    assert.deepEqual([...rt.krPageList(6, 12)], [1, 2, '…', 5, 6, 7, '…', 11, 12]);
    // A gap of a single page shows that page rather than an ellipsis.
    assert.deepEqual([...rt.krPageList(5, 9)], [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let total = 1; total <= 30; total++) {
        for (let page = 1; page <= total; page++) {
            const list = [...rt.krPageList(page, total)];
            const numbers = list.filter(p => typeof p === 'number');
            assert.ok(numbers.includes(1) && numbers.includes(total) && numbers.includes(page), `${page}/${total}`);
            assert.deepEqual(numbers, [...numbers].sort((a, b) => a - b), `${page}/${total} is ordered`);
            list.forEach((p, i) => {
                if (typeof p === 'string') {
                    assert.equal(typeof list[i - 1], 'number', `${page}/${total}: gap after a page`);
                    assert.ok(list[i + 1] - list[i - 1] > 2, `${page}/${total}: a gap hides two or more`);
                }
            });
        }
    }
});

test('krTopicPosts: counts what the filtered listing shows', () => {
    const books = posts.filter(p => (p.tags || []).includes('books'));
    const pick = rt.krTopicPosts(posts, { tags: ['books'], limit: 3 });
    assert.equal(pick.matching, books.length);
    assert.equal(pick.posts.length, Math.min(3, books.length));
    assert.equal(pick.listed, pick.posts.length);
    // Spread: arrays made in the vm context have another realm's prototype.
    const dates = [...pick.posts].map(p => p.date);
    assert.deepEqual(dates, [...dates].sort().reverse(), 'newest first');
});

test('krTopicPosts: a pinned post leads and is not counted unless tagged', () => {
    const scrobbles = 'blog/what-50000-scrobbles-say-about-me.html';
    const pinned = posts.find(p => p.url === scrobbles);
    assert.ok(pinned, 'the scrobbles post is in posts.json');
    const pick = rt.krTopicPosts(posts, { tags: ['photography'], urls: ['/' + scrobbles], limit: 3 });
    assert.equal(pick.posts[0].url, scrobbles);
    const tagged = posts.filter(p => (p.tags || []).includes('photography')).length;
    assert.equal(pick.matching, tagged);
    assert.equal(pick.listed, pick.posts.length - 1);
    assert.equal(rt.krTopicPosts(posts, { tags: ['no-such-tag'] }).posts.length, 0);
});

test('krTopicPosts: a post the page already links to is not shown again', () => {
    const scrobbles = 'blog/what-50000-scrobbles-say-about-me.html';
    const music = posts.filter(p => (p.tags || []).includes('music'));
    const pick = rt.krTopicPosts(posts, { tags: ['music'], urls: [scrobbles], exclude: [scrobbles] });
    assert.ok(![...pick.posts].some(p => p.url === scrobbles), 'the linked post is left out, pinned or not');
    assert.equal(pick.matching, music.length);
    // Linked from the page counts as reachable, so the "See all" link only
    // shows when some matching post is neither in the row nor linked.
    assert.equal(pick.listed, pick.posts.length + (music.some(p => p.url === scrobbles) ? 1 : 0));
    const photo = rt.krTopicPosts(posts, { tags: ['photography'], limit: 3 });
    const first = photo.posts[0].url;
    const without = rt.krTopicPosts(posts, { tags: ['photography'], limit: 3, exclude: ['/' + first] });
    assert.ok(![...without.posts].some(p => p.url === first));
    assert.equal(without.posts.length, Math.min(3, photo.matching - 1), 'the next newest takes its place');
});

test('krSortFromUrl / krSortToUrl: only offered orders, and a bare URL for the default', () => {
    const options = [
        { key: 'date', label: 'Date', defaultDir: -1 },
        { key: 'title', label: 'Title', defaultDir: 1 },
    ];
    const read = qs => ({ ...rt.krSortFromUrl(new URLSearchParams(qs), options) });
    assert.deepEqual(read(''), { key: 'date', dir: -1 });
    assert.deepEqual(read('sort=title'), { key: 'title', dir: 1 }, "the option's own direction");
    assert.deepEqual(read('sort=title&dir=desc'), { key: 'title', dir: -1 });
    assert.deepEqual(read('sort=nonsense&dir=asc'), { key: 'date', dir: 1 }, 'an unknown key is the default');
    const write = (key, dir) => {
        const params = new URLSearchParams();
        rt.krSortToUrl(params, options, key, dir);
        return params.toString();
    };
    assert.equal(write('date', -1), '');
    assert.equal(write('date', 1), 'sort=date&dir=asc');
    assert.equal(write('title', 1), 'sort=title&dir=asc');
    for (const [key, dir] of [['date', -1], ['date', 1], ['title', 1], ['title', -1]]) {
        assert.deepEqual(read(write(key, dir)), { key, dir }, `${key} ${dir} round-trips`);
    }
    assert.equal(rt.krSortOption(options, 'missing').key, 'date');
});

test('krUrlList: comma lists, blanks dropped', () => {
    const params = new URLSearchParams('tag=books,%20ai,,&none=');
    assert.deepEqual([...rt.krUrlList(params, 'tag')], ['books', 'ai']);
    assert.deepEqual([...rt.krUrlList(params, 'none')], []);
    assert.deepEqual([...rt.krUrlList(params, 'missing')], []);
});

test('prerender rules cover posts and never drafts', () => {
    const rule = rt.KR_PRERENDER_RULES.prerender[0];
    assert.equal(rule.eagerness, 'moderate');
    const text = JSON.stringify(rule.where);
    assert.ok(text.includes('"/blog/*"'));
    assert.ok(text.includes('{"not":{"href_matches":"/blog/drafts/*"}}'));
});
