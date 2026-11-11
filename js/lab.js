/**
 * lab.js: the Lab (lab.html), every interactive post in one grid.
 *
 * Purpose
 *   Draws the posts marked "interactive" in data/posts.json as the
 *   standard post cards, under a heading for each series and in part
 *   order, with every card's sketch playing while it is on screen. It
 *   has no search, filters or paging: the list is short and the reader
 *   came to see all of it.
 *
 * Loaded by
 *   lab.html, after js/shared-components.js, whose globals it calls
 *   (loadBlogPosts, seriesParts, postSeriesEntry, createBlogCardElement,
 *   krMarkNewPost, krLoadLiveCovers, krLoadFailed). The page's inline
 *   script then calls initLab().
 *
 * Exposes
 *   initLab()
 *
 * Design notes
 *   - A series gets a heading here when at least half its parts are
 *     interactive, so a run of demos is listed whole and in order while
 *     one demo inside a long prose series is not passed off as a series
 *     of them. Those, and demos in no series, close the page under
 *     "One-offs", newest first. A post in two such series is listed in
 *     both, as the series index does, each time under its own part.
 *   - The groups are full-width columns of one grid (#lab-grid), so the
 *     failure note and the hold on the empty grid work as they do on the
 *     other listings (style.css §09).
 *   - The grid carries data-live-play="view" in the markup, which is all
 *     js/live-covers.js needs to play each sketch while its cover is on
 *     screen. The sketch files are fetched here because that has to work
 *     on a phone, where the pointer that normally fetches them never
 *     comes.
 *   - .github/scripts/generate_listing_fallback.py writes the same groups
 *     into the page as a no-script list (lab_groups): change both.
 */
(function() {
	'use strict';

	function initLab() {
		var grid = document.getElementById('lab-grid');
		if (!grid) return;
		loadBlogPosts().then(function(posts) {
			if (!Array.isArray(posts)) return;
			var groups = labGroups(posts);
			if (!groups.length) return;
			grid.innerHTML = '';
			groups.forEach(function(group, i) { renderGroup(grid, group, i); });
			krLoadLiveCovers();
		}).catch(function(e) {
			console.error('Failed to load the Lab:', e);
			krLoadFailed(grid, 'The demos could not load just now, so here they are as a plain list.',
				krNoscriptMarkup(grid));
		});
	}

	/**
	 * The page's groups, in order: {name, parts} for each series that is
	 * at least half interactive (most demos first, then by name; parts in
	 * part order), then {name: null, parts} for the rest, newest first.
	 */
	function labGroups(posts) {
		var demos = posts.filter(function(p) { return !!p.interactive; });
		var names = {};
		demos.forEach(function(p) {
			postSeriesList(p).forEach(function(s) { if (s && s.name) names[s.name] = true; });
		});

		var groups = [];
		Object.keys(names).forEach(function(name) {
			var parts = seriesParts(posts, name);
			var live = parts.filter(function(p) { return !!p.interactive; });
			if (live.length * 2 >= parts.length) groups.push({ name: name, parts: live });
		});
		groups.sort(function(a, b) {
			return b.parts.length - a.parts.length || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
		});

		var placed = {};
		groups.forEach(function(g) { g.parts.forEach(function(p) { placed[p.url] = true; }); });
		var rest = demos.filter(function(p) { return !placed[p.url]; }).sort(function(a, b) {
			return (b.date || '').localeCompare(a.date || '');
		});
		if (rest.length) groups.push({ name: null, parts: rest });
		return groups;
	}

	/** A group's heading, then its cards, as columns of the grid. */
	function renderGroup(grid, group, index) {
		grid.appendChild(groupHead(group, index === 0));
		group.parts.forEach(function(post) {
			var col = createBlogCardElement(post);
			var chip = partLabel(post, group.name);
			var cover = col.querySelector('.blog-card-img');
			if (chip && cover) {
				var span = document.createElement('span');
				span.className = 'kr-series-chip';
				span.textContent = chip;
				cover.appendChild(span);
			}
			// Top right here (style.css §09): the part chip has the top left.
			krMarkNewPost(col, post);
			grid.appendChild(col);
		});
	}

	/** "Part 3" under a series' own heading; "Part 14 · <series>" for a one-off that sits in a prose series. */
	function partLabel(post, groupName) {
		var entry = groupName ? postSeriesEntry(post, groupName) : postSeriesList(post)[0];
		if (!entry || !entry.part) return '';
		return 'Part ' + entry.part + (groupName ? '' : ' · ' + entry.name);
	}

	/**
	 * The shared section heading (style.css §05), set left and small: the
	 * count as its eyebrow, the series name as an h2 that links to the
	 * series page. Built with textContent, so a name needs no escaping.
	 * Every group after the first stands a little further from the cards
	 * above it (.mt-30 on top of their own margin).
	 */
	function groupHead(group, first) {
		var n = group.parts.length;
		var col = document.createElement('div');
		col.className = 'col-12';
		var head = document.createElement('div');
		head.className = 'section-heading section-heading--sm section-heading--left section-heading--snug' +
			(first ? '' : ' mt-30');

		var eyebrow = document.createElement('span');
		eyebrow.className = 'section-eyebrow';
		eyebrow.textContent = n + (n === 1 ? ' demo' : ' demos') +
			(n === 1 ? '' : group.name ? ', in reading order' : ', newest first');
		head.appendChild(eyebrow);

		var h2 = document.createElement('h2');
		if (group.name) {
			var a = document.createElement('a');
			a.className = 'kr-heading-link';
			a.href = seriesPageHref(group.name);
			a.textContent = group.name;
			h2.appendChild(a);
		} else {
			h2.textContent = 'One-offs';
		}
		head.appendChild(h2);

		col.appendChild(head);
		return col;
	}

	window.initLab = initLab;
})();
