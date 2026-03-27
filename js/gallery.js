/**
 * Gallery with incremental loading.
 * Shuffles all 364 images once, then renders them in batches
 * of BATCH_SIZE as the user clicks "Load More".
 */
var galleryImages = [];
var galleryIndex = 0;
var BATCH_SIZE = 24;

/**
 * Builds the initial batch of gallery images.
 * Shuffles [1..364] with Fisher-Yates, then renders the first batch.
 */
function buildImageHTML() {
  var container = document.getElementById('gallery-grid');
  if (!container) return;

  // Build array [1..364] then shuffle (Fisher-Yates)
  for (var i = 1; i <= 364; i++) { galleryImages.push(i); }
  for (var i = galleryImages.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = galleryImages[i];
    galleryImages[i] = galleryImages[j];
    galleryImages[j] = temp;
  }

  // Render first batch
  loadMoreImages();
}

/**
 * Appends the next batch of images to the gallery grid.
 * Integrates with Isotope if available, otherwise plain append.
 * Hides the "Load More" button when all images are shown.
 */
function loadMoreImages() {
  var container = document.getElementById('gallery-grid');
  if (!container) return;

  var end = Math.min(galleryIndex + BATCH_SIZE, galleryImages.length);
  var newElements = [];

  for (var i = galleryIndex; i < end; i++) {
    var num = galleryImages[i];

    var col = document.createElement('div');
    col.className = 'col-12 col-sm-6 col-lg-3 single_gallery_item mb-30';

    var wrapper = document.createElement('div');
    wrapper.className = 'single-portfolio-content';

    var img = document.createElement('img');
    img.src = 'img/bg-img/' + num + '.png';
    img.alt = 'Gallery photo ' + num;
    img.loading = 'lazy';

    var hover = document.createElement('div');
    hover.className = 'hover-content';

    var link = document.createElement('a');
    link.href = 'img/bg-img/' + num + '.png';
    link.className = 'portfolio-img';
    link.textContent = '+';

    hover.appendChild(link);
    wrapper.appendChild(img);
    wrapper.appendChild(hover);
    col.appendChild(wrapper);
    container.appendChild(col);
    newElements.push(col);
  }
  galleryIndex = end;

  // Tell Isotope about the new items (if already initialized)
  if (typeof jQuery !== 'undefined' && jQuery.fn.isotope) {
    var $grid = jQuery('.alime-portfolio');
    if ($grid.data('isotope')) {
      $grid.isotope('appended', jQuery(newElements));
      $grid.imagesLoaded(function () {
        $grid.isotope('layout');
      });
    }
  }

  // Update counter text
  var counter = document.getElementById('gallery-counter');
  if (counter) {
    counter.textContent = 'Showing ' + galleryIndex + ' of ' + galleryImages.length + ' photos';
  }

  // Hide button when all images loaded
  var btn = document.getElementById('load-more-btn');
  if (btn && galleryIndex >= galleryImages.length) {
    btn.style.display = 'none';
  }
}
