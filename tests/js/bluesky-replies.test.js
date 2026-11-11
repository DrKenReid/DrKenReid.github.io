/**
 * The Bluesky replies under a post (js/bluesky-replies.js): which replies
 * are shown, and that nothing in an answer from the API can become
 * markup, a script address or an exception. Run with Node's own runner:
 *   node --test "tests/js/*.test.js"
 *
 * The script runs in a vm context with a document made of plain objects:
 * enough to build the slot (createElement, appendChild, textContent,
 * attributes, a class lookup) and to walk what it built afterwards. An
 * element here can only hold text or other elements, as the script only
 * ever asks of the real one, so "the hostile string is in a text node" is
 * something the walk can check. Nothing is fetched: window.fetch is a
 * stub that records the address it was asked for.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ROOT } = require('./runtime.js');

const ME = 'did:plc:ks2rxbqomt6vsae6tepl6pcm';
const THEM = 'did:plc:j4fmrjnw3ig72iqmsfwi5u22';
const VIEW = 'app.bsky.feed.defs#threadViewPost';
const ENTRY = {
    uri: `at://${ME}/app.bsky.feed.post/3mqakgnroos2a`,
    url: 'https://bsky.app/profile/kenreid.co.uk/post/3mqakgnroos2a',
};

function makeElement(tag) {
    return {
        tagName: tag.toUpperCase(),
        className: '',
        attrs: {},
        children: [],
        appendChild(child) { this.children.push(child); return child; },
        setAttribute(name, value) { this.attrs[name] = String(value); },
        getAttribute(name) { return name in this.attrs ? this.attrs[name] : null; },
        get firstChild() { return this.children[0] || null; },
        get textContent() {
            return this.children.map((c) => (c.tagName ? c.textContent : c.text)).join('');
        },
        set textContent(value) {
            this.children = value === '' ? [] : [{ text: String(value) }];
        },
        querySelector(selector) {
            const cls = selector.replace(/^\./, '');
            return walk(this).find((n) => n !== this && n.className.split(' ').includes(cls)) || null;
        },
    };
}

/** Every element under (and including) `node`, in document order. */
function walk(node) {
    return [node].concat(...node.children.filter((c) => c.tagName).map(walk));
}

function load(fetchStub) {
    const window = { TextEncoder, TextDecoder, fetch: fetchStub };
    const document = {
        createElement: makeElement,
        createTextNode: (text) => ({ text: String(text) }),
        querySelectorAll: () => [],
    };
    const context = vm.createContext({ window, document, URL, Promise, fetch: fetchStub });
    const source = fs.readFileSync(path.join(ROOT, 'js', 'bluesky-replies.js'), 'utf8');
    vm.runInContext(source, context, { filename: 'bluesky-replies.js' });
    return window.krBlueskyReplies;
}

const api = load();

/** A value from the vm's realm as plain data of this one, so deepEqual compares structure. */
function own(value) {
    return JSON.parse(JSON.stringify(value));
}

let seq = 0;
/** One thread node as getPostThread returns it, cut down to what is read. */
function node(text, opts = {}) {
    const did = opts.did || THEM;
    seq += 1;
    const post = {
        uri: opts.uri || `at://${did}/app.bsky.feed.post/3k${String(seq).padStart(6, '0')}`,
        author: Object.assign({ did, handle: 'someone.bsky.social', displayName: 'Some One', labels: [] }, opts.author),
        record: Object.assign({ $type: 'app.bsky.feed.post', text, createdAt: opts.when || '2026-07-10T01:16:32.532Z' }, opts.record),
        indexedAt: opts.indexed || opts.when || '2026-07-10T01:16:33.000Z',
        labels: opts.labels || [],
        likeCount: opts.likes || 0,
        replyCount: opts.replyCount || 0,
    };
    const out = { $type: VIEW, post };
    if (opts.replies) out.replies = opts.replies;
    return out;
}

function thread(replies, rootPost = {}) {
    return { thread: { $type: VIEW, post: Object.assign({ uri: ENTRY.uri }, rootPost), replies } };
}

/** A slot as mount() builds it, without the request. */
function mounted() {
    const stub = () => new Promise(() => {});
    const local = load(stub);
    const slot = makeElement('div');
    local.mount(slot, ENTRY);
    return { slot, api: local };
}

function draw(data) {
    const { slot, api: local } = mounted();
    const drawn = local.render(slot, data, ENTRY.url);
    return { slot, drawn, list: slot.querySelector('.kr-bsky-list'), count: slot.querySelector('.kr-bsky-count') };
}

