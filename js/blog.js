var allPosts = [];
var activeTags = [];
var activeSeries = '';
var sortKey = 'date';
var sortDir = -1;
var popularViews = {};
var searchQuery = '';
var currentPage = 1;
var POSTS_PER_PAGE = 9;
var DEFAULT_POST_IMAGE = 'img/photography/hero/97.webp';
var BLOG_CARD_LINKS_BOUND = false;

function parsePostDate(dateValue) {
	if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
		var parts = dateValue.split('-');
		return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
	}
	return new Date(dateValue);
}

function formatPostDate(dateValue) {
	return parsePostDate(dateValue).toLocaleDateString('en-GB', {
		day: 'numeric', month: 'long', year: 'numeric'
	});
}

function loadPosts() {
	return fetch('/data/posts.json').then(function(r) { return r.json(); });
}

/* posts.json "series" may be one {name, part} object or an array of them
   (a post can belong to more than one series). Same helpers as
   shared-components.js, duplicated because this file loads first. */
function postSeriesList(p) {
	if (!p || !p.series) return [];
	return Array.isArray(p.series) ? p.series : [p.series];
}

function postSeriesEntry(p, name) {
	var list = postSeriesList(p);
	for (var i = 0; i < list.length; i++) {
		if (list[i] && list[i].name === name) return list[i];
	}
	return null;
}

function initBlog() {
	loadPosts()
		.then(function(data) {
			allPosts = data.sort(function(a, b) {
				return parsePostDate(b.date) - parsePostDate(a.date);
			});
			buildSearchBox();
			buildSeriesShelf();
			buildTagFilters();
			buildSortPanel();
			initToolbar();
			renderPosts();
			fetch('/data/popular.json').then(function(r) { return r.json(); }).then(function(pop) {
				(Array.isArray(pop) ? pop : []).forEach(function(e) { popularViews[e.url] = e.views; });
				if (sortKey === 'popularity') renderPosts();
			}).catch(function() {});
		})
		.catch(function(e) {
			console.error('Failed to load posts:', e);
		});
}

function buildSearchBox() {
	var input = document.getElementById('blog-search-static');
	if (!input) return;
	input.id = 'blog-search';
	input.placeholder = 'Search ' + allPosts.length + ' posts...';
	// Support /blog.html?q=term handoffs (e.g. from the 404 page's search box)
	var preset = (new URLSearchParams(window.location.search).get('q') || '').trim();
	if (preset) {
		input.value = preset;
		searchQuery = preset.toLowerCase();
	}
	input.addEventListener('focus', function() { this.style.borderColor = '#fc6060'; });
	input.addEventListener('blur', function() { this.style.borderColor = '#ddd'; });
	input.addEventListener('input', function() {
		searchQuery = this.value.toLowerCase().trim();
		currentPage = 1;
		renderPosts();
	});
}


