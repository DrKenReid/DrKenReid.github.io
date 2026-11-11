/**
 * The cover wall's filters and sorts (window.krBookWall in js/bookwall.js),
 * run with Node's own test runner:  node --test "tests/js/*.test.js"
 *
 * A re-read counts in every year it was read; a book with no year, page
 * count or genre is in no band of that row; a sort puts a book with no
 * year or page count last whichever way it runs, and equal books keep
 * books.json's order. The file is a browser script: it sets krBookWall
 * before touching the document, so it runs here in a vm with a stub
 * window, after js/bookshelf.js (krBookshelf.sessions) and with a
 * krBookTitle that strips the series as shared-components.js's does.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

function load() {
    const context = {
        window: {},
        krBookTitle: (t) => ({ title: String(t || '').replace(/\s*\([^)]*\)\s*$/, ''), series: '' }),
        krEscapeHtml: (s) => String(s),
        console,
    };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'bookshelf.js'), 'utf8'), context, { filename: 'bookshelf.js' });
    context.krBookshelf = context.window.krBookshelf;
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'bookwall.js'), 'utf8'), context, { filename: 'bookwall.js' });
    return context.window.krBookWall;
}

const wall = load();

function filters(more) {
    return Object.assign({ genres: [], ratings: [], years: [], periods: [], lengths: [], reread: false, author: '', query: '' }, more);
}

test('the helpers load with no document at all', () => {
    for (const name of ['passes', 'comparator', 'readYears', 'periodKey', 'lengthKey', 'tally']) {
        assert.equal(typeof wall[name], 'function', name);
    }
});

test('a re-read counts in each year it was read, a date added in none', () => {
    assert.deepEqual([...wall.readYears({ d: '2025/03/01', p: ['2019/01/01', '2025/01/01'] })], ['2025', '2019']);
    assert.deepEqual([...wall.readYears({ d: '2025/03/01', e: 1 })], []);
    const b = { r: 4, t: 'T', a: 'A', d: '2025/03/01', p: ['2019/01/01'] };
    assert.ok(wall.passes(b, filters({ years: ['2019'] })));
    assert.ok(!wall.passes(b, filters({ years: ['2020'] })));
});

test('publication bands: decades from 1950, two wide bands before', () => {
    assert.equal(wall.periodKey(2026), '2020s');
    assert.equal(wall.periodKey(1950), '1950s');
    assert.equal(wall.periodKey(1949), '1900-1949');
    assert.equal(wall.periodKey(1900), '1900-1949');
    assert.equal(wall.periodKey(1899), 'before-1900');
    assert.equal(wall.periodKey(108), 'before-1900');
    assert.equal(wall.periodKey(undefined), '');
});

test('length bands', () => {
    assert.equal(wall.lengthKey(64), 'short');
    assert.equal(wall.lengthKey(199), 'short');
    assert.equal(wall.lengthKey(200), 'medium');
    assert.equal(wall.lengthKey(599), 'long');
    assert.equal(wall.lengthKey(600), 'epic');
    assert.equal(wall.lengthKey(undefined), '');
});

test('rows OR within, AND across; a book with no value is in no band', () => {
    const b = { r: 5, t: 'The Captain', a: 'Will Wight', d: '2024/05/01', y: 2023, n: 450, gn: ['scifi', 'fantasy'] };
    assert.ok(wall.passes(b, filters({ genres: ['fantasy', 'horror'] })));
    assert.ok(!wall.passes(b, filters({ genres: ['horror'] })));
    assert.ok(wall.passes(b, filters({ genres: ['scifi'], ratings: ['5', '4'], periods: ['2020s'], lengths: ['long'] })));
    assert.ok(!wall.passes(b, filters({ genres: ['scifi'], ratings: ['4'] })));
    assert.ok(!wall.passes(b, filters({ reread: true })));
    // Read again: an earlier finish on file, or a Read Count the dates do not show.
    assert.ok(wall.passes(Object.assign({}, b, { p: ['2020/01/01'] }), filters({ reread: true })));
    assert.ok(wall.passes(Object.assign({}, b, { rc: 2 }), filters({ reread: true })));
    const bare = { r: 3, t: 'T', a: 'A', d: '2024/05/01' };
    assert.ok(wall.passes(bare, filters()));
    for (const f of [{ genres: ['fantasy'] }, { periods: ['2020s'] }, { lengths: ['short'] }]) {
        assert.ok(!wall.passes(bare, filters(f)), JSON.stringify(f));
    }
});

test('an author is matched whole, a search as text', () => {
    const b = { r: 4, t: 'The Republic', a: 'Plato', d: '2020/01/01' };
    const about = { r: 4, t: 'Plato at the Googleplex', a: 'Rebecca Goldstein', d: '2020/01/01' };
    const key = wall.authorKey('Plato');
    assert.ok(wall.passes(b, filters({ author: key })));
    assert.ok(!wall.passes(about, filters({ author: key })));
    assert.ok(wall.passes(about, filters({ query: 'plato' })));
});

test('sort keys: titles without articles, authors by surname', () => {
    assert.equal(wall.titleSortKey('The Captain (The Last Horizon, #1)'), 'captain');
    assert.equal(wall.titleSortKey('A Christmas Carol'), 'christmas carol');
    assert.equal(wall.authorSortKey('Ursula K. Le Guin'), 'le guin ursula k.');
    assert.equal(wall.authorSortKey('Daphne du Maurier'), 'du maurier daphne');
    assert.equal(wall.authorSortKey('Martin Luther King Jr.'), 'king martin luther');
    assert.equal(wall.authorSortKey('TheFirstDefier'), 'thefirstdefier');
});

test('a missing year or page count goes last both ways; ties keep the file order', () => {
    const books = [
        { t: 'C', a: 'X', r: 3, d: '2025/01/03', y: 1990 },
        { t: 'A', a: 'Y', r: 5, d: '2025/01/02' },
        { t: 'B', a: 'Z', r: 5, d: '2025/01/01', y: 2010 },
        { t: 'D', a: 'Z', r: 5, d: '2025/01/01', y: 2010 },
    ];
    const index = new Map(books.map((b, i) => [b, i]));
    const order = (key, dir) => books.slice().sort(wall.comparator(key, dir, index)).map((b) => b.t).join('');
    assert.equal(order('published', -1), 'BDCA');
    assert.equal(order('published', 1), 'CBDA');
    assert.equal(order('read', -1), 'CABD');
    assert.equal(order('read', 1), 'BDAC');
    assert.equal(order('title', 1), 'ABCD');
    assert.equal(order('title', -1), 'DCBA');
    // Equal ratings fall back to the date read, then the file.
    assert.equal(order('rating', -1), 'ABDC');
    assert.equal(order('author', 1), 'CABD');
});

test('counts: each book once a key', () => {
    const counts = wall.tally([{ gn: ['fantasy', 'fantasy'] }, { gn: ['fantasy', 'horror'] }, {}], (b) => b.gn);
    assert.deepEqual({ ...counts }, { fantasy: 2, horror: 1 });
});

test('the count names a list the way it is read', () => {
    assert.equal(wall.orList(['2025']), '2025');
    assert.equal(wall.orList(['2025', '2024']), '2025 or 2024');
    assert.equal(wall.orList(['a', 'b', 'c']), 'a, b or c');
});
