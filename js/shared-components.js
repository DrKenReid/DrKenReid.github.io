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

    function isActive(key) {
        return active === key ? ' class="active"' : '';
    }

    function isHobbyChildActive(key) {
        return hobbiesChild === key ? ' class="active"' : '';
    }

    el.innerHTML = '<header class="header-area"><div class="main-header-area"><div class="classy-nav-container breakpoint-on"><div class="container">' +
        '<nav class="classy-navbar justify-content-between" id="alimeNav">' +
        '<a class="nav-brand" href="' + basePath + 'index.html"><img src="' + basePath + 'img/core-img/logo.png" alt="Ken Reid Logo"></a>' +
        '<div class="classy-navbar-toggler"><span class="navbarToggler"><span></span><span></span><span></span></span></div>' +
        '<div class="classy-menu"><div class="classycloseIcon"><div class="cross-wrap"><span class="top"></span><span class="bottom"></span></div></div>' +
        '<div class="classynav"><ul id="nav">' +
        '<li' + isActive('home') + '><a href="' + basePath + 'index.html">Home</a></li>' +
        '<li' + isActive('about') + '><a href="' + basePath + 'about.html">About</a></li>' +
        '<li' + isActive('data_science') + '><a href="' + basePath + 'data_science.html">Data Science</a></li>' +
        '<li' + (hobbiesActive ? ' class="active"' : '') + '><a href="#">Hobbies</a>' +
        '<ul class="dropdown">' +
        '<li' + isHobbyChildActive('gallery') + '><a href="' + basePath + 'gallery.html">Photography</a></li>' +
        '<li' + isHobbyChildActive('music') + '><a href="' + basePath + 'music.html">Music</a></li>' +
        '<li' + isHobbyChildActive('literature') + '><a href="' + basePath + 'literature.html">Literature</a></li>' +
        '</ul></li>' +
        '<li' + isActive('blog') + '><a href="' + basePath + 'blog.html">Blog</a></li>' +
        '<li' + isActive('contact') + '><a href="' + basePath + 'contact.html">Contact</a></li>' +
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
var DEFAULT_POST_IMAGE = 'img/bg-img/2.png';

function estimateReadingMinutes(post) {
    if (typeof post.readMinutes === 'number' && isFinite(post.readMinutes)) {
        return Math.max(1, Math.round(post.readMinutes));
    }

    if (typeof post._readMinutes === 'number' && isFinite(post._readMinutes)) {
        return Math.max(1, Math.round(post._readMinutes));
    }

    var text = (post.title || '') + ' ' + (post.excerpt || '');
    var words = text.trim() ? text.trim().split(/\s+/).length : 0;
    return Math.max(1, Math.ceil(words / 220));
}

function createBlogCardElement(post, options) {
    var opts = options || {};
    var col = document.createElement('div');
    col.className = opts.colClass || 'col-12 col-md-6 col-lg-4 mb-30';

    var dateStr = opts.dateStr || formatPostDate(post.date);
    var tagHtml = (post.tags || []).map(function(tag) {
        return '<span class="blog-tag">' + tag + '</span>';
    }).join('');

    var imageSrc = opts.imageSrc || post.image || DEFAULT_POST_IMAGE;
    var href = opts.href || post.url;
    var showReadTime = opts.showReadTime !== false;
    var readTimeText = showReadTime ? (' · ' + estimateReadingMinutes(post) + ' min read') : '';

    var card = document.createElement('a');
    card.href = href;
    card.className = opts.cardClass || 'blog-card';
    card.innerHTML =
        '<div class="blog-card-img"><img src="' + imageSrc + '" alt="' + post.title + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + (opts.fallbackImage || DEFAULT_POST_IMAGE) + '\';"></div>' +
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
    return new Date(dateValue).toLocaleDateString('en-GB', {
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
    if (window.BLOG_POSTS && window.BLOG_POSTS.length) {
        return Promise.resolve(window.BLOG_POSTS.slice());
    }

    return fetch('../data/posts.json').then(function(response) {
        return response.json();
    });
}

function renderRelatedPosts(targetId) {
    var el = document.getElementById(targetId);
    if (!el) return;

    var currentFileName = resolveCurrentPostFileName();
    var tagNodes = document.querySelectorAll('.blog-post .blog-meta .blog-tag');
    var currentTags = Array.prototype.map.call(tagNodes, function(node) {
        return (node.textContent || '').trim().toLowerCase();
    }).filter(Boolean);

    loadBlogPosts()
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
                        dateValue: new Date(post.date).getTime()
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
                        return new Date(b.date) - new Date(a.date);
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
                    var imageSrc = post.image || DEFAULT_POST_IMAGE;
                    return '<div class="col-12 col-md-6 col-lg-4 mb-30">' +
                        '<a href="' + (post.url || '').replace(/^blog\//, '') + '" class="blog-card">' +
                        '<div class="blog-card-img"><img src="../' + imageSrc + '" alt="' + post.title + '" loading="lazy" onerror="this.onerror=null;this.src=\'../' + DEFAULT_POST_IMAGE + '\';"></div>' +
                        '<div class="blog-card-body">' +
                        '<div class="blog-card-date">' + formatPostDate(post.date) + ' · ' + estimateReadingMinutes(post) + ' min read</div>' +
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
        });
}

function renderPostDisclaimer() {
    var meta = document.querySelector('.blog-post .blog-meta');
    if (!meta || document.querySelector('.post-disclaimer')) return;
    var p = document.createElement('p');
    p.className = 'post-disclaimer';
    p.textContent = 'The views expressed in this post are my own and do not represent any organisation, employer, or institution.';
    meta.parentNode.insertBefore(p, meta.nextSibling);
}

function renderBlogThanksCta() {
    var blogPost = document.querySelector('.blog-post');
    var relatedPosts = blogPost ? blogPost.querySelector('.related-posts') : null;

    if (!blogPost || !relatedPosts || blogPost.querySelector('.blog-thanks-cta')) {
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

    blogPost.insertBefore(cta, relatedPosts);
}

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
        '<a href="/feed.xml" aria-label="RSS Feed"><i class="ti-rss" aria-hidden="true"></i></a>' +
        '<a href="https://bsky.app/profile/kenreid.co.uk" aria-label="Bluesky">' + BLUESKY_SVG + '</a>' +
        '<a href="https://www.linkedin.com/in/kennethneilreid" aria-label="LinkedIn"><i class="ti-linkedin" aria-hidden="true"></i></a>' +
        '</div></div></div></div></div></footer>';
}

    renderPostDisclaimer();
    renderBlogThanksCta();
