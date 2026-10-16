/**
 * gallery.js: the photography grid on gallery.html.
 *
 * Data
 *   photography-files.json  every frame, newest first
 *   photo-tags.json         stem -> subject tags (CLIP-generated)
 *   photo-locations.json    regions, for tile captions and the globe badge
 *   photo-dims.json         stem -> [width, height] of the full frame
 *   photo-variants.json     groups of frames that are one photograph
 *
 * Layout
 *   Justified rows (packRows, layoutJustified): every row fills the width
 *   and every frame keeps its own aspect ratio. Ratios come from
 *   photo-dims.json, so a batch is laid out before any thumbnail arrives.
 *   A row always holds at least two frames, so a panorama on a phone
 *   shares its row instead of standing alone as a strip.
 *
 *   The row width is Math.floor of the grid's getBoundingClientRect()
 *   width, never clientWidth. clientWidth rounds to the nearest pixel, so
 *   a 353.7px grid reports 354; a row packed to fill 354px has no slack in
 *   353.7, and its last frame wraps onto a line of its own. That was the
 *   single-photo rows on phones.
 *
 * Batches
 *   Frames are added about BATCH_SIZE at a time: each batch runs on to
 *   the end of the row it would otherwise cut (rowAlignedEnd), so the
 *   grid never ends on a stub while more is to come. Scrolling near the
 *   last tile, or past it, loads the next batch on its own, up to
 *   AUTO_LOAD_LIMIT frames (autoLoadIfNear); after that the Load More
 *   button takes over, so the sections below the grid can be reached
 *   without paging through five hundred photographs. The grid reserves
 *   the height its auto-loaded frames will take, computed from
 *   photo-dims.json with the same packRows
 *   (reserveGridHeight): the sections below stay put while batches
 *   arrive, the lazy images in them stay out of range until someone
 *   scrolls there, and the frames not yet in the DOM stay unloaded. A
 *   filter rebuilds the grid from the filtered list rather than loading
 *   everything and hiding most of it.
 *
 * Tiles
 *   The thumbnail is the link to the full frame: one tab stop and one tap
 *   per tile, named by its aria-label. The hover layer (tags, place, the
 *   "+") is decoration over it, aria-hidden and click-through; the place
 *   name is a mouse shortcut to the photo map, out of the tab order
 *   because the lightbox carries the same link.
 *
 * Edits
 *   Frames that are one photograph (a colour and a black and white edit,
 *   a different grade, the same file listed twice) are one tile, from
 *   photo-variants.json. The view, the counts and the filters work on
 *   tiles: a group matches a subject when any of its edits has the tag,
 *   and shows that edit (the B&W filter shows the B&W one). The tile
 *   wears an "N edits" chip; with a mouse over it the other edits fade in
 *   one after another (bindEditCycle). The lightbox has an Edit button
 *   per edit (editButtons), and the edit chosen there becomes the tile's
 *   face (setTileFace), so the preview, the filmstrip and the morph back
 *   all show the frame on screen. ?photo= takes any edit's number and
 *   opens its group showing that edit.
 *
 * Deep links
 *   ?tag=<subject> opens with that filter; ?photo=<stem> opens that frame
 *   in the lightbox, loading batches until it is in the grid. Both are
 *   written back while browsing (a filter change, each frame viewed, the
 *   lightbox closing), so the address bar can always be shared, and the
 *   lightbox has a Copy link action for the frame on screen. The photo
 *   strip on other pages links here as gallery.html?photo=<stem>.
 *
 *   history.replaceState, not pushState, as in blog.js: paging through a
 *   set would otherwise leave a history entry per frame, and Back would
 *   walk through every photograph viewed before leaving the page.
 *
 * The lightbox's set
 *   Magnific's set is the tiles in the grid when a tile is clicked, which
 *   is only the batches loaded so far. The set is the whole view instead:
 *   paging to within SET_LOOKAHEAD frames of the last loaded tile loads
 *   the next batch into the grid and onto the set (growSet), and paging
 *   back from the first frame loads the rest of the view and goes to its
 *   true last frame, rather than to the last tile that happened to be
 *   loaded. The counter and the "Photograph n of N" announcement count
 *   the whole view throughout.
 *
 * Slideshow
 *   The Slideshow link in the banner (#gallery-slideshow) goes to
 *   slideshow.html carrying the filter (?tag=), kept current as the
 *   filter changes, so it opens in a new tab as it is. A plain click
 *   instead opens the slideshow over the gallery, full screen, on the
 *   same photographs (krOpenSlideshow in shared-components.js).
 *
 * A failed load
 *   When neither the file list nor the tags arrive there is nothing to
 *   show, and the grid says so, with a Try again link that fetches them
 *   again in place (krFetchJson forgets a failure), rather than a count
 *   of 0 photos.
 *
 * Design notes: where the tags come from, in "Building a Photo Tagging
 * System with CLIP",
 * https://www.kenreid.co.uk/blog/photo-tagging-with-clip.html
 * and why the full frames live on a release rather than in the
 * repository, in "Hosting a Photography Portfolio on GitHub for Free",
 * https://www.kenreid.co.uk/blog/hosting-photography-on-github-for-free.html
 * Which data file holds what: .github/docs/DATA.md, "Photographs".
 */
/*
 * shared-components.js is loaded synchronously at the foot of
 * gallery.html and this file is deferred, so its globals (KR_RELEASE,
 * KR_PHOTO_CATEGORIES, krFetchJson, krEscapeHtml) are always defined by
 * the time anything here runs, and are used directly; so are
 * lightbox.js's (krLightboxA11y, krLightboxPreview, krLightboxCaption),
 * which loads before it.
 */
var galleryAll = [];
var galleryView = [];
var galleryIndex = 0;
var BATCH_SIZE = 24;
var AUTO_LOAD_LIMIT = BATCH_SIZE * 3;
// How far below the viewport the last tile may still be when the next
// batch is fetched: two and a half rows at the desktop target height,
// more on a phone, so a steady scroll meets finished rows rather than
// the blank reserve.
var AUTO_LOAD_MARGIN = 800;
// A ?photo= deep link gives the tile's thumbnail THUMB_WAIT_MS to arrive
// for the morph before opening without it.
var THUMB_WAIT_MS = 1500;
// The lightbox adds the next batch to its set once the viewer is this
// many frames from the last one it holds: past Magnific's preload of two,
// so the frames it fetches ahead are the real next ones.
var SET_LOOKAHEAD = 3;
var GAP = 6;                 // px between frames; matches .kr-justified's gap
var photoDims = {};          // stem -> [w, h], from data/photo-dims.json
var photoTags = {};
var photoPlaces = {};
var photoCoords = {};        // stem -> [lat, lng], for the tile's globe badge
var editsOf = {};            // the shown stem of a group -> every stem in it, shown first
var groupOf = {};            // any stem in a group -> the group's shown stem
// A hovered tile shows its next edit after EDIT_FIRST_MS, then every
// EDIT_STEP_MS until the pointer leaves.
var EDIT_FIRST_MS = 450;
var EDIT_STEP_MS = 1500;
var activeCat = '*';
var filterBar = null;
var quietFilter = false;     // true while the page sets the bar itself
var lastRowWidth = 0;

