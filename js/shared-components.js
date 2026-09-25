/**
 * shared-components.js: the chrome and furniture every page shares.
 *
 * Loaded (not deferred) near the end of <body>, after js/site.js. Pages
 * call the render* functions they need from a small inline script; the
 * post furniture runs by itself at the foot of this file on any page with
 * a .blog-post or .story-post; the DOMContentLoaded block wires the
 * page-wide behaviours. Everything is a plain global, so the names below
 * are the contract other scripts and later changes build on.
 *
 * Site chrome
 *   renderHeader(id, opts)          nav, wordmark, theme toggle, recent posts
 *                                   (js/site.js runs the menu itself)
 *   KR_PAGES                        the site map: footer and palette read it
 *   renderFooter(id)                footer, latest writing, palette hint
 *   renderPhotoStrip(id)            photo strip; every frame opens in the gallery
 *   renderNowStrip()                homepage "Now" cards (#now-strip)
 *   krQuoteRotator(section, quotes, opts)  the rotating quotation (homepage,
 *                                   literature.html), KR_QUOTE its timing
 *   siteRootPrefix()                path from this page back to the site root
 *
 * Cards and lists
 *   createBlogCardElement(post, o)  THE post card, stacked or overlay
 *   renderRelatedPosts(id)          related cards at runtime (drafts only)
 *   renderTopicPosts(el, o)         a page's "writing about X" row; any
 *                                   [data-topic-tags] host starts itself
 *   renderSeriesPage()              a series landing page's grid of parts
 *   krBuildListSearchBox, krUpdateSearchCounter, krRenderListPagination,
 *   renderFilterBar, krInitTogglePanels, krSnapRowArrows
 *                                   listing furniture (blog, series)
 *   krFacetRow, krFacetButton, krCountLabel, krSetPressed, krClearRow,
 *   krTagFacetRow, krSortPanel, krSortOption, krSortFromUrl,
 *   krSortToUrl, krToolbarLabels, krUrlList
 *                                   the filter and sort panels' parts
 *   krArmPostPrerender()            prerender posts on hover intent
 *   krShareRow(parent)              the share buttons, for the rail, sheet, sign-off
 *
 * Post furniture (self-starting on post and story pages)
 *   renderBlogPostEssentials, renderStoryPostEssentials, renderFloatingBlogShare,
 *   renderPostMeta, renderSeriesNav, renderPostToc, renderReadingProgress,
 *   renderPostEnd (the end band: mark, sign-off, up next, related, comments),
 *   initPostSidenotes, initCitePreviews, applyJargonTooltips,
 *   autoCollapseTopJargonBox, initDropCap, initFullResMode, initCopyQuotes,
 *   initCodeHighlighting, initEmbedFacades,
 *   KR_ROUTES (the sign-off's three links per category),
 *   KR_WIDE_POST, krWidePost()      the width of the wide post layout
 *
 * Post helpers (pure; tests/js/post-runtime.test.js runs them, and
 * blog.js, series-index.js and generate_related_posts.py's up_next rely on
 * them, so a rename or a changed rule breaks a caller)
 *   postByFile(posts, file), postSeriesList(post), postSeriesEntry(post, name),
 *   seriesParts(posts, name), postNeighbours(posts, post), leadInEnd(text),
 *   compactReference(li)
 *   krTopicPosts(posts, o), krPageList(page, pages)
 *                                   (tests/js/site-chrome.test.js)
 *
 * Media
 *   openKrLightbox(items, i), initLightboxFix, initLightboxZoom,
 *   krLoadLiveCovers() (the hover sketches), initHeroTransitions
 *
 * Data
 *   krFetchJson(path)               memoised JSON: one request per URL per page
 *   loadBlogPosts()                 krFetchJson('data/posts.json')
 *   renderBlueskyFeed(el, o)        recent Bluesky posts as cards
 *
 * Utilities
 *   krEscapeHtml(s), krBookTitle(t), krParsePostDate(s), formatPostDate(s),
 *   krCopyText(t, cb), krIsMac(), krLabelModKeys(scope), krOnScroll(fn),
 *   KR_RELEASE, KR_PHOTO_CATEGORIES, KR_TAGLINE, DEFAULT_POST_IMAGE
 */

// .kr-js on <html> says script is running. A style that hides something
// until script brings it in (the section headings' scroll fallback, a
// plot's loading note) is gated on it, so a reader without script always
// sees the content. Section headings animate in on scroll through CSS
// (style.css §05); nothing here reveals elements by class any more.
document.documentElement.classList.add('kr-js');

var BLUESKY_SVG = '<svg class="bluesky-icon" viewBox="0 0 568 501" xmlns="http://www.w3.org/2000/svg"><path d="M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873c25.719-53.192 95.759-152.32 160.879-201.21C491.866-1.611 568-28.906 568 57.947c0 17.346-9.945 145.713-15.778 166.555-20.275 72.453-94.155 90.933-159.875 79.748C507.222 323.8 536.444 388.56 473.333 453.32c-119.86 122.992-172.272-30.859-185.702-70.281-2.462-7.227-3.614-10.608-3.631-7.733-.017-2.875-1.169.506-3.631 7.733-13.43 39.422-65.842 193.273-185.702 70.281-63.111-64.76-33.889-129.52 80.986-149.071-65.72 11.185-139.6-7.295-159.875-79.748C9.945 203.659 0 75.291 0 57.946 0-28.906 76.135-1.612 123.121 33.664z"/></svg>';

var SUBSTACK_SVG = '<svg class="substack-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.539 24V10.812H1.46zM22.539 0H1.46v2.836h21.08V0z"/></svg>';

/* The theme toggle's two glyphs. Both are in the button and CSS shows the
   one for the theme the button switches TO (a moon while the page is
   light, a sun while it is dark), matching the action label theme.js
   keeps on it. Stroked in currentColor, so the header's light and dark
   states recolour them with the rest of the bar. */
var KR_THEME_ICONS =
    '<svg class="theme-toggle__icon theme-toggle__icon--moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M20 14.6A8.2 8.2 0 0 1 9.4 4a8.2 8.2 0 1 0 10.6 10.6z"/></svg>' +
    '<svg class="theme-toggle__icon theme-toggle__icon--sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<circle cx="12" cy="12" r="4.2"/>' +
    '<path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.35 5.35l1.55 1.55M17.1 17.1l1.55 1.55M5.35 18.65l1.55-1.55M17.1 6.9l1.55-1.55"/></svg>';

/**
 * Site header into #targetId. opts: { basePath ('./' or '/'), active (a
 * top-level key, or nothing to underline no item, as on the 404 page),
 * hobbiesChild, blogChild }. The recent posts and series fill in once
 * posts.json arrives; the rest renders synchronously.
 *
 * Built by hand rather than from KR_PAGES: its grouping (a Hobbies menu
 * with indented children, a Blog menu filled from posts.json) is a
 * design decision about this one component, not a list of pages.
 *
 * Inside the nav, in source order: the wordmark, the menu, the theme
 * toggle, the menu button. That order is the Tab order at every width,
 * and CSS only has to move the menu itself: beside the wordmark on a
 * desktop, off-canvas behind the menu button at 991px and under. The
 * theme toggle sits in the bar's flow, never fixed over it, so it cannot
 * cover the menu button or the Search hint at any width. js/site.js
 * (krInitNav) documents the phone menu's focus contract.
 */
