/**
 * shared-components.js
 * 
 * Injects the Instagram feed section and site footer into every page.
 * To update social links, Instagram handle, or footer text, edit this
 * single file instead of all 6 HTML pages.
 */

var BLUESKY_SVG = '<svg class="bluesky-icon" viewBox="0 0 568 501" xmlns="http://www.w3.org/2000/svg"><path d="M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873c25.719-53.192 95.759-152.32 160.879-201.21C491.866-1.611 568-28.906 568 57.947c0 17.346-9.945 145.713-15.778 166.555-20.275 72.453-94.155 90.933-159.875 79.748C507.222 323.8 536.444 388.56 473.333 453.32c-119.86 122.992-172.272-30.859-185.702-70.281-2.462-7.227-3.614-10.608-3.631-7.733-.017-2.875-1.169.506-3.631 7.733-13.43 39.422-65.842 193.273-185.702 70.281-63.111-64.76-33.889-129.52 80.986-149.071-65.72 11.185-139.6-7.295-159.875-79.748C9.945 203.659 0 75.291 0 57.946 0-28.906 76.135-1.612 123.121 33.664z"/></svg>';

/**
 * Renders the "Follow Instagram" section with 6 image tiles.
 * @param {string} targetId - ID of the element to inject into.
 */
function renderInstagramSection(targetId) {
    var el = document.getElementById(targetId);
    if (!el) return;

    var instagramUrl = 'https://www.instagram.com/drkenreid/';
    var handle = 'drkenreid';
    var imageStart = 20; // Uses images 20-25

    var html = '<section class="follow-area clearfix">' +
        '<div class="container"><div class="row"><div class="col-12">' +
        '<div class="section-heading text-center">' +
        '<h2>Photo Highlights</h2>' +
        '<p><a href="' + instagramUrl + '">Follow @' + handle + ' on Instagram</a></p>' +
        '</div></div></div></div>' +
        '<div class="instragram-feed-area owl-carousel">';

    for (var i = 0; i < 6; i++) {
        html += '<div class="single-instagram-item">' +
            '<img src="img/bg-img/' + (imageStart + i) + '.png" alt="Instagram Image ' + (i + 1) + '" loading="lazy">' +
            '<div class="instagram-hover-content text-center d-flex align-items-center justify-content-center">' +
            '<a href="' + instagramUrl + '">' +
            '<i class="ti-instagram" aria-hidden="true"></i>' +
            '<span>' + handle + '</span></a></div></div>';
    }

    html += '</div></section>';
    el.innerHTML = html;

    // Initialize Owl Carousel on the injected element (active.js already ran)
    if (typeof jQuery !== 'undefined' && jQuery.fn.owlCarousel) {
        jQuery('.instragram-feed-area').owlCarousel({
            items: 6,
            loop: true,
            autoplay: true,
            smartSpeed: 1000,
            autoplayTimeout: 3000,
            responsive: {
                0: { items: 2 },
                576: { items: 3 },
                768: { items: 4 },
                992: { items: 5 },
                1200: { items: 6 }
            }
        });
    }
}

/**
 * Renders the site footer with copyright and social links.
 * @param {string} targetId - ID of the element to inject into.
 */
function renderFooter(targetId) {
    var el = document.getElementById(targetId);
    if (!el) return;

    var year = new Date().getFullYear();

    el.innerHTML = '<footer class="footer-area"><div class="container">' +
        '<div class="row"><div class="col-12">' +
        '<div class="footer-content d-flex align-items-center justify-content-between">' +
        '<div class="copywrite-text"><p>' +
        'Copyright &copy; ' + year + ' All rights reserved | This template is made with ' +
        '<i class="fa fa-heart-o" aria-hidden="true"></i> by ' +
        '<a href="https://colorlib.com" target="_blank" rel="noopener">Colorlib</a>' +
        '</p></div>' +
        '<div class="social-info">' +
        '<a href="https://bsky.app/profile/drkenreid.bsky.social" aria-label="Bluesky">' + BLUESKY_SVG + '</a>' +
        '<a href="https://www.linkedin.com/in/kennethneilreid/" aria-label="LinkedIn"><i class="ti-linkedin" aria-hidden="true"></i></a>' +
        '</div></div></div></div></div></footer>';
}
