var allPosts = [];
var activeTags = [];
var activeLengths = [];
var seriesMode = '';        // '' | 'series' | 'standalone'
var facetStates = {};       // tri-state facet key -> '' | 'only' | 'exclude'
var activeSeries = '';
var sortKey = 'date';
var sortDir = -1;
var popularViews = {};
var searchQuery = '';
var currentPage = 1;
var POSTS_PER_PAGE = 9;
var BLOG_CARD_LINKS_BOUND = false;
var tagFilterBar = null;
var togglePanels = null;

// Reading-time bands. Boundaries follow the shape of the corpus rather
// than round numbers: the three bands hold roughly a fifth, two fifths
// and two fifths of the posts.
var LENGTH_BUCKETS = [
	{ key: 'short', label: 'Quick read', hint: 'under 7 minutes', max: 6 },
	{ key: 'medium', label: 'Coffee break', hint: '7 to 11 minutes', max: 11 },
	{ key: 'long', label: 'Deep dive', hint: '12 minutes or more', max: Infinity }
];

// Facets a reader may want to seek out OR avoid, so each button cycles
// off -> only -> exclude rather than toggling. Keys match the flags
// .github/scripts/generate_post_facets.py writes into posts.json.
var TRI_FACETS = [
	{ key: 'interactive', label: 'Interactive', noun: 'posts with a live demo' },
	{ key: 'code', label: 'Code', noun: 'posts with code samples' }
];

var SERIES_MODES = [
	{ key: 'series', label: 'In a series' },
	{ key: 'standalone', label: 'Standalone' }
];

function loadPosts() {
	return fetch('/data/posts.json').then(function(r) { return r.json(); });
}

