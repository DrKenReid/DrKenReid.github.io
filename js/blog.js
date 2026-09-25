/**
 * Blog listing (blog.html): search, the series shelf, a faceted filter
 * panel, sorting and pagination, all over data/posts.json.
 *
 * STATE MODEL
 *   Everything a reader can change is one of the variables at the top of
 *   the closure below: searchQuery, activeTags, activeLengths, facetStates,
 *   seriesMode, activeSeries, sortKey/sortDir and currentPage. Controls
 *   never keep state of their own that the list reads back; each click
 *   changes a variable, then the same three steps follow: resync the
 *   controls that depend on it, syncUrl(), renderPosts(). renderPosts()
 *   draws the grid from state alone, so any mix of controls and a deep
 *   link produce the same page.
 *
 *   The groups combine as the panel reads: buttons within a group are
 *   OR'd, the groups are AND'd, search narrows further. A named series
 *   (the shelf) replaces the sort with part order, and it cannot coexist
 *   with "Standalone", so choosing either one releases the other.
 *
 * URL KEYS (syncUrl writes them, readStateFromUrl reads them back)
 *   q       search text                     ?q=annealing
 *   tag     topics, comma-separated         ?tag=books,ai
 *   len     LENGTH_BUCKETS keys             ?len=short,long
 *   only    TRI_FACETS keys to require      ?only=interactive
 *   not     TRI_FACETS keys to exclude      ?not=code
 *   in      'series' or 'standalone'        ?in=standalone
 *   series  a series name as in posts.json  ?series=Algorithms%2C%20Live
 *   sort    SORT_OPTIONS key                ?sort=title
 *   dir     'asc' or 'desc'                 ?dir=asc
 *   page    1-based page number             ?page=3
 *   A key at its default is left out, so the unfiltered listing is plain
 *   /blog.html. series.html uses tag, has, sort and dir the same way.
 *
 * VALIDATION
 *   Every value read from the URL is checked against what the corpus
 *   offers today (a tag some post carries, a bucket, facet or sort that
 *   exists, a series with at least one part). Anything else is dropped
 *   rather than obeyed, so a stale or hand-edited link opens a wider list,
 *   never an empty one. ?len=quick, say, is ignored: the key is 'short'.
 *   Once the first render has clamped the page number, syncUrl() writes
 *   what was kept back to the address bar, so a link copied from it is
 *   always one the page understands.
 *
 * WHY replaceState
 *   The query string is there so a narrowed list survives a reload and
 *   can be bookmarked or shared, not to make each click a step in the
 *   history. With four filter groups a pushState per click buried the
 *   page the reader came from under a stack of near-identical URLs, and
 *   Back stopped meaning "leave the blog".
 *
 * LENGTH_BUCKETS
 *   Reading-time bands for the Length group, read from posts.json's
 *   readMinutes (generate_read_times.py, 220 words a minute). The edges
 *   follow the corpus rather than round numbers; see the constant.
 *
 * FOCUS
 *   A control the reader presses keeps focus: the sort buttons are updated
 *   in place (krSortPanel), filter buttons resync rather than rebuild, and
 *   the two controls that do vanish hand focus on (Clear all filters to
 *   the Filter toggle, a page button to the result count, see
 *   krRenderListPagination).
 *
 * GLOBALS
 *   Only initBlog(), which blog.html calls once shared-components.js has
 *   loaded. The rest is private to the closure. It leans on these from
 *   shared-components.js: loadBlogPosts, krFetchJson, createBlogCardElement,
 *   krInitTogglePanels, krBuildListSearchBox,
 *   krUpdateSearchCounter, krRenderListPagination, krParsePostDate,
 *   postSeriesList, postSeriesEntry, krSnapRowArrows, krEscapeHtml,
 *   DEFAULT_POST_IMAGE, and the panel parts krFacetRow, krFacetButton,
 *   krCountLabel, krSetPressed, krClearRow, krTagFacetRow, krSortPanel,
 *   krSortOption, krSortFromUrl, krSortToUrl, krToolbarLabels and
 *   krUrlList, which series-index.js shares.
 */
