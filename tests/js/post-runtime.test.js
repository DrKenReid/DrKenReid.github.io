/**
 * The post runtime's pure helpers (js/shared-components.js), run with
 * Node's own test runner:  node --test "tests/js/*.test.js"
 * (Node 21 and later read the argument as a glob; a bare directory
 * matches no file.)
 *
 * The script runs as it would on a post's URL, in the vm context that
 * tests/js/runtime.js builds (see there for why and what it stubs).
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, loadRuntime } = require('./runtime.js');

const rt = loadRuntime('/blog/example.html');
const posts = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'posts.json'), 'utf8'));

test('every category in posts.json has sign-off routes', () => {
    const categories = [...new Set(posts.map(p => p.category))];
    for (const category of categories) {
        const routes = rt.KR_ROUTES[category];
        assert.ok(routes, `KR_ROUTES has no entry for "${category}"`);
        assert.equal(routes.length, 3, `"${category}" should offer three routes`);
        for (const route of routes) {
            assert.match(route.href, /^[a-z0-9_-]+\.html(\?[a-z]+=[a-z ]+)?$/, route.href);
            assert.ok(fs.existsSync(path.join(ROOT, route.href.split('?')[0])), `${route.href} does not exist`);
        }
    }
});

test('a series part points at its neighbouring parts', () => {
    for (const name of ['Algorithms, Live', 'How This Site Is Built']) {
        const parts = rt.seriesParts(posts, name);
        assert.ok(parts.length >= 3, name);
        const middle = parts[1];
        const pair = rt.postNeighbours(posts, middle);
        assert.equal(pair.prev.post, parts[0]);
        assert.equal(pair.next.post, parts[2]);
        assert.equal(pair.prev.label, 'Part ' + rt.postSeriesEntry(parts[0], name).part);
    }
});

// generate_related_posts.py bakes the related cards and leaves out the two
// posts the pager links to, by its own copy of these rules (up_next). This
// holds the two copies together: a rule changed on one side only shows up
// here as a card that repeats the link above it.
test('the baked related cards never repeat an Up next link', () => {
    for (const post of posts) {
        const html = fs.readFileSync(path.join(ROOT, post.url), 'utf8');
        const block = html.split('<div class="related-posts">')[1] || '';
        const linked = [...block.matchAll(/<a href="([^"]+)" class="blog-card/g)].map(m => 'blog/' + m[1]);
        assert.ok(linked.length, `${post.url} has no baked related cards`);
        const pair = rt.postNeighbours(posts, post);
        for (const side of [pair.prev, pair.next]) {
            if (side) assert.ok(!linked.includes(side.post.url), `${post.url}: a related card repeats ${side.post.url}`);
        }
    }
});

test('the ends of a series fall back to the nearest older post on the subject', () => {
    const parts = rt.seriesParts(posts, 'Algorithms, Live');
    const first = parts[0];
    const pair = rt.postNeighbours(posts, first);
    const i = posts.indexOf(first);
    assert.equal(pair.next.post, parts[1]);
    const want = posts.slice(i + 1).find(p => rt.categoryKey(p) === rt.categoryKey(first)) || posts[i + 1];
    if (want) {
        assert.equal(pair.prev.post, want);
        assert.equal(pair.prev.label, 'Older, outside the series');
    }
});

// A reader who came for a book post is offered another book post, not
// whatever was published that week.
test('a post in no series is offered its nearest neighbours on the same subject', () => {
    let checked = 0;
    for (const post of posts.filter(p => !rt.postSeriesList(p).length)) {
        const i = posts.indexOf(post);
        const key = rt.categoryKey(post);
        const older = posts.slice(i + 1).find(p => rt.categoryKey(p) === key);
        const newer = posts.slice(0, i).reverse().find(p => rt.categoryKey(p) === key);
        const pair = rt.postNeighbours(posts, post);
        if (older) { assert.equal(pair.prev.post, older, post.url); checked++; }
        if (newer) { assert.equal(pair.next.post, newer, post.url); checked++; }
    }
    assert.ok(checked > 20, 'too few posts with a neighbour on their subject');
    // With none on its subject, the date order: a made-up lone category.
    const x = { url: 'blog/x.html', category: 'Ideas' };
    const y = { url: 'blog/y.html', category: 'Books & Media' };
    const z = { url: 'blog/z.html', category: 'Money' };
    const pair = rt.postNeighbours([x, y, z], y);
    assert.equal(pair.prev.post, z);
    assert.equal(pair.next.post, x);
});

// After the latest part a bare "Newer" read as if the series went on.
test('a fallback that leaves the series says so', () => {
    const series = [...new Set(posts.flatMap(p => rt.postSeriesList(p).map(e => e.name)))];
    let checked = 0;
    for (const name of series) {
        const parts = rt.seriesParts(posts, name);
        const last = parts[parts.length - 1];
        const i = posts.indexOf(last);
        const pair = rt.postNeighbours(posts, last);
        if (parts.length > 1) assert.match(pair.prev.label, /^Part \d+$/, name);
        if (i > 0 && pair.next && pair.next.post === posts[i - 1]) {
            const inSeries = rt.postSeriesList(pair.next.post).some(e => e.name === name);
            assert.equal(pair.next.label, inSeries ? 'Newer' : 'Newer, outside the series', name);
            checked++;
        }
    }
    assert.ok(checked, 'no series ends before a newer post');
    // A made-up pair: the newer post shares no series, the older one does.
    const a = { url: 'blog/a.html', series: { name: 'S', part: 2 } };
    const b = { url: 'blog/b.html', series: { name: 'S', part: 1 } };
    const n = { url: 'blog/n.html' };
    const pair = rt.postNeighbours([n, a, b], a);
    assert.equal(pair.prev.label, 'Part 1');
    assert.equal(pair.next.label, 'Newer, outside the series');
    const lone = { url: 'blog/l.html', series: { name: 'Solo', part: 1 } };
    const both = rt.postNeighbours([n, lone, b], lone);
    assert.deepEqual([both.prev.label, both.next.label], ['Older, outside the series', 'Newer, outside the series']);
});

test('the sign-off leads with the post\'s own series page', () => {
    const inSeries = posts.find(p => rt.postSeriesList(p).length);
    const name = rt.postSeriesList(inSeries)[0].name;
    const routes = rt.postRoutes(inSeries);
    assert.equal(routes.length, 3);
    assert.equal(routes[0].label, name);
    assert.equal(routes[0].href, rt.seriesPageHref(name).replace(/^\//, ''));
    assert.equal(new Set(routes.map(r => r.href)).size, 3, 'a route is repeated');
    const outside = posts.find(p => !rt.postSeriesList(p).length);
    assert.deepEqual(JSON.parse(JSON.stringify(rt.postRoutes(outside))),
        JSON.parse(JSON.stringify(rt.KR_ROUTES[outside.category])));
});

test('a related card names another series, not its own', () => {
    const current = { url: 'blog/c.html', series: { name: 'Algorithms, Live', part: 3 } };
    const sameSeries = { url: 'blog/s.html', series: [{ name: 'Research, Live', part: 2 }, { name: 'Algorithms, Live', part: 5 }] };
    const other = { url: 'blog/o.html', series: { name: 'How This Site Is Built', part: 14 } };
    assert.equal(rt.relatedSeriesChipText(sameSeries, current), 'Part 5');
    assert.equal(rt.relatedSeriesChipText(other, current), 'Part 14 · How This Site Is Built');
    assert.equal(rt.relatedSeriesChipText(other, null), 'Part 14 · How This Site Is Built');
    assert.equal(rt.relatedSeriesChipText({ url: 'blog/x.html' }, current), '');
});

test('a post outside any series gets Older and Newer', () => {
    const i = posts.findIndex((p, k) => !p.series && k > 0 && k < posts.length - 1);
    const pair = rt.postNeighbours(posts, posts[i]);
    // Which two posts: the subject test above.
    assert.deepEqual([pair.prev.label, pair.next.label], ['Older', 'Newer']);
});

test('the lead-in stops at five words or the first sentence', () => {
    const lead = t => t.slice(0, rt.leadInEnd(t));
    assert.equal(lead('This is post number fifty. Yes, fifty.'), 'This is post number fifty.');
    assert.equal(lead('It is easy to picture a ship the size of a moon.'), 'It is easy to picture');
    // Stops that do not end a sentence.
    assert.equal(lead('I started my Ph.D. in 2015 under a patient man.'), 'I started my Ph.D. in');
});

test('the lead-in never ends inside a quotation', () => {
    const lead = t => t.slice(0, rt.leadInEnd(t));
    assert.equal(lead('He said "you should not go to university" and I went.'),
        'He said "you should not go to university"');
    assert.equal(lead('Nobody googles "reasons I am wrong about this". It shows.'),
        'Nobody googles "reasons I am wrong about this".');
    // Up to LEAD_IN_QUOTE_SLACK words past the fifth, it runs on to the close.
    assert.equal(lead('He said "one two three four five six seven eight nine ten eleven" and left.'),
        'He said "one two three four five six seven eight nine ten eleven"');
    // Too long to finish: stop before it opens.
    assert.equal(lead('He said "one two three four five six seven eight nine ten eleven twelve thirteen" and left.'),
        'He said');
});

function fakeReference(text, marks, link) {
    const anchor = link && { getAttribute: () => link.href, textContent: link.text };
    const all = marks.map(m => ({ textContent: m }));
    if (anchor) all.push(anchor);
    return {
        textContent: text,
        querySelector: sel => (sel === 'a[href]' ? anchor || null : null),
        querySelectorAll: () => all,
    };
}

test('a sidenote shows first author, year, title and a short link', () => {
    const ref = rt.compactReference(fakeReference(
        'Kirkpatrick, S., Gelatt, C. D., & Vecchi, M. P. (1983). Optimization by simulated annealing. Science, 220(4598), 671-680. https://doi.org/10.1126/science.220.4598.671',
        ['Science, 220'],
        { href: 'https://doi.org/10.1126/science.220.4598.671', text: 'https://doi.org/10.1126/science.220.4598.671' }));
    assert.equal(ref.who, 'Kirkpatrick et al., 1983');
    assert.equal(ref.title, 'Optimization by simulated annealing');
    assert.equal(ref.label, 'doi');

    const two = rt.compactReference(fakeReference(
        'Tversky, A., & Kahneman, D. (1973). Availability: A heuristic for judging frequency and probability. Cognitive Psychology, 5(2), 207-232.',
        ['Cognitive Psychology'], null));
    assert.equal(two.who, 'Tversky & Kahneman, 1973');
    assert.equal(two.href, '');

    const book = rt.compactReference(fakeReference(
        'Koza, J. R. (1992). Genetic Programming: On the Programming of Computers by Means of Natural Selection. MIT Press.',
        ['Genetic Programming: On the Programming of Computers by Means of Natural Selection'], null));
    assert.equal(book.who, 'Koza, 1992');
    assert.equal(book.title, 'Genetic Programming: On the Programming of Computers by Means of Natural Selection');

    // A venue whose name is also the title's first word.
    const venue = rt.compactReference(fakeReference(
        'Windred, D. P., et al. (2024). Sleep regularity is a stronger predictor of mortality risk than sleep duration. Sleep, 47(1), zsad253.',
        ['Sleep'], null));
    assert.equal(venue.who, 'Windred et al., 2024');
    assert.equal(venue.title, 'Sleep regularity is a stronger predictor of mortality risk than sleep duration');
});

test('a reference that is not author-date is shown whole', () => {
    const text = 'The fossil fuel industry invented the carbon footprint to shift blame onto consumers. BMJ, 383, p2553 (2023).';
    const ref = rt.compactReference(fakeReference(text, ['BMJ'],
        { href: 'https://www.bmj.com/content/383/bmj.p2553', text: 'doi:10.1136/bmj.p2553' }));
    assert.equal(ref.who, '');
    assert.equal(ref.title, text);
    assert.equal(ref.label, 'doi');
});

// initReferenceBackLinks appends a textless link back to the citation;
// in a reference with no link of its own it is the first a[href], and the
// sidenote must not offer it as the source.
test('a sidenote ignores the reference\'s back link', () => {
    const text = 'Kahneman, D. (2011). Thinking, fast and slow. Farrar, Straus and Giroux.';
    const li = fakeReference(text, ['Thinking, fast and slow'], null);
    const back = { getAttribute: () => '#cite-ref-4', textContent: '', classList: { contains: c => c === 'kr-ref-back' } };
    li.querySelector = sel => (sel === 'a[href]' ? back : null);
    const ref = rt.compactReference(li);
    assert.equal(ref.href, '');
    assert.equal(ref.label, '');
    assert.equal(ref.who, 'Kahneman, 2011');
    assert.equal(ref.title, 'Thinking, fast and slow');
});

test('a Goodreads title loses its series bracket for display', () => {
    const t = s => { const r = rt.krBookTitle(s); return [r.title, r.series]; };
    assert.deepEqual(t('Clockwork Angel (The Infernal Devices, #1)'), ['Clockwork Angel', 'The Infernal Devices #1']);
    assert.deepEqual(t('Dune (Dune #1)'), ['Dune', 'Book 1']);
    // A bracket that is not a series is part of the title.
    assert.deepEqual(t('Big History (The Great Courses)'), ['Big History (The Great Courses)', '']);
    assert.deepEqual(t(null), ['', '']);
});
