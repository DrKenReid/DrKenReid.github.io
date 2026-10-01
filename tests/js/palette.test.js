/**
 * The command palette's search (js/palette.js), through its documented
 * test surface, krPalette.search(). The palette runs after
 * shared-components.js in the vm context tests/js/runtime.js builds, with
 * the site's own posts.json and photo-locations.json handed to it in
 * place of the network. Run with Node's own runner:
 *   node --test "tests/js/*.test.js"
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, loadRuntime } = require('./runtime.js');

const rt = loadRuntime('/index.html', ['palette.js']);
const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
rt.loadBlogPosts = () => Promise.resolve(readJson('data/posts.json'));
rt.krFetchJson = (rel) => Promise.resolve(readJson(rel));

const palette = rt.window.krPalette;
const ready = palette.ready();

// The result for `file` (a page's file name) among a query's results.
function finds(query, file) {
    return palette.search(query).find((r) => r.href.split('?')[0].split('/').pop() === file);
}

test('a plural finds what its singular finds', async () => {
    await ready;
    assert.equal(palette.search('photos')[0].title, 'Photography', 'photos: Photography first');
    assert.ok(finds('quotes', 'quotes.html'), 'quotes: Quote Wall');
    const landscape = palette.search('landscapes').find((r) => r.href.includes('tag=landscape'));
    assert.ok(landscape, 'landscapes: the Landscape gallery filter');
});

test('a plural retried as a singular scores a little under the singular typed', async () => {
    await ready;
    const typed = finds('quote', 'quotes.html');
    const plural = finds('quotes', 'quotes.html');
    assert.ok(typed && plural);
    assert.ok(plural.score < typed.score, `${plural.score} < ${typed.score}`);
    assert.ok(plural.score >= typed.score * 0.85, `${plural.score} is a small discount on ${typed.score}`);
});

test('a short word is not cut down to a shorter one', async () => {
    await ready;
    // "news" cut to "new" would add every post with "new" in its excerpt;
    // each post it finds must hold "news" itself.
    const posts = readJson('data/posts.json');
    const stray = palette.search('news').filter((r) => r.kind === 'Post').filter((r) => {
        const p = posts.find((post) => post.title === r.title);
        const text = [p.title, ...(p.tags || []), p.excerpt || ''].join(' ').toLowerCase();
        return !text.includes('news');
    });
    assert.equal(stray.length, 0, stray.map((r) => r.title).join(', '));
    // The cut form of the same query does find more, so the test can fail.
    assert.ok(palette.search('new').length > palette.search('news').length);
});

test('pages answer what people type for them', async () => {
    await ready;
    const wants = {
        'data_science.html': ['cv', 'resume', 'thesis', 'scholar', 'publications', 'research'],
        'contact.html': ['email', 'email me', 'linkedin'],
        'blog.html': ['rss', 'newsletter', 'substack'],
        'literature.html': ['books', 'goodreads'],
        'books.html': ['books'],
        'gallery.html': ['photos', 'pictures'],
    };
    for (const [file, queries] of Object.entries(wants)) {
        for (const q of queries) assert.ok(finds(q, file), `"${q}" finds ${file}`);
    }
});

test('a page found by an also word ranks under a title hit', async () => {
    await ready;
    // "Research, Live" is a series named research; Data Science only
    // carries the word as a tag.
    const results = palette.search('research');
    const series = results.findIndex((r) => r.kind === 'Series' && /research/i.test(r.title));
    const page = results.findIndex((r) => r.href.endsWith('data_science.html'));
    assert.ok(page > -1, 'research finds Data Science');
    if (series > -1) assert.ok(series < page, 'the series named Research comes first');
});