// The subject filters, keyed by tag, in the order the shared table
// (KR_PHOTO_CATEGORIES) offers them; the command palette reads that same
// table for its "photos" entries.
var CATEGORIES = {};
KR_PHOTO_CATEGORIES.forEach(function(cat) { CATEGORIES[cat.key] = cat; });

function compareFileNames(a, b) {
    return b.localeCompare(a, undefined, {numeric: true, sensitivity: 'base'});
}

function stemOf(filename) {
    var name = String(filename).split('/').pop();
    var dot = name.lastIndexOf('.');
    return dot > -1 ? name.slice(0, dot) : name;
}

function ratioOf(stem) {
    var d = photoDims[stem];
    return d && d[1] ? d[0] / d[1] : 1.5;   // unrecorded frames are assumed 3:2
}

/** Every edit of the photograph a tile stands for, the shown one first. */
function editsFor(stem) {
    return editsOf[stem] || [stem];
}

/** The edit a tile shows: under a subject filter, the first edit that has
    the subject; otherwise the group's own first. */
function faceOf(stem) {
    var edits = editsFor(stem);
    if (activeCat !== '*') {
        for (var i = 0; i < edits.length; i++) {
            if ((photoTags[edits[i]] || []).indexOf(activeCat) !== -1) return edits[i];
        }
    }
    return edits[0];
}

/** A view entry's aspect ratio: the ratio of the edit its tile shows. */
function tileRatio(filename) {
    return ratioOf(faceOf(stemOf(filename)));
}

function thumbOfStem(stem) {
    return '/img/photography/thumb/' + stem + '.webp';
}

function labelOf(tag) {
    return CATEGORIES[tag] ? CATEGORIES[tag].label : tag;
}

// ----------------------------------------------------------------------
// Address bar
// ----------------------------------------------------------------------

function readParam(name) {
    try {
        return new URLSearchParams(window.location.search).get(name) || '';
    } catch (e) {
        return '';
    }
}

/** This page's URL with some parameters set (a value) or dropped (null). */
function galleryHref(changes) {
    var params = new URLSearchParams(window.location.search);
    Object.keys(changes).forEach(function(key) {
        if (changes[key]) params.set(key, changes[key]);
        else params.delete(key);
    });
    var qs = params.toString();
    return window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
}

// replaceState rather than pushState: see "Deep links" at the top.
function writeUrl(changes) {
    if (!window.history || !window.history.replaceState) return;
    try {
        window.history.replaceState(window.history.state, '', galleryHref(changes));
    } catch (e) {}
}

// ----------------------------------------------------------------------
// Start-up
// ----------------------------------------------------------------------

/**
 * Each file fails on its own. Without tags there are no filters or
 * captions, without places no place names, without dims every frame is
 * laid out as 3:2; without the file list, the tagged stems are the next
 * best inventory (the originals in the release are all N.png). Only
 * when both of those are missing is there nothing to show, and the grid
 * says so (showLoadFailure).
 */
function initGallery() {
    bindLoadMoreButton();
    bindSlideshowButton();
    loadGallery();
}

function loadGallery() {
    function soft(path) {
        return krFetchJson(path).catch(function() { return null; });
    }
    return Promise.all([
        soft('data/photo-tags.json'),
        soft('data/photography-files.json'),
        soft('data/photo-locations.json'),
        soft('data/photo-dims.json'),
        soft('data/photo-variants.json')
    ]).then(function(results) {
        photoTags = results[0] || {};
        photoDims = results[3] || {};
        // krFetchJson hands every caller the same parsed value, so the
        // list is copied before it is sorted.
        var files = Array.isArray(results[1]) ? results[1].slice()
            : Object.keys(photoTags).map(function(stem) { return stem + '.png'; });
        if (!files.length) {
            showLoadFailure();
            return;
        }
        // One tile per photograph: a group's other edits leave the view
        // and travel with its first (see "Edits" at the top).
        editsOf = {};
        groupOf = {};
        ((results[4] || {}).groups || []).forEach(function(group) {
            var stems = group.map(String);
            if (stems.length < 2) return;
            editsOf[stems[0]] = stems;
            stems.forEach(function(s) { groupOf[s] = stems[0]; });
        });
        galleryAll = files.filter(function(f) {
            var g = groupOf[stemOf(f)];
            return !g || g === stemOf(f);
        }).sort(compareFileNames);
        photoPlaces = {};
        ((results[2] || {}).regions || []).forEach(function(region) {
            (region.photos || []).forEach(function(stem) {
                photoPlaces[String(stem)] = region.name;
                if (region.lat && region.lng) photoCoords[String(stem)] = [+region.lat, +region.lng];
            });
        });
        startGallery();
    });
}

/**
 * Neither the file list nor the tags arrived: say so in the grid, with a
 * link that tries again in place. Its href is this page, so it still
 * works as a reload. A reader who tried again from the keyboard keeps
 * their place: focus goes to the first photograph when it works and back
 * to the link when it does not.
 */
function showLoadFailure(refocus) {
    var grid = document.getElementById('gallery-grid');
    var btn = document.getElementById('load-more-btn');
    if (btn) btn.hidden = true;
    if (!grid) return;
    grid.innerHTML = '<p class="kr-gallery-failed">Could not load this just now. ' +
        '<a href="' + krEscapeHtml(window.location.href) + '">Try again</a></p>';
    var link = grid.querySelector('a');
    if (refocus) link.focus();
    link.addEventListener('click', function(e) {
        e.preventDefault();
        var hadFocus = document.activeElement === link;
        link.textContent = 'Trying again…';
        loadGallery().then(function() {
            if (!galleryAll.length) {
                showLoadFailure(hadFocus);
            } else if (hadFocus) {
                var first = grid.querySelector('.portfolio-img');
                if (first) first.focus({ preventScroll: true });
            }
        });
    });
}

function startGallery() {
    var totalEl = document.getElementById('gallery-total-count');
    if (totalEl) totalEl.textContent = galleryAll.length;

    watchGridWidth();
    window.addEventListener('scroll', queueAutoLoad, { passive: true });
    window.addEventListener('resize', queueAutoLoad);
    filterBar = buildFilterButtons();
    bindGalleryLightbox();

    // ?tag= applies its filter before anything is drawn, with no morph:
    // there is nothing on screen yet to morph from.
    var wanted = readParam('tag');
    var cat = CATEGORIES[wanted] && galleryAll.some(function(f) { return hasTag(f, wanted); }) ? wanted : '*';
    if (cat !== '*' && filterBar) setBarQuietly([cat]);
    if (wanted && cat === '*') writeUrl({ tag: null });
    applyFilter(cat);

    openFromUrl();
}