function initBlog() {
	loadPosts()
		.then(function(data) {
			allPosts = data.sort(function(a, b) {
				return krParsePostDate(b.date) - krParsePostDate(a.date);
			});
			var startPage = readStateFromUrl();
			buildSearchBox();
			buildSeriesShelf();
			syncSeriesShelf();
			buildFilterPanel();
			buildSortPanel();
			initToolbar();
			// Building the panels fires their own change handlers, which
			// reset the page, so a deep-linked page is applied afterwards.
			currentPage = startPage;
			// Open the panel when the link arrived pre-filtered, so a short
			// list never looks like the whole blog.
			if (activeFilterCount() || activeSeries) openFilterPanel();
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
	krBuildListSearchBox({
		total: allPosts.length,
		noun: 'posts',
		// Support /blog.html?q=term handoffs (e.g. from the 404 page's search box)
		onPresetQuery: function(q) { searchQuery = q; },
		onInput: function(q) {
			searchQuery = q;
			currentPage = 1;
			syncUrl();
			renderPosts();
		}
	});
}

/**
 * Filter state is mirrored into the query string, so a narrowed list can be
 * bookmarked, shared, or survive a reload. replaceState rather than
 * pushState: with four filter groups a history entry per click would bury
 * whatever page the reader came from behind a stack of near-identical URLs.
 */
function syncUrl() {
	if (!window.history || !window.history.replaceState) return;
	var params = new URLSearchParams();
	if (searchQuery) params.set('q', searchQuery);
	if (activeTags.length) params.set('tag', activeTags.join(','));
	if (activeLengths.length) params.set('len', activeLengths.join(','));

	var only = [], excluded = [];
	TRI_FACETS.forEach(function(f) {
		if (facetStates[f.key] === 'only') only.push(f.key);
		if (facetStates[f.key] === 'exclude') excluded.push(f.key);
	});
	if (only.length) params.set('only', only.join(','));
	if (excluded.length) params.set('not', excluded.join(','));

	if (activeSeries) params.set('series', activeSeries);
	else if (seriesMode) params.set('in', seriesMode);

	if (sortKey !== 'date' || sortDir !== -1) {
		params.set('sort', sortKey);
		params.set('dir', sortDir < 0 ? 'desc' : 'asc');
	}
	if (currentPage > 1) params.set('page', String(currentPage));

	var qs = params.toString();
	window.history.replaceState(null, '', qs ? '?' + qs : window.location.pathname);
}

/** Comma-separated query parameter -> array, blanks dropped. */
function urlList(params, key) {
	return (params.get(key) || '').split(',').map(function(v) {
		return v.trim();
	}).filter(Boolean);
}

/**
 * Restores state from the query string. Every value is checked against what
 * the corpus actually offers, so a stale or hand-edited link degrades to a
 * wider list rather than an empty one. Returns the page to open on.
 */
function readStateFromUrl() {
	var params = new URLSearchParams(window.location.search);

	var known = {};
	allPosts.forEach(function(p) {
		(p.tags || []).forEach(function(t) { known[t] = true; });
	});
	activeTags = urlList(params, 'tag').filter(function(t) { return known[t]; });

	var lengths = LENGTH_BUCKETS.map(function(b) { return b.key; });
	activeLengths = urlList(params, 'len').filter(function(k) {
		return lengths.indexOf(k) !== -1;
	});

	var facets = TRI_FACETS.map(function(f) { return f.key; });
	TRI_FACETS.forEach(function(f) { facetStates[f.key] = ''; });
	urlList(params, 'only').forEach(function(k) {
		if (facets.indexOf(k) !== -1) facetStates[k] = 'only';
	});
	urlList(params, 'not').forEach(function(k) {
		if (facets.indexOf(k) !== -1) facetStates[k] = 'exclude';
	});

	var mode = params.get('in');
	seriesMode = (mode === 'series' || mode === 'standalone') ? mode : '';

	var series = params.get('series') || '';
	activeSeries = series && allPosts.some(function(p) {
		return postSeriesEntry(p, series);
	}) ? series : '';
	// A named series and "standalone only" cannot both hold; the shelf wins.
	if (activeSeries) seriesMode = '';

	var sort = params.get('sort');
	if (sort && SORT_OPTIONS.some(function(o) { return o.key === sort; })) sortKey = sort;
	var dir = params.get('dir');
	sortDir = dir === 'asc' ? 1 : (dir === 'desc' ? -1 : currentSortOption().defaultDir);

	var page = parseInt(params.get('page'), 10);
	return page > 1 ? page : 1;
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
		// A named series contradicts "standalone only", so that button lets go.
		if (activeSeries && seriesMode === 'standalone') {
			seriesMode = '';
			buildFilterPanel();
		}
		syncSeriesShelf();
		currentPage = 1;
		syncClearRow();
		buildSortPanel();
		updateToolbarLabels();
		syncUrl();
		renderPosts();
	});
}

function syncSeriesShelf() {
	var shelf = document.getElementById('series-shelf');
	if (!shelf) return;
	shelf.querySelectorAll('.kr-series-card').forEach(function(c) {
		var on = c.getAttribute('data-series') === activeSeries;
		c.classList.toggle('active', on);
		c.setAttribute('aria-pressed', on ? 'true' : 'false');
	});
}

function clearSeriesShelf() {
	activeSeries = '';
	syncSeriesShelf();
	buildSortPanel();
}

/**
 * The filter panel is four independent groups: topic, length, format and
 * series. Buttons within a group are OR'd, the groups are AND'd, so
 * "ai" + "Quick read" means short AI posts rather than everything that is
 * either one. Format buttons are tri-state (off / only / exclude) because
 * a live demo or a wall of code is something a reader may want to avoid
 * as readily as seek out.
 */
function buildFilterPanel() {
	var container = document.getElementById('blog-filters');
	if (!container) return;
	container.removeAttribute('aria-label');
	container.innerHTML = '';

	buildTagFilters(facetRow(container, 'Topic', 'Filter posts by topic'));
	buildLengthFilters(facetRow(container, 'Length', 'Filter posts by reading time'));
	buildFormatFilters(facetRow(container, 'Format', 'Filter posts by format'));
	buildSeriesFilters(facetRow(container, 'Series', 'Filter posts by series membership'));
	buildClearRow(container);
}

