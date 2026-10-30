/**
 * krJargonAliases (js/shared-components.js): the names a jargon-box label
 * answers to. The cases live in tests/jargon_aliases.json, which
 * tests/test_jargon_rule.py runs against sitelib.jargon_aliases, so the
 * tooltips and the audit's jargon rule cannot disagree about a label.
 *   node --test "tests/js/*.test.js"
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT, loadRuntime } = require('./runtime.js');

const rt = loadRuntime('/blog/example.html');
const { cases } = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'jargon_aliases.json'), 'utf8'));

test('a box label answers to the same names as in the audit', () => {
    for (const [label, expected] of cases) {
        // Array.from: the runtime's arrays come from the vm context's realm
        assert.deepEqual(Array.from(rt.krJargonAliases(label)), expected, label);
    }
});