// ----------------------------------------------------------------------
// Slideshow (see "Slideshow" at the top)
// ----------------------------------------------------------------------

function slideshowHref() {
    return '/slideshow.html' + (activeCat === '*' ? '' : '?tag=' + encodeURIComponent(activeCat));
}

function bindSlideshowButton() {
    var link = document.getElementById('gallery-slideshow');
    if (!link || link.dataset.bound) return;
    link.dataset.bound = 'true';
    link.href = slideshowHref();
    link.addEventListener('click', function(e) {
        if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        krOpenSlideshow(link, function() {
            return { tag: activeCat === '*' ? '' : activeCat };
        });
    });
}

function bindLoadMoreButton() {
    var btn = document.getElementById('load-more-btn');
    if (btn && !btn.dataset.bound) {
        btn.addEventListener('click', function() {
            loadMoreImages();
        });
        btn.dataset.bound = 'true';
    }
}

// ----------------------------------------------------------------------
// Filters
// ----------------------------------------------------------------------

// A tile has a subject when any of its edits has it.
function hasTag(filename, cat) {
    return editsFor(stemOf(filename)).some(function(stem) {
        return (photoTags[stem] || []).indexOf(cat) !== -1;
    });
}

function buildFilterButtons() {
    var container = document.getElementById('gallery-filters');
    if (!container || typeof renderFilterBar !== 'function') return null;

    // Counted in tiles, as the view is: a group counts once for a subject
    // any of its edits has.
    var counts = {};
    galleryAll.forEach(function(filename) {
        var tags = {};
        editsFor(stemOf(filename)).forEach(function(stem) {
            (photoTags[stem] || []).forEach(function(tag) { tags[tag] = true; });
        });
        Object.keys(tags).forEach(function(tag) {
            counts[tag] = (counts[tag] || 0) + 1;
        });
    });

    var items = Object.keys(CATEGORIES)
        .filter(function(cat) { return counts[cat]; })
        .sort(function(a, b) { return counts[b] - counts[a]; })
        .map(function(cat) {
            return {
                key: cat,
                label: krEscapeHtml(CATEGORIES[cat].label),
                count: counts[cat]
            };
        });

    container.setAttribute('aria-label', 'Filter photos by subject');
    return renderFilterBar(container, items, {
        multi: false,
        onChange: function(activeKeys) {
            if (quietFilter) return;
            filterGallery(activeKeys.length ? activeKeys[0] : '*');
        }
    });
}

// The bar's setActive reports back through onChange; when the page itself
// is choosing the filter (a deep link), that echo is not a click.
function setBarQuietly(keys) {
    quietFilter = true;
    try { filterBar.setActive(keys); } finally { quietFilter = false; }
}

/** A reader's filter change: morph to the new set and note it in the URL. */
function filterGallery(cat) {
    writeUrl({ tag: cat === '*' ? null : cat, photo: null });
    var container = document.getElementById('gallery-grid');
    krGalleryMorph(container, function() { applyFilter(cat); });
}

/* Rebuild the grid from the filtered list, batched: no force-loading the
   whole archive to hide most of it. */
function applyFilter(cat) {
    activeCat = cat;
    galleryView = cat === '*' ? galleryAll : galleryAll.filter(function(filename) {
        return hasTag(filename, cat);
    });
    galleryIndex = 0;
    var container = document.getElementById('gallery-grid');
    if (container) container.innerHTML = '';
    var show = document.getElementById('gallery-slideshow');
    if (show) show.href = slideshowHref();
    loadMoreImages();
}

/**
 * A filter change is a same-document view transition. Every tile on
 * screen is named after its photo, so a frame that survives the filter
 * slides to its new row while the rest fade; the browser matches old
 * and new by name and draws the in-between. Names are set only for the
 * duration, because a page-wide name lingering on 24 tiles would join
 * every later navigation as well.
 */
function krGalleryMorph(container, rebuild) {
    var canMorph = container && document.startViewTransition &&
        !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (!canMorph) { rebuild(); return; }
    function name(tiles) {
        Array.prototype.forEach.call(tiles, function(t) {
            t.style.viewTransitionName = 'kr-ph-' + t.getAttribute('data-stem');
        });
    }
    function unname(tiles) {
        Array.prototype.forEach.call(tiles, function(t) { t.style.viewTransitionName = ''; });
    }
    function done() {
        unname(container.children);
        document.documentElement.classList.remove('kr-gallery-vt');
    }
    name(container.children);
    document.documentElement.classList.add('kr-gallery-vt');
    var vt = document.startViewTransition(function() {
        rebuild();
        name(container.children);
    });
    vt.finished.then(done, done);
}

function updateCounter() {
    var counter = document.getElementById('gallery-counter');
    if (!counter) return;
    var noun = activeCat === '*' ? 'photos' : labelOf(activeCat) + ' photos';
    counter.textContent = 'Showing ' + galleryIndex + ' of ' + galleryView.length + ' ' + noun;
}

// ----------------------------------------------------------------------
// Justified rows
// ----------------------------------------------------------------------

/**
 * Pack aspect ratios into rows that fill `width`. Pure arithmetic, so the
 * same function lays out the tiles on screen and predicts the height of
 * frames that are not in the DOM yet (reserveGridHeight).
 *
 * A row closes once its frames, at the target height, would fill the
 * width, and never before it has two frames. The final row keeps the
 * target height rather than stretching, unless it is nearly full, so a
 * lone portrait at the end of a filter never becomes a mural.
 *
 * Returns [{ start, count, height, loose }].
 */
function packRows(ratios, width, target, gap) {
    var rows = [];
    var start = 0, sum = 0;
    for (var i = 0; i < ratios.length; i++) {
        sum += ratios[i];
        var count = i - start + 1;
        if (count >= 2 && sum * target + gap * (count - 1) >= width) {
            rows.push({ start: start, count: count, height: (width - gap * (count - 1)) / sum, loose: false });
            start = i + 1;
            sum = 0;
        }
    }
    if (start < ratios.length) {
        var n = ratios.length - start;
        var h = (width - gap * (n - 1)) / sum;
        var loose = h > target * 1.35;
        rows.push({ start: start, count: n, height: loose ? target : h, loose: loose });
    }
    return rows;
}

function rowsHeight(rows, gap) {
    if (!rows.length) return 0;
    return rows.reduce(function(total, row) { return total + Math.round(row.height); }, 0) +
        gap * (rows.length - 1);
}