test('read: replies oldest first, their replies nested, every one counted', () => {
    const data = thread([
        node('second', { when: '2026-07-11T00:00:00.000Z' }),
        node('first', { when: '2026-07-10T00:00:00.000Z', likes: 5, replies: [node('my answer', { did: ME })] }),
    ]);
    const got = api.read(data);
    assert.deepEqual(own(got.replies.map((r) => r.text)), ['first', 'second']);
    assert.deepEqual(own(got.replies[0].replies.map((r) => r.text)), ['my answer']);
    assert.equal(got.replies[0].likes, 5);
    assert.equal(got.total, 3);
    assert.equal(got.more, false);
    assert.match(got.replies[0].href, /^https:\/\/bsky\.app\/profile\/did:plc:j4fmrjnw3ig72iqmsfwi5u22\/post\/3k\d+$/);
});

test('read: blocked, missing, labelled and hidden replies stay on Bluesky', () => {
    const hidden = node('hidden by me');
    const data = thread([
        { $type: 'app.bsky.feed.defs#blockedPost', uri: 'at://x', blocked: true },
        { $type: 'app.bsky.feed.defs#notFoundPost', uri: 'at://y', notFound: true },
        node('spam', { labels: [{ val: 'spam' }] }),
        node('porn', { labels: [{ val: 'porn', src: THEM }] }),
        node('do not show me', { labels: [{ val: '!hide' }] }),
        node('signed-in readers only', { author: { labels: [{ val: '!no-unauthenticated' }] } }),
        node('a label of an odd shape', { labels: ['!warn'] }),
        hidden,
        node('a label taken back', { labels: [{ val: 'spam', neg: true }] }),
        node('fine'),
    ], { threadgate: { record: { hiddenReplies: [hidden.post.uri, 7, null] } } });
    assert.deepEqual(own(api.read(data).replies.map((r) => r.text)), ['a label taken back', 'fine']);
});

test('read: two levels, then a way on to Bluesky', () => {
    const deep = node('level 2', { replyCount: 3, replies: [node('level 3')] });
    const got = api.read(thread([node('level 1', { replies: [deep, node('level 2, the end')] })]));
    const second = got.replies[0].replies;
    assert.deepEqual(own(second.map((r) => r.text)), ['level 2', 'level 2, the end']);
    assert.deepEqual(own(second.map((r) => r.more)), [true, false]);
    assert.deepEqual(own(second[0].replies), []);
    assert.equal(got.total, 3);
});

test('read: a long list is cut, and says there is more', () => {
    const many = Array.from({ length: 25 }, (_, i) => node('reply ' + i));
    const got = api.read(thread(many));
    assert.equal(got.replies.length, 20);
    assert.equal(got.more, true);
});

test('read: a reply with no words is kept only when it has an attachment', () => {
    const got = api.read(thread([
        node('', { record: { embed: { $type: 'app.bsky.embed.images', images: [] } } }),
        node('   '),
    ]));
    assert.equal(got.replies.length, 1);
    assert.equal(got.replies[0].attached, true);
});

test('read: a name or handle that cannot be trusted is not shown', () => {
    const got = api.read(thread([
        node('a', { when: '2026-01-01T00:00:00Z', author: { handle: 'handle.invalid', displayName: '' } }),
        node('b', { when: '2026-01-02T00:00:00Z', author: { handle: 'bad"handle<', displayName: '‮evil​  name' } }),
        node('c', { when: '2026-01-03T00:00:00Z', author: { handle: 'fine.example', displayName: 7 } }),
    ]));
    assert.deepEqual(own(got.replies.map((r) => [r.name, r.handle])),
        [['Someone on Bluesky', ''], ['evil name', ''], ['@fine.example', '']]);
});

test('read: a date in the future gives way to the day the reply was indexed', () => {
    const [reply] = api.read(thread([node('x', { when: '2099-01-01T00:00:00Z', indexed: '2026-07-10T00:00:00Z' })])).replies;
    assert.equal(reply.when.toISOString(), '2026-07-10T00:00:00.000Z');
    const [undated] = api.read(thread([node('x', { when: 'soon', indexed: 'later' })])).replies;
    assert.equal(undated.when, null);
});

