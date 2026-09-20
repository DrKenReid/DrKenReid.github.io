/**
 * Series index (series.html): builds one card per series from posts.json,
 * with filtering and sorting.
 *
 * Deliberately lighter than the blog listing. There are single-figure
 * numbers of series, so there is no search box, no pagination, and no
 * length bands, and the format buttons are plain on/off rather than the
 * blog's off/only/exclude cycle — excluding one of seven cards earns
 * nothing. What a reader does want here is "which runs are about X", "which
 * ones have demos", and "which is the longest", so that is what is offered.
 */
var allSeries = [];
var seriesTags = [];
var seriesFormats = {};
var seriesSortKey = 'updated';
var seriesSortDir = -1;
var seriesTagBar = null;

var SERIES_FORMATS = [
	{ key: 'interactive', label: 'Interactive', noun: 'series with a live demo' },
	{ key: 'code', label: 'Code', noun: 'series with code samples' }
];

var SERIES_SORTS = [
	{ key: 'updated', label: 'Updated', defaultDir: -1 },
	{ key: 'parts', label: 'Parts', defaultDir: -1 },
	{ key: 'minutes', label: 'Read time', defaultDir: -1 },
	{ key: 'title', label: 'Title', defaultDir: 1 }
];

function initSeriesIndex() {
	loadBlogPosts().then(function(posts) {
		if (!Array.isArray(posts)) return;
		allSeries = collectSeries(posts);
		readSeriesUrl();
		buildSeriesFilterPanel();
		buildSeriesSortPanel();
		krInitTogglePanels([
			['kr-filter-toggle', 'blog-filters'],
			['kr-sort-toggle', 'blog-sort']
		]);
		updateSeriesToolbar();
		if (seriesFilterCount()) openSeriesFilterPanel();
		renderSeriesIndex();
	}).catch(function(e) {
		console.error('Failed to load series:', e);
	});
}

/** One record per series, with the totals the cards and filters both need. */
function collectSeries(posts) {
	var map = {};
	posts.forEach(function(p) {
		postSeriesList(p).forEach(function(s) {
			if (s && s.name) (map[s.name] = map[s.name] || []).push(p);
		});
	});
	return Object.keys(map).map(function(name) {
		var members = map[name];
		var parts = members.slice().sort(function(a, b) {
			return (postSeriesEntry(a, name).part || 0) - (postSeriesEntry(b, name).part || 0);
		});
		var latest = members.slice().sort(function(a, b) {
			return b.date.localeCompare(a.date);
		})[0];
		var tags = {};
		members.forEach(function(p) { (p.tags || []).forEach(function(t) { tags[t] = true; }); });
		return {
			name: name,
			parts: parts,
			latest: latest,
			updated: latest.date,
			minutes: members.reduce(function(sum, p) { return sum + (p.readMinutes || 0); }, 0),
			tags: Object.keys(tags).sort(),
			// A series counts as interactive or code-carrying when any part is.
			interactive: members.some(function(p) { return !!p.interactive; }),
			code: members.some(function(p) { return !!p.code; })
		};
	});
}

/* ------------------------------------------------------------------ filters */

function buildSeriesFilterPanel() {
	var container = document.getElementById('blog-filters');
	if (!container) return;
	container.innerHTML = '';
	buildSeriesTagFilters(seriesFacetRow(container, 'Topic', 'Filter series by topic'));
	buildSeriesFormatFilters(seriesFacetRow(container, 'Format', 'Filter series by format'));
	buildSeriesClearRow(container);
}