/** Adds a labelled row to the panel and returns its button holder. */
function facetRow(container, label, ariaLabel) {
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

function facetButton(holder, label, onClick) {
	var btn = document.createElement('button');
	btn.type = 'button';
	btn.className = 'btn gallery-filter-btn';
	btn.innerHTML = label;
	btn.addEventListener('click', onClick);
	holder.appendChild(btn);
	return btn;
}

function facetCountLabel(label, count) {
	return krEscapeHtml(label) + ' <span class="filter-count">(' + count + ')</span>';
}

function buildTagFilters(holder) {
	if (!holder || typeof renderFilterBar !== 'function') return;

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

	tagFilterBar = renderFilterBar(holder, items, {
		multi: true,
		allLabel: 'All (' + allPosts.length + ')',
		// A long tag list filled the page before the reader reached
		// anything else; the rest sit behind a "+N more" toggle.
		collapseAfter: 3,
		onChange: function(activeKeys) {
			activeTags = activeKeys;
			onFilterChange();
		}
	});
	if (activeTags.length) tagFilterBar.setActive(activeTags);
}

function buildLengthFilters(holder) {
	if (!holder) return;
	LENGTH_BUCKETS.forEach(function(bucket) {
		var count = allPosts.filter(function(p) {
			return postLengthKey(p) === bucket.key;
		}).length;
		var btn = facetButton(holder, facetCountLabel(bucket.label, count), function() {
			var at = activeLengths.indexOf(bucket.key);
			if (at === -1) activeLengths.push(bucket.key); else activeLengths.splice(at, 1);
			syncLengthButtons(holder);
			onFilterChange();
		});
		btn.title = bucket.hint;
		btn.setAttribute('data-length-key', bucket.key);
	});
	syncLengthButtons(holder);
}

function syncLengthButtons(holder) {
	var btns = holder.querySelectorAll('button[data-length-key]');
	for (var i = 0; i < btns.length; i++) {
		var on = activeLengths.indexOf(btns[i].getAttribute('data-length-key')) !== -1;
		btns[i].classList.toggle('active', on);
		btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
	}
}

function buildFormatFilters(holder) {
	if (!holder) return;
	TRI_FACETS.forEach(function(facet) {
		facetStates[facet.key] = facetStates[facet.key] || '';
		var count = allPosts.filter(function(p) { return !!p[facet.key]; }).length;
		var btn = facetButton(holder, facetCountLabel(facet.label, count), function() {
			var next = { '': 'only', 'only': 'exclude', 'exclude': '' };
			facetStates[facet.key] = next[facetStates[facet.key] || ''];
			syncFormatButton(btn, facet, count);
			onFilterChange();
		});
		btn.setAttribute('data-facet-key', facet.key);
		syncFormatButton(btn, facet, count);
	});
}

function syncFormatButton(btn, facet, count) {
	var state = facetStates[facet.key];
	var mark = state === 'only' ? '✓ ' : (state === 'exclude' ? '✕ ' : '');
	btn.innerHTML = mark + facetCountLabel(facet.label, count);
	btn.classList.toggle('active', state === 'only');
	btn.classList.toggle('kr-facet-btn--excluded', state === 'exclude');
	// aria-pressed has no value for "excluded", so the state lives in the
	// accessible name instead and the tooltip explains the next click.
	btn.setAttribute('aria-label', facet.label + ': ' + (
		state === 'only' ? 'showing only ' + facet.noun :
		state === 'exclude' ? 'hiding ' + facet.noun :
		'not filtered'
	));
	btn.title = state === 'only' ? 'Click to hide ' + facet.noun
		: state === 'exclude' ? 'Click to stop filtering on this'
		: 'Click to show only ' + facet.noun;
}

function buildSeriesFilters(holder) {
	if (!holder) return;
	SERIES_MODES.forEach(function(mode) {
		var count = allPosts.filter(function(p) {
			return (postSeriesList(p).length > 0) === (mode.key === 'series');
		}).length;
		var btn = facetButton(holder, facetCountLabel(mode.label, count), function() {
			seriesMode = seriesMode === mode.key ? '' : mode.key;
			// A named series and "standalone only" cannot both hold, so
			// choosing standalone releases the shelf selection.
			if (seriesMode === 'standalone' && activeSeries) clearSeriesShelf();
			syncSeriesButtons(holder);
			onFilterChange();
		});
		btn.setAttribute('data-series-mode', mode.key);
	});
	syncSeriesButtons(holder);
}

function syncSeriesButtons(holder) {
	var btns = holder.querySelectorAll('button[data-series-mode]');
	for (var i = 0; i < btns.length; i++) {
		var on = seriesMode === btns[i].getAttribute('data-series-mode');
		btns[i].classList.toggle('active', on);
		btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
	}
}

function buildClearRow(container) {
	var row = document.createElement('div');
	row.className = 'kr-facet-row kr-facet-row--clear';
	var btn = document.createElement('button');
	btn.type = 'button';
	btn.id = 'kr-clear-filters';
	btn.className = 'btn gallery-filter-btn kr-facet-clear';
	btn.textContent = 'Clear all filters';
	btn.addEventListener('click', clearAllFilters);
	row.appendChild(btn);
	container.appendChild(row);
	syncClearRow();
}

function syncClearRow() {
	var row = document.querySelector('.kr-facet-row--clear');
	if (row) row.hidden = activeFilterCount() === 0;
}

function clearAllFilters() {
	activeTags = [];
	activeLengths = [];
	seriesMode = '';
	TRI_FACETS.forEach(function(f) { facetStates[f.key] = ''; });
	if (activeSeries) clearSeriesShelf();
	buildFilterPanel();
	onFilterChange();
	var toggle = document.getElementById('kr-filter-toggle');
	if (toggle) toggle.focus();
}

function activeFilterCount() {
	var n = activeTags.length + activeLengths.length + (seriesMode ? 1 : 0);
	TRI_FACETS.forEach(function(f) { if (facetStates[f.key]) n++; });
	return n;
}

function postLengthKey(p) {
	var minutes = p.readMinutes || 0;
	for (var i = 0; i < LENGTH_BUCKETS.length; i++) {
		if (minutes <= LENGTH_BUCKETS[i].max) return LENGTH_BUCKETS[i].key;
	}
	return '';
}

/** True when a post survives every facet group except the tag bar. */
function matchesFacets(p) {
	if (activeLengths.length && activeLengths.indexOf(postLengthKey(p)) === -1) return false;
	if (seriesMode) {
		var inSeries = postSeriesList(p).length > 0;
		if (inSeries !== (seriesMode === 'series')) return false;
	}
	for (var i = 0; i < TRI_FACETS.length; i++) {
		var state = facetStates[TRI_FACETS[i].key];
		if (!state) continue;
		var has = !!p[TRI_FACETS[i].key];
		if (state === 'only' && !has) return false;
		if (state === 'exclude' && has) return false;
	}
	return true;
}

function onFilterChange() {
	currentPage = 1;
	syncClearRow();
	updateToolbarLabels();
	syncUrl();
	renderPosts();
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
			return dir * pv || (krParsePostDate(b.date) - krParsePostDate(a.date));
		}
		if (key === 'title') return dir * a.title.localeCompare(b.title);
		if (key === 'minutes') {
			return dir * ((a.readMinutes || 0) - (b.readMinutes || 0)) ||
				(krParsePostDate(b.date) - krParsePostDate(a.date));
		}
		return dir * (krParsePostDate(a.date) - krParsePostDate(b.date));
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
	var activeCount = activeFilterCount();
	if (f) f.innerHTML = 'Filter' + (activeCount ? ' (' + activeCount + ')' : '') + ' \u25BE';
	if (!s) return;
	// A series is always listed in part order, so the sort choice is inert
	// there. Say so rather than showing a setting that is not being applied.
	s.innerHTML = activeSeries
		? 'Sort: Part order'
		: 'Sort: ' + currentSortOption().label + ' ' + (sortDir < 0 ? '\u2193' : '\u2191');
	s.title = activeSeries
		? 'Posts in a series are listed in part order'
		: '';
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
		if (activeSeries) {
			btn.disabled = true;
			btn.title = 'Posts in a series are listed in part order';
		}
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
			syncUrl();
			renderPosts();
		};
		panel.appendChild(btn);
	});
}

