/**
 * palette.js — site-wide command palette (Ctrl/Cmd+K, or '/').
 *
 * Fuzzy search across pages, blog posts (data/posts.json), and photo
 * tags (deep-links to gallery.html?tag=...). Vanilla JS, builds its DOM
 * on first open, loaded with defer on every page.
 */
(function () {
    var onBlogPostPage = /\/blog\//.test(window.location.pathname);
    var prefix = onBlogPostPage ? '../' : './';

    var PAGES = [
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

    var PHOTO_TAGS = ['wildlife', 'portrait', 'bw', 'architecture', 'abandoned',
        'urban', 'nature', 'silhouette', 'landscape', 'winter'];

    var overlay = null;
    var input = null;
    var list = null;
    var items = [];
    var active = 0;
    var posts = null;
    var postsLoading = false;

    function score(query, text) {
        if (!text) return 0;
        var q = query.toLowerCase();
        var t = text.toLowerCase();
        if (t === q) return 120;
        if (t.indexOf(q) === 0) return 100;
        var idx = t.indexOf(q);
        if (idx !== -1) {
            return t.charAt(idx - 1) === ' ' ? 80 : 60;
        }
        // subsequence match
        var ti = 0;
        for (var qi = 0; qi < q.length; qi++) {
            ti = t.indexOf(q.charAt(qi), ti);
            if (ti === -1) return 0;
            ti++;
        }
        return 25;
    }

    function collectResults(query) {
        var results = [];
        var q = query.trim();

        PAGES.forEach(function (p) {
            var s = q ? Math.max(score(q, p.title), score(q, p.sub) * 0.5) : 10;
            if (s > 0) results.push({ score: s, kind: 'Page', title: p.title, sub: p.sub, href: prefix + p.url });
        });

        (posts || []).forEach(function (p) {
            if (!q) return;
            var s = Math.max(
                score(q, p.title),
                score(q, (p.tags || []).join(' ')) * 0.8,
                score(q, p.excerpt || '') * 0.4
            );
            if (s > 0) {
                results.push({
                    score: s, kind: 'Post', title: p.title,
                    sub: (p.tags || []).join(' · '),
                    href: prefix + (p.url || '')
                });
            }
        });

        PHOTO_TAGS.forEach(function (t) {
            if (!q) return;
            var s = score(q, t) * 0.9;
            if (s > 0) {
                results.push({
                    score: s, kind: 'Photos', title: t.charAt(0).toUpperCase() + t.slice(1) + ' photos',
                    sub: 'Gallery filter', href: prefix + 'gallery.html?tag=' + t
                });
            }
        });

        results.sort(function (a, b) { return b.score - a.score; });
        return results.slice(0, 10);
    }

    function render(query) {
        items = collectResults(query);
        active = 0;
        if (!items.length) {
            list.innerHTML = '<div class="kr-palette-empty">No matches. Try a post title, page, or photo tag.</div>';
            return;
        }
        list.innerHTML = items.map(function (r, i) {
            return '<a href="' + r.href + '" class="kr-palette-item' + (i === 0 ? ' active' : '') + '" data-i="' + i + '">' +
                '<span class="kr-palette-kind">' + r.kind + '</span>' +
                '<span class="kr-palette-text"><span class="kr-palette-title">' + r.title + '</span>' +
                (r.sub ? '<span class="kr-palette-sub">' + r.sub + '</span>' : '') + '</span>' +
                '</a>';
        }).join('');
    }

    function setActive(i) {
        var els = list.querySelectorAll('.kr-palette-item');
        if (!els.length) return;
        active = (i + els.length) % els.length;
        Array.prototype.forEach.call(els, function (el, j) {
            el.classList.toggle('active', j === active);
        });
        els[active].scrollIntoView({ block: 'nearest' });
    }

    function build() {
        overlay = document.createElement('div');
        overlay.className = 'kr-palette-overlay';
        overlay.innerHTML =
            '<div class="kr-palette" role="dialog" aria-label="Site search">' +
            '<input type="text" class="kr-palette-input" placeholder="Search posts, pages, photos…" aria-label="Search site">' +
            '<div class="kr-palette-list"></div>' +
            '<div class="kr-palette-foot"><span>&uarr;&darr; navigate</span><span>&crarr; open</span><span>esc close</span></div>' +
            '</div>';
        document.body.appendChild(overlay);
        input = overlay.querySelector('.kr-palette-input');
        list = overlay.querySelector('.kr-palette-list');

        overlay.addEventListener('mousedown', function (e) {
            if (e.target === overlay) close();
        });
        input.addEventListener('input', function () { render(input.value); });
        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
            else if (e.key === 'Enter') {
                e.preventDefault();
                var el = list.querySelectorAll('.kr-palette-item')[active];
                if (el) window.location.href = el.getAttribute('href');
            } else if (e.key === 'Escape') { close(); }
        });
        list.addEventListener('mousemove', function (e) {
            var el = e.target.closest ? e.target.closest('.kr-palette-item') : null;
            if (el) setActive(parseInt(el.getAttribute('data-i'), 10));
        });
    }

    function open() {
        if (!overlay) build();
        if (!posts && !postsLoading) {
            postsLoading = true;
            fetch(prefix + 'data/posts.json')
                .then(function (r) { return r.json(); })
                .then(function (data) { posts = data; render(input.value); })
                .catch(function () { posts = []; });
        }
        overlay.classList.add('is-open');
        document.body.classList.add('kr-palette-open');
        input.value = '';
        render('');
        // Focus synchronously: mobile browsers only raise the soft
        // keyboard when focus happens inside the user gesture.
        input.focus();
        setTimeout(function () { input.focus(); }, 30);
    }

    function close() {
        if (!overlay) return;
        overlay.classList.remove('is-open');
        document.body.classList.remove('kr-palette-open');
    }

    function isOpen() {
        return overlay && overlay.classList.contains('is-open');
    }

    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            isOpen() ? close() : open();
            return;
        }
        if (e.key === '/' && !isOpen()) {
            var t = e.target;
            var typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
            if (!typing) { e.preventDefault(); open(); }
        }
        if (e.key === 'Escape' && isOpen()) close();
    });

    // Nav hint (injected once the header exists)
    document.addEventListener('DOMContentLoaded', function () {
        var tryInsert = function () {
            var nav = document.getElementById('nav');
            if (!nav || document.querySelector('.kr-palette-hint')) return !!nav;
            var li = document.createElement('li');
            li.innerHTML = '<a href="#" class="kr-palette-hint" role="button" aria-label="Search the site (Ctrl+K)">' +
                '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>' +
                '<span class="kr-palette-word">Search</span>' +
                '<span class="kr-palette-kbd">Ctrl K</span></a>';
            li.querySelector('a').addEventListener('click', function (e) {
                e.preventDefault();
                open();
            });
            nav.appendChild(li);
            return true;
        };
        if (!tryInsert() && 'MutationObserver' in window) {
            var mo = new MutationObserver(function () {
                if (tryInsert()) mo.disconnect();
            });
            mo.observe(document.body, { childList: true, subtree: true });
        }
    });
}());
