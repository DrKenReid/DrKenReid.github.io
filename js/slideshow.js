/**
 * slideshow.js: the photographs one at a time, full screen, with an
 * optional sound of a fire, rain or a forest underneath; or the same for
 * the places, the quotes, the books and the albums.
 *
 * Two ways in
 *   The Slideshow link in a page's banner (.kr-opener-play: the gallery,
 *   the photo map, the quote wall, every book, music) opens it over the
 *   page and asks for full screen on the same click (krOpenSlideshow in
 *   shared-components.js; the gallery's passes its filter). slideshow.html
 *   is the same slideshow as a page of its own, set up entirely from its
 *   address: for a browser in full screen (F11), or for a desktop
 *   wallpaper app that shows a web page (Lively Wallpaper on Windows), or
 *   an iframe.
 *
 * What to show (show=, the first menu in the settings; MODES below)
 *   photos    the photographs (the default)
 *   places    a tour: a dark map flies from place to place, nearest next,
 *             each stop named and then a few of its photographs (per=)
 *   quotes    data/quotes-all.json, one at a time over one of my
 *             photographs, blurred and darkened (behind=plain: none);
 *             a long quote stays up long enough to read
 *   books     every book I have rated in data/books.json, its cover (the
 *             one Goodreads shows, c; Open Library's by ISBN if that
 *             fails; one set in type if both do) in front of a drifting
 *             wall of covers, with the rating and when I read it
 *   music     the albums I have played most lately (data/topalbums.json,
 *             refreshed weekly), the same way, on a wall of sleeves
 *   Everything else (sound, sleep, clock, dimming, the details, the
 *   controls) is shared. Switching kind resets the settings that belong
 *   to the last one (OWN_KEYS), so a link carries only its own.
 *
 * The address (every setting is in it, so a link is the whole slideshow)
 *   show=     photos (the default) | places | quotes | books | music
 *   author=   quotes: one author's
 *   behind=   quotes: photos (the default) | plain
 *   year=     books: the year I read them
 *   rating=   books: this many stars or more (1 to 5)
 *   per=      places: photographs at each stop (default 4)
 *   tag=      a subject, a KR_PHOTO_CATEGORIES key, as the gallery's ?tag=
 *   place=    a region name from data/photo-locations.json
 *   added=    a photoset, "<from>-<to>" from data/photosets.json, or
 *             "earlier" for the frames from before the first set
 *   order=    shuffle (the default) | newest | oldest (photographs and
 *             books) | top (music: most played first)
 *   every=    seconds per photograph (default 20)
 *   sound=    off (the default) | fire | rain | storm (rain and thunder) |
 *             forest | river | cafe | city (a city at night)
 *   volume=   0 to 100 (default 50)
 *   fit=      whole (the default: the whole frame over a blurred copy of
 *             itself) | fill (cropped to fill the screen)
 *   drift=0   no slow zoom
 *   captions=0  no place line
 *   controls=off  never show the controls (a wallpaper); the keys still work
 *   pool=all  every photograph, not only the selection the homepage's
 *             photo strip draws from (data/photography-standard-files.json,
 *             which leaves out most portraits of people)
 *   sleep=    minutes after which the sound fades out (SLEEPS; 0, never,
 *             is the default)
 *   info=1    show each photograph's details (number, place, subjects,
 *             when it was added, a link to it in the gallery)
 *   dim=      darken the photographs by this percentage (DIMS)
 *   clock=1   show the time and date, top right
 *   Values that mean nothing (a subject with no photographs, an unknown
 *   place) are dropped rather than showing an empty screen, and when the
 *   selection has nothing for the other filters (Portrait, say), every
 *   photograph is used instead.
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
 *   photoset, and a shuffle is dealt afresh. Under fit=fill, a photograph
 *   whose shape is more than FILL_RATIO away from the screen's (a portrait
 *   on a wide monitor) is left out, as filling the screen would crop most
 *   of it; the deck is dealt again when the screen turns between landscape
 *   and portrait. Both sizes are asked for with ?slideshow on the end,
 *   which sw.js leaves to the browser's own cache: a slideshow runs through
 *   hundreds of photographs, and the worker's image cache, capped at a few
 *   hundred, would lose the pictures of every post saved to read offline.
 *
 * Sound
 *   Recordings under free licences (SOUNDS, with whose each is), each a
 *   stretch of one cross-faded into a seamless loop of 25 to 96 seconds
 *   and levelled to the same loudness, played with the Web Audio API
 *   (krAmbience, below). A loop is fetched only when its sound is chosen.
 *   The settings panel credits the recordings, as CC BY requires.
 *   Browsers allow sound only after a click or a key press on the page, so
 *   when a link asks for sound= the slideshow says it is waiting for one;
 *   a wallpaper app may allow it from the start. sleep= fades the sound out
 *   over SLEEP_FADE seconds once its minutes are up, and turns it off.
 *
 * Lively Wallpaper
 *   wallpaper/kenreid-slideshow-lively.zip, built by
 *   .github/scripts/build_lively_package.py, is a Lively wallpaper: a page
 *   that shows this one in a frame, with a Customise menu for these
 *   settings. The settings panel links to it.
 *
 * Accessibility
 *   Over the gallery it is a modal dialog: the page behind is inert and
 *   focus returns to the button on close. The controls are buttons with
 *   action labels (Pause slideshow / Play slideshow), shown when the mouse
 *   moves or a key is pressed and hidden again (.kr-offstage) after IDLE_MS
 *   with the pointer, so they leave the Tab order when they leave the
 *   screen. A mouse resting on them keeps them up. On a touch screen a tap
 *   on the photograph shows them and the next tap hides them. The settings
 *   panel closes by itself after PANEL_IDLE_MS without a move, a tap or a
 *   key. The photographs change on their own, so nothing is announced
 *   then; a change the viewer asks for (next, previous) is announced in a
 *   hidden polite region. Space pauses, the arrow keys step, F toggles full
 *   screen, M the sound, I the details, Escape closes the settings and then
 *   the slideshow. The details are a region of their own, never announced
 *   when the photograph changes by itself; the clock and the caption are
 *   decoration (aria-hidden), the details carry the same place.
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

    // The sounds: recordings, each looped (see krAmbience below). loop is
    // the loop's length in seconds; credit says whose it is and on what
    // licence, shown in the settings panel and on the colophon.
    const SOUNDS = [
        { key: 'off', label: 'No sound' },
        { key: 'fire', label: 'Crackling fire', file: '/sounds/fire.mp3', loop: 25,
            credit: { title: 'Fireplace Sound loop', by: 'PagDev', licence: 'CC0', url: 'https://opengameart.org/content/fireplace-sound-loop' } },
        { key: 'rain', label: 'Rain', file: '/sounds/rain.mp3', loop: 76,
            credit: { title: 'Regen in de tent', by: 'luc de bruijn', licence: 'CC BY 3.0', url: 'https://commons.wikimedia.org/wiki/File:Regen_in_de_tent_-_SoundCloud_-_luc_de_bruijn.ogg' } },
        { key: 'storm', label: 'Rain and thunder', file: '/sounds/storm.mp3', loop: 96,
            credit: { title: 'Thunderstorm after hot summer day', by: 'stephan', licence: 'public domain', url: 'https://commons.wikimedia.org/wiki/File:Thunderstorm_after_hot_summer_day_17_minutes_01_of_04.ogg' } },
        { key: 'forest', label: 'Forest', file: '/sounds/forest.mp3', loop: 96,
            credit: { title: 'Dawn chorus, Shipton Gorge', by: 'Silas S. Brown', licence: 'public domain', url: 'https://commons.wikimedia.org/wiki/File:Dawnchorus-uk.ogg' } },
        { key: 'river', label: 'River', file: '/sounds/river.mp3', loop: 96,
            credit: { title: 'Forest lawn creek', by: 'Dsw4', licence: 'public domain', url: 'https://commons.wikimedia.org/wiki/File:Forest_lawn_creek.ogg' } },
        { key: 'cafe', label: 'Café', file: '/sounds/cafe.mp3', loop: 96,
            credit: { title: 'Cafe ambiance', by: 'Marble Toast', licence: 'CC0', url: 'https://commons.wikimedia.org/wiki/File:Cafe_ambiance.ogg' } },
        { key: 'city', label: 'City at night', file: '/sounds/city.mp3', loop: 96,
            credit: { title: 'Two Lane Road in Kelowna at Midnight', by: 'Extemporalist', licence: 'CC0', url: 'https://commons.wikimedia.org/wiki/File:Two_Lane_Road_in_Kelowna_at_Midnight.flac' } }
    ];
    // What the slideshow shows (show=; see "What to show" at the top).
    const SHOWS = [
        { key: 'photos', label: 'Photographs' },
        { key: 'places', label: 'A tour of the places' },
        { key: 'quotes', label: 'Quotes' },
        { key: 'books', label: 'Books I have read' },
        { key: 'music', label: 'Albums I play most' }
    ];
    const ORDERS = [
        { key: 'shuffle', label: 'Shuffled' },
        { key: 'newest', label: 'Newest first' },
        { key: 'oldest', label: 'Oldest first' }
    ];
    const BOOK_ORDERS = [
        { key: 'shuffle', label: 'Shuffled' },
        { key: 'newest', label: 'Latest read first' },
        { key: 'oldest', label: 'Earliest read first' }
    ];
    const MUSIC_ORDERS = [
        { key: 'shuffle', label: 'Shuffled' },
        { key: 'top', label: 'Most played first' }
    ];
    const SPEEDS = [8, 15, 20, 30, 60, 120, 300];
    const SLEEPS = [0, 15, 30, 45, 60, 90, 120];
    const DIMS = [0, 15, 30, 45, 60];
    // places: how many photographs each stop shows.
    const PERS = [2, 3, 4, 6, 8];
    const DEFAULTS = {
        show: 'photos', tag: '', place: '', added: '', order: 'shuffle', every: 20,
        sound: 'off', volume: 50, fit: 'whole', drift: true, captions: true,
        controls: 'auto', pool: 'selected', sleep: 0, info: false, dim: 0,
        clock: false, author: '', behind: 'photos', year: '', rating: 0, per: 4
    };
    // The settings that belong to one kind of slideshow, cleared when the
    // viewer switches to another, so a link carries only its own.
    const OWN_KEYS = ['tag', 'place', 'added', 'order', 'author', 'year', 'rating'];
    // places: a stop's map shows for this long (the flight is FLIGHT_S of it).
    const STOP_S = 9;
    const FLIGHT_S = 4.5;
    const STOP_ZOOM = 9;
    // The dark map the tour flies over: the Photo Map's dark tiles
    // (KR_MAP_TILES in js/kr-map.js).
    const MAP_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
    const MAP_CREDIT = 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
    // quotes: a long one stays up long enough to read: QUOTE_BASE_S plus a
    // second for every QUOTE_WPS words, or the speed setting if longer.
    const QUOTE_BASE_S = 5;
    const QUOTE_WPS = 2.5;
    // books and music: the wall of covers behind the one in front.
    const WALL_MAX = 60;
    // Under fit=fill, the furthest a photograph's shape may be from the
    // screen's, as a ratio of the two: 1.5 lets a 3:2 frame fill a 16:9
    // screen and a 4:3 one too, and leaves out portraits and square frames.
    const FILL_RATIO = 1.5;
    // The sleep timer's fade, in seconds.
    const SLEEP_FADE = 30;
    // The cross-fade between photographs, matching .kr-show__slide's
    // transition; the slow zoom runs for the photograph's time plus this.
    const FADE_MS = 1400;
    // The controls and the pointer hide after this long without movement.
    const IDLE_MS = 2600;
    const PANEL_IDLE_MS = 10000;
    // A swipe is a sideways move of at least this many pixels, clearly more
    // sideways than up or down, within SWIPE_MS.
    const SWIPE_MIN = 50;
    const SWIPE_MS = 800;
    const SWIPED_KEY = 'kr-show-swiped';
    // A photograph that has not arrived by now is skipped.
    const LOAD_WAIT_MS = 20000;
    // A book's or a record's cover from another site that has not arrived
    // by now gives way to one set in type, rather than hold up its slide.
    const COVER_WAIT_MS = 5000;

    const DATA = ['data/photography-files.json', 'data/photo-tags.json', 'data/photo-locations.json',
        'data/photo-variants.json', 'data/photosets.json', 'data/photography-standard-files.json',
        'data/photo-dims.json'];
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
        'September', 'October', 'November', 'December'];

    // ?slideshow keeps these out of the service worker's image cache (see
    // "Photographs" at the top).
    const heroOf = stem => '/img/photography/hero/' + stem + '.webp?slideshow';
    const thumbOf = stem => '/img/photography/thumb/' + stem + '@2x.webp?slideshow';
    const stemOf = f => String(f).split('/').pop().replace(/\.\w+$/, '');
    const landscape = () => window.innerWidth >= window.innerHeight;
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
        if (SHOWS.some(o => o.key === q.get('show'))) s.show = q.get('show');
        ['tag', 'place', 'added', 'author'].forEach(k => { if (q.get(k)) s[k] = q.get(k); });
        if (ORDERS.concat(MUSIC_ORDERS).some(o => o.key === q.get('order'))) s.order = q.get('order');
        if (q.get('behind') === 'plain') s.behind = 'plain';
        if (/^\d{4}$/.test(q.get('year') || '')) s.year = q.get('year');
        const rating = parseInt(q.get('rating'), 10);
        if (rating >= 1 && rating <= 5) s.rating = rating;
        const per = parseInt(q.get('per'), 10);
        if (per >= 1 && per <= 20) s.per = per;
        if (SOUNDS.some(o => o.key === q.get('sound'))) s.sound = q.get('sound');
        const every = parseInt(q.get('every'), 10);
        if (every >= 3 && every <= 3600) s.every = every;
        const volume = parseInt(q.get('volume'), 10);
        if (volume >= 0 && volume <= 100) s.volume = volume;
        if (q.get('fit') === 'fill') s.fit = 'fill';
        if (q.get('drift') === '0') s.drift = false;
        if (q.get('captions') === '0') s.captions = false;
        if (q.get('controls') === 'off') s.controls = 'off';
        if (q.get('pool') === 'all') s.pool = 'all';
        const sleep = parseInt(q.get('sleep'), 10);
        if (SLEEPS.indexOf(sleep) !== -1) s.sleep = sleep;
        const dim = parseInt(q.get('dim'), 10);
        if (dim >= 0 && dim <= 80) s.dim = dim;
        if (q.get('info') === '1') s.info = true;
        if (q.get('clock') === '1') s.clock = true;
        return s;
    }

    /** The query string for a set of settings: only what differs from the defaults. */
    function settingsQuery(s) {
        const q = new URLSearchParams();
        if (s.show !== DEFAULTS.show) q.set('show', s.show);
        ['tag', 'place', 'added', 'author', 'year'].forEach(k => { if (s[k]) q.set(k, s[k]); });
        if (s.rating) q.set('rating', String(s.rating));
        if (s.behind !== DEFAULTS.behind) q.set('behind', s.behind);
        if (s.per !== DEFAULTS.per) q.set('per', String(s.per));
        if (s.order !== DEFAULTS.order) q.set('order', s.order);
        if (s.every !== DEFAULTS.every) q.set('every', String(s.every));
        if (s.sound !== DEFAULTS.sound) q.set('sound', s.sound);
        if (s.volume !== DEFAULTS.volume) q.set('volume', String(s.volume));
        if (s.fit !== DEFAULTS.fit) q.set('fit', s.fit);
        if (!s.drift) q.set('drift', '0');
        if (!s.captions) q.set('captions', '0');
        if (s.controls === 'off') q.set('controls', 'off');
        if (s.pool === 'all') q.set('pool', 'all');
        if (s.sleep) q.set('sleep', String(s.sleep));
        if (s.dim) q.set('dim', String(s.dim));
        if (s.info) q.set('info', '1');
        if (s.clock) q.set('clock', '1');
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

    function loadLibrary(mode, fresh) {
        return Promise.all(mode.data.map(p => fetchJson(p, fresh))).then(results => mode.build(results));
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
        const standard = Array.isArray(results[5]) ? new Set(results[5].map(stemOf)) : null;
        const editsOf = {}, groupOf = {};
        (variants.groups || []).forEach(group => {
            const stems = group.map(String);
            if (stems.length < 2) return;
            editsOf[stems[0]] = stems;
            stems.forEach(s => { groupOf[s] = stems[0]; });
        });
        let stems = Array.isArray(files)
            ? files.map(stemOf)
            : Object.keys(tags);
        stems = stems.filter(s => /^\d+$/.test(s) && (!groupOf[s] || groupOf[s] === s));
        stems.sort((a, b) => b - a);
        const placeOf = {};
        (locations.regions || []).forEach(r => (r.photos || []).forEach(p => { placeOf[String(p)] = r.name; }));
        const tiles = stems.map(stem => {
            const edits = editsOf[stem] || [stem];
            const tagSet = {};
            edits.forEach(e => (tags[e] || []).forEach(t => { tagSet[t] = true; }));
            return { id: stem, stem: stem, n: +stem, edits: edits, tags: Object.keys(tagSet),
                place: edits.map(e => placeOf[e]).find(Boolean) || '',
                selected: !standard || edits.some(e => standard.has(e)) };
        });
        const sets = (photosets.sets || []).map(x => ({
            key: x.from + '-' + x.to, from: +x.from, to: +x.to, date: x.date, place: x.place || ''
        }));
        const earliest = sets.length ? Math.min.apply(null, sets.map(x => x.from)) : 0;
        const first = sets.find(x => x.from === earliest);
        return { tiles: tiles, items: tiles, tags: tags, sets: sets, earliest: earliest, firstSet: first,
            dims: results[6] || {}, regions: locations.regions || [] };
    }

    function inAdded(tile, added, lib) {
        if (!added) return true;
        if (added === 'earlier') return !!lib.earliest && tile.n < lib.earliest;
        const set = lib.sets.find(x => x.key === added);
        return !!set && tile.n >= set.from && tile.n <= set.to;
    }

    function matches(tile, s, lib) {
        return (s.pool === 'all' || tile.selected) &&
            (!s.tag || tile.tags.indexOf(s.tag) !== -1) &&
            (!s.place || tile.place === s.place) &&
            inAdded(tile, s.added, lib);
    }

    /** Drop the filter values that would leave nothing to show on their own. */
    function sanitise(s, lib) {
        if (!ORDERS.some(o => o.key === s.order)) s.order = 'shuffle';
        if (s.tag &&!lib.tiles.some(t => t.tags.indexOf(s.tag) !== -1)) s.tag = '';
        if (s.place && !lib.tiles.some(t => t.place === s.place)) s.place = '';
        if (s.added && !lib.tiles.some(t => inAdded(t, s.added, lib))) s.added = '';
        if (s.pool !== 'all' && !lib.tiles.some(t => matches(t, s, lib)) &&
            lib.tiles.some(t => matches(t, Object.assign({}, s, { pool: 'all' }), lib))) s.pool = 'all';
        return s;
    }

    /** The photoset a frame arrived in, if it came with one. */
    function setOf(tile, lib) {
        return lib.sets.find(x => tile.n >= x.from && tile.n <= x.to) || null;
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
        let view = lib.tiles.filter(t => matches(t, s, lib));
        if (s.fit === 'fill') {
            // Only the frames that fill this screen without losing most of
            // themselves; all of them if none do.
            const screenRatio = window.innerWidth / Math.max(1, window.innerHeight);
            const fit = view.filter(t => {
                const d = lib.dims[faceOf(t, s, lib)];
                if (!d || !d[1]) return true;
                const k = d[0] / d[1] / screenRatio;
                return k <= FILL_RATIO && k >= 1 / FILL_RATIO;
            });
            if (fit.length) view = fit;
        }
        if (s.order === 'oldest') return view.slice().reverse();
        if (s.order === 'newest') return view;
        const deck = shuffled(view);
        return avoidRepeat(deck, avoidFirst);
    }

    /** A new pass never opens on the slide the last one ended with. */
    function avoidRepeat(deck, avoidFirst) {
        if (deck.length > 1 && avoidFirst && deck[0].id === avoidFirst) deck.push(deck.shift());
        return deck;
    }

    /** An image decoded and ready to draw, or null if none of urls arrived
        within wait ms (LOAD_WAIT_MS unless given). */
    function loadImage(urls, wait) {
        return new Promise(resolve => {
            let settled = false;
            const done = v => { if (!settled) { settled = true; resolve(v); } };
            const timer = setTimeout(() => done(null), wait || LOAD_WAIT_MS);
            const attempt = list => {
                if (!list.length) { clearTimeout(timer); done(null); return; }
                const img = new Image();
                img.decoding = 'async';
                img.onload = () => {
                    const ready = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
                    ready.then(() => { clearTimeout(timer); done(img.src); });
                };
                img.onerror = () => attempt(list.slice(1));
                img.src = list[0];
            };
            attempt(urls.filter(Boolean));
        });
    }

    /** The photograph decoded and ready to draw: its hero, or its thumb. */
    function loadFrame(stem) {
        return loadImage([heroOf(stem), thumbOf(stem)]).then(src => src ? { stem: stem, src: src } : null);
    }

    function describePhoto(tile, stem) {
        return 'Photograph ' + stem + (tile.place ? ', ' + tile.place : '');
    }

    /** A link's target: in a frame (a wallpaper), a page opens in a tab of its own. */
    function outLink(href, text) {
        const framed = window.top !== window || /^https?:/.test(href);
        return '<a href="' + esc(href) + '"' + (framed ? ' target="_blank" rel="noopener"' : '') + '>' + esc(text) + '</a>';
    }

    function photoInfo(tile, stem, lib) {
        const lines = ['<p class="kr-show__info-title">Photograph ' + esc(stem) + '</p>'];
        if (tile.place) lines.push('<p>' + esc(tile.place) + '</p>');
        const labels = (lib.tags[stem] || []).map(k => (subjects().find(c => c.key === k) || {}).label).filter(Boolean);
        if (labels.length) lines.push('<p>' + esc(labels.join(', ')) + '</p>');
        const set = setOf(tile, lib);
        if (set) lines.push('<p>Added ' + esc(setLabel(set).split(':')[0]) + '</p>');
        lines.push('<p>' + outLink('/gallery.html?photo=' + encodeURIComponent(stem), 'View in the gallery') + '</p>');
        return lines.join('');
    }

    /** A slide dressed for what it shows: a photograph ('photo'), type over
        a photograph ('atmos', a quote) or type on its own ('card'). */
    function dress(slide, kind) {
        const parts = {
            photo: slide.querySelector('.kr-show__photo'),
            backdrop: slide.querySelector('.kr-show__backdrop'),
            card: slide.querySelector('.kr-show__card')
        };
        slide.classList.toggle('kr-show__slide--card', kind !== 'photo');
        slide.classList.toggle('kr-show__slide--atmos', kind === 'atmos');
        parts.photo.alt = '';
        if (kind !== 'photo') parts.backdrop.removeAttribute('src');
        if (kind === 'card') parts.photo.removeAttribute('src');
        if (kind === 'photo') parts.card.innerHTML = '';
        return parts;
    }

    function drawPhoto(slide, tile, frame) {
        const p = dress(slide, 'photo');
        p.photo.src = frame.src;
        p.photo.alt = describePhoto(tile, frame.stem);
        p.backdrop.src = thumbOf(frame.stem);
    }

    function plural(n, one, many) {
        return n + ' ' + (n === 1 ? one : many);
    }

    function reducedMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function speedField(s, noun) {
        const speeds = SPEEDS.indexOf(s.every) === -1 ? SPEEDS.concat([s.every]).sort((a, b) => a - b) : SPEEDS;
        return '<label class="kr-show__field">Each ' + noun + '<select data-set="every">' +
            speeds.map(v => option(String(v), speedLabel(v), v === s.every)).join('') + '</select></label>';
    }

    function orderField(s, orders) {
        return '<label class="kr-show__field">Order<select data-set="order">' +
            orders.map(o => option(o.key, o.label, o.key === s.order)).join('') + '</select></label>';
    }

    function fitField(s) {
        return '<label class="kr-show__field">Framing<select data-set="fit">' + option('whole', 'Whole photograph', s.fit === 'whole') +
            option('fill', 'Fill the screen', s.fit === 'fill') + '</select></label>';
    }

    function poolField(s) {
        return '<label class="kr-show__field">Photographs<select data-set="pool">' + option('selected', 'My selection', s.pool !== 'all') +
            option('all', 'Every photograph', s.pool === 'all') + '</select></label>';
    }

    /** A book or a record in front of its wall: the cover, then the lines. */
    function feature(cover, lines) {
        return '<div class="kr-show__feature"><div class="kr-show__sleeve">' + cover + '</div><div class="kr-show__about">' +
            lines.filter(Boolean).join('') + '</div></div>';
    }

    /** A cover set in type, for a book or record with no picture. */
    function typeCover(title, by) {
        return '<span class="kr-show__cover kr-show__typecover"><span class="kr-show__typecover-title">' + esc(title) +
            '</span><span class="kr-show__typecover-by">' + esc(by) + '</span></span>';
    }

    function line(cls, html) {
        return html ? '<p class="kr-show__' + cls + '">' + html + '</p>' : '';
    }

    // ------------------------------------------------------------------
    // What to show (see the top): one entry per kind of slideshow
    // ------------------------------------------------------------------
    //   noun, plural   what one slide is ("quote"), for the labels
    //   data           the files it reads; build(results) -> lib, whose
    //                  items are what it can show (each with an id)
    //   sanitise(s, lib), deal(s, lib, avoidFirst) -> the deck
    //   load(item, show) -> a promise of what draw needs (null: skip it)
    //   draw(slide, item, frame, show)
    //   seconds(item, s)  how long it stays, if not s.every
    //   caption(item), describe(item, frame), info(item, frame, show) -> html
    //   fields(s, lib)   its own settings in the panel; count(deck) -> text
    //   home(s)          [href, label]: the close link on slideshow.html
    //   scenery          what sits behind the slides: 'map' or 'wall'
    //                    (wallImage(item) gives a wall its pictures)
    //   drift, captions  whether the slow zoom and the place line apply

    const MODES = {};

    MODES.photos = {
        noun: 'photograph', plural: 'photographs', drift: true, captions: true, fills: true,
        data: DATA,
        build: buildLibrary,
        sanitise: sanitise,
        deal: deal,
        load: (tile, show) => loadFrame(faceOf(tile, show.s, show.lib)),
        draw: (slide, tile, frame) => drawPhoto(slide, tile, frame),
        caption: tile => tile.place,
        describe: (tile, frame) => describePhoto(tile, frame.stem),
        info: (tile, frame, show) => photoInfo(tile, frame.stem, show.lib),
        count: deck => plural(deck.length, 'photograph', 'photographs'),
        home: s => ['/gallery.html' + (s.tag ? '?tag=' + encodeURIComponent(s.tag) : ''), 'Back to the gallery'],
        fields: (s, lib) => {
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
            return '<label class="kr-show__field">Subject<select data-set="tag">' + option('', 'Any subject', !s.tag) + subjectOptions + '</select></label>' +
                '<label class="kr-show__field">Place<select data-set="place">' + option('', 'Anywhere', !s.place) + placeOptions + '</select></label>' +
                '<label class="kr-show__field">Added to the gallery<select data-set="added">' + option('', 'Any time', !s.added) + setOptions + '</select></label>' +
                orderField(s, ORDERS) + fitField(s) + poolField(s);
        }
    };

    // --- places: a journey over a dark map, the photographs at each stop

    /** Distance in degrees of arc between two places, near enough to order a route. */
    function arc(a, b) {
        const rad = Math.PI / 180;
        const h = Math.pow(Math.sin((b.lat - a.lat) * rad / 2), 2) +
            Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.pow(Math.sin((b.lng - a.lng) * rad / 2), 2);
        return 2 * Math.asin(Math.min(1, Math.sqrt(h)));
    }

    MODES.places = {
        noun: 'slide', plural: 'places', drift: true, captions: true, scenery: 'map',
        data: DATA,
        build: results => {
            const lib = buildLibrary(results);
            lib.places = {};
            lib.regions.forEach(r => {
                if (isFinite(r.lat) && isFinite(r.lng)) lib.places[r.name] = { name: r.name, lat: +r.lat, lng: +r.lng };
            });
            return lib;
        },
        sanitise: s => s,
        deal: (s, lib) => {
            const group = pool => {
                const by = {};
                lib.tiles.forEach(t => {
                    if (!t.place || !lib.places[t.place] || (pool !== 'all' && !t.selected)) return;
                    (by[t.place] = by[t.place] || []).push(t);
                });
                return by;
            };
            let by = group(s.pool);
            if (!Object.keys(by).length) by = group('all');
            const left = Object.keys(by).map(name => lib.places[name]);
            if (!left.length) return [];
            // A journey: from a place at random, always on to the nearest
            // one not yet visited, so no flight crosses the world and back.
            const route = left.splice(Math.floor(Math.random() * left.length), 1);
            while (left.length) {
                const here = route[route.length - 1];
                let best = 0;
                left.forEach((p, i) => { if (arc(here, p) < arc(here, left[best])) best = i; });
                route.push(left.splice(best, 1)[0]);
            }
            const deck = [];
            route.forEach((place, i) => {
                const photos = shuffled(by[place.name]).slice(0, s.per);
                deck.push({ id: 'stop:' + place.name, stop: true, place: place, n: i + 1, of: route.length, count: by[place.name].length });
                photos.forEach(t => deck.push({ id: t.id, tile: t }));
            });
            return deck;
        },
        load: item => item.stop ? Promise.resolve({}) : loadFrame(item.tile.edits[0]),
        draw: (slide, item, frame, show) => {
            if (!item.stop) { drawPhoto(slide, item.tile, frame); return; }
            const p = dress(slide, 'card');
            p.card.innerHTML = '<div class="kr-show__stop">' +
                line('eyebrow', 'Stop ' + item.n + ' of ' + item.of) +
                line('place', esc(item.place.name)) +
                line('sub', esc(plural(item.count, 'photograph', 'photographs'))) + '</div>';
            show.flyTo(item.place);
        },
        seconds: (item, s) => item.stop ? STOP_S : s.every,
        caption: item => item.stop ? '' : item.tile.place,
        describe: (item, frame) => item.stop
            ? item.place.name + ', ' + plural(item.count, 'photograph', 'photographs')
            : describePhoto(item.tile, frame.stem),
        info: (item, frame, show) => item.stop
            ? '<p class="kr-show__info-title">' + esc(item.place.name) + '</p><p>' +
              esc(plural(item.count, 'photograph', 'photographs')) + '</p><p>' + outLink('/map.html', 'Open the photo map') + '</p>'
            : photoInfo(item.tile, frame.stem, show.lib),
        count: deck => {
            const stops = deck.filter(x => x.stop).length;
            return plural(stops, 'place', 'places') + ', ' + plural(deck.length - stops, 'photograph', 'photographs');
        },
        home: () => ['/map.html', 'Back to the photo map'],
        fields: s => '<label class="kr-show__field">Photographs at each place<select data-set="per">' +
            PERS.concat(PERS.indexOf(s.per) === -1 ? [s.per] : []).sort((a, b) => a - b)
                .map(v => option(String(v), String(v), v === s.per)).join('') + '</select></label>' +
            fitField(s) + poolField(s)
    };

    // --- quotes: one at a time, over a photograph or the dark

    /** "Use of Weapons (Culture, #3)" -> "Use of Weapons". */
    function bareTitle(t) {
        return String(t || '').replace(/\s*\([^)]*#[\d.]+\)\s*$/, '').trim();
    }

    MODES.quotes = {
        noun: 'quote', plural: 'quotes', drift: true,
        data: ['data/quotes-all.json', 'data/photography-standard-files.json'],
        build: results => {
            const list = Array.isArray(results[0]) ? results[0] : [];
            const photos = Array.isArray(results[1]) ? results[1].map(stemOf).filter(x => /^\d+$/.test(x)) : [];
            const items = list.filter(x => x && x.q && x.a).map((x, i) => {
                const text = String(x.q).trim();
                return { id: 'q' + i, text: text, author: String(x.a).trim(), book: bareTitle(x.b),
                    words: text.split(/\s+/).length };
            });
            return { items: items, photos: photos };
        },
        sanitise: (s, lib) => {
            if (s.author && !lib.items.some(x => x.author === s.author)) s.author = '';
            return s;
        },
        deal: (s, lib, avoidFirst) =>
            avoidRepeat(shuffled(lib.items.filter(x => !s.author || x.author === s.author)), avoidFirst),
        load: (item, show) => {
            const photos = show.lib.photos;
            if (show.s.behind !== 'photos' || !photos.length) return Promise.resolve({});
            const stem = photos[Math.floor(Math.random() * photos.length)];
            return loadImage([thumbOf(stem)]).then(src => ({ src: src, stem: stem }));
        },
        draw: (slide, item, frame) => {
            const p = dress(slide, frame.src ? 'atmos' : 'card');
            if (frame.src) p.photo.src = frame.src;
            const size = item.text.length < 110 ? 'short' : item.text.length < 280 ? 'medium' : 'long';
            p.card.innerHTML = '<figure class="kr-show__quote kr-show__quote--' + size + '">' +
                '<blockquote class="kr-show__quote-text"><p>' + esc(item.text) + '</p></blockquote>' +
                '<figcaption class="kr-show__quote-by">' + esc(item.author) +
                (item.book ? ', <cite>' + esc(item.book) + '</cite>' : '') + '</figcaption></figure>';
        },
        seconds: (item, s) => Math.max(s.every, Math.round(QUOTE_BASE_S + item.words / QUOTE_WPS)),
        caption: () => '',
        describe: item => 'Quote by ' + item.author,
        info: item => '<p class="kr-show__info-title">' + esc(item.author) + '</p>' +
            (item.book ? '<p>' + esc(item.book) + '</p>' : '') + '<p>' + outLink('/quotes.html', 'The quote wall') + '</p>',
        count: deck => plural(deck.length, 'quote', 'quotes'),
        home: () => ['/quotes.html', 'Back to the quote wall'],
        fields: (s, lib) => {
            const counts = {};
            lib.items.forEach(x => { counts[x.author] = (counts[x.author] || 0) + 1; });
            const authors = Object.keys(counts).filter(a => counts[a] > 1 || a === s.author)
                .sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
            return '<label class="kr-show__field">Author<select data-set="author">' + option('', 'Any author', !s.author) +
                authors.map(a => option(a, a + ' (' + counts[a] + ')', a === s.author)).join('') + '</select></label>' +
                '<label class="kr-show__field">Behind the words<select data-set="behind">' +
                option('photos', 'My photographs', s.behind === 'photos') + option('plain', 'Nothing', s.behind === 'plain') + '</select></label>';
        }
    };

    // --- books: every book I have rated, one in front of a wall of covers

    // A book's cover is the one Goodreads shows (c in data/books.json, kept
    // by refresh_books.py: every book has one, ISBN or not, about 475px
    // tall), or failing that Open Library's for its ISBN (as
    // krBookshelf.coverUrl, js/bookshelf.js). The wall behind asks Goodreads
    // for a smaller copy (WALL_SIZE) of the same cover.
    const GR_COVERS = 'https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/';
    const WALL_SIZE = '._SY240_';
    const bookCover = (isbn, size) =>
        'https://covers.openlibrary.org/b/isbn/' + encodeURIComponent(isbn) + '-' + size + '.jpg?default=false';
    const grCover = c => c ? (/^https:/.test(c) ? c : GR_COVERS + c) : '';
    // Goodreads gives a cover at another size for a size in its name, and
    // takes one added to a name that has none (about 7 KB at 240px, where
    // some unsized originals are 150 KB).
    const wallCover = url => url.indexOf(GR_COVERS) !== 0 ? url
        : /\._S[XY]\d+_\.\w+$/.test(url) ? url.replace(/\._S[XY]\d+_\.(\w+)$/, WALL_SIZE + '.$1')
        : url.replace(/\.(\w+)$/, WALL_SIZE + '.$1');

    function stars(n) {
        return '<span aria-hidden="true">' + '★'.repeat(n) + '☆'.repeat(5 - n) + '</span>' +
            '<span class="kr-sr-only">Rated ' + n + ' of 5</span>';
    }

    MODES.books = {
        noun: 'book', plural: 'books', scenery: 'wall',
        data: ['data/books.json'],
        build: results => {
            const list = Array.isArray(results[0]) ? results[0] : [];
            const items = list.filter(b => b && b.r && b.t).map((b, i) => {
                const m = /^(.*?)\s*\(([^)]*?),?\s*#([\d.]+)\)\s*$/.exec(b.t);
                const d = /^(\d{4})\/(\d{2})/.exec(b.d || '');
                // "Bird Box (Bird Box, #1)": a series named for its book says nothing.
                const series = m && m[2].toLowerCase() !== m[1].toLowerCase() ? m[2] + ', book ' + m[3] : '';
                return { id: 'b' + (b.g || i), title: m ? m[1] : b.t, series: series,
                    author: b.a || '', rating: +b.r, isbn: b.i || '', year: d ? d[1] : '', month: d ? +d[2] : 0,
                    sort: b.d || '', review: b.w || '', g: b.g || '', cover: grCover(b.c) };
            });
            return { items: items };
        },
        sanitise: (s, lib) => {
            if (s.year && !lib.items.some(b => b.year === s.year)) s.year = '';
            if (!BOOK_ORDERS.some(o => o.key === s.order)) s.order = 'shuffle';
            if (s.rating && !lib.items.some(b => b.rating >= s.rating && (!s.year || b.year === s.year))) s.rating = 0;
            return s;
        },
        deal: (s, lib, avoidFirst) => {
            const view = lib.items.filter(b => (!s.year || b.year === s.year) && b.rating >= (s.rating || 0));
            if (s.order === 'newest') return view.slice().sort((a, b) => b.sort.localeCompare(a.sort));
            if (s.order === 'oldest') return view.slice().sort((a, b) => a.sort.localeCompare(b.sort));
            return avoidRepeat(shuffled(view), avoidFirst);
        },
        load: item => item.cover || item.isbn
            ? loadImage([item.cover, item.isbn ? bookCover(item.isbn, 'L') : ''], COVER_WAIT_MS).then(src => ({ src: src }))
            : Promise.resolve({}),
        draw: (slide, item, frame) => {
            const p = dress(slide, 'card');
            const cover = frame.src ? '<img class="kr-show__cover" src="' + esc(frame.src) + '" alt="">' : typeCover(item.title, item.author);
            p.card.innerHTML = feature(cover, [
                item.month ? line('eyebrow', 'Read in ' + MONTHS[item.month - 1] + ' ' + item.year) : '',
                line('title', esc(item.title)),
                line('sub', esc(item.series)),
                line('by', esc(item.author)),
                line('stars', stars(item.rating))
            ]);
        },
        caption: () => '',
        describe: item => item.title + (item.author ? ' by ' + item.author : ''),
        info: item => '<p class="kr-show__info-title">' + esc(item.title) + '</p>' +
            (item.author ? '<p>' + esc(item.author) + '</p>' : '') +
            '<p>' + outLink(item.review ? 'https://www.goodreads.com/review/show/' + item.review
                : item.g ? 'https://www.goodreads.com/book/show/' + item.g
                : 'https://www.goodreads.com/search?q=' + encodeURIComponent(item.title),
                item.review ? 'My review on Goodreads' : 'On Goodreads') + '</p>',
        count: deck => plural(deck.length, 'book', 'books'),
        home: () => ['/books.html', 'Back to every book'],
        wallImage: item => item.cover ? wallCover(item.cover) : item.isbn ? bookCover(item.isbn, 'M') : '',
        fields: (s, lib) => {
            const years = {};
            lib.items.forEach(b => { if (b.year) years[b.year] = (years[b.year] || 0) + 1; });
            const ratings = [[5, 'Five stars'], [4, 'Four stars and up'], [3, 'Three stars and up']];
            return '<label class="kr-show__field">Read in<select data-set="year">' + option('', 'Any year', !s.year) +
                Object.keys(years).sort().reverse().map(y => option(y, y + ' (' + years[y] + ')', y === s.year)).join('') + '</select></label>' +
                '<label class="kr-show__field">Rating<select data-set="rating">' + option('0', 'Any rating', !s.rating) +
                ratings.map(r => option(String(r[0]), r[1], r[0] === s.rating)).join('') + '</select></label>' +
                orderField(s, BOOK_ORDERS);
        }
    };

    // --- music: the albums I have played most lately, from Last.fm

    const PERIODS = { '7day': 'the last week', '1month': 'the last month', '3month': 'the last three months',
        '6month': 'the last six months', '12month': 'the last year', overall: 'all time' };
    // Last.fm serves the same sleeve larger under another size in its path.
    const bigSleeve = url => url.replace('/300x300/', '/600x600/');

    MODES.music = {
        noun: 'album', plural: 'albums', scenery: 'wall', square: true,
        data: ['data/topalbums.json'],
        build: results => {
            const data = results[0] || {};
            const items = (data.albums || []).filter(a => a && a.name).map((a, i) => ({
                id: 'a' + i, rank: i + 1, name: a.name, artist: a.artist || '', url: a.url || '', img: a.img || '', plays: +a.plays || 0
            }));
            return { items: items, period: PERIODS[data.period] || '' };
        },
        sanitise: s => {
            if (!MUSIC_ORDERS.some(o => o.key === s.order)) s.order = 'shuffle';
            return s;
        },
        deal: (s, lib, avoidFirst) => s.order === 'top' ? lib.items.slice() : avoidRepeat(shuffled(lib.items), avoidFirst),
        load: item => item.img ? loadImage([bigSleeve(item.img), item.img], COVER_WAIT_MS).then(src => ({ src: src })) : Promise.resolve({}),
        draw: (slide, item, frame, show) => {
            const p = dress(slide, 'card');
            const cover = frame.src ? '<img class="kr-show__cover" src="' + esc(frame.src) + '" alt="">' : typeCover(item.name, item.artist);
            p.card.innerHTML = feature(cover, [
                line('eyebrow', 'Number ' + item.rank + ' of my most played' + (show.lib.period ? ', ' + esc(show.lib.period) : '')),
                line('title', esc(item.name)),
                line('by', esc(item.artist)),
                line('sub', esc(plural(item.plays, 'play', 'plays')))
            ]);
        },
        caption: () => '',
        describe: item => item.name + (item.artist ? ' by ' + item.artist : ''),
        info: item => '<p class="kr-show__info-title">' + esc(item.name) + '</p>' +
            (item.artist ? '<p>' + esc(item.artist) + '</p>' : '') +
            (item.url ? '<p>' + outLink(item.url, 'On Last.fm') + '</p>' : ''),
        count: deck => plural(deck.length, 'album', 'albums'),
        home: () => ['/music.html', 'Back to the music page'],
        wallImage: item => item.img,
        fields: s => orderField(s, MUSIC_ORDERS)
    };

    let leaflet = null;

    /** Leaflet, as the Photo Map loads it, fetched only for the tour. */
    function loadLeaflet() {
        if (window.L && window.L.map) return Promise.resolve(window.L);
        if (!leaflet) {
            leaflet = new Promise((resolve, reject) => {
                if (!document.querySelector('link[href*="leaflet.css"]')) {
                    document.head.appendChild(el('link', { rel: 'stylesheet', href: '/js/vendor/leaflet/leaflet.css' }));
                }
                const s = el('script', { src: '/js/vendor/leaflet/leaflet.js' });
                s.onload = () => resolve(window.L);
                s.onerror = () => { leaflet = null; s.remove(); reject(); };
                document.head.appendChild(s);
            });
        }
        return leaflet;
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

    function sleepLabel(minutes) {
        if (!minutes) return 'Never';
        if (minutes % 60 === 0) return minutes === 60 ? '1 hour' : minutes / 60 + ' hours';
        return minutes > 60 ? Math.floor(minutes / 60) + ' hours ' + (minutes % 60) + ' minutes' : minutes + ' minutes';
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
        this.mode = MODES[settings.show] || MODES.photos;
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
        loadLibrary(this.mode, false).then(lib => this.start(lib));
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
            tabindex: '-1'
        });
        const close = this.standalone
            ? '<a class="kr-show__btn" href="/gallery.html" data-act="gallery">' + icon('ti-close') + '</a>'
            : '<button type="button" class="kr-show__btn" data-act="close" aria-label="Close slideshow">' + icon('ti-close') + '</button>';
        const full = document.fullscreenEnabled
            ? '<button type="button" class="kr-show__btn" data-act="fullscreen" aria-label="Full screen">' + icon('ti-fullscreen') + '</button>'
            : '';
        const slide = '<div class="kr-show__slide"><img class="kr-show__backdrop" alt=""><img class="kr-show__photo" alt="">' +
            '<div class="kr-show__card"></div></div>';
        root.innerHTML =
            '<div class="kr-show__stage">' +
                '<div class="kr-show__scenery" aria-hidden="true"></div>' +
                slide + slide +
                '<p class="kr-show__message" hidden></p>' +
            '</div>' +
            '<div class="kr-show__dim" aria-hidden="true"></div>' +
            '<div class="kr-show__corner" aria-hidden="true">' +
                '<p class="kr-show__clock" hidden><span class="kr-show__time" data-time></span><span class="kr-show__date" data-date></span></p>' +
                '<p class="kr-show__caption"></p>' +
            '</div>' +
            '<div class="kr-show__info kr-offstage" role="region" aria-label="Photo details" data-info></div>' +
            '<p class="kr-show__hint kr-offstage" aria-hidden="true">' + (coarsePointer() ? 'Tap' : 'Click') + ' anywhere for sound</p>' +
            '<p class="kr-show__tip kr-offstage" aria-hidden="true"></p>' +
            '<p class="kr-sr-only" aria-live="polite" data-announce></p>' +
            '<div class="kr-show__bar kr-offstage is-visible" role="group" aria-label="Slideshow controls">' +
                '<button type="button" class="kr-show__btn" data-act="prev">' + icon('ti-control-skip-backward') + '</button>' +
                '<button type="button" class="kr-show__btn kr-show__btn--main" data-act="play" aria-label="Pause slideshow">' + icon('ti-control-pause') + '</button>' +
                '<button type="button" class="kr-show__btn" data-act="next">' + icon('ti-control-skip-forward') + '</button>' +
                '<span class="kr-show__count" data-count></span>' +
                '<span class="kr-show__spacer"></span>' +
                '<label class="kr-show__sound">' + icon('ti-volume') + '<span class="kr-sr-only">Sound</span>' +
                    '<select data-set="sound">' + SOUNDS.map(o => option(o.key, o.label, o.key === s.sound)).join('') + '</select></label>' +
                '<input class="kr-show__volume" type="range" min="0" max="100" step="5" value="' + s.volume + '" data-set="volume" aria-label="Volume">' +
                '<button type="button" class="kr-show__btn" data-act="info" aria-label="Show details">' + icon('ti-info-alt') + '</button>' +
                '<button type="button" class="kr-show__btn" data-act="settings" aria-label="Slideshow settings" aria-expanded="false" aria-controls="' + id + '">' + icon('ti-settings') + '</button>' +
                full + close +
            '</div>' +
            '<form class="kr-show__panel kr-offstage" id="' + id + '" aria-label="Slideshow settings" novalidate></form>';
        this.root = root;
        this.scenery = root.querySelector('.kr-show__scenery');
        this.slides = root.querySelectorAll('.kr-show__slide');
        this.bar = root.querySelector('.kr-show__bar');
        this.panel = root.querySelector('.kr-show__panel');
        this.caption = root.querySelector('.kr-show__caption');
        this.message = root.querySelector('.kr-show__message');
        this.hint = root.querySelector('.kr-show__hint');
        this.tipEl = root.querySelector('.kr-show__tip');
        this.live = root.querySelector('[data-announce]');
        this.count = root.querySelector('[data-count]');
        this.info = root.querySelector('[data-info]');
        this.clock = root.querySelector('.kr-show__clock');
        this.labelMode();
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
        const s = this.s, lib = this.lib, mode = this.mode;
        const check = (key, on, text) =>
            '<label class="kr-show__check"><input type="checkbox" data-set="' + key + '"' + (on ? ' checked' : '') + '> ' + text + '</label>';
        this.panel.innerHTML =
            '<h2 class="kr-show__panel-title">Slideshow</h2>' +
            '<p class="kr-show__panel-count" data-panel-count></p>' +
            '<label class="kr-show__field kr-show__field--show">Show<select data-set="show">' +
                SHOWS.map(o => option(o.key, o.label, o.key === s.show)).join('') + '</select></label>' +
            '<div class="kr-show__fields">' +
                mode.fields(s, lib) +
                speedField(s, mode === MODES.places ? 'photograph' : mode.noun) +
                '<label class="kr-show__field">Dim the screen<select data-set="dim">' + DIMS.concat(DIMS.indexOf(s.dim) === -1 ? [s.dim] : []).sort((a, b) => a - b).map(v => option(String(v), v ? v + '%' : 'No', v === s.dim)).join('') + '</select></label>' +
                '<label class="kr-show__field">Sound stops after<select data-set="sleep">' + SLEEPS.map(v => option(String(v), sleepLabel(v), v === s.sleep)).join('') + '</select></label>' +
            '</div>' +
            (mode.drift ? check('drift', s.drift, 'Slow zoom') : '') +
            (mode.captions ? check('captions', s.captions, 'Show where each was taken') : '') +
            check('info', s.info, 'Show the details') +
            check('clock', s.clock, 'Show the time') +
            '<fieldset class="kr-show__share">' +
                '<legend>As a wallpaper</legend>' +
                '<p>This link opens the slideshow as it is set up here. Open it and press F11, or give it to a wallpaper app that shows web pages. For Lively Wallpaper on Windows, <a href="/wallpaper/kenreid-slideshow-lively.zip" download>download the Lively package</a> and drag it into Lively: its Customise menu has these settings.</p>' +
                '<label class="kr-show__check"><input type="checkbox" data-set="controls"' + (s.controls === 'off' ? ' checked' : '') + '> Never show the controls (keys still work)</label>' +
                '<div class="kr-show__link"><input type="text" readonly data-url aria-label="Slideshow link">' +
                '<button type="button" class="kr-show__copy" data-act="copy">' + icon('ti-link') + ' Copy link</button></div>' +
            '</fieldset>' +
            '<p class="kr-show__credit" data-credit></p>';
        this.updateLink();
        this.updateCredit();
    };

    /** Whose recording the sound playing is, as its licence asks; every
        sound's credit is on the colophon. */
    Show.prototype.updateCredit = function() {
        const line = this.panel.querySelector('[data-credit]');
        if (!line) return;
        const sound = SOUNDS.find(o => o.key === this.s.sound && o.credit);
        line.innerHTML = sound
            ? 'Sound: <a href="' + esc(sound.credit.url) + '" target="_blank" rel="noopener">' + esc(sound.credit.title) + '</a> by ' +
              esc(sound.credit.by) + ' (' + esc(sound.credit.licence) + '). <a href="/colophon.html#colo-sounds">All the sounds</a>'
            : 'The sounds are recordings other people have shared freely: <a href="/colophon.html#colo-sounds">who made them</a>';
    };

    Show.prototype.updateLink = function() {
        const field = this.panel.querySelector('[data-url]');
        if (field) field.value = pageUrl(this.s);
        const n = this.panel.querySelector('[data-panel-count]');
        if (n) n.textContent = this.mode.count(this.deck);
        if (this.standalone && window.history && window.history.replaceState) {
            try { window.history.replaceState(null, '', settingsQuery(this.s) || window.location.pathname); } catch (e) {}
        }
        const back = this.root.querySelector('[data-act="gallery"]');
        if (back) {
            const home = this.mode.home(this.s);
            back.href = home[0];
            back.setAttribute('aria-label', home[1]);
        }
    };

    /** The labels that name what is showing. */
    Show.prototype.labelMode = function() {
        const m = this.mode;
        this.root.setAttribute('aria-label', 'Slideshow of ' + m.plural);
        this.root.querySelector('[data-act="prev"]').setAttribute('aria-label', 'Previous ' + m.noun);
        this.root.querySelector('[data-act="next"]').setAttribute('aria-label', 'Next ' + m.noun);
        const back = this.root.querySelector('[data-act="gallery"]');
        if (back) {
            const home = m.home(this.s);
            back.href = home[0];
            back.setAttribute('aria-label', home[1]);
        }
    };

    Show.prototype.applyLook = function() {
        const r = this.root.classList;
        r.toggle('kr-show--fill', this.s.fit === 'fill');
        r.toggle('kr-show--drift', !!this.s.drift);
        r.toggle('kr-show--captions', !!this.s.captions);
        r.toggle('kr-show--bare', this.s.controls === 'off');
        this.root.style.setProperty('--kr-show-dur', (this.s.every * 1000 + FADE_MS * 2) + 'ms');
        this.root.style.setProperty('--kr-show-dim', String((this.s.dim || 0) / 100));
        this.clock.hidden = !this.s.clock;
        this.tickClock();
        this.showInfo(!!this.s.info);
    };

    // --- the clock and the details ----------------------------------------

    let timeFormat = null, dateFormat = null;

    /** The time, on the minute, while the clock is shown. */
    Show.prototype.tickClock = function() {
        clearTimeout(this.clockTimer);
        if (!this.root || !this.s.clock) return;
        if (!timeFormat) {
            timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
            dateFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
        }
        const now = new Date();
        this.root.querySelector('[data-time]').textContent = timeFormat.format(now);
        this.root.querySelector('[data-date]').textContent = dateFormat.format(now);
        this.clockTimer = setTimeout(() => this.tickClock(), 60000 - now.getSeconds() * 1000 - now.getMilliseconds() + 50);
    };

    Show.prototype.showInfo = function(on) {
        this.s.info = on;
        this.info.classList.toggle('is-visible', on);
        const btn = this.root.querySelector('[data-act="info"]');
        btn.setAttribute('aria-label', on ? 'Hide details' : 'Show details');
        btn.classList.toggle('is-on', on);
        const box = this.panel && this.panel.querySelector('input[data-set="info"]');
        if (box) box.checked = on;
        if (on) this.updateInfo();
    };

    /** The details of what is on screen. */
    Show.prototype.updateInfo = function() {
        const cur = this.current;
        if (!cur || !this.lib) { this.info.innerHTML = ''; return; }
        this.info.innerHTML = this.mode.info(cur.item, cur.frame, this);
    };

    // --- what sits behind the slides: the tour's map, a wall of covers ------

    Show.prototype.setScene = function() {
        const kind = this.mode.scenery || '';
        if (kind === 'map' && this.sceneKind === 'map') return;
        this.clearScene();
        this.sceneKind = kind;
        if (kind === 'map') this.buildMap();
        else if (kind === 'wall') this.buildWall();
    };

    Show.prototype.clearScene = function() {
        if (this.map) { this.map.remove(); this.map = null; this.mapMarker = null; }
        this.pendingStop = null;
        this.sceneKind = '';
        if (this.scenery) this.scenery.innerHTML = '';
    };

    /** The covers on the deck first, then the rest, each once, up to WALL_MAX,
        repeated until there are enough to fill a large screen. */
    Show.prototype.buildWall = function() {
        const urls = [], seen = {};
        const add = item => {
            const u = this.mode.wallImage(item);
            if (u && !seen[u] && urls.length < WALL_MAX) { seen[u] = true; urls.push(u); }
        };
        this.deck.forEach(add);
        shuffled(this.lib.items).forEach(add);
        if (!urls.length) return;
        // Enough tiles to cover the wall (124% of the screen each way, as
        // style.css sets it) at a tile width that suits the screen.
        const w = window.innerWidth, h = window.innerHeight;
        const tile = Math.round(Math.max(72, Math.min(150, w * 0.09)));
        const cols = Math.ceil(w * 1.24 / (tile + 10));
        const rows = Math.ceil(h * 1.24 / (tile * (this.mode.square ? 1 : 1.5) + 10)) + 1;
        let tiles = shuffled(urls);
        while (tiles.length < cols * rows) tiles = tiles.concat(shuffled(urls));
        const wall = el('div', { class: 'kr-show__wall' + (this.mode.square ? ' kr-show__wall--square' : '') });
        wall.style.setProperty('--kr-show-tile', tile + 'px');
        wall.innerHTML = tiles.map(u => '<img src="' + esc(u) + '" alt="" decoding="async">').join('');
        // A cover that cannot be found leaves the wall, which closes up.
        wall.querySelectorAll('img').forEach(img => img.addEventListener('error', () => img.remove()));
        this.scenery.appendChild(wall);
    };

    Show.prototype.buildMap = function() {
        const host = el('div', { class: 'kr-show__map' });
        this.scenery.appendChild(host);
        loadLeaflet().then(L => {
            if (!this.root || this.sceneKind !== 'map' || !host.isConnected) return;
            const map = L.map(host, {
                zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
                boxZoom: false, keyboard: false, touchZoom: false, zoomSnap: 0, inertia: false
            });
            L.tileLayer(MAP_TILES, { attribution: MAP_CREDIT, maxZoom: 16 }).addTo(map);
            map.attributionControl.setPrefix(false);
            map.setView([30, 0], 2, { animate: false });
            this.map = map;
            if (this.pendingStop) this.flyTo(this.pendingStop, true);
        }, () => {});
    };

    /** The map to a stop: a flight, or a cut under reduced motion. */
    Show.prototype.flyTo = function(place, instant) {
        if (!this.map) { this.pendingStop = place; return; }
        this.pendingStop = null;
        const at = [place.lat, place.lng];
        this.map.invalidateSize();
        if (instant || reducedMotion()) this.map.setView(at, STOP_ZOOM, { animate: false });
        else this.map.flyTo(at, STOP_ZOOM, { duration: FLIGHT_S });
        if (this.mapMarker) { this.mapMarker.setLatLng(at); return; }
        const accent = getComputedStyle(this.root).getPropertyValue('--kr-show-accent').trim();
        this.mapMarker = window.L.circleMarker(at, {
            radius: 8, color: accent, weight: 2, fillColor: accent, fillOpacity: 0.85, interactive: false
        }).addTo(this.map);
    };

    // --- the sleep timer ------------------------------------------------------

    Show.prototype.armSleep = function() {
        clearTimeout(this.sleepTimer);
        if (!this.s.sleep || this.s.sound === 'off') return;
        this.sleepTimer = setTimeout(() => {
            if (!this.root || this.s.sound === 'off' || !this.ambience) return;
            this.ambience.fadeOut(SLEEP_FADE, () => { if (this.root) this.setSound('off', false); });
        }, this.s.sleep * 60000);
    };

    Show.prototype.start = function(lib) {
        if (!this.root) return;
        this.ambience = window.krAmbience;
        this.setSound(this.s.sound, true);
        this.poke();
        this.offerTips();
        this.begin(lib);
    };

    /** Deal from a library just loaded, and show the first slide. */
    Show.prototype.begin = function(lib) {
        if (!lib.items.length) {
            this.say('The ' + this.mode.plural + ' could not be loaded just now.');
            return;
        }
        this.lib = lib;
        this.mode.sanitise(this.s, lib);
        this.dealtLandscape = landscape();
        this.deck = this.mode.deal(this.s, lib);
        this.next = null;
        this.renderPanel();
        this.setScene();
        this.go(0, false);
    };

    /** Change what is showing (the panel's Show menu). The settings that
        belonged to the last kind go back to their defaults. */
    Show.prototype.switchTo = function(key) {
        const mode = MODES[key];
        if (!mode || mode === this.mode) return;
        OWN_KEYS.forEach(k => { this.s[k] = DEFAULTS[k]; });
        this.s.show = key;
        this.mode = mode;
        this.token++;
        clearTimeout(this.timer);
        this.next = null;
        this.deck = [];
        this.lib = null;
        this.current = null;
        this.clearScene();
        this.labelMode();
        this.updateInfo();
        this.updateLink();
        const focused = this.panel.contains(document.activeElement);
        loadLibrary(mode, false).then(lib => {
            if (!this.root || this.mode !== mode) return;
            this.begin(lib);
            this.updateLink();
            const menu = this.panel.querySelector('select[data-set="show"]');
            if (focused && menu) menu.focus();
        });
    };

    // --- tips (see "Tips" at the top) ------------------------------------

    Show.prototype.offerTips = function() {
        if (this.s.controls === 'off' || window.top !== window) return;
        if (coarsePointer()) {
            let swiped = false;
            try { swiped = window.localStorage.getItem(SWIPED_KEY) === '1'; } catch (e) {}
            if (!swiped) this.tip('Swipe for the next ' + this.mode.noun, 5000);
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
        const promise = this.mode.load(this.deck[p], this);
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
        const item = this.deck[p];
        this.fetchAhead(p).then(frame => {
            if (token !== this.token || !this.root) return;
            if (!frame) {
                // Nothing arrived for it: skip it, unless every one fails.
                if ((skipped || 0) + 1 >= n) { this.say('The ' + this.mode.plural + ' could not be loaded just now.'); return; }
                this.go(asked && pos < this.pos ? p - 1 : p + 1, asked, (skipped || 0) + 1);
                return;
            }
            this.pos = p;
            this.draw(item, frame);
            if (asked) this.live.textContent = this.describe(item, frame, true);
            this.schedule();
            this.fetchAhead(p + 1);
        });
    };

    /** End of a pass: fetch the lists again (new photosets, books, quotes)
        and deal again. */
    Show.prototype.newPass = function() {
        const last = this.deck.length ? this.deck[this.deck.length - 1].id : '';
        const mode = this.mode;
        loadLibrary(mode, true).then(lib => {
            if (!this.root || this.mode !== mode) return;
            if (lib.items.length) { this.lib = lib; mode.sanitise(this.s, lib); }
            this.deck = mode.deal(this.s, this.lib, last);
            this.next = null;
            if (mode.scenery === 'wall') this.setScene();
            this.updateLink();
            this.go(0, false);
        });
    };

    Show.prototype.describe = function(item, frame, withPosition) {
        const text = this.mode.describe(item, frame);
        return withPosition ? text + '. ' + (this.pos + 1) + ' of ' + this.deck.length : text;
    };

    /** How long a slide stays up, in seconds. */
    Show.prototype.seconds = function(item) {
        return item && this.mode.seconds ? this.mode.seconds(item, this.s) : this.s.every;
    };

    Show.prototype.draw = function(item, frame) {
        const back = this.slides[1 - this.front], front = this.slides[this.front];
        this.mode.draw(back, item, frame, this);
        // A fresh direction for the slow zoom each time: toward a corner.
        back.style.setProperty('--kr-show-dx', (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 2).toFixed(2) + '%');
        back.style.setProperty('--kr-show-dy', (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 1.5).toFixed(2) + '%');
        back.style.setProperty('--kr-show-dur', (this.seconds(item) * 1000 + FADE_MS * 2) + 'ms');
        back.classList.remove('is-drifting');
        void back.offsetWidth;    // restart the zoom from its first frame
        back.classList.add('is-drifting', 'is-current');
        front.classList.remove('is-current');
        // The slide fading out is not read: a quote or a book in it is text.
        back.removeAttribute('aria-hidden');
        front.setAttribute('aria-hidden', 'true');
        this.front = 1 - this.front;
        const caption = (this.mode.caption && this.mode.caption(item)) || '';
        this.caption.textContent = caption;
        this.caption.hidden = !caption;
        this.current = { item: item, frame: frame };
        if (this.s.info) this.updateInfo();
        this.count.textContent = (this.pos + 1) + ' of ' + this.deck.length;
    };

    Show.prototype.schedule = function() {
        clearTimeout(this.timer);
        if (!this.playing || document.hidden || !this.deck.length) return;
        const item = this.current && this.current.item;
        this.timer = setTimeout(() => this.go(this.pos + 1, false), this.seconds(item) * 1000);
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
        if (key === 'show') { this.switchTo(value); return; }
        if (key === 'every') s.every = parseInt(value, 10) || DEFAULTS.every;
        else if (key === 'volume') s.volume = Math.max(0, Math.min(100, parseInt(value, 10) || 0));
        else if (key === 'drift' || key === 'captions' || key === 'info' || key === 'clock') s[key] = !!value;
        else if (key === 'controls') s.controls = value ? 'off' : 'auto';
        else if (key === 'sleep' || key === 'dim' || key === 'rating') s[key] = parseInt(value, 10) || 0;
        else if (key === 'per') s.per = parseInt(value, 10) || DEFAULTS.per;
        else s[key] = value;
        if (key === 'sleep') this.armSleep();
        if (key === 'sound') this.setSound(value, false);
        if (key === 'volume' && this.ambience) this.ambience.volume(s.volume / 100);
        this.applyLook();
        if (['tag', 'place', 'added', 'order', 'pool', 'fit', 'author', 'behind', 'year', 'rating', 'per'].indexOf(key) !== -1) {
            if (!this.lib) return;
            this.dealtLandscape = landscape();
            this.deck = this.mode.deal(s, this.lib);
            this.next = null;
            if (this.mode.scenery === 'wall') this.setScene();
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
        if (this.panel) this.updateCredit();
        const amb = this.ambience;
        if (!amb) return;
        if (key === 'off') { clearTimeout(this.sleepTimer); amb.stop(); this.showHint(false); return; }
        this.armSleep();
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
        this.lastActive = Date.now();
        clearTimeout(this.idleTimer);
        this.root.classList.remove('is-idle');
        if (this.s.controls !== 'off') this.bar.classList.add('is-visible');
        this.idleTimer = setTimeout(() => this.idle(), IDLE_MS);
    };

    /** Hide the controls (and, once it has sat untouched for PANEL_IDLE_MS,
        the settings panel). force: a tap asked for it, so now. */
    Show.prototype.idle = function(force) {
        if (!this.root) return;
        clearTimeout(this.idleTimer);
        const mouseOnBar = this.lastPointer !== 'touch' && this.bar.matches(':hover');
        if (!force && mouseOnBar) {
            this.idleTimer = setTimeout(() => this.idle(), IDLE_MS);
            return;
        }
        if (this.panel.classList.contains('is-visible')) {
            const left = PANEL_IDLE_MS - (Date.now() - (this.lastActive || 0));
            if (!force && left > 0) {
                this.idleTimer = setTimeout(() => this.idle(), left);
                return;
            }
            this.togglePanel(false);
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
                // A click on the photograph itself: close the settings, or
                // show the controls; a tap hides them again if they were up.
                if (!e.target.closest('.kr-show__panel, .kr-show__bar')) {
                    if (this.panel.classList.contains('is-visible')) { this.togglePanel(false); this.poke(); }
                    else if (this.lastPointer === 'touch' && this.tapFoundControls) this.idle(true);
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
            else if (act === 'info') { this.showInfo(!this.s.info); this.updateLink(); }
            else if (act === 'fullscreen') this.toggleFullscreen();
            else if (act === 'close') this.close();
            else if (act === 'copy') this.copyLink(btn);
        });
        this.on(root, 'change', e => {
            const key = e.target.getAttribute('data-set');
            if (!key) return;
            this.poke();      // a choice made in an open menu, with no mouse move the page saw
            this.change(key, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
        });
        this.on(root, 'input', e => {
            if (e.target.getAttribute('data-set') === 'volume') this.change('volume', e.target.value);
        });
        this.on(root, 'submit', e => e.preventDefault());
        // A finger moving is a swipe, not a mouse: only a mouse or pen wakes
        // the controls by moving. A tap on the photograph is handled on its
        // click (see above); a tap on the controls keeps them up.
        this.on(root, 'pointermove', e => { if (e.pointerType !== 'touch') { this.lastPointer = e.pointerType; this.poke(); } }, { passive: true });
        this.on(root, 'pointerdown', e => {
            if (this.waitingForSound) this.resumeSound();
            this.lastPointer = e.pointerType;
            if (e.pointerType === 'touch' && !e.target.closest('.kr-show__panel, .kr-show__bar')) {
                this.tapFoundControls = this.bar.classList.contains('is-visible') || this.panel.classList.contains('is-visible');
                return;
            }
            this.poke();
        }, { passive: true });
        this.on(root, 'keydown', e => this.key(e));
        this.on(document, 'visibilitychange', () => {
            if (document.hidden) clearTimeout(this.timer); else this.schedule();
            this.wake();
        });
        this.on(document, 'fullscreenchange', () => { this.syncFullscreen(); if (fillsScreen()) this.hideTip(); });
        this.on(window, 'resize', () => {
            if (fillsScreen()) this.hideTip();
            // Filling the screen picks frames by its shape: deal again when it turns.
            if (this.map) this.map.invalidateSize();
            if (this.lib && this.mode.fills && this.s.fit === 'fill' && landscape() !== this.dealtLandscape) {
                this.dealtLandscape = landscape();
                this.deck = this.mode.deal(this.s, this.lib);
                this.next = null;
                this.updateLink();
                this.go(0, false);
            }
        });
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
        else if (e.key === 'i' || e.key === 'I') { e.preventDefault(); this.showInfo(!this.s.info); this.updateLink(); }
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
        clearTimeout(this.clockTimer);
        clearTimeout(this.sleepTimer);
        this.token++;
        this.listeners.forEach(l => l[0].removeEventListener(l[1], l[2], l[3]));
        this.listeners = [];
        if (this.ambience) this.ambience.stop();
        this.clearScene();
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
    // krAmbience: the sounds, recordings looped without a seam
    // ------------------------------------------------------------------
    //
    // Each sound is one file in sounds/: a stretch of a recording whose end
    // has been cross-faded into its start, with SOUND_PAD seconds of its own
    // end before it and of its start after it (made by a script outside the
    // site). An MP3 decoder may add a few milliseconds of silence at the
    // front; with the padding, SOUND_PAD to SOUND_PAD + loop is one whole
    // period wherever the decoder starts, so an AudioBufferSourceNode loops
    // there with no gap and no click, which an <audio loop> element cannot
    // promise. Only the sound playing is kept decoded (about 35 MB for a
    // 96-second stereo loop); the others stay as the compressed files the
    // browser has cached.

    const SOUND_PAD = 1;
    const FADE_IN = 2.5;
    const FADE_OUT = 0.8;

    function Ambience() {
        this.ctx = null;
        this.master = null;
        this.voice = null;      // { key, src, out }
        this.level = 0.5;
        this.decoded = null;    // { key, buffer }
        this.token = 0;
    }

    Ambience.prototype.ensure = function() {
        if (this.ctx) return this.ctx;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0;
        this.master.connect(this.ctx.destination);
        this.output = this.master;
        return this.ctx;
    };

    /** The sound's loop, decoded: from memory if it is the one playing. */
    Ambience.prototype.load = function(sound) {
        if (this.decoded && this.decoded.key === sound.key) return Promise.resolve(this.decoded.buffer);
        return fetch(sound.file)
            .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); })
            .then(bytes => new Promise((resolve, reject) => this.ctx.decodeAudioData(bytes, resolve, reject)))
            .then(buffer => { this.decoded = { key: sound.key, buffer: buffer }; return buffer; });
    };

    /** Start a sound (or switch to it). Resolves true once the browser lets it be heard. */
    Ambience.prototype.play = function(key, level) {
        const ctx = this.ensure();
        const sound = SOUNDS.find(o => o.key === key && o.file);
        if (!ctx || !sound) return Promise.resolve(false);
        this.level = level;
        if (!this.voice || this.voice.key !== key) {
            this.release();
            const token = ++this.token;
            const out = ctx.createGain();
            out.gain.value = 0;
            out.connect(this.master);
            this.voice = { key: key, out: out, src: null };
            this.load(sound).then(buffer => {
                if (token !== this.token) return;
                const src = ctx.createBufferSource();
                src.buffer = buffer;
                src.loop = true;
                src.loopStart = SOUND_PAD;
                src.loopEnd = SOUND_PAD + sound.loop;
                src.connect(out);
                src.start(0, SOUND_PAD);
                this.voice.src = src;
                out.gain.setValueAtTime(0, ctx.currentTime);
                out.gain.linearRampToValueAtTime(1, ctx.currentTime + FADE_IN);
            }, () => {});
        }
        // A browser that holds sound until a click leaves resume() pending,
        // so it gets a moment and no more.
        const wait = new Promise(r => setTimeout(r, 400));
        return Promise.race([ctx.resume().catch(() => {}), wait]).then(() => {
            const running = ctx.state === 'running';
            if (running) this.ramp(this.level, 0.4);
            return running;
        });
    };

    Ambience.prototype.ramp = function(level, seconds) {
        if (!this.ctx) return;
        const g = this.master.gain, now = this.ctx.currentTime;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        // The loops are levelled to -20 LUFS; the slider's power of 1.5 keeps
        // its lower half usable (half way is about 9 dB down).
        g.linearRampToValueAtTime(Math.pow(level, 1.5), now + seconds);
    };

    /** Fade the sound to nothing over `seconds`, then call done. */
    Ambience.prototype.fadeOut = function(seconds, done) {
        if (!this.ctx) { done(); return; }
        const g = this.master.gain, now = this.ctx.currentTime;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(0, now + seconds);
        setTimeout(done, seconds * 1000);
    };

    Ambience.prototype.volume = function(level) {
        this.level = level;
        if (this.voice) this.ramp(level, 0.15);
    };

    /** Fade the sound playing out and let it go. */
    Ambience.prototype.release = function() {
        const v = this.voice;
        if (!v) return;
        this.token++;
        const now = this.ctx.currentTime;
        v.out.gain.cancelScheduledValues(now);
        v.out.gain.setValueAtTime(v.out.gain.value, now);
        v.out.gain.linearRampToValueAtTime(0, now + FADE_OUT);
        setTimeout(() => {
            if (v.src) { try { v.src.stop(); } catch (e) {} }
            v.out.disconnect();
        }, FADE_OUT * 1000 + 100);
        this.voice = null;
    };

    Ambience.prototype.stop = function() {
        this.release();
        if (this.ctx) {
            const ctx = this.ctx;
            setTimeout(() => { if (!this.voice) ctx.suspend().catch(() => {}); }, FADE_OUT * 1000 + 200);
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
