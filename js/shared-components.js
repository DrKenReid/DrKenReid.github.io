/**
 * shared-components.js
 * 
 * Injects the Instagram feed section and site footer into every page.
 * To update social links, Instagram handle, or footer text, edit this
 * single file instead of all 6 HTML pages.
 */

// Gate the scroll-reveal hidden state on JS being available, so content
// is never invisible for no-JS readers (see initSectionReveals).
document.documentElement.classList.add('kr-js');

var BLUESKY_SVG = '<svg class="bluesky-icon" viewBox="0 0 568 501" xmlns="http://www.w3.org/2000/svg"><path d="M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873c25.719-53.192 95.759-152.32 160.879-201.21C491.866-1.611 568-28.906 568 57.947c0 17.346-9.945 145.713-15.778 166.555-20.275 72.453-94.155 90.933-159.875 79.748C507.222 323.8 536.444 388.56 473.333 453.32c-119.86 122.992-172.272-30.859-185.702-70.281-2.462-7.227-3.614-10.608-3.631-7.733-.017-2.875-1.169.506-3.631 7.733-13.43 39.422-65.842 193.273-185.702 70.281-63.111-64.76-33.889-129.52 80.986-149.071-65.72 11.185-139.6-7.295-159.875-79.748C9.945 203.659 0 75.291 0 57.946 0-28.906 76.135-1.612 123.121 33.664z"/></svg>';

function renderHeader(targetId, options) {
    var el = document.getElementById(targetId);
    if (!el) return;

    var opts = options || {};
    var basePath = opts.basePath || './';
    var active = opts.active || '';
    var hobbiesActive = active === 'hobbies';
    var hobbiesChild = opts.hobbiesChild || '';

    function navItem(key, href, label) {
        var isCurrent = active === key;
        return '<li' + (isCurrent ? ' class="active"' : '') + '><a href="' + href + '"' + (isCurrent ? ' aria-current="page"' : '') + '>' + label + '</a></li>';
    }

    function isHobbyChildActive(key) {
        return hobbiesChild === key ? ' class="active"' : '';
    }

    el.innerHTML = '<a class="skip-link" href="#main-content">Skip to main content</a>' +
        '<button id="theme-toggle" class="theme-toggle" aria-label="Switch to dark mode" aria-pressed="false" title="Switch to dark mode"></button>' +
        '<header class="header-area"><div class="main-header-area"><div class="classy-nav-container breakpoint-on"><div class="container">' +
        '<nav class="classy-navbar justify-content-between" id="alimeNav" aria-label="Primary">' +
        '<a class="nav-brand" href="' + basePath + 'index.html"><img src="' + basePath + 'img/core-img/logo.png" alt="Ken Reid Logo"></a>' +
        '<div class="classy-navbar-toggler"><span class="navbarToggler"><span></span><span></span><span></span></span></div>' +
        '<div class="classy-menu"><div class="classycloseIcon"><div class="cross-wrap"><span class="top"></span><span class="bottom"></span></div></div>' +
        '<div class="classynav"><ul id="nav">' +
        navItem('home', basePath + 'index.html', 'Home') +
        navItem('about', basePath + 'about.html', 'About') +
        navItem('data_science', basePath + 'data_science.html', 'Data Science') +
        '<li' + (hobbiesActive ? ' class="active"' : '') + '><a href="#">Hobbies</a>' +
        '<ul class="dropdown">' +
        '<li' + isHobbyChildActive('gallery') + '><a href="' + basePath + 'gallery.html"' + (hobbiesChild === 'gallery' ? ' aria-current="page"' : '') + '>Photography</a></li>' +
        '<li' + isHobbyChildActive('map') + '><a href="' + basePath + 'map.html"' + (hobbiesChild === 'map' ? ' aria-current="page"' : '') + '>Photo Map</a></li>' +
        '<li' + isHobbyChildActive('music') + '><a href="' + basePath + 'music.html"' + (hobbiesChild === 'music' ? ' aria-current="page"' : '') + '>Music</a></li>' +
        '<li' + isHobbyChildActive('literature') + '><a href="' + basePath + 'literature.html"' + (hobbiesChild === 'literature' ? ' aria-current="page"' : '') + '>Literature</a></li>' +
        '</ul></li>' +
        navItem('blog', basePath + 'blog.html', 'Blog') +
        navItem('contact', basePath + 'contact.html', 'Contact') +
        '</ul></div></div></nav>' +
        '</div></div></div></header>';

    if (typeof jQuery !== 'undefined' && jQuery.fn.classyNav) {
        try {
            jQuery('#alimeNav').classyNav();
        } catch (e) {
            console.warn('Header nav init failed:', e);
        }
    }
}

/**
 * Renders the "Follow Instagram" section with 10 random photography tiles.
 * @param {string} targetId - ID of the element to inject into.
 */
function renderInstagramSection(targetId) {
    var el = document.getElementById(targetId);
    if (!el) return;

    var onBlogPostPage = !!document.querySelector('.blog-post');
    var assetPrefix = onBlogPostPage ? '../' : '';

    var instagramUrl = 'https://www.instagram.com/drkenreid/';
    var handle = 'drkenreid';

    el.innerHTML = '<section class="follow-area clearfix">' +
        '<div class="container"><div class="row"><div class="col-12">' +
        '<div class="section-heading text-center">' +
        '<span class="section-eyebrow">Photography</span>' +
        '<h2>Photo Highlights</h2>' +
        '<p><a href="' + instagramUrl + '">Follow @' + handle + ' on Instagram</a></p>' +
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

    function getStem(filename) {
        return filename.lastIndexOf('.') > -1 ? filename.slice(0, filename.lastIndexOf('.')) : filename;
    }

    fetch(assetPrefix + 'data/photography-standard-files.json').then(function(response) {
        return response.json();
    }).then(function(files) {
        var sample = shuffleCopy(Array.isArray(files) ? files : []).slice(0, 10);
        var feed = el.querySelector('.instragram-feed-area');
        if (!feed) return;

        var html = '';
        sample.forEach(function(filename, index) {
            var stem = getStem(filename);
            html += '<div class="single-instagram-item">' +
                '<img src="' + assetPrefix + 'img/photography/thumb/' + filename.replace(/\.(png|jpg|JPG|jpeg)$/, '.webp') + '" alt="Photography highlight ' + (index + 1) + '" loading="lazy">' +
                '<div class="instagram-hover-content text-center d-flex align-items-center justify-content-center">' +
                '<a href="' + instagramUrl + '">' +
                '<i class="ti-instagram" aria-hidden="true"></i>' +
                '<span>' + handle + '</span></a></div></div>';
        });

        feed.innerHTML = html;

        if (typeof jQuery !== 'undefined' && jQuery.fn.owlCarousel) {
            var instagramSlider = jQuery('.instragram-feed-area');
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
        var feed = el.querySelector('.instragram-feed-area');
        if (feed) {
            feed.innerHTML = '<div class="single-instagram-item"><a href="' + instagramUrl + '" class="d-flex align-items-center justify-content-center" style="min-height: 220px; color: #fc6060; font-weight: 600;">Instagram feed unavailable</a></div>';
        }
    });
}

function renderBlogPhotoHighlights() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost) return;

    if (!document.getElementById('instagram-section')) {
        var footerSection = document.getElementById('footer-section');
        if (!footerSection || !footerSection.parentNode) return;

        var container = document.createElement('div');
        container.id = 'instagram-section';
        footerSection.parentNode.insertBefore(container, footerSection);
    }

    renderInstagramSection('instagram-section');
}