function renderHeader(targetId, options) {
    var el = document.getElementById(targetId);
    if (!el) return;

    var opts = options || {};
    var basePath = opts.basePath || './';
    var active = opts.active || '';
    var hobbiesActive = active === 'hobbies';
    var hobbiesChild = opts.hobbiesChild || '';
    var blogChild = opts.blogChild || '';

    function navItem(key, href, label) {
        var isCurrent = active === key;
        return '<li' + (isCurrent ? ' class="active"' : '') + '><a href="' + href + '"' + (isCurrent ? ' aria-current="page"' : '') + '>' + label + '</a></li>';
    }

    function isHobbyChildActive(key) {
        return hobbiesChild === key ? ' class="active"' : '';
    }

    // The label names the action, like theme.js's, and is right from the
    // first paint: the inline script in <head> has already set data-theme.
    var toLight = document.documentElement.getAttribute('data-theme') === 'dark';
    var themeLabel = toLight ? 'Switch to light mode' : 'Switch to dark mode';

    el.innerHTML = '<a class="skip-link" href="#main-content">Skip to main content</a>' +
        '<header class="header-area"><div class="main-header-area"><div class="classy-nav-container breakpoint-on"><div class="container">' +
        '<nav class="classy-navbar justify-content-between" id="alimeNav" aria-label="Primary">' +
        '<a class="nav-brand" href="' + basePath + 'index.html" aria-label="Ken Reid, home">' +
        '<span class="kr-wordmark kr-gradient-text" aria-hidden="true">Ken<span class="kr-wordmark__dot">.</span></span></a>' +
        '<div class="classy-menu">' +
        '<div class="classynav"><ul id="nav">' +
        navItem('home', basePath + 'index.html', 'Home') +
        navItem('about', basePath + 'about.html', 'About') +
        navItem('data_science', basePath + 'data_science.html', 'Data Science') +
        '<li' + (hobbiesActive ? ' class="active"' : '') + '><a href="#">Hobbies</a>' +
        '<ul class="dropdown">' +
        '<li' + isHobbyChildActive('gallery') + '><a href="' + basePath + 'gallery.html"' + (hobbiesChild === 'gallery' ? ' aria-current="page"' : '') + '>Photography</a></li>' +
        '<li class="kr-nav-sub' + (hobbiesChild === 'map' ? ' active' : '') + '"><a href="' + basePath + 'map.html"' + (hobbiesChild === 'map' ? ' aria-current="page"' : '') + '>Photo Map</a></li>' +
        '<li' + isHobbyChildActive('music') + '><a href="' + basePath + 'music.html"' + (hobbiesChild === 'music' ? ' aria-current="page"' : '') + '>Music</a></li>' +
        '<li' + isHobbyChildActive('literature') + '><a href="' + basePath + 'literature.html"' + (hobbiesChild === 'literature' ? ' aria-current="page"' : '') + '>Literature</a></li>' +
        '<li class="kr-nav-sub' + (hobbiesChild === 'books' ? ' active' : '') + '"><a href="' + basePath + 'books.html"' + (hobbiesChild === 'books' ? ' aria-current="page"' : '') + '>Every Book</a></li>' +
        '<li class="kr-nav-sub' + (hobbiesChild === 'quotes' ? ' active' : '') + '"><a href="' + basePath + 'quotes.html"' + (hobbiesChild === 'quotes' ? ' aria-current="page"' : '') + '>Quote Wall</a></li>' +
        '</ul></li>' +
        '<li' + (active === 'blog' ? ' class="active"' : '') + '><a href="' + basePath + 'blog.html"' + (active === 'blog' && !blogChild ? ' aria-current="page"' : '') + '>Blog</a>' +
        '<ul class="dropdown kr-nav-dd-wide">' +
        '<li class="kr-nav-group-label kr-nav-label-blogs">Recent <a href="' + basePath + 'blog.html">Blogs</a></li>' +
        '<li class="kr-nav-group-label kr-nav-label-series' + (blogChild === 'series-index' ? ' active' : '') + '">Recent <a href="' + basePath + 'series.html"' + (blogChild === 'series-index' ? ' aria-current="page"' : '') + '>Series</a></li>' +
        '</ul></li>' +
        navItem('contact', basePath + 'contact.html', 'Contact') +
        '</ul></div></div>' +
        '<button type="button" id="theme-toggle" class="theme-toggle" aria-label="' + themeLabel + '" title="' + themeLabel + '">' +
        KR_THEME_ICONS + '</button>' +
        '<button type="button" class="classy-navbar-toggler" aria-label="Open menu" aria-expanded="false">' +
        '<span class="navbarToggler" aria-hidden="true"><span></span><span></span><span></span></span></button>' +
        '</nav>' +
        '</div></div></div></header>';

    // js/site.js owns the nav and is loaded before this file on every page.
    try {
        if (typeof window.krInitNav === 'function') window.krInitNav();
    } catch (e) {
        console.warn('Header nav init failed:', e);
    }

    // Three most recent posts under the "Blogs" label, and the three most
    // recently updated series under the "Series" label, once posts.json
    // arrives (the header itself renders synchronously). Both lists are
    // derived rather than hard-coded, so a new series joins the nav as soon
    // as its first post ships -- provided its landing page
    // series-<slug>.html exists, which the audit's series-page rule
    // enforces (.github/docs/ARCHITECTURE.md, "Adding a series").
    loadBlogPosts().then(function(posts) {
        if (!Array.isArray(posts) || !posts.length) return;

        function slotUnder(labelClass, items, build) {
            var anchor = document.querySelector('.kr-nav-dd-wide .' + labelClass);
            if (!anchor) return;
            items.forEach(function(item) {
                var li = build(item);
                anchor.parentNode.insertBefore(li, anchor.nextSibling);
                anchor = li;
            });
        }

        slotUnder('kr-nav-label-blogs', posts.slice(0, 3), function(p) {
            var li = document.createElement('li');
            li.className = 'kr-nav-series kr-nav-recent';
            var a = document.createElement('a');
            a.href = basePath + (p.url || 'blog.html');
            a.textContent = p.title;
            li.appendChild(a);
            return li;
        });

        // Newest post first, so the first sighting of a series name is its
        // most recent post: that ordering is "most recently updated". Dates
        // are ISO strings, which sort correctly as text.
        var byDate = posts.slice().sort(function(a, b) {
            return (b.date || '') < (a.date || '') ? -1 : ((b.date || '') > (a.date || '') ? 1 : 0);
        });
        var seen = {}, names = [];
        byDate.forEach(function(p) {
            postSeriesList(p).forEach(function(entry) {
                if (!entry || !entry.name || seen[entry.name]) return;
                seen[entry.name] = true;
                names.push(entry.name);
            });
        });

        var here = window.location.pathname;
        slotUnder('kr-nav-label-series', names.slice(0, 3), function(name) {
            var href = seriesPageHref(name);
            var li = document.createElement('li');
            li.className = 'kr-nav-series';
            var a = document.createElement('a');
            a.href = basePath + href.replace(/^\//, '');
            a.textContent = name;
            if (here === href) {
                li.className += ' active';
                a.setAttribute('aria-current', 'page');
            }
            li.appendChild(a);
            return li;
        });
    }).catch(function() {});
}

/**
 * Path prefix from the current page back to the site root.
 * Published posts live in blog/ (one level deep); drafts preview from
 * blog/drafts/ (two levels deep) and need the extra hop. Series drafts
 * may sit one folder deeper still (blog/drafts/<series>/), so the
 * drafts prefix is computed from the actual depth below drafts/.
 *
 * A page served at URLs it does not live at declares its root instead:
 * GitHub Pages answers every missing path with 404.html, so the same
 * document can arrive at /nope or /blog/nope.html, and only
 * <html data-kr-root="/"> keeps its links and data requests pointing at
 * the right place from both.
 */
function siteRootPrefix() {
    var declared = document.documentElement.getAttribute('data-kr-root');
    if (declared) return declared;
    var path = window.location.pathname || '';
    var draftsAt = path.indexOf('/blog/drafts/') !== -1 ? '/blog/drafts/' :
        (path.indexOf('/writing/drafts/') !== -1 ? '/writing/drafts/' : null);
    if (draftsAt) {
        var below = path.slice(path.indexOf(draftsAt) + draftsAt.length);
        var extra = below.split('/').length - 1;
        var prefix = '../../';
        while (extra-- > 0) prefix += '../';
        return prefix;
    }
    if (path.indexOf('/writing/') !== -1) return '../';
    return document.querySelector('.blog-post, .story-post') ? '../' : '';
}

/**
 * The photography strip into #targetId: ten random frames, each a link
 * that opens that photograph in the gallery (gallery.html?photo=<stem>).
 * Instagram stays as the secondary line under the heading rather than
 * the destination of every frame: the gallery is where the photographs
 * live, with their places and the rest of their set.
 */
function renderPhotoStrip(targetId) {
    var el = document.getElementById(targetId);
    if (!el) return;

    var root = siteRootPrefix();
    var instagramUrl = 'https://www.instagram.com/drkenreid/';

    el.innerHTML = '<section class="follow-area clearfix" aria-label="Photography highlights">' +
        '<div class="container"><div class="row"><div class="col-12">' +
        '<div class="section-heading text-center">' +
        '<span class="section-eyebrow">Photography</span>' +
        '<h2>Photo Highlights</h2>' +
        '<p><a href="' + instagramUrl + '">Follow @drkenreid on Instagram</a></p>' +
        '</div></div></div></div>' +
        '<div class="instragram-feed-area owl-carousel"></div></section>';

    function shuffleCopy(items) {
        var copy = items.slice();
        for (var i = copy.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = copy[i];
            copy[i] = copy[j];
            copy[j] = temp;
        }
        return copy;
    }

    krFetchJson('data/photography-standard-files.json').then(function(files) {
        var sample = shuffleCopy(Array.isArray(files) ? files : []).slice(0, 10);
        var feed = el.querySelector('.instragram-feed-area');
        if (!feed) return;

        // The link carries the name, so the image is decorative (alt=""):
        // the frames have numbers, not captions, and "Photograph 212" read
        // twice, once for the image and once for the link, says nothing.
        feed.innerHTML = sample.map(function(filename) {
            var stem = krEscapeHtml(String(filename).replace(/\.[^.]+$/, ''));
            return '<a class="single-instagram-item" href="' + root + 'gallery.html?photo=' + stem + '"' +
                ' aria-label="Photograph ' + stem + ', open it in the gallery">' +
                '<img src="' + root + 'img/photography/thumb/' + stem + '.webp" alt="" loading="lazy">' +
                '<span class="instagram-hover-content d-flex flex-column align-items-center justify-content-center" aria-hidden="true">' +
                '<i class="ti-camera"></i><span>View in the gallery</span></span></a>';
        }).join('');

        if (typeof jQuery !== 'undefined' && jQuery.fn.owlCarousel) {
            var instagramSlider = jQuery(feed);
            instagramSlider.owlCarousel({
                items: 10,
                loop: true,
                autoplay: true,
                autoplayHoverPause: true,
                smartSpeed: 1000,
                autoplayTimeout: 3000,
                responsive: {
                    0: { items: 2 },
                    576: { items: 3 },
                    768: { items: 4 },
                    992: { items: 5 },
                    1200: { items: 10 }
                }
            });
            if (typeof window.addCarouselPauseControl === 'function') {
                window.addCarouselPauseControl(instagramSlider, jQuery(el).find('.follow-area'), 'photo carousel', 3000);
            }
        }
    }).catch(function() {
        // No frames, no strip: the heading and its Instagram line remain.
        var feed = el.querySelector('.instragram-feed-area');
        if (feed) feed.remove();
    });
}

/* ---- Sharing ----
   One set of share buttons, drawn in three places: the rail beside the
   article (992-1359px), the sheet that slides up at the end of a post on
   a phone, and the row in the end band's sign-off. The icons take their
   colour from --kr-share-ink (style.css), so they follow the theme. */
var KR_SHARE_ICONS = {
    bluesky: BLUESKY_SVG,
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-7.5h2.55l.38-2.97H13.5V8.66c0-.86.24-1.45 1.48-1.45h1.58V4.55c-.27-.04-1.21-.12-2.31-.12-2.29 0-3.86 1.4-3.86 3.96v2.21H7.84v2.97h2.55V21h3.11z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.95v5.66H9.37V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.26 2.37 4.26 5.45v6.29zM5.34 7.44a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2H21l-6.52 7.45L22 22h-6.77l-4.74-6.2L4.86 22H2l7.02-8.01L2 2h6.91l4.27 5.66L18.244 2zm-1.18 18h1.85L7.04 4H5.07l11.99 16z"/></svg>',
    threads: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.18 22h-.05C8.43 21.98 5.58 20.77 3.66 18.4 1.95 16.29 1.07 13.34 1.05 9.62v-.04c.02-3.72.9-6.67 2.61-8.78C5.58.23 8.43-.98 12.13-1h.05c2.83.02 5.21.76 7.06 2.2 1.75 1.36 2.98 3.3 3.66 5.78l-2.27.6c-1.16-4.31-4.21-6.5-9.07-6.55C8.42 1.06 6.5 2 5.21 3.58 4 5.07 3.36 7.23 3.34 10c.02 2.78.66 4.94 1.87 6.43 1.29 1.58 3.21 2.52 6.35 2.55 2.83-.02 4.7-.69 6.26-2.24.92-.91 1.49-2.02 1.71-3.31-.18-.99-.73-1.79-1.66-2.41-.74-.49-1.7-.88-2.85-1.15-.08 1.32-.42 2.39-1.02 3.18-.69.9-1.7 1.34-3 1.34h-.05c-1.07-.01-2.05-.32-2.77-.86-.83-.63-1.27-1.51-1.27-2.55 0-2.05 1.65-3.47 4.11-3.55.94-.03 1.84.07 2.66.3-.18-1.16-.55-2.07-1.11-2.71-.79-.91-2.02-1.39-3.66-1.39-1.55 0-2.83.62-3.81 1.84l-1.66-1.32c1.41-1.78 3.25-2.69 5.47-2.69 2.32 0 4.18.81 5.37 2.34.79 1.02 1.25 2.37 1.36 4.04 1.95.55 3.36 1.32 4.27 2.35.91 1.04 1.36 2.34 1.36 3.91 0 .14 0 .29-.02.43-.32 1.99-1.21 3.7-2.66 5.07-1.93 1.84-4.39 2.73-7.51 2.75zm.49-9.27c-.27 0-.55.01-.83.03-1.92.06-2.6.79-2.6 1.49 0 .55.45 1.43 2.04 1.45h.03c.96 0 1.55-.27 1.92-.86.34-.55.51-1.31.49-2.04-.34-.04-.69-.07-1.05-.07z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>',
    copyDone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
};

/**
 * The page's share targets: { url, networks: [{id, label, href}] }, from
 * the canonical link and og:title. The 'copy' entry has no href: its
 * button copies `url` instead of leaving the page.
 */
function krShareTargets() {
    var canonical = document.querySelector('link[rel="canonical"]');
    var pageUrl = canonical && canonical.getAttribute('href')
        ? canonical.getAttribute('href')
        : (window.location.origin + window.location.pathname);
    var ogTitle = document.querySelector('meta[property="og:title"]');
    var title = ogTitle && ogTitle.getAttribute('content')
        ? ogTitle.getAttribute('content').trim()
        : document.title.replace(' - Ken Reid', '').trim();

    var shareText = title + ' by Ken Reid';
    var encUrl = encodeURIComponent(pageUrl);
    var encText = encodeURIComponent(shareText);
    var encTextUrl = encodeURIComponent(shareText + ' ' + pageUrl);
    return {
        url: pageUrl,
        networks: [
            { id: 'bluesky', label: 'Share on Bluesky', href: 'https://bsky.app/intent/compose?text=' + encTextUrl },
            { id: 'facebook', label: 'Share on Facebook', href: 'https://www.facebook.com/sharer/sharer.php?u=' + encUrl },
            { id: 'linkedin', label: 'Share on LinkedIn', href: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encUrl },
            { id: 'x', label: 'Share on X', href: 'https://twitter.com/intent/tweet?text=' + encText + '&url=' + encUrl },
            { id: 'threads', label: 'Share on Threads', href: 'https://www.threads.net/intent/post?text=' + encTextUrl },
            { id: 'copy', label: 'Copy link' }
        ]
    };
}

/**
 * Appends one .kr-share-btn per share target to `parent` and returns it.
 * Network buttons are plain links to the network's own share page; Copy
 * link goes through krCopyText and shows a tick for a moment.
 */
function krShareRow(parent) {
    var targets = krShareTargets();
    targets.networks.forEach(function(network) {
        var el = document.createElement('a');
        el.className = 'kr-share-btn';
        el.setAttribute('data-net', network.id);
        el.setAttribute('aria-label', network.label);
        el.setAttribute('title', network.label);
        el.innerHTML = KR_SHARE_ICONS[network.id];
        if (network.id === 'copy') {
            el.href = '#';
            el.addEventListener('click', function(evt) {
                evt.preventDefault();
                krCopyText(targets.url, function(ok) {
                    if (!ok) return;
                    el.classList.add('is-copied');
                    el.innerHTML = KR_SHARE_ICONS.copyDone;
                    setTimeout(function() {
                        el.classList.remove('is-copied');
                        el.innerHTML = KR_SHARE_ICONS.copy;
                    }, 1800);
                });
            });
        } else {
            el.href = network.href;
            el.target = '_blank';
            el.rel = 'noopener noreferrer';
        }
        parent.appendChild(el);
    });
    return parent;
}

/* The width from which a post has its wide layout: the sidenotes in the
   right gutter (initPostSidenotes), the share buttons in the sign-off
   instead of the floating rail (renderFloatingBlogShare), and no citation
   card for a citation whose note is beside it (initCitePreviews). The
   script's three uses and these style.css blocks must all flip at the same
   width: the "Sidenotes" block and the share row in "The end band"
   (style.css §10, .kr-signoff__share). */
var KR_WIDE_POST = '(min-width: 1360px)';

/** A MediaQueryList for KR_WIDE_POST, or a stand-in that never matches. */
function krWidePost() {
    return window.matchMedia ? window.matchMedia(KR_WIDE_POST) : { matches: false };
}

/**
 * The floating share UI, which depends on the width:
 *   below 992px   a sheet slides up from the bottom once the reader
 *                 reaches the end band; dismissed, it stays down for the
 *                 rest of the session (the close button or Escape)
 *   992-1359px    a rail beside the article while it is being read,
 *                 retiring when the end band arrives
 *   1360px and up nothing floats: the right gutter holds the sidenotes,
 *                 and the end band's sign-off carries the same buttons
 * Both pieces are .kr-offstage (style.css), so while they are hidden their
 * buttons are out of the Tab order, not merely transparent. The sheet is
 * a labelled region rather than a dialog: it does not take focus or trap
 * it, it only offers the buttons.
 */
function renderFloatingBlogShare() {
    var blogPost = document.querySelector('.blog-post, .story-post');
    if (!blogPost || document.querySelector('.kr-share-rail')) return;

    var rail = document.createElement('div');
    rail.className = 'kr-share-rail kr-offstage';
    rail.setAttribute('role', 'complementary');
    rail.setAttribute('aria-label', 'Share this post');
    rail.innerHTML = '<div class="kr-share-label" aria-hidden="true">Share</div>';
    krShareRow(rail);
    document.body.appendChild(rail);

    var modal = document.createElement('div');
    modal.className = 'kr-share-modal kr-offstage';
    modal.setAttribute('role', 'region');
    modal.setAttribute('aria-label', 'Share this post');
    modal.innerHTML =
        '<div class="kr-share-modal-header">' +
            '<div class="kr-share-modal-title">Enjoyed this? Share it.</div>' +
            '<button type="button" class="kr-share-modal-close" aria-label="Dismiss share prompt">&times;</button>' +
        '</div>' +
        '<div class="kr-share-modal-row"></div>';
    krShareRow(modal.querySelector('.kr-share-modal-row'));
    document.body.appendChild(modal);

    var dismissKey = 'kr-share-dismissed:' + window.location.pathname;
    var dismissed = false;
    try {
        dismissed = sessionStorage.getItem(dismissKey) === '1';
    } catch (e) {}

    function setModalVisible(visible) {
        modal.classList.toggle('is-visible', !!visible);
        document.body.classList.toggle('kr-share-modal-open', !!visible);
    }

    function dismissModal() {
        setModalVisible(false);
        dismissed = true;
        try {
            sessionStorage.setItem(dismissKey, '1');
        } catch (e) {}
    }

    modal.querySelector('.kr-share-modal-close').addEventListener('click', dismissModal);
    // Escape answers only while the sheet is up: pressed anywhere else
    // (closing the palette, say) it must not dismiss a sheet the reader
    // has not seen yet.
    document.addEventListener('keydown', function(evt) {
        if ((evt.key === 'Escape' || evt.key === 'Esc') && modal.classList.contains('is-visible')) {
            dismissModal();
        }
    });

    var phone = window.matchMedia('(max-width: 991px)');
    var wide = krWidePost();
    krOnScroll(function() {
        var rect = blogPost.getBoundingClientRect();
        var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        var viewportWidth = document.documentElement.clientWidth || window.innerWidth;
        var railWidth = rail.offsetWidth || 40;
        var passed = postMainEndPassed(blogPost);
        return function() {
            if (phone.matches) {
                rail.classList.remove('is-visible');
                if (!dismissed && passed) {
                    setModalVisible(true);
                } else if (!passed) {
                    setModalVisible(false);
                }
                return;
            }
            setModalVisible(false);
            if (wide.matches) {
                rail.classList.remove('is-visible');
                return;
            }
            // Beside the article's right edge, wherever the column sits.
            var gap = 24;
            var left = rect.right + gap;
            if (left + railWidth > viewportWidth - 8) {
                left = Math.max(8, rect.left - gap - railWidth);
            }
            rail.style.left = left + 'px';
            rail.classList.toggle('is-visible', rect.top < viewportHeight * 0.7 && !passed);
        };
    });
}

/* The cover a post card uses when the post names none, or its own fails
   to load. Site-relative: prefix it with siteRootPrefix(). */
var DEFAULT_POST_IMAGE = 'img/photography/hero/97.webp';

/* Prefix a site-relative asset path (e.g. with '../' from a blog post);
   full URLs and site-absolute paths pass through untouched. */
function resolveAssetPath(src, prefix) {
    return /^(https?:)?\/\//.test(src) || src.charAt(0) === '/' ? src : prefix + src;
}

// readMinutes is precomputed into data/posts.json by
// .github/scripts/generate_read_times.py; this only reads it. Returns null
// when absent (e.g. a stale cached posts.json): callers hide the read time
// rather than guess.
function postReadMinutes(post) {
    if (typeof post.readMinutes === 'number' && isFinite(post.readMinutes)) {
        return Math.max(1, Math.round(post.readMinutes));
    }
    return null;
}

/**
 * Builds one post card and returns its grid column, ready to append.
 * Every post card on the site comes from here, and
 * .github/scripts/generate_related_posts.py bakes the same stacked markup
 * into published posts: change one, change the other.
 *
 * post: a posts.json or stories.json record. Every field is escaped.
 * opts (all optional):
 *   cardStyle     'overlay' is the listing tile, title over the photograph;
 *                 anything else is the stacked card, image above text.
 *   colClass      the column's grid classes (a default per style).
 *   headingLevel  2 to 6, default 3. Pick the level that continues the
 *                 page's outline: 2 straight under a page's h1, 3 under an
 *                 h2 such as "Related posts".
 *   href          link target; default the post's URL from the site root.
 *   imageSrc      cover; default the post's image from the site root.
 *   fallbackImage swapped in once if the cover fails to load.
 *   dateStr       preformatted date; default formatPostDate(post.date).
 *   showReadTime  false drops "N min read".
 *
 * Hooks the rest of the site keys off, so keep them:
 *   column  .kr-glow-host with --kr-cover   the blurred glow (krGlowHost)
 *   card    .kr-lit with .kr-lit__ring      the cursor-lit border
 *   overlay .single-post-area[data-href]    js/live-covers.js takes the
 *           post (and so its sketch) from data-href, and initHeroTransitions
 *           finds the clicked card by it. The overlay's only link is its
 *           title, so the card needs the URL on itself as well; the smoke
 *           test also counts .single-post-area on blog.html.
 *   stacked a.blog-card[href]               the same two, from the link
 *   cover   .post-thumbnail / .blog-card-img  where a sketch's canvas and
 *           a series "Part N" chip are placed
 *
 * The overlay card has one link, its title, stretched across the card by
 * CSS (.post-title a::after), so the tile is one tab stop, middle-click
 * and "open in new tab" work, and a screen reader hears the title once.
 * Its date, read time and category are plain text. The heading comes
 * first in the source and the meta line is moved above it visually, so
 * the title leads when the card is read aloud. Covers are decorative
 * (alt="") in both styles: the title is already the link's name.
 */
function createBlogCardElement(post, options) {
    var opts = options || {};
    var root = siteRootPrefix();
    var href = opts.href || root + (post.url || '');
    var imageSrc = opts.imageSrc || resolveAssetPath(post.image || DEFAULT_POST_IMAGE, root);
    var fallback = opts.fallbackImage || root + DEFAULT_POST_IMAGE;
    var dateStr = krEscapeHtml(opts.dateStr || formatPostDate(post.date));
    var mins = opts.showReadTime === false ? null : postReadMinutes(post);
    var level = opts.headingLevel >= 2 && opts.headingLevel <= 6 ? Math.floor(opts.headingLevel) : 3;
    var title = krEscapeHtml(post.title);
    var link = krEscapeHtml(href);
    var cover = '<img src="' + krEscapeHtml(imageSrc) + '" alt="" loading="lazy">';

    // No scroll reveal on cards. A grid of nine replayed a staggered fade
    // on every filter click and every page change, which read as a
    // template tic rather than as motion that meant anything.
    var col = document.createElement('div');

    if (opts.cardStyle === 'overlay') {
        // The first tag, not posts.json's category: the listing's Topic
        // filter offers tags, and every other card shows them, so a chip
        // reading "Data & AI" would name a group nobody can select. The
        // category belongs to the post's own opener kicker.
        var chip = (post.tags && post.tags[0]) || '';
        col.className = opts.colClass || 'col-12 col-sm-6 col-lg-4';
        col.innerHTML =
            '<div class="single-post-area kr-lit" data-href="' + link + '">' +
            '<div class="post-thumbnail">' + cover + '</div>' +
            '<span class="kr-lit__ring" aria-hidden="true"></span>' +
            '<div class="post-content">' +
            '<h' + level + ' class="post-title"><a href="' + link + '">' + title + '</a></h' + level + '>' +
            '<div class="post-meta"><span>' + dateStr + '</span>' +
            (mins ? '<span>' + mins + ' min read</span>' : '') + '</div>' +
            (chip ? '<span class="btn post-catagory">' + krEscapeHtml(chip) + '</span>' : '') +
            '</div>' +
            '</div>';
    } else {
        col.className = opts.colClass || 'col-12 col-md-6 col-lg-4 mb-30';
        var tags = (post.tags || []).map(function(tag) {
            return '<span class="blog-tag">' + krEscapeHtml(tag) + '</span>';
        }).join('');
        col.innerHTML =
            '<a href="' + link + '" class="blog-card kr-lit">' +
            '<span class="kr-lit__ring" aria-hidden="true"></span>' +
            '<div class="blog-card-img">' + cover + '</div>' +
            '<div class="blog-card-body">' +
            '<div class="blog-card-date">' + dateStr + (mins ? ' · ' + mins + ' min read' : '') + '</div>' +
            '<h' + level + ' class="blog-card-title">' + title + '</h' + level + '>' +
            '<p class="blog-card-excerpt">' + krEscapeHtml(post.excerpt || '') + '</p>' +
            '<div class="blog-card-tags">' + tags + '</div>' +
            '</div>' +
            '</a>';
    }

    krGlowHost(col, imageSrc);
    krArmPostPrerender();

    // A listener rather than an inline onerror, so no path is ever spliced
    // into a string of script. Once: a missing fallback must not loop.
    var img = col.querySelector('img');
    img.addEventListener('error', function() { img.src = fallback; }, { once: true });
    return col;
}

/* The hover sketches (js/live-covers.js, covers.js, covers-site.js:
   39 KB gzipped) load on the first sign of a pointer, and only where a
   pointer can hover and motion is welcome, so phones never fetch them.
   The engine binds cards on its own once it arrives; nothing here or
   in any renderer needs to call it. One version string for all three. */
var KR_COVERS_VERSION = '20260923a';
var krCoversLoading = null;

/** Loads the three sketch scripts once; resolves when all have run (or failed). */
function krLoadLiveCovers() {
    if (krCoversLoading) return krCoversLoading;
    var root = siteRootPrefix();
    function load(src) {
        return new Promise(function(ok) {
            var sc = document.createElement('script');
            sc.src = root + 'js/' + src + '.js?v=' + KR_COVERS_VERSION;
            sc.onload = ok; sc.onerror = ok;
            document.head.appendChild(sc);
        });
    }
    krCoversLoading = (window.krLiveCovers ? Promise.resolve() : load('live-covers'))
        .then(function() { return Promise.all([load('covers'), load('covers-site')]); });
    return krCoversLoading;
}

/** Arms krLoadLiveCovers() for the first pointer move or focus, where hover and motion allow. */
function initLiveCovers() {
    if (!window.matchMedia) return;
    if (window.matchMedia('(hover: none)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var arm = function() {
        window.removeEventListener('pointermove', arm);
        window.removeEventListener('focusin', arm);
        krLoadLiveCovers();
    };
    window.addEventListener('pointermove', arm, { passive: true });
    window.addEventListener('focusin', arm, { passive: true });
}

/**
 * Speculation rules that prerender a post while the reader is deciding to
 * open it, so the click lands on a page that has already loaded (and the
 * card-to-opener morph plays at once instead of waiting on the network).
 *
 * What: every link under /blog/ except /blog/drafts/, at "moderate"
 * eagerness, which in Chrome means after about 200ms of hover or on
 * pointerdown. Nothing is fetched for a card the pointer only passes over.
 *
 * Where: only on a page that shows a post card (a listing, a series page,
 * a post's related cards, a topic row), armed at DOMContentLoaded or by
 * the first card createBlogCardElement builds, whichever comes first.
 *
 * When not: (1) where the primary pointer cannot hover, because on touch
 * "moderate" fires on pointerdown and a scroll that starts on a card would
 * prerender it; (2) under Save-Data, where a guess at the next page is
 * data the reader asked us not to spend; (3) where the browser does not
 * support speculation rules, which simply means no <script> is added.
 *
 * Analytics: gtag.js holds a prerendered page's page_view until the page
 * is shown, so a prerender that is never opened is never counted.
 */
var KR_PRERENDER_RULES = {
    prerender: [{
        where: { and: [{ href_matches: '/blog/*' }, { not: { href_matches: '/blog/drafts/*' } }] },
        eagerness: 'moderate'
    }]
};
var krPrerenderArmed = false;

/** Adds the speculation rules above once, where the gates allow. */
function krArmPostPrerender() {
    if (krPrerenderArmed) return;
    if (typeof HTMLScriptElement === 'undefined' || typeof HTMLScriptElement.supports !== 'function' ||
        !HTMLScriptElement.supports('speculationrules')) return;
    if (!window.matchMedia || !window.matchMedia('(hover: hover)').matches) return;
    if (navigator.connection && navigator.connection.saveData) return;
    krPrerenderArmed = true;
    var rules = document.createElement('script');
    rules.type = 'speculationrules';
    rules.textContent = JSON.stringify(KR_PRERENDER_RULES);
    document.head.appendChild(rules);
}

/* The column around a card carries the card's own cover as a blurred
   glow (CSS ::before on .kr-glow-host), so on hover each card casts light
   in its photograph's colours. The column is used rather than the card
   because the card clips its overflow. The URL is made absolute against
   the page first: a relative url() inside a custom property is resolved
   against the stylesheet that uses it, not the page (the same trap
   apply_post_opener.py documents for --kr-opener-img). */
function krGlowHost(col, imageSrc) {
    var url = String(imageSrc);
    try { url = new URL(url, document.baseURI).href; } catch (e) {}
    col.classList.add('kr-glow-host');
    col.style.setProperty('--kr-cover', 'url("' + url.replace(/["\\\n]/g, '') + '")');
}

/* Cards with a .kr-lit__ring light their border where the pointer is:
   one delegated listener writes the pointer's position into --kr-mx/--kr-my
   on the card, and the ring's radial gradient is centred there. */
function initCardLight() {
    if (!(window.matchMedia && window.matchMedia('(hover: hover)').matches)) return;
    document.addEventListener('pointermove', function(e) {
        var card = e.target && e.target.closest ? e.target.closest('.kr-lit') : null;
        if (!card) return;
        var r = card.getBoundingClientRect();
        card.style.setProperty('--kr-mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--kr-my', (e.clientY - r.top) + 'px');
    }, { passive: true });
}

/* Bare YYYY-MM-DD is built as a local date so the day shown never slips by a
   timezone; anything else falls through to the Date constructor. Shared by
   blog.js and stories.js for sorting, and by formatPostDate below. */
function krParsePostDate(dateValue) {
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        var parts = dateValue.split('-');
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    return new Date(dateValue);
}

/** A post date as the site shows it everywhere: "20 September 2026". */
function formatPostDate(dateValue) {
    return krParsePostDate(dateValue).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

/* ---- Shared listing chrome ----
   A listing page renders its furniture from the same ids (#blog-search-static,
   #blog-counter, #blog-grid, #blog-pagination), so only the noun and the
   state callbacks differ. The filter and sort panels' parts (krFacetRow,
   krSortPanel and the rest) sit with krInitTogglePanels further down. */

/**
 * Upgrade the static search input into the live one.
 * opts: { total, noun, onInput(query), onPresetQuery(query) }
 * Supplying onPresetQuery opts the listing into ?q=term handoffs
 * (e.g. from the 404 page's search box to /blog.html?q=term).
 */
function krBuildListSearchBox(opts) {
    var o = opts || {};
    var input = document.getElementById('blog-search-static');
    if (!input) return null;
    input.id = 'blog-search';
    input.placeholder = 'Search ' + o.total + ' ' + o.noun + '...';
    // A search field, announced as one, with a clear button where the
    // browser offers it (its 'input' event runs the same filter), and a
    // name that survives the placeholder turning into a count.
    input.type = 'search';
    input.setAttribute('aria-label', 'Search ' + o.noun);
    input.setAttribute('enterkeyhint', 'search');
    krSearchLandmark(input, 'Search ' + o.noun);

    if (typeof o.onPresetQuery === 'function') {
        var preset = (new URLSearchParams(window.location.search).get('q') || '').trim();
        if (preset) {
            input.value = preset;
            o.onPresetQuery(preset.toLowerCase());
        }
    }

    // Focus styling lives in .kr-list-search:focus rather than in inline
    // styles here, which used to hard-code a light-theme border colour.
    input.addEventListener('input', function() {
        if (o.onInput) o.onInput(this.value.toLowerCase().trim());
    });
    return input;
}

/**
 * Report how many items survived the filters. `unfiltered` is true when
 * neither the search box nor the filters narrow the list.
 *
 * The count goes to two places. The placeholder keeps its old job, but it
 * only renders while the field is empty, so it silently hides the count
 * for anyone actually typing a search. #blog-counter is the visible copy,
 * and being a live region it also tells screen-reader users that the list
 * changed under them.
 *
 * `ids` names another page's pair, { input, counter }, defaulting to the
 * blog listing's. input: null leaves a placeholder alone that says
 * something better than a count (books.html's "Search titles and
 * authors"). Give the counter class kr-list-counter and role="status".
 */
function krUpdateSearchCounter(filtered, total, noun, unfiltered, ids) {
    var names = ids || { input: 'blog-search', counter: 'blog-counter' };
    var input = names.input ? document.getElementById(names.input) : null;
    if (input) {
        input.placeholder = unfiltered
            ? 'Search ' + total + ' ' + noun + '...'
            : filtered + ' of ' + total + ' ' + noun;
    }
    var counter = document.getElementById(names.counter);
    if (!counter) return;
    counter.textContent = unfiltered
        ? ''
        : (filtered === 0
            ? 'No ' + noun + ' match these filters'
            : 'Showing ' + filtered + ' of ' + total + ' ' + noun);
}

/**
 * Makes the element holding a search field a search landmark, so a screen
 * reader can jump straight to it. The field's own wrapper takes role
 * "search" when the field is all it holds; otherwise the field is wrapped
 * in a new one. A role rather than the <search> element, which older
 * browsers would lay out as an unknown inline element. Idempotent.
 */
function krSearchLandmark(input, label) {
    if (!input || !input.parentElement || input.closest('search, [role="search"]')) return;
    var holder = input.parentElement;
    if (holder === document.body || holder.children.length !== 1) {
        holder = document.createElement('div');
        holder.className = 'kr-search-landmark';
        input.parentElement.insertBefore(holder, input);
        holder.appendChild(input);
    }
    holder.setAttribute('role', 'search');
    if (label) holder.setAttribute('aria-label', label);
}

/**
 * The page numbers a pager shows: all of them up to seven pages, then the
 * first two, the current page with its neighbours and the last two, with
 * '\u2026' standing for each run that is left out. A gap of one page shows the
 * page instead, since an ellipsis there would take the same room.
 *   krPageList(1, 12)  -> [1, 2, '\u2026', 11, 12]
 *   krPageList(4, 12)  -> [1, 2, 3, 4, 5, '\u2026', 11, 12]
 *   krPageList(6, 12)  -> [1, 2, '\u2026', 5, 6, 7, '\u2026', 11, 12]
 * Pure; tests/js/site-chrome.test.js runs it.
 */
function krPageList(current, total) {
    var keep = [];
    for (var p = 1; p <= total; p++) {
        if (total <= 7 || p <= 2 || p > total - 2 || Math.abs(p - current) <= 1) keep.push(p);
    }
    var out = [];
    keep.forEach(function(p, i) {
        var prev = keep[i - 1];
        if (prev !== undefined && p - prev === 2) out.push(prev + 1);
        else if (prev !== undefined && p - prev > 2) out.push('\u2026');
        out.push(p);
    });
    return out;
}

/**
 * The pager under #blog-grid: a <nav aria-label="Pagination"> of buttons,
 * "Previous page", "Page n" and "Next page" to a screen reader, with the
 * current page marked aria-current. onSelect(page) re-renders the caller's
 * list (which calls this again with the new page).
 *
 * After a change focus moves to #blog-counter, the list's live count just
 * above the grid, and the grid scrolls back into view. Without that the
 * pressed button is destroyed by the re-render, focus falls back to
 * <body>, and a keyboard or screen reader user is dropped at the top of
 * the page with nothing said. The counter is empty on an unfiltered list,
 * so the page is written into it ("Page 2 of 8", or after the count when
 * there is one) before focus lands: that is what gets read out, and a
 * sighted reader sees which page the grid now shows. The next filter
 * change rewrites it through krUpdateSearchCounter.
 *
 * `ids` names another listing's elements, { grid, counter, pager },
 * defaulting to the blog's (#blog-grid, #blog-counter, #blog-pagination),
 * as krUpdateSearchCounter's does for the same counter.
 */
function krRenderListPagination(current, total, onSelect, ids) {
    var names = ids || {};
    var gridId = names.grid || 'blog-grid';
    var counterId = names.counter || 'blog-counter';
    var pagerId = names.pager || 'blog-pagination';
    var existing = document.getElementById(pagerId);
    if (existing) existing.remove();
    if (total <= 1) return;

    var nav = document.createElement('nav');
    nav.id = pagerId;
    nav.className = 'kr-pagination';
    nav.setAttribute('aria-label', 'Pagination');

    function choose(page) {
        onSelect(page);
        var counter = document.getElementById(counterId);
        var target = counter || document.getElementById(gridId);
        if (counter) {
            var said = counter.textContent.replace(/\s*\u00B7 page \d+ of \d+$/, '');
            counter.textContent = said
                ? said + ' \u00B7 page ' + page + ' of ' + total
                : 'Page ' + page + ' of ' + total;
            counter.setAttribute('tabindex', '-1');
            counter.focus({ preventScroll: true });
        }
        if (target) {
            var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            target.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
        }
    }

    function button(label, page, opts) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn gallery-filter-btn kr-pagination__btn' + (opts.cls ? ' ' + opts.cls : '');
        btn.textContent = label;
        btn.setAttribute('aria-label', opts.name);
        if (opts.current) {
            btn.classList.add('active');
            btn.setAttribute('aria-current', 'page');
        }
        btn.disabled = !!opts.disabled;
        // The current page's button stays focusable, so it can be heard
        // as the current page, but pressing it changes nothing.
        if (!opts.disabled && !opts.current) btn.addEventListener('click', function() { choose(page); });
        nav.appendChild(btn);
    }

    button('\u2039', current - 1, { name: 'Previous page', disabled: current === 1, cls: 'kr-pagination__step' });
    krPageList(current, total).forEach(function(p) {
        if (typeof p === 'number') {
            button(String(p), p, { name: 'Page ' + p, current: p === current });
            return;
        }
        var gap = document.createElement('span');
        gap.className = 'kr-pagination__gap';
        gap.setAttribute('aria-hidden', 'true');
        gap.textContent = p;
        nav.appendChild(gap);
    });
    button('\u203A', current + 1, { name: 'Next page', disabled: current === total, cls: 'kr-pagination__step' });

    var grid = document.getElementById(gridId);
    if (grid && grid.parentNode) {
        grid.parentNode.insertBefore(nav, grid.nextSibling);
    }
}

/** This page's file name ("iso-8601-date-cult.html"), from the path or the canonical link. */
function resolveCurrentPostFileName() {
    var path = window.location.pathname || '';
    var fileName = path.split('/').pop();
    if (fileName) return fileName;

    var canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) return '';

    var canonicalHref = canonical.getAttribute('href') || '';
    return canonicalHref.split('/').pop();
}

/** The posts.json record whose URL ends in `fileName`, or null (a draft is not listed). */
function postByFile(posts, fileName) {
    for (var i = 0; i < (posts || []).length; i++) {
        if ((posts[i].url || '').split('/').pop() === fileName) return posts[i];
    }
    return null;
}

/* ---- Data ----
   Every JSON file a page reads should go through krFetchJson, so a file
   that the header, footer and page body all want is requested once and a
   failed request is reported the same way everywhere. index.html's inline
   script still fetches its own. */

/** True when served by a local preview (the only place console noise helps). */
function krIsLocalhost() {
    return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
}

var krJsonCache = {};

/**
 * Fetches a JSON file once per page load, however many components ask.
 *
 * `path` is site-relative ('data/posts.json'), site-absolute
 * ('/data/posts.json') or a full URL. Site-relative paths get
 * siteRootPrefix(), so a caller works unchanged from the root, a post, a
 * draft or the 404 page. The cache is keyed by the resolved absolute URL,
 * so 'data/x.json' and '/data/x.json' share one request.
 *
 * Resolves to the parsed value, which every caller SHARES: treat it as
 * read-only and slice() before sorting or changing it. Rejects on a
 * network error or a non-2xx status, with the URL in the message, and
 * forgets the failure so a later call can try again. What a failure looks
 * like on the page is the caller's decision; on localhost it is also
 * logged, because a section that silently stays empty is easy to miss.
 */
function krFetchJson(path) {
    var url = /^([a-z][a-z0-9+.-]*:)?\/\//i.test(path) || path.charAt(0) === '/'
        ? path : siteRootPrefix() + path;
    var key = url;
    try { key = new URL(url, document.baseURI).href; } catch (e) {}
    if (!krJsonCache[key]) {
        krJsonCache[key] = fetch(url).then(function(response) {
            if (!response.ok) throw new Error('HTTP ' + response.status + ' for ' + url);
            return response.json();
        }).catch(function(err) {
            delete krJsonCache[key];
            if (krIsLocalhost()) console.warn('krFetchJson: could not load ' + url, err);
            throw err;
        });
    }
    return krJsonCache[key];
}

/** data/posts.json (every published post, newest first), fetched once per page. */
function loadBlogPosts() {
    return krFetchJson('data/posts.json');
}

/**
 * "Related posts" cards into #targetId at runtime: the posts sharing the
 * most tags with this one, newest first, topped up with the newest posts.
 *
 * Only drafts get here. Every published post has its block baked in by
 * .github/scripts/generate_related_posts.py (ranked by the text of the
 * posts, not just their tags) and ensureRelatedPostsSection finds that
 * block first. The cards are the same stacked card either way.
 *
 * The tags compared are the post's own in posts.json, the ones the
 * listing filters on; only a post posts.json does not list (a draft)
 * falls back to the tags written in its meta line.
 */
function renderRelatedPosts(targetId) {
    var el = document.getElementById(targetId);
    if (!el) return Promise.resolve();

    var currentFileName = resolveCurrentPostFileName();
    var tagNodes = document.querySelectorAll('.blog-post .blog-meta .blog-tag');
    var currentTags = Array.prototype.map.call(tagNodes, function(node) {
        return (node.textContent || '').trim().toLowerCase();
    }).filter(Boolean);

    function newestFirst(a, b) {
        return krParsePostDate(b.date) - krParsePostDate(a.date);
    }
    function sharedTags(post) {
        return (post.tags || []).filter(function(tag) {
            return currentTags.indexOf(String(tag).toLowerCase()) !== -1;
        }).length;
    }

    return loadBlogPosts()
        .then(function(posts) {
            var self = postByFile(posts, currentFileName);
            if (self && self.tags && self.tags.length) {
                currentTags = self.tags.map(function(tag) { return String(tag).toLowerCase(); });
            }
            var others = posts.filter(function(post) {
                return (post.url || '').split('/').pop() !== currentFileName;
            });
            var related = others
                .filter(function(post) { return sharedTags(post) > 0; })
                .sort(function(a, b) { return (sharedTags(b) - sharedTags(a)) || newestFirst(a, b); })
                .slice(0, 3);
            if (related.length < 3) {
                others
                    .filter(function(post) { return related.indexOf(post) === -1; })
                    .sort(newestFirst)
                    .slice(0, 3 - related.length)
                    .forEach(function(post) { related.push(post); });
            }

            if (!related.length) {
                el.innerHTML = '';
                return;
            }
            el.innerHTML = '<div class="related-posts"><h2>Related posts</h2>' +
                '<div class="row related-posts-grid"></div></div>';
            var grid = el.querySelector('.related-posts-grid');
            related.forEach(function(post) {
                grid.appendChild(createBlogCardElement(post));
            });
        })
        .catch(function(error) {
            console.error('Failed to load related posts:', error);
            el.innerHTML = '';
            return null;
        });
}

/**
 * Puts the post's related-posts block into `slot` and resolves to it: the
 * baked block when the post has one (every published post; the generator
 * writes it inside .blog-post and CI fails when it is stale or missing),
 * moved here from where the generator left it; otherwise cards rendered
 * at runtime into a #related-posts-section mount (drafts), reusing a
 * mount the draft already carries.
 */
function ensureRelatedPostsSection(slot) {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost || !slot) return Promise.resolve(null);

    // Looked for page-wide, not only in .blog-post: a block baked just
    // outside the article once got a second one rendered beside it.
    var existingRelated = blogPost.querySelector('.related-posts') ||
        document.querySelector('main .related-posts:not(.more-stories)');
    if (existingRelated) {
        slot.appendChild(existingRelated);
        return Promise.resolve(existingRelated);
    }

    var mount = blogPost.querySelector('#related-posts-section');
    if (!mount) {
        mount = document.createElement('div');
        mount.id = 'related-posts-section';
        mount.setAttribute('data-auto-generated', 'related-posts');
    }
    slot.appendChild(mount);

    return renderRelatedPosts('related-posts-section').then(function() {
        return slot.querySelector('.related-posts') || mount;
    });
}

/**
 * Which posts a topic row shows, and how many the "all posts" link leads
 * to. Pure, so tests/js/site-chrome.test.js can hold it to the listing.
 *
 * posts  posts.json records.
 * opts   tags (a post carrying any of them matches), urls (posts to put
 *        first whatever their tags, as posts.json urls), exclude (posts
 *        the page already links to, never shown again), limit (default 3).
 * Returns { posts, matching, listed }. posts: the pinned ones, then the
 * newest tagged ones. matching: exactly what blog.html?tag=<tags> lists
 * (its tag filter ORs within the group, and so does this); pinned posts
 * outside the tags are shown but not counted, because the link would not
 * show them. listed: how many matching posts the reader can already
 * reach from this page (shown here, or excluded because the page links
 * them), so a caller can drop the link when it would offer nothing new.
 */
function krTopicPosts(posts, opts) {
    var o = opts || {};
    var tags = (o.tags || []).map(function(t) { return String(t).trim().toLowerCase(); }).filter(Boolean);
    var limit = o.limit > 0 ? Math.floor(o.limit) : 3;
    function norm(url) { return String(url || '').replace(/^(\.\.?\/)+|^\//, ''); }
    function tagged(p) {
        return (p.tags || []).some(function(t) { return tags.indexOf(String(t).toLowerCase()) !== -1; });
    }
    var excluded = {};
    (o.exclude || []).forEach(function(url) { excluded[norm(url)] = true; });
    var newest = (posts || []).slice().sort(function(a, b) {
        return krParsePostDate(b.date) - krParsePostDate(a.date);
    });
    var shown = [];
    var seen = {};
    function take(p) {
        if (!p || seen[p.url] || excluded[norm(p.url)] || shown.length >= limit) return;
        seen[p.url] = true;
        shown.push(p);
    }
    (o.urls || []).forEach(function(url) {
        take(newest.filter(function(p) { return norm(p.url) === norm(url); })[0]);
    });
    newest.forEach(function(p) { if (tagged(p)) take(p); });
    return {
        posts: shown,
        matching: newest.filter(tagged).length,
        listed: newest.filter(function(p) {
            return tagged(p) && (seen[p.url] || excluded[norm(p.url)]);
        }).length
    };
}

/* The posts a page's own content already links to, as site paths
   ("blog/x.html"), leaving out links inside `except` (the topic row
   itself). A topic row passes them to krTopicPosts as `exclude`: a card
   directly under a button to the same post says the same thing twice. */
function krLinkedPostUrls(except) {
    var urls = [];
    document.querySelectorAll('main a[href]').forEach(function(a) {
        if (except && except.contains(a)) return;
        var path;
        try { path = new URL(a.getAttribute('href'), document.baseURI).pathname; } catch (e) { return; }
        if (/^\/blog\/[^/]+\.html$/.test(path)) urls.push(path.slice(1));
    });
    return urls;
}

/**
 * A row of posts on the page's own subject (literature, music, the
 * gallery, the map): an eyebrow and heading, up to `limit` stacked post
 * cards, and a link to the blog listing filtered to the same tags.
 *
 * el    the host; its contents are replaced. Put it between a page's
 *       sections, not inside a .container: it brings its own.
 * opts  tags, urls, limit  as krTopicPosts
 *       moreHref  the link's target; default blog.html?tag=<tags>
 *       eyebrow   default "From the blog"
 *       title     default "Writing about <tags>"
 * Returns a promise that settles once the row is drawn, or removed: a
 * host with no posts to show is hidden rather than left as an empty band.
 * A post the page already links to elsewhere in <main> is not shown again
 * (krLinkedPostUrls), so a page whose one post on the subject has its own
 * button gets no row at all until there is a second post.
 *
 * The link reads "See all N posts about <tags>", N from krTopicPosts'
 * `matching`, the same count blog.html shows for that filter, and it is
 * left out when every matching post is already on screen.
 *
 * Markup hosts start themselves at DOMContentLoaded (initTopicPosts):
 *   <div id="topic-posts" data-topic-tags="books" data-topic-limit="3"></div>
 * with data-topic-urls (posts to pin first), data-topic-more,
 * data-topic-eyebrow and data-topic-title for the rest. Lists are
 * comma-separated.
 */
function renderTopicPosts(el, opts) {
    if (!el) return Promise.resolve();
    var o = opts || {};
    var tags = (o.tags || []).filter(Boolean);
    var root = siteRootPrefix();
    var about = tags.join(' and ');

    return loadBlogPosts().then(function(posts) {
        var pick = krTopicPosts(posts, {
            tags: tags, urls: o.urls, limit: o.limit, exclude: krLinkedPostUrls(el)
        });
        if (!pick.posts.length) {
            el.hidden = true;
            return;
        }
        var headingId = (el.id || 'topic') + '-title';
        var moreHref = o.moreHref || root + 'blog.html?tag=' + tags.map(encodeURIComponent).join(',');
        var section = document.createElement('section');
        section.className = 'kr-topic-posts';
        section.setAttribute('aria-labelledby', headingId);
        section.innerHTML = '<div class="container">' +
            '<div class="section-heading text-center">' +
            '<span class="section-eyebrow">' + krEscapeHtml(o.eyebrow || 'From the blog') + '</span>' +
            '<h2 id="' + krEscapeHtml(headingId) + '">' + krEscapeHtml(o.title || 'Writing about ' + about) + '</h2>' +
            '</div><div class="row justify-content-center"></div>' +
            (pick.matching > pick.listed
                ? '<div class="kr-btn-row"><a class="kr-btn kr-btn--ghost" href="' + krEscapeHtml(moreHref) + '">' +
                  (pick.matching === 1 ? 'See the post' : 'See all ' + pick.matching + ' posts') +
                  ' about ' + krEscapeHtml(about) + '</a></div>'
                : '') +
            '</div>';
        var row = section.querySelector('.row');
        pick.posts.forEach(function(post) {
            // Under the row's h2, so the card titles are h3s.
            row.appendChild(createBlogCardElement(post, { headingLevel: 3 }));
        });
        el.innerHTML = '';
        el.appendChild(section);
        el.hidden = false;
    }).catch(function() {
        el.hidden = true;
    });
}

/** Renders every [data-topic-tags] host on the page (see renderTopicPosts). */
function initTopicPosts() {
    function list(host, name) {
        return (host.getAttribute(name) || '').split(',').map(function(v) { return v.trim(); }).filter(Boolean);
    }
    document.querySelectorAll('[data-topic-tags]').forEach(function(host) {
        renderTopicPosts(host, {
            tags: list(host, 'data-topic-tags'),
            urls: list(host, 'data-topic-urls'),
            limit: parseInt(host.getAttribute('data-topic-limit'), 10) || 3,
            moreHref: host.getAttribute('data-topic-more') || '',
            eyebrow: host.getAttribute('data-topic-eyebrow') || '',
            title: host.getAttribute('data-topic-title') || ''
        });
    });
}

/* The one line about Ken, shared by the footer and a post's sign-off. */
var KR_TAGLINE = 'Data scientist, photographer, guitarist, and avid reader. Scottish-built, Michigan-based.';

/**
 * KR_ROUTES: the three onward links in a post's sign-off, keyed by the
 * post's `category` in data/posts.json (the category its opener kicker
 * names). A reader who finished a post about books is offered the
 * reading pages, one who finished an algorithm demo the other demos, and
 * so on: the site's own sections, not more cards (the related posts
 * below already do that).
 *
 * Every category in posts.json needs an entry; one that has none, and a
 * draft whose kicker names none, get KR_ROUTES_DEFAULT. hrefs are
 * site-relative and get siteRootPrefix() when drawn. A new category
 * means a new key here.
 *
 * @type {Object<string, Array<{label: string, href: string}>>}
 */
var KR_ROUTES = {
    'Books & Media': [
        { label: 'Literature', href: 'literature.html' },
        { label: 'Every Book', href: 'books.html' },
        { label: 'Quote Wall', href: 'quotes.html' }
    ],
    'Data & AI': [
        { label: 'Data Science', href: 'data_science.html' },
        { label: 'Algorithms, Live', href: 'series-algorithms-live.html' },
        { label: 'Research, Live', href: 'series-research-live.html' }
    ],
    'Photography': [
        { label: 'Photography', href: 'gallery.html' },
        { label: 'Photo Map', href: 'map.html' },
        { label: 'Photography posts', href: 'blog.html?tag=photography' }
    ],
    'Technology': [
        { label: 'Colophon', href: 'colophon.html' },
        { label: 'How This Site Is Built', href: 'series-how-this-site-is-built.html' },
        { label: 'Technology posts', href: 'blog.html?tag=technology' }
    ],
    'Ideas': [
        { label: 'Everyday Ethics', href: 'series-everyday-ethics.html' },
        { label: 'Cognitive Biases', href: 'series-cognitive-biases.html' },
        { label: 'Quote Wall', href: 'quotes.html' }
    ],
    'Personal': [
        { label: 'About', href: 'about.html' },
        { label: 'Photography', href: 'gallery.html' },
        { label: 'Music', href: 'music.html' }
    ],
    'Money': [
        { label: 'Optimizing Your Schedule', href: 'series-optimizing-your-schedule.html' },
        { label: 'Advice posts', href: 'blog.html?tag=advice' },
        { label: 'Every series', href: 'series.html' }
    ]
};
// Two names for one subject: the demos file under both.
KR_ROUTES['Data Science'] = KR_ROUTES['Data & AI'];

var KR_ROUTES_DEFAULT = [
    { label: 'About', href: 'about.html' },
    { label: 'Every series', href: 'series.html' },
    { label: 'All posts', href: 'blog.html' }
];

/**
 * A post's category: from its posts.json record when it has one, else
 * from the first part of its opener kicker ("Books & Media · 1 June
 * 2026 · 14 min read"), which is how a draft names it.
 */
function postCategory(post) {
    if (post && post.category) return post.category;
    var kicker = document.querySelector('.kr-opener__kicker');
    if (!kicker) return '';
    return (kicker.textContent || '').split('·')[0].trim();
}

/**
 * The sign-off at the end of a post: who wrote it (portrait, name, the
 * site's one-line description of Ken, three routes onward), then the
 * Subscribe and Coffee buttons, the share row (shown from 1360px, where
 * no rail floats beside the text), and the disclaimer as fine print.
 * Routes start from the opener's kicker and are confirmed from posts.json
 * once it answers (el.setRoutes).
 *
 * It is built from divs and spans, not <p>s: the post's prose rules
 * (.blog-post p, and the underline sweep on .blog-post p a) would
 * otherwise restyle it.
 */
function buildSignOff() {
    var root = siteRootPrefix();
    var el = document.createElement('div');
    el.className = 'kr-post-end__slot kr-signoff';
    el.innerHTML =
        '<div class="kr-author">' +
            // The name beside it says who this is, so the portrait is decorative.
            '<img class="kr-author__photo" src="' + root + 'img/core-img/ken-avatar.webp" alt="" width="64" height="64" loading="lazy" decoding="async">' +
            '<div class="kr-author__text">' +
                '<span class="kr-author__eyebrow">Written by</span>' +
                '<a class="kr-author__name" href="' + root + 'about.html">Ken Reid</a>' +
                '<span class="kr-author__line">' + krEscapeHtml(KR_TAGLINE) + '</span>' +
                '<div class="kr-author__routes"><span class="kr-author__routes-label">Explore</span></div>' +
            '</div>' +
        '</div>' +
        '<div class="kr-signoff__row">' +
            '<div class="blog-thanks-cta kr-signoff__cta">' + thanksActionsHtml() + '</div>' +
            '<div class="kr-signoff__share" role="group" aria-label="Share this post">' +
                '<span class="kr-signoff__share-label" aria-hidden="true">Share</span>' +
            '</div>' +
        '</div>' +
        '<div class="post-disclaimer">The views expressed in this post are my own and do not represent any organisation, employer, or institution.</div>';
    krShareRow(el.querySelector('.kr-signoff__share'));

    var routes = el.querySelector('.kr-author__routes');
    el.setRoutes = function(list) {
        Array.prototype.forEach.call(routes.querySelectorAll('a'), function(a) { routes.removeChild(a); });
        (list || KR_ROUTES_DEFAULT).forEach(function(route) {
            var a = document.createElement('a');
            a.href = root + route.href;
            a.textContent = route.label;
            routes.appendChild(a);
        });
    };
    el.setRoutes(KR_ROUTES[postCategory(null)]);
    return el;
}

/**
 * The Subscribe and Coffee buttons, as markup: the sign-off at the end
 * of a post and the thanks card at the end of a story both draw them.
 * The coffee button is a native replica of the Buy Me a Coffee widget
 * (their colours and cup, the site's font, no third-party script): the
 * official script renders via document.write, which browsers ignore
 * outside initial page parse, so it cannot work in injected markup.
 */
function thanksActionsHtml() {
    return '' +
        '<div class="blog-thanks-cta__actions">' +
        '<a class="kr-btn kr-btn--ghost kr-cta-btn" href="https://drkenreid.substack.com/subscribe" target="_blank" rel="noopener noreferrer">' + SUBSTACK_SVG + '<span>Subscribe by email</span></a>' +
        '<a class="kr-btn kr-btn--ghost kr-cta-btn" href="https://buymeacoffee.com/drkenreid" target="_blank" rel="noopener noreferrer">' +
        '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" focusable="false">' +
        '<path d="M6.1 7.9h11.8l-1.45 11.6a2.2 2.2 0 0 1-2.18 1.9H9.73a2.2 2.2 0 0 1-2.18-1.9Z" fill="#ffffff" stroke="#0D0C22" stroke-width="1.3" stroke-linejoin="round"/>' +
        '<path d="M6.55 11.5h10.9l-.42 3.4c-1.55.85-2.6-.55-4.13-.1-1.4.4-2.3 1.15-3.55.7-.7-.25-1.55-.75-2.4-.6Z" fill="#FFDD00"/>' +
        '<rect x="4.9" y="4.4" width="14.2" height="2.7" rx="1.35" fill="#FFDD00" stroke="#0D0C22" stroke-width="1.3"/>' +
        '</svg>' +
        '<span>Buy me a coffee</span></a>' +
        '</div>';
}

/**
 * The thanks card at the end of a short story, above its More Stories
 * cards. Blog posts carry the same buttons in their sign-off instead
 * (renderPostEnd).
 */
function renderBlogThanksCta() {
    var storyPost = document.querySelector('.story-post');
    if (!storyPost || storyPost.querySelector('.blog-thanks-cta')) return;

    var cta = document.createElement('section');
    cta.className = 'blog-thanks-cta';
    cta.setAttribute('aria-label', 'Stay connected with Ken Reid');
    cta.innerHTML = thanksActionsHtml();

    var moreStories = storyPost.querySelector('.more-stories');
    if (moreStories) {
        storyPost.insertBefore(cta, moreStories);
    } else {
        storyPost.appendChild(cta);
    }
}

/**
 * The two "Up next" links for `current`, a posts.json record:
 * { prev: {post, label} | null, next: {post, label} | null }.
 *
 * A series part points at its neighbouring parts, which is where a
 * reader of part 3 wants to go, rather than at whatever happened to be
 * published the week before. The first series the post belongs to that
 * has a neighbour decides. A side the series cannot fill (part 1 has no
 * previous part, the latest part no next) falls back to the post's
 * chronological neighbour in posts.json (newest first), unless that is
 * the post already on the other side.
 *
 * up_next in .github/scripts/generate_related_posts.py applies the same
 * rules, so the baked related cards can leave these two posts out rather
 * than repeat the pager directly above them. Change one, change the other.
 */
function postNeighbours(posts, current) {
    var idx = posts.indexOf(current);
    var older = idx >= 0 && idx < posts.length - 1 ? posts[idx + 1] : null;
    var newer = idx > 0 ? posts[idx - 1] : null;
    var prev = null, next = null;

    postSeriesList(current).some(function(entry) {
        if (!entry || !entry.name) return false;
        var parts = seriesParts(posts, entry.name);
        var at = parts.indexOf(current);
        var before = at > 0 ? parts[at - 1] : null;
        var after = at >= 0 && at < parts.length - 1 ? parts[at + 1] : null;
        if (!before && !after) return false;
        if (before) prev = { post: before, label: 'Part ' + postSeriesEntry(before, entry.name).part };
        if (after) next = { post: after, label: 'Part ' + postSeriesEntry(after, entry.name).part };
        return true;
    });

    if (!prev && older && !(next && next.post === older)) prev = { post: older, label: 'Older' };
    if (!next && newer && !(prev && prev.post === newer)) next = { post: newer, label: 'Newer' };
    return { prev: prev, next: next };
}

/**
 * Fills the end band's "Up next" slot from postNeighbours, or removes the
 * slot when the post has no neighbours to offer (a draft, or a failed
 * posts.json). Each link is a data-live-under host: js/live-covers.js
 * runs the linked post's own sketch beneath its text on hover, finding
 * the post from data-live-href, so keep both attributes. The arrow sits
 * on the side it points to: before "Older", after "Newer".
 */
function fillUpNext(slot, posts, current) {
    var pair = current ? postNeighbours(posts, current) : { prev: null, next: null };
    if (!pair.prev && !pair.next) {
        slot.parentNode.removeChild(slot);
        return;
    }
    var root = siteRootPrefix();
    function link(side, cls) {
        if (!side) return '<span class="post-pagination-spacer"></span>';
        var arrow = '<span class="post-pagination-arrow" aria-hidden="true">' + (cls === 'prev' ? '&larr;' : '&rarr;') + '</span>';
        return '<a href="' + krEscapeHtml(root + (side.post.url || '')) + '" class="post-pagination-link post-pagination-' + cls + '"' +
            ' data-live="" data-live-under data-live-href="' + krEscapeHtml(side.post.url || '') + '">' +
            '<span class="post-pagination-label">' +
                (cls === 'prev' ? arrow + ' ' + side.label : side.label + ' ' + arrow) +
            '</span>' +
            '<span class="post-pagination-title">' + krEscapeHtml(side.post.title) + '</span>' +
            '</a>';
    }
    slot.querySelector('.post-pagination').innerHTML = link(pair.prev, 'prev') + link(pair.next, 'next');
}

/* Custom giscus themes matching the site palette (css/giscus-*.css).
   giscus only accepts absolute https URLs here, so the production
   domain is hardcoded; local previews get the stock themes. */
function giscusTheme() {
    var mode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    if (krIsLocalhost()) return mode;
    return 'https://www.kenreid.co.uk/css/giscus-' + mode + '.css';
}

/**
 * The comments section (giscus, backed by GitHub Discussions), built and
 * returned for the caller to place: the last slot of a post's end band,
 * or after a story's More Stories cards (renderGiscusComments). The
 * widget script runs once the section is in the document.
 *
 * Requires the giscus app on the repo (https://github.com/apps/giscus);
 * without it the widget shows an error banner inside this section and
 * nothing else on the page is affected.
 *
 * The theme follows the site's: a MutationObserver on <html data-theme>
 * tells the widget whenever the theme changes, however it changed (the
 * toggle, another tab, a script). The old sync listened for clicks on the
 * toggle and waited 50ms for the attribute to flip, which missed every
 * other route and raced the toggle's own view transition.
 */
function buildGiscusSection() {
    var section = document.createElement('section');
    section.id = 'giscus-comments';
    section.className = 'giscus-comments';
    section.setAttribute('aria-label', 'Comments');
    section.innerHTML =
        '<div class="kr-comments-head">' +
            '<h2>Comments</h2>' +
            '<button type="button" class="kr-comments-refresh" title="Reload to show new comments and reactions">' +
                '<span class="kr-refresh-icon" aria-hidden="true">&#x21bb;</span>Refresh' +
            '</button>' +
        '</div>' +
        '<div class="kr-comments-body"></div>';

    // giscus is a static embed of GitHub Discussions — nothing pushes
    // new comments/reactions to an open page. mountGiscus() is reused
    // by the Refresh button to re-fetch the whole widget on demand.
    function mountGiscus() {
        var body = section.querySelector('.kr-comments-body');
        body.innerHTML = '';
        var script = document.createElement('script');
        script.src = 'https://giscus.app/client.js';
        script.async = true;
        script.crossOrigin = 'anonymous';
        var config = {
            'data-repo': 'DrKenReid/DrKenReid.github.io',
            'data-repo-id': 'MDEwOlJlcG9zaXRvcnkyMjg0MTkzNDU=',
            'data-category': 'Announcements',
            'data-category-id': 'DIC_kwDODZ1nEc4DAtHj',
            'data-mapping': 'pathname',
            'data-strict': '0',
            'data-reactions-enabled': '1',
            'data-emit-metadata': '0',
            'data-input-position': 'bottom',
            'data-theme': giscusTheme(),
            'data-lang': 'en',
            'data-loading': 'lazy'
        };
        for (var key in config) {
            script.setAttribute(key, config[key]);
        }
        body.appendChild(script);
    }
    mountGiscus();

    section.querySelector('.kr-comments-refresh').addEventListener('click', function() {
        var btn = this;
        btn.classList.add('is-spinning');
        setTimeout(function() { btn.classList.remove('is-spinning'); }, 850);
        mountGiscus();
    });

    if ('MutationObserver' in window) {
        new MutationObserver(function() {
            var frame = section.querySelector('iframe.giscus-frame');
            if (!frame || !frame.contentWindow) return;
            frame.contentWindow.postMessage(
                { giscus: { setConfig: { theme: giscusTheme() } } },
                'https://giscus.app'
            );
        }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }
    return section;
}

/** Comments at the end of a short story, after its More Stories cards. */
function renderGiscusComments() {
    var storyPost = document.querySelector('.story-post');
    if (!storyPost || document.getElementById('giscus-comments')) return;
    storyPost.appendChild(buildGiscusSection());
}

/**
 * The end band: everything after a post's last word, in one
 * <footer class="kr-post-end"> at the end of .blog-post, in this order:
 *
 *   a. end mark     .kr-post-end__mark > .kr-fin (the ⁂). The reading
 *                   progress bar measures to it, so reaching it reads 100%.
 *   b. sign-off     .kr-signoff (buildSignOff): who wrote it and three
 *                   routes onward (KR_ROUTES), Subscribe and Coffee, the
 *                   share row (from 1360px), the disclaimer as fine print.
 *   c. up next      nav.kr-upnext: the pager, series-aware (postNeighbours,
 *                   fillUpNext). Each link is a data-live-under sketch host.
 *   d. related      .kr-post-end__related: the post's related-posts block,
 *                   moved in from where the generator bakes it (a draft's
 *                   is rendered here at runtime).
 *   e. comments     #giscus-comments (buildGiscusSection).
 *
 * Why this order: it runs from this post outward. The mark closes the
 * piece; the sign-off belongs to the piece (who wrote it, how to follow,
 * how to pass it on); then the one obvious next read, then a wider choice,
 * and last the conversation, which is open-ended and can be long, so
 * nothing useful sits below it. The disclaimer is fine print inside the
 * sign-off rather than a line of its own between sections.
 *
 * Why one band built here: these pieces used to be inserted one at a time
 * by five functions, each placing itself relative to whichever of the
 * others happened to exist yet, so their order depended on which promise
 * settled first. Now the slots are created together, in order, before any
 * data arrives, and each is filled in place: the pager and the sign-off's
 * routes when posts.json answers, the related cards when they are ready.
 * A slot with nothing to show (no neighbours) removes itself.
 *
 * Returns a promise that settles once the data-driven slots are filled,
 * for tests; nothing on the page waits for it.
 */
function renderPostEnd() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost) return Promise.resolve();
    if (blogPost.querySelector('.kr-post-end')) return Promise.resolve();

    var end = document.createElement('footer');
    end.className = 'kr-post-end';

    // a. End mark
    var mark = document.createElement('div');
    mark.className = 'kr-post-end__slot kr-post-end__mark';
    mark.innerHTML = '<div class="kr-fin" aria-hidden="true">⁂</div>';
    end.appendChild(mark);

    // b. Sign-off
    var signOff = buildSignOff();
    end.appendChild(signOff);

    // c. Up next
    var upNext = document.createElement('nav');
    upNext.className = 'kr-post-end__slot kr-upnext';
    upNext.setAttribute('aria-labelledby', 'kr-upnext-title');
    upNext.innerHTML = '<h2 class="kr-post-end__title" id="kr-upnext-title">Up next</h2>' +
        '<div class="post-pagination"></div>';
    end.appendChild(upNext);

    // d. Related posts
    var related = document.createElement('div');
    related.className = 'kr-post-end__slot kr-post-end__related';
    end.appendChild(related);

    // e. Comments
    var comments = buildGiscusSection();
    comments.classList.add('kr-post-end__slot');
    end.appendChild(comments);

    blogPost.appendChild(end);

    var neighbours = loadBlogPosts().then(function(posts) {
        var current = postByFile(posts, resolveCurrentPostFileName());
        signOff.setRoutes(KR_ROUTES[postCategory(current)]);
        fillUpNext(upNext, posts, current);
    }).catch(function() {
        if (upNext.parentNode) upNext.parentNode.removeChild(upNext);
    });

    function dropEmptyRelated() {
        if (related.parentNode && !related.querySelector('.related-posts')) related.parentNode.removeChild(related);
    }
    var cards = ensureRelatedPostsSection(related).then(function() {
        dropEmptyRelated();
        renderRelatedSeriesChips();
    }).catch(dropEmptyRelated);

    return Promise.all([neighbours, cards]);
}

/**
 * The reading-progress bar along the top of a post or story. It runs
 * from the article's top reaching the top of the window to the end mark
 * (.kr-fin) coming fully into view, so a reader who has seen the ⁂ has
 * read 100%, however much end band, related reading and comment thread
 * follows it. Without an end mark it measures to the disclaimer, and a
 * story, which has neither, to its own last line.
 */
function renderReadingProgress() {
    var blogPost = document.querySelector('.blog-post, .story-post');
    if (!blogPost || document.querySelector('.kr-progress-bar')) return;

    var bar = document.createElement('div');
    bar.className = 'kr-progress-bar';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    krOnScroll(function() {
        var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        var top = blogPost.getBoundingClientRect().top;
        var endEl = blogPost.querySelector('.kr-fin') || blogPost.querySelector('.post-disclaimer');
        var endBottom = endEl ? endEl.getBoundingClientRect().bottom : blogPost.getBoundingClientRect().bottom;
        // Scroll distance from "article top at the window's top" to "end
        // mark's bottom at the window's bottom", both measured from now.
        var total = endBottom - viewportHeight - top;
        var done = total > 0 ? -top / total : (endBottom <= viewportHeight ? 1 : 0);
        done = Math.min(1, Math.max(0, done));
        return function() {
            bar.style.transform = 'scaleX(' + done + ')';
        };
    });
}

/* Post furniture that is not the post's own argument: its h2s are left
   out of the contents rail and get no heading links. */
var POST_SECTION_SKIP = '.faq-section, .related-posts, .blog-thanks-cta, .giscus-comments, .plain-english-box, .post-pagination, .kr-post-end';

/** A post's own section headings (its h2s, minus the furniture's). */
function collectSectionHeadings(blogPost) {
    return Array.prototype.filter.call(blogPost.querySelectorAll('h2'), function(h) {
        if (h.closest(POST_SECTION_SKIP)) return false;
        var text = (h.textContent || '').trim();
        return text && text !== 'Common questions' && text !== 'Related posts';
    });
}

/** Gives each heading without an id a unique slug of its text, so it can be linked to. */
function ensureHeadingIds(headings) {
    var used = {};
    headings.forEach(function(h) {
        if (h.id) { used[h.id] = true; return; }
        var slug = (h.textContent || '').toLowerCase()
            .replace(/['’"“”]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 60) || 'section';
        var candidate = slug;
        var i = 2;
        while (used[candidate] || document.getElementById(candidate)) {
            candidate = slug + '-' + i++;
        }
        used[candidate] = true;
        h.id = candidate;
    });
}

/**
 * Hover-revealed # links on section headings for sharing anchors.
 */
function renderHeadingAnchors() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost || document.querySelector('.kr-hlink')) return;
    var headings = collectSectionHeadings(blogPost);
    if (!headings.length) return;
    ensureHeadingIds(headings);
    headings.forEach(function(h) {
        var a = document.createElement('a');
        a.className = 'kr-hlink';
        a.href = '#' + h.id;
        a.textContent = '#';
        a.setAttribute('aria-label', 'Link to this section');
        a.title = 'Link to this section';
        h.appendChild(a);
    });
}

/**
 * True once the reader has scrolled to the end of the post's own text:
 * the top of the end band (a story's thanks card) has come up into the
 * window. The share rail and the contents rail both retire at this
 * moment so the gutters clear together, and the phone share sheet rises.
 */
function postMainEndPassed(blogPost) {
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    var boundary = blogPost.querySelector('.kr-post-end, .blog-thanks-cta');
    var endReached;
    if (boundary) {
        endReached = boundary.getBoundingClientRect().top <= viewportHeight * 0.98;
    } else {
        endReached = blogPost.getBoundingClientRect().bottom < viewportHeight * 0.95;
    }
    return endReached && (window.scrollY || window.pageYOffset || 0) > 120;
}

/**
 * Sticky table of contents with scroll-spy, for posts with enough
 * sections to justify one. Rides the left gutter on wide screens,
 * mirroring the share rail on the right. Headings without ids get
 * slugs generated here.
 */
function renderPostToc() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost || document.querySelector('.kr-toc')) return;
    // Posts opt out with data-no-toc on .blog-post (e.g. layouts whose
    // wide figures collide with the side rail).
    if (blogPost.hasAttribute('data-no-toc')) return;

    var headings = collectSectionHeadings(blogPost);
    if (headings.length < 4) return;
    ensureHeadingIds(headings);

    var linksHtml = headings.map(function(h) {
        return '<a href="#' + krEscapeHtml(h.id) + '">' + krEscapeHtml((h.textContent || '').trim()) + '</a>';
    }).join('');

    var toc = document.createElement('nav');
    toc.className = 'kr-toc';
    toc.setAttribute('aria-label', 'Table of contents');
    toc.innerHTML = '<div class="kr-toc-label">Contents</div>' + linksHtml +
        '<span class="kr-toc__marker" aria-hidden="true"></span>';
    document.body.appendChild(toc);

    // Narrow screens get a collapsible Contents block under the meta
    // line instead of the side rail.
    if (!document.querySelector('.kr-toc-mobile')) {
        var mobileToc = document.createElement('details');
        mobileToc.className = 'kr-toc-mobile';
        mobileToc.innerHTML = '<summary>Contents</summary><nav aria-label="Table of contents">' + linksHtml + '</nav>';
        var anchorEl = blogPost.querySelector('.kr-series') ||
            blogPost.querySelector('.blog-meta');
        if (anchorEl && anchorEl.parentNode) {
            anchorEl.parentNode.insertBefore(mobileToc, anchorEl.nextSibling);
        }
        mobileToc.addEventListener('click', function(e) {
            var a = e.target.closest && e.target.closest('a');
            if (a) mobileToc.removeAttribute('open');
        });
    }

    // Scroll-spy. The section being read is the last one whose heading
    // has risen above 30% of the window: that is where the eye is once a
    // heading has scrolled up out of the way. Measured on every scroll
    // frame rather than by an IntersectionObserver, which only reports
    // headings as they cross its band: a jump (End, Home, a contents
    // link, a restored scroll position) crosses several at once or none,
    // and the observer then left the wrong entry lit.
    var links = toc.querySelectorAll('a');
    var activeId;
    function setActive(id) {
        Array.prototype.forEach.call(links, function(a) {
            var on = id !== null && a.getAttribute('href') === '#' + id;
            a.classList.toggle('active', on);
            // The marker slides along the track to the active entry rather
            // than each entry lighting its own border.
            if (on) {
                toc.style.setProperty('--kr-toc-top', a.offsetTop + 'px');
                toc.style.setProperty('--kr-toc-h', a.offsetHeight + 'px');
            }
        });
        toc.classList.toggle('is-tracking', id !== null);
    }

    var wideEnough = window.matchMedia('(min-width: 1240px)');
    krOnScroll(function() {
        var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        var line = viewportHeight * 0.3;
        var current = null;
        for (var i = 0; i < headings.length; i++) {
            var box = headings[i].getBoundingClientRect();
            if (!box.height) continue;              // hidden, e.g. inside a closed <details>
            if (box.top > line) break;              // headings are in document order
            current = headings[i].id;
        }
        var rect = blogPost.getBoundingClientRect();
        var width = toc.offsetWidth || 200;
        var passed = postMainEndPassed(blogPost);
        return function() {
            if (current !== activeId) {
                activeId = current;
                setActive(current);
            }
            // The left gutter, mirroring the share rail on the right.
            var left = rect.left - 28 - width;
            if (!wideEnough.matches || left < 8) {
                toc.classList.remove('is-visible');
                return;
            }
            toc.style.left = left + 'px';
            // Retire in step with the share rail on the other side of the page.
            toc.classList.toggle('is-visible', rect.top < viewportHeight * 0.5 && !passed);
        };
    });
}

/**
 * Citation hover previews: hovering or focusing a [n] reference shows
 * the full citation in a floating card instead of forcing a jump.
 * Escape hides it.
 */
function initCitePreviews() {
    var refs = document.querySelectorAll('.blog-post a.cite-ref');
    if (!refs.length) return;

    var tip = document.createElement('div');
    tip.className = 'cite-preview';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
    var hideTimer = null, anchored = null;
    var wide = krWidePost();

    function show(anchor) {
        var href = anchor.getAttribute('href') || '';
        if (href.charAt(0) !== '#') return;
        // A citation whose sidenote is showing beside it lights the note
        // up instead (initPostSidenotes marks it data-kr-note="beside"); a
        // second copy would float over the text. Every other citation, a
        // repeat of a reference or one whose note was too far down to
        // show, gets the card.
        if (wide.matches && anchor.getAttribute('data-kr-note') === 'beside') return;
        var target = document.getElementById(href.slice(1));
        if (!target) return;
        tip.innerHTML = target.innerHTML;
        // A jargon tooltip copied in with the reference would be a
        // tooltip inside a tooltip; keep its words, drop the <abbr>.
        Array.prototype.forEach.call(tip.querySelectorAll('abbr'), function(abbr) {
            abbr.replaceWith(document.createTextNode(abbr.textContent));
        });
        var rect = anchor.getBoundingClientRect();
        tip.classList.add('is-visible');
        // Where the browser can anchor one element to another, the card
        // hangs off the citation itself and flips below it when there is
        // no room above; the arithmetic that follows is the fallback.
        if (window.CSS && CSS.supports && CSS.supports('position-area', 'top')) {
            if (anchored && anchored !== anchor) anchored.style.anchorName = '';
            anchor.style.anchorName = '--kr-cite';
            anchored = anchor;
            tip.style.left = tip.style.top = '';
            return;
        }
        var width = Math.min(420, (window.innerWidth || 1000) - 24);
        tip.style.maxWidth = width + 'px';
        var tipRect = tip.getBoundingClientRect();
        var left = Math.max(12, Math.min(rect.left - tipRect.width / 2, (window.innerWidth || 1000) - tipRect.width - 12));
        var top = rect.top - tipRect.height - 10;
        if (top < 12) top = rect.bottom + 10;
        tip.style.left = left + 'px';
        tip.style.top = top + 'px';
    }

    function scheduleHide() {
        hideTimer = setTimeout(function() { tip.classList.remove('is-visible'); }, 150);
    }

    Array.prototype.forEach.call(refs, function(a) {
        a.addEventListener('mouseenter', function() { clearTimeout(hideTimer); show(a); });
        a.addEventListener('mouseleave', scheduleHide);
        a.addEventListener('focus', function() { clearTimeout(hideTimer); show(a); });
        a.addEventListener('blur', scheduleHide);
    });
    tip.addEventListener('mouseenter', function() { clearTimeout(hideTimer); });
    tip.addEventListener('mouseleave', scheduleHide);
    window.addEventListener('scroll', function() { tip.classList.remove('is-visible'); }, { passive: true });
    document.addEventListener('keydown', function(e) {
        if ((e.key === 'Escape' || e.key === 'Esc') && tip.classList.contains('is-visible')) {
            clearTimeout(hideTimer);
            tip.classList.remove('is-visible');
        }
    });
}

/**
 * Series landing pages live at /series-<slug>.html; the slug mirrors
 * the heading-id slugger so names map to files predictably.
 */
function seriesPageHref(name) {
    var slug = (name || '').toLowerCase()
        .replace(/['’"“”]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return '/series-' + slug + '.html';
}

/**
 * posts.json "series" may be a single {name, part} object or an array of
 * them (a post can belong to more than one series). Normalise to an array.
 */
function postSeriesList(p) {
    if (!p || !p.series) return [];
    return Array.isArray(p.series) ? p.series : [p.series];
}

/** A post's {name, part} entry for the named series, or null. */
function postSeriesEntry(p, name) {
    var list = postSeriesList(p);
    for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].name === name) return list[i];
    }
    return null;
}

