/**
 * Gallery with tag-based filtering and incremental loading.
 * Loads photo-tags.json, then renders images in batches with Isotope filter support.
 */
var galleryImages = [];
var galleryIndex = 0;
var BATCH_SIZE = 24;
var photoTags = {};
var activeFilter = '*';

/* Category display names and emoji */
var CATEGORIES = {
  landscape:    { label: 'Landscape',    emoji: '🏞️' },
  urban:        { label: 'Urban',        emoji: '🏙️' },
  architecture: { label: 'Architecture', emoji: '🏛️' },
  abandoned:    { label: 'Abandoned',    emoji: '🏚️' },
  wildlife:     { label: 'Wildlife',     emoji: '🐾' },
  nature:       { label: 'Nature',       emoji: '🌿' },
  portrait:     { label: 'Portrait',     emoji: '👤' },
  bw:           { label: 'B&W',          emoji: '⬛' },
  silhouette:   { label: 'Silhouette',   emoji: '🌅' },
  winter:       { label: 'Winter',       emoji: '❄️' }
};

/**
 * Loads tags JSON, builds filter buttons, then builds gallery.
 */
function initGallery() {
  fetch('data/photo-tags.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      photoTags = data;
      buildFilterButtons();
      buildImageHTML();
    })
    .catch(function() {
      /* Fallback: no tags, just build gallery without filters */
      buildImageHTML();
    });
}

/**
 * Builds the filter button bar above the gallery.
 */
function buildFilterButtons() {
  var container = document.getElementById('gallery-filters');
  if (!container) return;

  /* "All" button */
  var allBtn = document.createElement('button');
  allBtn.className = 'btn gallery-filter-btn active';
  allBtn.setAttribute('data-filter', '*');
  allBtn.textContent = 'All';
  allBtn.onclick = function() { filterGallery('*', this); };
  container.appendChild(allBtn);

  /* Count images per category */
  var counts = {};
  Object.keys(photoTags).forEach(function(key) {
    photoTags[key].forEach(function(tag) {
      counts[tag] = (counts[tag] || 0) + 1;
    });
  });

  /* Category buttons sorted by count descending */
  var cats = Object.keys(CATEGORIES);
  cats.sort(function(a, b) { return (counts[b] || 0) - (counts[a] || 0); });

  cats.forEach(function(cat) {
    if (!counts[cat]) return;
    var btn = document.createElement('button');
    btn.className = 'btn gallery-filter-btn';
    btn.setAttribute('data-filter', '.' + cat);
    btn.innerHTML = CATEGORIES[cat].emoji + ' ' + CATEGORIES[cat].label +
      ' <span class="filter-count">' + counts[cat] + '</span>';
    btn.onclick = function() { filterGallery('.' + cat, this); };
    container.appendChild(btn);
  });
}

/**
 * Handles filter button clicks.
 */
function filterGallery(filter, btnEl) {
  activeFilter = filter;

  /* Update active button */
  var buttons = document.querySelectorAll('.gallery-filter-btn');
  buttons.forEach(function(b) { b.classList.remove('active'); });
  btnEl.classList.add('active');

  /* If filtering and not all images loaded yet, load them all first */
  if (filter !== '*' && galleryIndex < galleryImages.length) {
    while (galleryIndex < galleryImages.length) {
      loadMoreImages(true); /* silent = don't update counter yet */
    }
  }

  /* Use Isotope if available */
  if (typeof jQuery !== 'undefined' && jQuery.fn.isotope) {
    var $grid = jQuery('.alime-portfolio');
    if ($grid.data('isotope')) {
      $grid.isotope({ filter: filter });
      updateCounter(filter);
      return;
    }
  }

  /* Fallback: manual show/hide */
  var items = document.querySelectorAll('.single_gallery_item');
  var shown = 0;
  items.forEach(function(item) {
    if (filter === '*' || item.classList.contains(filter.replace('.', ''))) {
      item.style.display = '';
      shown++;
    } else {
      item.style.display = 'none';
    }
  });
  updateCounter(filter);
}

/**
 * Updates the photo count display.
 */
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
    var catInfo = CATEGORIES[cat] || { label: cat, emoji: '' };
    counter.textContent = catInfo.emoji + ' ' + count + ' ' + catInfo.label + ' photos';
  }
}

/**
 * Builds the initial batch of gallery images.
 */
function buildImageHTML() {
  var container = document.getElementById('gallery-grid');
  if (!container) return;

  /* Build array [1..364] then shuffle (Fisher-Yates) */
  for (var i = 1; i <= 364; i++) { galleryImages.push(i); }
  for (var i = galleryImages.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = galleryImages[i];
    galleryImages[i] = galleryImages[j];
    galleryImages[j] = temp;
  }

  loadMoreImages();
}

/**
 * Appends the next batch of images to the gallery grid.
 */
function loadMoreImages(silent) {
  var container = document.getElementById('gallery-grid');
  if (!container) return;

  var end = Math.min(galleryIndex + BATCH_SIZE, galleryImages.length);
  var newElements = [];

  for (var i = galleryIndex; i < end; i++) {
    var num = galleryImages[i];
    var tags = photoTags[String(num)] || [];

    var col = document.createElement('div');
    /* Add tag classes for Isotope filtering */
    col.className = 'col-12 col-sm-6 col-lg-3 single_gallery_item mb-30 ' + tags.join(' ');

    var wrapper = document.createElement('div');
    wrapper.className = 'single-portfolio-content';

    var img = document.createElement('img');
    img.src = 'img/bg-img/' + num + '.png';
    img.alt = tags.length ? tags.join(', ') + ' photography' : 'Gallery photo ' + num;
    img.loading = 'lazy';

    var hover = document.createElement('div');
    hover.className = 'hover-content';

    var link = document.createElement('a');
    link.href = 'img/bg-img/' + num + '.png';
    link.className = 'portfolio-img';
    link.textContent = '+';

    /* Tag badges overlay */
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

  /* Tell Isotope about the new items */
  if (typeof jQuery !== 'undefined' && jQuery.fn.isotope) {
    var $grid = jQuery('.alime-portfolio');
    if ($grid.data('isotope')) {
      $grid.isotope('appended', jQuery(newElements));
      /* Re-apply current filter */
      if (activeFilter !== '*') {
        $grid.isotope({ filter: activeFilter });
      }
      $grid.imagesLoaded(function () {
        $grid.isotope('layout');
      });
    }
  }

  if (!silent) {
    updateCounter(activeFilter);
  }

  /* Re-initialize Magnific Popup for new images */
  if (typeof jQuery !== 'undefined' && jQuery.fn.magnificPopup) {
    jQuery('.portfolio-img').magnificPopup({
      type: 'image',
      gallery: {
        enabled: true,
        preload: [0, 2],
        navigateByImgClick: true,
        tPrev: 'Previous',
        tNext: 'Next'
      }
    });
  }

  /* Hide button when all images loaded */
  var btn = document.getElementById('load-more-btn');
  if (btn && galleryIndex >= galleryImages.length) {
    btn.style.display = 'none';
  }
}
