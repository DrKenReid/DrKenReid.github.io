/**
 * palette.js: the site-wide command palette (Ctrl+K, Cmd+K on a Mac, or /).
 *
 * WHAT IT FINDS
 *   - every page marked inPalette in KR_PAGES (shared-components.js), the
 *     site map the footer reads too, with a live count for a few (LIVE_SUB)
 *   - every post, by title, tags and excerpt        (data/posts.json)
 *   - every series, named in those same posts       (data/posts.json)
 *   - the gallery's photo tags, as filtered views   (KR_PHOTO_CATEGORIES -> gallery.html?tag=)
 *   - the photo map's places                        (data/photo-locations.json -> map.html?region=)
 *
 * WHAT IT DOES NOT, ON PURPOSE
 *   No text from inside posts, no individual quotes, no individual photographs.
 *   A full-text index grows with every word written and answers a question
 *   nobody asks a personal site; titles, tags and excerpts answer "take me to
 *   the thing I half remember". The argument is made in
 *   blog/ctrl-k-for-a-static-site.html (https://kenreid.co.uk/blog/ctrl-k-for-a-static-site.html).
 *   A new source should be a destination (a page, a filtered view, a place),
 *   never a paragraph.
 *
 * LOADED BY
 *   A deferred <script> in the <head> of every page, the 404 page included
 *   (generate_post_head.py writes it into posts); offline.html, the service
 *   worker's no-network page, has nothing to search and goes without. It
 *   builds no DOM and fetches nothing until the first open, because most
 *   visitors never press the key.
 *
 * RANKING (match(), below)
 *   Where the query sits in a field decides the score, each field's weight
 *   scales it, and anything under MIN_SCORE is dropped rather than shown as a
 *   near miss. Letters-in-order matching ("phto" finds Photography) is allowed
 *   in titles only, inside one word, for queries of four letters or more.
 *   A title is a few words, so letters
 *   falling in order inside one of them mean something; across a thirty-word
 *   excerpt almost any query's letters fall in order somewhere, which is how
 *   "rothfuss" used to return ten posts when one mentions him, and across the
 *   gap between two words of a title the same happens on a smaller scale
 *   ("ant" matched "and The" in five titles). Outside titles a hit must also
 *   start a word. Initials count anywhere ("tsp", Travelling Salesman
 *   Problem), within the limits initials() sets out.
 *
 * PATHS
 *   Every href goes through siteRootPrefix() and every fetch through
 *   krFetchJson(), both in shared-components.js: they know every depth pages
 *   are served from (posts in blog/, draft previews nested below blog/drafts/,
 *   and the 404 page, which marks itself data-kr-root="/" because it is
 *   served at whatever URL was missed).
 *
 * SHARED HELPERS
 *   Every page that loads this file also loads shared-components.js, as a
 *   plain script at the foot of <body>; this one is deferred, so it runs
 *   after that has, and its helpers (siteRootPrefix, krFetchJson,
 *   loadBlogPosts, krEscapeHtml, krIsMac, seriesPageHref,
 *   KR_PHOTO_CATEGORIES, KR_PAGES) are called directly rather than copied here.
 *   They are only ever read inside functions that run on DOMContentLoaded
 *   or later, never while this file is parsed: drafts copied from an older
 *   head still load it without defer, above shared-components.js, and a
 *   top-level reference would throw there and take Ctrl+K with it.
 *
 * PUBLIC
 *   window.krPalette = { open(), close(), isOpen(), ready(), search(query) }
 *   open/close for any other control that wants to summon it; ready()
 *   resolves once the JSON sources have loaded; search() returns the ranked
 *   results as data, which is what tests should assert on.
 */
