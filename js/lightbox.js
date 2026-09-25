/**
 * lightbox.js: click-to-enlarge for the images in page content, and the
 * dialog semantics every Magnific lightbox on the site shares.
 *
 * Which images
 *   When the DOM is ready, every <img> inside one of CONTAINERS (the
 *   content blocks of the page templates: intro and about bands, the
 *   contact page, blog listings and posts, grey bands, and the 80px
 *   section wrappers) is wrapped in <a class="img-lightbox" href="<its
 *   src>">, and those links open a single-image Magnific popup captioned
 *   with the image's alt text. Links a page already marks img-lightbox
 *   (the posts' release-hosted photographs) are bound the same way.
 *
 * Which images are skipped
 *   - One already inside a link. It has somewhere to go, and links cannot
 *     nest.
 *   - One with alt="". The page has declared it decoration; an enlarge
 *     link around it would be a tab stop with nothing to announce.
 *   - One rendered narrower than MIN_WIDTH: icons, avatars and badges.
 *   - One with no src.
 *   Images built after the DOM is ready (the gallery grid, the photo strip,
 *   anything rendered from JSON) are never seen here; whatever builds them
 *   owns their links.
 *
 * Why the link wraps the image
 *   The picture itself becomes the control: one tab stop and one tap, a
 *   focus ring around the thing that will be enlarged, and an accessible
 *   name that comes from the alt text the page already wrote. A separate
 *   "enlarge" button beside each image would need a name of its own and
 *   would double the tab stops. The links deliberately do not get the
 *   gallery's portfolio-img class, which active.js binds as a multi-image
 *   set: these open one image each.
 *
 * krLightboxA11y(mfp, opts)
 *   Magnific builds its overlay from plain divs, so a screen reader meets
 *   an unnamed region, a close button called "multiplication sign", and
 *   no word about where it is in a set. Every popup on the site calls this
 *   from its open and change callbacks (here, active.js, gallery.js, and
 *   openKrLightbox in shared-components.js for the photo map).
 *   It names the overlay as a modal dialog ("Image viewer"), names the
 *   close button, keeps a polite live region saying "Image n of N:
 *   caption" as a set is browsed ("Image: caption" where there is one),
 *   and hides the fixed page controls that sit above the overlay (the
 *   theme toggle and scroll-to-top, PAGE_CHROME) while the popup is open.
 *   This is the one place they are hidden; no popup needs callbacks of
 *   its own for it. opts.noun replaces "Image" where every frame is known
 *   to be one kind of thing: the gallery, the photo map and the posts'
 *   photograph sets pass 'Photograph'. The content images wrapped here
 *   keep the default, because a post's charts and diagrams are wrapped
 *   the same way as its pictures.
 *   krLightboxA11y.announce(mfp, text) speaks a one-off message through
 *   the same region, for actions inside a popup such as copying a link.
 */
