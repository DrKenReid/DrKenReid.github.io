/**
 * gallery.js — photo grid with CLIP-tag filters.
 *
 * Data: photo-tags.json (stem -> tags), photography-files.json (master list),
 * photo-locations.json (region names for tile captions).
 *
 * Filtering rebuilds the grid from a filtered list and keeps batching
 * (review 6d) instead of force-loading every photo so Isotope can hide
 * them. Filter buttons come from the shared renderFilterBar (3a/2e).
 */
var galleryAll = [];
var galleryView = [];
var galleryIndex = 0;
var BATCH_SIZE = 24;
var photoDims = {};          // stem -> [w, h], from data/photo-dims.json
var justifyTimer = null;
var photoTags = {};
var photoPlaces = {};
var activeCat = '*';

// Labels only. These were prefixed with emoji, which render at a different
// size and style on every platform and sat oddly beside the subset icon
// fonts used elsewhere. Themify has no paw, snowflake or sunrise glyph, so
// substituting icons would read worse than the plain labels do.
var CATEGORIES = {
    landscape: {label: 'Landscape'},
    urban: {label: 'Urban'},
    architecture: {label: 'Architecture'},
    abandoned: {label: 'Abandoned'},
    wildlife: {label: 'Wildlife'},
    nature: {label: 'Nature'},
    portrait: {label: 'Portrait'},
    bw: {label: 'B&W'},
    silhouette: {label: 'Silhouette'},
    winter: {label: 'Winter'}
};

function compareFileNames(a, b) {
    return b.localeCompare(a, undefined, {numeric: true, sensitivity: 'base'});
}

function stemOf(filename) {
    var dot = filename.lastIndexOf('.');
    return dot > -1 ? filename.slice(0, dot) : filename;
}

function initGallery() {
    bindLoadMoreButton();
    Promise.all([
        fetch('/data/photo-tags.json').then(function(r) { return r.json(); }),
        fetch('/data/photography-files.json').then(function(r) { return r.json(); }),
        fetch('/data/photo-locations.json').then(function(r) { return r.json(); }).catch(function() { return {}; }),
        fetch('/data/photo-dims.json').then(function(r) { return r.json(); }).catch(function() { return {}; })
    ]).then(function(results) {
        photoTags = results[0] || {};
        photoDims = results[3] || {};
        galleryAll = Array.isArray(results[1]) ? results[1].slice().sort(compareFileNames) : [];
        photoPlaces = {};
        ((results[2] || {}).regions || []).forEach(function(region) {
            (region.photos || []).forEach(function(stem) { photoPlaces[String(stem)] = region.name; });
        });
        galleryView = galleryAll;
        buildFilterButtons();
        buildImageHTML();
    }).catch(function() {
        photoTags = photoTags || {};
        galleryAll = Object.keys(photoTags).sort(compareFileNames);
        galleryView = galleryAll;
        buildFilterButtons();
        buildImageHTML();
    });
}

function bindLoadMoreButton() {
    var btn = document.getElementById('load-more-btn');
    if (btn && !btn.dataset.bound) {
        btn.addEventListener('click', function() {
            loadMoreImages();
        });
        btn.dataset.bound = 'true';
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function(entries) {
                entries.forEach(function(entry) {
                    if (entry.isIntersecting && galleryIndex < galleryView.length) {
                        loadMoreImages();
                    }
                });
            }, { rootMargin: '600px 0px' }).observe(btn);
        }
    }
}