function targetRowHeight(width) {
    if (width < 640) return 170;
    if (width < 1000) return 230;
    if (width < 1300) return 280;
    return 320;
}

// See "Layout" at the top for why this is floor(getBoundingClientRect).
function rowWidth(grid) {
    return Math.floor(grid.getBoundingClientRect().width);
}

function layoutJustified() {
    var grid = document.getElementById('gallery-grid');
    if (!grid || !grid.classList.contains('kr-justified')) return;
    var width = rowWidth(grid);
    if (!width) return;
    lastRowWidth = width;
    var target = targetRowHeight(width);
    var tiles = Array.prototype.filter.call(grid.children, function(el) {
        return el.classList.contains('single_gallery_item');
    });
    var ratios = tiles.map(function(t) { return ratioOf(t.getAttribute('data-face') || t.getAttribute('data-stem')); });
    packRows(ratios, width, target, GAP).forEach(function(row) {
        for (var i = row.start; i < row.start + row.count; i++) {
            tiles[i].style.width = Math.floor(ratios[i] * row.height) + 'px';
            tiles[i].style.height = Math.round(row.height) + 'px';
            tiles[i].classList.toggle('kr-justified__loose', row.loose);
        }
    });
    reserveGridHeight(grid, width, target);
}

/**
 * Hold open the height of every frame scrolling will load on its own
 * (see "Batches" at the top). Rows already on screen are the first rows
 * of this same packing, so the reservation is never shorter than the
 * grid. An empty view reserves nothing, which also releases the
 * stylesheet's placeholder height for a grid still waiting for data.
 */
function reserveGridHeight(grid, width, target) {
    var count = Math.max(galleryIndex, rowAlignedEnd(Math.min(galleryView.length, AUTO_LOAD_LIMIT)));
    var ratios = galleryView.slice(0, count).map(tileRatio);
    grid.style.minHeight = rowsHeight(packRows(ratios, width, target, GAP), GAP) + 'px';
}

var relayoutTimer = null;
function scheduleRelayout() {
    clearTimeout(relayoutTimer);
    relayoutTimer = setTimeout(layoutJustified, 60);
}

// Relayout when the grid's width changes for any reason: a window resize,
// but also the scrollbar arriving as the page grows, which narrows the
// grid without resizing the window. Straight from the observer, so the
// new rows are in place before that frame paints.
function watchGridWidth() {
    var grid = document.getElementById('gallery-grid');
    if (!grid) return;
    if ('ResizeObserver' in window) {
        new ResizeObserver(function() {
            if (rowWidth(grid) !== lastRowWidth) layoutJustified();
        }).observe(grid);
    } else {
        window.addEventListener('resize', scheduleRelayout);
    }
}

// ----------------------------------------------------------------------
// Tiles and batches
// ----------------------------------------------------------------------

/** The link's name and caption for the edit `stem` of a tile with `count`
    edits: the number, New, how many edits, the subjects and the place. */
function describeLink(link, stem, count) {
    var labels = (photoTags[stem] || []).map(labelOf);
    var place = photoPlaces[stem] || '';
    link.setAttribute('aria-label', 'Photograph ' + stem + (krIsNewPhoto(stem) ? ', new' : '') +
        (count > 1 ? ', one of ' + count + ' edits' : '') +
        (labels.length ? ': ' + labels.join(', ') : '') +
        (place ? (labels.length ? ', ' : ': ') + 'taken near ' + place : ''));
    link.setAttribute('data-caption', labels.concat(place ? [place] : []).join(' · '));
    if (place) link.setAttribute('data-place', place);
    else link.removeAttribute('data-place');
}

function setThumb(img, stem) {
    img.src = thumbOfStem(stem);
    // Sharp on a high-density screen: the tile's 800px double at 2x.
    var set = krThumbSrcset(img.getAttribute('src'));
    if (set) img.srcset = set;
    else img.removeAttribute('srcset');
}

function buildTile(filename) {
    var lead = String(stemOf(filename));
    var edits = editsFor(lead);
    var stem = faceOf(lead);
    var tags = photoTags[stem] || [];
    var labels = tags.map(labelOf);
    var place = photoPlaces[stem] || '';

    var col = document.createElement('div');
    col.className = 'single_gallery_item ' + tags.join(' ');
    // data-stem names the photograph (the group), data-face the edit shown.
    col.setAttribute('data-stem', lead);
    col.setAttribute('data-face', stem);

    var wrapper = document.createElement('div');
    wrapper.className = 'single-portfolio-content';

    var isNew = edits.some(krIsNewPhoto);
    var link = document.createElement('a');
    link.className = 'portfolio-img';
    link.href = KR_RELEASE + stem + '.png';
    describeLink(link, stem, edits.length);

    // The link carries the name, so the picture inside it is decorative.
    var img = document.createElement('img');
    setThumb(img, stem);
    img.alt = '';
    img.loading = 'lazy';
    img.onerror = function() {
        var tile = this.closest('.single_gallery_item');
        if (tile && tile.parentNode) {
            tile.parentNode.removeChild(tile);
            scheduleRelayout();
            queueAutoLoad();
        }
    };
    link.appendChild(img);

    var hover = document.createElement('div');
    hover.className = 'hover-content';
    hover.setAttribute('aria-hidden', 'true');
    if (labels.length || place) {
        var caption = document.createElement('div');
        caption.className = 'kr-tile-caption';
        caption.innerHTML = (labels.length ? '<span class="kr-tile-tags">' + krEscapeHtml(labels.join(' · ')) + '</span>' : '') +
            (place ? '<a class="kr-tile-place" tabindex="-1" href="map.html?region=' + encodeURIComponent(place) +
                '" title="See this place on the photo map">' + krEscapeHtml(place) + '</a>' : '');
        hover.appendChild(caption);
    }
    var plus = document.createElement('span');
    plus.className = 'kr-tile-plus';
    plus.textContent = '+';
    hover.appendChild(plus);

    wrapper.appendChild(link);
    wrapper.appendChild(hover);
    // The newest set (KR_NEW_PHOTOS) wears the "New" badge; the link's
    // name already says it, so the badge itself is hidden from readers.
    if (isNew) {
        var badge = document.createElement('span');
        badge.className = 'kr-new-badge';
        badge.setAttribute('aria-hidden', 'true');
        badge.textContent = 'New';
        wrapper.appendChild(badge);
    }
    // A photograph with more than one edit says how many, and shows the
    // others while hovered (see "Edits" at the top). The link's name
    // already gives the count, so the chip is hidden from readers.
    if (edits.length > 1) {
        wrapper.classList.add('kr-has-edits');
        var chip = document.createElement('span');
        chip.className = 'kr-tile-edits';
        chip.setAttribute('aria-hidden', 'true');
        chip.textContent = edits.length + ' edits';
        wrapper.appendChild(chip);
        bindEditCycle(wrapper, col);
    }
    // A placed frame gets a small globe in its corner on hover, turned
    // to where the photograph was taken (js/covers-site.js, gallery:globe).
    // The column is the host; the badge is only where the canvas goes.
    var coords = photoCoords[stem];
    if (coords) {
        col.setAttribute('data-live', 'gallery:globe');
        col.setAttribute('data-live-arg', JSON.stringify({ lat: coords[0], lng: coords[1] }));
        var globe = document.createElement('span');
        globe.className = 'kr-tile-globe';
        globe.setAttribute('data-live-host', '');
        globe.setAttribute('aria-hidden', 'true');
        wrapper.appendChild(globe);
    }
    col.appendChild(wrapper);
    return col;
}

