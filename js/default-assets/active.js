/**
 * active.js
 *
 * Page-specific jQuery plugin inits, and nothing else. Everything that runs
 * on every page (navigation, sticky header, parallax heroes, scroll-to-top,
 * href="#" guard) now lives in js/site.js, which is vanilla and
 * dependency-free.
 *
 * This file is only loaded by pages that genuinely need a jQuery plugin out
 * of js/alime.bundle.js:
 *   - owlCarousel  : the homepage welcome slider, and the photo strip
 *                    shared-components.js injects
 *   - magnificPopup: .portfolio-img links written into a page's markup
 *                    (js/lightbox.js binds content images, js/gallery.js
 *                    the gallery grid)
 *
 * Removed as dead rather than ported: the .video-play-btn iframe popup
 * (replaced by the kr-embed facade), the .search-btn / .search-form toggle
 * and the .portfolio-menu isotope filter (no such markup on the site), the
 * Bootstrap tooltip init (no data-toggle attribute anywhere), and the
 * isotope masonry init (gallery.js lays the grid out in justified rows).
 */
(function ($) {
    'use strict';

    // *********************************
    // :: Carousel contract
    // *********************************
    //
    // Every auto-playing owl carousel goes through addCarouselPauseControl:
    // the homepage hero below, and the photo strip shared-components.js
    // injects (renderPhotoStrip). Call it straight after owlCarousel()
    // with the carousel, the element its button sits in, a noun for the
    // label ("slideshow") and the timeout to resume with. The carousel gets:
    //
    //   - A pause/play button (WCAG 2.2.2) labelled with the action it will
    //     take: "Pause slideshow", then "Play slideshow". No aria-pressed:
    //     on a button whose label also flips, a pressed state reads
    //     backwards ("Play slideshow, pressed" while it is paused).
    //   - A still start under prefers-reduced-motion, through the same
    //     setPaused(true) the button uses, so it holds exactly as a pause
    //     does. autoplay:false alone is not enough: Owl's touchend handler
    //     restarts autoplay without asking whether it was running, so the
    //     first tap would set the carousel going.
    //   - A hold while keyboard focus is inside it, released when focus
    //     leaves, so a slide never rotates away from under a focused link.
    //   - inert on every slide that is not showing, reapplied whenever it
    //     moves. Off-screen slides and the clones Owl makes for looping
    //     otherwise stay in the tab order: the hero had fifteen links in
    //     it for the three on screen.
    //
    // Arrows, where a carousel has them, are real buttons (navElement) with
    // names, shown on :focus-visible by style.css. Owl 2.2 builds its nav
    // and dots as divs, which no keyboard can reach.
    window.addCarouselPauseControl = function (carousel, container, label, resumeTimeout) {
        if (!carousel || !carousel.length || !container || !container.length) return;
        var userPaused = false;
        var focusHeld = false;
        var initial = null;   // the carousel's own autoplay settings
        var btn = $('<button type="button" class="carousel-pause-btn"></button>');

        // Owl restarts autoplay from four of its own handlers: mouseover,
        // mouseleave, touchstart and touchend. Three check whether the
        // carousel is still rotating; touchend does not, so on a touch
        // device the tap that pauses the slideshow also resumed it. All
        // four are gated on autoplayHoverPause. Owl also re-arms its timer
        // on every slide change while settings.autoplay is true, even
        // after stop.owl.autoplay, so an arrow press or a swipe on a paused
        // carousel set it rotating again one timeout later; and a resize
        // rebuilds settings from options, which undid both. So a hold turns
        // autoplay and autoplayHoverPause off in options and settings
        // alike, and a release puts back whatever the carousel started
        // with. WCAG 2.2.2 asks for a mechanism to stop movement, not one
        // that mostly works.
        function setAutoplay(on) {
            var core = carousel.data('owl.carousel');
            if (!core || !core.settings) return;
            if (!initial) {
                initial = {
                    autoplay: !!core.settings.autoplay,
                    hover: !!core.settings.autoplayHoverPause
                };
            }
            var run = on && initial.autoplay;
            [core.options, core.settings].forEach(function (o) {
                if (!o) return;
                o.autoplay = run;
                o.autoplayHoverPause = run && initial.hover;
            });
            if (run) {
                carousel.trigger('play.owl.autoplay', [resumeTimeout]);
            } else {
                carousel.trigger('stop.owl.autoplay');
            }
        }

        function sync() {
            setAutoplay(!userPaused && !focusHeld);
        }

        function render() {
            var action = (userPaused ? 'Play ' : 'Pause ') + label;
            btn.attr('aria-label', action)
                .attr('title', action)
                .html(userPaused
                    ? '<i class="ti-control-play" aria-hidden="true"></i>'
                    : '<i class="ti-control-pause" aria-hidden="true"></i>');
        }

        function setPaused(paused) {
            userPaused = paused;
            sync();
            render();
        }

        btn.on('click', function () {
            setPaused(!userPaused);
        });

        carousel.on('focusin', function () {
            if (focusHeld) return;
            focusHeld = true;
            sync();
        });
        carousel.on('focusout', function (e) {
            if (e.relatedTarget && carousel[0].contains(e.relatedTarget)) return;
            focusHeld = false;
            sync();
        });

        function inertHiddenSlides() {
            carousel.find('.owl-item').each(function () {
                this.toggleAttribute('inert', !$(this).hasClass('active'));
            });
        }

        // initialized: in case this is ever called before owlCarousel().
        carousel.on('initialized.owl.carousel', sync);
        carousel.on('initialized.owl.carousel translated.owl.carousel refreshed.owl.carousel', inertHiddenSlides);
        inertHiddenSlides();

        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
        if (reduce && reduce.matches) {
            setPaused(true);
        } else {
            render();
        }
        // A reader who turns reduced motion on mid-visit gets the same.
        if (reduce && reduce.addEventListener) {
            reduce.addEventListener('change', function (e) {
                if (e.matches && !userPaused) setPaused(true);
            });
        }

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
            navElement: 'button type="button"',
            navText: [
                '<i class="ti-arrow-left" aria-hidden="true"></i>',
                '<i class="ti-arrow-right" aria-hidden="true"></i>'
            ],
            // The theme never styled Owl's dots, so they were invisible
            // divs; the arrows and the pause button are the controls.
            dots: false
        });
        welcomeSlider.find('.owl-prev').attr('aria-label', 'Previous slide');
        welcomeSlider.find('.owl-next').attr('aria-label', 'Next slide');

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
    // :: Static lightbox links
    // *********************************

    // .portfolio-img links written into a page's markup open as one set.
    // Most of them also carry img-lightbox, which js/lightbox.js rebinds
    // as single images once the DOM is ready, so in practice this set is
    // what a page gets only where lightbox.js is absent. The gallery grid
    // is excluded: gallery.js binds its tiles itself, and two bindings on
    // one link would open two popups.
    if ($.fn.magnificPopup) {
        $('.portfolio-img').not('#gallery-grid .portfolio-img').magnificPopup({
            type: 'image',
            gallery: {
                enabled: true,
                preload: [0, 2],
                navigateByImgClick: true,
                tPrev: 'Previous',
                tNext: 'Next'
            },
            // Every such set on the site is photographs (about.html and
            // the posts' release frames), so the viewer says so.
            callbacks: {
                open: function () { if (window.krLightboxA11y) window.krLightboxA11y(this, { noun: 'Photograph' }); },
                change: function () { if (window.krLightboxA11y) window.krLightboxA11y(this, { noun: 'Photograph' }); }
            }
        });
    }

})(jQuery);