/** Every post in the named series, in part order. */
function seriesParts(posts, name) {
    return posts.filter(function(p) {
        return postSeriesEntry(p, name);
    }).sort(function(a, b) {
        return (postSeriesEntry(a, name).part || 0) - (postSeriesEntry(b, name).part || 0);
    });
}

/**
 * Series landing page: a container with id="series-page" and a
 * data-series name gets every part rendered as a card, in part order.
 */
function renderSeriesPage() {
    var host = document.getElementById('series-page');
    var grid = document.getElementById('series-grid');
    if (!host || !grid) return;
    var name = host.getAttribute('data-series');

    loadBlogPosts().then(function(posts) {
        var parts = seriesParts(posts, name);
        if (!parts.length) return;

        grid.innerHTML = '';
        parts.forEach(function(p) {
            var col = createBlogCardElement(p);
            var imgWrap = col.querySelector('.blog-card-img');
            if (imgWrap) {
                var chip = document.createElement('span');
                chip.className = 'kr-series-chip';
                chip.textContent = 'Part ' + postSeriesEntry(p, name).part;
                imgWrap.appendChild(chip);
            }
            grid.appendChild(col);
        });

        // Every part runs its own sketch on hover (js/live-covers.js binds them).

        var count = document.getElementById('series-count');
        if (count) {
            var mins = parts.reduce(function(s, p) { return s + (p.readMinutes || 0); }, 0);
            count.textContent = parts.length + (parts.length === 1 ? ' part · ' : ' parts · ') + mins + (mins === 1 ? ' minute all told' : ' minutes all told');
        }
    }).catch(function() {});
}

