/**
 * The About page (about.html): today's numbers, the Now panel, and the
 * journey map beside "The road so far".
 *
 * Everything here improves a page that is already whole without it: the
 * figures and the Now panel are written into the HTML as of the last
 * weekly data refresh, and the stops of the journey are an ordered list
 * that reads on its own. This script swaps in today's figures, redraws
 * Now from the data files, and draws the map.
 *
 * The map. Leaflet is ~150 KB, so it is fetched only when the section
 * comes within a screen of the viewport. From 992px the map sits beside
 * the stops and stays in view while they scroll past, moving to each
 * stop as it reaches the middle of the screen (scrollytelling); below
 * that it sits above the list. Every stop's title is a button that moves
 * the map to it, so the same journey is there for a mouse, a keyboard
 * and a phone. The map is a picture of the list: it is hidden from
 * assistive technology, takes no keyboard focus and no gestures (a
 * dragged map on a phone would steal the page's scroll), and its tile
 * credit is printed under it rather than as Leaflet's linked control.
 * Under reduced motion it jumps between stops instead of flying.
 *
 * Globals: initAbout(), which about.html calls once shared-components.js
 * has loaded. It leans on krFetchJson, loadBlogPosts, krEscapeHtml and
 * formatPostDate (shared-components.js), and on krMapTiles (js/kr-map.js,
 * loaded with Leaflet).
 */