const GARBAGE = [
    undefined, null, 0, 7, '', 'thread', [], [[]], {}, { thread: null }, { thread: 'x' }, { thread: [] },
    { thread: { $type: 'app.bsky.feed.defs#notFoundPost' } },
    { thread: { $type: VIEW } },
    { thread: { $type: VIEW, post: 5, replies: 'many' } },
    { thread: { $type: VIEW, post: { threadgate: 'x' }, replies: {} } },
    { thread: { $type: VIEW, post: { threadgate: { record: { hiddenReplies: 'all' } } }, replies: [
        null, 3, 'x', [], {}, { $type: VIEW }, { $type: VIEW, post: null }, { $type: VIEW, post: [] },
        { $type: VIEW, post: { uri: 5 } },
        { $type: VIEW, post: { uri: 'at://nonsense' } },
        { $type: VIEW, post: { uri: `at://${THEM}/app.bsky.feed.post/a` } },
        { $type: VIEW, post: { uri: `at://${THEM}/app.bsky.feed.post/a`, record: 'r', author: 'a' } },
        { $type: VIEW, post: { uri: `at://${THEM}/app.bsky.feed.post/a`, record: {}, author: {} } },
        { $type: VIEW, post: { uri: `at://${THEM}/app.bsky.feed.post/b`, record: { text: 9, embed: [] }, author: {} } },
        { $type: VIEW, post: { uri: `at://${THEM}/app.bsky.feed.post/c`, author: { handle: {}, displayName: [], labels: 'none' },
            labels: {}, likeCount: 'lots', replyCount: -4, indexedAt: {},
            record: { text: 'kept', createdAt: 12, langs: 'en', facets: 'bold',
                reply: 'x' } }, replies: 'none' },
        { $type: VIEW, post: { uri: `at://${THEM}/app.bsky.feed.post/d`, author: { handle: 'ok.example' },
            record: { text: 'also kept', langs: [{}], facets: [null, 4, {}, { index: 'x' },
                { index: { byteStart: -1, byteEnd: 3 }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://example.org/' }] },
                { index: { byteStart: 2, byteEnd: 999 }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://example.org/' }] },
                { index: { byteStart: 1.5, byteEnd: 3 }, features: 'x' },
                { index: { byteStart: 0, byteEnd: 4 }, features: [null, 'x', { $type: 'app.bsky.richtext.facet#link', uri: {} }] }] } } },
    ] } },
];

test('read and render: an answer of any wrong shape draws what it can and never throws', () => {
    for (const data of GARBAGE) {
        assert.doesNotThrow(() => api.read(data), JSON.stringify(data));
        const { slot, drawn, list } = draw(data);
        assert.equal(typeof drawn, 'number');
        assert.equal(walk(list).filter((n) => n.className === 'kr-bsky-reply').length, drawn);
        // The invitation is still there whatever came back.
        assert.equal(slot.children[0].className, 'kr-bsky-invite');
    }
    const last = draw(GARBAGE[GARBAGE.length - 1]);
    assert.equal(last.drawn, 2);
    assert.equal(last.count.textContent, '2 replies from Bluesky');
    assert.deepEqual(walk(last.list).filter((n) => n.className === 'kr-bsky-reply__text').map((n) => n.textContent),
        ['kept', 'also kept']);
});

test('render: a slot that was never mounted, or is not an element, draws nothing', () => {
    assert.equal(api.render(null, thread([node('x')]), ENTRY.url), 0);
    assert.equal(api.render({}, thread([node('x')]), ENTRY.url), 0);
    assert.equal(api.render(makeElement('div'), thread([node('x')]), ENTRY.url), 0);
});

test('render: hostile strings stay text, and no link leaves http, https or bsky.app', () => {
    const attack = '<img src=x onerror=alert(1)><script>alert(2)</script>"\'>';
    const text = 'click ' + attack + ' here';
    const data = thread([
        node(text, {
            author: { handle: 'x" onmouseover="alert(3)', displayName: attack },
            record: { langs: ['en"><script>'], facets: [
                { index: { byteStart: 0, byteEnd: 5 }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'javascript:alert(4)' }] },
                { index: { byteStart: 6, byteEnd: 10 }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'data:text/html,<script>alert(5)</script>' }] },
                { index: { byteStart: 11, byteEnd: 14 }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: ' JaVaScRiPt:alert(6)' }] },
                { index: { byteStart: 15, byteEnd: 20 }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://user:pw@example.org/' }] },
                { index: { byteStart: 21, byteEnd: 24 }, features: [{ $type: 'app.bsky.richtext.facet#mention', did: 'javascript:alert(7)' }] },
            ] },
        }),
        node('path', { uri: `at://${THEM}/app.bsky.feed.post/../../../evil` }),
        node('host', { uri: 'at://did:plc:x/app.bsky.feed.post/a?b=//evil.example' }),
        node('scheme', { uri: 'javascript:alert(8)' }),
    ]);
    const { list, drawn } = draw(data);
    assert.equal(drawn, 1);
    const nodes = walk(list);
    for (const n of nodes) {
        assert.ok(['DIV', 'SPAN', 'A', 'TIME', 'BDI'].includes(n.tagName), n.tagName);
        for (const name of Object.keys(n.attrs)) {
            assert.ok(['role', 'aria-label', 'datetime', 'dir', 'lang'].includes(name), name);
        }
        assert.ok(!('innerHTML' in n) && !('outerHTML' in n));
        if (n.tagName === 'A') {
            assert.match(n.href, /^https:\/\/bsky\.app\/profile\/did:[a-z0-9:]+\/post\/[A-Za-z0-9]+$/);
            assert.equal(n.target, '_blank');
            assert.match(n.rel, /noopener noreferrer/);
        }
    }
    // The words arrive whole, as text; the name too; the handle and the
    // language tag, which are not what they claim to be, are not used.
    const words = nodes.find((n) => n.className === 'kr-bsky-reply__text');
    assert.equal(words.textContent, text);
    assert.deepEqual(words.children.map((c) => c.tagName), [undefined]);
    assert.equal(words.attrs.lang, undefined);
    assert.equal(nodes.find((n) => n.className === 'kr-bsky-reply__name').textContent, attack);
    assert.equal(nodes.some((n) => n.className === 'kr-bsky-reply__handle'), false);
});

