/**
 * Loads js/shared-components.js for the Node tests, as a page at
 * `pathname` would run it. Not a *.test.js file, so the runner's glob
 * does not take it for a suite.
 *
 * The script is a browser global script, so it is evaluated in a vm
 * context with just enough of a document for its top level to run on a
 * page that has no header, post or listing mount (every render* call then
 * returns early). The helpers under test touch no DOM, or only the few
 * element methods the stubs provide. One copy, so a global the script
 * starts to need at load (URLSearchParams did) is added for every suite.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..', '..');

function loadRuntime(pathname = '/index.html') {
    const noop = () => {};
    const element = {
        classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
        getAttribute: () => null,
        setAttribute: noop,
        style: {},
    };
    const document = {
        documentElement: element,
        body: element,
        head: element,
        baseURI: 'https://www.kenreid.co.uk' + pathname,
        querySelector: () => null,
        querySelectorAll: () => [],
        getElementById: () => null,
        addEventListener: noop,
        createElement: () => Object.assign({}, element),
    };
    const window = {
        addEventListener: noop,
        matchMedia: () => ({ matches: false, addEventListener: noop }),
        location: { pathname, hostname: 'www.kenreid.co.uk', protocol: 'https:', search: '' },
        requestAnimationFrame: noop,
    };
    const context = vm.createContext({
        window, document, navigator: {}, location: window.location,
        console, URL, URLSearchParams, setTimeout, clearTimeout, Promise,
    });
    window.document = document;
    const source = fs.readFileSync(path.join(ROOT, 'js', 'shared-components.js'), 'utf8');
    vm.runInContext(source, context, { filename: 'shared-components.js' });
    return context;
}

module.exports = { ROOT, loadRuntime };