(function () {
    'use strict';

    var LEAFLET = '/js/vendor/leaflet/';
    var STILL = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var WIDE = '(min-width: 992px)';

    /* ---------------------------------------------------------- numbers */

    /** "174K" from 174041, "50K" from 50022: thousands, rounded down. */
    function thousands(n) {
        return n >= 1000 ? Math.floor(n / 1000) + 'K' : String(n);
    }

    function setStat(key, text) {
        var el = document.querySelector('[data-about-stat="' + key + '"]');
        if (el && text) el.textContent = text;
    }

    function fillStats() {
        krFetchJson('data/colophon.json').then(function (c) {
            if (c.posts) setStat('posts', String(c.posts));
            if (c.words) setStat('words', thousands(c.words));
            if (c.photos) setStat('photos', String(c.photos));
        }).catch(function () {});
        // Rounded down to the hundred and marked "+", as everywhere else
        // the count of books is shown: the exact figure moves every week.
        krFetchJson('data/reading.json').then(function (r) {
            if (r.books) setStat('books', Math.floor(r.books / 100) * 100 + '+');
        }).catch(function () {});
        krFetchJson('data/lastfm.json').then(function (l) {
            if (l.scrobbles) setStat('scrobbles', thousands(l.scrobbles));
        }).catch(function () {});
        krFetchJson('data/publications.json').then(function (p) {
            if (p.scholar && p.scholar.citations) setStat('citations', String(p.scholar.citations));
        }).catch(function () {});
    }

    /* -------------------------------------------------------------- now */

    function cite(title, author, href) {
        var t = '<cite>' + krEscapeHtml(title) + '</cite>';
        return (href ? '<a href="' + href + '">' + t + '</a>' : t) + (author ? ' by ' + krEscapeHtml(author) : '');
    }

    /** A Goodreads title without its series note: "Vicious (Villains, #1)". */
    function bareTitle(title) {
        return String(title || '').replace(/\s*\([^)]*#\d+[^)]*\)\s*$/, '');
    }

    function fillNow() {
        krFetchJson('data/now.json').then(function (now) {
            var books = (now.reading || []).slice(0, 2);
            var el = document.getElementById('now-reading');
            if (el && books.length) {
                el.innerHTML = books.map(function (b, i) {
                    return cite(bareTitle(b.title), b.author, i === 0 ? '/literature.html' : null);
                }).join(books.length === 2 ? ', and ' : ', ');
            }
            var when = document.getElementById('about-now-updated');
            if (when && now.updated) when.textContent = 'From the weekly refresh of ' + formatPostDate(now.updated) + '.';
        }).catch(function () {});

        krFetchJson('data/topalbums.json').then(function (top) {
            var album = (top.albums || [])[0];
            var el = document.getElementById('now-listening');
            if (el && album) {
                el.innerHTML = cite(album.name, album.artist, '/music.html') +
                    ', my most played album of the last three months';
            }
        }).catch(function () {});

        loadBlogPosts().then(function (posts) {
            var newest = (posts || []).slice().sort(function (a, b) {
                return String(b.date).localeCompare(String(a.date));
            })[0];
            var el = document.getElementById('now-writing');
            if (!el || !newest) return;
            var series = (postSeriesList(newest)[0] || {}).name;
            el.innerHTML = '<a href="/' + krEscapeHtml(newest.url) + '">' + krEscapeHtml(newest.title) + '</a>' +
                (series ? ', part of ' + krEscapeHtml(series) : '');
        }).catch(function () {});
    }

    /* ---------------------------------------------------------- journey */

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    function loadLeaflet() {
        if (window.L && window.krMapTiles) return Promise.resolve();
        var css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = LEAFLET + 'leaflet.css';
        document.head.appendChild(css);
        return loadScript(LEAFLET + 'leaflet.js').then(function () { return loadScript('/js/kr-map.js'); });
    }

    /**
     * The flight across the Atlantic as a gentle arc rather than a ruler
     * line: points along a quadratic curve through a control point north of
     * the two ends, which is roughly how a great circle looks on this map.
     */
    function arc(from, to, lift) {
        var mid = [(from[0] + to[0]) / 2 + lift, (from[1] + to[1]) / 2];
        var pts = [];
        for (var i = 0; i <= 48; i++) {
            var t = i / 48, u = 1 - t;
            pts.push([u * u * from[0] + 2 * u * t * mid[0] + t * t * to[0],
                      u * u * from[1] + 2 * u * t * mid[1] + t * t * to[1]]);
        }
        return pts;
    }

    function initJourney() {
        var section = document.querySelector('.kr-journey');
        var el = document.getElementById('journey-map');
        if (!section || !el || !('IntersectionObserver' in window)) return;
        var stops = Array.prototype.slice.call(section.querySelectorAll('.kr-journey__stop'));

        var started = false;
        var near = new IntersectionObserver(function (entries) {
            if (started || !entries.some(function (e) { return e.isIntersecting; })) return;
            started = true;
            near.disconnect();
            loadLeaflet().then(function () { draw(); }).catch(function () {
                section.classList.add('kr-journey--no-map');
            });
        }, { rootMargin: '100% 0px' });
        near.observe(section);

        function draw() {
            var map = L.map(el, {
                zoomControl: false,
                attributionControl: false,
                keyboard: false,
                dragging: false,
                touchZoom: false,
                doubleClickZoom: false,
                scrollWheelZoom: false,
                boxZoom: false,
                tap: false,
                // Whole zoom levels only: a fractional zoom scales the
                // tiles and draws hairline seams between them (map.html).
                zoomSnap: 1
            });
            krMapTiles(map);
            section.classList.add('kr-journey--map');

            var stirling = [56.1451, -3.9204], erskine = [55.9086, -4.4471],
                lansing = [42.7251, -84.4791], annArbor = [42.2808, -83.743];
            var accent = getComputedStyle(document.documentElement).getPropertyValue('--kr-action').trim() || '#c53030';
            var route = arc(stirling, lansing, 9).concat([annArbor]);
            L.polyline(route, { color: accent, weight: 2, dashArray: '6 8', opacity: 0.85, interactive: false }).addTo(map);
            [stirling, erskine, lansing, annArbor].forEach(function (p) {
                L.circleMarker(p, { radius: 6, color: '#ffffff', weight: 2, fillColor: accent, fillOpacity: 1, interactive: false }).addTo(map);
            });
            var whole = L.latLngBounds(route).pad(0.08);
            map.fitBounds(whole);

            var current = null;
            function show(stop) {
                if (!stop || stop === current) return;
                current = stop;
                stops.forEach(function (s) { s.classList.toggle('is-active', s === stop); });
                if (stop.getAttribute('data-stop') === 'now') {
                    map.flyToBounds(whole, { animate: !STILL, duration: 1.4 });
                    return;
                }
                var at = [parseFloat(stop.getAttribute('data-lat')), parseFloat(stop.getAttribute('data-lng'))];
                var zoom = parseFloat(stop.getAttribute('data-zoom')) || 8;
                if (STILL) map.setView(at, zoom, { animate: false });
                else map.flyTo(at, zoom, { duration: 1.4 });
            }

            // A stop's button: move the map there. On a phone the map is
            // above the list, so bring it into view as well.
            stops.forEach(function (stop) {
                var btn = stop.querySelector('.kr-journey__go');
                if (!btn) return;
                btn.addEventListener('click', function () {
                    show(stop);
                    if (!window.matchMedia(WIDE).matches) {
                        el.scrollIntoView({ behavior: STILL ? 'auto' : 'smooth', block: 'center' });
                    }
                });
            });

            // From 992px, follow the reader: the stop crossing the middle
            // of the screen is the one shown.
            var follow = new IntersectionObserver(function (entries) {
                if (!window.matchMedia(WIDE).matches) return;
                entries.forEach(function (e) { if (e.isIntersecting) show(e.target); });
            }, { rootMargin: '-45% 0px -45% 0px' });
            stops.forEach(function (s) { follow.observe(s); });

            // Leaflet measures its box once; tell it when the layout changes.
            window.addEventListener('resize', function () { map.invalidateSize(); });
        }
    }

    function initAbout() {
        fillStats();
        fillNow();
        initJourney();
    }

    window.initAbout = initAbout;
})();
