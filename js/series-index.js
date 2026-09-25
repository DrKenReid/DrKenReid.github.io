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
 *
 * URL keys: tag (topics, comma-separated), has (SERIES_FORMATS keys that
 * must all be present), sort (SERIES_SORTS key) and dir ('asc' | 'desc').
 * They are read, validated against the corpus and written back with
 * replaceState on the same terms as the blog listing; js/blog.js's header
 * gives the reasons.
 *
 * The panels are built from the same parts as the blog's (krFacetRow,
 * krFacetButton, krCountLabel, krSetPressed, krClearRow, krTagFacetRow,
 * krSortPanel, krSortOption, krSortFromUrl, krSortToUrl, krToolbarLabels
 * and krUrlList in shared-components.js, beside krInitTogglePanels), so
 * the two listings look and behave alike and a fix to one reaches both.
 *
 * Globals: only initSeriesIndex(), which series.html calls once
 * shared-components.js has loaded; the rest is private to the closure.
 */
(function() {
	'use strict';

	var allSeries = [];
	var seriesTags = [];
	var seriesFormats = {};
	var seriesSortKey = 'updated';
	var seriesSortDir = -1;
	var seriesTagBar = null;
	var clearRow = null;

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
			var toolbar = krInitTogglePanels([
				['kr-filter-toggle', 'blog-filters'],
				['kr-sort-toggle', 'blog-sort']
			]);
			updateSeriesToolbar();
			if (seriesFilterCount()) toolbar.open('blog-filters');
			renderSeriesIndex();
			// Values the corpus does not offer were dropped by readSeriesUrl;
			// write what was kept, so the address bar matches the page.
			syncSeriesUrl();
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
		buildSeriesTagFilters(krFacetRow(container, 'Topic', 'Filter series by topic'));
		buildSeriesFormatFilters(krFacetRow(container, 'Format', 'Filter series by format'));
		clearRow = krClearRow(container, function() {
			seriesTags = [];
			SERIES_FORMATS.forEach(function(f) { seriesFormats[f.key] = false; });
			buildSeriesFilterPanel();
			onSeriesFilterChange();
		});
		syncSeriesClearRow();
	}

	function buildSeriesTagFilters(holder) {
		if (!holder) return;
		seriesTagBar = krTagFacetRow(holder, allSeries, function(s) { return s.tags; }, {
			active: seriesTags,
			onChange: function(keys) {
				seriesTags = keys;
				onSeriesFilterChange();
			}
		});
	}

	function buildSeriesFormatFilters(holder) {
		if (!holder) return;
		SERIES_FORMATS.forEach(function(facet) {
			var count = allSeries.filter(function(s) { return s[facet.key]; }).length;
			var btn = krFacetButton(holder, krCountLabel(facet.label, count), function() {
				seriesFormats[facet.key] = !seriesFormats[facet.key];
				syncSeriesFormatButtons(holder);
				onSeriesFilterChange();
			});
			btn.setAttribute('data-facet-key', facet.key);
			btn.title = 'Show only ' + facet.noun;
		});
		syncSeriesFormatButtons(holder);
	}

	function syncSeriesFormatButtons(holder) {
		holder.querySelectorAll('button[data-facet-key]').forEach(function(btn) {
			krSetPressed(btn, !!seriesFormats[btn.getAttribute('data-facet-key')]);
		});
	}

	function syncSeriesClearRow() {
		if (clearRow) clearRow.sync(seriesFilterCount());
	}

	function seriesFilterCount() {
		var n = seriesTags.length;
		SERIES_FORMATS.forEach(function(f) { if (seriesFormats[f.key]) n++; });
		return n;
	}

	/* --------------------------------------------------------------- sort + url */

	function buildSeriesSortPanel() {
		var panel = document.getElementById('blog-sort');
		if (!panel) return;
		// Nothing else changes the sort here, so its own sync() is never needed.
		krSortPanel(panel, {
			options: SERIES_SORTS,
			ariaLabel: 'Sort series',
			state: function() { return { key: seriesSortKey, dir: seriesSortDir }; },
			onChange: function(key, dir) {
				seriesSortKey = key;
				seriesSortDir = dir;
				updateSeriesToolbar();
				syncSeriesUrl();
				renderSeriesIndex();
			}
		});
	}

	function updateSeriesToolbar() {
		krToolbarLabels(seriesFilterCount(), krSortOption(SERIES_SORTS, seriesSortKey).label,
			seriesSortDir);
	}

	function syncSeriesUrl() {
		if (!window.history || !window.history.replaceState) return;
		var params = new URLSearchParams();
		if (seriesTags.length) params.set('tag', seriesTags.join(','));
		var formats = SERIES_FORMATS.filter(function(f) {
			return seriesFormats[f.key];
		}).map(function(f) { return f.key; });
		if (formats.length) params.set('has', formats.join(','));
		krSortToUrl(params, SERIES_SORTS, seriesSortKey, seriesSortDir);
		var qs = params.toString();
		window.history.replaceState(null, '', qs ? '?' + qs : window.location.pathname);
	}

	function readSeriesUrl() {
		var params = new URLSearchParams(window.location.search);

		var known = {};
		allSeries.forEach(function(s) { s.tags.forEach(function(t) { known[t] = true; }); });
		seriesTags = krUrlList(params, 'tag').filter(function(t) { return known[t]; });

		var formatKeys = SERIES_FORMATS.map(function(f) { return f.key; });
		SERIES_FORMATS.forEach(function(f) { seriesFormats[f.key] = false; });
		krUrlList(params, 'has').forEach(function(k) {
			if (formatKeys.indexOf(k) !== -1) seriesFormats[k] = true;
		});

		var sort = krSortFromUrl(params, SERIES_SORTS);
		seriesSortKey = sort.key;
		seriesSortDir = sort.dir;
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
		var cover = krEscapeHtml('/' + (s.parts[0].image || DEFAULT_POST_IMAGE));
		var name = krEscapeHtml(s.name);
		// The cover is part one's image, so the live sketch is part one's too.
		var liveFrom = s.parts[0];
		var liveAttr = liveFrom ? ' data-live-href="' + krEscapeHtml(liveFrom.url) + '"' : '';
		// Site-absolute cover in --kr-cover: a relative url() in a custom
		// property resolves against the stylesheet, not this page.
		return '<div class="col-12 col-md-6 col-lg-4 mb-30 kr-glow-host" style="--kr-cover: url(\'' + cover + '\')">' +
			'<a href="' + seriesPageHref(s.name) + '" class="blog-card kr-lit"' + liveAttr + '>' +
			'<span class="kr-lit__ring" aria-hidden="true"></span>' +
			'<div class="blog-card-img"><img src="' + cover + '" alt="" loading="lazy">' +
			'<span class="kr-series-chip">' + s.parts.length +
			(s.parts.length === 1 ? ' part' : ' parts') + '</span></div>' +
			'<div class="blog-card-body">' +
			'<div class="blog-card-date">Updated ' + formatPostDate(s.updated) +
			' &middot; ' + s.minutes + ' min all told</div>' +
			// Straight under the page's h1 (the intro has no heading of its own),
			// so the series titles are h2s, as the blog listing's are.
			'<h2 class="blog-card-title">' + name + '</h2>' +
			'<p class="blog-card-excerpt">Latest: ' + krEscapeHtml(s.latest.title) + '</p>' +
			'</div></a></div>';
	}

	window.initSeriesIndex = initSeriesIndex;
})();
