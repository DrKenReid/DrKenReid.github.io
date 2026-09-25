/**
 * The reading calendar's arithmetic (window.krBookshelf in js/bookshelf.js),
 * run with Node's own test runner:  node --test "tests/js/*.test.js"
 *
 * The calendar puts each book in an ISO 8601 week, and ISO years do not
 * start on 1 January: 31 Dec 2020 is in week 53 of 2020, 3 Jan 2021 is
 * still in that week, and 1 Jan 2027 belongs to 2026. A calendar that
 * counted by calendar year put books in the wrong row, and one that
 * assumed 52 weeks dropped the last week of a long year. Re-reads count
 * once per finish (`p` holds the earlier ones); a book known only by the
 * date it was added (`e`) is not a finish at all.
 *
 * The file is a browser script. It sets krBookshelf before touching the
 * document, so it runs here in a vm with a stub window, a krBookTitle
 * (from shared-components.js on a real page) and, for the second load, a
 * document with nothing on it for init() to find.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'bookshelf.js'), 'utf8');

function load(withDocument) {
    const noop = () => {};
    const context = {
        window: {},
        krBookTitle: (t) => ({ title: String(t || ''), series: '' }),
        krEscapeHtml: (s) => String(s),
        console,
    };
    if (withDocument) {
        context.document = {
            readyState: 'complete',
            addEventListener: noop,
            getElementById: () => null,
            querySelectorAll: () => [],
            createElement: () => ({ setAttribute: noop, appendChild: noop }),
        };
    }
    vm.createContext(context);
    vm.runInContext(SOURCE, context, { filename: 'bookshelf.js' });
    return context.window.krBookshelf;
}

const shelf = load(false);

/* A local-time Date for 'YYYY-MM-DD', as the calendar builds them. */
function day(s) {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
}

test('the helpers load with no document at all', () => {
    for (const name of ['sessions', 'firstRead', 'isoWeek', 'weeksIn', 'parseDate']) {
        assert.equal(typeof shelf[name], 'function', name);
    }
});

test('with an empty document the script binds nothing and throws nothing', () => {
    assert.equal(typeof load(true).isoWeek, 'function');
});

test('ISO weeks at the turn of the year', () => {
    // 2020 has 53 ISO weeks: 31 Dec 2020 (a Thursday) is in the last one,
    // and so is Sunday 3 Jan 2021.
    assert.deepEqual({ ...shelf.isoWeek(day('2020-12-31')) }, { year: 2020, week: 53 });
    assert.deepEqual({ ...shelf.isoWeek(day('2021-01-03')) }, { year: 2020, week: 53 });
    // Monday 4 Jan 2021 starts week 1 of 2021.
    assert.deepEqual({ ...shelf.isoWeek(day('2021-01-04')) }, { year: 2021, week: 1 });
    // 1 Jan 2026 is a Thursday: week 1 of its own year.
    assert.deepEqual({ ...shelf.isoWeek(day('2026-01-01')) }, { year: 2026, week: 1 });
    // 1 Jan 2027 is a Friday, so it closes 2026's 53rd week.
    assert.deepEqual({ ...shelf.isoWeek(day('2027-01-01')) }, { year: 2026, week: 53 });
});

test('long ISO years have 53 weeks', () => {
    assert.equal(shelf.weeksIn(2020), 53);
    assert.equal(shelf.weeksIn(2026), 53);
    assert.equal(shelf.weeksIn(2021), 52);
    assert.equal(shelf.weeksIn(2025), 52);
});

test('a week never runs past weeksIn for its year', () => {
    for (let y = 2019; y <= 2030; y++) {
        for (let d = new Date(y, 0, 1); d.getFullYear() === y; d.setDate(d.getDate() + 1)) {
            const w = shelf.isoWeek(d);
            assert.ok(w.week >= 1 && w.week <= shelf.weeksIn(w.year), `${d.toDateString()}: ${w.week}`);
        }
    }
});

test('sessions: the latest finish and every earlier one', () => {
    const reread = { t: 'Babel', d: '2026/03/01', p: ['2021/05/01', '2024/02/10'] };
    assert.deepEqual([...shelf.sessions(reread)], ['2026/03/01', '2021/05/01', '2024/02/10']);
    assert.equal(shelf.firstRead(reread), '2021/05/01');
});

test('sessions: a date that is only the date added is not a finish', () => {
    const added = { t: 'Unread', d: '2025/12/31', e: 1 };
    assert.deepEqual([...shelf.sessions(added)], []);
    // The shelf still files it somewhere: at the date it was added.
    assert.equal(shelf.firstRead(added), '2025/12/31');
    // An added-only book with an earlier finish still has that finish.
    const both = { t: 'Again', d: '2026/01/05', e: 1, p: ['2019/07/07'] };
    assert.deepEqual([...shelf.sessions(both)], ['2019/07/07']);
});

test('parseDate reads slashes or dashes, and nothing else', () => {
    assert.equal(shelf.parseDate('2026/01/02').getDate(), 2);
    assert.equal(shelf.parseDate('2026-01-02').getMonth(), 0);
    assert.equal(shelf.parseDate(''), null);
    assert.equal(shelf.parseDate('02/01/2026'), null);
});
