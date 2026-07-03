/**
 * shared-components.js
 * 
 * Injects the Instagram feed section and site footer into every page.
 * To update social links, Instagram handle, or footer text, edit this
 * single file instead of all 6 HTML pages.
 */

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

function renderBlogPostEssentials() {
    var blogPost = document.querySelector('.blog-post');
    if (!blogPost) return;

    ensureRelatedPostsSection().then(function() {
        renderBlogThanksCta();
    }).catch(function() {
        renderBlogThanksCta();
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

    el.innerHTML = '<footer class="footer-area"><div class="container">' +
        '<div class="row"><div class="col-12">' +
        '<div class="footer-content d-flex align-items-center justify-content-between">' +
        '<div class="copywrite-text"><p>' +
        'Copyright &copy; ' + year + ' Ken Reid' +
        '</p></div>' +
        '<div class="social-info">' +
        '<a href="https://www.linkedin.com/in/kennethneilreid" aria-label="LinkedIn"><i class="ti-linkedin" aria-hidden="true"></i></a>' +
        '<a href="https://github.com/DrKenReid" aria-label="GitHub"><i class="fa fa-github" aria-hidden="true"></i></a>' +
        '<a href="https://www.instagram.com/drkenreid/" aria-label="Instagram"><i class="fa fa-instagram" aria-hidden="true"></i></a>' +
        '<a href="https://bsky.app/profile/kenreid.co.uk" aria-label="Bluesky">' + BLUESKY_SVG + '</a>' +
        '<a href="https://www.goodreads.com/user/show/42371562-ken-reid" aria-label="Goodreads"><i class="fa fa-book" aria-hidden="true"></i></a>' +
        '<a href="https://www.last.fm/user/GoheX" aria-label="Last.fm"><i class="fa fa-lastfm" aria-hidden="true"></i></a>' +
        '<a href="/feed.xml" aria-label="RSS Feed"><i class="ti-rss" aria-hidden="true"></i></a>' +
        '</div></div></div></div></div></footer>';
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
        return src
            .replace(/\/thumb\/(\d+)\.webp$/, '/$1.png')
            .replace(/-thumb\.(jpg|jpeg)$/, '.$1');
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

document.addEventListener('DOMContentLoaded', function() {
    annotateNewTabLinks();
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
