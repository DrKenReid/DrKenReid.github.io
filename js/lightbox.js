/**
 * lightbox.js: click-to-enlarge for the images in page content, and what
 * every Magnific lightbox on the site shares: the dialog semantics, the
 * thumbnail shown while a full frame loads, the caption's actions, and
 * swiping between frames.
 *
 * Which images
 *   When the DOM is ready, every <img> inside one of CONTAINERS (the
 *   content blocks of the page templates: intro and about bands, the
 *   contact page, blog listings and posts, grey bands, and the 80px
 *   section wrappers) is wrapped in <a class="img-lightbox" href="<its
 *   src>">, and those links open a single-image Magnific popup captioned
 *   with the image's alt text. Links a page already marks img-lightbox are
 *   bound the same way, with one exception, below.
 *
 * A post's photographs are one set
 *   The photographs in a post (PHOTO_SET: the links initLightboxFix in
 *   shared-components.js wraps around its gallery thumbnails, and the ones
 *   a post writes itself, all a.img-lightbox.portfolio-img) open as one
 *   set: arrows, keys, swiping, a counter, "Photograph n of N", the next
 *   frame preloaded. Each is captioned with its image's alt text, never
 *   the figcaption, which also holds the copyright line and the full
 *   resolution switch. Everything else stays a single image: a post's
 *   charts and diagrams are wrapped the same way as its pictures, and
 *   paging from a chart into the next diagram would be a set nobody chose.
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
 *   portfolio-img class that marks a photograph.
 *
 * Every popup here and elsewhere (gallery.js, openKrLightbox in
 * shared-components.js for the photo map) wears the site's skin, mainClass
 * "kr-lightbox mfp-fade" (style.css §13): the round 44px close button and
 * arrows, and the caption bar, which Magnific's own styles leave hidden.
 *
 * krLightboxA11y(mfp, opts)
 *   Magnific builds its overlay from plain divs, so a screen reader meets
 *   an unnamed region, a close button called "multiplication sign", and
 *   no word about where it is in a set. Every popup on the site calls this
 *   from its open and change callbacks. It names the overlay as a modal
 *   dialog ("Image viewer"), names the close button, keeps a polite live
 *   region saying "Image n of N: caption" as a set is browsed ("Image:
 *   caption" where there is one), and hides the fixed page furniture that
 *   sits above the overlay (the theme toggle, scroll-to-top and a post's
 *   reading progress bar, PAGE_CHROME) while the popup is open. This is
 *   the one place it is hidden; no popup needs callbacks of its own for
 *   it. opts.noun replaces "Image" where every frame is known to be one
 *   kind of thing: the gallery, the photo map and the posts' photograph
 *   sets pass 'Photograph'. opts.total is the size of the set when the
 *   popup holds only part of it so far (the gallery adds its later
 *   batches as the viewer pages on). The content images wrapped here keep
 *   the default noun, because a post's charts and diagrams are wrapped
 *   the same way as its pictures.
 *   krLightboxA11y.announce(mfp, text) speaks a one-off message through
 *   the same region, for actions inside a popup such as copying a link.
 *
 * krLightboxPreview(mfp)
 *   A full frame is a PNG of a few megabytes from the photos release, and
 *   Magnific shows it as soon as its size is known: an empty grey box that
 *   the picture then fills from the top, over seconds (more than twenty
 *   on a slow phone). Called from a popup's change callback, this lays the
 *   400px thumbnail the reader just clicked, which is already in the
 *   cache, under the full frame (PREVIEW_CLASS, and the thumbnail as
 *   --kr-lightbox-thumb), and marks the popup LOADING_CLASS, which draws a
 *   small spinner in the frame's corner, until the full frame has loaded
 *   and decoded. The thumbnail is the link's own image, or for a frame
 *   opened from data (the photo map) the repository's thumbnail of the
 *   same number (krLightboxPreview.source(item), which tests/js reads).
 *
 * krLightboxCaption(o)
 *   The caption of a photograph from the release, as markup: its words,
 *   its number, a link to its place on the photo map or to the frame in
 *   the gallery, and a Copy link button. The gallery and the photo map
 *   both build their captions with it. Copy link copies the button's
 *   data-url (by default gallery.html?photo=<n>), handled once here for
 *   every popup, because Magnific rewrites the caption for every frame.
 *
 * Swiping
 *   On a touch screen a sideways swipe across a set of two or more pages
 *   it: at least SWIPE_MIN pixels (the quotation carousel's threshold),
 *   and more across than down. Not while a photograph is zoomed, where a
 *   drag pans it (initLightboxZoom in shared-components.js), and not on
 *   the filmstrip, which scrolls sideways itself.
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

    // The photographs in a post, which open as one set (see the top).
    var PHOTO_SET = '.blog-post a.img-lightbox.portfolio-img';

    // Below this rendered width an image is an icon, not a picture worth
    // enlarging.
    var MIN_WIDTH = 80;

    var STATUS_CLASS = 'kr-lightbox-status';
    var PREVIEW_CLASS = 'kr-lightbox-preview';
    var LOADING_CLASS = 'kr-lightbox-loading';

    var SWIPE_MIN = 50;

    // Fixed page furniture that sits above Magnific's overlay (z-index
    // 1043): the theme toggle (1500) lands on the close button,
    // scroll-to-top (far higher) on the filmstrip, and a post's reading
    // progress bar (4000) draws across the top of the dialog. None of it
    // belongs to the dialog.
    var PAGE_CHROME = '#theme-toggle, #scrollUp, .kr-progress-bar';

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
    // alt; otherwise the words of an item opened from data rather than
    // from a link (openKrLightbox on the photo map): its data-caption
    // span, or failing that its whole title.
    function captionOf(item) {
        if (!item) return '';
        var el = item.el && item.el.length ? item.el : null;
        var text = el ? (el.attr('data-caption') || el.find('img').attr('alt') || '') : '';
        if (!text && item.data && typeof item.data.title === 'string') {
            var words = /data-caption="([^"]*)"/.exec(item.data.title);
            text = plainText(words ? words[1] : item.data.title);
        }
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
        var total = browsable && mfp.items ? Math.max(mfp.items.length, (opts && opts.total) || 0) : 1;
        var caption = captionOf(mfp.currItem);
        var where = total > 1 ? noun + ' ' + (mfp.index + 1) + ' of ' + total : noun;
        say(statusOf(mfp), where + (caption ? ': ' + caption : ''));
    }

    krLightboxA11y.announce = function (mfp, text) {
        if (mfp && mfp.wrap) say(statusOf(mfp), text);
    };

    window.krLightboxA11y = krLightboxA11y;

    // ------------------------------------------------------------------
    // The thumbnail while the full frame loads
    // ------------------------------------------------------------------

    // The stand-in for an item: the image inside its link when that is a
    // smaller file than the one being opened, otherwise the repository's
    // thumbnail of a release frame. Anything else has none.
    function previewSrc(item) {
        var src = item.src || '';
        var el = item.el && item.el[0];
        var small = el && el.querySelector ? el.querySelector('img') : null;
        var shown = small ? (small.currentSrc || small.src || '') : '';
        if (shown && shown !== new URL(src, document.baseURI).href) return shown;
        var release = typeof KR_RELEASE === 'string' ? KR_RELEASE : '';
        if (release && src.indexOf(release) === 0) {
            var stem = src.slice(release.length).replace(/\.\w+$/, '');
            if (/^[\w-]+$/.test(stem)) return '/img/photography/thumb/' + stem + '.webp';
        }
        return '';
    }

    function krLightboxPreview(mfp) {
        if (!mfp || !mfp.wrap) return;
        var item = mfp.currItem;
        var img = item && item.img && item.img[0];
        mfp.wrap.removeClass(LOADING_CLASS);
        if (!img || item.loadError || (img.complete && img.naturalWidth)) return;
        var thumb = previewSrc(item);
        if (!thumb) return;
        img.style.setProperty('--kr-lightbox-thumb', 'url("' + thumb.replace(/"/g, '%22') + '")');
        img.classList.add(PREVIEW_CLASS);
        mfp.wrap.addClass(LOADING_CLASS);
        function done() {
            img.removeEventListener('load', done);
            img.removeEventListener('error', done);
            function clear() {
                img.classList.remove(PREVIEW_CLASS);
                img.style.removeProperty('--kr-lightbox-thumb');
                if (mfp.currItem === item && mfp.wrap) mfp.wrap.removeClass(LOADING_CLASS);
            }
            // Loaded is not yet painted: a large PNG can take a moment
            // more to decode, and the thumbnail covers that too.
            if (img.decode) img.decode().then(clear, clear); else clear();
        }
        img.addEventListener('load', done);
        img.addEventListener('error', done);
    }

    krLightboxPreview.source = previewSrc;
    window.krLightboxPreview = krLightboxPreview;

    // ------------------------------------------------------------------
    // Captions: words, number, a link, Copy link
    // ------------------------------------------------------------------

    /**
     * o: { text (plain words), stem (the frame's number), place (links to
     * the photo map), gallery (true: links to the frame in the gallery),
     * url (what Copy link copies; default gallery.html?photo=<stem>) }.
     * data-caption carries the words for krLightboxA11y. The words and the
     * number are one run of text (kr-lightbox-what), so on a phone the
     * number follows the words' last line instead of taking a row of its
     * own (style.css §13).
     */
    function krLightboxCaption(o) {
        // krEscapeHtml is shared-components.js's, loaded before anything
        // can open a popup.
        var esc = krEscapeHtml;
        var stem = String(o.stem);
        var galleryUrl = '/gallery.html?photo=' + encodeURIComponent(stem);
        var what = '<span class="kr-lightbox-num">#' + esc(stem) + '</span>';
        if (o.text) what = '<span class="kr-lightbox-words" data-caption="' + esc(o.text) + '">' + esc(o.text) + '</span> ' + what;
        var parts = ['<span class="kr-lightbox-what">' + what + '</span>'];
        if (o.place) {
            parts.push('<a class="kr-lightbox-link" href="/map.html?region=' + encodeURIComponent(o.place) +
                '">See this place on the map &rarr;</a>');
        }
        if (o.gallery) parts.push('<a class="kr-lightbox-link" href="' + galleryUrl + '">Open in the gallery &rarr;</a>');
        parts.push('<button type="button" class="kr-lightbox-copy" data-url="' + esc(o.url || galleryUrl) + '">Copy link</button>');
        return parts.join(' ');
    }

    window.krLightboxCaption = krLightboxCaption;

    document.addEventListener('click', function (e) {
        var btn = e.target && e.target.closest ? e.target.closest('.kr-lightbox-copy') : null;
        if (!btn || typeof krCopyText !== 'function') return;
        var url = new URL(btn.getAttribute('data-url') || '', window.location.href).href;
        krCopyText(url, function (ok) {
            var msg = ok ? 'Link copied' : 'Could not copy the link';
            btn.textContent = msg;
            krLightboxA11y.announce($.magnificPopup && $.magnificPopup.instance, msg);
            setTimeout(function () { if (btn.isConnected) btn.textContent = 'Copy link'; }, 2000);
        });
    });

    // ------------------------------------------------------------------
    // Swiping
    // ------------------------------------------------------------------

    // The open popup, when it is a set that can be paged.
    function openSet() {
        var mfp = $.magnificPopup && $.magnificPopup.instance;
        return mfp && mfp.isOpen && mfp.wrap && mfp.st && mfp.st.gallery && mfp.st.gallery.enabled &&
            mfp.items && mfp.items.length > 1 ? mfp : null;
    }

    // The frame on screen is zoomed in (initLightboxZoom's class on its
    // image). Not the wrap's kr-zoom-wrap: that stays behind when a zoomed
    // frame is paged away from by its arrow, and swiping would stop
    // working on every frame after it.
    function zoomed(mfp) {
        var img = mfp.currItem && mfp.currItem.img && mfp.currItem.img[0];
        return !!img && img.classList.contains('kr-zoomed');
    }

    var swipeFrom = null;
    // Passive and on the document, so they cost a property test on a page
    // with no popup open and never delay a scroll.
    document.addEventListener('touchstart', function (e) {
        swipeFrom = null;
        var mfp = openSet();
        // A second finger makes it a pinch.
        if (!mfp || e.touches.length !== 1 || zoomed(mfp)) return;
        var t = e.target;
        if (!mfp.wrap[0].contains(t) || (t.closest && t.closest('.kr-lightbox-strip'))) return;
        swipeFrom = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
        var from = swipeFrom;
        swipeFrom = null;
        var mfp = from && openSet();
        if (!mfp || zoomed(mfp) || !e.changedTouches.length) return;
        var dx = e.changedTouches[0].clientX - from.x;
        var dy = e.changedTouches[0].clientY - from.y;
        if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) <= Math.abs(dy)) return;
        if (dx < 0) mfp.next(); else mfp.prev();
    }, { passive: true });

    document.addEventListener('touchcancel', function () { swipeFrom = null; }, { passive: true });

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

    // krEscapeHtml is shared-components.js's, which every page loads
    // before anything can be clicked.
    function altOf(item) {
        return krEscapeHtml(item.el.find('img').attr('alt'));
    }

    function bindContentLightboxes() {
        // Only links that hold a picture. A figure opened inside a link
        // makes the HTML parser split the link in two, and the empty copy
        // it leaves beside the real one would be the same photograph
        // again in the set, with no caption.
        var photos = $(PHOTO_SET).filter(function () { return !!this.querySelector('img'); });
        photos.magnificPopup({
            type: 'image',
            mainClass: 'kr-lightbox mfp-fade',
            closeOnContentClick: false,
            gallery: { enabled: true, preload: [0, 1], navigateByImgClick: false, tPrev: 'Previous', tNext: 'Next' },
            image: { titleSrc: altOf },
            callbacks: {
                open: function () { krLightboxA11y(this, { noun: 'Photograph' }); },
                change: function () {
                    krLightboxA11y(this, { noun: 'Photograph' });
                    krLightboxPreview(this);
                }
            }
        });
        $('.img-lightbox').not(photos).magnificPopup({
            type: 'image',
            mainClass: 'kr-lightbox mfp-fade',
            gallery: { enabled: false },
            image: { titleSrc: altOf },
            callbacks: {
                open: function () { krLightboxA11y(this); },
                change: function () {
                    krLightboxA11y(this);
                    krLightboxPreview(this);
                }
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
