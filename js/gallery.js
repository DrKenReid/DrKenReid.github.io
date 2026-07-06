var galleryImages=[];
var galleryIndex=0;
var BATCH_SIZE=24;
var photoTags={};
var activeFilter='*';

var CATEGORIES={
    landscape:{label:'Landscape',emoji:'🏞️'},
    urban:{label:'Urban',emoji:'🏙️'},
    architecture:{label:'Architecture',emoji:'🏛️'},
    abandoned:{label:'Abandoned',emoji:'🏚️'},
    wildlife:{label:'Wildlife',emoji:'🐾'},
    nature:{label:'Nature',emoji:'🌿'},
    portrait:{label:'Portrait',emoji:'👤'},
    bw:{label:'B&W',emoji:'⬛'},
    silhouette:{label:'Silhouette',emoji:'🌅'},
    winter:{label:'Winter',emoji:'❄️'}
};

function compareFileNames(a, b) {
    return b.localeCompare(a, undefined, {numeric: true, sensitivity: 'base'});
}

function resolveFallbackFilename(stem) {
    if (/^\d+$/.test(stem)) {
        return stem + '.png';
    }
    return stem + '.png';
}

function initGallery() {
    bindLoadMoreButton();
    Promise.all([
        fetch('data/photo-tags.json').then(function(r) { return r.json(); }),
        fetch('data/photography-files.json').then(function(r) { return r.json(); })
    ]).then(function(results) {
        photoTags = results[0] || {};
        galleryImages = Array.isArray(results[1]) ? results[1].slice().sort(compareFileNames) : [];
        buildFilterButtons();
        buildImageHTML();

        // Deep link: gallery.html?tag=wildlife applies that filter
        try {
            var wanted = new URLSearchParams(window.location.search).get('tag');
            if (wanted && CATEGORIES[wanted]) {
                var btn = document.querySelector('.gallery-filter-btn[data-filter=".' + wanted + '"]');
                if (btn) btn.click();
            }
        } catch (e) {}
    }).catch(function() {
        photoTags = photoTags || {};
        galleryImages = Object.keys(photoTags).sort(compareFileNames);
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
    }
}

function buildFilterButtons() {
    var container = document.getElementById('gallery-filters');
    if (!container) return;

    var allBtn = document.createElement('button');
    allBtn.className = 'btn gallery-filter-btn active';
    allBtn.setAttribute('data-filter', '*');
    allBtn.textContent = 'All';
    allBtn.onclick = function() {
        filterGallery('*', this);
    };
    container.appendChild(allBtn);

    var counts = {};
    Object.keys(photoTags).forEach(function(key) {
        photoTags[key].forEach(function(tag) {
            counts[tag] = (counts[tag] || 0) + 1;
        });
    });

    var cats = Object.keys(CATEGORIES);
    cats.sort(function(a, b) {
        return (counts[b] || 0) - (counts[a] || 0);
    });

    cats.forEach(function(cat) {
        if (!counts[cat]) return;
        var btn = document.createElement('button');
        btn.className = 'btn gallery-filter-btn';
        btn.setAttribute('data-filter', '.' + cat);
        btn.innerHTML = CATEGORIES[cat].emoji + ' ' + CATEGORIES[cat].label +
            ' <span class="filter-count">' + counts[cat] + '</span>';
        btn.onclick = function() {
            filterGallery('.' + cat, this);
        };
        container.appendChild(btn);
    });
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

function filterGallery(filter, btnEl) {
    activeFilter = filter;
    var buttons = document.querySelectorAll('.gallery-filter-btn');
    buttons.forEach(function(b) {
        b.classList.remove('active');
    });
    btnEl.classList.add('active');

    if (filter !== '*' && galleryIndex < galleryImages.length) {
        while (galleryIndex < galleryImages.length) {
            loadMoreImages(true);
        }
    }

    if (typeof jQuery !== 'undefined' && jQuery.fn.isotope) {
        var $grid = jQuery('.alime-portfolio');
        if ($grid.data('isotope')) {
            $grid.isotope({filter: filter});
            updateCounter(filter);
            return;
        }
    }

    var items = document.querySelectorAll('.single_gallery_item');
    items.forEach(function(item) {
        if (filter === '*' || item.classList.contains(filter.replace('.', ''))) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
    updateCounter(filter);
}

function updateCounter(filter) {
    var counter = document.getElementById('gallery-counter');
    if (!counter) return;

    if (filter === '*') {
        counter.textContent = 'Showing ' + galleryIndex + ' of ' + galleryImages.length + ' photos';
    } else {
        var cat = filter.replace('.', '');
        var count = 0;
        Object.keys(photoTags).forEach(function(k) {
            if (photoTags[k].indexOf(cat) !== -1) count++;
        });
        var catInfo = CATEGORIES[cat] || {label: cat, emoji: ''};
        counter.textContent = catInfo.emoji + ' ' + count + ' ' + catInfo.label + ' photos';
    }
}

function buildImageHTML() {
    var container = document.getElementById('gallery-grid');
    if (!container) return;
    var totalEl = document.getElementById('gallery-total-count');
    if (totalEl) totalEl.textContent = galleryImages.length;
    loadMoreImages();
}

function loadMoreImages(silent) {
    var container = document.getElementById('gallery-grid');
    if (!container) return;

    var end = Math.min(galleryIndex + BATCH_SIZE, galleryImages.length);
    var newElements = [];

    for (var i = galleryIndex; i < end; i++) {
        var filename = galleryImages[i];
        var stem = filename.lastIndexOf('.') > -1 ? filename.slice(0, filename.lastIndexOf('.')) : filename;
        var tags = photoTags[String(stem)] || [];

        var col = document.createElement('div');
        col.className = 'col-12 col-sm-6 col-lg-3 single_gallery_item mb-30 ' + tags.join(' ');

        var wrapper = document.createElement('div');
        wrapper.className = 'single-portfolio-content';

        var img = document.createElement('img');
        img.src = 'img/photography/thumb/' + stem + '.webp';
        img.alt = tags.length ? tags.join(', ') + ' photography' : 'Gallery photo ' + stem;
        img.loading = 'lazy';
        // Natural-height masonry: every late lazy-load changes tile height,
        // so nudge isotope to re-layout (debounced).
        img.addEventListener('load', scheduleMasonryRelayout);
        img.onerror = function() {
            var tile = this.closest('.single_gallery_item');
            if (tile && tile.parentNode) {
                tile.parentNode.removeChild(tile);
            }
        };

        var hover = document.createElement('div');
        hover.className = 'hover-content';

        var link = document.createElement('a');
        link.href = 'https://github.com/DrKenReid/DrKenReid.github.io/releases/download/photos-v1/' + filename;
        link.className = 'portfolio-img';
        link.textContent = '+';
        link.setAttribute('data-caption', tags.map(function(t) {
            var cat = CATEGORIES[t];
            return cat ? cat.label : t;
        }).join(' · '));

        if (tags.length) {
            var badgeWrap = document.createElement('div');
            badgeWrap.className = 'tag-badges';
            tags.forEach(function(tag) {
                var badge = document.createElement('span');
                badge.className = 'tag-badge tag-' + tag;
                var cat = CATEGORIES[tag];
                badge.textContent = cat ? cat.emoji : tag;
                badge.title = cat ? cat.label : tag;
                badgeWrap.appendChild(badge);
            });
            hover.appendChild(badgeWrap);
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
            if (activeFilter !== '*') {
                $grid.isotope({filter: activeFilter});
            }
            $grid.imagesLoaded(function() {
                $grid.isotope('layout');
            });
        }
    }

    if (!silent) {
        updateCounter(activeFilter);
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
            gallery: {enabled: true, preload: [0, 2], navigateByImgClick: true, tPrev: 'Previous', tNext: 'Next'}
        });
    }

    var btn = document.getElementById('load-more-btn');
    if (btn && galleryIndex >= galleryImages.length) {
        btn.style.display = 'none';
    }
}
