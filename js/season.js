/**
 * season.js: the decorations for a season (KR_SEASONS in
 * shared-components.js), fetched by that file only while one is on, so
 * the rest of the year this costs nothing. The colours are style.css's
 * (§01 "Seasons", keyed on html[data-season]); this adds the things.
 *
 * Halloween
 *   - a cobweb with a spider on its thread, in the header bar's corner or
 *     the opener's
 *   - autumn leaves falling across the page openers and the homepage hero
 *   - a pumpkin patch sitting on the footer, faces flickering
 *   - a bat that crosses the screen once, when the footer comes into view
 *   - a pumpkin favicon, a full moon on the theme button that a bat
 *     crosses while it is hovered
 *   - a candle for a post's reading bar, burning down as the reader goes
 *   - fog along the foot of the homepage hero and the gallery's opener,
 *     in the dark theme
 *   - the photo map haunted: pumpkin rims on the markers, a ghost on the
 *     places mostly photographed abandoned, the tiles dimmed
 *   - the 404 page's words, haunted
 *   - krSeasonTreats: the frames the palette's "Trick or treat" picks from
 *
 * Toys: a click sends the spider down its thread and back, and puffs smoke
 * from a pumpkin, which with sounds on also hoots, creaks or howls (one
 * recording each, public domain, credited on the colophon). Sounds are off
 * until the reader turns them on: ?spooky-sounds=on (the palette's "Turn
 * on Halloween sounds") stores it on this device, ?spooky-sounds=off
 * clears it; either is taken out of the address. A recording is fetched
 * only when it first plays.
 *
 * Every piece is aria-hidden decoration that sits over no post text,
 * gallery tile, lightbox or slideshow, and is left out of print (§23).
 * Only the spider and the pumpkins take clicks, and nothing takes focus.
 * Under reduced motion nothing moves: the leaves lie where they fell, the
 * faces and the flame hold steady, the fog stands still, the bat stays
 * home, a clicked pumpkin only makes its sound and the spider stays put.
 * The leaves draw only while their banner is on screen and the tab is
 * visible.
 *
 * Classes only this file applies (style.css §21, "Seasonal decorations"):
 * .kr-season-web, .kr-season-spider (--drop), .kr-season-leaves,
 * .kr-season-patch, .kr-season-glow, .kr-season-lit, .kr-season-smoke,
 * .kr-season-bat, .kr-season-moonbat, .kr-season-candle (__wax, __flame,
 * --out), .kr-season-candled, .kr-season-fog (__layer, __layer--far),
 * .kr-season-map, .kr-season-ghost.
 */