/**
 * The series line under a post's meta line, for a post in a series of two
 * or more parts: one quiet line, "Part 3 of 10 · Algorithms, Live", the
 * name linking the series page, with every part listed in a native
 * <details> whose toggle sits at the end of the same line. It used to be
 * a bordered box listing up to seven parts above the first paragraph,
 * which pushed the article down the page on every part of every series.
 *
 * The toggle is the details' <summary>, positioned at the line's end by
 * CSS, so the list opens beneath the line and the toggle never moves. The
 * link cannot live inside the summary: a summary is a button to assistive
 * technology, and a link inside a button is unreachable to some of them.
 *
 * A post in two series gets two lines. The current part is marked with
 * aria-current and is not a link.
 */
function renderSeriesNav() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost || document.querySelector('.kr-series')) return;

    var currentFileName = resolveCurrentPostFileName();
    var root = siteRootPrefix();

    loadBlogPosts().then(function(posts) {
        var current = postByFile(posts, currentFileName);
        if (!current) return;
        var seriesList = postSeriesList(current).filter(function(s) { return s && s.name; });
        if (!seriesList.length) return;

        var anchor = blogPost.querySelector('.blog-meta');
        seriesList.forEach(function(entry) {
            var parts = seriesParts(posts, entry.name);
            if (parts.length < 2) return;

            var items = parts.map(function(p) {
                var isCurrent = p === current;
                var label = '<span class="kr-series-part-n">Part ' + postSeriesEntry(p, entry.name).part + '</span> ' +
                    krEscapeHtml(p.title);
                return isCurrent
                    ? '<li class="current" aria-current="page">' + label + '</li>'
                    : '<li><a href="' + krEscapeHtml(root + (p.url || '')) + '">' + label + '</a></li>';
            });

            var line = document.createElement('nav');
            line.className = 'kr-series';
            line.setAttribute('aria-label', 'Series: ' + entry.name);
            line.innerHTML =
                // A div, not a <p>: the post's prose rules would restyle it.
                '<div class="kr-series__line">Part ' + entry.part + ' of ' + parts.length +
                    ' <span aria-hidden="true">·</span> ' +
                    '<a class="kr-series__name" href="' + krEscapeHtml(root + seriesPageHref(entry.name).replace(/^\//, '')) + '">' +
                    krEscapeHtml(entry.name) + '</a></div>' +
                '<details class="kr-series__parts">' +
                    '<summary><span class="kr-series__toggle">All parts</span></summary>' +
                    '<ol class="kr-series-parts">' + items.join('') + '</ol>' +
                '</details>';

            if (anchor && anchor.parentNode) {
                anchor.parentNode.insertBefore(line, anchor.nextSibling);
            } else {
                blogPost.insertBefore(line, blogPost.firstChild);
            }
            anchor = line; // a second series line stacks under the first
        });
    }).catch(function() {});
}

/**
 * Small RSS icon link appended to the post meta line (the visible title
 * lives in the hero banner; the in-content h1 is screen-reader-only).
 */
function renderTitleRssLink() {
    var meta = document.querySelector('.blog-post .blog-meta');
    if (!meta || meta.querySelector('.kr-title-rss')) return;
    var a = document.createElement('a');
    a.className = 'kr-title-rss';
    a.href = siteRootPrefix() + 'feed.xml';
    a.setAttribute('aria-label', 'RSS feed');
    a.title = 'RSS feed';
    a.innerHTML = '<i class="ti-rss" aria-hidden="true"></i>';
    meta.appendChild(a);
}

/**
 * The meta line under the opener: the post's tags, each a link to the
 * blog filtered by it (blog.html?tag=), then the RSS icon.
 *
 * The tags are the post's own in data/posts.json, which is what the
 * listing filters on. Nine posts' hand-written tags had drifted from it,
 * so a chip could name a filter that finds nothing. The written ones are
 * shown (as links) until posts.json answers, and stay for a draft, which
 * it does not list.
 *
 * Under an opener the date and read time are dropped: the kicker above
 * already gives both, a screen away. They are the bare text before the
 * first tag ("1 June 2026 &middot; "), so every text node goes. Every
 * published post and every draft has an opener (apply_post_opener.py
 * --check fails CI on a post without one); a page with none keeps its
 * written date as it is.
 */
function renderPostMeta() {
    var meta = document.querySelector('.blog-post .blog-meta');
    if (!meta || meta.hasAttribute('data-kr-meta')) return;
    meta.setAttribute('data-kr-meta', '');

    var written = Array.prototype.map.call(meta.querySelectorAll('.blog-tag'), function(t) {
        return (t.textContent || '').trim();
    }).filter(Boolean);

    if (document.querySelector('.kr-opener')) {
        Array.prototype.slice.call(meta.childNodes).forEach(function(node) {
            if (node.nodeType === 3) meta.removeChild(node);
        });
    }

    function draw(tags) {
        Array.prototype.forEach.call(meta.querySelectorAll('.blog-tag'), function(t) {
            if (t.nextSibling && t.nextSibling.nodeType === 3 && !t.nextSibling.nodeValue.trim()) {
                meta.removeChild(t.nextSibling);
            }
            meta.removeChild(t);
        });
        var before = meta.querySelector('.kr-title-rss');
        tags.forEach(function(tag) {
            var a = document.createElement('a');
            a.className = 'blog-tag';
            a.rel = 'tag';
            a.href = siteRootPrefix() + 'blog.html?tag=' + encodeURIComponent(tag);
            a.textContent = tag;
            meta.insertBefore(a, before);
            meta.insertBefore(document.createTextNode(' '), before);
        });
    }

    draw(written);
    loadBlogPosts().then(function(posts) {
        var post = postByFile(posts, resolveCurrentPostFileName());
        if (post && post.tags && post.tags.length && post.tags.join('\n') !== written.join('\n')) draw(post.tags);
    }).catch(function() {});
}

/**
 * "Part N" series chips on related-post cards (both baked and
 * runtime-rendered), matching the listing and series pages.
 */
function renderRelatedSeriesChips() {
    var cards = document.querySelectorAll('.related-posts .blog-card');
    if (!cards.length) return;
    loadBlogPosts().then(function(posts) {
        var byFile = {};
        posts.forEach(function(p) {
            byFile[(p.url || '').split('/').pop()] = p;
        });
        Array.prototype.forEach.call(cards, function(card) {
            var imgWrap = card.querySelector('.blog-card-img');
            if (!imgWrap || imgWrap.querySelector('.kr-series-chip')) return;
            var file = (card.getAttribute('href') || '').split('/').pop().split('#')[0];
            var entry = postSeriesList(byFile[file])[0];
            if (!entry || !entry.name) return;
            var chip = document.createElement('span');
            chip.className = 'kr-series-chip';
            chip.textContent = 'Part ' + entry.part;
            chip.title = entry.name;
            imgWrap.appendChild(chip);
        });
    }).catch(function() {});
}

/**
 * Everything a blog post gets around its text: the meta line (tags and
 * RSS), the end band (renderPostEnd, built before the progress bar so the
 * bar has its end mark to measure to), the progress bar, the contents
 * rail, heading links, the series line and citation previews.
 */
function renderBlogPostEssentials() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost) return;

    renderTitleRssLink();
    renderPostMeta();
    renderPostEnd();
    renderReadingProgress();
    renderPostToc();
    renderHeadingAnchors();
    renderSeriesNav();
    initCitePreviews();
}

