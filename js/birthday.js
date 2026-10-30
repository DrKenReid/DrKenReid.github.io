/**
 * birthday.js: 12 October, Ken's birthday. Every photograph of Ken on the
 * site gets a party hat, and a note by the pointer says so while it is
 * over him. Fetched by shared-components.js on that day alone (krBirthday)
 * or with ?birthday=on; the seasons' off switch turns it off too.
 *
 * KR_BIRTHDAY_PHOTOS says which pictures and where: by file name, the
 * picture's size in pixels, the hat's base (centre x, centre y, width,
 * tilt in degrees, all in the picture's pixels) and the box the note
 * answers to (x0, y0, x1, y1). The hat is an svg over the picture with
 * the picture's own size as its viewBox, so it follows the picture
 * through any width, crop (object-fit or background-size cover, read off
 * the page) and the homepage hero's slow zoom. A new photograph of Ken
 * needs a row here and nothing else.
 *
 * Its rules are css/birthday.css, which this file fetches before it draws.
 *
 * Classes only script applies: .kr-bday-hat (the svg; --party while the
 * note shows, which wiggles __wiggle, the hat; __spot, the face box) and
 * .kr-bday-note (the note, .kr-offstage).
 */
(function () {
    'use strict';

    var KR_BIRTHDAY_PHOTOS = {
        // The homepage hero: no headroom under the header bar, so the hat
        // perches on the side of his head (and stays off where a narrow
        // screen crops it).
        'ken-hero.webp': { size: [2400, 1080], hat: [1357, 280, 115, -35], face: [1300, 0, 1880, 880] },
        'ken-neeharika-window.webp': { size: [800, 755], hat: [428, 114, 88, -12], face: [300, 80, 560, 390] },
        // The author photo at the end of every post: he is in a beanie,
        // so the hat sits on that, poking out of the circle.
        'ken-avatar.webp': { size: [160, 160], hat: [100, 18, 76, 22], face: [0, 0, 160, 160] },
        'kilts.webp': { size: [700, 1052], hat: [353, 278, 70, -8], face: [250, 255, 475, 700] }
    };
    var NOTE = "It's my birthday!";
    var SVG_NS = 'http://www.w3.org/2000/svg';

    var seen = typeof WeakSet === 'function' ? new WeakSet() : null;
    var hats = [];
    var uid = 0;

    /* The hat on a 100-wide base, its centre at 0,0 and its tip 122 up: a
       cone with dots, a darker right half, a trim along the curved brim
       and a pompom. */
    function hatMarkup(photo) {
        var h = photo.hat, id = 'kr-bday-' + (++uid);
        var cone = 'M-50 0L0-122L50 0Q0 16-50 0Z';
        var dots = [[-22, -14, 7, '#ffd84d'], [8, -30, 6, '#5ad1f0'], [-6, -58, 6, '#ffd84d'],
            [20, -6, 6, '#fff'], [-30, -2, 4, '#5ad1f0'], [4, -84, 4.5, '#fff'], [26, -24, 4, '#ffd84d'],
            [-12, -36, 4, '#fff']];
        var puff = [[0, -130, 9, '#ffd84d'], [-7, -125, 6.5, '#ff9f1c'], [7, -126, 6.5, '#ff9f1c'],
            [0, -137, 6, '#fff3b0'], [-4, -131, 4, '#fff3b0']];
        return '<defs><clipPath id="' + id + '"><path d="' + cone + '"/></clipPath>' +
            '<filter id="' + id + 's" x="-50%" y="-50%" width="200%" height="200%">' +
            '<feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity="0.35"/></filter></defs>' +
            '<g transform="translate(' + h[0] + ' ' + h[1] + ') rotate(' + h[3] + ') scale(' + (h[2] / 100) + ')">' +
            '<g class="kr-bday-hat__wiggle" filter="url(#' + id + 's)">' +
            '<path d="' + cone + '" fill="#e63e62"/>' +
            '<g clip-path="url(#' + id + ')">' +
            dots.map(function (d) { return '<circle cx="' + d[0] + '" cy="' + d[1] + '" r="' + d[2] + '" fill="' + d[3] + '"/>'; }).join('') +
            '<path d="M0-122L50 0Q30 10 6 12Z" fill="#000" opacity="0.18"/>' +
            '<path d="M-3-114L-44 0" stroke="#fff" stroke-width="5" opacity="0.25"/></g>' +
            '<path d="M-50 0Q0 16 50 0" fill="none" stroke="#ffd84d" stroke-width="8" stroke-linecap="round"/>' +
            puff.map(function (d) { return '<circle cx="' + d[0] + '" cy="' + d[1] + '" r="' + d[2] + '" fill="' + d[3] + '"/>'; }).join('') +
            '</g></g>';
    }

    /* Where the picture is drawn inside its box, for object-fit or
       background-size cover or contain (positioned by object-position or
       background-position), else stretched to the box. */
    function frame(box, photo, fit, pos) {
        var w = photo.size[0], h = photo.size[1];
        var s = fit === 'cover' ? Math.max(box.w / w, box.h / h)
            : fit === 'contain' ? Math.min(box.w / w, box.h / h) : 0;
        if (!s) return { x: 0, y: 0, w: box.w, h: box.h };
        var rw = w * s, rh = h * s;
        var keys = { left: '0%', top: '0%', center: '50%', right: '100%', bottom: '100%' };
        var at = (pos || '50% 50%').split(/\s+/).map(function (v) { return keys[v] || v; });
        function place(v, room) {
            v = v || '50%';
            return /%$/.test(v) ? room * parseFloat(v) / 100 : parseFloat(v) || 0;
        }
        return { x: place(at[0], box.w - rw), y: place(at[1], box.h - rh), w: rw, h: rh };
    }

    /* Puts the svg over the picture where it is drawn now. An <img> has
       the svg beside it, placed in the box they share; a background has it
       inside, so the hero's zoom carries it. */
    function fit(entry) {
        var el = entry.el, cs = getComputedStyle(el), box, f;
        if (entry.bg) {
            box = { w: el.clientWidth, h: el.clientHeight };
            f = frame(box, entry.photo, cs.backgroundSize, cs.backgroundPosition);
        } else {
            box = { w: el.offsetWidth, h: el.offsetHeight };
            f = frame(box, entry.photo, cs.objectFit, cs.objectPosition);
            f.x += el.offsetLeft;
            f.y += el.offsetTop;
        }
        var s = entry.svg.style;
        // A crop that cuts into the hat (the hero on a phone) leaves the
        // hat off rather than a sliver of it.
        if (entry.bg) {
            var h = entry.photo.hat, t = h[3] * Math.PI / 180, k = f.w / entry.photo.size[0];
            var xs = [[-50, 0], [50, 0], [0, -140]].map(function (q) {
                return f.x + (h[0] + h[2] / 100 * (q[0] * Math.cos(t) - q[1] * Math.sin(t))) * k;
            });
            s.visibility = Math.min.apply(null, xs) < 0 || Math.max.apply(null, xs) > box.w ? 'hidden' : '';
        }
        s.left = f.x + 'px';
        s.top = f.y + 'px';
        s.width = f.w + 'px';
        s.height = f.h + 'px';
    }

    function photoOf(el) {
        var src = el.tagName === 'IMG' ? el.getAttribute('src') : el.style.backgroundImage;
        var m = /([\w-]+\.webp)/.exec(src || '');
        return m && KR_BIRTHDAY_PHOTOS[m[1]];
    }

    function dress(el) {
        if (seen && seen.has(el)) return;
        var photo = photoOf(el);
        if (!photo) return;
        if (seen) seen.add(el);
        var bg = el.tagName !== 'IMG';
        // A copy of a dressed picture (the carousel clones its slides)
        // brings the svg along; it is replaced, so the copy is tracked too.
        var old = bg ? el.querySelector(':scope > .kr-bday-hat') : el.nextElementSibling;
        if (old && old.classList.contains('kr-bday-hat')) old.remove();
        var svg = document.createElementNS(SVG_NS, 'svg');
        svg.setAttribute('class', 'kr-bday-hat');
        svg.setAttribute('viewBox', '0 0 ' + photo.size[0] + ' ' + photo.size[1]);
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        var f = photo.face;
        svg.innerHTML = hatMarkup(photo) + '<rect class="kr-bday-hat__spot" x="' + f[0] + '" y="' + f[1] +
            '" width="' + (f[2] - f[0]) + '" height="' + (f[3] - f[1]) + '" fill="none"/>';
        if (bg) el.appendChild(svg);
        else el.insertAdjacentElement('afterend', svg);
        var alt = el.getAttribute('alt');
        if (alt) el.setAttribute('alt', alt + '. Ken is in a party hat for his birthday');
        var entry = { el: el, bg: bg, photo: photo, svg: svg,
            hat: svg.querySelector('.kr-bday-hat__wiggle'), spot: svg.lastChild };
        hats.push(entry);
        fit(entry);
        if (typeof ResizeObserver === 'function') new ResizeObserver(function () { fit(entry); }).observe(el);
    }

    function scan(root) {
        if (!root.querySelectorAll) return;
        if (root.matches && root.matches('img, [style*="background-image"]')) dress(root);
        root.querySelectorAll('img, [style*="background-image"]').forEach(dress);
    }

    /* The note: by the pointer while it is over Ken (his face box or the
       hat), above and to the right of it, kept on screen. A tap shows it
       for a few seconds. */
    var note = document.createElement('div');
    note.className = 'kr-bday-note kr-offstage';
    note.setAttribute('aria-hidden', 'true');
    note.textContent = NOTE;
    var on = null, last = null, frameReq = 0, tapTimer = 0;

    function over(x, y) {
        for (var i = 0; i < hats.length; i++) {
            var e = hats[i];
            if (!e.svg.isConnected) continue;
            var r = [e.spot.getBoundingClientRect(), e.hat.getBoundingClientRect()];
            for (var j = 0; j < r.length; j++) {
                if (r[j].width && x >= r[j].left && x <= r[j].right && y >= r[j].top && y <= r[j].bottom) return e;
            }
        }
        return null;
    }

    function show(entry, x, y) {
        if (on && on !== entry) on.svg.classList.remove('kr-bday-hat--party');
        on = entry;
        if (!entry) { note.classList.remove('is-visible'); return; }
        entry.svg.classList.add('kr-bday-hat--party');
        var w = note.offsetWidth, h = note.offsetHeight;
        var left = x + 14, top = y - h - 12;
        if (left + w > innerWidth - 8) left = x - w - 14;
        if (top < 8) top = y + 22;
        note.style.left = Math.max(8, left) + 'px';
        note.style.top = top + 'px';
        note.classList.add('is-visible');
    }

    function track() {
        frameReq = 0;
        if (last) show(over(last[0], last[1]), last[0], last[1]);
    }

    function start() {
        document.body.appendChild(note);
        scan(document.body);
        new MutationObserver(function (list) {
            list.forEach(function (m) { m.addedNodes.forEach(scan); });
        }).observe(document.body, { childList: true, subtree: true });
        // Layout above a picture can move it without resizing it.
        if (typeof ResizeObserver === 'function') {
            new ResizeObserver(function () { hats.forEach(fit); }).observe(document.body);
        }
        document.addEventListener('pointermove', function (e) {
            if (e.pointerType !== 'mouse') return;
            last = [e.clientX, e.clientY];
            if (!frameReq) frameReq = requestAnimationFrame(track);
        }, { passive: true });
        document.addEventListener('pointerdown', function (e) {
            if (e.pointerType === 'mouse') return;
            var hit = over(e.clientX, e.clientY);
            show(hit, e.clientX, e.clientY);
            clearTimeout(tapTimer);
            if (hit) tapTimer = setTimeout(function () { show(null); }, 2500);
        }, { passive: true });
        document.addEventListener('mouseleave', function () { last = null; show(null); });
        window.addEventListener('scroll', function () {
            if (!frameReq && last) frameReq = requestAnimationFrame(track);
        }, { passive: true });
    }

    /* The hats' rules are css/birthday.css, fetched with this file on the
       day alone so the stylesheet every page loads does not carry them;
       nothing is drawn until it has loaded (an unstyled hat would be a
       page-wide drawing), and nothing at all if it fails. */
    function begin() {
        var link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = siteRootPrefix() + 'css/birthday.css';
        link.addEventListener('load', start);
        document.head.appendChild(link);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin);
    else begin();
})();