function buildFilterButtons() {
    var container = document.getElementById('gallery-filters');
    if (!container || typeof renderFilterBar !== 'function') return;

    var counts = {};
    Object.keys(photoTags).forEach(function(key) {
        photoTags[key].forEach(function(tag) {
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
    var bar = renderFilterBar(container, items, {
        multi: false,
        onChange: function(activeKeys) {
            filterGallery(activeKeys.length ? activeKeys[0] : '*');
        }
    });

    // Deep link: gallery.html?tag=wildlife applies that filter
    try {
        var wanted = new URLSearchParams(window.location.search).get('tag');
        if (wanted && CATEGORIES[wanted] && counts[wanted]) {
            bar.setActive([wanted]);
        }
    } catch (e) {}
}

var masonryRelayoutTimer = null;
function scheduleMasonryRelayout() {
    if (justifyTimer) clearTimeout(justifyTimer);
    justifyTimer = setTimeout(layoutJustified, 60);
}

/**
 * Justified rows. Each row is filled with frames at a common height, the
 * height chosen so the row's widths sum to the container: panoramas run
 * wide, portraits stand tall, and nothing is cropped to a column. Aspect
 * ratios come from photo-dims.json, so the layout is correct before the
 * thumbnails have loaded; a frame without a recorded size is assumed 3:2.
 *
 * The final row is left at the target height rather than stretched, so a
 * lone portrait at the end of a filter never becomes a mural.
 */
function layoutJustified() {
    var grid = document.getElementById('gallery-grid');
    if (!grid || !grid.classList.contains('kr-justified')) return;
    var width = grid.clientWidth;
    if (!width) return;
    var gap = 6;
    var target = width < 640 ? 170 : (width < 1000 ? 220 : 260);
    var tiles = Array.prototype.filter.call(grid.children, function(el) {
        return el.classList.contains('single_gallery_item');
    });
    var row = [], sum = 0;

    function flush(last) {
        if (!row.length) return;
        var gaps = gap * (row.length - 1);
        var h = (width - gaps) / sum;
        // A short last row keeps the target height; a nearly full one may
        // stretch a little so the bottom edge stays straight.
        var loose = last && h > target * 1.35;
        if (loose) h = target;
        row.forEach(function(t) {
            var ar = t._ar;
            var w = Math.floor(ar * h);
            t.style.width = w + 'px';
            t.style.height = Math.round(h) + 'px';
            t.classList.toggle('kr-justified__loose', loose);
        });
        row = []; sum = 0;
    }

    tiles.forEach(function(t) {
        if (!t._ar) {
            var d = photoDims[t.getAttribute('data-stem')];
            t._ar = d && d[1] ? d[0] / d[1] : 1.5;
        }
        row.push(t);
        sum += t._ar;
        if (sum * target + gap * (row.length - 1) >= width) flush(false);
    });
    flush(true);
}

if (typeof window !== 'undefined') {
    window.addEventListener('resize', scheduleMasonryRelayout);
}

/* Rebuild the grid from the filtered list, batched (6d): no more
   force-loading the entire archive so Isotope can hide most of it. */
function filterGallery(cat) {
    activeCat = cat;
    galleryView = cat === '*' ? galleryAll : galleryAll.filter(function(filename) {
        var tags = photoTags[String(stemOf(filename))] || [];
        return tags.indexOf(cat) !== -1;
    });
    galleryIndex = 0;

    var container = document.getElementById('gallery-grid');
    var btn = document.getElementById('load-more-btn');
    function rebuild() {
        if (container) container.innerHTML = '';
        if (btn) btn.style.display = '';
        loadMoreImages();
    }
    krGalleryMorph(container, rebuild);
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
    if (activeCat === '*') {
        counter.textContent = 'Showing ' + galleryIndex + ' of ' + galleryView.length + ' photos';
    } else {
        var catInfo = CATEGORIES[activeCat] || {label: activeCat};
        counter.textContent = 'Showing ' + galleryIndex + ' of ' + galleryView.length + ' ' + catInfo.label + ' photos';
    }
}

function buildImageHTML() {
    var container = document.getElementById('gallery-grid');
    if (!container) return;
    var totalEl = document.getElementById('gallery-total-count');
    if (totalEl) totalEl.textContent = galleryAll.length;
    loadMoreImages();
}

function loadMoreImages(silent) {
    var container = document.getElementById('gallery-grid');
    if (!container) return;

    var end = Math.min(galleryIndex + BATCH_SIZE, galleryView.length);
    var newElements = [];

    for (var i = galleryIndex; i < end; i++) {
        var filename = galleryView[i];
        var stem = stemOf(filename);
        var tags = photoTags[String(stem)] || [];

        var col = document.createElement('div');
        col.className = 'single_gallery_item ' + tags.join(' ');
        col.setAttribute('data-stem', String(stem));

        var wrapper = document.createElement('div');
        wrapper.className = 'single-portfolio-content';

        var tagLabels = tags.map(function(t) {
            var cat = CATEGORIES[t];
            return cat ? cat.label : t;
        }).join(' · ');
        var place = photoPlaces[String(stem)] || '';

        var img = document.createElement('img');
        img.src = '/img/photography/thumb/' + stem + '.webp';
        img.alt = 'Photograph ' + stem + (tagLabels ? ' (' + tagLabels + ')' : '') + (place ? ', taken near ' + place : '');
        img.loading = 'lazy';
        img.onerror = function() {
            var tile = this.closest('.single_gallery_item');
            if (tile && tile.parentNode) {
                tile.parentNode.removeChild(tile);
                scheduleMasonryRelayout();
            }
        };

        var hover = document.createElement('div');
        hover.className = 'hover-content';

        var link = document.createElement('a');
        link.href = (typeof KR_RELEASE !== 'undefined'
            ? KR_RELEASE
            : 'https://github.com/DrKenReid/DrKenReid.github.io/releases/download/photos-v1/') + filename;
        link.className = 'portfolio-img';
        link.textContent = '+';
        link.setAttribute('aria-label', 'View photograph ' + stem + ' full size');
        link.setAttribute('data-caption', tagLabels + (place ? (tagLabels ? ' — ' : '') + place : ''));
        if (place) link.setAttribute('data-place', place);

        if (tagLabels || place) {
            var caption = document.createElement('div');
            caption.className = 'kr-tile-caption';
            caption.innerHTML = (tagLabels ? '<span class="kr-tile-tags">' + tagLabels + '</span>' : '') +
                (place ? '<a class="kr-tile-place" href="map.html?region=' + encodeURIComponent(place) + '" title="See this place on the photo map">' + place + '</a>' : '');
            hover.appendChild(caption);
        }

        hover.appendChild(link);
        wrapper.appendChild(img);
        wrapper.appendChild(hover);
        col.appendChild(wrapper);
        container.appendChild(col);
        newElements.push(col);
    }

    galleryIndex = end;

    // Sizes come from photo-dims.json, so the new batch can be laid out
    // now rather than after its images arrive.
    layoutJustified();

    if (!silent) {
        updateCounter();
    }

    if (typeof jQuery !== 'undefined' && jQuery.fn.magnificPopup) {
        jQuery('.portfolio-img').magnificPopup({
            type: 'image',
            mainClass: 'kr-lightbox mfp-fade' + (krLightboxMorph.enabled() ? ' kr-morph' : ''),
            closeOnContentClick: false,
            removalDelay: krLightboxMorph.enabled() ? 340 : 0,
            callbacks: {
                open: function() { krLightboxStrip.open(this); krLightboxMorph.open(this); },
                imageLoadComplete: function() { krLightboxMorph.settle(this); },
                change: function() { krLightboxMorph.change(this); krLightboxStrip.change(this); },
                beforeClose: function() { krLightboxMorph.close(this); },
                afterClose: function() { krLightboxStrip.close(); }
            },
            image: {
                titleSrc: function(item) {
                    var caption = item.el.attr('data-caption') || '';
                    var place = item.el.attr('data-place') || '';
                    var stem = (item.el.attr('href') || '').split('/').pop().replace(/\.\w+$/, '');
                    var mapLink = place
                        ? ' <a class="kr-lightbox-map" href="map.html?region=' + encodeURIComponent(place) + '">See this place on the map &rarr;</a>'
                        : '';
                    return caption + (caption ? ' <span class="kr-lightbox-num">#' + stem + '</span>'
                                              : '<span class="kr-lightbox-num">#' + stem + '</span>') + mapLink;
                }
            },
            gallery: {enabled: true, preload: [0, 2], navigateByImgClick: false, tPrev: 'Previous', tNext: 'Next'}
        });
    }

    var btn = document.getElementById('load-more-btn');
    if (btn && galleryIndex >= galleryView.length) {
        btn.style.display = 'none';
    }
}


/**
 * Lightbox morph. Magnific cross-fades; this grows the thumbnail you
 * clicked into the full frame instead, and shrinks it back on close.
 *
 * A ghost <img> (the thumbnail's own source, so it is already decoded)
 * is fixed over the tile, then animated to where the full image will
 * sit. That box is predicted from photo-dims.json because the full
 * frame comes from the photos release and can take a moment; once it
 * has loaded the ghost is nudged to the real box and removed, and the
 * lightbox content is revealed underneath. Closing does the same in
 * reverse, aimed at whichever tile matches the frame on screen (the
 * viewer may have paged through). Off under reduced motion.
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
    function stemOfItem(item) { return ((item && item.src) || '').split('/').pop().replace(/\.\w+$/, ''); }
    // Where Magnific will put the frame: fitted to the viewport height
    // (verticalFit) and the container width, centred.
    function predicted(item, thumb) {
        var d = photoDims[stemOfItem(item)];
        var ar = d && d[1] ? d[0] / d[1] : (thumb ? thumb.naturalWidth / (thumb.naturalHeight || 1) : 1.5);
        var vw = window.innerWidth, vh = window.innerHeight;
        var maxW = vw - 16, maxH = vh - (krLightboxStrip.fits() ? 112 : 80);
        var w = maxW, h = w / ar;
        if (h > maxH) { h = maxH; w = h * ar; }
        return { left: (vw - w) / 2, top: (vh - h) / 2 - 12, width: w, height: h };
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
        // A frame that never arrives (offline, a missing release file) must
        // not leave the viewer staring at a ghost: hand over to Magnific's
        // own error message after a while.
        setTimeout(function() { if (ghost === g) { kill(); reveal(mfp); } }, 5000);
    }
    // The full frame has arrived (or the ghost has landed): match the
    // real box, then hand over to the lightbox's own image.
    function settle(mfp) {
        if (!ghost) { reveal(mfp); return; }
        var img = mfp.currItem && mfp.currItem.img && mfp.currItem.img[0];
        if (!img || !img.naturalWidth || anim) return;   // still travelling, or still loading
        var g = ghost, real = rect(img);
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
        var from = rect(img);
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
        close();
        if (!fits() || !mfp.items || mfp.items.length < 2) return;
        strip = document.createElement('div');
        strip.className = 'kr-lightbox-strip';
        strip.setAttribute('role', 'group');
        strip.setAttribute('aria-label', 'Frames in this set');
        strip.innerHTML = mfp.items.map(function(it, i) {
            var src = thumbOf(it);
            return src ? '<button type="button" class="kr-lightbox-strip__item" data-i="' + i + '" aria-label="Frame ' + (i + 1) + ' of ' + mfp.items.length + '">' +
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
        change(mfp);
    }
    function change(mfp) {
        if (!strip) return;
        var items = strip.querySelectorAll('.kr-lightbox-strip__item');
        Array.prototype.forEach.call(items, function(b) {
            var on = +b.getAttribute('data-i') === mfp.index;
            b.classList.toggle('is-current', on);
            b.setAttribute('aria-current', on ? 'true' : 'false');
            if (on) b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
        });
    }
    function close() {
        if (strip && strip.parentNode) strip.parentNode.removeChild(strip);
        strip = null;
    }
    return { fits: fits, open: open, change: change, close: close };
}());