/**
 * With a mouse over a tile that has edits, fade the next edit in over the
 * shown one after EDIT_FIRST_MS and step on every EDIT_STEP_MS; leaving
 * puts the shown edit back. The chip counts along ("Edit 2 of 3"). Mouse
 * only: a tap opens the photograph, and its Edit buttons are the way
 * through on a touch screen or a keyboard. The fade is the stylesheet's,
 * and goes under reduced motion; the swap itself stays, since it only
 * runs while the pointer is held there.
 */
function bindEditCycle(wrapper, col) {
    var timer = null;
    var layer = null;
    function chipText(text) {
        var chip = wrapper.querySelector('.kr-tile-edits');
        if (chip) chip.textContent = text;
    }
    function show(edits, i) {
        var face = col.getAttribute('data-face');
        chipText('Edit ' + (i + 1) + ' of ' + edits.length);
        if (edits[i] === face) {
            if (layer) layer.classList.remove('is-showing');
            return;
        }
        if (!layer) {
            layer = document.createElement('img');
            layer.className = 'kr-tile-edit';
            layer.alt = '';
            layer.setAttribute('aria-hidden', 'true');
            layer.addEventListener('load', function() {
                if (timer) layer.classList.add('is-showing');
            });
            wrapper.insertBefore(layer, wrapper.querySelector('.hover-content'));
        }
        layer.classList.remove('is-showing');
        setThumb(layer, edits[i]);
        if (layer.complete && layer.naturalWidth) layer.classList.add('is-showing');
    }
    function stop() {
        clearTimeout(timer);
        timer = null;
        if (layer) layer.classList.remove('is-showing');
        chipText(editsFor(col.getAttribute('data-stem')).length + ' edits');
    }
    wrapper.addEventListener('pointerenter', function(e) {
        if (e.pointerType !== 'mouse') return;
        stop();
        var edits = editsFor(col.getAttribute('data-stem'));
        var i = edits.indexOf(col.getAttribute('data-face'));
        timer = setTimeout(function step() {
            i = (i + 1) % edits.length;
            show(edits, i);
            timer = setTimeout(step, EDIT_STEP_MS);
        }, EDIT_FIRST_MS);
    });
    wrapper.addEventListener('pointerleave', stop);
}

/**
 * Make `stem` the edit a tile shows: its thumbnail, the full frame its
 * link opens, its name and caption. The lightbox calls this when an Edit
 * button is pressed, and a ?photo= deep link before it opens, so the tile
 * under the lightbox always matches the frame on screen. A re-edit can be
 * cropped differently, so the rows are laid out again.
 */
function setTileFace(link, stem) {
    var col = link && link.closest ? link.closest('.single_gallery_item') : null;
    if (!col || col.getAttribute('data-face') === stem) return;
    col.setAttribute('data-face', stem);
    link.href = KR_RELEASE + stem + '.png';
    describeLink(link, stem, editsFor(col.getAttribute('data-stem')).length);
    var img = link.querySelector('img');
    if (img) setThumb(img, stem);
    var tags = col.querySelector('.kr-tile-tags');
    if (tags) tags.textContent = (photoTags[stem] || []).map(labelOf).join(' · ');
    scheduleRelayout();
}

/**
 * Where a batch that would stop at `end` should stop instead, so that it
 * ends on a full row. Rows do not care about batches: cut at frame 24 and
 * the grid ends on a stub, a lone frame at the target height, until the
 * next batch arrives and packs it into a row. Carrying the batch on to
 * the end of the row it cuts through keeps the lower edge straight, so
 * only the last row of the whole view is ever short. packRows works from
 * the first frame forward, so packing the whole view gives exactly the
 * rows layoutJustified will draw. The whole view rather than a few frames
 * past the cut: it is arithmetic on a few hundred numbers, and it needs
 * no guess at how many narrow portraits a wide row can hold.
 */
function rowAlignedEnd(end) {
    var grid = document.getElementById('gallery-grid');
    var width = grid ? rowWidth(grid) : 0;
    if (!width || end >= galleryView.length) return end;
    var ratios = galleryView.map(tileRatio);
    var rows = packRows(ratios, width, targetRowHeight(width), GAP);
    for (var i = 0; i < rows.length; i++) {
        var rowEnd = rows[i].start + rows[i].count;
        if (rowEnd >= end) return rows[i].loose ? end : rowEnd;
    }
    return end;
}

/** Append the next batch. `silent` skips the counter (a deep link paging). */
function loadMoreImages(silent) {
    var container = document.getElementById('gallery-grid');
    if (!container) return;

    var end = rowAlignedEnd(Math.min(galleryIndex + BATCH_SIZE, galleryView.length));
    var batch = document.createDocumentFragment();
    for (var i = galleryIndex; i < end; i++) batch.appendChild(buildTile(galleryView[i]));
    container.appendChild(batch);
    galleryIndex = end;

    // Sizes come from photo-dims.json, so the new batch can be laid out
    // now rather than after its images arrive.
    layoutJustified();
    if (!silent) updateCounter();
    // The reader may already be past the new last tile too (a jump into
    // the reserve), in which case the next frame loads the next batch.
    queueAutoLoad();

    var btn = document.getElementById('load-more-btn');
    if (btn) btn.hidden = galleryIndex >= galleryView.length;
}

/**
 * Scrolling loads the next batch while the last tile is within
 * AUTO_LOAD_MARGIN of the viewport's lower edge or anywhere above it: a
 * reader who drags the scrollbar or presses End lands below it, and the
 * reserved rows should fill in behind them. Only up to AUTO_LOAD_LIMIT;
 * after that it is the button's job.
 *
 * A position test on scroll, not an IntersectionObserver on the tile.
 * An observer reports only a change of state, and a jump (End without
 * smooth scrolling, a dragged scrollbar, a restored scroll position, a
 * wheel that moves thousands of pixels a notch) can carry the tile from
 * below the margin to above the viewport between two frames. It is
 * never seen intersecting, nothing fires, and the reserve stays blank
 * with the counter and Load More thousands of pixels further down. The
 * test runs at most once a frame, and returns at once past the limit.
 */
