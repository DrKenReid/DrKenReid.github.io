/**
 * palette.js — site-wide command palette (Ctrl/Cmd+K, or '/').
 *
 * Fuzzy search across pages, blog posts (data/posts.json), photo tags,
 * and map places (deep links to gallery.html?tag=... and map.html?region=...).
 * Vanilla JS, builds its DOM on first open, loaded with defer on every page.
 */
(() => {
    const prefix = /\/blog\//.test(window.location.pathname) ? '../' : './';

    const PAGES = [
        { title: 'Home', sub: 'Intro and latest posts', url: 'index.html' },
        { title: 'About', sub: 'Who I am', url: 'about.html' },
        { title: 'Data Science', sub: 'Projects & publications', url: 'data_science.html' },
        { title: 'Photography', sub: '490+ photos', url: 'gallery.html' },
        { title: 'Photo Map', sub: 'Photographs by place', url: 'map.html' },
        { title: 'Music', sub: 'Guitar & listening stats', url: 'music.html' },
        { title: 'Literature', sub: 'Reviews & reading stats', url: 'literature.html' },
        { title: 'Quote Wall', sub: '571 saved passages', url: 'quotes.html' },
        { title: 'Blog', sub: 'All posts', url: 'blog.html' },
        { title: 'Contact', sub: 'Get in touch', url: 'contact.html' }
    ];

    const PHOTO_TAGS = ['wildlife', 'portrait', 'bw', 'architecture', 'abandoned',
        'urban', 'nature', 'silhouette', 'landscape', 'winter'];

    let overlay = null;
    let input = null;
    let list = null;
    let items = [];
    let active = 0;
    let posts = null;
    let places = null;
    let indexRequested = false;

    // Score ladder: exact 120, prefix 100, word boundary 80, anywhere 60,
    // letters-in-the-right-order 25, no match 0.
    function score(query, text) {
        if (!text) return 0;
        const q = query.toLowerCase();
        const t = text.toLowerCase();
        if (t === q) return 120;
        const idx = t.indexOf(q);
        if (idx === 0) return 100;
        if (idx > 0) return t[idx - 1] === ' ' ? 80 : 60;
        let ti = 0;
        for (const ch of q) {
            ti = t.indexOf(ch, ti);
            if (ti === -1) return 0;
            ti++;
        }
        return 25;
    }

    function collectResults(query) {
        const q = query.trim();
        const results = [];
        const add = (s, kind, title, sub, href) => {
            if (s > 0) results.push({ score: s, kind, title, sub, href });
        };

        // With an empty query the palette shows the pages as a menu.
        for (const p of PAGES) {
            add(q ? Math.max(score(q, p.title), score(q, p.sub) * 0.5) : 10,
                'Page', p.title, p.sub, prefix + p.url);
        }
        if (q) {
            for (const p of posts || []) {
                const tags = (p.tags || []).join(' ');
                add(Math.max(score(q, p.title), score(q, tags) * 0.8, score(q, p.excerpt || '') * 0.4),
                    'Post', p.title, (p.tags || []).join(' · '), prefix + (p.url || ''));
            }
            for (const t of PHOTO_TAGS) {
                add(score(q, t) * 0.9, 'Photos', `${t[0].toUpperCase()}${t.slice(1)} photos`,
                    'Gallery filter', `${prefix}gallery.html?tag=${t}`);
            }
            for (const pl of places || []) {
                add(score(q, pl.name) * 0.9, 'Place', pl.name,
                    `${pl.count} photo${pl.count === 1 ? '' : 's'} on the map`,
                    `${prefix}map.html?region=${encodeURIComponent(pl.name)}`);
            }
        }
        return results.sort((a, b) => b.score - a.score).slice(0, 10);
    }

    function render(query) {
        items = collectResults(query);
        active = 0;
        overlay.querySelector('.kr-palette-live').textContent =
            items.length ? `${items.length} result${items.length === 1 ? '' : 's'}` : 'No results';
        list.innerHTML = items.length
            ? items.map((r, i) =>
                `<a href="${r.href}" class="kr-palette-item${i === 0 ? ' active' : ''}" data-i="${i}">` +
                `<span class="kr-palette-kind">${r.kind}</span>` +
                `<span class="kr-palette-text"><span class="kr-palette-title">${r.title}</span>` +
                (r.sub ? `<span class="kr-palette-sub">${r.sub}</span>` : '') +
                '</span></a>').join('')
            : '<div class="kr-palette-empty">No matches. Try a post title, page, photo tag, or place.</div>';
    }

    function setActive(i) {
        const els = list.querySelectorAll('.kr-palette-item');
        if (!els.length) return;
        active = (i + els.length) % els.length;
        els.forEach((el, j) => el.classList.toggle('active', j === active));
        els[active].scrollIntoView({ block: 'nearest' });
    }

    function build() {
        overlay = document.createElement('div');
        overlay.className = 'kr-palette-overlay';
        overlay.innerHTML =
            '<div class="kr-palette" role="dialog" aria-modal="true" aria-label="Site search">' +
            '<input type="text" class="kr-palette-input" placeholder="Search posts, pages, photos…" aria-label="Search site" role="combobox" aria-expanded="true" aria-autocomplete="list">' +
            '<div class="kr-palette-list" role="listbox"></div>' +
            '<div class="kr-palette-live sr-only" aria-live="polite"></div>' +
            '<div class="kr-palette-foot"><span>&uarr;&darr; navigate</span><span>&crarr; open</span><span>esc close</span></div>' +
            '</div>';
        document.body.appendChild(overlay);
        input = overlay.querySelector('.kr-palette-input');
        list = overlay.querySelector('.kr-palette-list');

        overlay.addEventListener('mousedown', (e) => {
            if (e.target === overlay) close();
        });
        input.addEventListener('input', () => render(input.value));
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
                if (items[active]) window.location.href = items[active].href;
            } else if (e.key === 'Escape') close();
        });
        list.addEventListener('mousemove', (e) => {
            const el = e.target.closest('.kr-palette-item');
            if (el) setActive(Number(el.dataset.i));
        });
    }

    function loadIndex() {
        if (indexRequested) return;
        indexRequested = true;
        const grab = (url, apply) => fetch(prefix + url)
            .then((r) => r.json())
            .then((data) => { apply(data); render(input.value); })
            .catch(() => { /* source stays empty; pages still work */ });
        grab('data/posts.json', (data) => { posts = data; });
        grab('data/photo-locations.json', (data) => {
            places = (data.regions || []).map((r) => ({ name: r.name, count: (r.photos || []).length }));
        });
    }

    function open() {
        if (!overlay) build();
        loadIndex();
        overlay.classList.add('is-open');
        document.body.classList.add('kr-palette-open');
        input.value = '';
        render('');
        // Focus synchronously: mobile browsers only raise the soft keyboard
        // when focus happens inside the user gesture.
        input.focus();
        setTimeout(() => input.focus(), 30);
    }

    function close() {
        overlay.classList.remove('is-open');
        document.body.classList.remove('kr-palette-open');
    }

    const isOpen = () => Boolean(overlay) && overlay.classList.contains('is-open');

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            if (isOpen()) close(); else open();
        } else if (e.key === '/' && !isOpen()) {
            const t = e.target;
            const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
            if (!typing) { e.preventDefault(); open(); }
        } else if (e.key === 'Escape' && isOpen()) {
            close();
        }
    });

    // Nav hint: the header is injected by shared-components.js, so wait
    // for #nav to exist before appending the Search pill.
    document.addEventListener('DOMContentLoaded', () => {
        const tryInsert = () => {
            const nav = document.getElementById('nav');
            if (!nav || document.querySelector('.kr-palette-hint')) return Boolean(nav);
            const li = document.createElement('li');
            li.innerHTML = '<a href="#" class="kr-palette-hint" role="button" aria-label="Search the site (Ctrl+K)">' +
                '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>' +
                '<span class="kr-palette-word">Search</span>' +
                '<span class="kr-palette-kbd">Ctrl K</span></a>';
            li.querySelector('a').addEventListener('click', (e) => {
                e.preventDefault();
                open();
            });
            nav.appendChild(li);
            return true;
        };
        if (!tryInsert()) {
            const mo = new MutationObserver(() => {
                if (tryInsert()) mo.disconnect();
            });
            mo.observe(document.body, { childList: true, subtree: true });
        }
    });
})();