function renderFloatingBlogShare() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost) return;
    if (document.querySelector('.kr-share-rail')) return;

    var canonical = document.querySelector('link[rel="canonical"]');
    var pageUrl = canonical && canonical.getAttribute('href')
        ? canonical.getAttribute('href')
        : (window.location.origin + window.location.pathname);
    var rawTitle = (function() {
        var ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle && ogTitle.getAttribute('content')) {
            return ogTitle.getAttribute('content').trim();
        }
        return document.title.replace(' - Ken Reid', '').trim();
    })();

    var shareText = rawTitle + ' by Ken Reid';
    var encUrl = encodeURIComponent(pageUrl);
    var encText = encodeURIComponent(shareText);
    var encTextUrl = encodeURIComponent(shareText + ' ' + pageUrl);

    var iconMap = {
        bluesky: BLUESKY_SVG,
        facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-7.5h2.55l.38-2.97H13.5V8.66c0-.86.24-1.45 1.48-1.45h1.58V4.55c-.27-.04-1.21-.12-2.31-.12-2.29 0-3.86 1.4-3.86 3.96v2.21H7.84v2.97h2.55V21h3.11z"/></svg>',
        linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.95v5.66H9.37V9h3.41v1.56h.05c.47-.9 1.64-1.85 3.37-1.85 3.6 0 4.26 2.37 4.26 5.45v6.29zM5.34 7.44a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z"/></svg>',
        x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.244 2H21l-6.52 7.45L22 22h-6.77l-4.74-6.2L4.86 22H2l7.02-8.01L2 2h6.91l4.27 5.66L18.244 2zm-1.18 18h1.85L7.04 4H5.07l11.99 16z"/></svg>',
        threads: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.18 22h-.05C8.43 21.98 5.58 20.77 3.66 18.4 1.95 16.29 1.07 13.34 1.05 9.62v-.04c.02-3.72.9-6.67 2.61-8.78C5.58.23 8.43-.98 12.13-1h.05c2.83.02 5.21.76 7.06 2.2 1.75 1.36 2.98 3.3 3.66 5.78l-2.27.6c-1.16-4.31-4.21-6.5-9.07-6.55C8.42 1.06 6.5 2 5.21 3.58 4 5.07 3.36 7.23 3.34 10c.02 2.78.66 4.94 1.87 6.43 1.29 1.58 3.21 2.52 6.35 2.55 2.83-.02 4.7-.69 6.26-2.24.92-.91 1.49-2.02 1.71-3.31-.18-.99-.73-1.79-1.66-2.41-.74-.49-1.7-.88-2.85-1.15-.08 1.32-.42 2.39-1.02 3.18-.69.9-1.7 1.34-3 1.34h-.05c-1.07-.01-2.05-.32-2.77-.86-.83-.63-1.27-1.51-1.27-2.55 0-2.05 1.65-3.47 4.11-3.55.94-.03 1.84.07 2.66.3-.18-1.16-.55-2.07-1.11-2.71-.79-.91-2.02-1.39-3.66-1.39-1.55 0-2.83.62-3.81 1.84l-1.66-1.32c1.41-1.78 3.25-2.69 5.47-2.69 2.32 0 4.18.81 5.37 2.34.79 1.02 1.25 2.37 1.36 4.04 1.95.55 3.36 1.32 4.27 2.35.91 1.04 1.36 2.34 1.36 3.91 0 .14 0 .29-.02.43-.32 1.99-1.21 3.7-2.66 5.07-1.93 1.84-4.39 2.73-7.51 2.75zm.49-9.27c-.27 0-.55.01-.83.03-1.92.06-2.6.79-2.6 1.49 0 .55.45 1.43 2.04 1.45h.03c.96 0 1.55-.27 1.92-.86.34-.55.51-1.31.49-2.04-.34-.04-.69-.07-1.05-.07z"/></svg>',
        copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z"/></svg>',
        copyDone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>'
    };

    var networks = [
        { id: 'bluesky', label: 'Share on Bluesky', href: 'https://bsky.app/intent/compose?text=' + encTextUrl },
        { id: 'facebook', label: 'Share on Facebook', href: 'https://www.facebook.com/sharer/sharer.php?u=' + encUrl },
        { id: 'linkedin', label: 'Share on LinkedIn', href: 'https://www.linkedin.com/sharing/share-offsite/?url=' + encUrl },
        { id: 'x', label: 'Share on X', href: 'https://twitter.com/intent/tweet?text=' + encText + '&url=' + encUrl },
        { id: 'threads', label: 'Share on Threads', href: 'https://www.threads.net/intent/post?text=' + encTextUrl },
        { id: 'copy', label: 'Copy link', href: '#' }
    ];

    function createShareButton(network) {
        var el = document.createElement('a');
        el.className = 'kr-share-btn';
        el.setAttribute('data-net', network.id);
        el.setAttribute('aria-label', network.label);
        el.setAttribute('title', network.label);
        el.innerHTML = iconMap[network.id];

        if (network.id === 'copy') {
            el.href = '#';
            el.addEventListener('click', function(evt) {
                evt.preventDefault();

                function showCopiedState() {
                    el.classList.add('is-copied');
                    el.innerHTML = iconMap.copyDone;
                    setTimeout(function() {
                        el.classList.remove('is-copied');
                        el.innerHTML = iconMap.copy;
                    }, 1800);
                }

                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(pageUrl).then(showCopiedState).catch(function() {});
                    return;
                }

                try {
                    var ta = document.createElement('textarea');
                    ta.value = pageUrl;
                    ta.setAttribute('readonly', '');
                    ta.style.position = 'absolute';
                    ta.style.left = '-9999px';
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    showCopiedState();
                } catch (err) {}
            });
            return el;
        }

        el.href = network.href;
        el.target = '_blank';
        el.rel = 'noopener noreferrer';
        return el;
    }

    var rail = document.createElement('div');
    rail.className = 'kr-share-rail';
    rail.setAttribute('aria-label', 'Share this post');

    var railLabel = document.createElement('div');
    railLabel.className = 'kr-share-label';
    railLabel.textContent = 'Share';
    rail.appendChild(railLabel);

    networks.forEach(function(network) {
        rail.appendChild(createShareButton(network));
    });
    document.body.appendChild(rail);

    var modal = document.createElement('div');
    modal.className = 'kr-share-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-label', 'Share this post');

    var modalHeader = document.createElement('div');
    modalHeader.className = 'kr-share-modal-header';

    var modalTitle = document.createElement('div');
    modalTitle.className = 'kr-share-modal-title';
    modalTitle.textContent = 'Enjoyed this? Share it.';
    modalHeader.appendChild(modalTitle);

    var closeButton = document.createElement('button');
    closeButton.className = 'kr-share-modal-close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Dismiss share prompt');
    closeButton.innerHTML = '&times;';
    modalHeader.appendChild(closeButton);

    modal.appendChild(modalHeader);

    var modalRow = document.createElement('div');
    modalRow.className = 'kr-share-modal-row';
    networks.forEach(function(network) {
        modalRow.appendChild(createShareButton(network));
    });
    modal.appendChild(modalRow);
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

    closeButton.addEventListener('click', dismissModal);
    document.addEventListener('keydown', function(evt) {
        if (evt.key === 'Escape') {
            setModalVisible(false);
        }
    });

    function updateShareUi() {
        var rect = blogPost.getBoundingClientRect();
        var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        var viewportWidth = window.innerWidth || document.documentElement.clientWidth;
        var isMobile = window.matchMedia('(max-width: 991px)').matches;

        var postEntered = rect.top < viewportHeight * 0.7;
        var thanksCard = blogPost.querySelector('.blog-thanks-cta');
        var mainPostEndReached = false;

        if (thanksCard) {
            var thanksRect = thanksCard.getBoundingClientRect();
            // Trigger right as the reader reaches the boundary before the thanks card.
            mainPostEndReached = thanksRect.top <= viewportHeight * 0.98;
        } else {
            mainPostEndReached = rect.bottom < viewportHeight * 0.95;
        }

        var postPassed = mainPostEndReached && (window.scrollY || window.pageYOffset || 0) > 120;

        if (isMobile) {
            rail.classList.remove('is-visible');
            if (!dismissed && postPassed) {
                setModalVisible(true);
            } else if (!postPassed) {
                setModalVisible(false);
            }
            return;
        }

        setModalVisible(false);

        // Keep the rail visually aligned with the right edge of the readable post width.
        var gap = 24;
        var railWidth = rail.offsetWidth || 40;
        var left = rect.right + gap;
        if (left + railWidth > viewportWidth - 8) {
            left = Math.max(8, rect.left - gap - railWidth);
        }
        rail.style.left = left + 'px';

        if (postEntered && !postPassed) {
            rail.classList.add('is-visible');
        } else {
            rail.classList.remove('is-visible');
        }
    }

    window.addEventListener('scroll', updateShareUi, { passive: true });
    window.addEventListener('resize', updateShareUi);
    updateShareUi();
}