var autoLoadQueued = false;
function queueAutoLoad() {
    if (autoLoadQueued) return;
    autoLoadQueued = true;
    window.requestAnimationFrame(function() {
        autoLoadQueued = false;
        autoLoadIfNear();
    });
}

function autoLoadIfNear() {
    if (galleryIndex >= Math.min(galleryView.length, AUTO_LOAD_LIMIT)) return;
    var grid = document.getElementById('gallery-grid');
    var last = grid && grid.lastElementChild;
    if (last && last.getBoundingClientRect().top < window.innerHeight + AUTO_LOAD_MARGIN) loadMoreImages();
}

// ----------------------------------------------------------------------
// Lightbox
// ----------------------------------------------------------------------

// lightbox.js names the popup; these are photographs, so it says so, and
// counts the whole view rather than the tiles loaded so far.
function a11y(mfp) {
    if (window.krLightboxA11y) window.krLightboxA11y(mfp, { noun: 'Photograph', total: galleryView.length });
}

/**
 * Add tiles to the open set (see "The lightbox's set" at the top): the
 * next batch when the viewer is near the last frame the set holds, or
 * with `all`, the rest of the view. The new tiles go into the grid as a
 * batch always does, so closing the lightbox morphs back into a real
 * tile, and onto the set in grid order. True when the set grew.
 */
function growSet(mfp, all) {
    if (galleryIndex >= galleryView.length) return false;
    if (!all && mfp.index < mfp.items.length - SET_LOOKAHEAD) return false;
    do {
        loadMoreImages(true);
    } while (all && galleryIndex < galleryView.length);
    // Magnific keeps a link until it parses it, then an object holding it.
    var held = mfp.items.map(function(it) { return it && it.el ? it.el[0] : it; });
    var grew = false;
    var links = document.querySelectorAll('#gallery-grid .portfolio-img');
    Array.prototype.forEach.call(links, function(link) {
        if (held.indexOf(link) === -1) {
            mfp.items.push(link);
            grew = true;
        }
    });
    return grew;
}

/**
 * One delegated binding on the grid, made once: whatever tiles the grid
 * holds when a tile is clicked are the set, so batches and filters need
 * no rebinding, and nothing outside the grid is touched. The set then
 * grows as the viewer pages (growSet).
 */
function bindGalleryLightbox() {
    if (typeof jQuery === 'undefined' || !jQuery.fn.magnificPopup) return;
    jQuery('#gallery-grid').magnificPopup({
        delegate: '.portfolio-img',
        type: 'image',
        mainClass: 'kr-lightbox mfp-fade' + (krLightboxMorph.enabled() ? ' kr-morph' : ''),
        closeOnContentClick: false,
        removalDelay: krLightboxMorph.enabled() ? 340 : 0,
        callbacks: {
            open: function() {
                var mfp = this;
                // Magnific wraps from the first frame to the last item it
                // holds, which is only the last tile loaded so far. Every
                // way back (the arrow, the key, a swipe) calls prev(), so
                // this one override covers them; afterClose removes it.
                mfp.prev = function() {
                    if (mfp.index === 0) growSet(mfp, true);
                    jQuery.magnificPopup.proto.prev.call(mfp);
                };
                a11y(mfp);
                krLightboxStrip.open(mfp);
                krLightboxMorph.open(mfp);
                writeUrl({ photo: stemOf(mfp.currItem.src) });
            },
            // After Magnific's own counter, which counts only the tiles
            // loaded so far.
            markupParse: function(template, values, item) {
                if (galleryView.length > 1) values.counter = (item.index + 1) + ' of ' + galleryView.length;
            },
            imageHasSize: function() { krLightboxMorph.settle(this); },
            imageLoadComplete: function() { krLightboxMorph.settle(this); },
            change: function() {
                growSet(this);
                a11y(this);
                window.krLightboxPreview(this);
                krLightboxMorph.change(this);
                krLightboxStrip.sync(this);
                writeUrl({ photo: stemOf(this.currItem.src) });
            },
            beforeClose: function() {
                // Focus goes back to the tile of the frame on screen, not
                // the one first clicked: the viewer may have paged far from
                // it, and the morph has just shrunk into this one.
                var el = this.currItem && this.currItem.el && this.currItem.el[0];
                if (el && el.isConnected) this._lastFocusedEl = el;
                krLightboxMorph.close(this);
            },
            afterClose: function() {
                delete this.prev;
                krLightboxStrip.close();
                writeUrl({ photo: null });
                // Batches the set loaded went in silently.
                updateCounter();
            }
        },
        image: {
            titleSrc: function(item) {
                var stem = stemOf(item.src);
                return window.krLightboxCaption({
                    text: item.el.attr('data-caption') || '',
                    stem: stem,
                    place: item.el.attr('data-place') || '',
                    url: galleryHref({ photo: stem })
                }) + editButtons(stem);
            }
        },
        gallery: {enabled: true, preload: [0, 2], navigateByImgClick: false, tPrev: 'Previous', tNext: 'Next'}
    });
}

/**
 * The caption's Edit buttons, one per edit of the photograph on screen,
 * the one shown pressed. A fixed label with aria-pressed, as the filter
 * pills are. Nothing for a photograph with one edit.
 */
function editButtons(stem) {
    var edits = editsFor(groupOf[stem] || stem);
    if (edits.length < 2) return '';
    return ' <span class="kr-lightbox-edits" role="group" aria-label="Edits of this photograph">' +
        edits.map(function(s, i) {
            return '<button type="button" class="kr-lightbox-edit" data-edit="' + krEscapeHtml(s) +
                '" aria-pressed="' + (s === stem) + '">Edit ' + (i + 1) + '</button>';
        }).join('') + '</span>';
}

/**
 * An Edit button: show that edit in place. The tile takes it as its face
 * first (setTileFace), so the preview lightbox.js shows while the full
 * frame loads is the right thumbnail; then the item's source changes and
 * Magnific draws it again, which also runs the change callback (the
 * address, the filmstrip, the reader's announcement). Focus returns to
 * the pressed button, which the redraw replaced.
 */
