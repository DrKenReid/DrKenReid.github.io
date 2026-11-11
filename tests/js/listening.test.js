/**
 * The listening calendar's arithmetic and its figures (window.krListening
 * in js/listening.js), run with Node's own test runner:
 *     node --test "tests/js/*.test.js"
 *
 * The calendar files a Last.fm chart week, which runs from noon on a
 * Sunday (UTC) to the next, under the ISO week that holds most of it, and
 * ISO years do not start on 1 January: the chart week that starts on
 * 30 December 2018 belongs to 2019, and 2020 has a 53rd week. Counting by
 * calendar year would put weeks in the wrong row. A week the file has no
 * record of is not a week with nothing played: it ends a streak, but it
 * is never counted as silent. And the figures on the page are worked out
 * from the records, so each is pinned here on a history small enough to
 * check by hand.
 *
 * The file is a browser script. It sets krListening before touching the
 * document, so it runs here in a vm with a stub window and, for the
 * second load, a document with nothing on it for init() to find. The
 * last tests run it over tests/fixtures/listening.json, a made-up history
 * as long as a real one.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'js', 'listening.js'), 'utf8');
const FIXTURE = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'listening.json'), 'utf8'));

function load(withDocument) {
    const noop = () => {};
    const context = { window: {}, krEscapeHtml: (s) => String(s), console };
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
    vm.runInContext(SOURCE, context, { filename: 'listening.js' });
    return context.window.krListening;
}

const listening = load(false);
const TODAY = new Date(2026, 10, 10);

/* Values built inside the vm have its prototypes; compare them as JSON. */
const plain = (value) => JSON.parse(JSON.stringify(value));

/* `counts` as consecutive chart weeks from the Sunday `first`: a number is
   that week's scrobbles (its artist 'A' with half of them unless given as
   [n, artist, plays]), and null is a week with no record at all. */
function history(first, counts) {
    const start = Date.UTC(...first.split('-').map((x, i) => (i === 1 ? +x - 1 : +x)));
    const out = [];
    counts.forEach((c, i) => {
        if (c === null) return;
        const d = new Date(start + i * 7 * 86400000).toISOString().slice(0, 10);
        const [n, a, p] = Array.isArray(c) ? c : [c, 'A', Math.ceil(c / 2)];
        out.push(n > 0 ? { d, n, a, p } : { d, n: 0 });
    });
    return out;
}

test('the helpers load with no document at all', () => {
    for (const name of ['parseDay', 'isoWeek', 'weeksIn', 'cellOf', 'thresholds', 'level', 'leaders', 'model', 'figures']) {
        assert.equal(typeof listening[name], 'function', name);
    }
});

test('with an empty document the script binds nothing and throws nothing', () => {
    assert.equal(typeof load(true).model, 'function');
});

test('a chart week is drawn in the ISO week that holds most of it', () => {
    // Sunday 9 March 2014: the week that follows it, ISO week 11.
    assert.deepEqual(plain(listening.cellOf('2014-03-09')), { year: 2014, week: 11, month: 3 });
    // The chart week from Sunday 30 December 2018 is week 1 of 2019, and a
    // January week (its Thursday is the 3rd).
    assert.deepEqual(plain(listening.cellOf('2018-12-30')), { year: 2019, week: 1, month: 1 });
    // 2020 has 53 ISO weeks; the chart week from 27 December is the last.
    assert.deepEqual(plain(listening.cellOf('2020-12-27')), { year: 2020, week: 53, month: 12 });
    assert.deepEqual(plain(listening.cellOf('2021-01-03')), { year: 2021, week: 1, month: 1 });
    // Were Last.fm to start its weeks on a Monday, each is still its own ISO week.
    assert.deepEqual(plain(listening.cellOf('2021-01-04')), { year: 2021, week: 1, month: 1 });
    assert.equal(listening.cellOf('04/01/2021'), null);
    assert.equal(listening.cellOf(''), null);
});

test('long ISO years have 53 weeks, and no chart week falls outside its year', () => {
    assert.equal(listening.weeksIn(2020), 53);
    assert.equal(listening.weeksIn(2026), 53);
    assert.equal(listening.weeksIn(2021), 52);
    const seen = new Set();
    for (let ms = Date.UTC(2013, 11, 29); ms < Date.UTC(2031, 0, 1); ms += 7 * 86400000) {
        const c = listening.cellOf(new Date(ms).toISOString().slice(0, 10));
        assert.ok(c.week >= 1 && c.week <= listening.weeksIn(c.year), `${c.year}-${c.week}`);
        assert.ok(!seen.has(`${c.year}-${c.week}`), 'two chart weeks in one cell');
        seen.add(`${c.year}-${c.week}`);
    }
});

