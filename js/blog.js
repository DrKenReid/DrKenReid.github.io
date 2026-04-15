var allPosts = [];
var activeTag = 'all';
var DEFAULT_POST_IMAGE = 'img/bg-img/2.png';

function initBlog() {
	fetch('data/posts.json')
		.then(function(r) { return r.json(); })
		.then(function(data) {
			allPosts = data.sort(function(a, b) {
				return new Date(b.date) - new Date(a.date);
			});
			buildTagFilters();
			renderPosts();
		})
		.catch(function(e) {
			console.error('Failed to load posts:', e);
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
	allBtn.onclick = function() { filterByTag('all', this); };
	container.appendChild(allBtn);

	var tags = Object.keys(counts).sort(function(a, b) {
		return counts[b] - counts[a];
	});

	tags.forEach(function(tag) {
		var btn = document.createElement('button');
		btn.className = 'btn gallery-filter-btn';
		btn.setAttribute('data-tag', tag);
		btn.textContent = tag + ' (' + counts[tag] + ')';
		btn.onclick = function() { filterByTag(tag, this); };
		container.appendChild(btn);
	});
}

function filterByTag(tag, btnEl) {
	activeTag = tag;
	var buttons = document.querySelectorAll('.gallery-filter-btn');
	buttons.forEach(function(b) {
		b.classList.remove('active');
	});
	btnEl.classList.add('active');
	renderPosts();
}

function estimateReadingMinutes(post) {
	var text = (post.title || '') + ' ' + (post.excerpt || '');
	var words = text.trim() ? text.trim().split(/\s+/).length : 0;
	var minutes = Math.max(1, Math.ceil(words / 220));
	return minutes;
}

function renderPosts() {
	var container = document.getElementById('blog-grid');
	if (!container) return;
	container.innerHTML = '';

	var filtered = activeTag === 'all'
		? allPosts
		: allPosts.filter(function(p) { return (p.tags || []).indexOf(activeTag) !== -1; });

	if (filtered.length === 0) {
		container.innerHTML = '<div class="col-12 text-center"><p style="color: #636363;">No posts found.</p></div>';
		return;
	}

	filtered.forEach(function(post) {
		var col = document.createElement('div');
		col.className = 'col-12 col-md-6 col-lg-4 mb-30';

		var tagHtml = (post.tags || []).map(function(t) {
			return '<span class="blog-tag">' + t + '</span>';
		}).join(' ');

		var dateStr = new Date(post.date).toLocaleDateString('en-GB', {
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});

		var readTime = estimateReadingMinutes(post);
		var imageSrc = post.image || DEFAULT_POST_IMAGE;

		var card = document.createElement('a');
		card.href = post.url;
		card.className = 'blog-card';
		card.innerHTML =
			'<div class="blog-card-img"><img src="' + imageSrc + '" alt="' + post.title + '" loading="lazy" onerror="this.onerror=null;this.src=\'' + DEFAULT_POST_IMAGE + '\';"></div>' +
			'<div class="blog-card-body">' +
			'<div class="blog-card-date">' + dateStr + ' · ' + readTime + ' min read</div>' +
			'<h4 class="blog-card-title">' + post.title + '</h4>' +
			'<p class="blog-card-excerpt">' + (post.excerpt || '') + '</p>' +
			'<div class="blog-card-tags">' + tagHtml + '</div>' +
			'</div>';

		col.appendChild(card);
		container.appendChild(col);
	});

	var counter = document.getElementById('blog-counter');
	if (counter) {
		counter.textContent = filtered.length + ' post' + (filtered.length !== 1 ? 's' : '');
	}
}