function showEdit(stem) {
    var mfp = jQuery.magnificPopup && jQuery.magnificPopup.instance;
    var item = mfp && mfp.isOpen ? mfp.currItem : null;
    if (!item || stemOf(item.src) === stem) return;
    setTileFace(item.el && item.el[0], stem);
    item.src = KR_RELEASE + stem + '.png';
    item.hasSize = false;
    item.loaded = false;
    item.loadError = false;
    mfp.updateItemHTML();
    // The filmstrip drew its thumbnails from the tiles when it opened.
    krLightboxStrip.open(mfp);
    var edits = editsFor(groupOf[stem] || stem);
    if (window.krLightboxA11y && krLightboxA11y.announce) {
        krLightboxA11y.announce(mfp, 'Edit ' + (edits.indexOf(stem) + 1) + ' of ' + edits.length);
    }
    // The redraw took the pressed button away with the old caption, and
    // the new one is hidden until Magnific knows the frame's size, so
    // keep trying for a moment.
    var sel = window.CSS && CSS.escape ? CSS.escape(stem) : stem;
    var tries = 0;
    (function refocus() {
        var btn = mfp.wrap && mfp.wrap[0].querySelector('.kr-lightbox-edit[data-edit="' + sel + '"]');
        if (btn) btn.focus();
        if ((!btn || document.activeElement !== btn) && mfp.isOpen && ++tries < 40) setTimeout(refocus, 50);
    })();
}

document.addEventListener('click', function(e) {
    var btn = e.target && e.target.closest ? e.target.closest('.kr-lightbox-edit') : null;
    if (btn) showEdit(btn.getAttribute('data-edit'));
});

/**
 * ?photo=<stem>: load batches until the frame is in the grid, bring its
 * tile on screen, and open it from there, so the lightbox grows out of
 * the tile the way a click would. A frame outside the ?tag= filter drops
 * the filter; an unknown stem is dropped from the address.
 */
function openFromUrl() {
    var stem = readParam('photo');
    if (!stem) return;
    // Any edit's number opens its photograph's tile, showing that edit.
    var lead = groupOf[stem] || stem;
    function indexIn(list) {
        for (var i = 0; i < list.length; i++) if (stemOf(list[i]) === lead) return i;
        return -1;
    }
    var at = indexIn(galleryView);
    if (at === -1 && activeCat !== '*' && indexIn(galleryAll) !== -1) {
        if (filterBar) setBarQuietly([]);
        writeUrl({ tag: null });
        applyFilter('*');
        at = indexIn(galleryView);
    }
    if (at === -1) { writeUrl({ photo: null }); return; }
    while (galleryIndex <= at) loadMoreImages(true);
    updateCounter();

    var grid = document.getElementById('gallery-grid');
    var sel = window.CSS && CSS.escape ? CSS.escape(lead) : lead;
    var link = grid.querySelector('.single_gallery_item[data-stem="' + sel + '"] .portfolio-img');
    if (!link) return;
    setTileFace(link, stem);
    openTile(grid, link);
}

function openTile(grid, link) {
    link.scrollIntoView({ block: 'center', behavior: 'instant' });
    // Focus first, so closing the lightbox hands focus back to this tile.
    link.focus({ preventScroll: true });
    var index = Array.prototype.indexOf.call(grid.querySelectorAll('.portfolio-img'), link);
    var img = link.querySelector('img');
    var opened = false;
    function go() {
        if (opened) return;
        opened = true;
        jQuery(grid).magnificPopup('open', index);
    }
    // The morph flies the thumbnail itself, so let it arrive first (it is
    // lazy, and was off screen a moment ago), but not for long.
    if (!img || (img.complete && img.naturalWidth)) { go(); return; }
    img.loading = 'eager';
    img.addEventListener('load', go);
    img.addEventListener('error', go);
    setTimeout(go, THUMB_WAIT_MS);
}


/**
 * Lightbox morph. Magnific cross-fades; this grows the thumbnail you
 * clicked into the full frame instead, and shrinks it back on close.
 *
 * A ghost <img> (the thumbnail's own source, so it is already decoded)
 * is fixed over the tile, then animated to where the full image will
 * sit. That box is predicted from photo-dims.json and the lightbox's own
 * paddings, because the full frame comes from the photos release and can
 * take a moment. As soon as the frame's size is known (imageHasSize,
 * long before a large PNG has finished) the ghost is nudged to the real
 * box and faded out over the lightbox's own image, which shows the same
 * thumbnail until the full frame has arrived (krLightboxPreview in
 * lightbox.js), so nothing grey ever shows between the two. Closing does
 * the same in reverse, aimed at whichever tile matches the frame on
 * screen (the viewer may have paged through). Off under reduced motion.
 */