/**
 * Renders the site footer with copyright and social links.
 * @param {string} targetId - ID of the element to inject into.
 */
var DEFAULT_POST_IMAGE = 'img/photography/hero/97.webp';

/* Prefix site-relative asset paths (e.g. with '../' from a blog post page);
   absolute URLs pass through untouched. */
function resolveAssetPath(src, prefix) {
    return /^https?:\/\//.test(src) ? src : prefix + src;
}

// readMinutes is precomputed into data/posts.json by scripts/generate_read_times.py.
// Returns null when absent (e.g. a stale cached posts.json) — callers hide the
// read time rather than show a wrong guess.
function estimateReadingMinutes(post) {
    if (typeof post.readMinutes === 'number' && isFinite(post.readMinutes)) {
        return Math.max(1, Math.round(post.readMinutes));
    }
    return null;
}

function createBlogCardElement(post, options) {
    var opts = options || {};
    var href = opts.href || post.url;
    var imageSrc = opts.imageSrc || post.image || DEFAULT_POST_IMAGE;
    var fallback = opts.fallbackImage || DEFAULT_POST_IMAGE;
    var dateStr = opts.dateStr || formatPostDate(post.date);
    var showReadTime = opts.showReadTime !== false;

    if (opts.cardStyle === 'overlay') {
        // New template overlay card (single-post-area style)
        var col = document.createElement('div');
        col.className = (opts.colClass || 'col-12 col-sm-6 col-lg-4');

        var firstTag = (post.tags && post.tags.length) ? post.tags[0] : '';
        var readMins = estimateReadingMinutes(post);
        var readTimePart = (showReadTime && readMins) ? ('<a href="' + href + '" tabindex="-1">' + readMins + ' min read</a>') : '';
        var wowDelay = opts.wowDelay || '100ms';

        // One tab stop per card: the title anchor. The other anchors keep their
        // styling but leave the tab order; the card div stays mouse-clickable
        // via data-href (bound in blog.js).
        col.innerHTML =
            '<div class="single-post-area wow fadeInUpBig" data-wow-delay="' + wowDelay + '" data-href="' + href + '">' +
            '<a href="' + href + '" class="post-thumbnail" tabindex="-1" aria-hidden="true">' +
            '<img src="' + imageSrc + '" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'' + fallback + '\';">' +
            '</a>' +
            (firstTag ? '<a href="' + href + '" class="btn post-catagory" tabindex="-1">' + firstTag + '</a>' : '') +
            '<div class="post-content">' +
            '<div class="post-meta">' +
            '<a href="' + href + '" tabindex="-1">' + dateStr + '</a>' +
            readTimePart +
            '</div>' +
            '<a href="' + href + '" class="post-title">' + post.title + '</a>' +
            '</div>' +
            '</div>';

        return col;
    }

    // Default card style (image on top, body below)
    var col = document.createElement('div');
    col.className = opts.colClass || 'col-12 col-md-6 col-lg-4 mb-30';

    var tagHtml = (post.tags || []).map(function(tag) {
        return '<span class="blog-tag">' + tag + '</span>';
    }).join('');
    var defaultCardMins = estimateReadingMinutes(post);
    var readTimeText = (showReadTime && defaultCardMins) ? (' · ' + defaultCardMins + ' min read') : '';

    var card = document.createElement('a');
    card.href = href;
    card.className = opts.cardClass || 'blog-card';
    card.innerHTML =
        '<div class="blog-card-img"><img src="' + imageSrc + '" alt="' + post.title + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + fallback + '\';"></div>' +
        '<div class="blog-card-body">' +
        '<div class="blog-card-date">' + dateStr + readTimeText + '</div>' +
        '<h4 class="blog-card-title">' + post.title + '</h4>' +
        '<p class="blog-card-excerpt">' + (post.excerpt || '') + '</p>' +
        '<div class="blog-card-tags">' + tagHtml + '</div>' +
        '</div>';

    col.appendChild(card);
    return col;
}

function formatPostDate(dateValue) {
    var date = dateValue;
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        var parts = dateValue.split('-');
        date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    } else {
        date = new Date(dateValue);
    }

    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

function resolveCurrentPostFileName() {
    var path = window.location.pathname || '';
    var fileName = path.split('/').pop();
    if (fileName) return fileName;

    var canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) return '';

    var canonicalHref = canonical.getAttribute('href') || '';
    return canonicalHref.split('/').pop();
}

function loadBlogPosts() {
    return fetch('../data/posts.json').then(function(response) {
        return response.json();
    });
}