/**
 * "More stories" cards at the end of a short story, drawn from
 * data/stories.json (never from blog posts.json — fiction stays with
 * fiction). Resolves once the section is in the DOM (or skipped).
 */
function renderMoreStories() {
    var storyPost = document.querySelector('.story-post');
    if (!storyPost || storyPost.querySelector('.more-stories')) return Promise.resolve();

    var currentFileName = resolveCurrentPostFileName();
    return krFetchJson('data/stories.json')
        .then(function(stories) {
            var others = (Array.isArray(stories) ? stories : []).filter(function(s) {
                return (s.url || '').split('/').pop() !== currentFileName;
            }).slice(0, 3);
            if (!others.length) return;

            var section = document.createElement('div');
            section.className = 'related-posts more-stories';
            section.innerHTML = '<h2>More stories</h2><div class="row related-posts-grid"></div>';
            var grid = section.querySelector('.related-posts-grid');
            others.forEach(function(s) { grid.appendChild(createBlogCardElement(s)); });
            storyPost.appendChild(section);
        })
        .catch(function() {});
}

/**
 * The story-page counterpart of renderBlogPostEssentials. Stories get the
 * reading progress bar, share rail, More Stories cards, thanks CTA, and
 * comments — and deliberately NOT the disclaimer, TOC, jargon tooltips,
 * related blog posts, series nav, or prev/next (all essay furniture).
 */
function renderStoryPostEssentials() {
    var storyPost = document.querySelector('.story-post');
    if (!storyPost) return;

    renderReadingProgress();

    renderMoreStories().then(function() {
        renderBlogThanksCta();
        renderGiscusComments();
    }).catch(function() {
        renderBlogThanksCta();
        renderGiscusComments();
    });
}

/** Folds a post's first jargon/glossary box into a closed <details>. */
function autoCollapseTopJargonBox() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost) return;

    function normalizeText(text) {
        return (text || '').replace(/\s+/g, ' ').trim();
    }

    function isJargonBox(box) {
        if (!box || !box.classList || !box.classList.contains('plain-english-box')) {
            return false;
        }

        var heading = box.querySelector('h1, h2, h3, h4, h5, h6, summary');
        var headingText = normalizeText(heading ? heading.textContent : '').toLowerCase();
        return /jargon|glossary|plain english/.test(headingText);
    }

    var boxes = blogPost.querySelectorAll('.plain-english-box');
    var target = null;

    Array.prototype.some.call(boxes, function(box) {
        if (isJargonBox(box)) {
            target = box;
            return true;
        }
        return false;
    });

    if (!target) return;

    if (target.tagName === 'DETAILS') {
        target.classList.add('collapsible-jargon-box');
        target.removeAttribute('open');
        var existingSummary = target.querySelector(':scope > summary');
        if (existingSummary) {
            existingSummary.classList.add('collapsible-jargon-box__summary');
        }
        return;
    }

    var headingEl = target.querySelector('h1, h2, h3, h4, h5, h6');
    var titleText = normalizeText(headingEl ? headingEl.textContent : '') || 'Quick jargon guide';

    var details = document.createElement('details');
    details.className = target.className + ' collapsible-jargon-box';

    Array.prototype.forEach.call(target.attributes, function(attr) {
        if (attr.name === 'class') return;
        details.setAttribute(attr.name, attr.value);
    });

    var summary = document.createElement('summary');
    summary.className = 'collapsible-jargon-box__summary';

    var summaryTitle = document.createElement('span');
    summaryTitle.className = 'collapsible-jargon-box__title';
    summaryTitle.textContent = titleText;
    summary.appendChild(summaryTitle);

    details.appendChild(summary);

    var childNodes = Array.prototype.slice.call(target.childNodes);
    childNodes.forEach(function(node) {
        if (headingEl && node === headingEl) return;
        details.appendChild(node);
    });

    target.parentNode.replaceChild(details, target);
}

/**
 * Wraps glossary terms in the post's prose in <abbr title="definition">,
 * from the post's own jargon box plus a few site-wide terms. Safe to call
 * again (posts that render TeX do, once the maths is typeset).
 */
function applyJargonTooltips() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost) return;

    function normalizeText(text) {
        return (text || '').replace(/\s+/g, ' ').trim();
    }

    function addTermAlias(definitions, term, definition) {
        var normalizedTerm = normalizeText(term).replace(/[:：]\s*$/, '');
        if (!normalizedTerm) return;
        definitions[normalizedTerm.toLowerCase()] = definition;
    }

    function extractPageJargonDefinitions(container) {
        var definitions = {};
        var sourceBoxes = [];
        var boxes = container.querySelectorAll('.plain-english-box');

        Array.prototype.forEach.call(boxes, function(box) {
            var heading = box.querySelector('h1, h2, h3, h4, h5, h6');
            var headingText = normalizeText(heading ? heading.textContent : '').toLowerCase();
            var isJargonHeading = /jargon|glossary|plain english/.test(headingText);
            var listItems = box.querySelectorAll('li');
            var hasDefinitionRows = Array.prototype.some.call(listItems, function(li) {
                return !!li.querySelector('strong');
            });

            if (!isJargonHeading && !hasDefinitionRows) {
                return;
            }

            sourceBoxes.push(box);

            Array.prototype.forEach.call(listItems, function(li) {
                var strong = li.querySelector('strong');
                if (!strong) return;

                var rawLabel = normalizeText(strong.textContent).replace(/[:：]\s*$/, '');
                if (!rawLabel) return;

                var fullLine = normalizeText(li.textContent);
                var labelWithPunctuation = normalizeText(strong.textContent);
                var definition = fullLine.indexOf(labelWithPunctuation) === 0
                    ? fullLine.slice(labelWithPunctuation.length).trim()
                    : fullLine;

                definition = definition.replace(/^[:\-–—]\s*/, '').trim();
                if (!definition) return;

                addTermAlias(definitions, rawLabel, definition);

                var parenMatch = rawLabel.match(/^(.+?)\s*\(([^)]+)\)$/);
                if (parenMatch) {
                    addTermAlias(definitions, parenMatch[1], definition);
                    addTermAlias(definitions, parenMatch[2], definition);
                }
            });
        });

        return {
            definitions: definitions,
            sourceBoxes: sourceBoxes
        };
    }

    // Global jargon: cross-cutting terms that benefit every post even without a page-specific glossary.
    // Page-level definitions (in plain-english-box) always override these when the same key is defined.
    var GLOBAL_JARGON = {
        'ai': 'Artificial Intelligence — computer systems that can perform tasks normally requiring human intelligence, such as reasoning, learning, and problem-solving.',
        'ml': 'Machine Learning — a type of AI where systems improve by learning patterns from data rather than following explicit rules.',
        'llm': 'Large Language Model — an AI model trained on large amounts of text that can generate, summarise, and reason about language.',
        'genai': 'Generative AI — AI systems that can produce original content such as text, code, or images in response to a prompt.',
        'open source': 'software whose source code is publicly available and free to use, modify, and distribute.',
        'api': 'Application Programming Interface — a defined way for software systems to communicate and exchange data with each other.',
        'github': 'a web platform for hosting and sharing code repositories, built on Git version control.',
        'python': 'a popular programming language known for its readable syntax, widely used in data science, AI, and automation.',
        'json': 'JavaScript Object Notation — a lightweight, human-readable text format for storing and exchanging structured data.'
    };

    var extracted = extractPageJargonDefinitions(blogPost);
    var jargonDefinitions = Object.assign({}, GLOBAL_JARGON, extracted.definitions);
    var sourceBoxes = extracted.sourceBoxes;

    if (!Object.keys(jargonDefinitions).length) {
        return;
    }

    var sortedTerms = Object.keys(jargonDefinitions).sort(function(a, b) {
        return b.length - a.length;
    });

    function escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // (?:s|es)? allows the regex to match common plural forms (e.g. "LLMs", "algorithms", "processes").
    // match[1] captures the base term for the dictionary lookup while match[0] preserves the display form.
    var jargonRegex = new RegExp('\\b(' + sortedTerms.map(escapeRegex).join('|') + ')(?:s|es)?\\b', 'gi');
    // Elements whose words are never underlined: links, code, scripts,
    // and headings (a dotted term inside a title reads as accidental
    // formatting). ABBR, JARGON and H2 are handled by the walk itself.
    var skipTags = {
        A: true, CODE: true, PRE: true, SCRIPT: true, STYLE: true, TEXTAREA: true,
        H1: true, H3: true, H4: true, H5: true, H6: true
    };
    // Chrome and furniture: the meta line, disclosure labels, the
    // reference list and its sidenote copies, the series line, captions,
    // the pager, the fine print, the end band. A tooltip there is noise
    // in something the reader scans rather than reads.
    var SKIP_SELECTOR = '.blog-meta, summary, ol.references, .kr-sidenote, ' +
        '.kr-series, figcaption, .post-pagination, .post-disclaimer, .kr-post-end, ' +
        '.related-posts, .kr-toc-mobile, .fullres-card, .katex, .katex-display, .math-block';

    // One walk over the article in reading order, collecting what it
    // meets: text to scan, the post's own <jargon> markers, <abbr>s
    // already in place (hand-written, or from an earlier call), and each
    // h2. Each term is underlined once per section, where the reader
    // first meets it there: `seen` holds the definitions already used
    // and empties at every h2. Keyed by definition rather than by word,
    // so a term and its alias ("Special Circumstances", "SC") count as
    // one. A second call (after TeX is typeset) sees the <abbr>s the
    // first one made and does not add another beside them.
    var events = [];
    var FILTER = NodeFilter;
    var walker = document.createTreeWalker(blogPost, FILTER.SHOW_ELEMENT | FILTER.SHOW_TEXT, {
        acceptNode: function(node) {
            if (node.nodeType === 1) {
                if (node.tagName === 'H2') { events.push({ reset: true }); return FILTER.FILTER_REJECT; }
                if (skipTags[node.tagName] || sourceBoxes.indexOf(node) !== -1 ||
                    (node.matches && node.matches(SKIP_SELECTOR))) return FILTER.FILTER_REJECT;
                if (node.tagName === 'JARGON') { events.push({ marker: node }); return FILTER.FILTER_REJECT; }
                if (node.tagName === 'ABBR') { events.push({ existing: node }); return FILTER.FILTER_REJECT; }
                return FILTER.FILTER_SKIP;
            }
            if (!node.nodeValue || !node.nodeValue.trim()) return FILTER.FILTER_REJECT;
            // Leave TeX source alone. A term like "F" or "CR" sitting inside
            // \(...\) would be wrapped in an <abbr>, which splits the
            // text node and stops KaTeX finding its delimiters. Posts that
            // render math call this function again afterwards, so the prose
            // around the finished equations still gets its tooltips.
            if (/\\[([]/.test(node.nodeValue)) return FILTER.FILTER_REJECT;
            jargonRegex.lastIndex = 0;
            var hit = jargonRegex.test(node.nodeValue);
            jargonRegex.lastIndex = 0;
            return hit ? FILTER.FILTER_ACCEPT : FILTER.FILTER_REJECT;
        }
    });
    var textNode;
    while ((textNode = walker.nextNode())) events.push({ text: textNode });

    // The dictionary entry for a word as written: exact, else singular.
    function definitionFor(word) {
        var key = normalizeText(word).toLowerCase();
        return jargonDefinitions[key] || jargonDefinitions[key.replace(/es$/, '')] ||
            jargonDefinitions[key.replace(/s$/, '')] || '';
    }
    function makeAbbr(text, definition) {
        var abbr = document.createElement('abbr');
        abbr.setAttribute('title', definition);
        abbr.textContent = text;
        return abbr;
    }

    var seen = {};
    events.forEach(function(ev) {
        if (ev.reset) {
            seen = {};
        } else if (ev.existing) {
            var had = ev.existing.getAttribute('title') || definitionFor(ev.existing.textContent);
            if (had) seen[had] = true;
        } else if (ev.marker) {
            // <jargon key="wcag">WCAG</jargon> or <jargon>redundant coding</jargon>
            var node = ev.marker;
            var key = normalizeText(node.getAttribute('key') || '').toLowerCase();
            var definition = jargonDefinitions[key] || definitionFor(node.textContent);
            var words = node.textContent || '';
            node.parentNode.replaceChild(definition && !seen[definition]
                ? makeAbbr(words, definition) : document.createTextNode(words), node);
            if (definition) seen[definition] = true;
        } else {
            var text = ev.text.nodeValue;
            var fragment = document.createDocumentFragment();
            var lastIndex = 0;
            var match;
            jargonRegex.lastIndex = 0;
            while ((match = jargonRegex.exec(text)) !== null) {
                // match[1] is the term without a plural ending, for the
                // lookup; match[0] is the word as written, for the page.
                var found = jargonDefinitions[(match[1] || match[0]).toLowerCase()];
                if (!found || seen[found]) continue;
                seen[found] = true;
                if (match.index > lastIndex) {
                    fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
                }
                fragment.appendChild(makeAbbr(match[0], found));
                lastIndex = match.index + match[0].length;
            }
            if (!lastIndex) return;
            if (lastIndex < text.length) fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
            ev.text.parentNode.replaceChild(fragment, ev.text);
        }
    });

    // Markers the walk never reached (in a heading, a link, the chrome)
    // keep their words and lose the tooltip.
    Array.prototype.forEach.call(blogPost.querySelectorAll('jargon'), function(node) {
        node.parentNode.replaceChild(document.createTextNode(node.textContent || ''), node);
    });
}

/** Click a blockquote to copy it, with its attribution, to the clipboard. */
function initCopyQuotes() {
    document.querySelectorAll('blockquote').forEach(function(bq) {
        if (bq.querySelector('.copy-hint')) return;

        var hint = document.createElement('span');
        hint.className = 'copy-hint';
        hint.setAttribute('aria-hidden', 'true');
        hint.textContent = 'Click to copy';
        bq.appendChild(hint);

        bq.addEventListener('mousemove', function(e) {
            hint.style.left = (e.clientX + 14) + 'px';
            hint.style.top  = (e.clientY + 14) + 'px';
        });

        bq.addEventListener('click', function(e) {
            if (e.target.closest && e.target.closest('a')) return;

            var ps = bq.querySelectorAll('p');
            var cite = bq.querySelector('cite, footer');
            if (!ps.length) return;

            var quoteText = '“' + Array.prototype.map.call(ps, function(p) {
                return p.textContent.trim();
            }).join(' ') + '”';

            var attribution = '';
            if (cite) {
                var raw = cite.textContent.trim().replace(/^[—–‒\-\s]+/, '').trim();
                if (raw) attribution = ' — ' + raw;
            }

            var fullText = quoteText + attribution;

            function showCopied() {
                hint.textContent = 'Copied!';
                hint.classList.add('copied');
                setTimeout(function() {
                    hint.textContent = 'Click to copy';
                    hint.classList.remove('copied');
                }, 2000);
            }

            krCopyText(fullText, function(ok) { if (ok) showCopied(); });
        });
    });
}

/**
 * The site map: every standalone page, once, in reading order. A new page
 * is added here and nowhere else to reach the footer and the command
 * palette.
 *
 *   key        stable id; matches renderHeader's `active`/`hobbiesChild`
 *              keys where the page has one (series.html is the header's
 *              blogChild 'series-index')
 *   label      the page's name in lists
 *   href       site-relative; callers prefix siteRootPrefix()
 *   blurb      one line on what is there (the palette's subtitle)
 *   inFooter   'explore' (the footer's Explore column), 'fine' (the fine
 *              print under it) or false
 *   inPalette  offered by the command palette (js/palette.js)
 *   parent     optional: the key of the page this one is filed under, as
 *              the header files it (kr-nav-sub). The footer keeps a page
 *              and its children in one column.
 *
 * Who reads what: renderFooter reads label, href, inFooter and parent; palette.js
 * reads label, href, blurb and inPalette (it swaps a few blurbs for live
 * counts once its data loads); renderHeader reads nothing, see its note.
 * tests/js/site-chrome.test.js checks every href exists.
 */
var KR_PAGES = [
    { key: 'home', label: 'Home', href: 'index.html', blurb: 'Intro and latest posts', inFooter: false, inPalette: true },
    { key: 'about', label: 'About', href: 'about.html', blurb: 'Who I am', inFooter: 'explore', inPalette: true },
    { key: 'data_science', label: 'Data Science', href: 'data_science.html', blurb: 'Projects & publications', inFooter: 'explore', inPalette: true },
    { key: 'gallery', label: 'Photography', href: 'gallery.html', blurb: 'Every photograph, filterable by subject', inFooter: 'explore', inPalette: true },
    { key: 'map', label: 'Photo Map', href: 'map.html', blurb: 'Photographs by place', inFooter: 'explore', inPalette: true, parent: 'gallery' },
    { key: 'music', label: 'Music', href: 'music.html', blurb: 'Guitar & listening stats', inFooter: 'explore', inPalette: true },
    { key: 'literature', label: 'Literature', href: 'literature.html', blurb: 'Reading now, calendar, shelf, reviews', inFooter: 'explore', inPalette: true },
    { key: 'books', label: 'Every Book', href: 'books.html', blurb: 'Every cover, searchable by title and author', inFooter: 'explore', inPalette: true, parent: 'literature' },
    { key: 'quotes', label: 'Quote Wall', href: 'quotes.html', blurb: 'Passages saved while reading', inFooter: 'explore', inPalette: true, parent: 'literature' },
    { key: 'blog', label: 'Blog', href: 'blog.html', blurb: 'All posts', inFooter: 'explore', inPalette: true },
    { key: 'series', label: 'Series', href: 'series.html', blurb: 'Posts that run in parts', inFooter: 'explore', inPalette: true },
    { key: 'contact', label: 'Contact', href: 'contact.html', blurb: 'Get in touch', inFooter: 'explore', inPalette: true },
    { key: 'colophon', label: 'Colophon', href: 'colophon.html', blurb: 'How this site is built, measured', inFooter: 'fine', inPalette: true },
    { key: 'privacy', label: 'Privacy', href: 'privacy.html', blurb: 'What this site collects and the services it uses', inFooter: 'fine', inPalette: true }
];

/**
 * Site footer into #targetId: tagline, socials, the Explore column and the
 * fine print (both from KR_PAGES), the three latest posts (from
 * posts.json) and the command palette hint.
 */
function renderFooter(targetId) {
    var el = document.getElementById(targetId);
    if (!el) return;

    var year = new Date().getFullYear();
    var prefix = siteRootPrefix() || './';

    function pageLink(p) {
        return '<a href="' + prefix + p.href + '">' + krEscapeHtml(p.label) + '</a>';
    }
    function pageLinks(where) {
        return KR_PAGES.filter(function(p) { return p.inFooter === where; }).map(pageLink);
    }
    // The Explore list is set in two CSS columns, which break wherever the
    // count falls. A page and the pages filed under it (`parent`) are one
    // item with a nested list, and the item is never split (§18), so
    // adding a page cannot leave Literature at the foot of one column and
    // its reading pages at the head of the next.
    function exploreItems() {
        var shown = KR_PAGES.filter(function(p) { return p.inFooter === 'explore'; });
        var keys = shown.map(function(p) { return p.key; });
        return shown.filter(function(p) {
            return !p.parent || keys.indexOf(p.parent) === -1;
        }).map(function(p) {
            var kids = shown.filter(function(c) { return c.parent === p.key; });
            return '<li>' + pageLink(p) + (kids.length ? '<ul>' + kids.map(function(c) {
                return '<li>' + pageLink(c) + '</li>';
            }).join('') + '</ul>' : '') + '</li>';
        }).join('');
    }

    var socials =
        '<a href="https://www.linkedin.com/in/kennethneilreid" aria-label="LinkedIn"><i class="ti-linkedin" aria-hidden="true"></i></a>' +
        '<a href="https://github.com/DrKenReid" aria-label="GitHub"><i class="fa fa-github" aria-hidden="true"></i></a>' +
        '<a href="https://www.instagram.com/drkenreid/" aria-label="Instagram"><i class="fa fa-instagram" aria-hidden="true"></i></a>' +
        '<a href="https://bsky.app/profile/kenreid.co.uk" aria-label="Bluesky">' + BLUESKY_SVG + '</a>' +
        '<a href="https://drkenreid.substack.com" aria-label="Substack newsletter">' + SUBSTACK_SVG + '</a>' +
        '<a href="https://www.goodreads.com/user/show/42371562-ken-reid" aria-label="Goodreads"><i class="fa fa-book" aria-hidden="true"></i></a>' +
        '<a href="https://www.last.fm/user/GoheX" aria-label="Last.fm"><i class="fa fa-lastfm" aria-hidden="true"></i></a>' +
        '<a href="/feed.xml" aria-label="RSS Feed"><i class="ti-rss" aria-hidden="true"></i></a>';

    el.innerHTML = '<footer class="footer-area kr-footer"><div class="container">' +
        '<div class="kr-footer-grid">' +
        '<div class="kr-footer-col">' +
        '<div class="kr-footer-brand">Ken<span>.</span></div>' +
        '<p class="kr-footer-tagline">' + krEscapeHtml(KR_TAGLINE) + '</p>' +
        '<div class="social-info">' + socials + '</div>' +
        '</div>' +
        '<div class="kr-footer-col"><div class="kr-footer-heading">Explore</div><ul class="kr-footer-nav">' +
        exploreItems() + '</ul></div>' +
        '<div class="kr-footer-col"><div class="kr-footer-heading">Latest writing</div>' +
        '<ul class="kr-footer-posts" id="kr-footer-posts"><li>&hellip;</li></ul>' +
        '<p class="kr-footer-hint">Press <kbd class="kr-palette-kbd"><kbd class="kr-kbd-mod">Ctrl</kbd> <kbd>K</kbd></kbd> to search everything.</p>' +
        '</div>' +
        '</div>' +
        '<div class="kr-footer-bottom">' +
        '<p>Copyright &copy; ' + year + ' Ken Reid. Photographs &copy; Ken Reid, all rights reserved.</p>' +
        // Only pages the Explore column does not list: a page is in one
        // footer slot (inFooter), never two.
        '<p>' + pageLinks('fine').concat('<a href="/feed.xml">RSS</a>').join(' &middot; ') + '</p>' +
        '</div>' +
        '</div></footer>';

    krLabelModKeys(el);

    loadBlogPosts().then(function(posts) {
        var ul = document.getElementById('kr-footer-posts');
        if (!ul || !posts || !posts.length) return;
        ul.innerHTML = posts.slice(0, 3).map(function(p) {
            var href = krEscapeHtml(prefix + (p.url || ''));
            return '<li><a href="' + href + '">' + krEscapeHtml(p.title) + '</a>' +
                '<span>' + formatPostDate(p.date) + '</span></li>';
        }).join('');
    }).catch(function() {
        var ul = document.getElementById('kr-footer-posts');
        if (ul) ul.innerHTML = '';
    });
}

/* Paragraphs that are not the opening of the piece, whatever their
   position: a content warning (the component, or an older inline-styled
   one), a note, the fine print. */
var DROP_CAP_SKIP = '[style], [role="note"], .kr-content-warning, .kr-muted-note, .post-disclaimer, .figure-note';
var CONTENT_WARNING_TEXT = /^\s*(content|trigger)\s+warning\b/i;

/* The most words the small-caps lead-in runs to, and how far past that it
   may stretch to finish a quotation it has started. */
var LEAD_IN_WORDS = 5;
var LEAD_IN_QUOTE_SLACK = 8;

/**
 * Where the small-caps lead-in of `text` should stop: the end of the first
 * sentence or the fifth word, whichever comes first. A full stop inside a
 * quotation does not end the sentence. When the fifth word falls inside a
 * quotation, the lead-in runs on to the closing quote (and the comma or
 * stop against it) if that is at most LEAD_IN_QUOTE_SLACK words further;
 * otherwise it stops before the quotation opens. Either way the capitals
 * never end halfway through someone's words. Returns -1 for no lead-in.
 */
function leadInEnd(text) {
    var OPEN = '"“', CLOSE = '"”';
    var quoteAt = -1;       // index of the open quotation mark, -1 outside one
    var words = 0;

    function closingAfter(from) {
        var seen = 0;
        for (var k = from; k < text.length; k++) {
            if (CLOSE.indexOf(text[k]) !== -1) {
                var end = k + 1;
                while (end < text.length && /[,.;:!?)]/.test(text[end])) end++;
                return end;
            }
            if (/\s/.test(text[k]) && !/\s/.test(text[k - 1]) && ++seen > LEAD_IN_QUOTE_SLACK) return -1;
        }
        return -1;
    }

    for (var i = 0; i < text.length; i++) {
        var ch = text[i];
        if (quoteAt === -1 && OPEN.indexOf(ch) !== -1) { quoteAt = i; continue; }
        if (quoteAt !== -1 && CLOSE.indexOf(ch) !== -1) { quoteAt = -1; continue; }
        // A stop ends the sentence only before a space and a capital, or
        // at the end: "Ph.D. in", "3.5" and "e.g. the" run on.
        if (quoteAt === -1 && /[.!?]/.test(ch) && /^(\s+[^a-z\s]|\s*$)/.test(text.slice(i + 1, i + 4))) {
            var stop = i + 1;
            while (stop < text.length && CLOSE.indexOf(text[stop]) !== -1) stop++;
            return stop;
        }
        if (i > 0 && /\s/.test(ch) && !/\s/.test(text[i - 1]) && ++words === LEAD_IN_WORDS) {
            if (quoteAt === -1) return i;
            var closed = closingAfter(i + 1);
            if (closed !== -1) return closed;
            var before = text.slice(0, quoteAt).replace(/\s+$/, '');
            return before ? before.length : i;
        }
    }
    return -1;
}