(function() {
	'use strict';

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
	var tagFilterBar = null;
	var clearRow = null;        // krClearRow handle for the current panel
	var sortPanel = null;       // krSortPanel handle, built once
	var toolbar = null;         // krInitTogglePanels handle

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

	var SORT_OPTIONS = [
		{ key: 'date', label: 'Date', defaultDir: -1 },
		{ key: 'popularity', label: 'Popularity', defaultDir: -1 },
		{ key: 'title', label: 'Title', defaultDir: 1 },
		{ key: 'minutes', label: 'Read time', defaultDir: -1 }
	];

	// Variable column widths matching the template's alternating masonry
	// pattern. Groups of 9 fill 3 rows: large-small-small / small-small-large /
	// small-large-small. Which tile reads as a lead (a Lora title) is decided
	// in CSS by the tile's own width, not by these classes, so the lead
	// treatment follows the tile at every breakpoint.
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

	function initBlog() {
		// aria-busy until the first draw: an empty grid is "still loading",
		// not "no posts", to assistive technology, and "false" is the one
		// signal that the listing has drawn whatever the filters leave (the
		// count stays empty on an unfiltered list), so tests wait on it.
		var grid = document.getElementById('blog-grid');
		if (grid) grid.setAttribute('aria-busy', 'true');
		// The same request the header and footer use (loadBlogPosts memoises it),
		// and a copy before sorting, because every caller shares the one array.
		loadBlogPosts()
			.then(function(data) {
				allPosts = data.slice().sort(function(a, b) {
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
				if (activeFilterCount() || activeSeries) toolbar.open('blog-filters');
				renderPosts();
				// Write the validated state back once, after renderPosts has
				// clamped the page, so the address bar never shows a filter
				// that was dropped (see VALIDATION) or a page past the end.
				syncUrl();
				krFetchJson('data/popular.json').then(function(pop) {
					(Array.isArray(pop) ? pop : []).forEach(function(e) { popularViews[e.url] = e.views; });
					if (sortKey === 'popularity') renderPosts();
				}).catch(function() {});
			})
			.catch(function(e) {
				console.error('Failed to load posts:', e);
				if (grid) grid.setAttribute('aria-busy', 'false');
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

	/* ------------------------------------------------------------ the URL */

	/** Writes the current state into the query string (see WHY replaceState above). */
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

		krSortToUrl(params, SORT_OPTIONS, sortKey, sortDir);
		if (currentPage > 1) params.set('page', String(currentPage));

		var qs = params.toString();
		window.history.replaceState(null, '', qs ? '?' + qs : window.location.pathname);
	}

	/**
	 * Restores state from the query string, keeping only values the corpus
	 * offers (see VALIDATION above). Returns the page to open on.
	 */
	function readStateFromUrl() {
		var params = new URLSearchParams(window.location.search);

		var known = {};
		allPosts.forEach(function(p) {
			(p.tags || []).forEach(function(t) { known[t] = true; });
		});
		activeTags = krUrlList(params, 'tag').filter(function(t) { return known[t]; });

		var lengths = LENGTH_BUCKETS.map(function(b) { return b.key; });
		activeLengths = krUrlList(params, 'len').filter(function(k) {
			return lengths.indexOf(k) !== -1;
		});

		var facets = TRI_FACETS.map(function(f) { return f.key; });
		TRI_FACETS.forEach(function(f) { facetStates[f.key] = ''; });
		krUrlList(params, 'only').forEach(function(k) {
			if (facets.indexOf(k) !== -1) facetStates[k] = 'only';
		});
		krUrlList(params, 'not').forEach(function(k) {
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

		var sort = krSortFromUrl(params, SORT_OPTIONS);
		sortKey = sort.key;
		sortDir = sort.dir;

		var page = parseInt(params.get('page'), 10);
		return page > 1 ? page : 1;
	}

	/* ------------------------------------------------------ series shelf */

	/**
	 * One pill per series, most recently updated first, in a single row that
	 * scrolls sideways (.kr-snap-row) at every width. It used to wrap, which
	 * made it two rows at desktop and five on a phone, and pushed the first
	 * post below the fold. The label sits outside the scroller so it stays
	 * put while the pills move. CSS reserves the shelf's height before this
	 * runs (see "Series shelf" in style.css §09), so filling it moves
	 * nothing on the page. Seven pills need more than a desktop row, so
	 * krSnapRowArrows gives a mouse a way along it.
	 */
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
		if (!names.length) { shelf.hidden = true; return; }

		// Most recently updated series first (dates are YYYY-MM-DD, so string
		// comparison is chronological)
		function latestDate(name) {
			return series[name].reduce(function(m, p) {
				return p.date > m ? p.date : m;
			}, '');
		}
		names.sort(function(a, b) { return latestDate(b).localeCompare(latestDate(a)); });

		var pills = names.map(function(name) {
			var parts = series[name].slice().sort(function(a, b) {
				return postSeriesEntry(a, name).part - postSeriesEntry(b, name).part;
			});
			var cover = parts[0].image || DEFAULT_POST_IMAGE;
			return '<button type="button" class="kr-series-card" data-series="' + krEscapeHtml(name) + '" aria-pressed="false">' +
				'<img src="' + krEscapeHtml(cover) + '" alt="" width="38" height="38" loading="lazy">' +
				'<span class="kr-series-card__text"><strong>' + krEscapeHtml(name) + '</strong>' +
				'<span>' + parts.length + ' part' + (parts.length === 1 ? '' : 's') + '</span></span>' +
				'</button>';
		}).join('');
		shelf.innerHTML =
			'<span class="kr-series-shelf__label">Recent <a href="/series.html" title="All series">Series</a>:</span>' +
			'<div class="kr-series-shelf__row kr-snap-row">' + pills + '</div>';
		krSnapRowArrows(shelf.querySelector('.kr-snap-row'));

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
			syncSortPanel();
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
			krSetPressed(c, on);
			if (on) revealPill(c);
		});
	}

	/**
	 * Scrolls the shelf's row, and only the row, so a pressed pill is in
	 * sight: a deep link to a series far along the row would otherwise open
	 * with its pill hidden. Not scrollIntoView, which also scrolls the page
	 * and would yank a reader restored halfway down back up to the shelf.
	 */
	function revealPill(pill) {
		var row = pill.parentNode;
		if (!row || row.scrollWidth <= row.clientWidth) return;
		var r = row.getBoundingClientRect(), p = pill.getBoundingClientRect();
		if (p.left >= r.left && p.right <= r.right) return;
		row.scrollLeft += p.left - r.left - (r.width - p.width) / 2;
	}

	function clearSeriesShelf() {
		activeSeries = '';
		syncSeriesShelf();
		syncSortPanel();
	}

	/* ------------------------------------------------------ filter panel */

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

		buildTagFilters(krFacetRow(container, 'Topic', 'Filter posts by topic'));
		buildLengthFilters(krFacetRow(container, 'Length', 'Filter posts by reading time'));
		buildFormatFilters(krFacetRow(container, 'Format', 'Filter posts by format'));
		buildSeriesFilters(krFacetRow(container, 'Series', 'Filter posts by series membership'));
		clearRow = krClearRow(container, clearAllFilters);
		syncClearRow();
	}

	function buildTagFilters(holder) {
		if (!holder) return;
		tagFilterBar = krTagFacetRow(holder, allPosts, function(p) { return p.tags; }, {
			active: activeTags,
			onChange: function(activeKeys) {
				activeTags = activeKeys;
				onFilterChange();
			}
		});
	}

	function buildLengthFilters(holder) {
		if (!holder) return;
		LENGTH_BUCKETS.forEach(function(bucket) {
			var count = allPosts.filter(function(p) {
				return postLengthKey(p) === bucket.key;
			}).length;
			var btn = krFacetButton(holder, krCountLabel(bucket.label, count), function() {
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
		holder.querySelectorAll('button[data-length-key]').forEach(function(btn) {
			krSetPressed(btn, activeLengths.indexOf(btn.getAttribute('data-length-key')) !== -1);
		});
	}

	function buildFormatFilters(holder) {
		if (!holder) return;
		TRI_FACETS.forEach(function(facet) {
			facetStates[facet.key] = facetStates[facet.key] || '';
			var count = allPosts.filter(function(p) { return !!p[facet.key]; }).length;
			var btn = krFacetButton(holder, krCountLabel(facet.label, count), function() {
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
		btn.innerHTML = mark + krCountLabel(facet.label, count);
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
			var btn = krFacetButton(holder, krCountLabel(mode.label, count), function() {
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
		holder.querySelectorAll('button[data-series-mode]').forEach(function(btn) {
			krSetPressed(btn, seriesMode === btn.getAttribute('data-series-mode'));
		});
	}

	function syncClearRow() {
		if (clearRow) clearRow.sync(activeFilterCount());
	}

	/** Every filter off. krClearRow then hands focus to the Filter toggle. */
	function clearAllFilters() {
		activeTags = [];
		activeLengths = [];
		seriesMode = '';
		TRI_FACETS.forEach(function(f) { facetStates[f.key] = ''; });
		if (activeSeries) clearSeriesShelf();
		buildFilterPanel();
		onFilterChange();
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

	/* -------------------------------------------------------------- sort */

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

	// A series is always listed in part order, so the sort choice is inert
	// there. Say so rather than showing a setting that is not being applied.
	var SERIES_SORT_LOCK = 'Posts in a series are listed in part order';

	function updateToolbarLabels() {
		krToolbarLabels(activeFilterCount(),
			activeSeries ? 'Part order' : krSortOption(SORT_OPTIONS, sortKey).label,
			sortDir, activeSeries ? SERIES_SORT_LOCK : '');
	}

	/** Built once; syncSortPanel() redraws it in place after any state change. */
	function buildSortPanel() {
		var panel = document.getElementById('blog-sort');
		if (!panel) return;
		sortPanel = krSortPanel(panel, {
			options: SORT_OPTIONS,
			ariaLabel: 'Sort posts',
			state: function() {
				return {
					key: sortKey,
					dir: sortDir,
					lockedBecause: activeSeries ? SERIES_SORT_LOCK : ''
				};
			},
			onChange: function(key, dir) {
				sortKey = key;
				sortDir = dir;
				currentPage = 1;
				updateToolbarLabels();
				syncUrl();
				renderPosts();
			}
		});
	}

	function syncSortPanel() {
		if (sortPanel) sortPanel.sync();
	}

	function initToolbar() {
		// The series shelf is a filtering control too, so clicking it counts as
		// inside the panel rather than as a dismissing click elsewhere.
		toolbar = krInitTogglePanels([
			['kr-filter-toggle', 'blog-filters'],
			['kr-sort-toggle', 'blog-sort']
		], '#series-shelf');
		updateToolbarLabels();
	}

	/* ------------------------------------------------------------ render */

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
		container.innerHTML = '';
		container.setAttribute('aria-busy', 'false');

		var filtered = getFilteredPosts();
		var totalPages = Math.ceil(filtered.length / POSTS_PER_PAGE);
		if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

		var start = (currentPage - 1) * POSTS_PER_PAGE;
		var pagePosts = filtered.slice(start, start + POSTS_PER_PAGE);

		if (filtered.length === 0) {
			container.innerHTML = '<div class="col-12 text-center"><p class="kr-muted">No posts found.</p></div>';
			krRenderListPagination(0, 0, setBlogPage);
			updateBlogCounter(0, filtered.length);
			return;
		}

		pagePosts.forEach(function(post, i) {
			// The cards sit straight under the page's h1, so their titles are h2s.
			var col = createBlogCardElement(post, {
				cardStyle: 'overlay',
				colClass: columnClassFor(i, pagePosts.length),
				headingLevel: 2
			});
			addExcerpt(col, post);
			addSeriesChip(col, post);
			container.appendChild(col);
		});

		updateBlogCounter(filtered.length, allPosts.length);
		krRenderListPagination(currentPage, totalPages, setBlogPage);

		// Every card runs its post's own sketch on hover: js/live-covers.js
		// binds new cards by itself, and skips any post without one.
	}

	/**
	 * The post's one-line summary from posts.json, straight after the title
	 * so it is heard second. Every card gets it and CSS decides where it
	 * shows: only on a tile wide enough to be a lead (see "Overlay cards
	 * on the listing" in style.css §09). On a quarter-width tile there is
	 * no room beside the photograph, and there it is display: none, so it is
	 * not read out either. The overlay builder in shared-components.js emits
	 * no excerpt of its own, which is why it is added here.
	 */
	function addExcerpt(col, post) {
		var title = col.querySelector('.post-title');
		if (!post.excerpt || !title) return;
		var p = document.createElement('p');
		p.className = 'kr-card-excerpt';
		p.textContent = post.excerpt;
		title.insertAdjacentElement('afterend', p);
	}

	/**
	 * "Part 3 · Everyday Ethics" on a card whose post belongs to a series (the
	 * shelf's series when one is chosen, else the post's first).
	 *
	 * It goes in the card's text block, above the date, rather than on the
	 * photograph's corner where the series pages put theirs: the corner
	 * opposite is the topic chip, and with the series named in full the two
	 * collided on every quarter-width tile. The text block also sits above
	 * a running hover sketch, so the chip stays readable while one plays.
	 * It follows the title in source order, so the title is still heard first.
	 */
	function addSeriesChip(col, post) {
		var entry = activeSeries ? postSeriesEntry(post, activeSeries) : postSeriesList(post)[0];
		var content = col.querySelector('.post-content');
		if (!entry || !entry.name || !content) return;
		var chip = document.createElement('span');
		chip.className = 'kr-series-chip kr-series-chip--kicker';
		chip.textContent = 'Part ' + entry.part + ' · ' + entry.name;
		content.appendChild(chip);
	}

	function columnClassFor(index, pageCount) {
		var short = SHORT_PAGE_COLUMNS[pageCount];
		return short ? short[index] : MASONRY_COLUMNS[index % 9];
	}

	function setBlogPage(page) {
		currentPage = page;
		syncUrl();
		renderPosts();
	}

	function updateBlogCounter(filtered, total) {
		krUpdateSearchCounter(filtered, total, 'posts',
			!searchQuery && !activeSeries && activeFilterCount() === 0);
	}

	window.initBlog = initBlog;
})();