function renderRelatedPosts(targetId) {
    var el = document.getElementById(targetId);
    if (!el) return Promise.resolve();

    var currentFileName = resolveCurrentPostFileName();
    var tagNodes = document.querySelectorAll('.blog-post .blog-meta .blog-tag');
    var currentTags = Array.prototype.map.call(tagNodes, function(node) {
        return (node.textContent || '').trim().toLowerCase();
    }).filter(Boolean);

    return loadBlogPosts()
        .then(function(posts) {
            var related = posts
                .filter(function(post) {
                    var postFileName = (post.url || '').split('/').pop();
                    return postFileName !== currentFileName;
                })
                .map(function(post) {
                    var sharedTags = (post.tags || []).filter(function(tag) {
                        return currentTags.indexOf(String(tag).toLowerCase()) !== -1;
                    });
                    return {
                        post: post,
                        sharedTags: sharedTags.length,
                        dateValue: (function() {
                            if (typeof post.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(post.date)) {
                                var parts = post.date.split('-');
                                return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])).getTime();
                            }
                            return new Date(post.date).getTime();
                        })()
                    };
                })
                .filter(function(entry) {
                    return entry.sharedTags > 0;
                })
                .sort(function(a, b) {
                    if (b.sharedTags !== a.sharedTags) {
                        return b.sharedTags - a.sharedTags;
                    }
                    return b.dateValue - a.dateValue;
                })
                .slice(0, 3)
                .map(function(entry) { return entry.post; });

            if (related.length < 3) {
                posts
                    .filter(function(post) {
                        var postFileName = (post.url || '').split('/').pop();
                        if (postFileName === currentFileName) return false;
                        return !related.some(function(existing) { return existing.url === post.url; });
                    })
                    .sort(function(a, b) {
                        return (function(dateValue) {
                            if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                                var parts = dateValue.split('-');
                                return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                            }
                            return new Date(dateValue);
                        })(b.date) - (function(dateValue) {
                            if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
                                var parts = dateValue.split('-');
                                return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                            }
                            return new Date(dateValue);
                        })(a.date);
                    })
                    .slice(0, 3 - related.length)
                    .forEach(function(post) {
                        related.push(post);
                    });
            }

            if (!related.length) {
                el.innerHTML = '';
                return;
            }

            el.innerHTML = '<div class="related-posts">' +
                '<h2>Related posts</h2>' +
                '<div class="row related-posts-grid">' +
                related.map(function(post) {
                    var tagHtml = (post.tags || []).map(function(tag) {
                        return '<span class="blog-tag">' + tag + '</span>';
                    }).join('');
                    var imageSrc = resolveAssetPath(post.image || DEFAULT_POST_IMAGE, '../');
                    var relatedMins = estimateReadingMinutes(post);
                    return '<div class="col-12 col-md-6 col-lg-4 mb-30">' +
                        '<a href="' + (post.url || '').replace(/^blog\//, '') + '" class="blog-card">' +
                        '<div class="blog-card-img"><img src="' + imageSrc + '" alt="' + post.title + '" loading="lazy" onerror="this.onerror=null;this.src=\'../' + DEFAULT_POST_IMAGE + '\';"></div>' +
                        '<div class="blog-card-body">' +
                        '<div class="blog-card-date">' + formatPostDate(post.date) + (relatedMins ? ' · ' + relatedMins + ' min read' : '') + '</div>' +
                        '<h4 class="blog-card-title">' + post.title + '</h4>' +
                        '<p class="blog-card-excerpt">' + (post.excerpt || '') + '</p>' +
                        '<div class="blog-card-tags">' + tagHtml + '</div>' +
                        '</div>' +
                        '</a>' +
                        '</div>';
                }).join('') +
                '</div>' +
                '</div>';
        })
        .catch(function(error) {
            console.error('Failed to load related posts:', error);
            el.innerHTML = '';
            return null;
        });
}

function ensureRelatedPostsSection() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost) return Promise.resolve(null);

    var existingRelated = blogPost.querySelector('.related-posts');
    if (existingRelated) return Promise.resolve(existingRelated);

    var mount = blogPost.querySelector('#related-posts-section');
    if (!mount) {
        mount = document.createElement('div');
        mount.id = 'related-posts-section';
        mount.setAttribute('data-auto-generated', 'related-posts');
        blogPost.appendChild(mount);
    }

    return renderRelatedPosts('related-posts-section').then(function() {
        return blogPost.querySelector('.related-posts') || mount;
    });
}

function renderPostDisclaimer() {
    var meta = document.querySelector('.blog-post .blog-meta');
    if (!meta || document.querySelector('.post-disclaimer')) return;
    var p = document.createElement('div');
    p.className = 'post-disclaimer';
    p.textContent = 'The views expressed in this post are my own and do not represent any organisation, employer, or institution.';
    meta.parentNode.insertBefore(p, meta.nextSibling);
}

function renderBlogThanksCta() {
    var blogPost = document.querySelector('.blog-post');
    var relatedPosts = blogPost ? blogPost.querySelector('.related-posts, #related-posts-section') : null;

    if (!blogPost || blogPost.querySelector('.blog-thanks-cta')) {
        return;
    }

    var cta = document.createElement('section');
    cta.className = 'blog-thanks-cta';
    cta.setAttribute('aria-label', 'Stay connected with Ken Reid');
    cta.innerHTML = '' +
        '<div class="blog-thanks-cta__media">' +
        '<div class="blog-thanks-cta__portrait">' +
        '<img src="../img/bg-img/res.png" alt="Ken Reid writing on a whiteboard" loading="lazy">' +
        '</div>' +
        '</div>' +
        '<div class="blog-thanks-cta__content">' +
        '<span class="blog-thanks-cta__eyebrow">Thanks for reading</span>' +
        '<h2>Follow the next post, project, or experiment</h2>' +
        '<p>I write about systems, data science, books, photography, and practical AI. The simplest way to keep up is Bluesky or LinkedIn. If you already use a feed reader, RSS is there too.</p>' +
        '<div class="blog-thanks-cta__actions">' +
        '<a class="blog-thanks-cta__button" href="https://bsky.app/profile/kenreid.co.uk" target="_blank" rel="noopener noreferrer">' + BLUESKY_SVG + '<span>Follow on Bluesky</span></a>' +
        '<a class="blog-thanks-cta__button" href="https://www.linkedin.com/in/kennethneilreid" target="_blank" rel="noopener noreferrer">' +
        '<i class="ti-linkedin" aria-hidden="true"></i><span>Follow on LinkedIn</span></a>' +
        '</div>' +
        '<p class="blog-thanks-cta__subnote">Prefer feed readers? Use <a href="https://feedly.com/i/subscription/feed%2Fhttps%3A%2F%2Fwww.kenreid.co.uk%2Ffeed.xml" target="_blank" rel="noopener noreferrer">Feedly</a> or open the <a href="../feed.xml">raw RSS feed</a>.</p>' +
        '<div class="blog-thanks-cta__links">' +
        '<a class="blog-thanks-cta__pill" href="../feed.xml">' +
        '<i class="ti-rss" aria-hidden="true"></i><span>RSS feed</span></a>' +
        '<a class="blog-thanks-cta__pill" href="https://github.com/DrKenReid" target="_blank" rel="noopener noreferrer">' +
        '<i class="fa fa-github" aria-hidden="true"></i><span>GitHub</span></a>' +
        '<a class="blog-thanks-cta__pill" href="../data_science.html">' +
        '<i class="fa fa-line-chart" aria-hidden="true"></i><span>Data Science</span></a>' +
        '<a class="blog-thanks-cta__pill" href="../contact.html">' +
        '<i class="ti-email" aria-hidden="true"></i><span>Get in touch</span></a>' +
        '</div>' +
        '</div>';

    if (relatedPosts) {
        blogPost.insertBefore(cta, relatedPosts);
        return;
    }

    blogPost.appendChild(cta);
}

/**
 * Chronological previous/next links between posts, driven by
 * data/posts.json order (newest first). Inserted just before the
 * thanks CTA / related posts block.
 */