function initToolbar() {
	// The series shelf is a filtering control too, so clicking it counts as
	// inside the panel rather than as a dismissing click elsewhere.
	togglePanels = krInitTogglePanels([
		['kr-filter-toggle', 'blog-filters'],
		['kr-sort-toggle', 'blog-sort']
	], '#series-shelf');
	updateToolbarLabels();
}

function openFilterPanel() {
	var panel = document.getElementById('blog-filters');
	var btn = document.getElementById('kr-filter-toggle');
	if (!panel || !btn) return;
	panel.hidden = false;
	btn.setAttribute('aria-expanded', 'true');
}

function getFilteredPosts() {
	if (activeSeries) {
		return allPosts.filter(function(p) {
			return postSeriesEntry(p, activeSeries) && matchesFacets(p);
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

		return matchesTag && matchesSearch && matchesFacets(p);
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
		krRenderListPagination(0, 0, setBlogPage);
		updateBlogCounter(0, filtered.length);
		return;
	}

	pagePosts.forEach(function(post, i) {
		var dateStr = formatPostDate(post.date);
		var wowDelays = ['100ms', '400ms', '700ms'];
		var colClass = columnClassFor(i, pagePosts.length);
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

	updateBlogCounter(filtered.length, allPosts.length);
	krRenderListPagination(currentPage, totalPages, setBlogPage);

	// Cards for posts with an algorithm demo run one on hover (js/live-covers.js).
	if (window.krLiveCovers) {
		var liveByHref = {};
		// On the listing every interactive post runs, whatever the filter.
		pagePosts.forEach(function(p) { if (p.interactive) liveByHref[p.url] = true; });
		window.krLiveCovers.attach(container, function(href) { return !!liveByHref[href]; });
	}
}

// Variable column widths matching the template's alternating masonry
// pattern. Groups of 9 fill 3 rows: large-small-small / small-small-large /
// small-large-small.
var MASONRY_COLUMNS = [
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

// That pattern assumes a full page. A handful of matches is ordinary once
// several filters are on, and the pattern would strand a half-width card
// beside an empty half-row, so short pages get an even split instead.
var SHORT_PAGE_COLUMNS = {
	1: ['col-12 col-lg-8 mx-auto'],
	2: ['col-12 col-lg-6', 'col-12 col-lg-6'],
	3: ['col-12 col-md-4', 'col-12 col-md-4', 'col-12 col-md-4'],
	4: ['col-12 col-sm-6', 'col-12 col-sm-6', 'col-12 col-sm-6', 'col-12 col-sm-6']
};

function columnClassFor(index, pageCount) {
	var short = SHORT_PAGE_COLUMNS[pageCount];
	return short ? short[index] : MASONRY_COLUMNS[index % 9];
}

function setBlogPage(page) {
	currentPage = page;
	syncUrl();
	renderPosts();
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

function updateBlogCounter(filtered, total) {
	krUpdateSearchCounter(filtered, total, 'posts',
		!searchQuery && !activeSeries && activeFilterCount() === 0);
}
