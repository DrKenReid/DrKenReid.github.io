/**
 * Site-wide image lightbox.
 * Makes all content images clickable to view full-size,
 * except images that are already wrapped in links.
 */
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    if (typeof jQuery === 'undefined' || !jQuery.fn.magnificPopup) return;

    /* Find all content images not already inside <a> tags, not in nav/header/footer/preloader */
    var containers = [
      '.about-us-area',
      '.contact-area',
      '.alime--blog-area',
      '.blog-post',
      '.bg-gray',
      'section.section-padding-80'
    ];

    containers.forEach(function(sel) {
      jQuery(sel).find('img').each(function() {
        var $img = jQuery(this);
        /* Skip if already inside a link */
        if ($img.closest('a').length > 0) return;
        /* Skip tiny images (icons, logos) */
        if ($img.width() < 80) return;
        /* Skip if already wrapped */
        if ($img.parent().hasClass('img-lightbox')) return;

        var src = $img.attr('src');
        if (!src) return;

        var $link = jQuery('<a>')
          .attr('href', src)
          .addClass('img-lightbox portfolio-img')
          .css('cursor', 'zoom-in');

        $img.wrap($link);
      });
    });

    /* Initialize Magnific Popup on our new lightbox links */
    jQuery('.img-lightbox').magnificPopup({
      type: 'image',
      gallery: {
        enabled: false
      },
      image: {
        titleSrc: function(item) {
          var img = item.el.find('img');
          return img.attr('alt') || '';
        }
      }
    });
  });
})();