(function () {
    'use strict';

    var season = typeof krSeason === 'function' ? krSeason() : null;
    if (!season) return;

    var reduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Autumn: rust, pumpkin, amber, ochre, oxblood, gold.
    var LEAF_COLOURS = ['#c4512a', '#e07a2e', '#e8a33d', '#b7782a', '#8c3b1f', '#d9b44a'];

    // A maple leaf on a 24 x 24 box, point up, its stem to (12, 23).
    var MAPLE = 'M12 1.5l1.7 4.4 3.3-1.7-.9 4.3 4.3-.6-2.5 3.3 3.6 1.7-4.5 1.1 1 3-3.7-1.4-1.6 1.9' +
        '-.2-2.2-.5 0-.2 2.2-1.6-1.9-3.7 1.4 1-3-4.5-1.1 3.6-1.7-2.5-3.3 4.3.6-.9-4.3 3.3 1.7z';
    // An oak-ish oval leaf on the same box.
    var OVAL = 'M12 2c4.5 3 6 7.5 5 12-.6 2.8-2.6 5.3-5 6.5-2.4-1.2-4.4-3.7-5-6.5C6 9.5 7.5 5 12 2z';

    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    function svg(className, viewBox, body) {
        return '<svg class="' + className + '" viewBox="' + viewBox + '" aria-hidden="true" focusable="false">' +
            body + '</svg>';
    }

    /* A jack-o'-lantern on a 64 x 56 box; the cut-outs carry
       .kr-season-glow, which flickers. */
    function pumpkin(face) {
        var faces = [
            // triangle eyes, a toothy grin
            '<path class="kr-season-glow" d="M17 28l5-8 5 8zM37 28l5-8 5 8zM30 33l2-4 2 4z' +
            'M16 37c5 10 27 10 32 0l-4 1-2 4-3-3-3 3-3-3-3 3-3-3-3 3-2-4z"/>',
            // round eyes, an O of a mouth
            '<path class="kr-season-glow" d="M19 26a4 4 0 1 0 8 0a4 4 0 1 0-8 0zM37 26a4 4 0 1 0 8 0a4 4 0 1 0-8 0z' +
            'M27 41a5 6 0 1 0 10 0a5 6 0 1 0-10 0z"/>',
            // slanted eyes, a crooked smile
            '<path class="kr-season-glow" d="M17 22l10 4-8 4zM47 22l-10 4 8 4z' +
            'M18 39c6 6 22 6 28-2l-5 1-2 3-3-2-4 3-3-3-4 2-2-3z"/>'
        ];
        return svg('kr-season-pumpkin', '0 0 64 56',
            '<path d="M31 11c-.5-4 1-8 5-10l2.5 2.5c-3 1.5-4 4-4 7.5z" fill="#5b6b2c"/>' +
            '<ellipse cx="20" cy="33" rx="15" ry="19" fill="#c9581a"/>' +
            '<ellipse cx="44" cy="33" rx="15" ry="19" fill="#c9581a"/>' +
            '<ellipse cx="32" cy="32" rx="15" ry="21" fill="#e5761f"/>' +
            '<path d="M26 13c-4 6-4 33 0 39M38 13c4 6 4 33 0 39" fill="none" stroke="#b44f15" stroke-width="1.4"/>' +
            faces[face % faces.length]);
    }

    function leaf(path, colour, size, turn) {
        return '<svg class="kr-season-leaf" viewBox="0 0 24 24" width="' + size + '" height="' + size + '"' +
            ' style="transform: rotate(' + turn + 'deg)" aria-hidden="true" focusable="false">' +
            '<path d="' + path + '" fill="' + colour + '"/>' +
            '<path d="M12 14v9" stroke="' + colour + '" stroke-width="1.2"/></svg>';
    }

    /* ------------------------------------------------------------------ *
     * The cobweb and its spider, in the header bar's corner
     * ------------------------------------------------------------------ */

    /* Two webs: one in the header bar's corner, shown where the screen is
       wide enough to leave the bar's controls clear of it, and one in the
       top corner of the page's opener, under the bar, shown where it is
       not (style.css picks). */
    function cobweb() {
        var header = document.querySelector('.header-area');
        if (header && !header.querySelector('.kr-season-web')) {
            header.appendChild(web('kr-season-web kr-season-web--bar'));
        }
        var opener = document.querySelector('.breadcrumb-area, .kr-opener, .welcome-area');
        if (opener && !opener.querySelector('.kr-season-web')) {
            opener.appendChild(web('kr-season-web kr-season-web--opener'));
        }
    }

    function web(className) {
        // Radials from the corner (64, 0), then sagging rings between them.
        var spokes = [180, 157, 135, 112, 90];
        var lines = spokes.map(function (deg) {
            var r = deg * Math.PI / 180;
            return 'M64 0L' + (64 + Math.cos(r) * 64).toFixed(1) + ' ' + (Math.sin(r) * 64).toFixed(1);
        });
        [16, 30, 44, 58].forEach(function (radius) {
            var d = '';
            spokes.forEach(function (deg, i) {
                var r = deg * Math.PI / 180;
                var x = 64 + Math.cos(r) * radius, y = Math.sin(r) * radius;
                if (!i) { d += 'M' + x.toFixed(1) + ' ' + y.toFixed(1); return; }
                var m = (deg + spokes[i - 1]) / 2 * Math.PI / 180;
                var sag = radius * 0.82;
                d += 'Q' + (64 + Math.cos(m) * sag).toFixed(1) + ' ' + (Math.sin(m) * sag).toFixed(1) +
                    ' ' + x.toFixed(1) + ' ' + y.toFixed(1);
            });
            lines.push(d);
        });
        var el = document.createElement('div');
        el.className = className;
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = svg('kr-season-web__strands', '0 0 64 64',
            '<path d="' + lines.join('') + '" fill="none"/>') +
            '<span class="kr-season-spider">' + svg('kr-season-spider__body', '0 0 20 20',
                '<path d="M6 9L1 6M6 11L0 11M6 13L1 16M14 9l5-3M14 11h6M14 13l5 3" class="kr-season-spider__legs"/>' +
                '<ellipse cx="10" cy="11" rx="4.2" ry="5"/><circle cx="10" cy="6.6" r="2.4"/>') +
            '</span>';
        return el;
    }

    /* ------------------------------------------------------------------ *
     * Falling leaves over the openers
     * ------------------------------------------------------------------ */

    var LEAVES_PER_1000PX = 14;
    var paths = null;

    function leafPaths() {
        if (!paths && window.Path2D) paths = [new Path2D(MAPLE), new Path2D(OVAL)];
        return paths;
    }

    function makeLeaf(w, h, anywhere) {
        return {
            x: Math.random() * w,
            y: anywhere ? Math.random() * h : -30 - Math.random() * h * 0.5,
            size: 16 + Math.random() * 16,
            fall: 18 + Math.random() * 26,            // px a second
            drift: -6 + Math.random() * 18,           // a breeze, mostly rightward
            swayAmp: 14 + Math.random() * 22,
            swaySpeed: 0.6 + Math.random() * 1.1,
            phase: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 1.6,
            turn: Math.random() * Math.PI * 2,
            flutter: 1.5 + Math.random() * 2.5,
            colour: LEAF_COLOURS[(Math.random() * LEAF_COLOURS.length) | 0],
            shape: Math.random() < 0.7 ? 0 : 1
        };
    }

    function drawLeaf(ctx, l, t) {
        var shapes = leafPaths();
        if (!shapes) return;
        var x = l.x + Math.sin(t * l.swaySpeed + l.phase) * l.swayAmp;
        ctx.save();
        ctx.translate(x, l.y);
        ctx.rotate(l.turn + t * l.spin);
        // Turning over in the air: squash one axis with a cosine.
        ctx.scale(Math.max(0.15, Math.abs(Math.cos(t * l.flutter + l.phase))), 1);
        ctx.scale(l.size / 24, l.size / 24);
        ctx.translate(-12, -12);
        ctx.fillStyle = l.colour;
        ctx.globalAlpha = 0.92;
        ctx.fill(shapes[l.shape]);
        ctx.restore();
    }

    function fallingLeaves(host, before) {
        if (!host || host.querySelector('.kr-season-leaves') || !leafPaths()) return;
        var canvas = document.createElement('canvas');
        canvas.className = 'kr-season-leaves';
        canvas.setAttribute('aria-hidden', 'true');
        host.insertBefore(canvas, before || host.firstChild);
        var ctx = canvas.getContext('2d');
        var w = 0, h = 0, leaves = [], visible = false, frame = 0, last = 0, clock = 0;

        function size() {
            var rect = host.getBoundingClientRect();
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            w = rect.width; h = rect.height;
            canvas.width = Math.round(w * dpr);
            canvas.height = Math.round(h * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            var want = Math.max(6, Math.round(w / 1000 * LEAVES_PER_1000PX));
            while (leaves.length < want) leaves.push(makeLeaf(w, h, true));
            leaves.length = want;
            if (reduced) still();
        }

        // Reduced motion: the leaves have landed, along the foot of the banner.
        function still() {
            ctx.clearRect(0, 0, w, h);
            leaves.forEach(function (l, i) {
                var rest = { x: (i + 0.5) / leaves.length * w + (l.x % 40) - 20, y: h - 6 - (l.size * 0.4),
                    swayAmp: 0, swaySpeed: 0, phase: 0, spin: 0, turn: l.turn, flutter: 0,
                    size: l.size, colour: l.colour, shape: l.shape };
                drawLeaf(ctx, rest, 0);
            });
        }

        function tick(now) {
            frame = 0;
            if (!visible || document.hidden) return;
            var dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
            last = now;
            clock += dt;
            ctx.clearRect(0, 0, w, h);
            leaves.forEach(function (l, i) {
                l.y += l.fall * dt;
                l.x += l.drift * dt;
                if (l.y > h + 30 || l.x > w + 60 || l.x < -60) leaves[i] = l = makeLeaf(w, h, false);
                drawLeaf(ctx, l, clock);
            });
            frame = requestAnimationFrame(tick);
        }

        function start() {
            if (reduced || frame || !visible || document.hidden) return;
            last = 0;
            frame = requestAnimationFrame(tick);
        }

        size();
        if (window.ResizeObserver) new ResizeObserver(size).observe(host);
        if (reduced) return;
        if (window.IntersectionObserver) {
            new IntersectionObserver(function (entries) {
                visible = entries[entries.length - 1].isIntersecting;
                start();
            }).observe(host);
        } else {
            visible = true;
            start();
        }
        document.addEventListener('visibilitychange', start);
    }

    function leavesEverywhere() {
        Array.prototype.forEach.call(document.querySelectorAll('.breadcrumb-area'), function (el) {
            fallingLeaves(el);
        });
        Array.prototype.forEach.call(document.querySelectorAll('.kr-opener'), function (el) {
            fallingLeaves(el, el.querySelector('.kr-opener__inner'));
        });
        var hero = document.querySelector('.welcome-area');
        if (hero) fallingLeaves(hero, null);
    }

    /* ------------------------------------------------------------------ *
     * The pumpkin patch on the footer, and the bat
     * ------------------------------------------------------------------ */

    function pumpkinPatch() {
        var footer = document.querySelector('.kr-footer');
        if (!footer || footer.querySelector('.kr-season-patch')) return;
        var patch = document.createElement('div');
        patch.className = 'kr-season-patch';
        patch.setAttribute('aria-hidden', 'true');
        patch.innerHTML =
            leaf(MAPLE, LEAF_COLOURS[0], 18, -30) +
            '<span class="kr-season-patch__big">' + pumpkin(0) + '</span>' +
            leaf(OVAL, LEAF_COLOURS[2], 16, 70) +
            '<span class="kr-season-patch__small">' + pumpkin(1) + '</span>' +
            leaf(MAPLE, LEAF_COLOURS[4], 14, 20) +
            '<span class="kr-season-patch__mid">' + pumpkin(2) + '</span>' +
            leaf(MAPLE, LEAF_COLOURS[3], 17, -60) +
            leaf(OVAL, LEAF_COLOURS[1], 13, 110);
        footer.insertBefore(patch, footer.firstChild);
        Array.prototype.forEach.call(patch.querySelectorAll('.kr-season-patch > span'), function (el, i) {
            el.addEventListener('click', function () { poke(el, PUMPKIN_SOUNDS[i % PUMPKIN_SOUNDS.length]); });
        });

        if (reduced || !window.IntersectionObserver) return;
        var flown = false;
        var watch = new IntersectionObserver(function (entries) {
            if (flown || !entries[0].isIntersecting) return;
            flown = true;
            watch.disconnect();
            bat();
        }, { threshold: 0.1 });
        watch.observe(footer);
    }

    function bat() {
        var el = document.createElement('div');
        el.className = 'kr-season-bat';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = svg('kr-season-bat__body', '0 0 64 32',
            '<path class="kr-season-bat__wing kr-season-bat__wing--l" d="M30 13C25 7 16 4 4 6c4 2 6 5 6 9-3-2-6-2-9 0 5 1 8 5 9 9 3-3 7-3 10-1 3-4 6-6 10-6z"/>' +
            '<path class="kr-season-bat__wing kr-season-bat__wing--r" d="M34 13c5-6 14-9 26-7-4 2-6 5-6 9 3-2 6-2 9 0-5 1-8 5-9 9-3-3-7-3-10-1-3-4-6-6-10-6z"/>' +
            '<path d="M32 9l-3-4 1 5c-2 1-3 4-3 7 0 4 2 7 5 7s5-3 5-7c0-3-1-6-3-7l1-5z"/>');
        document.body.appendChild(el);
        el.addEventListener('animationend', function (e) {
            if (e.target === el) el.remove();
        });
    }

    /* ------------------------------------------------------------------ *
     * Toys: the spider drops, a pumpkin puffs smoke (and makes a sound)
     * ------------------------------------------------------------------ */

    // The big pumpkin howls, the small one hoots, the middle one creaks.
    var PUMPKIN_SOUNDS = ['wolves', 'owl', 'creak'];
    var SOUND_KEY = 'kr-season-sound';
    var sounds = {};

    function soundsOn() {
        try { return localStorage.getItem(SOUND_KEY) === 'on'; } catch (e) { return false; }
    }

    /* ?spooky-sounds=on|off, from the palette: stored on this device, then
       taken out of the address so a copied link does not carry it. */
    function soundSwitch() {
        var q = new URLSearchParams(location.search);
        var flag = q.get('spooky-sounds');
        if (flag !== 'on' && flag !== 'off') return;
        try {
            if (flag === 'on') localStorage.setItem(SOUND_KEY, 'on');
            else localStorage.removeItem(SOUND_KEY);
        } catch (e) {}
        q.delete('spooky-sounds');
        var rest = q.toString();
        history.replaceState(history.state, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
    }
    window.krSeasonSounds = { on: soundsOn };

    function play(name) {
        if (!soundsOn() || !window.Audio) return;
        var a = sounds[name] || (sounds[name] = new Audio(siteRootPrefix() + 'sounds/' + name + '.mp3'));
        a.volume = 0.6;
        a.currentTime = 0;
        var p = a.play();
        if (p && p.catch) p.catch(function () {});
    }

    function poke(el, sound) {
        play(sound);
        el.classList.remove('kr-season-lit');
        void el.offsetWidth;            // restart the flare on a second click
        el.classList.add('kr-season-lit');
        if (reduced) return;
        var puff = document.createElement('span');
        puff.className = 'kr-season-smoke';
        el.appendChild(puff);
        puff.addEventListener('animationend', function () { puff.remove(); });
    }

    function spiders() {
        if (reduced) return;
        Array.prototype.forEach.call(document.querySelectorAll('.kr-season-spider'), function (s) {
            s.addEventListener('click', function () { s.classList.add('kr-season-spider--drop'); });
            s.addEventListener('animationend', function (e) {
                if (e.animationName === 'kr-season-drop') s.classList.remove('kr-season-spider--drop');
            });
        });
    }

    /* ------------------------------------------------------------------ *
     * The candle on a post's reading bar
     * ------------------------------------------------------------------ */

    /* The reading bar (renderReadingProgress) stays the measure: this
       reads its scaleX and burns a candle down to match, the wax what is
       left to read, the flame where the reader is. */
    function candle() {
        if (!document.querySelector('.blog-post, .story-post')) return;
        var bar = document.querySelector('.kr-progress-bar');
        if (!bar) {
            // The bar is built on DOMContentLoaded, maybe after this ran.
            var wait = new MutationObserver(function () {
                if (document.querySelector('.kr-progress-bar')) { wait.disconnect(); candle(); }
            });
            wait.observe(document.body, { childList: true });
            setTimeout(function () { wait.disconnect(); }, 8000);
            return;
        }
        if (document.querySelector('.kr-season-candle')) return;
        var el = document.createElement('div');
        el.className = 'kr-season-candle';
        el.setAttribute('aria-hidden', 'true');
        el.innerHTML = '<span class="kr-season-candle__wax"></span>' +
            '<span class="kr-season-candle__flame">' + svg('kr-season-candle__fire', '0 0 12 20',
                '<path d="M6 0C8 5 12 8 12 13a6 6 0 0 1-12 0C0 9 3 7 4 3c1 2 1 4 2 5 1-2 0-5 0-8z"/>' +
                '<path class="kr-season-candle__core" d="M6 9c1.4 2 3 3.5 3 5.4a3 3 0 0 1-6 0C3 12.6 4.6 11 6 9z"/>') +
            '</span>';
        document.body.appendChild(el);
        bar.classList.add('kr-season-candled');
        var wax = el.firstChild, flame = el.lastChild;

        function burn() {
            var m = /scaleX\(([\d.e-]+)\)/.exec(bar.style.transform || '');
            var done = m ? Math.min(1, Math.max(0, parseFloat(m[1]))) : 0;
            var w = el.clientWidth;
            wax.style.transform = 'scaleX(' + (1 - done) + ')';
            flame.style.transform = 'translateX(' + Math.max(6, Math.min(w - 6, done * w)).toFixed(1) + 'px)';
            el.classList.toggle('kr-season-candle--out', done >= 0.999);
        }
        burn();
        new MutationObserver(burn).observe(bar, { attributes: true, attributeFilter: ['style'] });
        window.addEventListener('resize', burn);
    }

    /* ------------------------------------------------------------------ *
     * Fog (dark theme only; style.css hides it in the light)
     * ------------------------------------------------------------------ */

    function fog() {
        var hosts = [document.querySelector('.welcome-area')];
        if (/\/gallery(\.html)?$/.test(location.pathname)) hosts.push(document.querySelector('.breadcrumb-area'));
        hosts.forEach(function (host) {
            if (!host || host.querySelector('.kr-season-fog')) return;
            var el = document.createElement('div');
            el.className = 'kr-season-fog';
            el.setAttribute('aria-hidden', 'true');
            el.innerHTML = '<span class="kr-season-fog__layer kr-season-fog__layer--far"></span>' +
                '<span class="kr-season-fog__layer"></span>';
            host.insertBefore(el, host.querySelector(':scope > .container'));
        });
    }

    /* ------------------------------------------------------------------ *
     * The haunted photo map
     * ------------------------------------------------------------------ */

    /* map.html's markers are Leaflet icons titled with their place's name.
       A place haunted by its abandoned frames (at least HAUNT_MIN of them,
       and HAUNT_SHARE of all it has: one derelict corner of a city does
       not make the city haunted) gets a ghost. The markers arrive after
       their data does, so watch for them. */
    var HAUNT_MIN = 3, HAUNT_SHARE = 0.3;

    function hauntMap() {
        var mapEl = document.getElementById('photo-map');
        if (!mapEl || !window.fetch) return;
        mapEl.classList.add('kr-season-map');
        var root = siteRootPrefix();
        Promise.all([
            fetch(root + 'data/photo-locations.json').then(function (r) { return r.json(); }),
            fetch(root + 'data/photo-tags.json').then(function (r) { return r.json(); })
        ]).then(function (got) {
            var tags = got[1] || {};
            var haunted = {};
            (got[0].regions || []).forEach(function (region) {
                var photos = region.photos || [];
                var eerie = photos.filter(function (stem) {
                    return (tags[stem] || []).indexOf('abandoned') !== -1;
                }).length;
                if (eerie >= HAUNT_MIN && eerie >= photos.length * HAUNT_SHARE) haunted[region.name] = true;
            });
            function mark() {
                Array.prototype.forEach.call(mapEl.querySelectorAll('.kr-map-pin'), function (pin) {
                    var marker = pin.querySelector('.kr-map-marker');
                    if (!marker || !haunted[pin.title] || marker.querySelector('.kr-season-ghost')) return;
                    var ghost = document.createElement('span');
                    ghost.className = 'kr-season-ghost';
                    ghost.setAttribute('aria-hidden', 'true');
                    ghost.innerHTML = svg('kr-season-ghost__body', '0 0 20 22',
                        '<path d="M10 1a8 8 0 0 0-8 8v12l2.7-2 2.6 2 2.7-2 2.7 2 2.6-2 2.7 2V9a8 8 0 0 0-8-8z"/>' +
                        '<circle class="kr-season-ghost__eye" cx="7.3" cy="9" r="1.5"/>' +
                        '<circle class="kr-season-ghost__eye" cx="12.7" cy="9" r="1.5"/>');
                    marker.appendChild(ghost);
                });
            }
            mark();
            new MutationObserver(mark).observe(mapEl.querySelector('.leaflet-marker-pane') || mapEl,
                { childList: true, subtree: true });
        }).catch(function () {});
    }

    /* ------------------------------------------------------------------ *
     * Small things: the tab icon, the moon, the 404 page
     * ------------------------------------------------------------------ */

    function favicon() {
        var link = document.querySelector('link[rel="icon"]');
        if (!link) return;
        var mark = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 56">' +
            '<path d="M31 11c-.5-4 1-8 5-10l2.5 2.5c-3 1.5-4 4-4 7.5z" fill="#5b6b2c"/>' +
            '<ellipse cx="20" cy="33" rx="15" ry="19" fill="#c9581a"/>' +
            '<ellipse cx="44" cy="33" rx="15" ry="19" fill="#c9581a"/>' +
            '<ellipse cx="32" cy="32" rx="15" ry="21" fill="#e5761f"/>' +
            '<path d="M17 28l5-8 5 8zM37 28l5-8 5 8zM16 37c5 10 27 10 32 0z" fill="#3a1d08"/></svg>';
        link.setAttribute('type', 'image/svg+xml');
        link.setAttribute('href', 'data:image/svg+xml,' + encodeURIComponent(mark));
    }

    function moon() {
        var icon = document.querySelector('.theme-toggle__icon--moon');
        if (!icon) return;
        icon.innerHTML = '<circle cx="12" cy="12" r="8.4"/>' +
            '<path class="kr-season-moonbat" d="M12 11.2c.6-.9 1.3-.9 1.6 0 1-1.2 2.8-1.7 4.4-1.5-.9.6-1.2 1.5-1 2.4' +
            '.9-.5 2-.5 2.9 0-1.4.3-2.3 1.2-2.6 2.3-.9-.8-2-.8-2.9-.1-.6-.6-1.3-.9-2-.9s-1.4.3-2 .9' +
            'c-.9-.7-2-.7-2.9.1-.3-1.1-1.2-2-2.6-2.3.9-.5 2-.5 2.9 0 .2-.9-.1-1.8-1-2.4 1.6-.2 3.4.3 4.4 1.5.3-.9 1-.9 1.6 0z"/>';
    }

    function haunt404() {
        if (!document.getElementById('kr-lost-canvas')) return;
        var title = document.querySelector('.page-title');
        if (title) title.textContent = 'This Page Has Passed Over';
        var lede = document.querySelector('.kr-lost__lede');
        if (lede) {
            lede.innerHTML = 'Nothing lives at this address any more, if anything ever did. ' +
                'Only the link haunts the place. <a href="/contact.html">Tell me if something should be here.</a>';
        }
        var caption = document.getElementById('lost-photo-caption');
        if (caption && caption.firstChild && caption.firstChild.nodeType === 3) {
            caption.firstChild.nodeValue = "Since you're lost anyway, here's one of my spookier photographs. ";
        }
    }

    function treats() {
        if (!season.photoTags || typeof krPhotoPool !== 'function') return;
        krPhotoPool().then(function (files) {
            window.krSeasonTreats = (files || []).map(function (f) {
                return String(f).replace(/\.[^.]+$/, '');
            });
        }).catch(function () {});
    }

    /* Whether the stylesheet this page has knows the decorations. A copy
       cached from before a season's rules existed would leave every
       picture below unstyled, page-sized; then the colours change alone. */
    function styled() {
        var probe = document.createElement('div');
        probe.className = 'kr-season-web';
        probe.hidden = true;
        document.body.appendChild(probe);
        var ok = getComputedStyle(probe).position === 'absolute';
        probe.remove();
        return ok;
    }

    ready(function () {
        if (season.key !== 'halloween') return;
        soundSwitch();
        if (!styled()) return;
        cobweb();
        spiders();
        leavesEverywhere();
        fog();
        pumpkinPatch();
        candle();
        hauntMap();
        favicon();
        moon();
        haunt404();
        treats();
    });
})();
