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
var photoTags = {};
var photoPlaces = {};
var activeCat = '*';

var CATEGORIES = {
    landscape: {label: 'Landscape', emoji: '🏞️'},
    urban: {label: 'Urban', emoji: '🏙️'},
    architecture: {label: 'Architecture', emoji: '🏛️'},
    abandoned: {label: 'Abandoned', emoji: '🏚️'},
    wildlife: {label: 'Wildlife', emoji: '🐾'},
    nature: {label: 'Nature', emoji: '🌿'},
    portrait: {label: 'Portrait', emoji: '👤'},
    bw: {label: 'B&W', emoji: '⬛'},
    silhouette: {label: 'Silhouette', emoji: '🌅'},
    winter: {label: 'Winter', emoji: '❄️'}
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
        fetch('/data/photo-locations.json').then(function(r) { return r.json(); }).catch(function() { return {}; })
    ]).then(function(results) {
        photoTags = results[0] || {};
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
                label: '<span aria-hidden="true">' + CATEGORIES[cat].emoji + '</span> ' + CATEGORIES[cat].label,
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
    if (masonryRelayoutTimer) clearTimeout(masonryRelayoutTimer);
    masonryRelayoutTimer = setTimeout(function() {
        if (typeof jQuery !== 'undefined' && jQuery.fn.isotope) {
            var $grid = jQuery('.alime-portfolio');
            if ($grid.data('isotope')) {
                $grid.isotope('layout');
            }
        }
    }, 150);
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
    if (container) container.innerHTML = '';
    if (typeof jQuery !== 'undefined' && jQuery.fn.isotope) {
        var $grid = jQuery('.alime-portfolio');
        if ($grid.data('isotope')) $grid.isotope('reloadItems');
    }
    var btn = document.getElementById('load-more-btn');
    if (btn) btn.style.display = '';
    loadMoreImages();
}

function updateCounter() {
    var counter = document.getElementById('gallery-counter');
    if (!counter) return;
    if (activeCat === '*') {
        counter.textContent = 'Showing ' + galleryIndex + ' of ' + galleryView.length + ' photos';
    } else {
        var catInfo = CATEGORIES[activeCat] || {label: activeCat, emoji: ''};
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
        col.className = 'col-12 col-sm-6 col-lg-3 single_gallery_item mb-30 ' + tags.join(' ');

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

    if (typeof jQuery !== 'undefined' && jQuery.fn.isotope) {
        var $grid = jQuery('.alime-portfolio');
        if ($grid.data('isotope')) {
            $grid.isotope('appended', jQuery(newElements));
            // One relayout per batch once its images have loaded (7f),
            // instead of a debounced relayout per image.
            $grid.imagesLoaded(function() {
                $grid.isotope('layout');
            });
        }
    }

    if (!silent) {
        updateCounter();
    }

    if (typeof jQuery !== 'undefined' && jQuery.fn.magnificPopup) {
        jQuery('.portfolio-img').magnificPopup({
            type: 'image',
            mainClass: 'kr-lightbox mfp-fade',
            closeOnContentClick: false,
            image: {
                titleSrc: function(item) {
                    var caption = item.el.attr('data-caption') || '';
                    var stem = (item.el.attr('href') || '').split('/').pop().replace(/\.\w+$/, '');
                    return caption + (caption ? ' <span class="kr-lightbox-num">#' + stem + '</span>'
                                              : '<span class="kr-lightbox-num">#' + stem + '</span>');
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