function renderPrevNextNav() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost || document.querySelector('.post-pagination')) return Promise.resolve();

    var currentFileName = resolveCurrentPostFileName();

    return loadBlogPosts().then(function(posts) {
        var idx = -1;
        for (var i = 0; i < posts.length; i++) {
            if ((posts[i].url || '').split('/').pop() === currentFileName) {
                idx = i;
                break;
            }
        }
        if (idx === -1) return;

        // posts.json is ordered newest-first
        var newer = idx > 0 ? posts[idx - 1] : null;
        var older = idx < posts.length - 1 ? posts[idx + 1] : null;
        if (!newer && !older) return;

        function link(post, cls, arrow, label) {
            if (!post) return '<span class="post-pagination-spacer"></span>';
            var href = (post.url || '').replace(/^blog\//, '');
            return '<a href="' + href + '" class="post-pagination-link ' + cls + '">' +
                '<span class="post-pagination-label">' + arrow + ' ' + label + '</span>' +
                '<span class="post-pagination-title">' + post.title + '</span>' +
                '</a>';
        }

        var nav = document.createElement('nav');
        nav.className = 'post-pagination';
        nav.setAttribute('aria-label', 'Post navigation');
        nav.innerHTML =
            link(older, 'post-pagination-prev', '&larr;', 'Older') +
            link(newer, 'post-pagination-next', '&rarr;', 'Newer');

        var anchor = blogPost.querySelector('.blog-thanks-cta') ||
            blogPost.querySelector('.related-posts, #related-posts-section');
        if (anchor) {
            blogPost.insertBefore(nav, anchor);
        } else {
            blogPost.appendChild(nav);
        }

        // End-of-article mark just above the navigation
        if (!blogPost.querySelector('.kr-fin')) {
            var fin = document.createElement('div');
            fin.className = 'kr-fin';
            fin.setAttribute('aria-hidden', 'true');
            fin.textContent = '⁂';
            nav.parentNode.insertBefore(fin, nav);
        }
    }).catch(function() {});
}

/**
 * giscus comments (GitHub Discussions-backed), blog posts only.
 * Requires the giscus app to be installed on the repo:
 * https://github.com/apps/giscus — until then the widget shows an
 * error banner only in the comments section; the rest of the page is
 * unaffected. Theme follows the site's dark/light toggle.
 */
function renderGiscusComments() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost || document.getElementById('giscus-comments')) return;

    var section = document.createElement('section');
    section.id = 'giscus-comments';
    section.className = 'giscus-comments';
    section.setAttribute('aria-label', 'Comments');
    section.innerHTML = '<h2>Comments</h2>';

    // Custom giscus themes matching the site palette (css/giscus-*.css).
    // giscus only accepts absolute https URLs here, so the production
    // domain is hardcoded; local previews get the stock themes.
    function giscusTheme() {
        var mode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return mode;
        }
        return 'https://www.kenreid.co.uk/css/giscus-' + mode + '.css';
    }

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
    section.appendChild(script);

    // After related posts if present, otherwise at the end of the article.
    var related = blogPost.querySelector('.related-posts, #related-posts-section');
    if (related && related.parentNode === blogPost && related.nextSibling) {
        blogPost.insertBefore(section, related.nextSibling);
    } else {
        blogPost.appendChild(section);
    }

    // Keep the widget in sync with the site theme toggle.
    document.addEventListener('click', function(e) {
        if (!(e.target.closest && e.target.closest('#theme-toggle'))) return;
        setTimeout(function() {
            var frame = document.querySelector('iframe.giscus-frame');
            if (!frame || !frame.contentWindow) return;
            frame.contentWindow.postMessage(
                { giscus: { setConfig: { theme: giscusTheme() } } },
                'https://giscus.app'
            );
        }, 50);
    });
}

/**
 * Thin reading-progress bar under the header on blog posts.
 */
function renderReadingProgress() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost || document.querySelector('.kr-progress-bar')) return;

    var bar = document.createElement('div');
    bar.className = 'kr-progress-bar';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    function update() {
        var rect = blogPost.getBoundingClientRect();
        var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        var total = rect.height - viewportHeight;
        var done = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 1;
        bar.style.transform = 'scaleX(' + done + ')';
    }

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
}

/**
 * Sticky table of contents with scroll-spy, for posts with enough
 * sections to justify one. Rides the left gutter on wide screens,
 * mirroring the share rail on the right. Headings without ids get
 * slugs generated here.
 */
var POST_SECTION_SKIP = '.faq-section, .related-posts, .blog-thanks-cta, .giscus-comments, .plain-english-box, .post-pagination';

function collectSectionHeadings(blogPost) {
    return Array.prototype.filter.call(blogPost.querySelectorAll('h2'), function(h) {
        if (h.closest(POST_SECTION_SKIP)) return false;
        var text = (h.textContent || '').trim();
        return text && text !== 'Common questions' && text !== 'Related posts';
    });
}

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

function renderPostToc() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost || document.querySelector('.kr-toc')) return;

    var headings = collectSectionHeadings(blogPost);
    if (headings.length < 4) return;
    ensureHeadingIds(headings);

    var linksHtml = headings.map(function(h) {
        return '<a href="#' + h.id + '">' + (h.textContent || '').trim() + '</a>';
    }).join('');

    var toc = document.createElement('nav');
    toc.className = 'kr-toc';
    toc.setAttribute('aria-label', 'Table of contents');
    toc.innerHTML = '<div class="kr-toc-label">Contents</div>' + linksHtml;
    document.body.appendChild(toc);

    // Narrow screens get a collapsible Contents block under the meta
    // line instead of the side rail.
    if (!document.querySelector('.kr-toc-mobile')) {
        var mobileToc = document.createElement('details');
        mobileToc.className = 'kr-toc-mobile';
        mobileToc.innerHTML = '<summary>Contents</summary><nav aria-label="Table of contents">' + linksHtml + '</nav>';
        var anchorEl = blogPost.querySelector('.kr-series') ||
            blogPost.querySelector('.post-disclaimer') ||
            blogPost.querySelector('.blog-meta');
        if (anchorEl && anchorEl.parentNode) {
            anchorEl.parentNode.insertBefore(mobileToc, anchorEl.nextSibling);
        }
        mobileToc.addEventListener('click', function(e) {
            var a = e.target.closest && e.target.closest('a');
            if (a) mobileToc.removeAttribute('open');
        });
    }

    // Scroll-spy: highlight the section currently at the top of the viewport.
    var links = toc.querySelectorAll('a');
    function setActive(id) {
        Array.prototype.forEach.call(links, function(a) {
            a.classList.toggle('active', a.getAttribute('href') === '#' + id);
        });
    }
    if ('IntersectionObserver' in window) {
        var current = headings[0].id;
        var observer = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) current = entry.target.id;
            });
            setActive(current);
        }, { rootMargin: '0px 0px -70% 0px', threshold: 0 });
        headings.forEach(function(h) { observer.observe(h); });
    }

    // Position in the left gutter, mirroring the share rail's approach.
    function updateToc() {
        var isWide = window.matchMedia('(min-width: 1240px)').matches;
        if (!isWide) { toc.classList.remove('is-visible'); return; }
        var rect = blogPost.getBoundingClientRect();
        var gap = 28;
        var width = toc.offsetWidth || 200;
        var left = rect.left - gap - width;
        if (left < 8) { toc.classList.remove('is-visible'); return; }
        toc.style.left = left + 'px';
        var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
        var entered = rect.top < viewportHeight * 0.5;
        var ended = rect.bottom < viewportHeight * 0.6;
        toc.classList.toggle('is-visible', entered && !ended);
    }
    window.addEventListener('scroll', updateToc, { passive: true });
    window.addEventListener('resize', updateToc);
    updateToc();
}

