/**
 * slideshow.js: the photographs one at a time, full screen, with an
 * optional sound of a fire, rain or a forest underneath.
 *
 * Two ways in
 *   The gallery's Slideshow button (gallery.js) opens it over the gallery,
 *   on the photographs its filter shows, and asks for full screen on the
 *   same click. slideshow.html is the same slideshow as a page of its own,
 *   set up entirely from its address: for a browser in full screen (F11),
 *   or for a desktop wallpaper app that shows a web page (Lively Wallpaper
 *   on Windows), or an iframe.
 *
 * The address (every setting is in it, so a link is the whole slideshow)
 *   tag=      a subject, a KR_PHOTO_CATEGORIES key, as the gallery's ?tag=
 *   place=    a region name from data/photo-locations.json
 *   added=    a photoset, "<from>-<to>" from data/photosets.json, or
 *             "earlier" for the frames from before the first set
 *   order=    shuffle (the default) | newest | oldest
 *   every=    seconds per photograph (default 20)
 *   sound=    off (the default) | fire | rain | storm (rain and thunder) |
 *             forest | river | cafe | city (a city at night)
 *   volume=   0 to 100 (default 50)
 *   fit=      whole (the default: the whole frame over a blurred copy of
 *             itself) | fill (cropped to fill the screen)
 *   drift=0   no slow zoom
 *   captions=0  no place line
 *   controls=off  never show the controls (a wallpaper); the keys still work
 *   Values that mean nothing (a subject with no photographs, an unknown
 *   place) are dropped rather than showing an empty screen.
 *
 * Photographs
 *   One per gallery tile: a group in data/photo-variants.json shows its
 *   first edit, or under a subject the first edit that has it, as the
 *   gallery does. Each is the frame's hero (1920px on the long edge, about
 *   100 KB; generate_photo_renditions.py makes one for every frame), never
 *   the original on the release: a wallpaper runs for hours, and the
 *   release serves every original uncached. The next photograph is fetched
 *   and decoded while the current one is up, so a change never shows a
 *   half-drawn picture; a frame whose hero fails falls back to its 800px
 *   thumb, and one with neither is skipped. At the end of every pass the
 *   lists are fetched again, so a wallpaper left running picks up a new
 *   photoset, and a shuffle is dealt afresh.
 *
 * Sound
 *   Made in the browser with the Web Audio API (krAmbience, below): no
 *   recordings to download, and nothing that loops audibly. Every crackle,
 *   bird call, clink, car and roll of thunder is drawn at random as it
 *   plays, and the rain's drops, the river's bubbles and the café's
 *   conversation are drawn into loops of different lengths that only line
 *   up again after minutes. Browsers allow sound only after a click or a
 *   key press on the page, so when a link asks for sound= the slideshow
 *   says it is waiting for one; a wallpaper app may allow it from the
 *   start.
 *
 * Accessibility
 *   Over the gallery it is a modal dialog: the page behind is inert and
 *   focus returns to the button on close. The controls are buttons with
 *   action labels (Pause slideshow / Play slideshow), shown on any pointer
 *   movement or key press and hidden again (.kr-offstage) after IDLE_MS
 *   with the pointer, so they leave the Tab order when they leave the
 *   screen. The photographs change on their own, so nothing is announced
 *   then; a change the viewer asks for (next, previous) is announced in a
 *   hidden polite region. Space pauses, the arrow keys step, F toggles full
 *   screen, M the sound, Escape closes the settings and then the slideshow.
 *   On a touch screen a sideways swipe steps (SWIPE_MIN). Under reduced
 *   motion there is no slow zoom and the change is a cut.
 *
 * Tips
 *   One line near the foot, for a few seconds after the start, where it
 *   helps (offerTips): on a touch screen "Swipe for the next photograph",
 *   until the viewer has swiped once (remembered in localStorage); on a
 *   desktop browser that is not already full screen, the browser's own
 *   full-screen key (F11, or Control+Command+F on a Mac), which, unlike
 *   the Full screen button, lasts through a reload. None under
 *   controls=off, in an iframe, or once the window fills the screen.
 */