(() => {
    'use strict';

    // Results scoring below this are dropped. It admits a hit anywhere in a
    // title (60), a word-start hit or initials in an excerpt (80 x 0.6 = 48)
    // and a tight letters-in-order title match (47 and up), and nothing
    // looser.
    const MIN_SCORE = 40;
    const MAX_RESULTS = 10;

    // How much a hit in each kind of field counts, so a title hit outranks a
    // tag hit, which outranks one in a description. `name` is the title of a
    // filtered view (a photo tag, a place): a destination, but a post or a
    // page of the same name should come first.
    const WEIGHT = { title: 1, name: 0.9, tag: 0.7, excerpt: 0.6, subtitle: 0.5 };

    // Subtitles worked out from the loaded data, by KR_PAGES key, in place
    // of the page's written blurb. Counts are only ever counted, never
    // typed in, so they cannot drift from the site; each returns null
    // until its data arrives and the blurb shows meanwhile.
    const LIVE_SUB = {
        map: () => (places && places.length
            ? `${plural(places.reduce((n, p) => n + p.count, 0), 'photograph')} in ${plural(places.length, 'place')}`
            : null),
        blog: () => (posts ? `All ${plural(posts.length, 'post')}` : null),
        series: () => (series.length ? `All ${series.length} series` : null)
    };

    // The palette's pages, from the site map. Read when the catalogue is
    // built, never at parse time (see SHARED HELPERS).
    function pages() {
        return KR_PAGES.filter((p) => p.inPalette).map((p) => ({
            title: p.label,
            sub: (LIVE_SUB[p.key] && LIVE_SUB[p.key]()) || p.blurb,
            url: p.href
        }));
    }

    // Initials only count over words at least this long. Shorter words are
    // mostly "the", "and", "a", and let "tsp" find "the selection pressure"
    // and "ant" find "and no tracking". Measured on the post excerpts in
    // September 2026: about one three-letter string in sixty then matches
    // anything, and nearly always a single post.
    const INITIALS_MIN_WORD = 4;

    let overlay = null;
    let input = null;
    let list = null;
    let empty = null;
    let live = null;
    let items = [];
    let active = 0;
    let posts = null;
    let series = [];
    let places = null;
    let entries = null;
    let indexReady = null;
    let returnFocus = null;

    // Looked up when called, not when this file is parsed (see SHARED
    // HELPERS): an alias taken here threw on every page that still loads
    // this file without defer, above shared-components.js.
    function esc(text) {
        return krEscapeHtml(text);
    }

    // seriesPageHref() names the series pages from the site root ('/...');
    // the palette prefixes every destination with siteRootPrefix() itself.
    function seriesUrl(name) {
        return seriesPageHref(name).replace(/^\//, '');
    }

    function plural(n, word) {
        return `${n} ${word}${n === 1 ? '' : 's'}`;
    }

    /* ------------------------------------------------------------------ *
     * Matching
     * ------------------------------------------------------------------ */

    // One query against one field. Returns { score, hits } or null, where
    // hits are [start, end) ranges of the field to highlight.
    //
    //   the whole field                       120
    //   the start of the field                100
    //   the start of a word                    80
    //   the initials of consecutive words      80
    //   inside a word (titles only)            60
    //   several words, each found as above     their mean, less 10
    //   letters in order in one word (titles)  40 to 55, by how tightly they cluster
    function match(query, text, isTitle) {
        if (!text) return null;
        const t = text.toLowerCase();
        const whole = locate(query, t, isTitle);
        if (whole) return whole;
        const words = query.split(' ');
        if (words.length > 1) {
            const found = words.map((w) => locate(w, t, isTitle));
            if (found.every(Boolean)) {
                const mean = found.reduce((sum, f) => sum + f.score, 0) / found.length;
                return { score: mean - 10, hits: found.flatMap((f) => f.hits) };
            }
        }
        return initials(query, t) || (isTitle ? inOrder(query, t) : null);
    }

    function locate(q, t, anywhere) {
        if (t === q) return { score: 120, hits: [[0, q.length]] };
        let inside = -1;
        // A later hit at a word start beats an earlier one mid-word:
        // "art" should light up "Art" in a title before "stARTing".
        for (let i = t.indexOf(q); i !== -1; i = t.indexOf(q, i + 1)) {
            if (i === 0) return { score: 100, hits: [[0, q.length]] };
            if (!/[a-z0-9]/.test(t[i - 1])) return { score: 80, hits: [[i, i + q.length]] };
            if (inside === -1) inside = i;
        }
        return anywhere && inside !== -1 ? { score: 60, hits: [[inside, inside + q.length]] } : null;
    }

    // A query typed as initials: "tsp" for Travelling Salesman Problem,
    // "vns" for Variable Neighbourhood Search. The words must follow one
    // another and be INITIALS_MIN_WORD letters or longer. Each initial is
    // highlighted, which shows why the result is there.
    function initials(q, t) {
        if (q.length < 3 || q.includes(' ')) return null;
        const words = [...t.matchAll(/[a-z0-9]+/g)];
        for (let i = 0; i + q.length <= words.length; i++) {
            let k = 0;
            while (k < q.length && words[i + k][0].length >= INITIALS_MIN_WORD &&
                words[i + k][0][0] === q[k]) k++;
            if (k === q.length) {
                return { score: 80, hits: words.slice(i, i + k).map((w) => [w.index, w.index + 1]) };
            }
        }
        return null;
    }

    // The query's letters in order, forgiving dropped letters ("phto",
    // "rothfus"). Only the tightest window counts, and one more than twice
    // the query's length is not a match: by then the letters are scattered.
    // The window stays inside one run of non-space characters, which is
    // still a word for "mash" in M*A*S*H; letters picked up on both sides
    // of a space are initials() or nothing. The whole window is
    // highlighted, not letter by letter, which reads as "near here" rather
    // than as a word with holes in it. Four letters at least: three can
    // spread over six, and "ant" then found "Aren't" in three titles. A
    // three-letter query still finds substrings and initials.
    function inOrder(q, t) {
        if (q.length < 4) return null;
        let best = null;
        for (const m of t.matchAll(/\S+/g)) {
            const w = m[0];
            for (let start = w.indexOf(q[0]); start !== -1; start = w.indexOf(q[0], start + 1)) {
                let pos = start;
                for (let k = 1; k < q.length && pos !== -1; k++) pos = w.indexOf(q[k], pos + 1);
                // Starting further along can only run out sooner.
                if (pos === -1) break;
                if (!best || pos + 1 - start < best.end - best.start) {
                    best = { start: m.index + start, end: m.index + pos + 1 };
                }
            }
        }
        const span = best ? best.end - best.start : Infinity;
        if (span > q.length * 2) return null;
        return { score: 40 + 15 * q.length / span, hits: [[best.start, best.end]] };
    }

    /* ------------------------------------------------------------------ *
     * The catalogue: everything the palette can find, in one shape.
     *   { id, kind, title, sub, href, fields: [{ text, weight, title?, excerpt? }] }
     * A field flagged `title` gets the looser title matching and its hits
     * highlight the title; one flagged `excerpt` shows its hit in place of
     * the subtitle, so a result found by its excerpt says why it is there.
     * ------------------------------------------------------------------ */

    function catalogue() {
        if (entries) return entries;
        const root = siteRootPrefix();
        const out = [];
        const add = (kind, title, sub, url, fields) => {
            out.push({ id: optionId(kind, url, out), kind, title, sub, href: root + url, fields });
        };

        for (const p of pages()) {
            add('Page', p.title, p.sub, p.url, [
                { text: p.title, weight: WEIGHT.title, title: true },
                { text: p.sub, weight: WEIGHT.subtitle }
            ]);
        }
        // Series before posts: a series and one of its parts often share a
        // word ("Live"), and on a tie the collection is the better landing.
        for (const s of series) {
            add('Series', s.name, plural(s.parts, 'part'), seriesUrl(s.name), [
                { text: s.name, weight: WEIGHT.title, title: true }
            ]);
        }
        for (const p of posts || []) {
            const tags = p.tags || [];
            add('Post', p.title, tags.join(' · '), p.url || 'blog.html', [
                { text: p.title, weight: WEIGHT.title, title: true },
                ...tags.map((tag) => ({ text: tag, weight: WEIGHT.tag })),
                { text: p.excerpt, weight: WEIGHT.excerpt, excerpt: true }
            ]);
        }
        for (const tag of KR_PHOTO_CATEGORIES) {
            add('Photos', `${tag.label} photos`, 'Gallery filter', `gallery.html?tag=${encodeURIComponent(tag.key)}`, [
                { text: tag.label, weight: WEIGHT.name, title: true },
                { text: tag.key, weight: WEIGHT.name },
                { text: tag.also, weight: WEIGHT.tag }
            ]);
        }
        for (const pl of places || []) {
            add('Place', pl.name, `${plural(pl.count, 'photo')} on the map`,
                `map.html?region=${encodeURIComponent(pl.name)}`, [
                    { text: pl.name, weight: WEIGHT.name, title: true }
                ]);
        }
        entries = out;
        return out;
    }

    // Derived from the destination, not the position in the list, so an
    // option keeps its id while the query changes around it. That is what
    // makes aria-activedescendant change (and a screen reader speak) when a
    // different result moves to the top, and stay put when the same one does.
    function optionId(kind, url, taken) {
        let h = 5381;
        const key = `${kind}|${url}`;
        for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
        let id = `kr-palette-opt-${(h >>> 0).toString(36)}`;
        while (taken.some((e) => e.id === id)) id += 'x';
        return id;
    }

    function search(query) {
        const q = String(query || '').trim().toLowerCase().replace(/\s+/g, ' ');
        const all = catalogue();
        // No query: the pages, as a menu.
        if (!q) return all.filter((e) => e.kind === 'Page').map((e) => ({ entry: e, score: 0 }));

        const results = [];
        for (const e of all) {
            let top = null;
            for (const f of e.fields) {
                const m = match(q, f.text, f.title);
                if (m && (!top || m.score * f.weight > top.score)) {
                    top = { score: m.score * f.weight, hits: m.hits, field: f };
                }
            }
            if (top && top.score >= MIN_SCORE) results.push({ entry: e, ...top });
        }
        // Array sort is stable, so equal scores keep catalogue order:
        // pages, series, posts newest first, photo tags, places.
        return results.sort((a, b) => b.score - a.score).slice(0, MAX_RESULTS);
    }

    /* ------------------------------------------------------------------ *
     * Rendering
     * ------------------------------------------------------------------ */

    // Escapes the text and wraps each hit in <mark>. A multi-word query can
    // hit overlapping or touching ranges ("live" and "li"), so those are
    // merged first and never nest.
    function highlight(text, hits) {
        if (!hits || !hits.length) return esc(text);
        const ranges = hits
            .map(([a, b]) => [Math.max(0, a), Math.min(text.length, b)])
            .filter(([a, b]) => b > a)
            .sort((x, y) => x[0] - y[0])
            .reduce((acc, r) => {
                const last = acc[acc.length - 1];
                if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
                else acc.push(r);
                return acc;
            }, []);
        let html = '';
        let at = 0;
        for (const [a, b] of ranges) {
            html += `${esc(text.slice(at, a))}<mark class="kr-palette-mark">${esc(text.slice(a, b))}</mark>`;
            at = b;
        }
        return html + esc(text.slice(at));
    }

    // An excerpt is longer than the line it gets, so a hit far into it is
    // shown from the start of a word shortly before, after an ellipsis.
    // Returns the text to show and the hits moved to match it.
    function excerptWindow(text, hits) {
        const first = Math.min(...hits.map((h) => h[0]));
        const from = first > 24 ? text.lastIndexOf(' ', first - 12) + 1 : 0;
        if (!from) return { text, hits };
        // +1 for the ellipsis, which is one character.
        const moved = hits.filter(([a]) => a >= from).map(([a, b]) => [a - from + 1, b - from + 1]);
        return { text: `…${text.slice(from)}`, hits: moved };
    }

    function optionHtml(r) {
        const e = r.entry;
        const f = r.field || {};
        const title = f.title && f.text && e.title.toLowerCase().startsWith(f.text.toLowerCase())
            ? highlight(e.title, r.hits)
            : esc(e.title);
        const sub = f.excerpt ? excerptWindow(f.text, r.hits) : { text: e.sub || '', hits: null };
        // The option's name is spelled out because the markup order puts
        // the kind first and has no pauses: read as is, it came out as
        // "Series Research, Live 3 parts". Title first, commas between.
        const name = [e.title, e.kind.toLowerCase(), sub.text.replace(/ · /g, ', ')].filter(Boolean).join(', ');
        return `<a href="${esc(e.href)}" id="${e.id}" class="kr-palette-item" role="option" ` +
            `aria-selected="false" aria-label="${esc(name)}" tabindex="-1">` +
            `<span class="kr-palette-kind">${esc(e.kind)}</span>` +
            `<span class="kr-palette-text"><span class="kr-palette-title">${title}</span>` +
            (sub.text ? `<span class="kr-palette-sub">${highlight(sub.text, sub.hits)}</span>` : '') +
            '</span></a>';
    }

    // keepPlace: re-rendering because data arrived, not because the query
    // changed, so the reader's highlighted row stays highlighted.
    function render(keepPlace) {
        const was = keepPlace && items[active] ? items[active].entry.id : null;
        items = search(input.value);
        list.innerHTML = items.map(optionHtml).join('');
        list.hidden = !items.length;
        empty.hidden = Boolean(items.length);
        input.setAttribute('aria-expanded', String(items.length > 0));
        live.textContent = items.length ? plural(items.length, 'result') : 'No results';
        const again = was ? items.findIndex((r) => r.entry.id === was) : -1;
        setActive(again > -1 ? again : 0);
    }

    function setActive(i) {
        const options = list.querySelectorAll('.kr-palette-item');
        if (!options.length) {
            input.removeAttribute('aria-activedescendant');
            return;
        }
        active = (i + options.length) % options.length;
        options.forEach((el, j) => {
            el.classList.toggle('active', j === active);
            el.setAttribute('aria-selected', String(j === active));
        });
        input.setAttribute('aria-activedescendant', options[active].id);
        options[active].scrollIntoView({ block: 'nearest' });
    }

    /* ------------------------------------------------------------------ *
     * The dialog
     * ------------------------------------------------------------------ */

    function build() {
        overlay = document.createElement('div');
        overlay.className = 'kr-palette-overlay';
        // The key hints and the Close button share the footer; CSS shows the
        // hints where there is a pointer that hovers and the button where
        // there is not (phones), which is where Escape does not exist. The
        // hints are hidden from screen readers: "combobox" already tells
        // their users which keys work, and the arrows read out as symbols.
        overlay.innerHTML =
            '<div class="kr-palette" role="dialog" aria-modal="true" aria-label="Search the site">' +
            '<input type="text" class="kr-palette-input" placeholder="Search posts, pages, photos…" ' +
            'aria-label="Search the site" role="combobox" aria-expanded="false" aria-controls="kr-palette-list" ' +
            'aria-autocomplete="list" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go">' +
            '<div class="kr-palette-list" id="kr-palette-list" role="listbox" aria-label="Results"></div>' +
            '<p class="kr-palette-empty" hidden>No matches. Try a post title, page, series, photo tag, or place.</p>' +
            '<div class="kr-palette-live sr-only" aria-live="polite"></div>' +
            '<div class="kr-palette-foot">' +
            '<span class="kr-palette-key" aria-hidden="true">&uarr;&darr; navigate</span>' +
            '<span class="kr-palette-key" aria-hidden="true">&crarr; open</span>' +
            '<span class="kr-palette-key" aria-hidden="true">esc close</span>' +
            '<button type="button" class="kr-palette-close">Close</button>' +
            '</div></div>';
        document.body.appendChild(overlay);
        input = overlay.querySelector('.kr-palette-input');
        list = overlay.querySelector('.kr-palette-list');
        empty = overlay.querySelector('.kr-palette-empty');
        live = overlay.querySelector('.kr-palette-live');

        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) close();
        });
        overlay.querySelector('.kr-palette-close').addEventListener('click', close);
        input.addEventListener('input', () => render(false));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
            else if (e.key === 'Tab') {
                // Focus trap: the input is the palette's single focus stop;
                // Tab moves the selection instead of leaving the dialog.
                e.preventDefault();
                setActive(active + (e.shiftKey ? -1 : 1));
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (items[active]) window.location.href = items[active].entry.href;
            } else if (e.key === 'Escape') {
                e.preventDefault();
                close();
            }
        });
        list.addEventListener('mousemove', (e) => {
            const el = e.target.closest('.kr-palette-item');
            if (!el) return;
            const i = Array.prototype.indexOf.call(list.children, el);
            if (i !== active) setActive(i);
        });
    }

    function loadIndex() {
        if (indexReady) return indexReady;
        // A source that fails stays empty and the rest still work: the pages
        // are written in above, so the palette is never useless.
        const settle = (promise, apply) => promise.then((data) => {
            apply(data);
            entries = null;
            if (isOpen()) render(true);
        }).catch(() => {});
        // Through the page's shared cache, so a page that has already
        // fetched either file (the header reads posts.json, the gallery
        // photo-locations.json) does not fetch it again.
        indexReady = Promise.all([
            settle(loadBlogPosts(), (data) => {
                posts = Array.isArray(data) ? data : [];
                const counts = new Map();
                for (const p of posts) {
                    for (const s of [].concat(p.series || [])) {
                        if (s && s.name) counts.set(s.name, (counts.get(s.name) || 0) + 1);
                    }
                }
                series = [...counts].map(([name, parts]) => ({ name, parts }));
            }),
            settle(krFetchJson('data/photo-locations.json'), (data) => {
                places = (data.regions || []).map((r) => ({ name: r.name, count: (r.photos || []).length }));
            })
        ]).then(() => undefined);
        return indexReady;
    }

    const isOpen = () => Boolean(overlay) && overlay.classList.contains('is-open');

    function open() {
        if (!overlay) build();
        if (isOpen()) return;
        // Summoned from the phone menu's Search item: the menu makes the
        // rest of the page inert, this overlay included, so it closes
        // first. Closing hands focus to the menu button, which then
        // becomes the place focus returns to.
        if (window.krNavMenu && window.krNavMenu.isOpen()) window.krNavMenu.close();
        // Remembered so closing hands focus back to whatever summoned the
        // palette (the nav button, or the link the reader was on).
        returnFocus = document.activeElement;
        loadIndex();
        overlay.classList.add('is-open');
        document.body.classList.add('kr-palette-open');
        input.value = '';
        render(false);
        // Focus synchronously: mobile browsers only raise the soft keyboard
        // when focus happens inside the user gesture. The retry covers the
        // display change not having applied yet on some engines.
        input.focus();
        setTimeout(() => { if (isOpen()) input.focus(); }, 30);
    }

    function close() {
        if (!isOpen()) return;
        overlay.classList.remove('is-open');
        document.body.classList.remove('kr-palette-open');
        const back = returnFocus;
        returnFocus = null;
        if (back && back !== document.body && back.isConnected && typeof back.focus === 'function') {
            back.focus({ preventScroll: true });
        }
    }

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (isOpen()) close(); else open();
        } else if (e.key === '/' && !isOpen()) {
            const t = e.target;
            const typing = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
            if (!typing) { e.preventDefault(); open(); }
        } else if (e.key === 'Escape' && isOpen()) {
            close();
        }
    });

    // The nav's Search button. The header is injected by shared-components.js,
    // so wait for #nav to exist before appending it.
    function insertNavButton() {
        const nav = document.getElementById('nav');
        if (!nav || document.querySelector('.kr-palette-hint')) return Boolean(nav);
        const mac = krIsMac();
        const li = document.createElement('li');
        li.innerHTML = `<a href="#" class="kr-palette-hint" role="button" aria-label="Search the site" ` +
            `aria-haspopup="dialog" aria-keyshortcuts="${mac ? 'Meta+K' : 'Control+K'}">` +
            '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>' +
            '<span class="kr-palette-word">Search</span>' +
            `<span class="kr-palette-kbd" aria-hidden="true">${mac ? '⌘K' : 'Ctrl K'}</span></a>`;
        const button = li.querySelector('a');
        button.addEventListener('click', (e) => {
            e.preventDefault();
            open();
        });
        // role="button" promises Space works as well as Enter.
        button.addEventListener('keydown', (e) => {
            if (e.key === ' ') {
                e.preventDefault();
                open();
            }
        });
        nav.appendChild(li);
        return true;
    }

    function whenNavExists() {
        if (insertNavButton()) return;
        const mo = new MutationObserver(() => {
            if (insertNavButton()) mo.disconnect();
        });
        mo.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', whenNavExists);
    else whenNavExists();

    window.krPalette = {
        open,
        close,
        isOpen,
        ready: loadIndex,
        search: (query) => search(query).map((r) => ({
            kind: r.entry.kind,
            title: r.entry.title,
            sub: r.entry.sub,
            href: r.entry.href,
            score: Math.round(r.score)
        }))
    };
})();
