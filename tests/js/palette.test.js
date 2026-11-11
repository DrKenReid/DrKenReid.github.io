/**
 * The command palette's search (js/palette.js), through its documented
 * test surface, krPalette.search(). The palette runs after
 * shared-components.js in the vm context tests/js/runtime.js builds, with
 * the site's own posts.json and photo-locations.json handed to it in
 * place of the network. Run with Node's own runner:
 *   node --test "tests/js/*.test.js"
 *
 * Two palettes are loaded. The first is a page whose reader never types:
 * it has the posts and the places and must never ask for the reading
 * data. The second has asked (authorsReady), and the author rows are
 * tested on it against the site's own books.json and quotes-all.json.
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
// Every file the first palette asks for, for the test that it asks for
// no more than it should.
const asked = [];
rt.krFetchJson = (rel) => {
    asked.push(rel);
    return Promise.resolve(readJson(rel));
};

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

/* ---- Authors ------------------------------------------------------------ */

const AUTHOR_KINDS = ['Quotes', 'Books'];
const READING_FILES = ['data/books.json', 'data/quotes-all.json'];

test('the reading data is not fetched until the author rows are asked for', async () => {
    await ready;
    const early = asked.filter((rel) => READING_FILES.includes(rel));
    assert.deepEqual(early, [], 'ready() is what the 404 page calls on load');
    const rows = palette.search('rothfuss').filter((r) => AUTHOR_KINDS.includes(r.kind));
    assert.equal(rows.length, 0, 'and without the data there are no author rows');
});

const withAuthors = loadRuntime('/index.html', ['palette.js']);
withAuthors.loadBlogPosts = () => Promise.resolve(readJson('data/posts.json'));
withAuthors.krFetchJson = (rel) => Promise.resolve(readJson(rel));
const authorPalette = withAuthors.window.krPalette;
const authorsIn = authorPalette.ready().then(() => authorPalette.authorsReady());

const books = readJson('data/books.json');
const quotes = readJson('data/quotes-all.json');

// The body of authorKey as a file writes it, one trimmed line per line,
// or null when the file has none.
function authorKeyBody(rel) {
    const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const m = /^[ \t]*function authorKey\(name\) \{\r?\n([\s\S]*?)^[ \t]*\}/m.exec(text);
    return m ? m[1].split(/\r?\n/).map((line) => line.trim()).filter(Boolean).join('\n') : null;
}
const authorKey = new Function('name', authorKeyBody('js/palette.js'));

// What the two pages hold for an author, counted the way each page
// counts: Every Book hangs the books I rated, the Quote Wall every quote.
function held(name) {
    const key = authorKey(name);
    return {
        Books: books.filter((b) => b.r && authorKey(b.a) === key).length,
        Quotes: quotes.filter((q) => authorKey(q.a) === key).length,
    };
}

// The author rows a query returns for `name`, by kind.
function authorRows(query, name) {
    const out = {};
    for (const r of authorPalette.search(query)) {
        if (AUTHOR_KINDS.includes(r.kind) && r.title === name) out[r.kind] = r;
    }
    return out;
}

const unaccent = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const rated = [...new Set(books.filter((b) => b.r).map((b) => b.a))];

test('an author has a row for each page that holds something of theirs', async () => {
    await authorsIn;
    const cases = { 'le guin': 'Ursula K. Le Guin', rothfuss: 'Patrick Rothfuss', pratchett: 'Terry Pratchett' };
    for (const [query, name] of Object.entries(cases)) {
        const want = held(name);
        const rows = authorRows(query, name);
        assert.ok(want.Books + want.Quotes > 0, `${name} is in the reading data`);
        for (const kind of AUTHOR_KINDS) {
            assert.equal(Boolean(rows[kind]), want[kind] > 0, `"${query}": ${kind} row for ${name}`);
        }
    }
    // The three between them cover both kinds, and an author with one.
    assert.ok(held('Patrick Rothfuss').Quotes > 0 && held('Patrick Rothfuss').Books > 0);
    assert.equal(held('Terry Pratchett').Quotes, 0);
});