(function() {
    'use strict';

    const SOUNDS = [
        { key: 'off', label: 'No sound' },
        { key: 'fire', label: 'Crackling fire' },
        { key: 'rain', label: 'Rain' },
        { key: 'storm', label: 'Rain and thunder' },
        { key: 'forest', label: 'Forest' },
        { key: 'river', label: 'River' },
        { key: 'cafe', label: 'Café' },
        { key: 'city', label: 'City at night' }
    ];
    const ORDERS = [
        { key: 'shuffle', label: 'Shuffled' },
        { key: 'newest', label: 'Newest first' },
        { key: 'oldest', label: 'Oldest first' }
    ];
    const SPEEDS = [8, 15, 20, 30, 60, 120, 300];
    const DEFAULTS = {
        tag: '', place: '', added: '', order: 'shuffle', every: 20,
        sound: 'off', volume: 50, fit: 'whole', drift: true, captions: true,
        controls: 'auto'
    };
    // The cross-fade between photographs, matching .kr-show__slide's
    // transition; the slow zoom runs for the photograph's time plus this.
    const FADE_MS = 1400;
    // The controls and the pointer hide after this long without movement.
    const IDLE_MS = 2600;
    // A swipe is a sideways move of at least this many pixels, clearly more
    // sideways than up or down, within SWIPE_MS.
    const SWIPE_MIN = 50;
    const SWIPE_MS = 800;
    const SWIPED_KEY = 'kr-show-swiped';
    // A photograph that has not arrived by now is skipped.
    const LOAD_WAIT_MS = 20000;

    const DATA = ['data/photography-files.json', 'data/photo-tags.json', 'data/photo-locations.json',
        'data/photo-variants.json', 'data/photosets.json'];
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
        'September', 'October', 'November', 'December'];

    const heroOf = stem => '/img/photography/hero/' + stem + '.webp';
    const thumbOf = stem => '/img/photography/thumb/' + stem + '@2x.webp';
    const subjects = () => (typeof KR_PHOTO_CATEGORIES !== 'undefined' ? KR_PHOTO_CATEGORIES : []);
    const coarsePointer = () => !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const isMac = () => /mac/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');
    // Full screen by the API, or by the browser's own key (F11), which the
    // API cannot see: the window is then the size of the screen.
    const fillsScreen = () => !!document.fullscreenElement ||
        (Math.abs(window.innerWidth - screen.width) < 4 && Math.abs(window.innerHeight - screen.height) < 4);

    // ------------------------------------------------------------------
    // Settings <-> address
    // ------------------------------------------------------------------

    function readSettings(search) {
        const q = new URLSearchParams(search || '');
        const s = Object.assign({}, DEFAULTS);
        ['tag', 'place', 'added'].forEach(k => { if (q.get(k)) s[k] = q.get(k); });
        if (ORDERS.some(o => o.key === q.get('order'))) s.order = q.get('order');
        if (SOUNDS.some(o => o.key === q.get('sound'))) s.sound = q.get('sound');
        const every = parseInt(q.get('every'), 10);
        if (every >= 3 && every <= 3600) s.every = every;
        const volume = parseInt(q.get('volume'), 10);
        if (volume >= 0 && volume <= 100) s.volume = volume;
        if (q.get('fit') === 'fill') s.fit = 'fill';
        if (q.get('drift') === '0') s.drift = false;
        if (q.get('captions') === '0') s.captions = false;
        if (q.get('controls') === 'off') s.controls = 'off';
        return s;
    }

    /** The query string for a set of settings: only what differs from the defaults. */
    function settingsQuery(s) {
        const q = new URLSearchParams();
        ['tag', 'place', 'added'].forEach(k => { if (s[k]) q.set(k, s[k]); });
        if (s.order !== DEFAULTS.order) q.set('order', s.order);
        if (s.every !== DEFAULTS.every) q.set('every', String(s.every));
        if (s.sound !== DEFAULTS.sound) q.set('sound', s.sound);
        if (s.volume !== DEFAULTS.volume) q.set('volume', String(s.volume));
        if (s.fit !== DEFAULTS.fit) q.set('fit', s.fit);
        if (!s.drift) q.set('drift', '0');
        if (!s.captions) q.set('captions', '0');
        if (s.controls === 'off') q.set('controls', 'off');
        const qs = q.toString();
        return qs ? '?' + qs : '';
    }

    function pageUrl(s) {
        return new URL('/slideshow.html' + settingsQuery(s), window.location.href).href;
    }

    // ------------------------------------------------------------------
    // The photographs
    // ------------------------------------------------------------------

    function fetchJson(path, fresh) {
        const got = !fresh && typeof krFetchJson === 'function'
            ? krFetchJson(path)
            : fetch('/' + path, { cache: fresh ? 'no-cache' : 'default' }).then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            });
        return got.catch(() => null);
    }

    function loadLibrary(fresh) {
        return Promise.all(DATA.map(p => fetchJson(p, fresh))).then(buildLibrary);
    }

    function setLabel(set) {
        const d = /^(\d{4})-(\d{2})/.exec(set.date || '');
        const when = d ? MONTHS[+d[2] - 1] + ' ' + d[1] : set.date;
        return when + ': ' + set.place.replace(/^the archive: /, '');
    }

    /** Tiles, as the gallery has them, with what the filters need to know. */
    function buildLibrary(results) {
        const files = results[0], tags = results[1] || {}, locations = results[2] || {};
        const variants = results[3] || {}, photosets = results[4] || {};
        const editsOf = {}, groupOf = {};
        (variants.groups || []).forEach(group => {
            const stems = group.map(String);
            if (stems.length < 2) return;
            editsOf[stems[0]] = stems;
            stems.forEach(s => { groupOf[s] = stems[0]; });
        });
        let stems = Array.isArray(files)
            ? files.map(f => String(f).split('/').pop().replace(/\.\w+$/, ''))
            : Object.keys(tags);
        stems = stems.filter(s => /^\d+$/.test(s) && (!groupOf[s] || groupOf[s] === s));
        stems.sort((a, b) => b - a);
        const placeOf = {};
        (locations.regions || []).forEach(r => (r.photos || []).forEach(p => { placeOf[String(p)] = r.name; }));
        const tiles = stems.map(stem => {
            const edits = editsOf[stem] || [stem];
            const tagSet = {};
            edits.forEach(e => (tags[e] || []).forEach(t => { tagSet[t] = true; }));
            return { stem: stem, n: +stem, edits: edits, tags: Object.keys(tagSet),
                place: edits.map(e => placeOf[e]).find(Boolean) || '' };
        });
        const sets = (photosets.sets || []).map(x => ({
            key: x.from + '-' + x.to, from: +x.from, to: +x.to, date: x.date, place: x.place || ''
        }));
        const earliest = sets.length ? Math.min.apply(null, sets.map(x => x.from)) : 0;
        const first = sets.find(x => x.from === earliest);
        return { tiles: tiles, tags: tags, sets: sets, earliest: earliest, firstSet: first };
    }

    function inAdded(tile, added, lib) {
        if (!added) return true;
        if (added === 'earlier') return !!lib.earliest && tile.n < lib.earliest;
        const set = lib.sets.find(x => x.key === added);
        return !!set && tile.n >= set.from && tile.n <= set.to;
    }

    function matches(tile, s, lib) {
        return (!s.tag || tile.tags.indexOf(s.tag) !== -1) &&
            (!s.place || tile.place === s.place) &&
            inAdded(tile, s.added, lib);
    }

    /** Drop the filter values that would leave nothing to show on their own. */
    function sanitise(s, lib) {
        if (s.tag && !lib.tiles.some(t => t.tags.indexOf(s.tag) !== -1)) s.tag = '';
        if (s.place && !lib.tiles.some(t => t.place === s.place)) s.place = '';
        if (s.added && !lib.tiles.some(t => inAdded(t, s.added, lib))) s.added = '';
        return s;
    }

    /** The edit a tile shows: under a subject, the first edit that has it. */
    function faceOf(tile, s, lib) {
        if (s.tag) {
            const hit = tile.edits.find(e => (lib.tags[e] || []).indexOf(s.tag) !== -1);
            if (hit) return hit;
        }
        return tile.edits[0];
    }

    function shuffled(list) {
        const a = list.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
    }

    function deal(s, lib, avoidFirst) {
        const view = lib.tiles.filter(t => matches(t, s, lib));
        if (s.order === 'oldest') return view.slice().reverse();
        if (s.order === 'newest') return view;
        const deck = shuffled(view);
        // A new pass never opens on the photograph the last one ended with.
        if (deck.length > 1 && avoidFirst && deck[0].stem === avoidFirst) deck.push(deck.shift());
        return deck;
    }

    /** The photograph decoded and ready to draw: its hero, or its thumb. */
    function loadFrame(stem) {
        return new Promise(resolve => {
            let settled = false;
            const done = v => { if (!settled) { settled = true; resolve(v); } };
            const timer = setTimeout(() => done(null), LOAD_WAIT_MS);
            const attempt = urls => {
                if (!urls.length) { clearTimeout(timer); done(null); return; }
                const img = new Image();
                img.decoding = 'async';
                img.onload = () => {
                    const ready = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
                    ready.then(() => { clearTimeout(timer); done({ stem: stem, src: img.src }); });
                };
                img.onerror = () => attempt(urls.slice(1));
                img.src = urls[0];
            };
            attempt([heroOf(stem), thumbOf(stem)]);
        });
    }

    // ------------------------------------------------------------------
    // The view
    // ------------------------------------------------------------------

    function el(tag, attrs, html) {
        const node = document.createElement(tag);
        Object.keys(attrs || {}).forEach(k => node.setAttribute(k, attrs[k]));
        if (html) node.innerHTML = html;
        return node;
    }

    function esc(s) {
        return typeof krEscapeHtml === 'function' ? krEscapeHtml(s)
            : String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function option(value, label, selected) {
        return '<option value="' + esc(value) + '"' + (selected ? ' selected' : '') + '>' + esc(label) + '</option>';
    }

    function speedLabel(sec) {
        if (sec < 60) return sec + ' seconds';
        const m = Math.round(sec / 60);
        return m + (m === 1 ? ' minute' : ' minutes');
    }

    function icon(name) {
        return '<i class="' + name + '" aria-hidden="true"></i>';
    }

    let active = null;

    /**
     * Open the slideshow. opts: { settings, standalone, returnFocus }.
     * settings may be partial (the gallery passes its tag); the rest are
     * the defaults.
     */
    function open(opts) {
        opts = opts || {};
        if (active) active.close();
        const s = Object.assign({}, DEFAULTS, opts.settings || {});
        active = new Show(s, !!opts.standalone, opts.returnFocus || null);
        return active;
    }

    function Show(settings, standalone, returnFocus) {
        this.s = settings;
        this.standalone = standalone;
        this.returnFocus = returnFocus;
        this.lib = null;
        this.deck = [];
        this.pos = -1;
        this.playing = true;
        this.timer = 0;
        this.idleTimer = 0;
        this.front = 0;
        this.next = null;          // { pos, promise } of the photograph being fetched ahead
        this.token = 0;            // bumps on every change, so a late load cannot draw over a newer one
        this.inerted = [];
        this.wakeLock = null;
        this.listeners = [];
        this.build();
        this.bind();
        this.setPlaying(true);
        this.wake();
        loadLibrary(false).then(lib => this.start(lib));
    }

    Show.prototype.on = function(target, type, fn, opts) {
        target.addEventListener(type, fn, opts);
        this.listeners.push([target, type, fn, opts]);
    };

    Show.prototype.build = function() {
        const s = this.s;
        const id = 'kr-show-settings';
        const root = el('div', {
            class: 'kr-show',
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': 'Slideshow of photographs',
            tabindex: '-1'
        });
        const close = this.standalone
            ? '<a class="kr-show__btn" href="/gallery.html" data-act="gallery" aria-label="Back to the gallery">' + icon('ti-close') + '</a>'
            : '<button type="button" class="kr-show__btn" data-act="close" aria-label="Close slideshow">' + icon('ti-close') + '</button>';
        const full = document.fullscreenEnabled
            ? '<button type="button" class="kr-show__btn" data-act="fullscreen" aria-label="Full screen">' + icon('ti-fullscreen') + '</button>'
            : '';
        root.innerHTML =
            '<div class="kr-show__stage">' +
                '<div class="kr-show__slide"><img class="kr-show__backdrop" alt=""><img class="kr-show__photo" alt=""></div>' +
                '<div class="kr-show__slide"><img class="kr-show__backdrop" alt=""><img class="kr-show__photo" alt=""></div>' +
                '<p class="kr-show__message" hidden></p>' +
            '</div>' +
            '<p class="kr-show__caption" aria-hidden="true"></p>' +
            '<p class="kr-show__hint kr-offstage" aria-hidden="true">' + (coarsePointer() ? 'Tap' : 'Click') + ' anywhere for sound</p>' +
            '<p class="kr-show__tip kr-offstage" aria-hidden="true"></p>' +
            '<p class="kr-sr-only" aria-live="polite" data-announce></p>' +
            '<div class="kr-show__bar kr-offstage is-visible" role="group" aria-label="Slideshow controls">' +
                '<button type="button" class="kr-show__btn" data-act="prev" aria-label="Previous photograph">' + icon('ti-control-skip-backward') + '</button>' +
                '<button type="button" class="kr-show__btn kr-show__btn--main" data-act="play" aria-label="Pause slideshow">' + icon('ti-control-pause') + '</button>' +
                '<button type="button" class="kr-show__btn" data-act="next" aria-label="Next photograph">' + icon('ti-control-skip-forward') + '</button>' +
                '<span class="kr-show__count" data-count></span>' +
                '<span class="kr-show__spacer"></span>' +
                '<label class="kr-show__sound">' + icon('ti-volume') + '<span class="kr-sr-only">Sound</span>' +
                    '<select data-set="sound">' + SOUNDS.map(o => option(o.key, o.label, o.key === s.sound)).join('') + '</select></label>' +
                '<input class="kr-show__volume" type="range" min="0" max="100" step="5" value="' + s.volume + '" data-set="volume" aria-label="Volume">' +
                '<button type="button" class="kr-show__btn" data-act="settings" aria-label="Slideshow settings" aria-expanded="false" aria-controls="' + id + '">' + icon('ti-settings') + '</button>' +
                full + close +
            '</div>' +
            '<form class="kr-show__panel kr-offstage" id="' + id + '" aria-label="Slideshow settings" novalidate></form>';
        this.root = root;
        this.slides = root.querySelectorAll('.kr-show__slide');
        this.bar = root.querySelector('.kr-show__bar');
        this.panel = root.querySelector('.kr-show__panel');
        this.caption = root.querySelector('.kr-show__caption');
        this.message = root.querySelector('.kr-show__message');
        this.hint = root.querySelector('.kr-show__hint');
        this.tipEl = root.querySelector('.kr-show__tip');
        this.live = root.querySelector('[data-announce]');
        this.count = root.querySelector('[data-count]');
        this.applyLook();

        document.body.appendChild(root);
        document.documentElement.classList.add('kr-show-open');
        if (!this.standalone) {
            Array.prototype.forEach.call(document.body.children, node => {
                if (node !== root && !node.inert) { node.inert = true; this.inerted.push(node); }
            });
        }
        root.focus({ preventScroll: true });
    };

    /** The settings form, drawn once the photograph lists are in. */
    Show.prototype.renderPanel = function() {
        const s = this.s, lib = this.lib;
        const counts = {}, places = {};
        lib.tiles.forEach(t => {
            t.tags.forEach(k => { counts[k] = (counts[k] || 0) + 1; });
            if (t.place) places[t.place] = (places[t.place] || 0) + 1;
        });
        const subjectOptions = subjects().filter(c => counts[c.key])
            .map(c => option(c.key, c.label + ' (' + counts[c.key] + ')', c.key === s.tag)).join('');
        const placeOptions = Object.keys(places).sort((a, b) => a.localeCompare(b))
            .map(p => option(p, p + ' (' + places[p] + ')', p === s.place)).join('');
        const setOptions = lib.sets.map(x => option(x.key, setLabel(x), x.key === s.added)).join('') +
            (lib.firstSet ? option('earlier', 'Before ' + setLabel(lib.firstSet).split(':')[0], s.added === 'earlier') : '');
        const speeds = SPEEDS.indexOf(s.every) === -1 ? SPEEDS.concat([s.every]).sort((a, b) => a - b) : SPEEDS;
        this.panel.innerHTML =
            '<h2 class="kr-show__panel-title">Slideshow</h2>' +
            '<p class="kr-show__panel-count" data-panel-count></p>' +
            '<div class="kr-show__fields">' +
                '<label class="kr-show__field">Subject<select data-set="tag">' + option('', 'Any subject', !s.tag) + subjectOptions + '</select></label>' +
                '<label class="kr-show__field">Place<select data-set="place">' + option('', 'Anywhere', !s.place) + placeOptions + '</select></label>' +
                '<label class="kr-show__field">Added to the gallery<select data-set="added">' + option('', 'Any time', !s.added) + setOptions + '</select></label>' +
                '<label class="kr-show__field">Order<select data-set="order">' + ORDERS.map(o => option(o.key, o.label, o.key === s.order)).join('') + '</select></label>' +
                '<label class="kr-show__field">Each photograph<select data-set="every">' + speeds.map(v => option(String(v), speedLabel(v), v === s.every)).join('') + '</select></label>' +
                '<label class="kr-show__field">Framing<select data-set="fit">' + option('whole', 'Whole photograph', s.fit === 'whole') + option('fill', 'Fill the screen', s.fit === 'fill') + '</select></label>' +
            '</div>' +
            '<label class="kr-show__check"><input type="checkbox" data-set="drift"' + (s.drift ? ' checked' : '') + '> Slow zoom</label>' +
            '<label class="kr-show__check"><input type="checkbox" data-set="captions"' + (s.captions ? ' checked' : '') + '> Show where each was taken</label>' +
            '<fieldset class="kr-show__share">' +
                '<legend>As a wallpaper</legend>' +
                '<p>This link opens the slideshow as it is set up here. Open it and press F11, or give it to a wallpaper app that shows web pages, such as Lively Wallpaper on Windows.</p>' +
                '<label class="kr-show__check"><input type="checkbox" data-set="controls"' + (s.controls === 'off' ? ' checked' : '') + '> Never show the controls (keys still work)</label>' +
                '<div class="kr-show__link"><input type="text" readonly data-url aria-label="Slideshow link">' +
                '<button type="button" class="kr-show__copy" data-act="copy">' + icon('ti-link') + ' Copy link</button></div>' +
            '</fieldset>';
        this.updateLink();
    };

    Show.prototype.updateLink = function() {
        const field = this.panel.querySelector('[data-url]');
        if (field) field.value = pageUrl(this.s);
        const n = this.panel.querySelector('[data-panel-count]');
        if (n) n.textContent = this.deck.length === 1 ? '1 photograph' : this.deck.length + ' photographs';
        if (this.standalone && window.history && window.history.replaceState) {
            try { window.history.replaceState(null, '', settingsQuery(this.s) || window.location.pathname); } catch (e) {}
        }
        const back = this.root.querySelector('[data-act="gallery"]');
        if (back) back.href = '/gallery.html' + (this.s.tag ? '?tag=' + encodeURIComponent(this.s.tag) : '');
    };

    Show.prototype.applyLook = function() {
        const r = this.root.classList;
        r.toggle('kr-show--fill', this.s.fit === 'fill');
        r.toggle('kr-show--drift', !!this.s.drift);
        r.toggle('kr-show--captions', !!this.s.captions);
        r.toggle('kr-show--bare', this.s.controls === 'off');
        this.root.style.setProperty('--kr-show-dur', (this.s.every * 1000 + FADE_MS * 2) + 'ms');
    };

    Show.prototype.start = function(lib) {
        if (!this.root) return;
        if (!lib.tiles.length) {
            this.say('The photographs could not be loaded just now.');
            return;
        }
        this.lib = lib;
        sanitise(this.s, lib);
        this.deck = deal(this.s, lib);
        this.renderPanel();
        this.ambience = window.krAmbience;
        this.setSound(this.s.sound, true);
        this.go(0, false);
        this.poke();
        this.offerTips();
    };

    // --- tips (see "Tips" at the top) ------------------------------------

    Show.prototype.offerTips = function() {
        if (this.s.controls === 'off' || window.top !== window) return;
        if (coarsePointer()) {
            let swiped = false;
            try { swiped = window.localStorage.getItem(SWIPED_KEY) === '1'; } catch (e) {}
            if (!swiped) this.tip('Swipe for the next photograph', 5000);
        } else if (!fillsScreen()) {
            this.tip(isMac() ? 'Press Control + Command + F for full screen' : 'Press F11 for full screen', 7000);
        }
    };

    Show.prototype.tip = function(text, ms) {
        this.tipEl.textContent = text;
        this.tipEl.classList.add('is-visible');
        clearTimeout(this.tipTimer);
        this.tipTimer = setTimeout(() => this.hideTip(), ms);
    };

    Show.prototype.hideTip = function() {
        clearTimeout(this.tipTimer);
        if (this.tipEl) this.tipEl.classList.remove('is-visible');
    };

    Show.prototype.say = function(text) {
        this.message.textContent = text;
        this.message.hidden = !text;
    };

    // --- moving through the deck --------------------------------------

    Show.prototype.fetchAhead = function(pos) {
        if (!this.deck.length) return null;
        const p = ((pos % this.deck.length) + this.deck.length) % this.deck.length;
        if (this.next && this.next.pos === p && this.next.deck === this.deck) return this.next.promise;
        const tile = this.deck[p];
        const promise = loadFrame(faceOf(tile, this.s, this.lib));
        this.next = { pos: p, deck: this.deck, promise: promise };
        return promise;
    };

    /** Show deck[pos]; asked is true when the viewer stepped there. */
    Show.prototype.go = function(pos, asked, skipped) {
        clearTimeout(this.timer);
        const n = this.deck.length;
        if (!n) {
            this.say('Nothing matches these settings. Open the settings to choose others.');
            this.count.textContent = '';
            this.slides.forEach(sl => sl.classList.remove('is-current'));
            return;
        }
        this.say('');
        if (pos >= n && !asked) { this.newPass(); return; }
        const p = ((pos % n) + n) % n;
        const token = ++this.token;
        const tile = this.deck[p];
        this.fetchAhead(p).then(frame => {
            if (token !== this.token || !this.root) return;
            if (!frame) {
                // Neither size arrived: skip it, unless every photograph fails.
                if ((skipped || 0) + 1 >= n) { this.say('The photographs could not be loaded just now.'); return; }
                this.go(asked && pos < this.pos ? p - 1 : p + 1, asked, (skipped || 0) + 1);
                return;
            }
            this.pos = p;
            this.draw(tile, frame);
            if (asked) this.live.textContent = this.describe(tile, frame.stem, true);
            this.schedule();
            this.fetchAhead(p + 1);
        });
    };

    /** End of a pass: fetch the lists again (new photosets) and deal again. */
    Show.prototype.newPass = function() {
        const last = this.deck.length ? this.deck[this.deck.length - 1].stem : '';
        loadLibrary(true).then(lib => {
            if (!this.root) return;
            if (lib.tiles.length) { this.lib = lib; sanitise(this.s, lib); }
            this.deck = deal(this.s, this.lib, last);
            this.next = null;
            this.updateLink();
            this.go(0, false);
        });
    };

    Show.prototype.describe = function(tile, stem, withPosition) {
        const parts = ['Photograph ' + stem];
        if (tile.place) parts.push(tile.place);
        const text = parts.join(', ');
        return withPosition ? text + '. ' + (this.pos + 1) + ' of ' + this.deck.length : text;
    };

    Show.prototype.draw = function(tile, frame) {
        const back = this.slides[1 - this.front], front = this.slides[this.front];
        const photo = back.querySelector('.kr-show__photo');
        const backdrop = back.querySelector('.kr-show__backdrop');
        photo.src = frame.src;
        photo.alt = this.describe(tile, frame.stem, false);
        backdrop.src = thumbOf(frame.stem);
        // A fresh direction for the slow zoom each time: toward a corner.
        back.style.setProperty('--kr-show-dx', (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 2).toFixed(2) + '%');
        back.style.setProperty('--kr-show-dy', (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 1.5).toFixed(2) + '%');
        back.classList.remove('is-drifting');
        void back.offsetWidth;    // restart the zoom from its first frame
        back.classList.add('is-drifting', 'is-current');
        front.classList.remove('is-current');
        this.front = 1 - this.front;
        const caption = tile.place || '';
        this.caption.textContent = caption;
        this.caption.hidden = !caption;
        this.count.textContent = (this.pos + 1) + ' of ' + this.deck.length;
    };

    Show.prototype.schedule = function() {
        clearTimeout(this.timer);
        if (!this.playing || document.hidden || !this.deck.length) return;
        this.timer = setTimeout(() => this.go(this.pos + 1, false), this.s.every * 1000);
    };

    Show.prototype.step = function(delta) {
        this.go(this.pos + delta, true);
    };

    Show.prototype.setPlaying = function(on) {
        this.playing = on;
        const btn = this.root.querySelector('[data-act="play"]');
        btn.setAttribute('aria-label', on ? 'Pause slideshow' : 'Play slideshow');
        btn.innerHTML = icon(on ? 'ti-control-pause' : 'ti-control-play');
        this.root.classList.toggle('is-paused', !on);
        if (on) this.schedule(); else clearTimeout(this.timer);
        this.wake();
    };

    // --- settings ---------------------------------------------------------

    Show.prototype.change = function(key, value) {
        const s = this.s;
        if (key === 'every') s.every = parseInt(value, 10) || DEFAULTS.every;
        else if (key === 'volume') s.volume = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
        else if (key === 'drift' || key === 'captions') s[key] = !!value;
        else if (key === 'controls') s.controls = value ? 'off' : 'auto';
        else s[key] = value;
        if (key === 'sound') this.setSound(value, false);
        if (key === 'volume' && this.ambience) this.ambience.volume(s.volume / 100);
        this.applyLook();
        if (key === 'tag' || key === 'place' || key === 'added' || key === 'order') {
            this.deck = deal(s, this.lib);
            this.next = null;
            this.go(0, false);
        } else if (key === 'every') {
            this.schedule();
        }
        this.updateLink();
    };

    Show.prototype.setSound = function(key, fromLink) {
        this.s.sound = key;
        const select = this.root.querySelector('select[data-set="sound"]');
        if (select) select.value = key;
        this.lastSound = key !== 'off' ? key : this.lastSound;
        const amb = this.ambience;
        if (!amb) return;
        if (key === 'off') { amb.stop(); this.showHint(false); return; }
        amb.play(key, this.s.volume / 100).then(running => {
            // A link asked for sound before anyone touched the page: the
            // browser holds it until a click or key press (see "Sound").
            if (!running && fromLink) this.showHint(true);
        });
    };

    Show.prototype.showHint = function(on) {
        this.hint.classList.toggle('is-visible', on);
        this.waitingForSound = on;
    };

    Show.prototype.togglePanel = function(on) {
        const open = on === undefined ? !this.panel.classList.contains('is-visible') : on;
        this.panel.classList.toggle('is-visible', open);
        this.root.querySelector('[data-act="settings"]').setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
            this.poke();
            const first = this.panel.querySelector('select');
            if (first) first.focus();
        } else if (this.panel.contains(document.activeElement)) {
            this.root.querySelector('[data-act="settings"]').focus();
        }
    };

    Show.prototype.copyLink = function(btn) {
        const url = pageUrl(this.s);
        const done = ok => {
            btn.innerHTML = icon(ok ? 'ti-check' : 'ti-link') + (ok ? ' Copied' : ' Select and copy the link');
            setTimeout(() => { btn.innerHTML = icon('ti-link') + ' Copy link'; }, 2200);
            if (!ok) this.panel.querySelector('[data-url]').select();
        };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => done(true), () => done(false));
        else done(false);
    };

    // --- full screen, idle, wake ---------------------------------------

    Show.prototype.toggleFullscreen = function() {
        if (!document.fullscreenEnabled) return;
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        else document.documentElement.requestFullscreen().catch(() => {});
    };

    Show.prototype.syncFullscreen = function() {
        const btn = this.root.querySelector('[data-act="fullscreen"]');
        if (!btn) return;
        const on = !!document.fullscreenElement;
        btn.setAttribute('aria-label', on ? 'Leave full screen' : 'Full screen');
        btn.classList.toggle('is-on', on);
    };

    /** Something moved: show the controls and the pointer, then hide them again. */
    Show.prototype.poke = function() {
        if (!this.root) return;
        clearTimeout(this.idleTimer);
        this.root.classList.remove('is-idle');
        if (this.s.controls !== 'off') this.bar.classList.add('is-visible');
        this.idleTimer = setTimeout(() => this.idle(), IDLE_MS);
    };

    Show.prototype.idle = function() {
        if (!this.root) return;
        if (this.panel.classList.contains('is-visible') || this.bar.matches(':hover')) {
            this.idleTimer = setTimeout(() => this.idle(), IDLE_MS);
            return;
        }
        this.root.classList.add('is-idle');
        // Hidden controls leave the Tab order; focus waits on the dialog.
        if (this.bar.contains(document.activeElement)) this.root.focus({ preventScroll: true });
        this.bar.classList.remove('is-visible');
    };

    Show.prototype.wake = function() {
        const want = this.root && this.playing && !document.hidden;
        if (want && !this.wakeLock && navigator.wakeLock && navigator.wakeLock.request) {
            navigator.wakeLock.request('screen').then(lock => {
                if (!this.root || !this.playing) { lock.release(); return; }
                this.wakeLock = lock;
                lock.addEventListener('release', () => { if (this.wakeLock === lock) this.wakeLock = null; });
            }, () => {});
        } else if (!want && this.wakeLock) {
            this.wakeLock.release().catch(() => {});
            this.wakeLock = null;
        }
    };

    // --- events -----------------------------------------------------------

    Show.prototype.bind = function() {
        const root = this.root;
        this.on(root, 'click', e => {
            const btn = e.target.closest('[data-act]');
            if (this.waitingForSound) this.resumeSound();
            if (!btn) {
                if (this.swipedAt && Date.now() - this.swipedAt < 400) return;
                // A click on the photograph itself: the controls, or close the settings.
                if (!e.target.closest('.kr-show__panel, .kr-show__bar')) {
                    if (this.panel.classList.contains('is-visible')) this.togglePanel(false);
                    else this.poke();
                }
                return;
            }
            const act = btn.getAttribute('data-act');
            if (act === 'gallery') return;     // a plain link
            e.preventDefault();
            if (act === 'prev') this.step(-1);
            else if (act === 'next') this.step(1);
            else if (act === 'play') this.setPlaying(!this.playing);
            else if (act === 'settings') this.togglePanel();
            else if (act === 'fullscreen') this.toggleFullscreen();
            else if (act === 'close') this.close();
            else if (act === 'copy') this.copyLink(btn);
        });
        this.on(root, 'change', e => {
            const key = e.target.getAttribute('data-set');
            if (!key) return;
            this.change(key, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
        });
        this.on(root, 'input', e => {
            if (e.target.getAttribute('data-set') === 'volume') this.change('volume', e.target.value);
        });
        this.on(root, 'submit', e => e.preventDefault());
        this.on(root, 'pointermove', () => this.poke(), { passive: true });
        this.on(root, 'pointerdown', () => { if (this.waitingForSound) this.resumeSound(); this.poke(); }, { passive: true });
        this.on(root, 'keydown', e => this.key(e));
        this.on(document, 'visibilitychange', () => {
            if (document.hidden) clearTimeout(this.timer); else this.schedule();
            this.wake();
        });
        this.on(document, 'fullscreenchange', () => { this.syncFullscreen(); if (fillsScreen()) this.hideTip(); });
        this.on(window, 'resize', () => { if (fillsScreen()) this.hideTip(); });
        // A sideways swipe on the photograph steps, as the arrow keys do.
        this.on(root, 'touchstart', e => {
            const t = e.touches[0];
            this.touch = e.touches.length === 1 && e.target.closest('.kr-show__stage')
                ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
        }, { passive: true });
        this.on(root, 'touchend', e => {
            const start = this.touch, t = e.changedTouches[0];
            this.touch = null;
            if (!start || !t || Date.now() - start.at > SWIPE_MS) return;
            const dx = t.clientX - start.x, dy = t.clientY - start.y;
            if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            this.swipedAt = Date.now();
            this.step(dx < 0 ? 1 : -1);
            this.hideTip();
            try { window.localStorage.setItem(SWIPED_KEY, '1'); } catch (err) {}
        }, { passive: true });
        this.on(root, 'touchcancel', () => { this.touch = null; }, { passive: true });
    };

    Show.prototype.resumeSound = function() {
        this.showHint(false);
        if (this.ambience && this.s.sound !== 'off') this.ambience.play(this.s.sound, this.s.volume / 100);
    };

    Show.prototype.key = function(e) {
        if (this.waitingForSound) this.resumeSound();
        this.poke();
        const t = e.target;
        const field = t.closest && t.closest('select, input, textarea');
        const onButton = t.closest && t.closest('button, a');
        if (e.key === 'Escape') {
            if (this.panel.classList.contains('is-visible')) { e.preventDefault(); this.togglePanel(false); }
            else if (!this.standalone) { e.preventDefault(); this.close(); }
            return;
        }
        if (e.key === 'Tab') { this.trap(e); return; }
        if (field || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); this.step(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); this.step(-1); }
        else if ((e.key === ' ' || e.key === 'k') && !onButton) { e.preventDefault(); this.setPlaying(!this.playing); }
        else if (e.key === 'f' || e.key === 'F') { e.preventDefault(); this.toggleFullscreen(); }
        else if (e.key === 'm' || e.key === 'M') {
            e.preventDefault();
            this.setSound(this.s.sound === 'off' ? (this.lastSound || 'fire') : 'off', false);
            this.updateLink();
        }
    };

    /** Tab stays inside the slideshow: the page behind is inert, the browser chrome is not. */
    Show.prototype.trap = function(e) {
        const items = Array.prototype.filter.call(
            this.root.querySelectorAll('button, a[href], select, input'),
            node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
        if (!items.length) { e.preventDefault(); return; }
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === this.root)) {
            e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault(); first.focus();
        }
    };

    Show.prototype.close = function() {
        if (!this.root) return;
        clearTimeout(this.timer);
        clearTimeout(this.idleTimer);
        clearTimeout(this.tipTimer);
        this.token++;
        this.listeners.forEach(l => l[0].removeEventListener(l[1], l[2], l[3]));
        this.listeners = [];
        if (this.ambience) this.ambience.stop();
        this.playing = false;
        this.wake();
        this.inerted.forEach(node => { node.inert = false; });
        document.documentElement.classList.remove('kr-show-open');
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        this.root.remove();
        this.root = null;
        if (active === this) active = null;
        if (this.returnFocus) this.returnFocus.focus({ preventScroll: true });
    };

    // ------------------------------------------------------------------
    // krAmbience: the sounds, made as they play
    // ------------------------------------------------------------------
    //
    // Each sound is a steady bed with events scattered over it at random: a
    // fire's crackles and pops over a roar, a forest's bird calls over wind
    // in the leaves, rain's big drops and thunder over the patter, a river's
    // gloops over its bubbling, a café's cups over its conversation, a
    // city's cars, footsteps, horns and sirens over its distant traffic. A
    // scheduler wakes every TICK_MS and books the events for the next AHEAD
    // seconds on the audio clock, which keeps time even when a hidden tab's
    // timers slow to once a second. Noise comes from three 8-second stereo
    // buffers made once; eight seconds of noise has no rhythm the ear can
    // catch on.
    //
    // Rain is not noise. Filtered noise sounds like a detuned radio; rain
    // is thousands of separate drops, most of them faint, a few loud. So
    // its bed is drops (patter, below), drawn sample by sample into
    // textures and looped: one of drops a few metres away, one of far more
    // and fainter drops further off. Each drop is either a click of a
    // millisecond or so (a leaf, the ground) or a short ring that rises in
    // pitch as it fades (a drop into water: the bubble it traps rings, and
    // rises as it closes). The loops are 17, 19 and 23 seconds, lengths
    // that share no factor, so a pair only lines up again after six or
    // seven minutes.

    const TICK_MS = 250;
    const AHEAD = 1.6;
    const NOISE_SECONDS = 8;
    // The rain textures. rate is drops a second; skew how many are faint
    // (the loudness is a uniform draw raised to this power); plink the
    // share that ring rather than click, at lo to hi Hz, rising by up to
    // rise of their pitch, dying away over tau seconds; tick the decay of
    // a click. Each is scaled to TEXTURE_RMS once made (patter).
    const TEXTURES = {
        near: { seconds: 19, rate: 120, skew: 3, plink: 0.35, lo: 1300, hi: 5000, rise: 0.9, tau: [0.003, 0.012], tick: [0.0004, 0.0015] },
        heavy: { seconds: 17, rate: 340, skew: 2.6, plink: 0.25, lo: 1100, hi: 4600, rise: 0.8, tau: [0.003, 0.01], tick: [0.0004, 0.0015] },
        far: { seconds: 23, rate: 1100, skew: 2, plink: 0.08, lo: 1800, hi: 6500, rise: 0.5, tau: [0.001, 0.004], tick: [0.0002, 0.0008] },
        // A river is the same thing lower and wetter: nearly every "drop" a
        // bubble, ringing longer and rising further. Little of it is above
        // 3 kHz, so it is made at a lower sample rate (sr), which is quicker.
        river: { seconds: 21, rate: 420, skew: 2, plink: 0.9, lo: 220, hi: 1300, rise: 1.6, tau: [0.004, 0.018], tick: [0.0006, 0.002], sr: 16000 },
        brook: { seconds: 26, rate: 260, skew: 2.4, plink: 0.75, lo: 700, hi: 2600, rise: 1.2, tau: [0.002, 0.01], tick: [0.0004, 0.0015], sr: 16000 }
    };
    const TEXTURE_RMS = 0.1;
    const TEXTURE_PEAK = 0.4;

    /** A stereo texture of drops (see "Rain is not noise" above). Drops
        that run past the end wrap round to the start, so the loop has no
        seam. */
    function patter(ctx, o) {
        const sr = o.sr || ctx.sampleRate, len = Math.floor(sr * o.seconds);
        const buf = ctx.createBuffer(2, len, sr);
        const L = buf.getChannelData(0), R = buf.getChannelData(1);
        const count = Math.floor(o.seconds * o.rate);
        for (let n = 0; n < count; n++) {
            const start = Math.floor(Math.random() * len);
            const loud = Math.pow(Math.random(), o.skew);
            const side = Math.random() * Math.PI / 2;
            const gl = Math.cos(side) * loud, gr = Math.sin(side) * loud;
            if (Math.random() < o.plink) {
                const f0 = o.lo * Math.pow(o.hi / o.lo, Math.random());
                const rise = Math.random() * o.rise;
                const tau = (o.tau[0] + Math.random() * (o.tau[1] - o.tau[0])) * sr;
                const dur = Math.floor(tau * 5);
                const fade = Math.exp(-1 / tau);
                let phase = 0, env = 1;
                for (let i = 0; i < dur; i++, env *= fade) {
                    phase += 2 * Math.PI * f0 * (1 + rise * i / dur) / sr;
                    const v = Math.sin(phase) * env;
                    const k = (start + i) % len;
                    L[k] += v * gl;
                    R[k] += v * gr;
                }
            } else {
                const tau = (o.tick[0] + Math.random() * (o.tick[1] - o.tick[0])) * sr;
                const dur = Math.floor(tau * 6);
                const fade = Math.exp(-1 / tau);
                let prev = 0, env = 0.7;
                for (let i = 0; i < dur; i++, env *= fade) {
                    // Differenced noise: a click with its lows taken out.
                    const w = Math.random() * 2 - 1;
                    const v = (w - prev) * env;
                    prev = w;
                    const k = (start + i) % len;
                    L[k] += v * gl;
                    R[k] += v * gr;
                }
            }
        }
        settle(L, R);
        return buf;
    }

    /** A texture scaled to TEXTURE_RMS, then its loudest moments rounded
        off (a soft clip at TEXTURE_PEAK), so turning it up to the other
        sounds' loudness does not leave a few drops to hit the limiter. */
    function settle(L, R) {
        const len = L.length;
        let sum = 0;
        for (let i = 0; i < len; i++) sum += L[i] * L[i] + R[i] * R[i];
        const scale = TEXTURE_RMS / Math.max(1e-9, Math.sqrt(sum / (2 * len)));
        for (let i = 0; i < len; i++) {
            L[i] = TEXTURE_PEAK * Math.tanh(L[i] * scale / TEXTURE_PEAK);
            R[i] = TEXTURE_PEAK * Math.tanh(R[i] * scale / TEXTURE_PEAK);
        }
    }

    // The café's conversation: voices people talking in phrases of a few
    // syllables, talk of the time, with pauses between. Too many at once to
    // follow any of them, which is the point of a café.
    const BABBLES = {
        chatter: { seconds: 22, voices: 8, talk: 0.5 },
        crowd: { seconds: 29, voices: 16, talk: 0.45 }
    };
    // Speech carries little above 4 kHz, so it is made at this rate and the
    // browser resamples it.
    const BABBLE_SR = 16000;
    // Vowels as their first two formants, the resonances that tell one vowel
    // from another, in Hz: Peterson and Barney's 1952 averages for men's
    // voices. Higher voices are scaled up by FORMANT_LIFT.
    const VOWELS = [[270, 2290], [390, 1990], [530, 1840], [660, 1720], [730, 1090],
        [570, 840], [440, 1020], [300, 870], [640, 1190], [490, 1350]];
    const FORMANT_LIFT = 1.15;

    /** A band-pass filter's coefficients [b0, b2, a1, a2] (b1 is 0, a0 1). */
    function bandpass(f, q, sr) {
        const w = 2 * Math.PI * f / sr, al = Math.sin(w) / (2 * q), a0 = 1 + al;
        return [al / a0, -al / a0, -2 * Math.cos(w) / a0, (1 - al) / a0];
    }

    /**
     * Conversation too far off to make out. Each syllable is a buzz at the
     * speaker's pitch (a sawtooth with a little breath in it) through two
     * resonances that glide from one vowel to the next, swelling and fading
     * over a tenth to a quarter of a second; a phrase's pitch falls towards
     * its end, as speech does. Syllables wrap round the loop like patter's
     * drops, so it has no seam.
     */
    function babble(ctx, o) {
        const sr = BABBLE_SR, len = Math.floor(sr * o.seconds);
        const buf = ctx.createBuffer(2, len, sr);
        const L = buf.getChannelData(0), R = buf.getChannelData(1);
        const vowel = () => VOWELS[Math.floor(Math.random() * VOWELS.length)];
        for (let v = 0; v < o.voices; v++) {
            const high = Math.random() < 0.5;
            const pitch = high ? rand(175, 235) : rand(95, 140);
            const lift = high ? FORMANT_LIFT : 1;
            const loud = 0.25 + 0.75 * Math.pow(Math.random(), 1.5);   // most of them further off
            const side = Math.random() * Math.PI / 2;
            const gl = Math.cos(side) * loud, gr = Math.sin(side) * loud;
            let t = Math.floor(Math.random() * len), talked = 0;
            while (talked < len * o.talk) {
                const syllables = 2 + Math.floor(Math.random() * 10);
                const tune = rand(0.9, 1.15);
                let from = vowel();
                for (let n = 0; n < syllables; n++) {
                    const dur = Math.floor(rand(0.11, 0.26) * sr);
                    const to = vowel();
                    const f0a = pitch * tune * (1 - 0.12 * n / syllables), f0b = f0a * rand(0.92, 1.06);
                    let phase = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0, w1 = 0, w2 = 0, c1 = null, c2 = null;
                    for (let i = 0; i < dur; i++) {
                        const k = i / dur;
                        if ((i & 31) === 0) {
                            c1 = bandpass((from[0] + (to[0] - from[0]) * k) * lift, 6, sr);
                            c2 = bandpass((from[1] + (to[1] - from[1]) * k) * lift, 9, sr);
                        }
                        phase += (f0a + (f0b - f0a) * k) / sr;
                        if (phase >= 1) phase -= 1;
                        const x = 2 * phase - 1 + (Math.random() * 2 - 1) * 0.3;
                        const a = c1[0] * x + c1[1] * x2 - c1[2] * y1 - c1[3] * y2;
                        const b = c2[0] * x + c2[1] * x2 - c2[2] * w1 - c2[3] * w2;
                        x2 = x1; x1 = x; y2 = y1; y1 = a; w2 = w1; w1 = b;
                        const env = Math.sin(Math.PI * k);
                        const val = (a + 0.6 * b) * env * env;
                        const at = (t + i) % len;
                        L[at] += val * gl;
                        R[at] += val * gr;
                    }
                    t += dur + Math.floor(rand(0, 0.05) * sr);
                    talked += dur;
                    from = to;
                }
                t += Math.floor(rand(0.4, 2.5) * sr);    // listening, or a sip of coffee
            }
        }
        settle(L, R);
        return buf;
    }

    function Ambience() {
        this.ctx = null;
        this.master = null;
        this.voice = null;      // { key, nodes, out, events }
        this.level = 0.5;
        this.tick = 0;
        this.noise = {};
    }

    Ambience.prototype.ensure = function() {
        if (this.ctx) return this.ctx;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0;
        // A limiter after the volume, so a loud cluster of crackles or a
        // near bird at full volume is held under clipping.
        const limit = this.ctx.createDynamicsCompressor();
        limit.threshold.value = -6;
        limit.knee.value = 4;
        limit.ratio.value = 12;
        limit.attack.value = 0.003;
        limit.release.value = 0.25;
        // Synthetic noise is brighter than a recording; a shelf takes the
        // hiss out of the top octaves.
        const shelf = this.ctx.createBiquadFilter();
        shelf.type = 'highshelf';
        shelf.frequency.value = 7000;
        shelf.gain.value = -8;
        this.master.connect(shelf);
        shelf.connect(limit);
        limit.connect(this.ctx.destination);
        this.output = limit;
        return this.ctx;
    };

    /** A looping stereo buffer: 8 seconds of white, pink or brown noise,
        or a rain texture (TEXTURES). */
    Ambience.prototype.buffer = function(kind) {
        if (this.noise[kind]) return this.noise[kind];
        if (TEXTURES[kind]) {
            this.noise[kind] = patter(this.ctx, TEXTURES[kind]);
            return this.noise[kind];
        }
        if (BABBLES[kind]) {
            this.noise[kind] = babble(this.ctx, BABBLES[kind]);
            return this.noise[kind];
        }
        const ctx = this.ctx, len = Math.floor(ctx.sampleRate * NOISE_SECONDS);
        const buf = ctx.createBuffer(2, len, ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const d = buf.getChannelData(ch);
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
            for (let i = 0; i < len; i++) {
                const w = Math.random() * 2 - 1;
                if (kind === 'white') d[i] = w * 0.5;
                else if (kind === 'pink') {
                    // Paul Kellet's filter: -3 dB per octave.
                    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
                    b2 = 0.96900 * b2 + w * 0.1538520; b3 = 0.86650 * b3 + w * 0.3104856;
                    b4 = 0.55000 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.0168980;
                    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
                    b6 = w * 0.115926;
                } else {
                    // Brown: integrated white, leaking back to zero.
                    last = (last + 0.02 * w) / 1.02;
                    d[i] = last * 3.5;
                }
            }
            // Fade the seam so the loop point does not click.
            const fade = Math.floor(ctx.sampleRate * 0.05);
            for (let i = 0; i < fade; i++) {
                const k = i / fade;
                d[len - fade + i] = d[len - fade + i] * (1 - k) + d[i] * k;
            }
        }
        this.noise[kind] = buf;
        return buf;
    };

    Ambience.prototype.loop = function(kind, out) {
        const src = this.ctx.createBufferSource();
        const buf = this.buffer(kind);
        src.buffer = buf;
        src.loop = true;
        // A noise buffer's last 50 ms are faded into its first (buffer());
        // a texture wraps by itself.
        src.loopStart = TEXTURES[kind] || BABBLES[kind] ? 0 : 0.05;
        src.loopEnd = buf.duration;
        src.connect(out);
        src.start(this.ctx.currentTime, Math.random() * (buf.duration - 1));
        return src;
    };

    Ambience.prototype.filter = function(type, freq, q, out) {
        const f = this.ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        if (q != null) f.Q.value = q;
        f.connect(out);
        return f;
    };

    Ambience.prototype.gain = function(value, out) {
        const g = this.ctx.createGain();
        g.gain.value = value;
        g.connect(out);
        return g;
    };

    Ambience.prototype.pan = function(value, out) {
        if (!this.ctx.createStereoPanner) return out;
        const p = this.ctx.createStereoPanner();
        p.pan.value = value;
        p.connect(out);
        return p;
    };

    /** Send a sound's event out at a place between the speakers, and into
        the sound's room if it has one (a café's echo, a street's). */
    Ambience.prototype.place = function(node, pan) {
        node.connect(this.pan(pan, this.voice.out));
        if (this.voice.send) node.connect(this.voice.send);
    };

    /** A room's echo: noise dying away over `seconds`, different in each
        ear, through a convolver. Made once per length. */
    Ambience.prototype.room = function(seconds, out) {
        const key = 'room-' + seconds;
        if (!this.noise[key]) {
            const sr = this.ctx.sampleRate, len = Math.floor(sr * seconds);
            const ir = this.ctx.createBuffer(2, len, sr);
            for (let ch = 0; ch < 2; ch++) {
                const d = ir.getChannelData(ch);
                for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-6 * i / len);
            }
            this.noise[key] = ir;
        }
        const conv = this.ctx.createConvolver();
        conv.buffer = this.noise[key];
        conv.connect(out);
        return conv;
    };

    /** Something struck that rings: a cup, a spoon, a glass. Partials at
        o.ratios of o.f, each quieter and shorter than the one below. */
    Ambience.prototype.ring = function(at, o) {
        const ctx = this.ctx, env = ctx.createGain();
        this.place(env, o.pan || 0);
        o.ratios.forEach((r, i) => {
            const osc = ctx.createOscillator(), g = ctx.createGain();
            const end = at + o.decay / (1 + i * 0.6);
            osc.frequency.value = o.f * r;
            g.gain.setValueAtTime(0, at);
            g.gain.linearRampToValueAtTime(o.gain / (i + 1), at + 0.002);
            g.gain.exponentialRampToValueAtTime(0.0001, end);
            osc.connect(g);
            g.connect(env);
            osc.start(at);
            osc.stop(end + 0.05);
        });
    };

    /** A stretch of looped noise through a filter and an envelope, for the
        longer events (steam, cars); returns the parts to shape. */
    Ambience.prototype.noiseEvent = function(kind, at, dur, filterType) {
        const ctx = this.ctx;
        const f = ctx.createBiquadFilter();
        f.type = filterType;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, at);
        f.connect(env);
        const src = ctx.createBufferSource();
        src.buffer = this.buffer(kind);
        src.loop = true;
        src.connect(f);
        src.start(at, Math.random() * (NOISE_SECONDS - 1));
        src.stop(at + dur + 0.1);
        return { filter: f, env: env };
    };

    /** The espresso machine's steam wand: a hiss that rises in pitch as
        the milk heats, gurgling as it goes. */
    Ambience.prototype.steam = function(at) {
        const dur = rand(4, 8);
        const n = this.noiseEvent('white', at, dur, 'bandpass');
        n.filter.Q.value = 0.8;
        n.filter.frequency.setValueAtTime(rand(2500, 3500), at);
        n.filter.frequency.linearRampToValueAtTime(rand(4000, 6000), at + dur);
        n.env.gain.exponentialRampToValueAtTime(rand(0.05, 0.08), at + 0.3);
        for (let t = at + 0.6; t < at + dur - 0.6; t += rand(0.15, 0.5)) {
            n.env.gain.linearRampToValueAtTime(rand(0.03, 0.08), t);
        }
        n.env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        this.place(n.env, rand(-0.5, 0.5));
    };

    /** A car going by: road noise that swells and brightens as it nears,
        crosses from one side to the other, and fades as it goes. */
    Ambience.prototype.passBy = function(at) {
        const ctx = this.ctx, far = Math.random(), dur = 3 + far * 5;
        const mid = at + dur * rand(0.4, 0.6), dir = chance(0.5) ? -1 : 1, width = 0.85 * (1 - far * 0.5);
        const n = this.noiseEvent('pink', at, dur, 'lowpass');
        n.filter.Q.value = 0.6;
        n.filter.frequency.setValueAtTime(250, at);
        n.filter.frequency.exponentialRampToValueAtTime(2200 - far * 1500, mid);
        n.filter.frequency.exponentialRampToValueAtTime(250, at + dur);
        n.env.gain.exponentialRampToValueAtTime(2 * (1 - far * 0.7), mid);
        n.env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        if (ctx.createStereoPanner) {
            const p = ctx.createStereoPanner();
            p.pan.setValueAtTime(-width * dir, at);
            p.pan.linearRampToValueAtTime(width * dir, at + dur);
            p.connect(this.voice.out);
            n.env.connect(p);
            if (this.voice.send) n.env.connect(this.voice.send);
        } else {
            this.place(n.env, 0);
        }
    };

    /** Someone walking past: heels on the pavement, louder as they pass. */
    Ambience.prototype.footsteps = function(at) {
        const n = 8 + Math.floor(rand(0, 10)), step = rand(0.45, 0.6), dir = chance(0.5) ? -1 : 1, gain = rand(0.15, 0.35);
        for (let i = 0; i < n; i++) {
            const k = i / (n - 1);
            this.burst(at + i * step + rand(-0.02, 0.02), { freq: rand(1800, 2600), q: 1.5,
                gain: gain * (0.3 + 0.7 * Math.sin(Math.PI * k)), decay: rand(0.03, 0.06), pan: dir * (k * 1.6 - 0.8) });
        }
    };

    /** A car horn a street or two away: two notes a third apart, once or twice. */
    Ambience.prototype.horn = function(at) {
        const ctx = this.ctx, f = rand(330, 420);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = rand(900, 1500);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, at);
        lp.connect(g);
        this.place(g, rand(-0.7, 0.7));
        let t = at;
        for (let h = chance(0.4) ? 2 : 1; h > 0; h--) {
            const len = rand(0.15, 0.45), level = rand(0.05, 0.1);
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(level, t + 0.02);
            g.gain.setValueAtTime(level, t + len - 0.03);
            g.gain.linearRampToValueAtTime(0, t + len);
            t += len + rand(0.1, 0.2);
        }
        [f, f * 1.26].forEach(fr => {
            const o = ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = fr;
            o.connect(lp);
            o.start(at);
            o.stop(t + 0.05);
        });
    };

    /** A siren a long way off: a wail rising and falling, coming and going. */
    Ambience.prototype.siren = function(at) {
        const ctx = this.ctx, dur = rand(9, 16), lo = rand(600, 700), hi = lo * rand(1.7, 1.9), cycle = rand(2.5, 4);
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(lo, at);
        for (let t = at; t < at + dur; t += cycle) {
            osc.frequency.linearRampToValueAtTime(hi, t + cycle * 0.5);
            osc.frequency.linearRampToValueAtTime(lo, t + cycle);
        }
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1400;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(rand(0.04, 0.07), at + dur * 0.4);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        osc.connect(lp);
        lp.connect(g);
        this.place(g, rand(-0.6, 0.6));
        osc.start(at);
        osc.stop(at + dur + 0.05);
    };

    /** A short burst of filtered noise: one drop, one crackle. */
    Ambience.prototype.burst = function(at, o) {
        const ctx = this.ctx;
        const env = ctx.createGain();
        env.gain.setValueAtTime(0, at);
        env.gain.linearRampToValueAtTime(o.gain, at + (o.attack || 0.001));
        env.gain.exponentialRampToValueAtTime(0.0001, at + (o.attack || 0.001) + o.decay);
        this.place(env, o.pan || 0);
        const f = this.filter(o.type || 'bandpass', o.freq, o.q, env);
        const src = ctx.createBufferSource();
        src.buffer = this.buffer(o.noise || 'white');
        src.connect(f);
        const len = (o.attack || 0.001) + o.decay + 0.02;
        src.start(at, Math.random() * (NOISE_SECONDS - 1), len);
    };

    /** A bird's note: a sine swept from one pitch to another. */
    Ambience.prototype.chirp = function(at, o) {
        const ctx = this.ctx;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(o.from, at);
        osc.frequency.exponentialRampToValueAtTime(o.to, at + o.dur);
        if (o.vibrato) {
            const lfo = ctx.createOscillator(), depth = ctx.createGain();
            lfo.frequency.value = o.vibrato;
            depth.gain.value = o.from * 0.03;
            lfo.connect(depth);
            depth.connect(osc.frequency);
            lfo.start(at);
            lfo.stop(at + o.dur + 0.05);
        }
        env.gain.setValueAtTime(0, at);
        env.gain.linearRampToValueAtTime(o.gain, at + Math.min(0.02, o.dur / 4));
        env.gain.setValueAtTime(o.gain, at + o.dur * 0.6);
        env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
        osc.connect(env);
        env.connect(this.pan(o.pan || 0, this.voice.out));
        osc.start(at);
        osc.stop(at + o.dur + 0.05);
    };

    /**
     * Thunder. A strike close by starts with a crack, a few bursts of high
     * noise; then, near or far, a rumble of brown noise that swells and
     * sags for several seconds as the sound arrives from different parts
     * of the bolt, darker and longer the further away it is.
     */
    Ambience.prototype.thunder = function(at) {
        const ctx = this.ctx, far = Math.random(), near = far < 0.3;
        const dur = 5 + far * 7;
        const side = rand(-0.6, 0.6);
        if (near) {
            for (let i = 0, t = at, n = 3 + Math.floor(rand(0, 3)); i < n; i++, t += rand(0.03, 0.12)) {
                this.burst(t, { type: 'highpass', freq: rand(800, 2000), q: 0.5, gain: rand(0.3, 0.6), decay: rand(0.12, 0.35), pan: side });
            }
        }
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.Q.value = 0.7;
        lp.frequency.setValueAtTime(near ? 700 : 380 - far * 180, at);
        lp.frequency.exponentialRampToValueAtTime(70, at + dur);
        const env = ctx.createGain();
        const peak = (near ? 3.2 : 2.4) * (1 - far * 0.45);
        const start = at + (near ? rand(0.1, 0.3) : 0);
        env.gain.setValueAtTime(0.0001, at);
        env.gain.exponentialRampToValueAtTime(peak, start + rand(0.25, 0.8));
        for (let t = start + 1; t < at + dur * 0.75; t += rand(0.3, 1.1)) {
            env.gain.exponentialRampToValueAtTime(peak * rand(0.25, 0.95), t);
        }
        env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
        lp.connect(env);
        env.connect(this.pan(side, this.voice.out));
        const src = ctx.createBufferSource();
        src.buffer = this.buffer('brown');
        src.loop = true;
        src.connect(lp);
        src.start(at, Math.random() * (NOISE_SECONDS - 1));
        src.stop(at + dur + 0.1);
    };

    const rand = (a, b) => a + Math.random() * (b - a);
    const chance = p => Math.random() < p;

    /** A drop close by, or one off a roof: a short ring that rises. */
    function bigDrop(a, at, gain) {
        const f = rand(900, 2200);
        a.chirp(at, { from: f, to: f * rand(1.3, 2), dur: rand(0.025, 0.06), gain: gain, pan: rand(-0.8, 0.8) });
    }

    // The sounds. bed() starts the steady part and returns its
    // nodes; events(from, to) books what happens between two audio times;
    // drift() runs every tick to move the bed (gusts, flicker). level
    // brings each to the same loudness, about 0.2 RMS before the volume
    // (measured in the browser), so switching sounds keeps the volume.
    const VOICES = {
        rain: {
            level: 2.5,
            bed(a, out) {
                const near = a.gain(0.9, out);
                const far = a.gain(0.7, out);
                const farLp = a.filter('lowpass', 3400, 0.5, far);
                // A little wash under the drops, for the rain too far off to
                // hear as drops at all.
                const wash = a.gain(0.05, out);
                const washLp = a.filter('lowpass', 2400, 0.5, wash);
                const washHp = a.filter('highpass', 400, 0.5, washLp);
                return { far: far, wash: wash, nodes: [a.loop('near', near), a.loop('far', farLp), a.loop('pink', washHp)] };
            },
            drift(a, v, now) {
                // The shower comes and goes a little.
                if (chance(0.03)) {
                    const k = rand(0.65, 1.15), tc = rand(2, 5);
                    v.bed.far.gain.setTargetAtTime(0.7 * k, now, tc);
                    v.bed.wash.gain.setTargetAtTime(0.05 * k, now, tc);
                }
            },
            events(a, from, to) {
                // A big drop close by now and then, about one a second.
                for (let t = from + rand(0, 1.2); t < to; t += rand(0.4, 2)) bigDrop(a, t, rand(0.05, 0.18));
            }
        },
        storm: {
            level: 1.8,
            bed(a, out) {
                const near = a.gain(0.9, out);
                const far = a.gain(0.9, out);
                const farLp = a.filter('lowpass', 3000, 0.5, far);
                const wash = a.gain(0.14, out);
                const washLp = a.filter('lowpass', 1800, 0.5, wash);
                const washHp = a.filter('highpass', 250, 0.5, washLp);
                const wind = a.gain(0.2, out);
                const windLp = a.filter('lowpass', 260, 0.7, wind);
                return { far: far, wash: wash, wind: wind,
                    nodes: [a.loop('heavy', near), a.loop('far', farLp), a.loop('pink', washHp), a.loop('brown', windLp)] };
            },
            drift(a, v, now) {
                // Gusts: the wind and the wash of rain rise and fall together.
                if (chance(0.04)) {
                    const k = rand(0.6, 1.3), tc = rand(1.5, 4);
                    v.bed.wash.gain.setTargetAtTime(0.14 * k, now, tc);
                    v.bed.wind.gain.setTargetAtTime(0.2 * k, now, tc);
                    v.bed.far.gain.setTargetAtTime(0.9 * Math.sqrt(k), now, tc);
                }
            },
            events(a, from, to) {
                for (let t = from + rand(0, 0.8); t < to; t += rand(0.25, 1.2)) bigDrop(a, t, rand(0.05, 0.2));
                // The first thunder a few seconds in, so it is heard; then
                // every half minute or so.
                const v = a.voice;
                if (v.nextThunder == null) v.nextThunder = from + rand(4, 9);
                if (v.nextThunder < to) {
                    a.thunder(Math.max(from, v.nextThunder));
                    v.nextThunder += rand(18, 45);
                }
            }
        },
        fire: {
            level: 2.7,
            bed(a, out) {
                const roar = a.gain(0.5, out);
                const lp = a.filter('lowpass', 420, 0.7, roar);
                const hiss = a.gain(0.025, out);
                const bp = a.filter('bandpass', 3200, 0.6, hiss);
                return { roar: roar, nodes: [a.loop('brown', lp), a.loop('white', bp)] };
            },
            drift(a, v, now) {
                // The flames breathe: the roar wanders every tick.
                v.bed.roar.gain.setTargetAtTime(rand(0.3, 0.75), now, rand(0.15, 0.6));
            },
            events(a, from, to) {
                let t = from + rand(0, 0.2);
                while (t < to) {
                    // A crackle is a cluster of tiny snaps; between them, quiet.
                    const snaps = chance(0.25) ? Math.floor(rand(4, 12)) : Math.floor(rand(1, 4));
                    let s = t;
                    for (let i = 0; i < snaps; i++) {
                        a.burst(s, { type: 'highpass', freq: rand(1200, 4200), q: 0.7, gain: rand(0.08, 0.45), decay: rand(0.004, 0.022), pan: rand(-0.5, 0.5) });
                        s += rand(0.008, 0.06);
                    }
                    if (chance(0.08)) {
                        a.burst(s + rand(0.05, 0.2), { freq: rand(250, 700), q: 2, gain: rand(0.25, 0.5), decay: rand(0.03, 0.08), pan: rand(-0.4, 0.4) });
                    }
                    t = s + rand(0.05, 0.5);
                }
            }
        },
        forest: {
            level: 1,
            bed(a, out) {
                const wind = a.gain(3, out);
                const bp = a.filter('bandpass', 600, 0.8, wind);
                const leaves = a.gain(0.1, out);
                const hp = a.filter('highpass', 3800, 0.5, leaves);
                return { wind: wind, windFilter: bp, leaves: leaves, nodes: [a.loop('pink', bp), a.loop('white', hp)] };
            },
            drift(a, v, now) {
                if (chance(0.03)) {
                    const level = rand(1.5, 5), tc = rand(2, 5);
                    v.bed.wind.gain.setTargetAtTime(level, now, tc);
                    v.bed.leaves.gain.setTargetAtTime(level * 0.03, now, tc);
                    v.bed.windFilter.frequency.setTargetAtTime(rand(350, 1100), now, tc);
                }
            },
            events(a, from, to) {
                // A bird every few seconds, each one a call of its own.
                if (!chance((to - from) / 4.5)) return;
                const at = rand(from, to), pan = rand(-0.85, 0.85), gain = rand(0.2, 0.55);
                const kind = Math.random();
                if (kind < 0.45) {
                    // Chirps: a few short notes, each swept.
                    const f = rand(2600, 5200), n = Math.floor(rand(2, 7)), dur = rand(0.06, 0.13);
                    for (let i = 0, t = at; i < n; i++, t += dur + rand(0.05, 0.14)) {
                        a.chirp(t, { from: f * rand(0.95, 1.05), to: f * rand(0.7, 1.3), dur: dur, gain: gain, pan: pan });
                    }
                } else if (kind < 0.8) {
                    // A whistle: two longer notes, falling, with a little vibrato.
                    const f = rand(1800, 3200);
                    a.chirp(at, { from: f, to: f * rand(1.05, 1.2), dur: rand(0.22, 0.38), gain: gain, pan: pan, vibrato: rand(5, 9) });
                    a.chirp(at + rand(0.35, 0.55), { from: f * 1.1, to: f * rand(0.75, 0.9), dur: rand(0.25, 0.45), gain: gain * 0.9, pan: pan, vibrato: rand(5, 9) });
                } else {
                    // A trill: fast notes that rise and fall.
                    const f = rand(3500, 5500), n = Math.floor(rand(10, 24));
                    for (let i = 0, t = at; i < n; i++, t += 0.032) {
                        a.chirp(t, { from: f + (i % 2 ? 250 : -250), to: f + (i % 2 ? -150 : 150), dur: 0.026, gain: gain * 0.8, pan: pan });
                    }
                }
            }
        },
        river: {
            level: 1.8,
            bed(a, out) {
                // Bubbling low and high, over the rush of the water and a deep roll.
                const low = a.gain(0.9, out);
                const high = a.gain(0.45, out);
                const rush = a.gain(0.35, out);
                const rushLp = a.filter('lowpass', 900, 0.5, rush);
                const deep = a.gain(0.5, out);
                const deepLp = a.filter('lowpass', 180, 0.7, deep);
                return { rush: rush, high: high,
                    nodes: [a.loop('river', low), a.loop('brook', high), a.loop('pink', rushLp), a.loop('brown', deepLp)] };
            },
            drift(a, v, now) {
                if (chance(0.03)) {
                    const tc = rand(2, 6);
                    v.bed.rush.gain.setTargetAtTime(rand(0.25, 0.45), now, tc);
                    v.bed.high.gain.setTargetAtTime(rand(0.3, 0.55), now, tc);
                }
            },
            events(a, from, to) {
                // A deeper gloop every few seconds, where the water folds over a stone.
                if (chance((to - from) / 3)) {
                    const f = rand(180, 400);
                    a.chirp(rand(from, to), { from: f, to: f * rand(1.6, 2.4), dur: rand(0.05, 0.1), gain: rand(0.15, 0.35), pan: rand(-0.7, 0.7) });
                }
            }
        },
        cafe: {
            level: 2,
            bed(a, out) {
                // Everything goes through a small room's echo as well.
                const send = a.gain(1, a.room(1.2, a.gain(0.3, out)));
                a.voice.send = send;
                const near = a.gain(0.8, out);
                near.connect(send);
                const far = a.gain(0.6, out);
                far.connect(send);
                const farLp = a.filter('lowpass', 1600, 0.6, far);
                const tone = a.gain(0.4, out);
                const toneLp = a.filter('lowpass', 250, 0.7, tone);
                return { near: near, nodes: [a.loop('chatter', near), a.loop('crowd', farLp), a.loop('brown', toneLp)] };
            },
            drift(a, v, now) {
                // The nearer tables get louder and quieter.
                if (chance(0.03)) v.bed.near.gain.setTargetAtTime(rand(0.55, 1), now, rand(2, 5));
            },
            events(a, from, to) {
                // A cup, a spoon or a glass every couple of seconds.
                if (chance((to - from) / 2)) {
                    const t = rand(from, to), pan = rand(-0.8, 0.8), kind = Math.random();
                    if (kind < 0.45) {
                        // A spoon stirring against a cup: a few quick tinks.
                        const f = rand(2800, 4200);
                        for (let i = 0, n = 2 + Math.floor(rand(0, 4)); i < n; i++) {
                            a.ring(t + i * rand(0.12, 0.2), { f: f * rand(0.97, 1.03), ratios: [1, 2.4], decay: 0.12, gain: rand(0.03, 0.08), pan: pan });
                        }
                    } else if (kind < 0.85) {
                        // A cup set down on its saucer.
                        a.ring(t, { f: rand(1300, 2400), ratios: [1, 2.32, 4.25], decay: rand(0.25, 0.5), gain: rand(0.05, 0.1), pan: pan });
                    } else {
                        // A glass.
                        a.ring(t, { f: rand(1800, 3000), ratios: [1, 2.9, 5.1], decay: rand(0.6, 1.1), gain: rand(0.03, 0.06), pan: pan });
                    }
                }
                // The steam wand, a little while in and then every minute or two.
                const v = a.voice;
                if (v.nextSteam == null) v.nextSteam = from + rand(15, 40);
                if (v.nextSteam < to) {
                    a.steam(Math.max(from, v.nextSteam));
                    v.nextSteam += rand(60, 150);
                }
            }
        },
        city: {
            level: 1.5,
            bed(a, out) {
                // Traffic too far off to hear as cars, and the city's hum; a
                // street's echo for what happens nearer.
                a.voice.send = a.gain(1, a.room(2.2, a.gain(0.25, out)));
                const rumble = a.gain(1.2, out);
                const rumbleLp = a.filter('lowpass', 160, 0.7, rumble);
                const hum = a.gain(0.12, out);
                const humBp = a.filter('bandpass', 450, 0.9, hum);
                return { rumble: rumble, hum: hum, nodes: [a.loop('brown', rumbleLp), a.loop('pink', humBp)] };
            },
            drift(a, v, now) {
                if (chance(0.02)) {
                    const tc = rand(3, 8);
                    v.bed.rumble.gain.setTargetAtTime(rand(0.8, 1.5), now, tc);
                    v.bed.hum.gain.setTargetAtTime(rand(0.08, 0.16), now, tc);
                }
            },
            events(a, from, to) {
                const v = a.voice, span = to - from;
                if (chance(span / 7)) a.passBy(rand(from, to));           // a car every seven seconds or so
                if (chance(span / 70)) a.footsteps(rand(from, to));
                if (chance(span / 120)) a.horn(rand(from, to));
                // A siren a minute or so in, then every few minutes.
                if (v.nextSiren == null) v.nextSiren = from + rand(60, 150);
                if (v.nextSiren < to) {
                    a.siren(Math.max(from, v.nextSiren));
                    v.nextSiren += rand(180, 420);
                }
            }
        }
    };

    /** Start a sound (or switch to it). Resolves true once it is audible. */
    Ambience.prototype.play = function(key, level) {
        const ctx = this.ensure();
        if (!ctx || !VOICES[key]) return Promise.resolve(false);
        this.level = level;
        if (!this.voice || this.voice.key !== key) {
            this.release();
            const out = this.gain(VOICES[key].level, this.master);
            this.voice = { key: key, out: out, until: ctx.currentTime };
            this.voice.bed = VOICES[key].bed(this, out);
        }
        clearInterval(this.tick);
        this.tick = setInterval(() => this.book(), TICK_MS);
        // A browser that holds sound until a click leaves resume() pending,
        // so it gets a moment and no more.
        const wait = new Promise(r => setTimeout(r, 400));
        return Promise.race([ctx.resume().catch(() => {}), wait]).then(() => {
            const running = ctx.state === 'running';
            if (running) this.ramp(this.level, 2.5);
            return running;
        });
    };

    Ambience.prototype.book = function() {
        const v = this.voice, ctx = this.ctx;
        if (!v || ctx.state !== 'running') return;
        const now = ctx.currentTime;
        VOICES[v.key].drift(this, v, now);
        const from = Math.max(v.until, now + 0.05), to = now + AHEAD;
        if (to > from) VOICES[v.key].events(this, from, to);
        v.until = Math.max(v.until, to);
    };

    Ambience.prototype.ramp = function(level, seconds) {
        if (!this.ctx) return;
        const g = this.master.gain, now = this.ctx.currentTime;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        // Perceived loudness: the slider's square, kept under full scale.
        g.linearRampToValueAtTime(level * level * 0.8, now + seconds);
    };

    Ambience.prototype.volume = function(level) {
        this.level = level;
        if (this.voice) this.ramp(level, 0.15);
    };

    Ambience.prototype.release = function() {
        const v = this.voice;
        if (!v) return;
        const at = this.ctx.currentTime + 0.7;
        v.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
        setTimeout(() => {
            v.bed.nodes.forEach(n => { try { n.stop(); } catch (e) {} });
            v.out.disconnect();
        }, Math.max(0, (at - this.ctx.currentTime) * 1000) + 100);
        this.voice = null;
    };

    Ambience.prototype.stop = function() {
        clearInterval(this.tick);
        this.release();
        if (this.ctx) {
            this.ramp(0, 0.6);
            const ctx = this.ctx;
            setTimeout(() => { if (!this.voice) ctx.suspend().catch(() => {}); }, 800);
        }
    };

    window.krAmbience = new Ambience();
    window.krSlideshow = { open: open, readSettings: readSettings, settingsQuery: settingsQuery };

    // slideshow.html: the whole page is the slideshow, set up from its address.
    if (document.documentElement.hasAttribute('data-slideshow-page')) {
        const boot = () => open({ standalone: true, settings: readSettings(window.location.search) });
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
        else boot();
    }
})();