function seriesFacetRow(container, label, ariaLabel) {
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

function buildSeriesTagFilters(holder) {
	if (!holder || typeof renderFilterBar !== 'function') return;
	var counts = {};
	allSeries.forEach(function(s) {
		s.tags.forEach(function(t) { counts[t] = (counts[t] || 0) + 1; });
	});
	var items = Object.keys(counts).sort(function(a, b) {
		return counts[b] - counts[a] || a.localeCompare(b);
	}).map(function(tag) {
		return { key: tag, label: tag, count: counts[tag] };
	});
	seriesTagBar = renderFilterBar(holder, items, {
		multi: true,
		allLabel: 'All (' + allSeries.length + ')',
		// A long tag list filled the page before the reader reached
		// anything else; the rest sit behind a "+N more" toggle.
		collapseAfter: 3,
		onChange: function(keys) {
			seriesTags = keys;
			onSeriesFilterChange();
		}
	});
	if (seriesTags.length) seriesTagBar.setActive(seriesTags);
}

function buildSeriesFormatFilters(holder) {
	if (!holder) return;
	SERIES_FORMATS.forEach(function(facet) {
		var count = allSeries.filter(function(s) { return s[facet.key]; }).length;
		var btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'btn gallery-filter-btn';
		btn.innerHTML = krEscapeHtml(facet.label) +
			' <span class="filter-count">(' + count + ')</span>';
		btn.setAttribute('data-facet-key', facet.key);
		btn.title = 'Show only ' + facet.noun;
		btn.addEventListener('click', function() {
			seriesFormats[facet.key] = !seriesFormats[facet.key];
			syncSeriesFormatButtons(holder);
			onSeriesFilterChange();
		});
		holder.appendChild(btn);
	});
	syncSeriesFormatButtons(holder);
}

function syncSeriesFormatButtons(holder) {
	var btns = holder.querySelectorAll('button[data-facet-key]');
	for (var i = 0; i < btns.length; i++) {
		var on = !!seriesFormats[btns[i].getAttribute('data-facet-key')];
		btns[i].classList.toggle('active', on);
		btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
	}
}

function buildSeriesClearRow(container) {
	var row = document.createElement('div');
	row.className = 'kr-facet-row kr-facet-row--clear';
	var btn = document.createElement('button');
	btn.type = 'button';
	btn.id = 'kr-clear-filters';
	btn.className = 'btn gallery-filter-btn kr-facet-clear';
	btn.textContent = 'Clear all filters';
	btn.addEventListener('click', function() {
		seriesTags = [];
		SERIES_FORMATS.forEach(function(f) { seriesFormats[f.key] = false; });
		buildSeriesFilterPanel();
		onSeriesFilterChange();
		var toggle = document.getElementById('kr-filter-toggle');
		if (toggle) toggle.focus();
	});
	row.appendChild(btn);
	container.appendChild(row);
	syncSeriesClearRow();
}

function syncSeriesClearRow() {
	var row = document.querySelector('.kr-facet-row--clear');
	if (row) row.hidden = seriesFilterCount() === 0;
}

function seriesFilterCount() {
	var n = seriesTags.length;
	SERIES_FORMATS.forEach(function(f) { if (seriesFormats[f.key]) n++; });
	return n;
}

function openSeriesFilterPanel() {
	var panel = document.getElementById('blog-filters');
	var btn = document.getElementById('kr-filter-toggle');
	if (!panel || !btn) return;
	panel.hidden = false;
	btn.setAttribute('aria-expanded', 'true');
}

/* --------------------------------------------------------------- sort + url */

function buildSeriesSortPanel() {
	var panel = document.getElementById('blog-sort');
	if (!panel) return;
	panel.setAttribute('aria-label', 'Sort series');
	panel.innerHTML = '';
	SERIES_SORTS.forEach(function(opt) {
		var on = opt.key === seriesSortKey;
		var btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'btn gallery-filter-btn' + (on ? ' active' : '');
		btn.textContent = opt.label + (on ? ' ' + (seriesSortDir < 0 ? '↓' : '↑') : '');
		btn.onclick = function() {
			if (seriesSortKey === opt.key) {
				seriesSortDir = -seriesSortDir;   // second click reverses
			} else {
				seriesSortKey = opt.key;
				seriesSortDir = opt.defaultDir;
			}
			buildSeriesSortPanel();
			updateSeriesToolbar();
			syncSeriesUrl();
			renderSeriesIndex();
		};
		panel.appendChild(btn);
	});
}

function currentSeriesSort() {
	for (var i = 0; i < SERIES_SORTS.length; i++) {
		if (SERIES_SORTS[i].key === seriesSortKey) return SERIES_SORTS[i];
	}
	return SERIES_SORTS[0];
}

function updateSeriesToolbar() {
	var f = document.getElementById('kr-filter-toggle');
	var s = document.getElementById('kr-sort-toggle');
	var n = seriesFilterCount();
	if (f) f.innerHTML = 'Filter' + (n ? ' (' + n + ')' : '') + ' ▾';
	if (s) {
		s.innerHTML = 'Sort: ' + currentSeriesSort().label + ' ' +
			(seriesSortDir < 0 ? '↓' : '↑');
	}
}

function syncSeriesUrl() {
	if (!window.history || !window.history.replaceState) return;
	var params = new URLSearchParams();
	if (seriesTags.length) params.set('tag', seriesTags.join(','));
	var formats = SERIES_FORMATS.filter(function(f) {
		return seriesFormats[f.key];
	}).map(function(f) { return f.key; });
	if (formats.length) params.set('has', formats.join(','));
	if (seriesSortKey !== 'updated' || seriesSortDir !== -1) {
		params.set('sort', seriesSortKey);
		params.set('dir', seriesSortDir < 0 ? 'desc' : 'asc');
	}
	var qs = params.toString();
	window.history.replaceState(null, '', qs ? '?' + qs : window.location.pathname);
}

function readSeriesUrl() {
	var params = new URLSearchParams(window.location.search);

	function list(key) {
		return (params.get(key) || '').split(',').map(function(v) {
			return v.trim();
		}).filter(Boolean);
	}

	var known = {};
	allSeries.forEach(function(s) { s.tags.forEach(function(t) { known[t] = true; }); });
	seriesTags = list('tag').filter(function(t) { return known[t]; });

	var formatKeys = SERIES_FORMATS.map(function(f) { return f.key; });
	SERIES_FORMATS.forEach(function(f) { seriesFormats[f.key] = false; });
	list('has').forEach(function(k) {
		if (formatKeys.indexOf(k) !== -1) seriesFormats[k] = true;
	});

	var sort = params.get('sort');
	if (sort && SERIES_SORTS.some(function(o) { return o.key === sort; })) seriesSortKey = sort;
	var dir = params.get('dir');
	seriesSortDir = dir === 'asc' ? 1 : (dir === 'desc' ? -1 : currentSeriesSort().defaultDir);
}

function onSeriesFilterChange() {
	syncSeriesClearRow();
	updateSeriesToolbar();
	syncSeriesUrl();
	renderSeriesIndex();
}

/* ------------------------------------------------------------------- render */

function filteredSeries() {
	var list = allSeries.filter(function(s) {
		var tagOk = seriesTags.length === 0 || seriesTags.some(function(t) {
			return s.tags.indexOf(t) !== -1;
		});
		// Format buttons AND together: both on means demos and code.
		var formatOk = SERIES_FORMATS.every(function(f) {
			return !seriesFormats[f.key] || s[f.key];
		});
		return tagOk && formatOk;
	});

	var dir = seriesSortDir;
	return list.sort(function(a, b) {
		if (seriesSortKey === 'title') return dir * a.name.localeCompare(b.name);
		if (seriesSortKey === 'parts') {
			return dir * (a.parts.length - b.parts.length) || b.updated.localeCompare(a.updated);
		}
		if (seriesSortKey === 'minutes') {
			return dir * (a.minutes - b.minutes) || b.updated.localeCompare(a.updated);
		}
		return dir * a.updated.localeCompare(b.updated);
	});
}

function renderSeriesIndex() {
	var grid = document.getElementById('series-index-grid');
	if (!grid) return;
	var list = filteredSeries();

	if (!list.length) {
		grid.innerHTML = '<div class="col-12 text-center"><p class="kr-muted">' +
			'No series match these filters.</p></div>';
	} else {
		grid.innerHTML = list.map(seriesCardHtml).join('');
	}
	krUpdateSearchCounter(list.length, allSeries.length, 'series', seriesFilterCount() === 0);

	// Every series card runs part one's sketch on hover (data-live-href,
	// set in the card markup, names the part).
}

function seriesCardHtml(s) {
	var cover = '/' + (s.parts[0].image || DEFAULT_POST_IMAGE);
	var name = krEscapeHtml(s.name);
	// The cover is part one's image, so the live sketch is part one's too.
	var liveFrom = s.parts[0];
	var liveAttr = liveFrom ? ' data-live-href="' + krEscapeHtml(liveFrom.url) + '"' : '';
	return '<div class="col-12 col-md-6 col-lg-4 mb-30 kr-glow-host" style="--kr-cover: url(' + cover + ')">' +
		'<a href="' + seriesPageHref(s.name) + '" class="blog-card kr-lit"' + liveAttr + '>' +
		'<span class="kr-lit__ring" aria-hidden="true"></span>' +
		'<div class="blog-card-img"><img src="' + cover + '" alt="" loading="lazy">' +
		'<span class="kr-series-chip">' + s.parts.length +
		(s.parts.length === 1 ? ' part' : ' parts') + '</span></div>' +
		'<div class="blog-card-body">' +
		'<div class="blog-card-date">Updated ' + formatPostDate(s.updated) +
		' &middot; ' + s.minutes + ' min all told</div>' +
		'<h3 class="blog-card-title">' + name + '</h3>' +
		'<p class="blog-card-excerpt">Latest: ' + krEscapeHtml(s.latest.title) + '</p>' +
		'</div></a></div>';
}
