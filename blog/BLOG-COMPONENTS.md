# Blog Component Templates

A reference for reusable HTML patterns used across the blog.
CSS for all components lives in `style.css`.

---

## 1. Post Figure (photo + caption + copyright)

```html
<figure>
  <img src="../img/bg-img/XXX.png" alt="Description" loading="lazy"
       style="width:100%; border-radius:8px;">
  <figcaption class="figure-note">
    <span class="figure-copyright">&copy; Ken Reid. All rights reserved.</span>
    Caption text goes here.
  </figcaption>
</figure>
```

**CSS classes:** `figure-note`, `figure-copyright`
**Notes:** Use `<figcaption>` for semantic captioning. Copyright line renders grey and small above the caption. If a figure should show copyright only, omit the caption text and leave just the span inside `figure-note`. All bg-img photos are Ken's except `kwee.jpg`, `chaos.jpg`, `yoyo.JPG`, `nila.jpg` (cat photos). Book covers and third-party art are exempt.

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
**Notes:** Uses native `<details>`/`<summary>` — no JS needed. Renders with a warm tint background. Keep summary text plain (do not nest heading tags inside `<summary>`).

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

**Notes:** Standard HTML blockquote, styled in `style.css` with left border and italic text. In book sections wrapped by `.bsec`, blockquotes are globally cleared (`clear: both`) so quote text never overlaps floated `.book-cover` images.

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
<a href="https://example.com" target="_blank" rel="noopener noreferrer">external source</a>
```

**Notes:** No special class needed — blog post link underline styles are handled globally in `style.css`. For new-tab links, always include `rel="noopener noreferrer"`.

---

## 9. Audio Callout Card

```html
<div style="margin: 24px 0; padding: 18px 20px; background: #1a1a1a; border-left: 3px solid #fc6060; border-radius: 6px; display: flex; flex-direction: column; gap: 10px;">
  <span style="font-family: monospace; font-size: 0.8em; color: #fc6060; letter-spacing: 0.08em; text-transform: uppercase;">&#9654; Label text</span>
  <audio controls style="width: 100%; max-width: 460px; accent-color: #fc6060; display: block; margin: 0 auto;">
    <source src="AUDIO_URL_HERE" type="audio/mpeg">
    Your browser does not support the audio element.
  </audio>
  <p style="margin: 0; font-size: 0.85em; color: #c7c7c7; text-align: center;">
    Add a transcript or concise summary below the player.
  </p>
</div>
```

**Notes:** This is the current post pattern. Keep card, accent color, and centered audio element consistent. Always include a transcript or concise summary for non-audio users.

---

## 10. YouTube Embed (Responsive 16:9)

```html
<figure style="margin: 24px auto; display: flex; flex-direction: column; align-items: center; text-align: center;">
  <div style="position: relative; width: 100%; max-width: 560px; aspect-ratio: 16/9;">
    <iframe src="https://www.youtube.com/embed/VIDEO_ID"
            title="Video title"
          loading="lazy"
          referrerpolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 4px;"></iframe>
  </div>
  <figcaption style="margin-top: 8px; font-size: 0.8em; max-width: 560px;">
    Caption and context.
  </figcaption>
</figure>
```

**Notes:** Use embed URLs (`/embed/VIDEO_ID`), not watch URLs. Prefer figure+caption for context.

---

## 11. Instagram Embed (Captioned)

```html
<figure style="margin: 32px auto; display: flex; flex-direction: column; align-items: center; text-align: center;">
  <blockquote class="instagram-media"
              data-instgrm-captioned
              data-instgrm-permalink="https://www.instagram.com/p/POST_ID/"
              data-instgrm-version="14"
              style="background: #fff; border: 0; border-radius: 3px; box-shadow: 0 0 1px 0 rgba(0,0,0,0.5), 0 1px 10px 0 rgba(0,0,0,0.15); margin: 1px auto; max-width: 540px; min-width: 326px; padding: 0; width: calc(100% - 2px);">
    <a href="https://www.instagram.com/p/POST_ID/" target="_blank" rel="noopener noreferrer">View this post on Instagram</a>
  </blockquote>
  <figcaption style="margin-top: 8px; font-size: 0.8em; max-width: 540px;">
    Context caption.
  </figcaption>
</figure>
```

**Notes:** Requires this script near page bottom:

```html
<script async src="https://www.instagram.com/embed.js"></script>
```

---

## 12. Jargon Term Tooltip

For technical or domain-specific terms, definitions are now pulled dynamically from the page glossary/jargon box and applied across the article.

```html
<div class="plain-english-box">
  <h2>Quick jargon guide</h2>
  <ul>
    <li><strong>CVD (colour vision deficiency):</strong> Definition here.</li>
    <li><strong>Redundant coding:</strong> Definition here.</li>
  </ul>