test('render: link facets are cut by UTF-8 bytes and linked only when http(s)', () => {
    const text = 'Olé 📷 see example.org/a and bank.example now';
    const at = (s) => Buffer.byteLength(text.slice(0, text.indexOf(s)), 'utf8');
    const facet = (s, uri) => ({ index: { byteStart: at(s), byteEnd: at(s) + Buffer.byteLength(s, 'utf8') },
        features: [{ $type: 'app.bsky.richtext.facet#link', uri }] });
    const data = thread([node(text, { record: { langs: ['es'], facets: [
        facet('bank.example', 'https://elsewhere.example/login'),
        facet('example.org/a', 'https://www.example.org/a?x=1'),
        // Starts first, so the facet it runs into (example.org/a) is the one dropped.
        facet('see example.org', 'https://overlap.example/'),
    ] } })]);
    const words = walk(draw(data).list).find((n) => n.className === 'kr-bsky-reply__text');
    assert.equal(words.attrs.lang, 'es');
    assert.equal(words.attrs.dir, 'auto');
    assert.deepEqual(words.children.map((c) => (c.tagName ? [c.textContent, c.href, c.rel] : c.text)), [
        'Olé 📷 ',
        ['see example.org', 'https://overlap.example/', 'noopener noreferrer nofollow ugc'],
        ' (overlap.example)',
        '/a and ',
        ['bank.example', 'https://elsewhere.example/login', 'noopener noreferrer nofollow ugc'],
        // The words name one host and the link leads to another: say so.
        ' (elsewhere.example)',
        ' now',
    ]);
});

test('render: a link whose words name its own host is left as it is', () => {
    const shown = 'www.kenreid.co.uk/blog/hosting...';
    const text = shown + ' and https://example.org';
    const data = thread([node(text, { record: { facets: [
        { index: { byteStart: 0, byteEnd: shown.length }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://www.kenreid.co.uk/blog/hosting-photography-on-github-for-free.html' }] },
        { index: { byteStart: shown.length + 5, byteEnd: text.length }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: 'https://example.org/' }] },
    ] } })]);
    const words = walk(draw(data).list).find((n) => n.className === 'kr-bsky-reply__text');
    assert.deepEqual(words.children.map((c) => (c.tagName ? 'A:' + c.textContent : c.text)),
        ['A:www.kenreid.co.uk/blog/hosting...', ' and ', 'A:https://example.org']);
});