test('an author row counts what its link selects', async () => {
    await authorsIn;
    const page = { Books: 'books.html', Quotes: 'quotes.html' };
    const names = new Set([...books.map((b) => b.a), ...quotes.map((q) => q.a.replace(/\s+/g, ' ').trim())]);
    let rows = 0;
    for (const name of names) {
        const want = held(name);
        for (const r of authorPalette.search(name)) {
            if (!AUTHOR_KINDS.includes(r.kind) || authorKey(r.title) !== authorKey(name)) continue;
            const url = new URL(r.href, 'https://www.kenreid.co.uk/');
            assert.equal(url.pathname.split('/').pop(), page[r.kind], `${name}: ${r.kind} leads to ${page[r.kind]}`);
            // The name as the page reads it back out of the address.
            const selected = held(url.searchParams.get('author'))[r.kind];
            assert.equal(selected, want[r.kind], `${name}: the link selects this author's ${r.kind.toLowerCase()}`);
            assert.equal(parseInt(r.sub, 10), selected, `${name}: "${r.sub}" counts them`);
            assert.ok(selected > 0, `${name}: a row with nothing behind it`);
            rows++;
        }
    }
    assert.ok(rows > names.size / 2, `${rows} rows checked for ${names.size} names`);
});

test('a name is found without its accents, its full stops, or its usual spelling', async () => {
    await authorsIn;
    const accented = rated.find((name) => unaccent(name) !== name);
    assert.ok(accented, 'an author with an accent in the name');
    const surname = unaccent(accented).split(' ').pop().toLowerCase();
    assert.ok(authorRows(surname, accented).Books, `"${surname}" finds ${accented}`);
    assert.ok(authorRows(accented.toLowerCase(), accented).Books, 'and so does the name as written');

    const initialled = rated.find((name) => /^(?:[A-Z]\.){2,} /.test(name));
    assert.ok(initialled, 'an author known by initials');
    const bare = initialled.replace(/\./g, '').toLowerCase();
    assert.ok(authorRows(bare, initialled).Books, `"${bare}" finds ${initialled}`);

    // A spelling only the quotes have: the row is still the one author's.
    const byKey = new Map();
    for (const q of quotes) {
        const spelling = q.a.replace(/\s+/g, ' ').trim();
        const key = authorKey(spelling);
        if (!byKey.has(key)) byKey.set(key, new Set());
        byKey.get(key).add(spelling);
    }
    const twice = [...byKey.values()].find((set) => new Set([...set].map((s) => s.toLowerCase())).size > 1);
    assert.ok(twice, 'an author the quotes spell two ways');
    const [first, second] = [...twice];
    const a = authorPalette.search(first).find((r) => r.kind === 'Quotes');
    const b = authorPalette.search(second).find((r) => r.kind === 'Quotes');
    assert.ok(a && b && a.href === b.href, `"${first}" and "${second}" are one row`);
});

test('an author name matches at the start of a word, never inside one', async () => {
    await authorsIn;
    for (const query of ['art', 'son', 'and']) {
        const inside = rated.filter((name) => new RegExp(`[a-z]${query}`, 'i').test(name));
        assert.ok(inside.length > 0, `"${query}" sits inside some author's name`);
        const stray = authorPalette.search(query)
            .filter((r) => AUTHOR_KINDS.includes(r.kind))
            .filter((r) => !new RegExp(`(^|[^a-z])${query}`, 'i').test(unaccent(r.title)));
        assert.equal(stray.length, 0, stray.map((r) => r.title).join(', '));
    }
});

test('the author rows leave the pages and posts where they were', async () => {
    await ready;
    await authorsIn;
    assert.equal(authorPalette.search('photos')[0].title, 'Photography');
    for (const query of ['books', 'quotes', 'cv', 'email', 'research', 'landscapes']) {
        const before = palette.search(query);
        const after = authorPalette.search(query);
        // A page, a series or a post the first palette found is still
        // found, in the same order, by the one that knows the authors.
        // Joined, because each palette's arrays come from its own
        // context and are never deeply equal to the other's.
        const kept = after.filter((r) => !AUTHOR_KINDS.includes(r.kind)).map((r) => r.href);
        assert.equal(kept.join('\n'), before.map((r) => r.href).slice(0, kept.length).join('\n'), query);
        assert.ok(kept.length > 0, `"${query}" still finds something that is not an author`);
    }
});

test('every page that reads an author link folds the name the same way', () => {
    const homes = ['js/palette.js', 'js/bookwall.js', 'js/post-shelf.js', 'quotes.html'];
    const bodies = homes.map(authorKeyBody);
    homes.forEach((rel, i) => {
        assert.ok(bodies[i], `${rel} has an authorKey`);
        assert.equal(bodies[i], bodies[0], `${rel} writes authorKey as ${homes[0]} does`);
    });
});