</div>
```

**CSS class:** glossary source uses `plain-english-box`; tooltip styling is automatic
**Styling:** Matching jargon terms in `.blog-post` are wrapped with styled hover tooltips using definitions extracted from the glossary list. Dark theme compatible.

**Example:**

```html
<p>The redundant coding principle forces better design decisions.</p>
```

**Notes:** 
- No additional CSS needed — tooltip styles are globally defined in `style.css`.
- No manual `<abbr>` wrapping needed in body copy.
- Define terms in a glossary/jargon `plain-english-box`; matching terms in article text are handled automatically.
- The first jargon/glossary box in a blog post is auto-collapsed by shared JS; readers can expand it on demand.
- Existing manual `<abbr>` tags still work and are not overwritten.
- Tooltips automatically size themselves to fit content and respect viewport boundaries.
- Works in both light and dark themes.

## 13. Styled Quote Block

```html
<blockquote style="margin: 24px 0; padding: 16px 20px; border-left: 3px solid #999; font-style: italic; color: #555;">
  <p style="margin: 0 0 8px;">Quote text.</p>
  <footer style="font-size: 0.85em; font-style: normal; color: #888;">&mdash; Attribution</footer>
</blockquote>
```

**Notes:** Use this when quote styling should match existing post examples.

---

## 14. Required End-Of-Post Sections (Auto-Guardrail)

Blog posts are now protected by shared JS so required end-of-post sections are present even if omitted in the HTML draft.

What is auto-handled by [js/shared-components.js](../js/shared-components.js):

- Related posts section:
  - If a post already contains `.related-posts`, it is preserved.
  - If missing, the script creates `#related-posts-section` and renders related cards from `data/posts.json`.
- Thanks for reading card:
  - If `.blog-thanks-cta` already exists, it is preserved.
  - If missing, the script injects it automatically above related posts.

Recommended authoring pattern for new posts:

```html
<!-- Optional: include this placeholder where you want dynamic related posts -->
<div id="related-posts-section"></div>
```

You can omit both the related posts markup and the thanks card entirely; they will still appear at runtime on any page with `.blog-post` and `shared-components.js` loaded.

---

## 15. Code / Path Snippet in Prose

```html
<p>You filed it under <code>Music\Rock\Symphony X\Paradise Lost\</code>.</p>
```

**Notes:** For short snippets, prefer inline `<code>`. Avoid custom inline code styling per post.

---

## 16. Ordered and Unordered Lists

```html
<ul>
  <li>First point</li>
  <li>Second point</li>
</ul>

<ol>
  <li>Step one</li>
  <li>Step two</li>
</ol>
```

**Notes:** Use plain semantic lists by default; rely on global typography in `style.css`.

---

## 17. Third-Party Media Credit / Copyright Line

```html
<figcaption style="margin-top: 8px; font-size: 0.8em;">
  Caption text. &copy; Original rights holders, YEAR. Used here for commentary.
</figcaption>
```

**Notes:** For non-Ken assets, include source and rights context in the caption. For Ken photos, use the Section 1 copyright span pattern.

---

## 18. Post Disclaimer Ribbon

```html
<p class="post-disclaimer">The views expressed in this post are my own and do not represent any organisation, employer, or institution.</p>
```

**CSS class:** `post-disclaimer`
**Notes:** This is the sitewide legal ribbon style used on blog posts. It is injected automatically right below `.blog-meta` by shared JS, so you typically do not need to paste it manually. If JS is unavailable and you need a static fallback, place this paragraph directly under the post meta block.

---

## Posts Data Entry (`data/posts.json`)

Every published post needs an entry at the top of `data/posts.json`:

```json
{
  "title": "Post Title Here",
  "date": "2026-04-23",
  "excerpt": "One or two sentence summary. Should be compelling and complete.",
  "url": "blog/filename-here.html",
  "image": "img/bg-img/XXX.png",
  "tags": ["data science"],
  "readMinutes": 6
}
```

**Notes:**
- `image` is the thumbnail shown on the blog listing page
- `readMinutes` is generated — run `scripts/generate_read_times.py` after adding the entry rather than writing it by hand
- The filter buttons on `blog.html` are built dynamically from whatever tags appear here, so a typo silently creates a new filter button. Reuse tags already in use: `data science`, `personal`, `photography`, `books`, `ai`, `finance`, `philosophy`, `advice`, `science`, `technology`, `television`, `writing` (this list is enforced by `scripts/audit_site.py`)
- Use as few tags as necessary for the post; most posts should only need one, and only genuinely cross-category posts should use two
- Do NOT add unpublished posts here until Ken confirms push