test('shades are thirds of the weeks with music', () => {
    const steps = listening.thresholds([0, 10, 20, 30, 40, 50, 60, 0, 1000]);
    assert.deepEqual(plain(steps), [30, 50]);
    assert.deepEqual([0, 1, 30, 31, 50, 51, 1000].map((n) => listening.level(n, steps)), [0, 1, 1, 2, 2, 3, 3]);
    // A month is shaded by its average week, which need not be whole.
    assert.equal(listening.level(30.5, steps), 2);
    assert.deepEqual(plain(listening.thresholds([0, 0])), [0, 0]);
    assert.equal(listening.level(undefined, steps), 0);
});

test('with nothing played there is no model, whatever the file holds', () => {
    assert.equal(listening.model([], TODAY), null);
    assert.equal(listening.model(undefined, TODAY), null);
    assert.equal(listening.model('weeks', TODAY), null);
    assert.equal(listening.model([{ d: '2020-01-05', n: 0 }, { d: '2020-01-12', n: 0 }], TODAY), null);
    assert.equal(listening.model([null, {}, { d: 'soon', n: 4 }, { d: '2020-01-05' }, { d: '2020-01-05', n: -3 }], TODAY), null);
});

test('the picture starts at the first week with music and runs to this year', () => {
    const m = listening.model(history('2024-12-01', [0, 0, 12, 0, 7, [30, 'B', 9]]), TODAY);
    assert.equal(m.first.d, '2024-12-15');
    assert.equal(m.last.d, '2025-01-05');
    assert.deepEqual(plain(m.years), [2024, 2025, 2026]);
    // The silent week after the first one stays: it is part of the record.
    assert.deepEqual(plain(m.weeks.map((w) => w.n)), [12, 0, 7, 30]);
    // 29 December 2024 opens ISO week 1 of 2025.
    assert.deepEqual(plain(m.byYear), { 2024: 12, 2025: 37 });
    assert.equal(m.cells['2025-1'].n, 7);
    assert.equal(m.cells['2025-2'].a, 'B');
    assert.equal(m.cells['2024-52'].n, 0);
    assert.equal(m.cells['2025-3'], undefined);
});

test('a file out of order, or with a week listed twice, draws the same', () => {
    const weeks = history('2025-03-02', [5, 9, 0, 4]);
    const shuffled = [weeks[2], weeks[0], weeks[3], weeks[1], { ...weeks[1], n: 99 }];
    const a = listening.model(weeks, TODAY), b = listening.model(shuffled, TODAY);
    assert.deepEqual(plain(b.byYear), plain(a.byYear));
    assert.deepEqual(plain(b.weeks.map((w) => w.d)), plain(a.weeks.map((w) => w.d)));
});

test('a row of months adds up to the row of weeks it replaces', () => {
    const m = listening.model(FIXTURE.weeks, TODAY);
    for (const year of m.years) {
        let months = 0, weeks = 0;
        for (let u = 1; u <= 12; u++) (m.months[`${year}-${u}`] || []).forEach((w) => { months += w.n; });
        for (let u = 1; u <= listening.weeksIn(year); u++) weeks += (m.cells[`${year}-${u}`] || { n: 0 }).n;
        assert.equal(months, weeks, String(year));
        assert.equal(weeks, m.byYear[year] || 0, String(year));
    }
});

test('leaders: most weeks first, then most plays, then by name', () => {
    const weeks = [
        { a: 'B', p: 10 }, { a: 'A', p: 3 }, { a: 'B', p: 1 }, { a: 'A', p: 9 },
        { a: 'C', p: 50 }, { a: 'D', p: 50 }, { a: '', p: 0 }, { a: 'constructor', p: 2 }, { a: '__proto__', p: 1 },
    ];
    assert.deepEqual(plain(listening.leaders(weeks)), [
        { a: 'A', weeks: 2, plays: 12 }, { a: 'B', weeks: 2, plays: 11 },
        { a: 'C', weeks: 1, plays: 50 }, { a: 'D', weeks: 1, plays: 50 },
        { a: 'constructor', weeks: 1, plays: 2 }, { a: '__proto__', weeks: 1, plays: 1 },
    ]);
});