/**
 * Citation hover previews: hovering or focusing a [n] reference shows
 * the full citation in a floating card instead of forcing a jump.
 */
function initCitePreviews() {
    var refs = document.querySelectorAll('.blog-post a.cite-ref');
    if (!refs.length) return;

    var tip = document.createElement('div');
    tip.className = 'cite-preview';
    tip.setAttribute('role', 'tooltip');
    document.body.appendChild(tip);
    var hideTimer = null;

    function show(anchor) {
        var href = anchor.getAttribute('href') || '';
        if (href.charAt(0) !== '#') return;
        var target = document.getElementById(href.slice(1));
        if (!target) return;
        tip.innerHTML = target.innerHTML;
        var rect = anchor.getBoundingClientRect();
        tip.classList.add('is-visible');
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
}

/**
 * Series banner: posts with a "series" field in posts.json get a box
 * under the meta line listing every part, current one highlighted.
 */
function renderSeriesNav() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost || document.querySelector('.kr-series')) return;

    var currentFileName = resolveCurrentPostFileName();

    loadBlogPosts().then(function(posts) {
        var current = null;
        for (var i = 0; i < posts.length; i++) {
            if ((posts[i].url || '').split('/').pop() === currentFileName) {
                current = posts[i];
                break;
            }
        }
        if (!current || !current.series || !current.series.name) return;

        var parts = posts.filter(function(p) {
            return p.series && p.series.name === current.series.name;
        }).sort(function(a, b) { return (a.series.part || 0) - (b.series.part || 0); });
        if (parts.length < 2) return;

        var box = document.createElement('nav');
        box.className = 'kr-series';
        box.setAttribute('aria-label', 'Article series');
        box.innerHTML = '<span class="kr-series-label">Series · ' + current.series.name + '</span>' +
            '<ol class="kr-series-parts">' +
            parts.map(function(p) {
                var isCurrent = p.url === current.url;
                var href = (p.url || '').replace(/^blog\//, '');
                var label = 'Part ' + p.series.part + ': ' + p.title;
                return '<li' + (isCurrent ? ' class="current" aria-current="page"' : '') + '>' +
                    (isCurrent ? label : '<a href="' + href + '">' + label + '</a>') + '</li>';
            }).join('') + '</ol>';

        var meta = blogPost.querySelector('.post-disclaimer') || blogPost.querySelector('.blog-meta');
        if (meta && meta.parentNode) {
            meta.parentNode.insertBefore(box, meta.nextSibling);
        } else {
            blogPost.insertBefore(box, blogPost.firstChild);
        }
    }).catch(function() {});
}

function renderBlogPostEssentials() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost) return;

    renderReadingProgress();
    renderPostToc();
    renderHeadingAnchors();
    renderSeriesNav();
    initCitePreviews();

    ensureRelatedPostsSection().then(function() {
        renderBlogThanksCta();
        renderGiscusComments();
        return renderPrevNextNav();
    }).catch(function() {
        renderBlogThanksCta();
        renderGiscusComments();
        renderPrevNextNav();
    });
}

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

    // Resolve explicit lightweight jargon markers first:
    //   <jargon key="wcag">WCAG</jargon>
    //   <jargon>redundant coding</jargon>
    Array.prototype.forEach.call(blogPost.querySelectorAll('jargon'), function(node) {
        var key = normalizeText(node.getAttribute('key') || '').toLowerCase();
        var fallback = normalizeText(node.textContent || '').toLowerCase();
        var definition = jargonDefinitions[key] || jargonDefinitions[fallback];

        var abbr = document.createElement('abbr');
        if (definition) {
            abbr.setAttribute('title', definition);
        }
        abbr.textContent = node.textContent || '';
        node.parentNode.replaceChild(abbr, node);
    });

    var sortedTerms = Object.keys(jargonDefinitions).sort(function(a, b) {
        return b.length - a.length;
    });

    function escapeRegex(text) {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // (?:s|es)? allows the regex to match common plural forms (e.g. "LLMs", "algorithms", "processes").
    // match[1] captures the base term for the dictionary lookup while match[0] preserves the display form.
    var jargonRegex = new RegExp('\\b(' + sortedTerms.map(escapeRegex).join('|') + ')(?:s|es)?\\b', 'gi');
    var skipTags = {
        ABBR: true,
        JARGON: true,
        A: true,
        CODE: true,
        PRE: true,
        SCRIPT: true,
        STYLE: true,
        TEXTAREA: true
    };

    var walker = document.createTreeWalker(blogPost, NodeFilter.SHOW_TEXT, {
        acceptNode: function(node) {
            if (!node || !node.nodeValue || !node.nodeValue.trim()) {
                return NodeFilter.FILTER_REJECT;
            }

            var parent = node.parentElement;
            if (!parent) {
                return NodeFilter.FILTER_REJECT;
            }

            while (parent) {
                if (skipTags[parent.tagName]) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (sourceBoxes.indexOf(parent) !== -1) {
                    return NodeFilter.FILTER_REJECT;
                }
                parent = parent.parentElement;
            }

            if (!jargonRegex.test(node.nodeValue)) {
                jargonRegex.lastIndex = 0;
                return NodeFilter.FILTER_REJECT;
            }

            jargonRegex.lastIndex = 0;
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    var nodesToReplace = [];
    var currentNode;
    while ((currentNode = walker.nextNode())) {
        nodesToReplace.push(currentNode);
    }

    nodesToReplace.forEach(function(node) {
        var text = node.nodeValue;
        var fragment = document.createDocumentFragment();
        var lastIndex = 0;
        var match;

        jargonRegex.lastIndex = 0;
        while ((match = jargonRegex.exec(text)) !== null) {
            var matchedText = match[0];
            // Use match[1] (base term without plural suffix) for the dictionary lookup;
            // matchedText (match[0]) preserves the original form shown to the reader.
            var definition = jargonDefinitions[(match[1] || matchedText).toLowerCase()];
            if (!definition) {
                continue;
            }

            if (match.index > lastIndex) {
                fragment.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
            }

            var abbr = document.createElement('abbr');
            abbr.setAttribute('title', definition);
            abbr.textContent = matchedText;
            fragment.appendChild(abbr);

            lastIndex = match.index + matchedText.length;
        }

        if (lastIndex === 0) {
            return;
        }

        if (lastIndex < text.length) {
            fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
        }

        node.parentNode.replaceChild(fragment, node);
    });
}

function fallbackCopyText(text, callback) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); if (callback) callback(); } catch (e) {}
    document.body.removeChild(ta);
}

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

            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(fullText).then(showCopied).catch(function() {
                    fallbackCopyText(fullText, showCopied);
                });
            } else {
                fallbackCopyText(fullText, showCopied);
            }
        });
    });
}