/**
 * The opening of a post: a small-caps lead-in on its first paragraph, and
 * a drop cap when that paragraph is long enough to hold one.
 *
 * The paragraph is the first direct <p> of .blog-post that is not a
 * content warning, a note or otherwise hand-styled (DROP_CAP_SKIP): a cap
 * on "Trigger warning: ..." announced the warning as the start of the
 * essay. The lead-in is added at once.
 *
 * The cap (.drop-cap, drawn by style.css under an opener) is applied only
 * to a paragraph of three lines or more: a cap sinks three lines deep, so
 * on a two-line paragraph it hung into the one below. The line count is
 * settled once the fonts are ready (a first guess is made at once) and
 * measured again when the width changes, since a paragraph of three lines
 * on a desktop can be six on a phone and the reverse.
 */
function initDropCap() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost) return;

    var p = null;
    var paragraphs = blogPost.querySelectorAll(':scope > p');
    for (var i = 0; i < paragraphs.length; i++) {
        var text = (paragraphs[i].textContent || '').trim();
        if (!text || paragraphs[i].matches(DROP_CAP_SKIP) || CONTENT_WARNING_TEXT.test(text)) continue;
        p = paragraphs[i];
        break;
    }
    if (!p) return;

    var node = p.firstChild;
    if (node && node.nodeType === 3 && node.textContent.length > 2 && !p.querySelector('.lead-in')) {
        var lead = node.textContent.replace(/^\s+/, '');
        var end = leadInEnd(lead);
        if (end > 0 && end < lead.length) {
            var span = document.createElement('span');
            span.className = 'lead-in';
            span.textContent = lead.slice(0, end);
            node.textContent = lead.slice(end);
            p.insertBefore(span, node);
        }
    }

    function lineCount() {
        var style = getComputedStyle(p);
        var lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.2;
        return Math.round(p.getBoundingClientRect().height / lineHeight);
    }
    var measuredWidth = -1;
    function fit() {
        var width = p.clientWidth;
        if (width === measuredWidth) return;
        measuredWidth = width;
        // Measured without the cap, which would itself add lines.
        p.classList.remove('drop-cap');
        if (lineCount() >= 3) p.classList.add('drop-cap');
    }
    // A first measurement now, with whatever face is showing: the fallback
    // faces are metric-matched to Lora, so this nearly always agrees with
    // the one after the fonts arrive, and the cap does not pop in late
    // (and move the lines under it) on the first screen of the post.
    fit();
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    ready.then(function() {
        measuredWidth = -1;
        fit();
        var queued = false;
        window.addEventListener('resize', function() {
            if (queued) return;
            queued = true;
            window.requestAnimationFrame(function() { queued = false; fit(); });
        }, { passive: true });
    });
}

/**
 * Wraps a post's photography thumbnails in lightbox links to the full-size
 * original in the photos-v1 release (never a download of the repo file).
 */
function initLightboxFix() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost) return;

    var SKIP_SELECTORS = '.blog-card-img, .related-posts, .related-posts-grid, .blog-thanks-cta';

    function toFullSrc(src) {
        // Full-size photography lives in the photos-v1 GitHub release, not
        // the repo (same source gallery.js uses) — /img/photography/N.png
        // does not exist and 404s.
        var m = src.match(/\/thumb\/(\d+)\.webp$/);
        if (m) {
            return 'https://github.com/DrKenReid/DrKenReid.github.io/releases/download/photos-v1/' + m[1] + '.png';
        }
        return src.replace(/-thumb\.(jpg|jpeg)$/, '.$1');
    }

    blogPost.querySelectorAll('img').forEach(function(img) {
        var src = img.getAttribute('src') || '';
        if (!/\/thumb\/\d+\.webp$|-thumb\.(jpg|jpeg)$/.test(src)) return;
        if (img.closest(SKIP_SELECTORS)) return;

        var fullSrc = toFullSrc(src);
        var parent = img.parentElement;

        if (parent && parent.tagName === 'A') {
            if (!parent.classList.contains('img-lightbox')) return;
            var href = parent.getAttribute('href') || '';
            if (/\/thumb\/|-thumb\./.test(href)) parent.setAttribute('href', fullSrc);
            return;
        }

        var a = document.createElement('a');
        a.setAttribute('href', fullSrc);
        a.className = 'img-lightbox portfolio-img';
        a.setAttribute('aria-label', 'View full-size photo');
        a.style.cssText = 'display:block;cursor:zoom-in';
        img.parentNode.insertBefore(a, img);
        a.appendChild(img);
    });
}

/**
 * Full resolution mode: the norm for photography-led posts.
 *
 * Posts embed 400px thumbnails and keep the originals in the photos-v1
 * release, which is right for a first paint and wrong for looking at a
 * photograph. A post opts in with data-fullres on its .blog-post and gets
 * a panel at the top that swaps every thumbnail for its original, plus a
 * link under each photo for a reader who only wants one of them. The
 * estimate in the panel assumes ~2.7 MB an original; a post whose files
 * are heavier or lighter can override it with data-fullres-size (in MB).
 */
function initFullResMode() {
    var post = document.querySelector('.blog-post[data-fullres]');
    if (!post || post.querySelector('.fullres-card')) return;

    var RELEASE = typeof KR_RELEASE !== 'undefined' ? KR_RELEASE :
        'https://github.com/DrKenReid/DrKenReid.github.io/releases/download/photos-v1/';
    var imgs = Array.prototype.slice.call(
        post.querySelectorAll('figure img[src*="/thumb/"]'));
    if (!imgs.length) return;

    function stem(img) {
        var m = (img.dataset.thumb || img.getAttribute('src') || '').match(/\/thumb\/(\w+)\.webp$/);
        return m ? m[1] : null;
    }

    function setHiRes(img, btn, on) {
        if (on === (img.dataset.hires || '0')) return;
        if (on === '1') {
            img.dataset.thumb = img.dataset.thumb || img.getAttribute('src');
            img.style.opacity = '0.4';
            btn.textContent = 'loading original...';
            var cleanup = function() {
                img.removeEventListener('load', done);
                img.removeEventListener('error', fail);
                img.style.opacity = '';
            };
            var done = function() {
                cleanup();
                btn.textContent = 'full resolution ✓ (tap to revert)';
            };
            var fail = function() {
                cleanup();
                img.src = img.dataset.thumb;
                btn.textContent = 'could not load original';
                delete img.dataset.hires;
            };
            img.addEventListener('load', done);
            img.addEventListener('error', fail);
            img.dataset.hires = '1';
            img.src = RELEASE + stem(img) + '.png';
        } else {
            delete img.dataset.hires;
            img.src = img.dataset.thumb;
            img.style.opacity = '';
            btn.textContent = 'load full resolution';
        }
    }

    // Per-photo links. A photo inside a .photo-grid sheet has no caption of
    // its own (one figcaption covers the whole grid), so it is driven by the
    // panel alone and gets a button that is never shown.
    var pairs = [];
    imgs.forEach(function(img) {
        if (!stem(img)) return;
        var fig = img.closest('figure');
        var cap = img.closest('.photo-grid') ? null : (fig && fig.querySelector('figcaption'));
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fullres-link';
        btn.textContent = 'load full resolution';
        btn.addEventListener('click', function() {
            setHiRes(img, btn, img.dataset.hires === '1' ? '0' : '1');
        });
        if (cap) cap.appendChild(btn);
        pairs.push({ img: img, btn: btn });
    });
    if (!pairs.length) return;

    var mb = parseFloat(post.getAttribute('data-fullres-size')) ||
        Math.round(pairs.length * 2.7);
    var panel = document.createElement('div');
    panel.className = 'fullres-card';
    panel.innerHTML =
        '<div class="fullres-copy">' +
            '<strong>Load high resolution versions</strong>' +
            '<span>Swaps all ' + pairs.length + ' photos for the original files ' +
            '(roughly ' + mb + ' MB), which can take a while on a slow connection. ' +
            'Any single photo can also be loaded from the link beneath it.</span>' +
        '</div>' +
        '<label class="fullres-switch" title="Load high resolution versions">' +
            '<input type="checkbox" aria-label="Load high resolution versions">' +
            '<span class="fullres-slider"></span>' +
        '</label>';

    // Top of the post, under the meta line and whatever the shared chrome has
    // already slotted in there (series banner, narrow-screen contents).
    var anchorEl = post.querySelector('.kr-toc-mobile') ||
        post.querySelector('.kr-series') ||
        post.querySelector('.blog-meta');
    if (anchorEl && anchorEl.parentNode) {
        anchorEl.parentNode.insertBefore(panel, anchorEl.nextSibling);
    } else {
        post.insertBefore(panel, post.firstChild);
    }

    panel.querySelector('input').addEventListener('change', function() {
        var on = this.checked ? '1' : '0';
        pairs.forEach(function(p) { setHiRes(p.img, p.btn, on); });
    });
}

/**
 * Appends screen-reader-only "(opens in new tab)" text to target="_blank"
 * links (WCAG G201). A MutationObserver covers links injected later
 * (header, footer, thanks CTA, Bluesky feed, blog cards).
 */
function annotateNewTabLinks() {
    document.querySelectorAll('a[target="_blank"]:not([data-new-tab-annotated])').forEach(function(link) {
        link.setAttribute('data-new-tab-annotated', '1');
        var span = document.createElement('span');
        span.className = 'sr-only';
        span.textContent = ' (opens in new tab)';
        link.appendChild(span);
    });
}

/**
 * Homepage stats count up on first scroll into view. Parses the
 * rendered text ("49.7K+", "490+", "571"), animates from zero, and
 * restores the exact original string at the end. Skipped entirely for
 * prefers-reduced-motion.
 */
function initCountUpStats() {
    var els = document.querySelectorAll('.home-stat-value');
    if (!els.length || !('IntersectionObserver' in window)) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    function animateStat(el) {
        var text = (el.textContent || '').trim();
        var m = text.match(/^(\d+(?:\.\d+)?)(K?)(\+?)$/);
        if (!m) return;
        var target = parseFloat(m[1]);
        var suffix = m[2] + m[3];
        var decimals = (m[1].split('.')[1] || '').length;
        var start = null;
        var DURATION = 1100;
        var written = text;
        function step(ts) {
            // A live figure (Last.fm, the read shelf, the quote count)
            // can land before the first frame or mid-animation; if the
            // text is no longer ours, it is the truth, so stop rather
            // than write the stale one back.
            if (el.textContent.trim() !== written) return;
            if (start === null) start = ts;
            var t = Math.min(1, (ts - start) / DURATION);
            var eased = 1 - Math.pow(1 - t, 3);
            el.textContent = written = (target * eased).toFixed(decimals) + suffix;
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = m[1] + suffix;
            }
        }
        requestAnimationFrame(step);
    }

    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (!entry.isIntersecting) return;
            observer.unobserve(entry.target);
            animateStat(entry.target);
        });
    }, { threshold: 0.6 });

    els.forEach(function(el) { observer.observe(el); });
}

/**
 * Fade lazily-loaded images in instead of letting them pop. The class
 * is only added from JS to images that have not finished loading, so
 * nothing is ever hidden when JS is unavailable.
 */
function initLazyImageFade() {
    document.querySelectorAll('img[loading="lazy"]').forEach(function(img) {
        if (img.complete) return;
        img.classList.add('img-lazy-fade');
        function reveal() { img.classList.add('img-loaded'); }
        img.addEventListener('load', reveal, { once: true });
        img.addEventListener('error', reveal, { once: true });
    });
}

/* ---- Bluesky ----
   One request to the public API per page, shared by the homepage's Now
   strip and any renderBlueskyFeed on the page. The actor is the account's
   DID, which survives a change of handle; links are built from each
   post's own author handle for the same reason. */
var KR_BSKY_ACTOR = 'did:plc:ks2rxbqomt6vsae6tepl6pcm';
var KR_BSKY_PROFILE = 'https://bsky.app/profile/kenreid.co.uk';

/**
 * Resolves to Ken's recent Bluesky posts, newest first, replies and
 * reposts already left out. Fetched once per page (krFetchJson), with
 * room to spare so a run of reposts still leaves enough originals.
 */
function krBlueskyPosts() {
    return krFetchJson('https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=' +
        encodeURIComponent(KR_BSKY_ACTOR) + '&limit=20&filter=posts_no_replies')
        .then(function(data) {
            // A repost arrives as an item with a `reason` and someone
            // else's post inside it: their name, avatar and words, which
            // would read as Ken's in a feed labelled as his.
            return ((data && data.feed) || []).filter(function(item) {
                return !item.reason && item.post && item.post.record;
            });
        });
}

/** The bsky.app permalink of a feed item's post, from its own author and record key. */
function krBlueskyPermalink(post) {
    var handle = (post.author && post.author.handle) || '';
    var rkey = String(post.uri || '').split('/').pop();
    return handle && rkey
        ? 'https://bsky.app/profile/' + encodeURIComponent(handle) + '/post/' + encodeURIComponent(rkey)
        : KR_BSKY_PROFILE;
}

/**
 * Recent Bluesky posts as .bsky-post-card cards in `el`: skeleton cards
 * straight away, then up to opts.limit (default 5) of Ken's own posts,
 * with their text, date, avatar and attached images. Reposts are skipped
 * (see krBlueskyPosts). Every field from the API is escaped before it
 * touches the page. An empty feed or a failed request leaves a line with
 * a link to the profile instead. Returns the promise, for tests.
 */
function renderBlueskyFeed(el, opts) {
    if (!el) return Promise.resolve();
    var limit = (opts && opts.limit) || 5;
    var profileLink = '<a class="bsky-post-view-link" href="' + KR_BSKY_PROFILE + '" target="_blank" rel="noopener noreferrer">View on Bluesky</a>';

    el.innerHTML = ('<div class="bsky-post-card"><span class="kr-skel-bar" style="width:35%;"></span>' +
        '<span class="kr-skel-bar" style="width:92%;"></span>' +
        '<span class="kr-skel-bar" style="width:78%;"></span></div>').repeat(Math.min(limit, 3));

    function card(item) {
        var post = item.post, record = post.record, author = post.author || {};
        var handle = krEscapeHtml(author.handle || 'kenreid.co.uk');
        var created = new Date(record.createdAt);
        var date = isNaN(created) ? '' : created.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        var profile = krEscapeHtml('https://bsky.app/profile/' + encodeURIComponent(author.handle || 'kenreid.co.uk'));

        // Images ride either on the post itself or, on a quote post, as
        // the media half of a record-with-media embed.
        var embed = post.embed || {};
        var media = embed.$type === 'app.bsky.embed.recordWithMedia#view' ? embed.media : embed;
        var images = media && media.$type === 'app.bsky.embed.images#view' ? (media.images || []).slice(0, 4) : [];
        var imagesHtml = images.length
            ? '<div class="bsky-post-images count-' + images.length + '">' + images.map(function(img) {
                return '<img class="bsky-post-img" src="' + krEscapeHtml(img.thumb) + '" alt="' +
                    krEscapeHtml(img.alt || 'Image attached to the post') + '" loading="lazy">';
            }).join('') + '</div>'
            : '';

        return '<div class="bsky-post-card">' +
            '<div class="bsky-post-header">' +
            (author.avatar
                ? '<a href="' + profile + '" target="_blank" rel="noopener noreferrer" aria-label="@' + handle + ' on Bluesky">' +
                  '<img class="bsky-post-avatar" src="' + krEscapeHtml(author.avatar) + '" alt="" loading="lazy"></a>'
                : '') +
            '<div><div class="bsky-post-handle">@' + handle + '</div>' +
            '<div class="bsky-post-date">' + krEscapeHtml(date) + '</div></div>' +
            '</div>' +
            '<p class="bsky-post-text">' + krEscapeHtml(record.text || '').replace(/\n/g, '<br>') + '</p>' +
            imagesHtml +
            '<div class="bsky-post-meta"><a class="bsky-post-view-link" href="' + krEscapeHtml(krBlueskyPermalink(post)) +
            '" target="_blank" rel="noopener noreferrer">View on Bluesky &rarr;</a></div>' +
            '</div>';
    }

    return krBlueskyPosts().then(function(items) {
        el.innerHTML = items.length
            ? items.slice(0, limit).map(card).join('')
            : '<p class="bsky-post-meta text-center">No recent posts. ' + profileLink + '</p>';
    }).catch(function() {
        el.innerHTML = '<p class="bsky-post-meta text-center">Could not load posts. ' + profileLink + '</p>';
    });
}

/* Timing for krQuoteRotator. FADE_MS is the body's opacity transition in
   style.css (.kr-home-quote__body); the dwell is per word within bounds;
   a passage longer than LONG_WORDS is set a size down
   (.kr-home-quote__text--long), since the band holds the height of its
   tallest quotation and a few paragraph-long passages would otherwise
   size it for the two-line majority. */
var KR_QUOTE = { FADE_MS: 340, DWELL_PER_WORD: 260, DWELL_MIN: 7000, DWELL_MAX: 16000, LONG_WORDS: 45, SWIPE_MIN: 50 };

/**
 * A rotating quotation in the .kr-home-quote component: the homepage's
 * (index.html) and the literature page's band (js/literature.js), one
 * implementation for both. `section` is the component's root; its parts
 * are found by their component classes, so a page names only the root.
 * `quotes` is [{quote, author, book}]; opts.start is the first index.
 *
 * The contract, which WCAG 2.2.2 (Pause, Stop, Hide) is the reason for:
 *   - The countdown bar is the clock. The next quotation is drawn when the
 *     bar's animation ends, so the bar can never disagree with a timer,
 *     and anything that pauses the animation (the pause button, or the
 *     --hold modifier's hover and keyboard focus) pauses the rotation.
 *   - The pause button names the action it will take ("Pause the
 *     quotations", then "Resume the quotations"), with no aria-pressed: a
 *     pressed state on a button whose label also flips reads backwards.
 *   - Under prefers-reduced-motion nothing rotates and nothing fades; the
 *     arrows (and a swipe) still step through by hand. Turning the
 *     setting on mid-visit stops it too.
 *   - While it rotates by itself the quotation is aria-live="off", so a
 *     screen reader is not interrupted every few seconds; a change a
 *     reader asked for (an arrow, a swipe) is announced.
 *   - The band holds the height of its tallest quotation, measured, so a
 *     change never moves the page or the arrows under the pointer.
 * The attribution is the author and the book's title without its
 * Goodreads series bracket (krBookTitle).
 */
function krQuoteRotator(section, quotes, opts) {
    if (!section || !quotes || !quotes.length) return;
    var body = section.querySelector('.kr-home-quote__body');
    var text = section.querySelector('.kr-home-quote__text');
    var attr = section.querySelector('.kr-home-quote__attr');
    if (!body || !text || !attr) return;
    var controls = section.querySelector('.kr-home-quote__controls');
    var toggle = section.querySelector('.kr-home-quote__toggle');
    var bar = section.querySelector('.kr-home-quote__bar');
    var reduceMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    var still = !!(reduceMotion && reduceMotion.matches);
    var paused = false;
    var count = quotes.length;
    var start = ((((opts && opts.start) || 0) % count) + count) % count;
    var pending = start, fading = null;

    function line(q) {
        // Middot, not a comma: in letterspaced caps, "Kahneman, Thinking,
        // Fast and Slow" has two commas doing two different jobs.
        return q.book ? q.author + ' · ' + krBookTitle(q.book).title : q.author;
    }
    function words(q) { return String(q.quote).split(/\s+/).length; }
    function set(textEl, attrEl, q) {
        textEl.textContent = '“' + q.quote + '”';
        textEl.classList.toggle('kr-home-quote__text--long', words(q) > KR_QUOTE.LONG_WORDS);
        attrEl.textContent = line(q);
    }

    // A hidden twin of the block takes every quotation in turn at the
    // real width. Again on resize, since the line count changes with the
    // width, and once the web fonts are in, since they decide it too.
    function reserve() {
        var ghost = body.cloneNode(true);
        ghost.removeAttribute('id');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.style.cssText = 'position:absolute;left:0;right:0;top:0;min-height:0;visibility:hidden;pointer-events:none;';
        body.parentNode.appendChild(ghost);
        var gt = ghost.querySelector('.kr-home-quote__text');
        var ga = ghost.querySelector('.kr-home-quote__attr');
        var tall = 0;
        quotes.forEach(function(q) {
            set(gt, ga, q);
            tall = Math.max(tall, ghost.offsetHeight);
        });
        ghost.parentNode.removeChild(ghost);
        body.style.minHeight = tall + 'px';
    }

    function show(n) {
        var q = quotes[n];
        set(text, attr, q);
        if (still || !bar) return;
        section.style.setProperty('--kr-quote-dwell',
            Math.min(Math.max(words(q) * KR_QUOTE.DWELL_PER_WORD, KR_QUOTE.DWELL_MIN), KR_QUOTE.DWELL_MAX) + 'ms');
        // Restart the countdown: drop the animation, reflow, restore it.
        bar.style.animation = 'none';
        void bar.offsetWidth;
        bar.style.animation = '';
    }

    // One step, behind a fade: the words change at the bottom of it, where
    // nobody sees them go. Steps count from where the fade is heading, not
    // from what is on screen, so two quick presses move two quotations.
    // `asked` is true for a reader's own step.
    function step(d, asked) {
        pending = ((pending + d) % count + count) % count;
        body.setAttribute('aria-live', asked || paused || still ? 'polite' : 'off');
        if (still) { show(pending); return; }
        clearTimeout(fading);
        body.style.opacity = '0';
        fading = setTimeout(function() {
            show(pending);
            body.style.opacity = '1';
        }, KR_QUOTE.FADE_MS);
    }

    function stop() {
        still = true;
        clearTimeout(fading);
        body.style.opacity = '1';
        section.classList.remove('kr-home-quote--running');
        body.setAttribute('aria-live', 'polite');
    }

    show(start);
    body.setAttribute('aria-live', still ? 'polite' : 'off');
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(reserve); else reserve();
    var resized = null;
    window.addEventListener('resize', function() {
        clearTimeout(resized);
        resized = setTimeout(reserve, 200);
    });

    if (controls) controls.hidden = false;
    var prev = section.querySelector('.kr-home-quote__nav:not(.kr-home-quote__nav--next)');
    var next = section.querySelector('.kr-home-quote__nav--next');
    if (prev) prev.addEventListener('click', function() { step(-1, true); });
    if (next) next.addEventListener('click', function() { step(1, true); });

    var startX = 0;
    section.addEventListener('touchstart', function(e) { startX = e.changedTouches[0].screenX; }, { passive: true });
    section.addEventListener('touchend', function(e) {
        var dx = startX - e.changedTouches[0].screenX;
        if (Math.abs(dx) > KR_QUOTE.SWIPE_MIN) step(dx > 0 ? 1 : -1, true);
    }, { passive: true });

    if (still) return;
    section.classList.add('kr-home-quote--running');
    if (bar) bar.addEventListener('animationend', function() { if (!paused && !still) step(1, false); });
    if (toggle) {
        toggle.addEventListener('click', function() {
            paused = !paused;
            section.classList.toggle('kr-home-quote--paused', paused);
            toggle.setAttribute('aria-label', paused ? 'Resume the quotations' : 'Pause the quotations');
            body.setAttribute('aria-live', paused ? 'polite' : 'off');
        });
    }
    if (reduceMotion && reduceMotion.addEventListener) {
        reduceMotion.addEventListener('change', function(e) { if (e.matches) stop(); });
    }
}