var krLightboxMorph = (function() {
    var ghost = null, anim = null, DUR = 380, EASE = 'cubic-bezier(0.22, 0.61, 0.36, 1)';
    function enabled() {
        return !!(window.Element && Element.prototype.animate) &&
            !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
    function thumbFor(item) {
        var el = item && item.el && item.el[0];
        var tile = el && el.closest ? el.closest('.single-portfolio-content') : null;
        return tile ? tile.querySelector('img') : null;
    }
    function rect(el) { var r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; }
    function px(v) { return parseFloat(v) || 0; }
    // The picture inside the full frame's box: the box has room for the
    // caption above and below it as padding (style.css §13).
    function pictureRect(img) {
        var r = rect(img), cs = getComputedStyle(img);
        var top = px(cs.paddingTop), bottom = px(cs.paddingBottom);
        return { left: r.left, top: r.top + top, width: r.width, height: Math.max(0, r.height - top - bottom) };
    }
    function stemOfItem(item) { return ((item && item.src) || '').split('/').pop().replace(/\.\w+$/, ''); }
    // Where Magnific will put the picture: the frame's box fitted to its
    // max-height (the viewport, less the filmstrip's room when it shows)
    // and the container's width, centred in the container. The image
    // element exists by now, still loading, so its paddings and max-height
    // are read rather than repeated here.
    function predicted(item, thumb) {
        var d = photoDims[stemOfItem(item)];
        var ar = d && d[1] ? d[0] / d[1] : (thumb ? thumb.naturalWidth / (thumb.naturalHeight || 1) : 1.5);
        var vw = window.innerWidth, vh = window.innerHeight;
        var img = item && item.img && item.img[0];
        var cs = img ? getComputedStyle(img) : null;
        var padT = cs ? px(cs.paddingTop) : 40, padB = cs ? px(cs.paddingBottom) : 40;
        var box = cs && /px$/.test(cs.maxHeight) ? px(cs.maxHeight) : vh;
        var container = img && img.closest ? img.closest('.mfp-container') : null;
        var room = vh - (container ? px(getComputedStyle(container).paddingBottom) : 0);
        var maxW = vw - 16, maxH = Math.min(box, room) - padT - padB;
        var w = maxW, h = w / ar;
        if (h > maxH) { h = maxH; w = h * ar; }
        return { left: (vw - w) / 2, top: (room - h - padT - padB) / 2 + padT, width: w, height: h };
    }
    function frame(r) { return { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' }; }
    function makeGhost(src, r) {
        kill();
        ghost = document.createElement('img');
        ghost.className = 'kr-lightbox-ghost';
        ghost.src = src;
        ghost.alt = '';
        Object.assign(ghost.style, frame(r));
        document.body.appendChild(ghost);
        return ghost;
    }
    function kill() {
        if (anim) { anim.cancel(); anim = null; }
        if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
        ghost = null;
    }
    function reveal(mfp) { if (mfp && mfp.wrap) mfp.wrap.addClass('kr-morph-in'); }
    function open(mfp) {
        if (!enabled()) return;
        var thumb = thumbFor(mfp.currItem);
        if (!thumb) { reveal(mfp); return; }
        var from = rect(thumb), to = predicted(mfp.currItem, thumb);
        var g = makeGhost(thumb.currentSrc || thumb.src, from);
        anim = g.animate([frame(from), frame(to)], { duration: DUR, easing: EASE, fill: 'forwards' });
        anim.onfinish = function() { anim = null; if (ghost === g) settle(mfp); };
        // A frame whose size never arrives (offline, a missing release
        // file) must not leave the viewer staring at a ghost: hand over to
        // Magnific's own spinner or error message after a while.
        setTimeout(function() { if (ghost === g) { kill(); reveal(mfp); } }, 5000);
    }
    // The frame's size is known (or the ghost has landed): match the real
    // box, then hand over to the lightbox's own image. ImageHasSize comes
    // a moment before Magnific shows the figure, so a box not laid out
    // yet is measured again on the next frames.
    function settle(mfp, tries) {
        if (!ghost) { reveal(mfp); return; }
        var img = mfp.currItem && mfp.currItem.img && mfp.currItem.img[0];
        if (!img || !img.naturalWidth || anim) return;   // still travelling, or no size yet
        var g = ghost, real = pictureRect(img);
        if (!real.height) {
            if ((tries || 0) < 10) {
                requestAnimationFrame(function() { if (ghost === g) settle(mfp, (tries || 0) + 1); });
            } else {
                kill();
                reveal(mfp);
            }
            return;
        }
        anim = g.animate([frame(rect(g)), frame(real)], { duration: 140, easing: 'ease-out', fill: 'forwards' });
        anim.onfinish = function() {
            anim = null;
            reveal(mfp);
            g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' }).onfinish = function() { if (ghost === g) kill(); };
        };
    }
    function change(mfp) { if (mfp.wrap && mfp.wrap.hasClass('mfp-ready')) { kill(); reveal(mfp); } }
    function close(mfp) {
        if (!enabled()) return;
        var item = mfp.currItem, thumb = thumbFor(item), img = item && item.img && item.img[0];
        if (!thumb || !img || !img.naturalWidth) { kill(); return; }
        var from = pictureRect(img);
        // The viewer may have paged well past the tile they opened.
        var tr = thumb.getBoundingClientRect();
        if (tr.bottom < 0 || tr.top > window.innerHeight) {
            thumb.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
        var to = rect(thumb);
        mfp.wrap.removeClass('kr-morph-in').addClass('kr-morph-out');
        var g = makeGhost(thumb.currentSrc || thumb.src, from);
        anim = g.animate([frame(from), frame(to)], { duration: 320, easing: EASE, fill: 'forwards' });
        anim.onfinish = function() { anim = null; if (ghost === g) kill(); };
    }
    return { enabled: enabled, open: open, settle: settle, change: change, close: close };
}());


/**
 * Lightbox filmstrip. Every frame in the set as a thumbnail along the
 * bottom of the lightbox, the current one ringed, so a viewer can see
 * where they are and jump. Thumbnails are the tiles' own images, already
 * decoded. Only where there is room for it: two or more frames, a wide
 * enough viewport, and a tall enough one that the frame does not lose
 * more than a strip's worth of height.
 */
var krLightboxStrip = (function() {
    var strip = null;
    var builtFor = 0;    // how many frames the set held when the strip was built
    function fits() {
        return window.innerWidth >= 720 && window.innerHeight >= 560;
    }
    function thumbOf(it) {
        var el = it && it.el ? it.el[0] : it;
        var tile = el && el.closest ? el.closest('.single-portfolio-content') : null;
        var img = tile ? tile.querySelector('img') : null;
        return img ? (img.currentSrc || img.src) : '';
    }
    function open(mfp) {
        // A rebuild (the set grew) keeps a keyboard user's place in it.
        var hadFocus = !!(strip && strip.contains(document.activeElement));
        var rebuilding = !!strip;
        close();
        if (!fits() || !mfp.items || mfp.items.length < 2) return;
        strip = document.createElement('div');
        strip.className = 'kr-lightbox-strip';
        strip.setAttribute('role', 'group');
        strip.setAttribute('aria-label', 'Frames in this set');
        var total = Math.max(mfp.items.length, galleryView.length);
        builtFor = mfp.items.length;
        strip.innerHTML = mfp.items.map(function(it, i) {
            var src = thumbOf(it);
            return src ? '<button type="button" class="kr-lightbox-strip__item" data-i="' + i + '" aria-label="Frame ' + (i + 1) + ' of ' + total + '">' +
                '<img src="' + src + '" alt="" loading="lazy"></button>' : '';
        }).join('');
        strip.addEventListener('click', function(e) {
            // The wrap closes on any click it takes for background; a strip
            // click is not that.
            e.stopPropagation();
            var b = e.target.closest('.kr-lightbox-strip__item');
            if (b) mfp.goTo(+b.getAttribute('data-i'));
        });
        // Buttons inside the popup wrap are exempt from its close-on-click.
        strip.classList.add('mfp-prevent-close');
        mfp.wrap.append(strip);
        mfp.wrap.addClass('kr-strip');
        var current = change(mfp, rebuilding);
        if (hadFocus && current) current.focus({ preventScroll: true });
    }
    // Ring the current frame and bring it to the middle of the strip:
    // smoothly as the viewer pages, at once when the strip was just
    // rebuilt (it would otherwise glide in from the first frame) or under
    // reduced motion. Returns the current frame's button.
    function change(mfp, instant) {
        if (!strip) return null;
        var still = instant || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        var current = null;
        var items = strip.querySelectorAll('.kr-lightbox-strip__item');
        Array.prototype.forEach.call(items, function(b) {
            var on = +b.getAttribute('data-i') === mfp.index;
            b.classList.toggle('is-current', on);
            b.setAttribute('aria-current', on ? 'true' : 'false');
            if (on) {
                current = b;
                b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: still ? 'instant' : 'smooth' });
            }
        });
        return current;
    }
    // A frame changed: ring it, or rebuild the strip when the set has grown
    // since it was drawn (growSet). Nothing before open() has built one.
    function sync(mfp) {
        if (!strip) return;
        if (mfp.items.length !== builtFor) open(mfp);
        else change(mfp);
    }
    function close() {
        if (strip && strip.parentNode) strip.parentNode.removeChild(strip);
        strip = null;
    }
    return { fits: fits, open: open, sync: sync, close: close };
}());