function renderFooter(targetId) {
    var el = document.getElementById(targetId);
    if (!el) return;

    var year = new Date().getFullYear();
    var onBlogPostPage = !!document.querySelector('.blog-post');
    var prefix = onBlogPostPage ? '../' : './';

    var NAV_LINKS = [
        ['About', 'about.html'], ['Data Science', 'data_science.html'],
        ['Photography', 'gallery.html'], ['Photo Map', 'map.html'],
        ['Music', 'music.html'], ['Literature', 'literature.html'],
        ['Quote Wall', 'quotes.html'], ['Blog', 'blog.html'], ['Contact', 'contact.html']
    ];

    var socials =
        '<a href="https://www.linkedin.com/in/kennethneilreid" aria-label="LinkedIn"><i class="ti-linkedin" aria-hidden="true"></i></a>' +
        '<a href="https://github.com/DrKenReid" aria-label="GitHub"><i class="fa fa-github" aria-hidden="true"></i></a>' +
        '<a href="https://www.instagram.com/drkenreid/" aria-label="Instagram"><i class="fa fa-instagram" aria-hidden="true"></i></a>' +
        '<a href="https://bsky.app/profile/kenreid.co.uk" aria-label="Bluesky">' + BLUESKY_SVG + '</a>' +
        '<a href="https://www.goodreads.com/user/show/42371562-ken-reid" aria-label="Goodreads"><i class="fa fa-book" aria-hidden="true"></i></a>' +
        '<a href="https://www.last.fm/user/GoheX" aria-label="Last.fm"><i class="fa fa-lastfm" aria-hidden="true"></i></a>' +
        '<a href="/feed.xml" aria-label="RSS Feed"><i class="ti-rss" aria-hidden="true"></i></a>';

    el.innerHTML = '<footer class="footer-area kr-footer"><div class="container">' +
        '<div class="kr-footer-grid">' +
        '<div class="kr-footer-col">' +
        '<div class="kr-footer-brand">Ken<span>.</span></div>' +
        '<p class="kr-footer-tagline">Data scientist, photographer, guitarist, and avid reader. Scottish-built, Michigan-based.</p>' +
        '<div class="social-info">' + socials + '</div>' +
        '</div>' +
        '<div class="kr-footer-col"><div class="kr-footer-heading">Explore</div><ul class="kr-footer-nav">' +
        NAV_LINKS.map(function(l) {
            return '<li><a href="' + prefix + l[1] + '">' + l[0] + '</a></li>';
        }).join('') + '</ul></div>' +
        '<div class="kr-footer-col"><div class="kr-footer-heading">Latest writing</div>' +
        '<ul class="kr-footer-posts" id="kr-footer-posts"><li>&hellip;</li></ul>' +
        '<p class="kr-footer-hint">Press <span class="kr-palette-kbd">Ctrl K</span> to search everything.</p>' +
        '</div>' +
        '</div>' +
        '<div class="kr-footer-bottom">' +
        '<p>Copyright &copy; ' + year + ' Ken Reid. Photographs &copy; Ken Reid, all rights reserved.</p>' +
        '<p><a href="' + prefix + 'map.html">Photo Map</a> &middot; <a href="' + prefix + 'quotes.html">Quotes</a> &middot; <a href="/feed.xml">RSS</a></p>' +
        '</div>' +
        '</div></footer>';

    fetch(prefix + 'data/posts.json').then(function(r) { return r.json(); }).then(function(posts) {
        var ul = document.getElementById('kr-footer-posts');
        if (!ul || !posts || !posts.length) return;
        ul.innerHTML = posts.slice(0, 3).map(function(p) {
            var href = onBlogPostPage ? (p.url || '').replace(/^blog\//, '') : prefix + (p.url || '');
            return '<li><a href="' + href + '">' + p.title + '</a>' +
                '<span>' + formatPostDate(p.date) + '</span></li>';
        }).join('');
    }).catch(function() {
        var ul = document.getElementById('kr-footer-posts');
        if (ul) ul.innerHTML = '';
    });
}

function initDropCap() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost) return;
    var paragraphs = blogPost.querySelectorAll(':scope > p');
    for (var i = 0; i < paragraphs.length; i++) {
        var p = paragraphs[i];
        if (p.getAttribute('style')) continue;
        p.classList.add('drop-cap');

        var node = p.firstChild;
        if (node && node.nodeType === 3 && node.textContent.length > 2) {
            var text = node.textContent;
            var sentenceEnd = -1;
            var inQuote = false;
            for (var j = 0; j < text.length; j++) {
                var ch = text[j];
                if (ch === '"' || ch === '“' || ch === '”') { inQuote = !inQuote; continue; }
                if (!inQuote && (ch === '.' || ch === '!' || ch === '?')) {
                    sentenceEnd = j + 1;
                    while (sentenceEnd < text.length && (text[sentenceEnd] === '"' || text[sentenceEnd] === '”')) { sentenceEnd++; }
                    break;
                }
            }
            if (sentenceEnd > 0 && sentenceEnd < text.length) {
                var span = document.createElement('span');
                span.className = 'lead-in';
                span.textContent = text.slice(0, sentenceEnd);
                node.textContent = text.slice(sentenceEnd);
                p.insertBefore(span, node);
            }
        }
        break;
    }
}

