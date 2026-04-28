# Blog Component Templates

A reference for reusable HTML patterns used across the blog.
CSS for all components lives in `style.css`.

---

## 1. Post Figure (photo + caption + copyright)

```html
<figure>
  <img src="../img/bg-img/XXX.png" alt="Description" loading="lazy"
       style="width:100%; border-radius:8px;">
  <p class="figure-note">
    <span class="figure-copyright">&copy; Ken Reid</span>
    Caption text goes here.
  </p>
</figure>
```

**CSS classes:** `figure-note`, `figure-copyright`
**Notes:** Copyright line renders grey and small above the caption. All bg-img photos are Ken's except `kwee.jpg`, `chaos.jpg`, `yoyo.JPG`, `nila.jpg` (cat photos). Book covers and third-party art are exempt.

---

## 2. FAQ / Expandable Q&A Section

```html
<div class="faq-section">
  <h2>Common questions</h2>

  <details class="faq-item">
    <summary>Question goes here?</summary>
    <p>Answer goes here.</p>
  </details>

  <details class="faq-item">
    <summary>Another question?</summary>
    <p>Another answer.</p>
  </details>
</div>
```

**CSS classes:** `faq-section`, `faq-item`
**Notes:** Uses native `<details>`/`<summary>` — no JS needed. Renders with a warm tint background.

---

## 3. Vertical Timeline

```html
<ul class="blog-timeline">
  <li>
    <span class="tl-year">2012&ndash;2014</span>
    <span class="tl-dot"></span>
    <span class="tl-body">Event description goes here.</span>
  </li>
  <li>
    <span class="tl-year">2015</span>
    <span class="tl-dot"></span>
    <span class="tl-body">Another event.</span>
  </li>
</ul>
```

**CSS classes:** `blog-timeline`, `tl-year`, `tl-dot`, `tl-body`
**Notes:** Good for chronological narratives, author histories, project timelines.

---

## 4. Book / Media Cover Grid (2×2)

```html
<div class="book-cover-grid">

  <div style="width:100%;">
    <img src="img/book-title.jpg" alt="Book Title cover" loading="lazy"
         style="width:100%; border-radius:4px; box-shadow:0 4px 12px rgba(0,0,0,0.15);">
    <p style="margin:10px 0 3px; font-weight:600; font-size:14px;">Book Title</p>
    <p style="margin:0 0 8px; font-size:12px; color:#636363;">Year &middot; Subtitle</p>
    <p style="margin:0; font-size:13px; line-height:1.7;">Short description of the book.</p>
  </div>

  <!-- Repeat for each book (4 total for 2×2 layout) -->

</div>
```

**CSS class:** `book-cover-grid`
**Notes:** 2×2 responsive grid. Images go in `blog/img/`. Works for any media (films, albums, etc.).

---

## 5. Glossary / Plain English Box

```html
<div class="plain-english-box">
  <h2>A quick glossary</h2>
  <ul>
    <li><strong>Term:</strong> Definition goes here.</li>
    <li><strong>Another term:</strong> Another definition.</li>
  </ul>
</div>
```

**CSS class:** `plain-english-box`
**Notes:** Used for jargon explanations, dialect glossaries, domain-specific terms. Renders with a light box background. Used in Scotland post (Scots dialect) and No Idea post (data science jargon).

---

## 6. Blockquote

```html
<blockquote>
  <p>Quote text goes here.</p>
  <cite>&mdash; Attribution, <em>Source</em></cite>
</blockquote>
```

**Notes:** Standard HTML blockquote, styled in `style.css` with left border and italic text.

---

## 7. Section Heading with Top Border

```html
<h2 class="section-heading">Section Title</h2>
```

**CSS class:** `section-heading`
**Notes:** Adds a top border rule above the heading for visual separation between major sections.

---

## 8. Internal Link (prose-level)

Link to another page naturally within paragraph text:

```html
<a href="../data_science.html">my data science work</a>
<a href="in-defense-of-audiobooks.html">my post on audiobooks</a>
```

**Notes:** No special class needed — blog post link underline styles are handled globally in `style.css`.

---

## Posts Data Entry (`js/posts-data.js`)

Every published post needs an entry at the top of `BLOG_POSTS`:

```js
{
  title: "Post Title Here",
  date: "2026-04-23",
  excerpt: "One or two sentence summary. Should be compelling and complete.",
  url: "blog/filename-here.html",
  image: "img/bg-img/XXX.png",
  tags: ["tag-one", "tag-two"]
},
```

**Notes:**
- `image` is the thumbnail shown on the blog listing page
- `tags` drive the filter buttons — keep consistent (e.g. `books`, `data-science`, `personal`, `ai`, `coding`, `productivity`)
- Do NOT add unpublished posts here until Ken confirms push
