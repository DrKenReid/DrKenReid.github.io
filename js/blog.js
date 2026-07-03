var allPosts = [];
var activeTags = [];
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
	return fetch('data/posts.json').then(function(r) { return r.json(); });
}

function initBlog() {
	loadPosts()
		.then(function(data) {
			allPosts = data.sort(function(a, b) {
				return parsePostDate(b.date) - parsePostDate(a.date);
			});
			buildSearchBox();
			buildTagFilters();
			renderPosts();
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
	input.addEventListener('focus', function() { this.style.borderColor = '#fc6060'; });
	input.addEventListener('blur', function() { this.style.borderColor = '#ddd'; });
	input.addEventListener('input', function() {
		searchQuery = this.value.toLowerCase().trim();
		currentPage = 1;
		renderPosts();
	});
}

function buildTagFilters() {
	var container = document.getElementById('blog-filters');
	if (!container) return;

	var counts = {};
	allPosts.forEach(function(p) {
		(p.tags || []).forEach(function(t) {
			counts[t] = (counts[t] || 0) + 1;
		});
	});

	var allBtn = document.createElement('button');
	allBtn.className = 'btn gallery-filter-btn active';
	allBtn.setAttribute('data-tag', 'all');
	allBtn.textContent = 'All (' + allPosts.length + ')';
	allBtn.onclick = function() { toggleTag('all', this); };
	container.appendChild(allBtn);

	var tags = Object.keys(counts).sort(function(a, b) {
		return counts[b] - counts[a];
	});

	tags.forEach(function(tag) {
		var btn = document.createElement('button');
		btn.className = 'btn gallery-filter-btn';
		btn.setAttribute('data-tag', tag);
		btn.textContent = tag + ' (' + counts[tag] + ')';
		btn.onclick = function() { toggleTag(tag, this); };
		container.appendChild(btn);
	});
}

function toggleTag(tag, btnEl) {
	if (tag === 'all') {
		activeTags = [];
		document.querySelectorAll('.gallery-filter-btn').forEach(function(b) {
			b.classList.remove('active');
		});
		btnEl.classList.add('active');
	} else {
		// Deactivate "All" button
		var allBtn = document.querySelector('.gallery-filter-btn[data-tag="all"]');
		if (allBtn) allBtn.classList.remove('active');

		var idx = activeTags.indexOf(tag);
		if (idx !== -1) {
			activeTags.splice(idx, 1);
			btnEl.classList.remove('active');
		} else {
			activeTags.push(tag);
			btnEl.classList.add('active');
		}

		// If nothing selected, revert to All
		if (activeTags.length === 0) {
			if (allBtn) allBtn.classList.add('active');
		}
	}

	currentPage = 1;
	renderPosts();
}

function getFilteredPosts() {
	return allPosts.filter(function(p) {
		var matchesTag = activeTags.length === 0
			|| activeTags.some(function(t) { return (p.tags || []).indexOf(t) !== -1; });

		var matchesSearch = !searchQuery
			|| (p.title || '').toLowerCase().indexOf(searchQuery) !== -1
			|| (p.excerpt || '').toLowerCase().indexOf(searchQuery) !== -1
			|| (p.tags || []).some(function(t) { return t.toLowerCase().indexOf(searchQuery) !== -1; });

		return matchesTag && matchesSearch;
	});
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
