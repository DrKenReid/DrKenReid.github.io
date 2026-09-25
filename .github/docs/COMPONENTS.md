# Post components

What goes inside a blog post: the skeleton every post shares, the
components an author writes into the text, what the runtime adds without
being asked, the `posts.json` entry, and the hover sketch every post needs.
The CSS for every component here is in `style.css` §10 (the reading column
and its furniture) and §11 (the components); each section's comments
carry the same markup.

Posts used to be started by copying the last one, and inline styles
travelled from post to post until a colour written into a `style`
attribute was unreadable in the dark theme. So the markup below is the
contract: `normalize_post_markup.py` moves the old forms onto these
classes, and the audit fails a published post that brings one back
([The audit's post rules](#the-audits-post-rules)).

## Writing a post

1. **Add the entry** at the top of `data/posts.json`
   ([fields](#postsjson)). `readMinutes` and `words` can wait: the read-time
   generator writes them.
2. **Write the head.** `python .github/scripts/generate_post_head.py <slug>`
   prints the canonical head for that entry. Paste it into
   `blog/<slug>.html`. The description and keywords it fills in come
   from the entry's excerpt and tags; rewrite those lines if they read
   badly as a search snippet, and leave the rest to the script.
3. **Write the body** from the [skeleton](#the-skeleton), using the
   components below. Every photograph of your own gets the copyright
   caption; every `<img>` gets `alt`, `loading="lazy"`, and a `width` and
   `height` (the photo-dimensions generator can stamp them).
4. **Write the hover sketch** for the post's card in `js/covers.js`
   ([The hover sketch](#the-hover-sketch)). The build fails without one.
5. **`git add -N blog/<slug>.html` and every new file it references**
   (its images under `blog/img/`, a new thumbnail), so the stylesheet
   pruner, the sitemap and the audit can see them: once the post is
   tracked, the audit fails it for pointing at an untracked file
   (`untracked-ref`). Then `python .github/scripts/run_checks.py --fix`.
   That builds the read time, the facets, the opener, the share image,
   the related-post cards, the image sizes, the feed, the no-script
   listings, the sitemap, the head's JSON-LD and the stylesheet, in that
   order, and then checks everything.
6. **Look at it** in a browser, dark and light, at a phone width and a
   desktop width, and run the browser suites
   (`run_checks.py --browser`, or `check_post_template.py blog/<slug>.html`
   for this post alone).

A later edit that changes the word count needs `run_checks.py --fix`
again: the read time, the opener's kicker and the head's `wordCount` all
copy it. Set `updated` in the entry (YYYY-MM-DD) only for a change in
substance; it becomes `dateModified` and the sitemap's `lastmod`.

## The skeleton

The body of every post, annotated. `blog/rating-systems.html` is a clean
real example.

```html
<body>
  <div id="header-section"></div>                 <!-- renderHeader fills it -->

  <main id="main-content">
  <!-- The opener. Write this banner; apply_post_opener.py replaces it with
       the full opener (photograph, crumbs, kicker, title, standfirst),
       built from posts.json. The photograph path is site-absolute. -->
  <section class="breadcrumb-area" style="background-image: url(/img/photography/hero/<n>.webp);">
    <h1 class="page-title">The Post Title</h1>
  </section>

  <div class="about-us-area section-padding-80 clearfix" id="main-content-body">
    <div class="container">
      <div class="blog-post">                     <!-- the article: every generator finds it by this class -->
        <h1>The Post Title</h1>                   <!-- hidden under the opener; kept for the outline -->
        <div class="blog-meta">                   <!-- renderPostMeta redraws it: tags, RSS -->
          12 April 2026 &middot; <span class="blog-tag">books</span>
        </div>

        <p>The first paragraph gets the drop cap and a small-caps lead-in.</p>

        <div class="plain-english-box">           <!-- optional glossary, folded by default -->
          <h2>Quick jargon guide</h2>
          <ul><li><strong>Term</strong>: definition.</li></ul>
        </div>

        <h2>A section</h2>                        <!-- h2s feed the contents rail -->
        <p>Prose, figures, quotations ...</p>

        <h2 class="section-heading" id="references">References</h2>
        <ol class="references"><li id="ref-1">...</li></ol>

        <!-- generate_related_posts.py bakes .related-posts here, as the
             last child; the end band is built after it at runtime. -->
      </div>
    </div>
  </div>
  </main>
  <hr>
  <div id="footer-section"></div>

  <script src="../js/jquery.min.js"></script>
  <script src="../js/alime.bundle.js?v=<stamp>"></script>
  <script src="../js/site.js?v=<stamp>"></script>
  <script src="../js/lightbox.js?v=<stamp>"></script>
  <script src="../js/default-assets/active.js?v=<stamp>"></script>
  <script src="../js/shared-components.js?v=<stamp>"></script>
  <script>renderHeader('header-section', { basePath: '../', active: 'blog' });
renderFooter('footer-section');</script>
</body>
```

- Every post loads the same scripts, in this order; the audit warns on a
  post whose list differs (`script-drift`). The only additions allowed
  are `OPTIONAL_POST_SCRIPTS` in `audit_site.py`: `js/kr-viz.js` for a
  demo, `js/nerd-mode.js`, and `js/prism-loader.js` (rarely needed, see
  [Code](#code)).
- There is no back link at the end ("Back to all posts"): the end band's
  pager and the header do that job, and the audit rejects one.
- `data-no-toc` on `.blog-post` turns the contents rail off for a post
  whose layout it would crowd.

### The head

Written by `generate_post_head.py --fix`: `lang="en-GB"`, the removal of
`#preloader`, `js/analytics.js`, the `?v=` stamps on the stylesheet and
scripts, the Open Graph image (with its size and alt), URL, type, site
name, locale and article dates, and `twitter:image` (both images are the
share card `img/og/<slug>.jpg`),
the hero preload, and the BlogPosting JSON-LD, rebuilt whole. It inserts
the BreadcrumbList, keywords, icon and manifest when they are missing and
never rewrites them. Its docstring lists every element and why it is
there.

What a person writes: the `<title>`, the meta description and keywords,
the Open Graph and Twitter titles and descriptions, `citation_title` and
`DC.title` (and the citation and DC dates when a date changes). The theme
boot script and the citation and Dublin Core tags come from the head
`generate_post_head.py <slug>` prints for a new post, and after that are
only checked: `--check` requires them to be present and compares the
canonical link, the citation dates, `citation_public_url` and `DC.date`
with `posts.json`, but `citation_title` and `DC.title` only for presence,
so after a retitle they keep the old title until you change them. The
share card itself is drawn by `generate_og_images.py` from the opener's
photograph, the title and the kicker. (The essay:
[The Invisible Half of a Blog Post](https://www.kenreid.co.uk/blog/invisible-half-of-a-blog-post.html).)

## posts.json

`data/posts.json` is the list of published posts, newest first, and the
source of the listing, the cards, the palette, the opener, the head, the
feed, the sitemap and the share image. `data/schema/posts.schema.json`
defines it (`additionalProperties: false`, so a misspelt key fails the
`data-schemas` check).

| Field | Written by | Meaning |
|---|---|---|
| `title` | you | the title as the opener, the cards and the JSON-LD print it |
| `date` | you | publication date, YYYY-MM-DD |
| `updated` | you, optional | the last change in substance, YYYY-MM-DD; never taken from git |
| `tags` | you | lower-case topics, one to three (most posts need one); each must be in `ALLOWED_TAGS` in `audit_site.py` (a new tag would become a new filter button) |
| `category` | you | the opener's kicker and the JSON-LD `articleSection`: one of the schema's enum; each has sign-off routes in `KR_ROUTES` in `js/shared-components.js` |
| `excerpt` | you | the standfirst under the opener, and the card excerpt |
| `url` | you | `blog/<slug>.html` |
| `image` | you | the card picture: a gallery thumbnail, a `blog/img/` file, or a full URL |
| `series` | you, optional | `{"name": "...", "part": n}`, or a list of them for a post in two series; each name needs a landing page ([ARCHITECTURE.md](ARCHITECTURE.md#adding-a-series)) |
| `readMinutes`, `words` | `generate_read_times.py` | 220 words a minute, rounded up; `words` is the JSON-LD `wordCount` |
| `interactive`, `code` | `generate_post_facets.py` | present, as `true`, when the post mounts a demo (`KRViz.mount`) or has a `<pre><code>` block; the blog filter's Format row, the series index and the colophon read them |

The tags in use today: advice, ai, books, data science, finance, music,
personal, philosophy, photography, science, technology, television,
writing. Use as few as the post needs; most need one.

## Components

Each entry: the markup, the classes, what drives it, what it does for
accessibility, and what not to do.

### Figures

```html
<figure>
  <img src="../img/photography/thumb/<n>.webp" alt="What the photograph shows" loading="lazy" width="400" height="266">
  <figcaption class="figure-note">
    <span class="figure-copyright">&copy; Ken Reid. All rights reserved.</span>
    Caption text.
  </figcaption>
</figure>
```

- **Pairs.** Two plain figures in a row sit side by side from 768px.
  A figure that must stand alone is `figure.kr-figure--solo`: that class,
  not a `style` attribute, is the opt-out from pairing.
- **Image classes.** `.kr-figure-img` is the house image (column width,
  8px corners, flush with its caption); `.kr-figure-img--portrait` caps an
  upright frame at a landscape frame's height; `.kr-figure--center`
  centres a figure's contents (a table, an equation, a small picture).
- **Captions.** `.figure-note` is the house caption. Every photograph of
  Ken's carries the `.figure-copyright` span, with or without a caption
  after it. The cat photographs (kwee, chaos, yoyo and nila) and book
  covers need no copyright line. Third-party images carry their source
  and rights in the caption instead, for example "&copy; the
  photographer. Used here for commentary."
- **Lightbox.** A gallery thumbnail (`img/photography/thumb/<n>.webp`)
  opens the full-size original from the `photos-v1` release in the
  lightbox: `initLightboxFix` wraps it in a link at runtime and
  `js/lightbox.js` binds it. Do not link a photograph yourself, and never
  link the release PNG as a download.
- **Two themes.** A picture drawn once for each theme goes in one figure
  as `img.theme-img-light` and `img.theme-img-dark`; only the theme's own
  shows. A dark chart that should read as a card in the light theme takes
  `.chart-dark`.
- Every image has `width` and `height`, so the page reserves its box
  before the file arrives; `generate_photo_dims.py --stamp-img` writes
  them from the file.
- Do not: size or space a figure with a `style` attribute; put a
  `<figure>` directly inside a list (invalid HTML, and an audit error).

### Photo grid

A contact sheet of photographs in one figure, one caption for all.

```html
<figure>
  <div class="photo-grid">
    <img src="../img/photography/thumb/<n>.webp" alt="..." loading="lazy" width="400" height="266">
    <img src="../img/photography/thumb/<m>.webp" alt="..." loading="lazy" width="400" height="266">
  </div>
  <figcaption class="figure-note"><span class="figure-copyright">&copy; Ken Reid. All rights reserved.</span></figcaption>
</figure>
```

Columns, not a grid, because photographs arrive in mixed shapes. Two up,
one up under 576px. Each thumbnail becomes its own lightbox link.

### Full resolution

`<div class="blog-post" data-fullres>` on a photography post:
`initFullResMode` adds a "Load high resolution versions" panel at the top
of the post and a link under each photograph that swaps that one
thumbnail for the release original. The panel warns how much the
originals weigh: 2.7 MB a photograph by default, or the total in MB that
`data-fullres-size="60"` gives. A failed load falls back to the thumbnail
and says so. Do not paste the script into the
post; the attribute is all of it.

### Embeds

A video loads only when asked for: a facade button stands in for the
player until it is clicked.

```html
<figure class="kr-figure--solo kr-figure--embed">
  <button type="button" class="kr-embed-facade"
          data-embed-src="https://www.youtube.com/embed/<video-id>"
          data-embed-title="What the video is">
    <span class="kr-embed-facade__play" aria-hidden="true"></span>
    <span class="kr-embed-facade__title">What the video is</span>
    <span class="kr-embed-facade__note">Click to load the YouTube player</span>
  </button>
  <figcaption class="kr-figcaption">Context for the video.</figcaption>
</figure>
```

- `initEmbedFacades` swaps the button for the iframe on click and moves
  focus into it. Facade and player are both 16:9 at full width, so the
  swap does not move the page. `data-embed-height` sets a fixed height for
  an embed that is not a 16:9 video; video players ignore it.
- Nothing is fetched from YouTube until the reader asks, which keeps the
  page fast and third-party requests out of a reading.
- The facade is a real `<button>` named by its title, so it works from
  the keyboard.
- Do not: paste a raw YouTube `<iframe>` (an audit error,
  `youtube-iframe`).

An Instagram post is the `blockquote.instagram-media` Instagram's own
snippet writes, without its `style` attribute (§11 sizes it), inside a
`figure.kr-figure--solo.kr-figure--embed`, with Instagram's script
(`https://www.instagram.com/embed.js`) loaded once near the end of the
page.

### References and citations

```html
<p>A claim that needs a source.<sup><a href="#ref-1" class="cite-ref">[1]</a></sup></p>
...
<h2 class="section-heading" id="references">References</h2>
<ol class="references">
  <li id="ref-1">Author, A. (2024). <em>Title.</em> Publisher. <a href="https://doi.org/<doi>">https://doi.org/<doi></a></li>
</ol>
```

- The one shape: `ol.references > li#ref-N`, cited by `a.cite-ref`
  pointing at `#ref-N`. Sidenotes, citation previews and the jargon skip
  list all read it, and the audit fails a `cite-ref` whose target is not
  a `li#ref-N` in an `ol.references`.
- From 1360px `initPostSidenotes` copies each reference beside its first
  citation (compact: number, author and year, title, one link). The list
  stays the canonical copy and the sidenotes are `aria-hidden`.
- Hovering a citation shows the reference in a card (`initCitePreviews`).
- A post that folds the list away uses
  `<details class="faq-item kr-references" id="references"><summary>References</summary><ol class="references">...</ol></details>`.
- Do not: style a reference list by hand or use another list shape.

### Code

```html
<pre><code class="language-python">print("hello")</code></pre>

<details class="code-example"><summary>Python example</summary>
<pre><code class="language-python">...</code></pre>
</details>
```

- Every `pre > code` names its language (`language-text` for output);
  the audit fails one that does not (`code-language`).
- `initCodeHighlighting` loads Prism, with the language files the classes
  name, for any post with classed code. Do not call `loadPrism` yourself
  or include `js/prism-loader.js` for that; `normalize_post_markup.py`
  removes such calls. (The nerd-mode posts, which re-highlight from their
  own toggle, are the exception.)
- `details.code-example` folds a long listing away until asked for.
- Inline `<code>` in prose needs no class.

### Links, lists and inline code

Plain markup, no classes: the post's type rules style them.

```html
<p>See <a href="in-defense-of-audiobooks.html">my post on audiobooks</a>,
the <a href="../data_science.html">research page</a>, or
<a href="https://example.com" target="_blank" rel="noopener noreferrer">a source</a>.
The file sat in <code>Music\Rock\</code>.</p>
<ul><li>A point.</li></ul>
```

- A link to another post is relative to `blog/`; a link to a page goes
  up one level (`../data_science.html`).
- A link that opens a new tab carries `rel="noopener noreferrer"`;
  `annotateNewTabLinks` adds "(opens in new tab)" for screen readers by
  itself.
- Do not colour or underline a link by hand: a link in a post's prose is
  the action red with a drawn underline that thickens on hover (§10),
  and a citation (`a.cite-ref`) is left out of that on purpose.

### Jargon

A post's terms, defined once, explained where they are used.

```html
<div class="plain-english-box">
  <h2>Quick jargon guide</h2>
  <ul>
    <li><strong>Redundant coding</strong>: never letting colour be the only cue.</li>
  </ul>
</div>
<p>... <jargon key="redundant coding">coding it twice</jargon> ...</p>
```

- `applyJargonTooltips` reads the box (a `.plain-english-box` whose
  heading says jargon, glossary or plain English, or any of whose list
  items holds a `<strong>` term) and wraps a term's first use in each
  `h2` section in `<abbr title="definition">`, which the CSS draws as a
  card on hover and focus. It skips the chrome: the meta line, summaries,
  the reference list, sidenotes, captions, the pager and the end band.
- A short built-in list of site-wide terms (`GLOBAL_JARGON` in
  `applyJargonTooltips`: common abbreviations and tool names) is matched
  on every post, including a post with no glossary box; a post's own
  glossary overrides an entry with the same term.
- `<jargon>` marks a use the matcher would not find (a different wording,
  or a term used before its section), with `key` naming the glossary
  entry. Markers it cannot resolve keep their words and lose the tooltip.
- `autoCollapseTopJargonBox` folds the first glossary box into a closed
  `<details>`, so it does not stand between the reader and the opening.
- Do not: wrap terms in `<abbr>` by hand throughout; the matcher does it
  once per section, which is the point.

### FAQ

```html
<div class="faq-section">
  <h2>Common questions</h2>
  <details class="faq-item">
    <summary>A question?</summary>
    <p>The answer.</p>
  </details>
</div>
```

Native `<details>`, no script. Keep the summary plain text: no heading
inside a `<summary>`.

### Scene box

A standing example the post returns to (the Cognitive Biases series'
dinner table), set apart from the argument.

```html
<aside class="kr-scene">
  <p class="kr-scene-label">The dinner table</p>
  <p>The scene.</p>
</aside>
```

The label is a label, not a heading, so it stays out of the outline and
the contents rail. A figure inside sits closer to the scene's text.
Introduce the scene in ordinary prose before the box.

### Content warning

```html
<p class="kr-content-warning" role="note">Content warning: this post discusses ...</p>
<p><strong class="kr-warning-label">Spoiler alert:</strong> the paragraph that gives it away.</p>
```

Amber (`--kr-caution`), because red means clickable. `role="note"` makes
the warning a region a screen reader can find or skip; `initDropCap`
skips it, so the drop cap lands on the first paragraph of the post
proper.

### Audio card

```html
<div class="kr-audio-card">
  <span class="kr-audio-card__label">&#9654; The sound itself</span>
  <audio class="kr-audio-card__player" controls>
    <source src="<audio-url>" type="audio/mpeg">
    Your browser does not support the audio element.
  </audio>
  <p class="kr-audio-card__note">A sentence, or a transcript, on what you are hearing.</p>
</div>
```

Always give the note: a reader who cannot play audio still learns what
it is.

### Quotations

Every `blockquote` in a post is a centred pull quote between two short
rules, and clicking it copies the quotation with its attribution
(`initCopyQuotes`).

```html
<blockquote>
  <p>Quoted text.</p>
  <cite>Attribution, <em>Source</em></cite>
</blockquote>

<blockquote class="kr-pullquote">          <!-- quieter: a line from someone else -->
  <p>Quoted text.</p>
  <footer>Attribution</footer>
</blockquote>

<blockquote class="kr-pullquote kr-pullquote--display">   <!-- the line the post builds to -->
  <strong>Knowledge is power.</strong>
</blockquote>
```

Do not colour a quotation with a `style` attribute (the audit warns,
`inline-color`); an inline grey was 2.3:1 on the dark page.

### Notes

```html
<p class="kr-muted-note">Sources: ...</p>                    <!-- a source line, a credit -->
<p class="kr-muted-note kr-muted-note--center">The chart below ...</p>
<p class="kr-endnote"><strong>Part II is now up.</strong> ...</p>   <!-- set off by a hairline -->
```

These replace the grey paragraphs posts used to colour by hand, which
fell below 4.5:1 on the warm page.

### Tables

```html
<div style="overflow-x:auto"><table class="kr-table">
  <thead><tr><th scope="col">Option</th><th scope="col">Score</th></tr></thead>
  <tbody><tr class="kr-row-mark"><td>deep work</td><td class="kr-delta--down">&minus;8</td></tr></tbody>
</table></div>
```

Hairline rows in the theme's greys, zebra striping, a sideways scroll
with edge fades on a phone. `.kr-table--fit` sizes a table to its contents
and centres it. `.kr-delta--up`, `--down` and `--zero` colour a signed
change, which is never the only cue: the sign is in the number.
`th scope` names the headers for a screen reader.

### Book covers

```html
<div class="kr-cover-row">
  <img class="kr-cover" src="img/<cover>.jpg" alt="The Name of the Wind cover" width="331" height="500">
</div>

<div class="book-cover-grid">
  <div>
    <img class="kr-cover" src="img/<cover>.jpg" alt="..." width="331" height="500">
    <p class="kr-cover-title">The Name of the Wind</p>
    <p class="kr-cover-meta">2007 &middot; Book One</p>
    <p class="kr-cover-blurb">A sentence on the book.</p>
  </div>
</div>
```

`.kr-cover-row` is a strip of a series' covers at one height;
`.book-cover-grid` is two columns of cover cards at every width. A cover that
is not the real one yet (a fan's art for an unreleased book) adds
`.kr-cover--faded`. A single cover floated beside the text is
`.book-cover--left` or `--right` inside a `.bsec` section, which contains
the float.

### Cite this post

A BibTeX box with a copy button, for posts likely to be referenced:
`.kr-cite-this` with `__title`, `__intro`, a `pre`, `button.kr-cite-this__copy`
and `__apa`. The markup and the copy script are in
`blog/evolutionary-computation-identity-crisis.html`.

### Timeline

```html
<ul class="blog-timeline">
  <li><span class="tl-year">2012&ndash;2014</span><span class="tl-dot"></span><span class="tl-body">What happened.</span></li>
</ul>
```

### Console

A few lines of pretend code set as a terminal (the nerd-mode greeting in
the schedule posts): `.kr-console` with `__key`, `__comment`, `__code` and
`__value` spans, coloured with the same palette as the highlighted code.

### Interactive demo

A canvas demo is a `.kr-viz` block driven by `js/kr-viz.js`; the markup,
the options and the checks are in [VIZ-ENGINE.md](VIZ-ENGINE.md). The
`.kr-viz` frame and its light and dark tokens can also host a figure that
is not a canvas (`blog/leading-a-horse-to-water.html` draws a flow chart
in it): the post then keeps only its own shapes in its `<style>`. Such a
post is not `interactive` in `posts.json`: the facet comes from a
`KRViz.mount` call, not from the class, so a static figure stays out of
the blog's "posts with a live demo" filter.

## What the runtime adds

`js/shared-components.js` builds the furniture around the text by itself
on any page with a `.blog-post`. None of it is written into the post, and
none of it should be: a hand-written copy would be a second one.

| Where | What | Built by |
|---|---|---|
| `.blog-meta` under the opener | the date and read time are dropped (the kicker has them); tags become links to `blog.html?tag=`; an RSS link | `renderPostMeta`, `renderTitleRssLink` |
| after the meta line | the series line, "Part 3 of 10 · Name", with every part in a `<details>`, for each series the post is in | `renderSeriesNav` |
| top of the post, under 1240px | the contents as a collapsible box (`details.kr-toc-mobile`) | `renderPostToc` |
| fixed left, from 1240px | the contents rail (`nav.kr-toc`) with a gradient marker on the section in view | `renderPostToc` |
| each `h2` | an anchor link (`a.kr-hlink`) | `renderHeadingAnchors` |
| top of the window | the reading-progress bar, which reaches 100% when the end mark is in view | `renderReadingProgress` |
| beside the post, 992 to 1359px | the share rail; on a phone, a share sheet that rises at the end | `renderFloatingBlogShare` |
| the first paragraph | the drop cap (`p.drop-cap`, three lines or more) and a small-caps lead-in (`span.lead-in`) | `initDropCap` |
| prose | `<abbr title>` on the first use of each glossary term per section, the post's own terms and the site-wide `GLOBAL_JARGON` | `applyJargonTooltips` |
| the first glossary box | folded into a closed `<details>` | `autoCollapseTopJargonBox` |
| beside the post, from 1360px | a sidenote for each cited reference (`aside.kr-sidenote`) | `initPostSidenotes` |
| hovered citations | a preview card (`div.cite-preview`) | `initCitePreviews` |
| gallery thumbnails | lightbox links to the release originals | `initLightboxFix` |
| `.blog-post[data-fullres]` | the full-resolution panel and per-photo links | `initFullResMode` |
| classed code blocks | Prism, with the languages named | `initCodeHighlighting` |
| `.kr-embed-facade` | the iframe, on click | `initEmbedFacades` |
| every `blockquote` | click to copy, with a hint | `initCopyQuotes` |
| the last child of `.blog-post` | the end band, below | `renderPostEnd` |

### The end band

`renderPostEnd` closes every post with one `footer.kr-post-end`, its slots
created together, in this order, before any data arrives:

| Slot | Markup | Contents |
|---|---|---|
| a. end mark | `div.kr-post-end__slot.kr-post-end__mark > .kr-fin` | the ⁂, in the brand gradient; the progress bar measures to it |
| b. sign-off | `div.kr-post-end__slot.kr-signoff` (`buildSignOff`) | portrait, name and one line about the author (`KR_TAGLINE`), three routes onward chosen by the post's category (`KR_ROUTES`), the Subscribe and Coffee buttons, the share row (from 1360px only, where the rail has gone), and the disclaimer as fine print |
| c. up next | `nav.kr-post-end__slot.kr-upnext` (`fillUpNext`) | the pager: the previous and next part when the post is in a series, otherwise the older and newer post (`postNeighbours`); each link runs its post's sketch under its text on hover |
| d. related | `div.kr-post-end__slot.kr-post-end__related` | the baked `.related-posts` block, moved in; a draft's is rendered here at runtime |
| e. comments | `section#giscus-comments.kr-post-end__slot` (`buildGiscusSection`) | giscus, backed by GitHub Discussions, with a Refresh button; its theme follows the site's |

Why this order: from the post outward. The mark closes the piece; the
sign-off belongs to it (who wrote it, how to follow, how to pass it on);
then the one obvious next read, then a wider choice, and last the
conversation, which is open-ended and can be long, so nothing useful sits
below it. A slot with nothing to show removes itself. The related cards
leave out the two posts the pager already offers
(`generate_related_posts.py` mirrors `postNeighbours`). The comments need
the giscus app installed on the repository and Discussions enabled; the
essay [Free Comments via GitHub Discussions](https://www.kenreid.co.uk/blog/free-comments-via-github-discussions.html)
covers the setup. `check_post_template.py` checks every post for exactly
one band with the slots in this order.

## The hover sketch

Every post's card runs a small animated sketch over its cover while it is
hovered or focused: a picture of what the post is about. The engine is
`js/live-covers.js`; the sketches are `js/covers.js`, one per post, keyed
by the post's slug. `check_live_covers.py --check` fails the build when a
post in `posts.json` has none. (The essay:
[Every Card Has a Sketch](https://www.kenreid.co.uk/blog/every-card-has-a-sketch.html).)

```js
def('<slug>', function (w, h, rnd) {
    // w, h: the card's cover in CSS pixels; rnd: a seeded random source
    // (the same picture every time for this post).
    var t = 0, dots = [];
    for (var i = 0; i < 12; i++) dots.push({ x: rnd() * w, y: rnd() * h });
    return {
        step: function () { t++; },                  // called 60 times a second
        draw: function (ctx) {                       // called after steps, on a cleared canvas
            dots.forEach(function (d, i) {
                var p = phase(t + i * 10, 120);      // 0..1 through a 120-frame cycle
                dot(ctx, d.x, d.y, 2 + 3 * ease(p), C.a);
            });
        }
        // veil: false  to skip the dark wash drawn under the sketch
    };
});
```

- The helpers are in scope at the top of `js/covers.js`, from
  `window.krLiveCovers.helpers`: the palette `C` (`C.a`, `C.b`, `C.ink`,
  `C.dim`, `C.red`, `C.green`, `C.blue`), `TAU`, `dot`, `text`, `line`,
  `rect`, `ease`, `clamp01`, `phase(t, cycle)`, `alpha(colour, a)` and
  `makeLandscape(rnd)` for the optimisation demos' shared terrain.
- Count frames, not time: the engine steps every sketch at a fixed 60 a
  second, whatever the display's refresh rate, so a frame counter runs at
  one speed on every screen.
- Keep it to a few dozen lines, drawn with the helpers, so every card
  speaks one visual language. The interactive posts' sketches are
  miniatures of their demos, at the top of the file.
- The engine loads only where a pointer can hover and motion is welcome,
  on the first pointer move; phones and reduced-motion readers see the
  still cover. Nothing in a card may depend on the sketch.
- The smoke suite runs every registered sketch for 120 frames and fails
  one that throws or draws nothing. To try one by hand, call
  `krLoadLiveCovers()` in the console, then
  `krLiveCovers.make('<slug>', 360, 220, 7)` for an instance.

Sketches elsewhere on the site (the homepage's stat tiles, the About
cards, the publications, the book wall, the gallery's globe) are in
`js/covers-site.js`, keyed by a prefix (`stat:`, `explore:`, `hobby:`,
`pub:`, `genre:`, `gallery:globe`), and any element becomes a host with
`data-live="<key>"` ([CONVENTIONS.md](CONVENTIONS.md#data--hosts)).

## The audit's post rules

`audit_site.py` holds published posts to the components above. Each
component rule's message names the `style.css` section whose comments
show the markup to use instead.

| Rule | Level | Catches |
|---|---|---|
| `inline-color` | WARN (fails with `--strict`, as CI runs it) | a literal colour in a `style` attribute |
| `back-link` | ERROR | a hand-coded "Back to all posts" link |
| `references` | ERROR | an `a.cite-ref` whose target is not an `ol.references > li#ref-N` |
| `code-language` | ERROR | a `pre > code` without a `language-*` class |
| `youtube-iframe` | ERROR | a raw YouTube iframe instead of the facade |
| `figure-in-list` | ERROR | a `<figure>` directly inside a `ul` or `ol` |
| `script-drift` | WARN | a post whose scripts differ from the others' |
| `banned-word` | WARN (fails with `--strict`) | a word from `BANNED_PROSE` in `audit_site.py` in the prose, on posts and top-level pages |
| `curly-quote` | WARN (fails with `--strict`) | curly quotes or apostrophes in the prose or the meta description; use straight `'` and `"` |
| `em-dash` | WARN (fails with `--strict`) | an em dash in a post's prose (posts only) |

The last three are house style rather than markup, but CI runs the audit
with `--strict`, so a post with a curly apostrophe or an em dash turns
the build red like any other rule here.

`python .github/scripts/normalize_post_markup.py blog/<slug>.html` rewrites
the old forms onto the components (figures, audio cards, reference lists,
code languages, back links, stray `loadPrism` calls), and is idempotent;
its `--check` mode runs first among the post checks in CI.