(function ($) {
    'use strict';

    if (!$) return;

    var CONTAINERS = [
        '.about-us-area',
        '.contact-area',
        '.alime--blog-area',
        '.blog-post',
        '.bg-gray',
        'section.section-padding-80'
    ].join(', ');

    // Below this rendered width an image is an icon, not a picture worth
    // enlarging.
    var MIN_WIDTH = 80;

    var STATUS_CLASS = 'kr-lightbox-status';

    // Fixed controls that sit above Magnific's overlay (z-index 1043): the
    // theme toggle (1500) lands on the close button, and scroll-to-top
    // (far higher) on the filmstrip. Neither belongs to the dialog.
    var PAGE_CHROME = '#theme-toggle, #scrollUp';

    // One Magnific instance serves every popup on a page, so one flag and
    // one timer are enough.
    var chromeHidden = false;
    var announceTimer = null;

    // ------------------------------------------------------------------
    // Dialog semantics
    // ------------------------------------------------------------------

    // Magnific captions are HTML. Parse them in a <template>, which never
    // loads an image or runs a handler, then keep the words.
    function plainText(html) {
        var t = document.createElement('template');
        t.innerHTML = html || '';
        return (t.content.textContent || '').replace(/\s+/g, ' ').trim();
    }

    // The words that describe the frame on screen. A link can say it
    // outright (data-caption, as gallery tiles do); otherwise the image's
    // alt; otherwise the title of an item opened from data rather than
    // from a link (openKrLightbox on the photo map).
    function captionOf(item) {
        if (!item) return '';
        var el = item.el && item.el.length ? item.el : null;
        var text = el ? (el.attr('data-caption') || el.find('img').attr('alt') || '') : '';
        if (!text && item.data && typeof item.data.title === 'string') text = plainText(item.data.title);
        return $.trim(text);
    }

    function statusOf(mfp) {
        var status = mfp.wrap.children('.' + STATUS_CLASS);
        if (!status.length) {
            status = $('<div class="sr-only" aria-live="polite" aria-atomic="true"></div>')
                .addClass(STATUS_CLASS)
                .appendTo(mfp.wrap);
        }
        return status;
    }

    // A short delay, restarted on every call. On the first open Magnific
    // attaches its overlay after the first change callback, and a live
    // region filled before it is in the page is never read; holding an
    // arrow key through a set should announce where it stops, not every
    // frame on the way.
    function say(status, text) {
        clearTimeout(announceTimer);
        announceTimer = setTimeout(function () { status.text(text); }, 120);
    }

    function hidePageChrome(mfp) {
        if (chromeHidden) return;
        chromeHidden = true;
        $(PAGE_CHROME).css('visibility', 'hidden');
        // Namespaced .mfp so Magnific's own cleanup, which unbinds that
        // namespace as it closes, removes this handler once it has run.
        mfp.ev.on('mfpClose.mfp', function () {
            chromeHidden = false;
            clearTimeout(announceTimer);
            $(PAGE_CHROME).css('visibility', '');
            mfp.wrap.children('.' + STATUS_CLASS).text('');
        });
    }

    function krLightboxA11y(mfp, opts) {
        if (!mfp || !mfp.wrap) return;
        var noun = (opts && opts.noun) || 'Image';
        mfp.wrap.attr({
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': noun + ' viewer'
        });
        // The close button's text is a multiplication sign.
        mfp.wrap.find('.mfp-close').attr('aria-label', 'Close');
        hidePageChrome(mfp);

        // A popup bound to many links holds them all as items even with
        // the gallery off (lightbox.js's own content images), but the
        // viewer can only see the one, so only a navigable set counts.
        var browsable = mfp.st && mfp.st.gallery && mfp.st.gallery.enabled;
        var total = browsable && mfp.items ? mfp.items.length : 1;
        var caption = captionOf(mfp.currItem);
        var where = total > 1 ? noun + ' ' + (mfp.index + 1) + ' of ' + total : noun;
        say(statusOf(mfp), where + (caption ? ': ' + caption : ''));
    }

    krLightboxA11y.announce = function (mfp, text) {
        if (mfp && mfp.wrap) say(statusOf(mfp), text);
    };

    window.krLightboxA11y = krLightboxA11y;

    // ------------------------------------------------------------------
    // Content images
    // ------------------------------------------------------------------

    function wrapContentImages() {
        $(CONTAINERS).find('img').each(function () {
            var $img = $(this);
            var src = $img.attr('src');
            var alt = this.getAttribute('alt');
            if (!src) return;
            if ($img.closest('a').length) return;
            if (alt === '') return;
            if ($img.width() < MIN_WIDTH) return;
            var link = $('<a class="img-lightbox"></a>').attr('href', src);
            // An image with no alt at all is an authoring slip, but its
            // link still needs a name.
            if (alt === null) link.attr('aria-label', 'View image full size');
            $img.wrap(link);
        });
    }

    function bindContentLightboxes() {
        $('.img-lightbox').magnificPopup({
            type: 'image',
            gallery: { enabled: false },
            image: {
                titleSrc: function (item) {
                    // krEscapeHtml is shared-components.js's, which every
                    // page loads before anything can be clicked.
                    return krEscapeHtml(item.el.find('img').attr('alt'));
                }
            },
            callbacks: {
                open: function () { krLightboxA11y(this); },
                change: function () { krLightboxA11y(this); }
            }
        });
    }

    function init() {
        if (!$.fn.magnificPopup) return;
        wrapContentImages();
        bindContentLightboxes();
    }

    // Plain DOMContentLoaded rather than $(fn), so this still runs after
    // shared-components.js has wrapped a post's photographs (it does that
    // as it loads) and before anything registered later.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
}(window.jQuery));
