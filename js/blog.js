var allPosts = [];
var activeTags = [];
var searchQuery = '';
var currentPage = 1;
var POSTS_PER_PAGE = 9;
var DEFAULT_POST_IMAGE = 'img/bg-img/2.png';

function loadPosts() {
	if (window.BLOG_POSTS && window.BLOG_POSTS.length) {
		return Promise.resolve(window.BLOG_POSTS.slice());
	}
	return fetch('data/posts.json').then(function(r) { return r.json(); });
}

function initBlog() {
	loadPosts()
		.then(function(data) {
			allPosts = data.sort(function(a, b) {
				return new Date(b.date) - new Date(a.date);
			});
			return hydrateReadingTimes(allPosts);
		})
		.then(function() {
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

	pagePosts.forEach(function(post) {
		var dateStr = new Date(post.date).toLocaleDateString('en-GB', {
			day: 'numeric', month: 'long', year: 'numeric'
		});

		var col = typeof window.createBlogCardElement === 'function'
			? window.createBlogCardElement(post, {
				href: post.url,
				imageSrc: post.image || DEFAULT_POST_IMAGE,
				fallbackImage: DEFAULT_POST_IMAGE,
				dateStr: dateStr,
				showReadTime: true
			})
			: (function() {
				var fallbackCol = document.createElement('div');
				fallbackCol.className = 'col-12 col-md-6 col-lg-4 mb-30';
				return fallbackCol;
			})();

		container.appendChild(col);
	});

	updateCounter(filtered.length, allPosts.length);
	renderPagination(currentPage, totalPages);
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

// ---- Reading time helpers (unchanged) ----

function estimateReadingMinutes(post) {
	if (typeof post.readMinutes === 'number' && isFinite(post.readMinutes)) return Math.max(1, Math.round(post.readMinutes));
	if (typeof post._readMinutes === 'number' && isFinite(post._readMinutes)) return Math.max(1, Math.round(post._readMinutes));
	var text = (post.title || '') + ' ' + (post.excerpt || '');
	return Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 220));
}

function wordsToMinutes(wordCount) { return Math.max(1, Math.ceil(wordCount / 220)); }

function countWords(text) {
	if (!text) return 0;
	var normalized = text.replace(/\s+/g, ' ').trim();
	return normalized ? normalized.split(' ').length : 0;
}

function extractPostWordCount(htmlText) {
	var parser = new DOMParser();
	var doc = parser.parseFromString(htmlText, 'text/html');
	var postBody = doc.querySelector('.blog-post');
	if (!postBody) return 0;
	return countWords(postBody.textContent || '');
}

function hydrateReadingTimes(posts) {
	var tasks = posts.map(function(post) {
		if (!post || !post.url) return Promise.resolve();
		return fetch(post.url)
			.then(function(r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
			.then(function(html) {
				var wc = extractPostWordCount(html);
				if (wc > 0) post._readMinutes = wordsToMinutes(wc);
			})
			.catch(function() {});
	});
	return Promise.all(tasks).then(function() { return posts; });
}