function initLightboxFix() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost) return;

    var SKIP_SELECTORS = '.blog-card-img, .related-posts, .related-posts-grid, .blog-photo-highlights, .blog-thanks-cta';

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
        function step(ts) {
            if (start === null) start = ts;
            var t = Math.min(1, (ts - start) / DURATION);
            var eased = 1 - Math.pow(1 - t, 3);
            el.textContent = (target * eased).toFixed(decimals) + suffix;
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

/**
 * "Now" strip: what Ken is reading / listening to / posting right now.
 * Reading + listening come from data/now.json (refreshed daily by a
 * GitHub Action); the latest Bluesky post is fetched from the public
 * API; the latest blog post comes from posts.json. Items that fail to
 * load are simply omitted.
 */
function renderNowStrip() {
    var mount = document.getElementById('now-strip');
    if (!mount) return;

    var items = [];

    // Skeleton cards while the live data loads
    mount.innerHTML = '<span class="section-eyebrow">Now</span>' +
        '<div class="kr-now">' +
        [1, 2, 3, 4].map(function() {
            return '<span class="kr-now-item">' +
                '<span class="kr-now-icon kr-skeleton"></span>' +
                '<span class="kr-now-body" style="flex:1;">' +
                '<span class="kr-skel-bar" style="width:40%;"></span>' +
                '<span class="kr-skel-bar" style="width:85%;"></span>' +
                '<span class="kr-skel-bar" style="width:60%;"></span>' +
                '</span></span>';
        }).join('') + '</div>';

    function addItem(order, icon, label, title, sub, href) {
        items.push({ order: order, icon: icon, label: label, title: title, sub: sub, href: href });
    }

    function draw() {
        if (!items.length) { mount.innerHTML = ''; return; }
        items.sort(function(a, b) { return a.order - b.order; });
        mount.innerHTML = '<span class="section-eyebrow">Now</span>' +
            '<div class="kr-now">' + items.map(function(it) {
                return '<a class="kr-now-item" href="' + it.href + '"' +
                    (/^https?:/.test(it.href) ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' +
                    '<span class="kr-now-icon" aria-hidden="true">' + it.icon + '</span>' +
                    '<span class="kr-now-body">' +
                    '<span class="kr-now-label">' + it.label + '</span>' +
                    '<span class="kr-now-title">' + it.title + '</span>' +
                    (it.sub ? '<span class="kr-now-sub">' + it.sub + '</span>' : '') +
                    '</span>' +
                    '</a>';
            }).join('') + '</div>';
    }

    function esc(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    var pending = 3;
    function done() { if (--pending === 0) draw(); }

    fetch('data/now.json').then(function(r) { return r.json(); }).then(function(now) {
        if (now && now.reading && now.reading.length) {
            var book = now.reading[0];
            var extra = now.reading.length > 1 ? ' (+' + (now.reading.length - 1) + ' more)' : '';
            addItem(1, '📖', 'Reading', esc(book.title.replace(/\s*\(.*?\)\s*$/, '')),
                esc(book.author) + extra, book.link || 'literature.html');
        }
        if (now && now.track && now.track.name) {
            addItem(2, '🎧', now.track.nowPlaying ? 'Now playing' : 'Last played',
                esc(now.track.name), esc(now.track.artist), now.track.url || 'music.html');
        }
    }).catch(function() {}).then(done, done);

    fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=kenreid.co.uk&limit=8&filter=posts_no_replies')
        .then(function(r) { return r.json(); })
        .then(function(feed) {
            var posts = (feed && feed.feed) || [];
            for (var i = 0; i < posts.length; i++) {
                var p = posts[i];
                if (p.reason) continue; // skip reposts
                var rec = p.post && p.post.record;
                if (!rec || !rec.text) continue;
                var text = rec.text.replace(/\s+/g, ' ').trim();
                if (text.length > 92) text = text.slice(0, 92).replace(/\s\S*$/, '') + '…';
                var rkey = (p.post.uri || '').split('/').pop();
                addItem(3, BLUESKY_SVG, 'On Bluesky', esc(text), '@kenreid.co.uk',
                    'https://bsky.app/profile/kenreid.co.uk/post/' + rkey);
                break;
            }
        }).catch(function() {}).then(done, done);

    fetch('data/posts.json').then(function(r) { return r.json(); }).then(function(posts) {
        if (posts && posts.length) {
            addItem(4, '✍️', 'Latest post', esc(posts[0].title), formatPostDate(posts[0].date), posts[0].url || 'blog.html');
        }
    }).catch(function() {}).then(done, done);
}

/**
 * 30-day scrobble sparkline under the homepage stat, once
 * data/lastfm-history.json has accumulated at least two days.
 */
function initScrobbleSparkline() {
    var stat = document.querySelector('[data-lastfm="scrobbles"]');
    if (!stat || !stat.parentNode) return;

    fetch('data/lastfm-history.json').then(function(r) { return r.json(); }).then(function(history) {
        if (!Array.isArray(history) || history.length < 2) return;
        var points = history.slice(-30);
        var values = points.map(function(p) { return p.n; });
        var min = Math.min.apply(null, values);
        var max = Math.max.apply(null, values);
        var range = Math.max(1, max - min);
        var W = 84, H = 20, PAD = 2;
        var coords = values.map(function(v, i) {
            var x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
            var y = H - PAD - ((v - min) / range) * (H - PAD * 2);
            return x.toFixed(1) + ',' + y.toFixed(1);
        }).join(' ');
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'kr-sparkline');
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('width', W);
        svg.setAttribute('height', H);
        svg.setAttribute('aria-hidden', 'true');
        svg.innerHTML = '<polyline points="' + coords + '" fill="none" stroke="#fc6060" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
        var label = stat.parentNode.querySelector('.home-stat-label');
        stat.parentNode.insertBefore(svg, label ? label.nextSibling : null);
    }).catch(function() {});
}

/**
 * Live stats from data/lastfm.json (refreshed weekly by a GitHub
 * Action). Elements opt in with data-lastfm="scrobbles"; the static
 * number in the HTML is the fallback if the fetch fails.
 */
function updateLastfmStats() {
    var els = document.querySelectorAll('[data-lastfm="scrobbles"]');
    if (!els.length) return;

    var onBlogPostPage = !!document.querySelector('.blog-post');
    var assetPrefix = onBlogPostPage ? '../' : '';

    fetch(assetPrefix + 'data/lastfm.json').then(function(response) {
        return response.json();
    }).then(function(data) {
        var n = data && data.scrobbles;
        if (typeof n !== 'number' || !isFinite(n) || n <= 0) return;
        var text = n >= 1000 ? (Math.floor(n / 100) / 10) + 'K+' : String(n);
        els.forEach(function(el) { el.textContent = text; });
    }).catch(function() {});
}

/**
 * Scroll reveals for .wow elements (WOW.js replacement): observe,
 * reveal once with the element's data-wow-delay, and skip the whole
 * dance under prefers-reduced-motion (CSS keeps those visible).
 */
function initSectionReveals() {
    var reduced = !('IntersectionObserver' in window) ||
        (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    if (reduced) {
        document.querySelectorAll('.wow').forEach(function(el) { el.classList.add('kr-revealed'); });
        if ('MutationObserver' in window) {
            new MutationObserver(function() {
                document.querySelectorAll('.wow:not(.kr-revealed)').forEach(function(el) {
                    el.classList.add('kr-revealed');
                });
            }).observe(document.body, { childList: true, subtree: true });
        }
        return;
    }

    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (!entry.isIntersecting) return;
            var el = entry.target;
            var delay = el.getAttribute('data-wow-delay');
            if (delay) el.style.transitionDelay = delay;
            el.classList.add('kr-revealed');
            observer.unobserve(el);
        });
    }, { rootMargin: '0px 0px -8% 0px' });

    function watch(el) {
        if (!el.hasAttribute('data-kr-observed')) {
            el.setAttribute('data-kr-observed', '1');
            observer.observe(el);
        }
    }
    document.querySelectorAll('.wow').forEach(watch);

    // Dynamically injected content (blog grid, related posts, feeds)
    // also uses .wow — watch for additions or those elements stay at
    // opacity 0 forever.
    if ('MutationObserver' in window) {
        new MutationObserver(function() {
            document.querySelectorAll('.wow:not([data-kr-observed])').forEach(watch);
        }).observe(document.body, { childList: true, subtree: true });
    }
}

/**
 * Click-to-zoom inside any Magnific lightbox: click toggles ~2.4x zoom
 * anchored at the cursor, moving the pointer pans (via transform-origin),
 * clicking again or navigating resets. Touch: tap toggles, drag pans.
 */
function initLightboxZoom() {
    var ZOOM_CLASS = 'kr-zoomed';

    function setOrigin(img, clientX, clientY) {
        var rect = img.getBoundingClientRect();
        var x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        var y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
        img.style.transformOrigin = x + '% ' + y + '%';
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
        } else {
            setOrigin(img, e.clientX, e.clientY);
            img.classList.add(ZOOM_CLASS);
            if (wrap) wrap.classList.add('kr-zoom-wrap');
        }
    }, true);

    document.addEventListener('mousemove', function(e) {
        var img = document.querySelector('img.mfp-img.' + ZOOM_CLASS);
        if (img) setOrigin(img, e.clientX, e.clientY);
    }, { passive: true });

    document.addEventListener('touchmove', function(e) {
        var img = document.querySelector('img.mfp-img.' + ZOOM_CLASS);
        if (img && e.touches && e.touches.length) {
            setOrigin(img, e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });
}

document.addEventListener('DOMContentLoaded', function() {
    initSectionReveals();
    initLightboxZoom();
    annotateNewTabLinks();
    updateLastfmStats();
    initScrobbleSparkline();
    renderNowStrip();
    initCountUpStats();
    initLazyImageFade();
    if ('MutationObserver' in window) {
        new MutationObserver(annotateNewTabLinks).observe(document.body, { childList: true, subtree: true });
    }
});

renderPostDisclaimer();
renderBlogPostEssentials();
renderBlogPhotoHighlights();
renderFloatingBlogShare();
autoCollapseTopJargonBox();
applyJargonTooltips();
initCopyQuotes();
initDropCap();
initLightboxFix();
