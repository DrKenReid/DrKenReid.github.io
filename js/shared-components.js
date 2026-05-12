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

    fetch('data/photography-standard-files.json').then(function(response) {
        return response.json();
    }).then(function(files) {
        var sample = shuffleCopy(Array.isArray(files) ? files : []).slice(0, 10);
        var feed = el.querySelector('.instragram-feed-area');
        if (!feed) return;

        var html = '';
        sample.forEach(function(filename, index) {
            var stem = getStem(filename);
            html += '<div class="single-instagram-item">' +
                '<img src="img/photography/' + filename + '" alt="Photography highlight ' + (index + 1) + '" loading="lazy">' +
                '<div class="instagram-hover-content text-center d-flex align-items-center justify-content-center">' +
                '<a href="' + instagramUrl + '">' +
                '<i class="ti-instagram" aria-hidden="true"></i>' +
                '<span>' + handle + '</span></a></div></div>';
        });

        feed.innerHTML = html;

        if (typeof jQuery !== 'undefined' && jQuery.fn.owlCarousel) {
            jQuery('.instragram-feed-area').owlCarousel({
                items: 10,
                loop: true,
                autoplay: true,
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
        }
    }).catch(function() {
        var feed = el.querySelector('.instragram-feed-area');
        if (feed) {
            feed.innerHTML = '<div class="single-instagram-item"><a href="' + instagramUrl + '" class="d-flex align-items-center justify-content-center" style="min-height: 220px; color: #fc6060; font-weight: 600;">Instagram feed unavailable</a></div>';
        }
    });
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

    var extracted = extractPageJargonDefinitions(blogPost);
    var jargonDefinitions = extracted.definitions;
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

    var jargonRegex = new RegExp('\\b(' + sortedTerms.map(escapeRegex).join('|') + ')\\b', 'gi');
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
            var definition = jargonDefinitions[matchedText.toLowerCase()];
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
autoCollapseTopJargonBox();
applyJargonTooltips();