test('figures: totals, the busiest year and week, a usual week', () => {
    // 2025 has four weeks on file, 2026 three; the two years tie on 60.
    const m = listening.model([
        ...history('2025-06-01', [[10, 'A', 6], [20, 'B', 20], 0, [30, 'A', 7]]),
        ...history('2026-02-01', [[30, 'C', 30], [5, 'A', 2], [25, 'C', 5]]),
    ], TODAY);
    const f = listening.figures(m);
    assert.equal(f.total, 120);
    assert.equal(f.weeksPlayed, 6);
    assert.equal(f.weeksSilent, 1);
    // The later of two equal years, and of two equal weeks.
    assert.equal(f.busiestYear.year, 2026);
    assert.equal(f.busiestYear.weeks, 3);
    assert.deepEqual(plain(f.busiestWeeks.map((w) => w.d)), ['2026-02-01', '2025-06-22', '2026-02-15', '2025-06-08', '2025-06-01']);
    // 5 10 20 25 30 30: the middle pair averaged, to a whole scrobble.
    assert.equal(f.median, 23);
    assert.deepEqual(plain(f.leaders), [
        { a: 'A', weeks: 3, plays: 15 }, { a: 'C', weeks: 2, plays: 35 }, { a: 'B', weeks: 1, plays: 20 },
    ]);
    assert.deepEqual(plain(f.years.map((y) => [y.year, y.n, y.weeks, y.median, y.leader.a, y.leader.weeks])), [
        [2025, 60, 4, 20, 'A', 2], [2026, 60, 3, 25, 'C', 2],
    ]);
});

test('figures: a streak ends at a silent week, and at a week with no record', () => {
    //                                   run of 3    silent  run of 2  no record  run of 4
    const m = listening.model(history('2025-01-05', [4, 4, 4, 0, 4, 4, null, 4, 4, 4, 4]), TODAY);
    const f = listening.figures(m);
    assert.deepEqual(plain(f.runs.map((r) => [r.weeks, r.from.d, r.to.d])), [
        [4, '2025-02-23', '2025-03-16'], [3, '2025-01-05', '2025-01-19'], [2, '2025-02-02', '2025-02-09'],
    ]);
    // The newest week on file is in the longest run: it is still going.
    assert.equal(f.current, f.runs[0]);
    // The week with no record is not a silent one.
    assert.equal(f.weeksSilent, 1);
});

test('figures: no current run when the newest week was silent', () => {
    const f = listening.figures(listening.model(history('2025-01-05', [4, 4, 0]), TODAY));
    assert.equal(f.current, null);
    assert.equal(f.runs[0].weeks, 2);
});

test('the fixture: every record has a cell of its own, and the figures add up', () => {
    const m = listening.model(FIXTURE.weeks, TODAY);
    assert.equal(m.weeks.length, FIXTURE.weeks.length);
    assert.equal(Object.keys(m.cells).length, FIXTURE.weeks.length);
    assert.equal(m.years[0], 2014);
    assert.equal(m.years[m.years.length - 1], 2026);
    const f = listening.figures(m);
    const total = FIXTURE.weeks.reduce((s, w) => s + w.n, 0);
    assert.equal(f.total, total);
    assert.equal(f.years.reduce((s, y) => s + y.n, 0), total);
    assert.equal(f.weeksPlayed + f.weeksSilent, FIXTURE.weeks.length);
    // One week of the fixture has no record: it shows as a gap, and the
    // weeks either side of it are in different runs.
    assert.equal(m.cells['2021-6'], undefined);
    assert.ok(m.cells['2021-5'] && m.cells['2021-7']);
    assert.ok(f.runs.every((r) => !(r.from.d < '2021-02-07' && r.to.d > '2021-02-07')));
    // A third of the weeks with music in each shade, within one week.
    const shades = [0, 0, 0, 0];
    m.weeks.forEach((w) => { shades[listening.level(w.n, m.steps)]++; });
    assert.equal(shades[0], f.weeksSilent);
    for (const n of shades.slice(1)) assert.ok(Math.abs(n - f.weeksPlayed / 3) < f.weeksPlayed * 0.05, String(shades));
});