test('render: the count line, the likes, the attachment and the ways on', () => {
    const many = Array.from({ length: 21 }, (_, i) => node('reply ' + i, { when: `2026-07-${String(i + 1).padStart(2, '0')}T12:00:00Z` }));
    // Midday UTC, so the date reads the same in whatever zone the suite runs.
    many[0] = node('with a picture', { when: '2026-06-01T12:00:00Z', likes: 1,
        record: { embed: { $type: 'app.bsky.embed.images' } },
        replies: [node('deeper', { replyCount: 2, likes: 12 })] });
    const { slot, list, count, drawn } = draw(thread(many));
    assert.equal(drawn, 21);
    assert.equal(count.textContent, '21 replies from Bluesky');
    assert.equal(count.attrs.role, 'status');
    const links = walk(list).filter((n) => n.tagName === 'A' && n.className === 'kr-bsky-more').map((a) => a.textContent);
    assert.deepEqual(links, ['See what is attached on Bluesky', 'Continue this thread on Bluesky', 'More replies on Bluesky']);
    const metas = walk(list).filter((n) => n.className === 'kr-bsky-reply__meta').map((n) => n.textContent);
    assert.deepEqual(metas.slice(0, 2), ['1 likeSee what is attached on Bluesky', '12 likes']);
    const time = walk(list).find((n) => n.tagName === 'TIME');
    assert.equal(time.attrs.datetime, '2026-06-01T12:00:00.000Z');
    assert.equal(time.textContent, '1 June 2026');
    // The top list is labelled; a nested one is not.
    const lists = walk(list).filter((n) => n.attrs.role === 'list');
    assert.deepEqual(lists.map((n) => n.attrs['aria-label']), ['Replies from Bluesky', undefined]);
    assert.equal(walk(slot).filter((n) => n.attrs.role === 'listitem').length, 21);
});

test('render: no replies leaves only the invitation, and a second answer replaces the first', () => {
    const { slot, api: local } = mounted();
    assert.equal(local.render(slot, thread([node('one'), node('two')]), ENTRY.url), 2);
    assert.equal(slot.querySelector('.kr-bsky-count').textContent, '2 replies from Bluesky');
    assert.equal(local.render(slot, thread([node('only')]), ENTRY.url), 1);
    assert.equal(slot.querySelector('.kr-bsky-count').textContent, '1 reply from Bluesky');
    assert.equal(walk(slot).filter((n) => n.className === 'kr-bsky-reply').length, 1);
    assert.equal(local.render(slot, thread([]), ENTRY.url), 0);
    assert.equal(slot.querySelector('.kr-bsky-count').textContent, '');
    assert.equal(slot.querySelector('.kr-bsky-list').children.length, 0);
    assert.equal(slot.querySelector('.kr-bsky-invite').children[1].textContent, 'Reply on Bluesky');
});

test('mount: one request, to the public API, for this post and nothing else', async () => {
    const asked = [];
    const local = load((url, init) => {
        asked.push([url, init]);
        return Promise.resolve({ ok: true, json: () => Promise.resolve(thread([node('hello')])) });
    });
    const slot = makeElement('div');
    assert.equal(await local.mount(slot, ENTRY), 1);
    assert.equal(asked.length, 1);
    const [url, init] = asked[0];
    assert.equal(url, 'https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=' +
        encodeURIComponent(ENTRY.uri) + '&depth=2&parentHeight=0');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.referrerPolicy, 'no-referrer');
    const reply = slot.querySelector('.kr-bsky-invite').children[1];
    assert.deepEqual([reply.tagName, reply.href, reply.textContent], ['A', ENTRY.url, 'Reply on Bluesky']);
    // Mounting the same slot again asks nothing more.
    assert.equal(await local.mount(slot, ENTRY), 0);
    assert.equal(asked.length, 1);
});

test('mount: a request that fails leaves the invitation and its link, nothing else', async () => {
    for (const failing of [
        () => Promise.reject(new TypeError('Failed to fetch')),
        () => Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ error: 'NotFound' }) }),
        () => Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('not JSON')) }),
    ]) {
        const slot = makeElement('div');
        assert.equal(await load(failing).mount(slot, ENTRY), 0);
        assert.deepEqual(slot.children.map((c) => c.className), ['kr-bsky-invite', 'kr-label kr-bsky-count', 'kr-bsky-list']);
        assert.equal(slot.querySelector('.kr-bsky-count').textContent, '');
        assert.equal(slot.querySelector('.kr-bsky-list').children.length, 0);
    }
});

test('mount: an entry that is not a Bluesky post asks nothing and draws nothing', async () => {
    const asked = [];
    const local = load((url) => { asked.push(url); return Promise.reject(new Error('no')); });
    for (const entry of [null, {}, { uri: ENTRY.uri }, { uri: ENTRY.uri, url: 'https://evil.example/profile/x/post/y' },
        { uri: ENTRY.uri, url: 'javascript:alert(1)' }, { uri: 'https://example.org/', url: ENTRY.url },
        { uri: ENTRY.uri + '&depth=1000', url: ENTRY.url }, { uri: 5, url: [] }]) {
        const slot = makeElement('div');
        assert.equal(await local.mount(slot, entry), 0);
        assert.equal(slot.children.length, 0);
    }
    assert.deepEqual(asked, []);
});
