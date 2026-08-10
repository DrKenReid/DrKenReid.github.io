/**
 * active.js
 *
 * Page-specific jQuery plugin inits, and nothing else. Everything that runs
 * on every page (preloader, navigation, sticky header, parallax heroes,
 * scroll-to-top, href="#" guard) now lives in js/site.js, which is vanilla
 * and dependency-free.
 *
 * This file is only loaded by pages that genuinely need a jQuery plugin out
 * of js/alime.bundle.js:
 *   - owlCarousel  : the homepage welcome slider, and the photo strip
 *                    shared-components.js injects
 *   - isotope      : the gallery masonry grid
 *   - magnificPopup: the image lightboxes (js/lightbox.js, js/gallery.js)
 *
 * Removed as dead rather than ported: the .video-play-btn iframe popup
 * (replaced by the kr-embed facade), the .search-btn / .search-form toggle
 * and the .portfolio-menu isotope filter (no such markup on the site), and
 * the Bootstrap tooltip init (no data-toggle attribute anywhere).
 */
(function ($) {
    'use strict';

    // Accessible pause/play toggle for auto-playing owl carousels (WCAG 2.2.2).
    // Called from here for the welcome slider and from shared-components.js
    // for the photo strip.
    window.addCarouselPauseControl = function (carousel, container, label, resumeTimeout) {
        if (!carousel || !carousel.length || !container || !container.length) return;
        var btn = $('<button type="button" class="carousel-pause-btn" aria-pressed="false"></button>')
            .attr('aria-label', 'Pause ' + label)
            .attr('title', 'Pause ' + label)
            .html('<i class="ti-control-pause" aria-hidden="true"></i>');
        btn.on('click', function () {
            var paused = btn.attr('aria-pressed') === 'true';
            if (paused) {
                carousel.trigger('play.owl.autoplay', [resumeTimeout]);
            } else {
                carousel.trigger('stop.owl.autoplay');
            }
            btn.attr('aria-pressed', String(!paused))
                .attr('aria-label', (paused ? 'Pause ' : 'Play ') + label)
                .attr('title', (paused ? 'Pause ' : 'Play ') + label)
                .html(paused
                    ? '<i class="ti-control-pause" aria-hidden="true"></i>'
                    : '<i class="ti-control-play" aria-hidden="true"></i>');
        });
        container.append(btn);
    };

    // *********************************
    // :: Welcome slides (index.html)
    // *********************************

    if ($.fn.owlCarousel) {
        var welcomeSlider = $('.welcome-slides');
        welcomeSlider.owlCarousel({
            items: 1,
            loop: true,
            autoplay: true,
            autoplayHoverPause: true,
            smartSpeed: 1000,
            autoplayTimeout: 10000,
            nav: true,
            navText: [('<i class="ti-arrow-left"></i>'), ('<i class="ti-arrow-right"></i>')]
        })

        window.addCarouselPauseControl(welcomeSlider, $('.welcome-area'), 'slideshow', 10000);

        welcomeSlider.on('translate.owl.carousel', function () {
            var layer = $("[data-animation]");
            layer.each(function () {
                var anim_name = $(this).data('animation');
                $(this).removeClass('animated ' + anim_name).css('opacity', '0');
            });
        });

        $("[data-delay]").each(function () {
            var anim_del = $(this).data('delay');
            $(this).css('animation-delay', anim_del);
        });

        $("[data-duration]").each(function () {
            var anim_dur = $(this).data('duration');
            $(this).css('animation-duration', anim_dur);
        });

        welcomeSlider.on('translated.owl.carousel', function () {
            var layer = welcomeSlider.find('.owl-item.active').find("[data-animation]");
            layer.each(function () {
                var anim_name = $(this).data('animation');
                $(this).addClass('animated ' + anim_name).css('opacity', '1');
            });
        });
    }

    // The photo strip is injected (and its carousel initialised) by
    // shared-components.js after this script runs, so no init happens here.

    // *********************************
    // :: Masonry gallery (gallery.html)
    // *********************************

    if ($.fn.imagesLoaded) {
        $('.alime-portfolio').imagesLoaded(function () {
            $('.alime-portfolio').isotope({
                itemSelector: '.single_gallery_item',
                percentPosition: true,
                masonry: {
                    columnWidth: '.single_gallery_item'
                }
            });
        });
    }

    // *********************************
    // :: Image lightboxes
    // *********************************

    if ($.fn.magnificPopup) {
        $('.portfolio-img').magnificPopup({
            type: 'image',
            gallery: {
                enabled: true,
                preload: [0, 2],
                navigateByImgClick: true,
                tPrev: 'Previous',
                tNext: 'Next'
            },
            callbacks: {
                open: function() { $('#theme-toggle').css('visibility', 'hidden'); },
                close: function() { $('#theme-toggle').css('visibility', ''); }
            }
        });
    }

})(jQuery);