/**
 * The homepage "Now" strip (#now-strip): what Ken is reading, listening
 * to and posting. Reading and listening come from data/now.json (the
 * weekly live-data refresh), the Bluesky post from the shared feed
 * request, and the latest story from data/stories.json while there is
 * one. Anything that fails to load is left out; if everything does, the
 * strip goes. The latest blog post is not repeated here: the page has a
 * section of its own for those.
 */
function renderNowStrip() {
    var mount = document.getElementById('now-strip');
    if (!mount) return;

    var root = siteRootPrefix();
    var items = [];

    // Skeleton cards while the live data loads: three, the usual count
    // (reading, listening, Bluesky), so the strip does not jump.
    mount.innerHTML = '<span class="section-eyebrow">Now</span>' +
        '<div class="kr-now">' +
        [1, 2, 3].map(function() {
            return '<span class="kr-now-item">' +
                '<span class="kr-now-icon kr-skeleton"></span>' +
                '<span class="kr-now-body" style="flex:1;">' +
                '<span class="kr-skel-bar" style="width:40%;"></span>' +
                '<span class="kr-skel-bar" style="width:85%;"></span>' +
                '<span class="kr-skel-bar" style="width:60%;"></span>' +
                '</span></span>';
        }).join('') + '</div>';

    // `icon` and `label` are the strip's own markup; `title`, `sub` and
    // `href` come from data files and are escaped when drawn. Icons are
    // themify glyphs or inline SVG, as on the rest of the site: an emoji
    // is drawn by each platform's own font, in its own colours, so it
    // cannot take the strip's colour or match the other cards.
    function addItem(order, icon, label, title, sub, href) {
        items.push({ order: order, icon: icon, label: label, title: title, sub: sub, href: href });
    }
    function local(path) {
        return /^https?:/.test(path) ? path : root + path;
    }

    function draw() {
        if (!items.length) { mount.innerHTML = ''; return; }
        items.sort(function(a, b) { return a.order - b.order; });
        mount.innerHTML = '<span class="section-eyebrow">Now</span>' +
            '<div class="kr-now">' + items.map(function(it) {
                return '<a class="kr-now-item" href="' + krEscapeHtml(it.href) + '"' +
                    (/^https?:/.test(it.href) ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' +
                    '<span class="kr-now-icon" aria-hidden="true">' + it.icon + '</span>' +
                    '<span class="kr-now-body">' +
                    '<span class="kr-now-label">' + it.label + '</span>' +
                    '<span class="kr-now-title">' + krEscapeHtml(it.title) + '</span>' +
                    (it.sub ? '<span class="kr-now-sub">' + krEscapeHtml(it.sub) + '</span>' : '') +
                    '</span>' +
                    '</a>';
            }).join('') + '</div>';
    }

    var nowPart = krFetchJson('data/now.json').then(function(now) {
        if (now && now.reading && now.reading.length) {
            var book = now.reading[0];
            var extra = now.reading.length > 1 ? ' (+' + (now.reading.length - 1) + ' more)' : '';
            addItem(1, '<i class="ti-book"></i>', 'Reading', String(book.title || '').replace(/\s*\(.*?\)\s*$/, ''),
                (book.author || '') + extra, local(book.link || 'literature.html'));
        }
        if (now && now.track && now.track.name) {
            // The bars only bounce while something is actually playing.
            var eq = '<span class="kr-eq' + (now.track.nowPlaying ? ' is-playing' : '') + '" aria-hidden="true"><span></span><span></span><span></span></span>';
            addItem(2, '<i class="ti-headphone-alt"></i>', (now.track.nowPlaying ? 'Now playing' : 'Last played') + eq,
                now.track.name, now.track.artist, local(now.track.url || 'music.html'));
        }
    });

    var blueskyPart = krBlueskyPosts().then(function(posts) {
        for (var i = 0; i < posts.length; i++) {
            // A post's line breaks become " / " rather than vanishing, so a
            // list or a two-line joke still reads as separate lines.
            var text = String(posts[i].post.record.text || '').split(/\n+/).map(function(line) {
                return line.replace(/\s+/g, ' ').trim();
            }).filter(Boolean).join(' / ');
            if (!text) continue;  // an image with no words has nothing to quote
            if (text.length > 92) text = text.slice(0, 92).replace(/\s\S*$/, '') + '…';
            var handle = (posts[i].post.author && posts[i].post.author.handle) || 'kenreid.co.uk';
            addItem(3, BLUESKY_SVG, 'On Bluesky', text, '@' + handle, krBlueskyPermalink(posts[i].post));
            return;
        }
    });

    // The latest short story, silently absent while stories.json is empty.
    var storyPart = krFetchJson('data/stories.json').then(function(stories) {
        if (Array.isArray(stories) && stories.length) {
            addItem(4, '<i class="ti-pencil-alt"></i>', 'Latest story', stories[0].title,
                formatPostDate(stories[0].date), local(stories[0].url || 'writing.html'));
        }
    });

    function settled(p) { return p.catch(function() {}); }
    Promise.all([nowPart, blueskyPart, storyPart].map(settled)).then(draw);
}

/**
 * Live stats from data/lastfm.json (refreshed weekly by a GitHub
 * Action). Elements opt in with data-lastfm="scrobbles"; the static
 * number in the HTML is the fallback if the fetch fails.
 */
function updateLastfmStats() {
    var els = document.querySelectorAll('[data-lastfm="scrobbles"]');
    if (!els.length) return;

    krFetchJson('data/lastfm.json').then(function(data) {
        var n = data && data.scrobbles;
        if (typeof n !== 'number' || !isFinite(n) || n <= 0) return;
        var text = n >= 1000 ? (Math.floor(n / 100) / 10) + 'K+' : String(n);
        els.forEach(function(el) { el.textContent = text; });
    }).catch(function() {});
}

/**
 * Click-to-zoom inside any Magnific lightbox: click toggles ~2.4x zoom
 * anchored at the cursor, moving the pointer pans (via transform-origin),
 * clicking again or navigating resets. Touch: tap toggles, drag pans.
 *
 * The pan listeners exist only while a photograph is zoomed. Left on the
 * document permanently they ran a selector query on every mouse move on
 * every page, lightbox or not.
 */
function initLightboxZoom() {
    var ZOOM_CLASS = 'kr-zoomed';
    var zoomed = null;

    function setOrigin(img, clientX, clientY) {
        var rect = img.getBoundingClientRect();
        var x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        var y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
        img.style.transformOrigin = x + '% ' + y + '%';
    }

    function onMouseMove(e) {
        // Magnific swaps the <img> when the reader moves to the next
        // photograph, which is also what ends the zoom.
        if (!stillZoomed()) { stopPanning(); return; }
        setOrigin(zoomed, e.clientX, e.clientY);
    }
    function onTouchMove(e) {
        if (!stillZoomed()) { stopPanning(); return; }
        if (e.touches && e.touches.length) setOrigin(zoomed, e.touches[0].clientX, e.touches[0].clientY);
    }
    function stillZoomed() {
        return !!zoomed && zoomed.isConnected && zoomed.classList.contains(ZOOM_CLASS);
    }
    function startPanning(img) {
        zoomed = img;
        document.addEventListener('mousemove', onMouseMove, { passive: true });
        document.addEventListener('touchmove', onTouchMove, { passive: true });
    }
    function stopPanning() {
        zoomed = null;
        document.removeEventListener('mousemove', onMouseMove, { passive: true });
        document.removeEventListener('touchmove', onTouchMove, { passive: true });
    }

    document.addEventListener('click', function(e) {
        var img = e.target.closest && e.target.closest('img.mfp-img');
        if (!img) return;
        e.preventDefault();
        e.stopPropagation();
        var wrap = document.querySelector('.mfp-wrap');
        if (img.classList.contains(ZOOM_CLASS)) {
            img.classList.remove(ZOOM_CLASS);
            if (wrap) wrap.classList.remove('kr-zoom-wrap');
            stopPanning();
        } else {
            setOrigin(img, e.clientX, e.clientY);
            img.classList.add(ZOOM_CLASS);
            if (wrap) wrap.classList.add('kr-zoom-wrap');
            startPanning(img);
        }
    }, true);
}

/* ---- Utilities ---- */

// Full-size originals live in the photos-v1 GitHub release, not the repo.
var KR_RELEASE = 'https://github.com/DrKenReid/DrKenReid.github.io/releases/download/photos-v1/';

/**
 * The gallery's subject filters, in the order they are offered. `key` is
 * the tag in photo-tags.json and the ?tag= value; `label` is what the
 * filter button says; `also` holds the words someone would type for a
 * label that is an abbreviation. gallery.js builds its filter bar from
 * this and the command palette its "photos" entries, so a subject is
 * added here once. Plain labels: emoji prefixes rendered at a different
 * size on every platform, and the icon fonts have no paw, snowflake or
 * sunrise to substitute.
 */
var KR_PHOTO_CATEGORIES = [
    { key: 'landscape', label: 'Landscape' },
    { key: 'urban', label: 'Urban' },
    { key: 'architecture', label: 'Architecture' },
    { key: 'abandoned', label: 'Abandoned' },
    { key: 'wildlife', label: 'Wildlife' },
    { key: 'nature', label: 'Nature' },
    { key: 'portrait', label: 'Portrait' },
    { key: 'bw', label: 'B&W', also: 'black and white monochrome' },
    { key: 'silhouette', label: 'Silhouette' },
    { key: 'winter', label: 'Winter' }
];

// Earlier names, kept while pages outside the tracked set still call
// them: the strip stopped being an Instagram feed, and the read time
// stopped being estimated here once posts.json carried it.
var renderInstagramSection = renderPhotoStrip;
var estimateReadingMinutes = postReadMinutes;

/**
 * The one HTML escaper: safe for text content and for quoted attribute
 * values alike. Anything from a data file or an API goes through it before
 * it is spliced into markup; use textContent instead where you can.
 */
function krEscapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Goodreads files a series book as "The Captain (The Last Horizon, #1)".
   Shown whole, the bracket is the loudest thing on a spine, a card or a
   quotation's attribution, so every display takes the title and gives the
   series a quieter line of its own (or leaves it out). The series reads
   "Book 1" when the title already names it ("Dune (Dune, #1)", "Beware of
   Chicken 2 (Beware of Chicken, #2)") and "The Last Horizon #1" when it
   does not. A bracket that is not a series (an edition, "(The Great
   Courses)") is part of the title and stays. Display only: matching a
   review to its book still compares the raw titles (js/literature.js).
   Here rather than in bookshelf.js because the homepage's quotation has
   the same titles and loads none of the reading pages' scripts. */
var KR_SERIES_BRACKET = /\s*\(([^()]+?),?(?:\s*#\s*|\s+Book\s+)(\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?)\)\s*$/i;

/** The display form of a Goodreads title: {title, series}. */
function krBookTitle(t) {
    var raw = String(t == null ? '' : t).trim();
    var m = KR_SERIES_BRACKET.exec(raw);
    var title = m ? raw.slice(0, m.index).trim() : '';
    if (!m || !title) return { title: raw, series: '' };
    var fold = function(s) {
        return String(s).toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
    };
    var name = m[1].trim(), n = m[2].replace(/\s+/g, '');
    var several = /[-–]/.test(n);
    var series = fold(title).indexOf(fold(name)) === 0
        ? (several ? 'Books ' : 'Book ') + n
        : name + ' #' + n;
    return { title: title, series: series };
}

/** True on macOS and iOS, where the command palette's modifier key is Command. */
function krIsMac() {
    var hints = navigator.userAgentData;
    var platform = (hints && hints.platform) || navigator.platform || navigator.userAgent || '';
    return /mac|iphone|ipad|ipod/i.test(platform);
}

/**
 * Keyboard hints are written for Windows and Linux,
 * <kbd class="kr-kbd-mod">Ctrl</kbd>, and this relabels each one under
 * `scope` (default: the document) as the Command key on a Mac. The glyph
 * is hidden from screen readers, which hear the key's name instead.
 * Idempotent, so it can run on the whole page and again on late markup.
 */
function krLabelModKeys(scope) {
    if (!krIsMac()) return;
    (scope || document).querySelectorAll('kbd.kr-kbd-mod:not([data-kr-mod])').forEach(function(key) {
        key.setAttribute('data-kr-mod', 'mac');
        key.innerHTML = '<span aria-hidden="true">⌘</span><span class="sr-only">Command</span>';
    });
}

/** Copies text to the clipboard (older browsers included); done(ok) reports how it went. */
function krCopyText(text, done) {
    function fallback() {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) {}
        document.body.removeChild(ta);
        if (done) done(ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () { if (done) done(true); }, fallback);
    } else {
        fallback();
    }
}

var krScrollJobs = [];
var krScrollQueued = false;

/* One frame's worth of scroll work: every job measures, then every
   returned writer runs. A job that throws is reported without stopping
   the others. */
function krRunScrollJobs() {
    krScrollQueued = false;
    var writers = [];
    function attempt(fn) {
        try {
            return fn();
        } catch (e) {
            setTimeout(function() { throw e; });
        }
    }
    krScrollJobs.forEach(function(job) {
        var write = attempt(job);
        if (typeof write === 'function') writers.push(write);
    });
    writers.forEach(attempt);
}

function krQueueScrollJobs() {
    if (krScrollQueued) return;
    krScrollQueued = true;
    window.requestAnimationFrame(krRunScrollJobs);
}

/**
 * Runs `fn` at most once a frame while the page scrolls or resizes, once
 * on the next frame after registering, and whenever the page's height
 * changes under a still reader (a lazy image arriving, the related cards
 * or the comments filling in, a <details> opening), which moves
 * everything below it without a scroll event.
 *
 * Every piece of a post that follows the scroll position frame by frame
 * (the progress bar, the contents rail, the share rail and sheet) goes
 * through here, so they share one passive scroll listener and one
 * requestAnimationFrame per frame however many are running. Each used to
 * add its own listener and read and write layout in turn, and every write
 * after a read forced the browser to lay the page out again before the
 * next read. What does not follow the scroll position stays out, since a
 * job here runs on every frame of a scroll: the sidenotes, which only
 * move when the layout does (they batch their own triggers into one
 * frame), the drop cap, which refits on a width change, and the citation
 * card, which only needs to know that a scroll happened, to close.
 *
 * Two phases keep the reads together: `fn` should only MEASURE (rects,
 * scroll position, media queries) and return a function that WRITES
 * (classes, styles). All the measuring in a frame happens before any of
 * the writing, so the frame lays out once. A job that has nothing to
 * write returns nothing.
 *
 *   krOnScroll(function() {
 *       var top = el.getBoundingClientRect().top;       // read
 *       return function() {                             // write
 *           bar.style.transform = 'scaleX(' + f(top) + ')';
 *       };
 *   });
 *
 * @param {function(): (function(): void|undefined)} fn
 */
function krOnScroll(fn) {
    if (!krScrollJobs.length) {
        window.addEventListener('scroll', krQueueScrollJobs, { passive: true });
        window.addEventListener('resize', krQueueScrollJobs, { passive: true });
        if ('ResizeObserver' in window && document.body) {
            new ResizeObserver(krQueueScrollJobs).observe(document.body);
        } else {
            window.addEventListener('load', krQueueScrollJobs);
        }
    }
    krScrollJobs.push(fn);
    krQueueScrollJobs();
}

/**
 * Shared Magnific lightbox opener for sets built from data rather than
 * links (the photo map's regions). items: [{src, title}], index: starting
 * slide. The callbacks hand the popup to krLightboxA11y (js/lightbox.js),
 * as every other popup on the site does, so this one is a named dialog
 * that announces its position and hides the theme toggle, which would
 * otherwise sit on the close button. A page that opens it loads
 * lightbox.js; without it the popup still works, just unnamed.
 */
function openKrLightbox(items, index) {
    if (typeof jQuery === 'undefined' || !jQuery.magnificPopup) return false;
    function a11y() { if (window.krLightboxA11y) window.krLightboxA11y(this, { noun: 'Photograph' }); }
    jQuery.magnificPopup.open({
        items: items,
        type: 'image',
        mainClass: 'kr-lightbox mfp-fade',
        image: { verticalFit: true },
        gallery: { enabled: true, preload: [0, 2], navigateByImgClick: true },
        callbacks: { open: a11y, change: a11y }
    }, index || 0);
    return true;
}

/**
 * Arrow buttons at the ends of a .kr-snap-row (style.css), for a mouse. A
 * row that holds more than fits (the blog's series shelf: seven pills in
 * a 987px row at 1440) hinted at the rest only with a fading edge, and a
 * wheel without sideways scrolling could not reach it. Wraps the row in
 * .kr-snap-nav and adds a button at each end that pages the row along;
 * each shows only while there is more that way (.can-prev, .can-next),
 * and CSS shows them only where there is a fine pointer that can hover.
 * They are out of the Tab order and hidden from screen readers: keyboard
 * focus reaches every item in the row, which scrolls it into view. The
 * wrapper takes the row's place, so a parent's layout rules for the row
 * belong on the wrapper once this has run. Idempotent.
 */
function krSnapRowArrows(row) {
    if (!row || !row.parentNode || row.parentNode.classList.contains('kr-snap-nav')) return;
    var wrap = document.createElement('div');
    wrap.className = 'kr-snap-nav';
    row.parentNode.insertBefore(wrap, row);
    wrap.appendChild(row);
    ['prev', 'next'].forEach(function(side) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'kr-snap-nav__btn kr-snap-nav__btn--' + side;
        btn.tabIndex = -1;
        btn.setAttribute('aria-hidden', 'true');
        btn.addEventListener('click', function() {
            var by = Math.max(120, row.clientWidth * 0.8) * (side === 'prev' ? -1 : 1);
            row.scrollBy({ left: by, behavior: 'smooth' });
        });
        wrap.appendChild(btn);
    });
    function sync() {
        var max = row.scrollWidth - row.clientWidth;
        wrap.classList.toggle('can-prev', row.scrollLeft > 2);
        wrap.classList.toggle('can-next', row.scrollLeft < max - 2);
    }
    row.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
}

/**
 * Wires toolbar disclosure buttons to their panels: only one panel open at
 * a time, Escape closes the open one and hands focus back to its button,
 * and a click outside dismisses it.
 *
 * `pairs` is [[buttonId, panelId], ...]. `insideSelector` names the regions
 * that do not count as outside — the toolbar and panels are always included,
 * so it is for sibling controls such as a filter shelf.
 *
 * The outside-click listener runs in the capture phase on purpose: filter
 * buttons that rewrite their own innerHTML would otherwise be detached by
 * the time a bubbling handler ran, making closest() report the click as
 * outside and dismissing the panel on every such click.
 *
 * Returns { close(), open(panelId) }. open() is for a page that arrives
 * already filtered from a link: it shows that panel without moving focus,
 * so a short list never looks like the whole collection.
 */
function krInitTogglePanels(pairs, insideSelector) {
    var inside = pairs.map(function(p) { return '#' + p[1]; });
    if (insideSelector) inside.push(insideSelector);

    function close() {
        var toggle = null;
        pairs.forEach(function(pair) {
            var panel = document.getElementById(pair[1]);
            if (!panel || panel.hidden) return;
            panel.hidden = true;
            var btn = document.getElementById(pair[0]);
            if (btn) {
                btn.setAttribute('aria-expanded', 'false');
                toggle = btn;
            }
        });
        return toggle;
    }

    pairs.forEach(function(pair) {
        var btn = document.getElementById(pair[0]);
        var panel = document.getElementById(pair[1]);
        if (!btn || !panel) return;
        inside.push('#' + pair[0]);
        btn.addEventListener('click', function() {
            var opening = panel.hidden;
            // Close the others first, then apply this button's new state.
            close();
            panel.hidden = !opening;
            btn.setAttribute('aria-expanded', String(opening));
        });
    });

    var insideSel = inside.join(', ');
    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape' && e.key !== 'Esc') return;
        var btn = close();
        if (btn) btn.focus();
    });
    document.addEventListener('click', function(e) {
        if (!e.target || !e.target.closest) return;
        if (e.target.closest(insideSel)) return;
        close();
    }, true);

    function open(panelId) {
        pairs.forEach(function(pair) {
            if (pair[1] !== panelId) return;
            var panel = document.getElementById(pair[1]);
            var btn = document.getElementById(pair[0]);
            if (!panel || !btn) return;
            close();
            panel.hidden = false;
            btn.setAttribute('aria-expanded', 'true');
        });
    }

    return { close: close, open: open };
}

/* ---- Listing controls ----
   The parts blog.js and series-index.js build their filter and sort panels
   from. None keeps state: each reads the caller's through a callback and
   reports a click back, so the listing stays the one owner of its state
   (blog.js's STATE MODEL) and a deep link, a click and a reset all draw
   the same controls. Buttons are .gallery-filter-btn pills throughout. */

/** A pressable control's state: the .active class the CSS draws, and aria-pressed. */
function krSetPressed(btn, on) {
    btn.classList.toggle('active', !!on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
}

/** "Label (12)": the label escaped, the count in .filter-count. Returns markup. */
function krCountLabel(label, count) {
    return krEscapeHtml(label) + ' <span class="filter-count">(' + count + ')</span>';
}

/**
 * One labelled row of a filter panel (.kr-facet-row): a caption, then a
 * role="group" holder named `ariaLabel`, which is returned for the row's
 * buttons. Rows stack in the order they are added.
 */
function krFacetRow(container, label, ariaLabel) {
    var row = document.createElement('div');
    row.className = 'kr-facet-row';

    var caption = document.createElement('span');
    caption.className = 'kr-facet-row__label';
    caption.textContent = label;
    row.appendChild(caption);

    var btns = document.createElement('div');
    btns.className = 'kr-facet-row__btns';
    btns.setAttribute('role', 'group');
    btns.setAttribute('aria-label', ariaLabel);
    row.appendChild(btns);

    container.appendChild(row);
    return btns;
}

/** A filter button appended to `holder`. `html` is trusted markup: build it with krCountLabel. */
function krFacetButton(holder, html, onClick) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn gallery-filter-btn';
    btn.innerHTML = html;
    btn.addEventListener('click', onClick);
    holder.appendChild(btn);
    return btn;
}

/**
 * The "Clear all filters" row, added last to a panel. Returns
 * { sync(activeCount) }, which hides the row while nothing is active. The
 * button disappears as it is pressed, so focus goes to the element with
 * id `focusAfter` (default the panel's toggle, #kr-filter-toggle) rather
 * than falling to <body>.
 */
function krClearRow(container, onClear, focusAfter) {
    var row = document.createElement('div');
    row.className = 'kr-facet-row kr-facet-row--clear';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'kr-clear-filters';
    btn.className = 'btn gallery-filter-btn kr-facet-clear';
    btn.textContent = 'Clear all filters';
    btn.addEventListener('click', function() {
        onClear();
        var toggle = document.getElementById(focusAfter || 'kr-filter-toggle');
        if (toggle) toggle.focus();
    });
    row.appendChild(btn);
    container.appendChild(row);
    return { sync: function(activeCount) { row.hidden = !activeCount; } };
}

/**
 * A sort panel: one button per option. A first press picks an option in
 * its default direction, a second press on it reverses the direction.
 *
 * panel  the (initially hidden) panel element; its contents are replaced
 * opts   options   [{ key, label, defaultDir }], dir 1 or -1
 *        ariaLabel the panel's name ("Sort posts")
 *        state()   -> { key, dir, lockedBecause } where lockedBecause, when
 *                  set, disables every option and says why in its tooltip
 *                  (the blog while a series is listed in part order)
 *        onChange(key, dir)  the caller stores the choice and re-renders
 * Returns { sync() } for the caller to run after changing state itself.
 *
 * The buttons are built once and updated in place. Rebuilding them on
 * every press, as the listings used to, destroyed the button in the
 * reader's hand: focus fell to <body> and the next Tab started from the
 * top of the page.
 */
function krSortPanel(panel, opts) {
    var buttons = {};
    panel.setAttribute('aria-label', opts.ariaLabel || 'Sort');
    panel.innerHTML = '';

    opts.options.forEach(function(opt) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn gallery-filter-btn';
        btn.addEventListener('click', function() {
            var now = opts.state();
            var dir = now.key === opt.key ? -now.dir : opt.defaultDir;
            opts.onChange(opt.key, dir);
            sync();
        });
        buttons[opt.key] = btn;
        panel.appendChild(btn);
    });

    function sync() {
        var now = opts.state();
        opts.options.forEach(function(opt) {
            var btn = buttons[opt.key];
            var on = opt.key === now.key;
            btn.textContent = opt.label + (on ? ' ' + (now.dir < 0 ? '↓' : '↑') : '');
            // The arrow is read out as "downwards arrow"; say the order.
            if (on) btn.setAttribute('aria-label', opt.label + (now.dir < 0 ? ', descending' : ', ascending'));
            else btn.removeAttribute('aria-label');
            krSetPressed(btn, on);
            btn.disabled = !!now.lockedBecause;
            btn.title = now.lockedBecause || '';
        });
    }

    sync();
    return { sync: sync };
}