function buildSeriesShelf() {
	var shelf = document.getElementById('series-shelf');
	if (!shelf) return;
	var series = {};
	allPosts.forEach(function(p) {
		postSeriesList(p).forEach(function(s) {
			if (s && s.name) {
				(series[s.name] = series[s.name] || []).push(p);
			}
		});
	});
	var names = Object.keys(series);
	if (!names.length) { shelf.style.display = 'none'; return; }

	// Most recently updated series first (dates are YYYY-MM-DD, so string
	// comparison is chronological)
	function latestDate(name) {
		return series[name].reduce(function(m, p) {
			return p.date > m ? p.date : m;
		}, '');
	}
	names.sort(function(a, b) { return latestDate(b).localeCompare(latestDate(a)); });

	var html = '<span class="kr-series-shelf__label">Recent <a href="/series.html" title="All series">Series</a>:</span>';
	names.forEach(function(name) {
		var parts = series[name].slice().sort(function(a, b) {
			return postSeriesEntry(a, name).part - postSeriesEntry(b, name).part;
		});
		var cover = parts[0].image || DEFAULT_POST_IMAGE;
		html += '<button type="button" class="kr-series-card" data-series="' + name.replace(/"/g, '&quot;') + '" aria-pressed="false">' +
			'<img src="' + cover + '" alt="" loading="lazy">' +
			'<span class="kr-series-card__text"><strong>' + name + '</strong>' +
			'<span>' + parts.length + ' part' + (parts.length === 1 ? '' : 's') + '</span></span>' +
			'</button>';
	});
	shelf.innerHTML = html;
	shelf.addEventListener('click', function(e) {
		var card = e.target.closest ? e.target.closest('.kr-series-card') : null;
		if (!card) return;
		var name = card.getAttribute('data-series');
		activeSeries = activeSeries === name ? '' : name;
		shelf.querySelectorAll('.kr-series-card').forEach(function(c) {
			var on = c.getAttribute('data-series') === activeSeries;
			c.classList.toggle('active', on);
			c.setAttribute('aria-pressed', on ? 'true' : 'false');
		});
		currentPage = 1;
		renderPosts();
	});
}

function buildTagFilters() {
	var container = document.getElementById('blog-filters');
	if (!container || typeof renderFilterBar !== 'function') return;

	var counts = {};
	allPosts.forEach(function(p) {
		(p.tags || []).forEach(function(t) {
			counts[t] = (counts[t] || 0) + 1;
		});
	});

	var items = Object.keys(counts).sort(function(a, b) {
		return counts[b] - counts[a];
	}).map(function(tag) {
		return { key: tag, label: tag, count: counts[tag] };
	});

	container.setAttribute('aria-label', 'Filter posts by tag');
	renderFilterBar(container, items, {
		multi: true,
		allLabel: 'All (' + allPosts.length + ')',
		onChange: function(activeKeys) {
			activeTags = activeKeys;
			currentPage = 1;
			updateToolbarLabels();
			renderPosts();
		}
	});
}

var SORT_OPTIONS = [
	{ key: 'date', label: 'Date', defaultDir: -1 },
	{ key: 'popularity', label: 'Popularity', defaultDir: -1 },
	{ key: 'title', label: 'Title', defaultDir: 1 },
	{ key: 'minutes', label: 'Read time', defaultDir: -1 }
];

function sortPosts(list) {
	var key = sortKey, dir = sortDir;
	return list.slice().sort(function(a, b) {
		if (key === 'popularity') {
			var pv = (popularViews[a.url] || 0) - (popularViews[b.url] || 0);
			return dir * pv || (parsePostDate(b.date) - parsePostDate(a.date));
		}
		if (key === 'title') return dir * a.title.localeCompare(b.title);
		if (key === 'minutes') {
			return dir * ((a.readMinutes || 0) - (b.readMinutes || 0)) ||
				(parsePostDate(b.date) - parsePostDate(a.date));
		}
		return dir * (parsePostDate(a.date) - parsePostDate(b.date));
	});
}

function currentSortOption() {
	for (var i = 0; i < SORT_OPTIONS.length; i++) {
		if (SORT_OPTIONS[i].key === sortKey) return SORT_OPTIONS[i];
	}
	return SORT_OPTIONS[0];
}

function updateToolbarLabels() {
	var f = document.getElementById('kr-filter-toggle');
	var s = document.getElementById('kr-sort-toggle');
	if (f) f.innerHTML = 'Filter' + (activeTags.length ? ' (' + activeTags.length + ')' : '') + ' \u25BE';
	if (s) s.innerHTML = 'Sort: ' + currentSortOption().label + ' ' + (sortDir < 0 ? '\u2193' : '\u2191');
}

function buildSortPanel() {
	var panel = document.getElementById('blog-sort');
	if (!panel) return;
	panel.setAttribute('aria-label', 'Sort posts');
	panel.innerHTML = '';
	SORT_OPTIONS.forEach(function(opt) {
		var btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'btn gallery-filter-btn' + (opt.key === sortKey ? ' active' : '');
		btn.textContent = opt.label + (opt.key === sortKey ? ' ' + (sortDir < 0 ? '\u2193' : '\u2191') : '');
		btn.onclick = function() {
			if (sortKey === opt.key) {
				sortDir = -sortDir;              // second click reverses
			} else {
				sortKey = opt.key;
				sortDir = opt.defaultDir;
			}
			currentPage = 1;
			buildSortPanel();
			updateToolbarLabels();
			renderPosts();
		};
		panel.appendChild(btn);
	});
}

function initToolbar() {
	var pairs = [
		['kr-filter-toggle', 'blog-filters', 'kr-sort-toggle', 'blog-sort'],
		['kr-sort-toggle', 'blog-sort', 'kr-filter-toggle', 'blog-filters']
	];
	pairs.forEach(function(cfg) {
		var btn = document.getElementById(cfg[0]);
		var panel = document.getElementById(cfg[1]);
		var otherBtn = document.getElementById(cfg[2]);
		var otherPanel = document.getElementById(cfg[3]);
		if (!btn || !panel) return;
		btn.addEventListener('click', function() {
			var open = panel.hidden;
			panel.hidden = !open;
			btn.setAttribute('aria-expanded', String(open));
			if (open && otherPanel && !otherPanel.hidden) {
				otherPanel.hidden = true;
				if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
			}
		});
	});
	updateToolbarLabels();
}

function getFilteredPosts() {
	if (activeSeries) {
		return allPosts.filter(function(p) {
			return postSeriesEntry(p, activeSeries);
		}).sort(function(a, b) {
			return postSeriesEntry(a, activeSeries).part - postSeriesEntry(b, activeSeries).part;
		});
	}
	return sortPosts(allPosts.filter(function(p) {
		var matchesTag = activeTags.length === 0
			|| activeTags.some(function(t) { return (p.tags || []).indexOf(t) !== -1; });

		var matchesSearch = !searchQuery
			|| (p.title || '').toLowerCase().indexOf(searchQuery) !== -1
			|| (p.excerpt || '').toLowerCase().indexOf(searchQuery) !== -1
			|| (p.tags || []).some(function(t) { return t.toLowerCase().indexOf(searchQuery) !== -1; });

		return matchesTag && matchesSearch;
	}));
}

function renderPosts() {
	var container = document.getElementById('blog-grid');
	if (!container) return;
	bindOverlayCardLinks(container);
	container.innerHTML = '';

	var filtered = getFilteredPosts();
	var totalPages = Math.ceil(filtered.length / POSTS_PER_PAGE);
	if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

	var start = (currentPage - 1) * POSTS_PER_PAGE;
	var pagePosts = filtered.slice(start, start + POSTS_PER_PAGE);

	if (filtered.length === 0) {
		container.innerHTML = '<div class="col-12 text-center"><p style="color:#636363;">No posts found.</p></div>';
		renderPagination(0, 0);
		updateCounter(0, filtered.length);
		return;
	}

	pagePosts.forEach(function(post, i) {
		var dateStr = formatPostDate(post.date);

		// Variable column widths matching the new template's alternating masonry pattern.
		// Groups of 9 posts fill 3 rows: large-small-small / small-small-large / small-large-small
		var colPatterns = [
			'col-12 col-lg-6',          // 0: large (left)
			'col-12 col-sm-6 col-lg-3', // 1: small
			'col-12 col-sm-6 col-lg-3', // 2: small
			'col-12 col-sm-6 col-lg-3', // 3: small
			'col-12 col-sm-6 col-lg-3', // 4: small
			'col-12 col-lg-6',          // 5: large (right)
			'col-12 col-lg-3',          // 6: small
			'col-12 col-lg-6',          // 7: large (center)
			'col-12 col-lg-3'           // 8: small
		];
		var wowDelays = ['100ms', '400ms', '700ms'];
		var colClass = colPatterns[i % 9];
		var wowDelay = wowDelays[i % 3];

		var col = typeof window.createBlogCardElement === 'function'
			? window.createBlogCardElement(post, {
				cardStyle: 'overlay',
				colClass: colClass,
				wowDelay: wowDelay,
				href: post.url,
				imageSrc: post.image || DEFAULT_POST_IMAGE,
				fallbackImage: DEFAULT_POST_IMAGE,
				dateStr: dateStr,
				showReadTime: true
			})
			: (function() {
				var fallbackCol = document.createElement('div');
				fallbackCol.className = colClass;
				return fallbackCol;
			})();

		var chipSeries = activeSeries ? postSeriesEntry(post, activeSeries) : postSeriesList(post)[0];
		if (chipSeries && chipSeries.name) {
			var chipHost = col.querySelector('.post-thumbnail') || col.querySelector('.single-post-area') || col.firstElementChild;
			if (chipHost) {
				var chip = document.createElement('span');
				chip.className = 'kr-series-chip';
				chip.textContent = 'Part ' + chipSeries.part;
				chip.title = chipSeries.name;
				chipHost.appendChild(chip);
			}
		}
		container.appendChild(col);
	});

	updateCounter(filtered.length, allPosts.length);
	renderPagination(currentPage, totalPages);
}

function bindOverlayCardLinks(container) {
	if (BLOG_CARD_LINKS_BOUND || !container) return;

	container.addEventListener('click', function(e) {
		var card = e.target && e.target.closest ? e.target.closest('.single-post-area[data-href]') : null;
		if (!card) return;

		// Preserve default behavior for native links inside the card.
		if (e.target.closest('a')) return;

		var href = card.getAttribute('data-href');
		if (href) window.location.href = href;
	});

	// Keyboard users navigate via the card's title link (the single tab stop);
	// the click handler above is mouse convenience for the rest of the card.
	BLOG_CARD_LINKS_BOUND = true;
}

function updateCounter(filtered, total) {
	var input = document.getElementById('blog-search');
	if (!input) return;
	if (!searchQuery && activeTags.length === 0) {
		input.placeholder = 'Search ' + total + ' posts...';
	} else {
		input.placeholder = filtered + ' of ' + total + ' posts';
	}
}

function renderPagination(current, total) {
	var existing = document.getElementById('blog-pagination');
	if (existing) existing.remove();
	if (total <= 1) return;

	var nav = document.createElement('div');
	nav.id = 'blog-pagination';
	nav.style.cssText = 'display:flex; justify-content:center; align-items:center; gap:8px; margin:32px 0 16px; flex-wrap:wrap;';

	function makeBtn(label, page, disabled, active) {
		var btn = document.createElement('button');
		btn.className = 'btn gallery-filter-btn' + (active ? ' active' : '');
		btn.textContent = label;
		btn.disabled = disabled;
		btn.style.cssText = 'min-width:38px; padding:8px 14px;' + (disabled ? 'opacity:0.4;cursor:default;' : '');
		if (!disabled) {
			btn.onclick = function() {
				currentPage = page;
				renderPosts();
				document.getElementById('blog-grid').scrollIntoView({ behavior: 'smooth', block: 'start' });
			};
		}
		return btn;
	}

	nav.appendChild(makeBtn('«', current - 1, current === 1, false));

	// Show page numbers with ellipsis for large ranges
	var pages = [];
	if (total <= 7) {
		for (var i = 1; i <= total; i++) pages.push(i);
	} else {
		pages = [1, 2];
		if (current > 4) pages.push('...');
		for (var i = Math.max(3, current - 1); i <= Math.min(total - 2, current + 1); i++) pages.push(i);
		if (current < total - 3) pages.push('...');
		pages.push(total - 1, total);
		pages = pages.filter(function(v, i, a) { return a.indexOf(v) === i; });
	}

	pages.forEach(function(p) {
		if (p === '...') {
			var span = document.createElement('span');
			span.textContent = '...';
			span.style.cssText = 'padding:0 4px; color:#888;';
			nav.appendChild(span);
		} else {
			nav.appendChild(makeBtn(p, p, false, p === current));
		}
	});

	nav.appendChild(makeBtn('»', current + 1, current === total, false));

	var grid = document.getElementById('blog-grid');
	if (grid && grid.parentNode) {
		grid.parentNode.insertBefore(nav, grid.nextSibling);
	}
}

// ---- Reading time ----
// readMinutes is precomputed into data/posts.json by scripts/generate_read_times.py.
// Returns null when absent so callers hide the read time instead of guessing.
// (shared-components.js declares the same function later and takes precedence.)

function estimateReadingMinutes(post) {
	if (typeof post.readMinutes === 'number' && isFinite(post.readMinutes)) return Math.max(1, Math.round(post.readMinutes));
	return null;
}