/**
 * A listing's sort options are [{ key, label, defaultDir }] with its
 * default first: the order it opens in, in its default direction, and the
 * one a URL without ?sort= means. krSortOption, krSortFromUrl and
 * krSortToUrl all lean on that.
 */

/** The option with `key`, or the default (options[0]) when there is none. */
function krSortOption(options, key) {
    for (var i = 0; i < options.length; i++) {
        if (options[i].key === key) return options[i];
    }
    return options[0];
}

/**
 * The sort a URL asks for, as { key, dir }: ?sort= when it names an
 * option (else the default), ?dir=asc|desc (else that option's own
 * direction), so a link cannot select an order the listing does not offer.
 */
function krSortFromUrl(params, options) {
    var opt = krSortOption(options, params.get('sort'));
    var dir = params.get('dir');
    return { key: opt.key, dir: dir === 'asc' ? 1 : (dir === 'desc' ? -1 : opt.defaultDir) };
}

/** Writes ?sort= and ?dir= unless the order is the default one, so a plain listing keeps a bare URL. */
function krSortToUrl(params, options, key, dir) {
    if (key === options[0].key && dir === options[0].defaultDir) return;
    params.set('sort', key);
    params.set('dir', dir < 0 ? 'desc' : 'asc');
}

/**
 * The toolbar's two labels: "Filter (n) ▾" on #kr-filter-toggle and
 * "Sort: Label ↓" on #kr-sort-toggle. With `lockedBecause` (the blog while
 * a series is listed in part order) the sort reads just "Sort: Label",
 * with no arrow, and the reason is its tooltip: a direction that is not
 * being applied should not be shown.
 */
function krToolbarLabels(filterCount, sortLabel, dir, lockedBecause) {
    var f = document.getElementById('kr-filter-toggle');
    var s = document.getElementById('kr-sort-toggle');
    if (f) f.textContent = 'Filter' + (filterCount ? ' (' + filterCount + ')' : '') + ' ▾';
    if (!s) return;
    s.textContent = 'Sort: ' + sortLabel + (lockedBecause ? '' : ' ' + (dir < 0 ? '↓' : '↑'));
    s.title = lockedBecause || '';
}

/**
 * The Topic row both listings open their filter panel with: a button per
 * tag the records carry, busiest first, an "All (n)" reset, and the rest
 * behind "+N more" after three (a long tag list filled the page before the
 * reader reached anything else). Equal counts go alphabetically, so which
 * three show at rest never depends on the order of posts.json.
 *
 * holder   a krFacetRow holder
 * records  what the listing lists (posts, series); getTags(record) -> tags
 * opts     active (the tags selected now), onChange(keys)
 * Returns renderFilterBar's { setActive(keys) }.
 */
function krTagFacetRow(holder, records, getTags, opts) {
    var counts = {};
    records.forEach(function(r) {
        (getTags(r) || []).forEach(function(t) { counts[t] = (counts[t] || 0) + 1; });
    });
    var items = Object.keys(counts).sort(function(a, b) {
        return counts[b] - counts[a] || a.localeCompare(b);
    }).map(function(tag) {
        return { key: tag, label: tag, count: counts[tag] };
    });
    var bar = renderFilterBar(holder, items, {
        multi: true,
        allLabel: 'All (' + records.length + ')',
        collapseAfter: 3,
        onChange: opts.onChange
    });
    if (opts.active && opts.active.length) bar.setActive(opts.active);
    return bar;
}

/** A comma-separated query parameter as an array, blanks dropped: ?tag=a,b -> ['a', 'b']. */
function krUrlList(params, key) {
    return (params.get(key) || '').split(',').map(function(v) {
        return v.trim();
    }).filter(Boolean);
}

/**
 * Builds a row of filter buttons with a leading "all" reset.
 * items: [{key, label, count}]; opts: { multi, allLabel, collapseAfter,
 * onChange(activeKeys) }. Buttons carry aria-pressed. Returns { setActive(keys) }.
 *
 * `opts.collapseAfter` caps how many are shown at rest, with the rest behind
 * a "+N more" toggle: a long tag list otherwise fills the page before the
 * reader reaches anything they came for. The overflow buttons stay in the
 * DOM so selection state survives collapsing, and a selected one is pinned
 * visible whether the row is open or not, so a filter that is narrowing the
 * list can never be invisible.
 */
function renderFilterBar(container, items, opts) {
    var o = opts || {};
    var active = [];
    var allLabel = o.allLabel || 'All';
    var collapseAfter = o.collapseAfter > 0 ? o.collapseAfter : 0;
    var expanded = false;

    function emit() { if (o.onChange) o.onChange(active.slice()); }

    function refresh() {
        var btns = container.querySelectorAll('button[data-filter-key]');
        for (var i = 0; i < btns.length; i++) {
            var key = btns[i].getAttribute('data-filter-key');
            krSetPressed(btns[i], key === '*' ? active.length === 0 : active.indexOf(key) !== -1);
        }
        syncCollapse();
    }

    function syncCollapse() {
        var more = container.querySelector('button[data-filter-more]');
        if (!more) return;
        var overflow = container.querySelectorAll('button[data-filter-overflow]');
        var stillHidden = 0;
        for (var i = 0; i < overflow.length; i++) {
            // A selected filter stays put even while the row is collapsed:
            // hiding it would leave the list narrowed with nothing on screen
            // saying why.
            var pinned = active.indexOf(overflow[i].getAttribute('data-filter-key')) !== -1;
            overflow[i].hidden = !expanded && !pinned;
            if (overflow[i].hidden) stillHidden++;
        }
        // Nothing left to reveal (every overflow filter is pinned), so the
        // toggle has nothing to say.
        more.hidden = !expanded && stillHidden === 0;
        more.textContent = expanded ? 'Show fewer' : '+' + stillHidden + ' more';
        more.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        more.setAttribute('aria-label', expanded
            ? 'Show fewer filters'
            : 'Show ' + stillHidden + ' more filters');
    }

    function onClick(e) {
        if (e.target.closest('button[data-filter-more]')) {
            expanded = !expanded;
            syncCollapse();
            return;
        }
        var btn = e.target.closest('button[data-filter-key]');
        if (!btn) return;
        var key = btn.getAttribute('data-filter-key');
        if (key === '*') {
            active = [];
        } else if (o.multi) {
            var at = active.indexOf(key);
            if (at === -1) active.push(key); else active.splice(at, 1);
        } else {
            active = active.length === 1 && active[0] === key ? [] : [key];
        }
        refresh();
        emit();
    }

    var html = '<button type="button" class="btn gallery-filter-btn active" data-filter-key="*" aria-pressed="true">' +
        krEscapeHtml(allLabel) + '</button>';
    for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var overflowed = collapseAfter && i >= collapseAfter;
        html += '<button type="button" class="btn gallery-filter-btn" data-filter-key="' + krEscapeHtml(it.key) + '"' +
            (overflowed ? ' data-filter-overflow hidden' : '') +
            ' aria-pressed="false">' +
            (it.label || krEscapeHtml(it.key)) +
            (it.count != null ? ' <span class="filter-count">(' + it.count + ')</span>' : '') +
            '</button>';
    }
    if (collapseAfter && items.length > collapseAfter) {
        html += '<button type="button" class="btn gallery-filter-btn kr-filter-more" data-filter-more aria-expanded="false">' +
            '+' + (items.length - collapseAfter) + ' more</button>';
    }
    container.innerHTML = html;
    container.setAttribute('role', 'group');
    if (!container.getAttribute('aria-label')) container.setAttribute('aria-label', 'Filters');
    container.addEventListener('click', onClick);
    syncCollapse();

    return {
        setActive: function (keys) {
            active = (keys || []).slice();
            refresh();
            emit();
        }
    };
}

/**
 * Hands the shared view-transition name to whichever post card was
 * clicked, so the card's photograph morphs into the post's banner across
 * the navigation instead of the two pages simply cross-fading.
 *
 * Only one element per document may carry a given name, so the listing's
 * own banner gives it up on the way out. Runs in the capture phase so the
 * name is in place before any other handler can start a navigation (the
 * outgoing snapshot is taken as soon as one starts). A click that opens
 * the post in another tab or window leaves this page where it is, so it
 * hands nothing over: a stale name would give the next click two
 * elements called kr-hero, and the browser skips a transition like that.
 */
function initHeroTransitions() {
    if (!window.CSS || !CSS.supports || !CSS.supports('view-transition-name', 'kr-hero')) return;
    if (window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    document.addEventListener('click', function (e) {
        if (!e.target || !e.target.closest) return;
        if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
        var card = e.target.closest('.single-post-area[data-href], a.blog-card');
        if (!card) return;
        var img = card.querySelector('img');
        if (!img) return;
        var banner = document.querySelector('.breadcrumb-area, .kr-opener__media');
        if (banner) banner.style.viewTransitionName = 'none';
        img.style.viewTransitionName = 'kr-hero';
    }, true);

    // A back navigation restores this page from the cache with the name
    // still handed over; put it back so the next click works.
    window.addEventListener('pageshow', function () {
        document.querySelectorAll('[style*="view-transition-name"]').forEach(function (el) {
            if (!el.classList.contains('breadcrumb-area') && !el.classList.contains('kr-opener__media')) el.style.viewTransitionName = '';
        });
        var banner = document.querySelector('.breadcrumb-area, .kr-opener__media');
        if (banner) banner.style.viewTransitionName = '';
    });
}

/**
 * Scroll-linked section headings for browsers without animation-timeline.
 * Native support is preferred (see the @supports block in style.css);
 * here the same keyframes are scrubbed by writing --kr-p on each element
 * from its position in the viewport. rAF-throttled, and skipped entirely
 * under reduced motion.
 */
function initScrollFlourishes() {
    if (window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()')) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var els = document.querySelectorAll('.section-eyebrow, .section-eyebrow + h2, .section-heading h2');
    if (!els.length) return;
    document.documentElement.classList.add('kr-scroll-fallback');
    var ticking = false;
    function update() {
        ticking = false;
        var vh = window.innerHeight;
        var start = vh, end = vh * 0.62;
        for (var i = 0; i < els.length; i++) {
            var top = els[i].getBoundingClientRect().top;
            var p = (start - top) / (start - end);
            els[i].style.setProperty('--kr-p', (p < 0 ? 0 : p > 1 ? 1 : p).toFixed(3));
        }
    }
    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(update);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
}

/* Prism's own names for the language-* classes posts use, where they
   differ; and the languages its core already has, which have no file of
   their own to load (asking for one is a 404 from the CDN). */
var KR_PRISM_ALIASES = { sh: 'bash', shell: 'bash', py: 'python', yml: 'yaml', ps1: 'powershell', ts: 'typescript', tex: 'latex' };
var KR_PRISM_CORE = ['markup', 'html', 'xml', 'svg', 'mathml', 'css', 'clike', 'javascript', 'js',
    'plain', 'plaintext', 'text', 'txt', 'none'];

/**
 * Syntax highlighting for a post that has code: any
 * `.blog-post pre code[class*="language-"]` loads Prism once, with the
 * language files its classes name (js/prism-loader.js, fetched here when
 * the page did not include it). A post no longer has to remember to call
 * loadPrism itself, and one that called it with too short a list (Python
 * blocks under a bare loadPrism()) is highlighted anyway, because this
 * runs first: the script sits above every post's inline scripts, and
 * prism-loader ignores calls made while it is already loading.
 */
function initCodeHighlighting() {
    var blocks = document.querySelectorAll('.blog-post pre code[class*="language-"]');
    if (!blocks.length) return;
    var langs = [];
    Array.prototype.forEach.call(blocks, function(code) {
        var m = /(?:^|\s)language-([\w-]+)/.exec(code.className);
        if (!m) return;
        var lang = KR_PRISM_ALIASES[m[1]] || m[1];
        if (KR_PRISM_CORE.indexOf(lang) === -1 && langs.indexOf(lang) === -1) langs.push(lang);
    });
    function highlight() {
        if (typeof window.loadPrism === 'function') window.loadPrism(langs);
    }
    if (typeof window.loadPrism === 'function') {
        highlight();
        return;
    }
    var script = document.createElement('script');
    script.src = siteRootPrefix() + 'js/prism-loader.js';
    script.onload = highlight;
    document.head.appendChild(script);
}

/* Players that are always 16:9, whatever height their facade names. */
var KR_VIDEO_EMBED = /^https:\/\/(www\.)?(youtube(-nocookie)?\.com\/embed\/|player\.vimeo\.com\/)/;

/** The fixed height a facade asks for, or 0 for the 16:9 default. */
function embedHeightOverride(btn) {
    if (KR_VIDEO_EMBED.test(btn.getAttribute('data-embed-src') || '')) return 0;
    var h = parseInt(btn.getAttribute('data-embed-height'), 10);
    return h > 0 ? h : 0;
}

/**
 * Click-to-load embed facades. Markup:
 *   <button class="kr-embed-facade" data-embed-src="..."
 *           data-embed-title="...">…</button>
 * On click the button is replaced with the real iframe.
 *
 * Both the facade and the iframe are 16:9 at full width (.kr-embed-facade
 * and .kr-embed-frame in style.css), so the swap does not move the page:
 * the old fixed 315px frame was taller than the facade on a phone and
 * shorter on a desktop, and the text below jumped either way.
 *
 * data-embed-height="N" is an optional override for an embed that is not
 * a 16:9 video (a playlist, a podcast player): the facade and the frame
 * then both take N px. A video player ignores it. Every facade written so
 * far carries 315 or 300, copied from YouTube's own 560x315 embed code,
 * which was a way of saying 16:9 at one width, not a height anyone chose.
 */
function initEmbedFacades() {
    // The override has to reach the facade before it is clicked too, or
    // the swap would still jump.
    document.querySelectorAll('.kr-embed-facade[data-embed-height]').forEach(function(btn) {
        var h = embedHeightOverride(btn);
        if (h) {
            btn.style.aspectRatio = 'auto';
            btn.style.height = h + 'px';
        }
    });
    // Only a facade with something to load. The class is also worn by a
    // plain link styled as a facade (music.html's TikTok card); taking
    // that one too swapped it for an iframe of "null" before the link
    // could open.
    document.addEventListener('click', function (e) {
        var btn = e.target.closest('.kr-embed-facade[data-embed-src]');
        if (!btn) return;
        var iframe = document.createElement('iframe');
        iframe.src = btn.getAttribute('data-embed-src');
        iframe.title = btn.getAttribute('data-embed-title') || 'Embedded content';
        iframe.className = 'kr-embed-frame';
        var h = embedHeightOverride(btn);
        if (h) {
            iframe.style.aspectRatio = 'auto';
            iframe.style.height = h + 'px';
        }
        iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
        iframe.setAttribute('allowfullscreen', '');
        btn.parentNode.replaceChild(iframe, btn);
        iframe.focus();
    });
}

// Offline reading: cache visited pages + core assets (see sw.js)
if ('serviceWorker' in navigator &&
    (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', function() {
        try { navigator.serviceWorker.register('/sw.js'); } catch (e) {}
    });
}

/* The reference list a sidenote can be copied from: ol.references >
   li#ref-N, the one shape the audit accepts for a cite-ref target
   (normalize_post_markup.py moved the older forms onto it). */
var KR_REFERENCE_LISTS = 'ol.references';

/**
 * The parts of one reference a sidenote shows:
 * { who: 'Dorigo et al., 1996' | '', title, href, label }.
 *
 * References on this site are written author-date, "Surname, A., &
 * Other, B. (2019). Title. <em>Venue</em>, 4(2), 1-9. <a>doi link</a>".
 * `who` is the first author and the year: one surname, both of two, or
 * the first and "et al."; an organisation stays as written. `title` is
 * the <em> or link that opens the rest when that is the work's own title
 * (a book), else the text up to the venue. `label` is "doi" for a DOI
 * and the bare host name for any other link. A reference that does not
 * start "Authors (year)." comes back with no `who` and its whole text as
 * the title, which the sidenote clamps.
 */
function compactReference(li) {
    function squash(s) { return (s || '').replace(/\s+/g, ' ').trim(); }
    var text = squash(li.textContent);
    var out = { who: '', title: text, href: '', label: '' };

    var link = li.querySelector('a[href]');
    if (link) {
        out.href = link.getAttribute('href');
        if (/doi\.org\//i.test(out.href) || /^doi:/i.test(squash(link.textContent))) {
            out.label = 'doi';
        } else {
            try { out.label = new URL(out.href, document.baseURI).hostname.replace(/^www\./, ''); } catch (e) { out.label = 'link'; }
        }
    }

    // "(2019)", "(2015, March)", "(n.d.)"
    var head = /^(.{2,180}?)\s*\((\d{4}[a-z]?|n\.d\.)(?:,[^)]{1,20})?\)\.?\s*/.exec(text);
    if (!head) return out;
    // Only a trailing comma goes: the full stop after the last initial
    // ("Kahneman, D.") is part of the name pattern below.
    var authors = head[1].replace(/[\s,]+$/, '');
    // A sentence that happens to end in a year is not a list of names.
    if ((authors.match(/(^|\s)[a-z]{3,}/g) || []).length > 2) return out;

    var surnames = [];
    var nameRe = /(?:^|,\s*|&\s*)([^,&]+?),\s*(?:\p{Lu}\.[\s-]*)+(?=,|\s*&|$)/gu;
    var m;
    while ((m = nameRe.exec(authors)) !== null) surnames.push(m[1].trim());
    // With no "Surname, I." pattern it can still be an organisation
    // ("Department for Transport"), but not a long phrase or a title.
    if (!surnames.length && (/[:?!]/.test(authors) || authors.split(/\s+/).length > 6)) return out;
    var etAl = /\bet al\b/.test(authors);
    var who = !surnames.length ? authors.replace(/\.$/, '') :
        (surnames.length === 1 && !etAl) ? surnames[0] :
        (surnames.length === 2 && !etAl) ? surnames[0] + ' & ' + surnames[1] :
        surnames[0] + ' et al.';
    out.who = who + ', ' + head[2];

    var rest = text.slice(head[0].length);
    var title = '';
    var marks = li.querySelectorAll('em, i, cite, a[href]');
    for (var i = 0; i < marks.length; i++) {
        var mark = squash(marks[i].textContent);
        var at = mark ? rest.indexOf(mark) : -1;
        if (at < 0) continue;
        title = at <= 1 ? mark : rest.slice(0, at).replace(/[\s.,:;]*(\bIn)?\s*$/, '');
        break;
    }
    title = title || rest;
    // The title is the first sentence: "Title. Venue. A note..." keeps
    // "Title", and a chapter keeps its own name, not "In K. Editor (Ed.)".
    // A stop after a capital is an initial or an abbreviation ("U.S."),
    // not the end of the title; a question mark stays inside it ("Boys
    // Don't Try? Rethinking...").
    var end = /[a-z0-9)\]'"”]\.(?=\s+[A-Z(“"])/.exec(title);
    if (end) title = title.slice(0, end.index + 1);
    out.title = title.replace(/\.$/, '') || rest;
    return out;
}

/**
 * Sidenotes: from 1360px the first citation of each reference gets a
 * compact copy of it in the right gutter, level with the sentence. The
 * reference list at the foot stays the canonical, linkable version; the
 * notes are aria-hidden so nothing is read twice, and their one link is
 * out of the Tab order. Below 1360px the CSS hides them and the layout
 * does nothing, so a phone sees the post exactly as before.
 *
 * A note shows the reference number, the first author and year, the
 * title (clamped to two lines by CSS) and a short "doi" link
 * (compactReference). The full reference had run to a dozen lines in a
 * 200px column, which pushed every later note far below its sentence.
 *
 * Placement rules, applied in citation order:
 *   - horizontally the note is 32px past the article's right edge and
 *     240px wide (style.css), so it follows the column wherever it is;
 *   - vertically it aims level with its citation and is pushed down to
 *     clear the note above (a 14px gap);
 *   - if that push would put it more than SIDENOTE_MAX_DRIFT (200px)
 *     below its citation, or into the end band, it is not shown: a note
 *     a screen away from its sentence reads as belonging to another one.
 *     The space it would have taken goes to the notes after it.
 * Each first citation is marked data-kr-note="beside" or "far".
 * initCitePreviews shows its hover card for every citation except a
 * "beside" one on a wide screen, where the note is already lit instead;
 * a "far" citation and a repeat citation keep the card.
 *
 * Runs again whenever the article's size changes (images loading, fonts
 * arriving, the window resizing).
 */
var SIDENOTE_MAX_DRIFT = 200;
var SIDENOTE_GAP = 14;

function initPostSidenotes() {
    var post = document.querySelector('.blog-post');
    if (!post || post.querySelector('.kr-sidenote')) return;
    var wide = krWidePost();

    var seen = {}, notes = [];
    Array.prototype.forEach.call(post.querySelectorAll('a.cite-ref[href^="#"]'), function(a) {
        var id = a.getAttribute('href').slice(1);
        var li = document.getElementById(id);
        if (!li || seen[id] || !li.closest(KR_REFERENCE_LISTS)) return;
        seen[id] = true;

        var ref = compactReference(li);
        var aside = document.createElement('aside');
        aside.className = 'kr-sidenote' + (ref.who ? '' : ' kr-sidenote--whole');
        aside.setAttribute('aria-hidden', 'true');
        aside.innerHTML =
            '<span class="kr-sidenote__head">' +
                '<span class="kr-sidenote__n">' + krEscapeHtml(a.textContent.replace(/[\[\]\s]/g, '')) + '</span>' +
                (ref.who ? '<span class="kr-sidenote__who">' + krEscapeHtml(ref.who) + '</span>' : '') +
            '</span>' +
            '<span class="kr-sidenote__title">' + krEscapeHtml(ref.title) + '</span>' +
            (ref.href ? '<a class="kr-sidenote__link" href="' + krEscapeHtml(ref.href) + '" tabindex="-1"' +
                ' target="_blank" rel="noopener noreferrer">' + krEscapeHtml(ref.label) + '</a>' : '');
        post.appendChild(aside);
        notes.push({ a: a, el: aside });

        function hot(on) { return function() { aside.classList.toggle('is-hot', on); }; }
        a.addEventListener('mouseenter', hot(true));
        a.addEventListener('mouseleave', hot(false));
        a.addEventListener('focus', hot(true));
        a.addEventListener('blur', hot(false));
    });
    if (!notes.length) return;
    post.classList.add('kr-has-sidenotes');

    function layout() {
        if (!wide.matches) {
            notes.forEach(function(n) { n.a.removeAttribute('data-kr-note'); });
            return;
        }
        // Read everything, then write: a far note is visibility:hidden,
        // not display:none, so its height can be read like the rest.
        var postTop = post.getBoundingClientRect().top;
        var band = post.querySelector('.kr-post-end');
        var limit = band ? band.getBoundingClientRect().top - postTop : Infinity;
        var floor = 0;
        var placed = notes.map(function(n) {
            var want = n.a.getBoundingClientRect().top - postTop - 6;
            var top = Math.max(want, floor);
            var height = n.el.offsetHeight;
            var far = top - want > SIDENOTE_MAX_DRIFT || top + height > limit;
            if (!far) floor = top + height + SIDENOTE_GAP;
            return { top: Math.round(top), far: far };
        });
        notes.forEach(function(n, i) {
            n.el.classList.toggle('is-far', placed[i].far);
            n.el.style.top = placed[i].top + 'px';
            n.a.setAttribute('data-kr-note', placed[i].far ? 'far' : 'beside');
        });
    }
    // The notes sit in the post's own coordinates, so a scroll never moves
    // them and this is not a krOnScroll job; only a change of layout does.
    // Every trigger lands in one layout on the next frame: a window resize
    // also resizes the post, and the two used to lay the notes out twice.
    var queued = false;
    function schedule() {
        if (queued) return;
        queued = true;
        window.requestAnimationFrame(function() { queued = false; layout(); });
    }
    layout();
    window.addEventListener('resize', schedule, { passive: true });
    if (wide.addEventListener) wide.addEventListener('change', schedule);
    if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(post);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
}

document.addEventListener('DOMContentLoaded', function() {
    initCardLight();
    initPostSidenotes();
    initLightboxZoom();
    annotateNewTabLinks();
    updateLastfmStats();
    renderNowStrip();
    initCountUpStats();
    initLazyImageFade();
    initEmbedFacades();
    initHeroTransitions();
    initScrollFlourishes();
    initLiveCovers();
    initTopicPosts();
    // Cards already in the markup (a post's baked related block); a page
    // whose cards are drawn later arms this from createBlogCardElement.
    if (document.querySelector('.blog-card, .single-post-area[data-href]')) krArmPostPrerender();
    krLabelModKeys();
    if ('MutationObserver' in window) {
        new MutationObserver(annotateNewTabLinks).observe(document.body, { childList: true, subtree: true });
    }
});

renderBlogPostEssentials();
renderStoryPostEssentials();
renderFloatingBlogShare();
// The lead-in reads the opening paragraph's first run of text, so it goes
// before the jargon tooltips split that text around an <abbr>.
initDropCap();
autoCollapseTopJargonBox();
applyJargonTooltips();
initCopyQuotes();
initLightboxFix();
initFullResMode();
initCodeHighlighting();
