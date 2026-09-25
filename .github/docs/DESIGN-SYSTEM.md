# Design system

The look of the site is a small set of tokens and a handful of shared
components, all in `style.css`. This page lists them with the reasons
behind them. The stylesheet's own comments hold the detail (each section
opens with what it covers and what builds it); the section numbers below
(§01 to §23) are its banners.

## The three rules

1. **Red means "you can click this", and nothing else.** Links, buttons,
   tag pills, the focus ring: `--kr-action` (`#c53030` light, `#fc6060`
   dark). A label, an icon, a date or a decorative rule is never red,
   because a reader who learns that red is clickable should never be
   wrong about it. Decoration uses the stone `--kr-eyebrow` instead.
2. **The gradient is the signature.** `--kr-brand-gradient` (deep red to
   amber in the light theme, peach to gold in the dark) is the only
   colour that is the site's own: the wordmark, the short rule under a
   section heading, the end mark that closes a post, the reading-progress
   bar, the current page's bar in the phone menu. Keeping everything else
   neutral is deliberate: the site carries around five hundred
   photographs, and every decorative colour competes with them. The
   palette's name, in the stylesheet, is Quarry.
3. **Lora for titles and reading, Poppins for the interface.** Page and
   post titles, section headings, post prose, ledes and pull quotes are
   Lora; navigation, buttons, labels, cards, meta lines and every control
   are Poppins. Using the posts' serif for the pages' headings is what
   stops the pages and the posts reading as two different sites.

## Two themes

The theme is `data-theme="dark"` or `"light"` on `<html>`, set before the
first paint by the inline script in every page's head (default dark) and
switched by `js/theme.js`, which remembers the choice in `localStorage`
(`kr-theme`) and keeps `<meta name="theme-color">` in step (`#1a1a1a`,
`#faf7f2`). Where view transitions are supported the switch is a circular
reveal from the button; elsewhere, and under reduced motion, a short
cross-fade.

Every token whose value differs by theme is restated under
`:root[data-theme="dark"]`, so a rule that reads tokens needs no dark
twin. The theme-independent ones (radii, shadows, display and label
sizes, section spacing, `--kr-action-fill`, the photograph colours and
scrim) are set on `:root` only. One trap: a custom property whose value
contains `var()` is resolved where it is declared, so descendants
inherit `--kr-brand-gradient` already computed against `:root`.
Overriding `--kr-brand-from` on a wrapper changes nothing unless the
gradient is restated beside it. So any block that overrides a token's
input (the dark block, or a scoped override) must restate the tokens
built from it (`tests/test_decisions.py`, `DerivedTokensAreRestated`),
and a component scoped to a dark photograph names the final token
(`--kr-photo-gradient`) rather than rebuilding one.

Type set on a photograph ignores the theme: the scrim makes the ground
dark either way, so the openers, photo bands and cards over photographs
use the fixed `--kr-photo-from` / `--kr-photo-to` pair and white.

## Tokens

All in §01 unless noted. Contrast is WCAG 2.x, measured against the page
(`--kr-surface-0`), the tinted band (`--kr-surface-1`) and a card
(`--kr-surface-2`) in each theme; `tests/test_contrast.py` measures the
text tokens again on every run.

### Text and action

| Token | Light | Dark | Use | Light contrast | Dark contrast |
|---|---|---|---|---|---|
| `--kr-ink` | `#252525` | `#e2e2e2` | body copy, headings | 14.34 page, 13.39 tint, 15.10 card | 13.43, 12.72, 11.83 |
| `--kr-muted` | `#666666` | `#a8a8a8` | dates, counts, captions, ledes | 5.37, 5.02, 5.66 | 7.32, 6.93, 6.45 |
| `--kr-eyebrow` | `#6b6459` | `#a8a099` | labels, eyebrows, icons; never a link | 5.47, 5.11, 5.76 | 6.76, 6.40, 5.95 |
| `--kr-action` | `#c53030` | `#fc6060` | links, link buttons, tags | 5.12, 4.78, 5.39 | 5.79, 5.48, 5.10 |
| `--kr-action-hover` | `#a52424` | `#ff8f8f` | hover and focus of an action | 6.83, 6.38, 7.19 | 7.94, 7.52, 6.99 |
| `--kr-action-fill` | `#c53030` | same | a red fill under white type | white on it 5.47 | same |
| `--kr-action-fill-hover` | `#a52424` | same | its hover | white on it 7.30 | same |
| `--kr-focus` | `#c53030` | `#fc6060` | the keyboard focus ring | as `--kr-action` | as `--kr-action` |
| `--kr-caution` | `#8a4b00` | `#f0b454` | content warnings, spoiler labels | 6.37 page | 9.42 page |
| `--kr-caution-edge` | `#b86e0e` | `#e0a84a` | their rule and tint | 3.73 (a mark needs 3:1) | 8.18 |
| `--kr-delta-down` / `--kr-delta-up` | `#a8431c` / `#2d7a45` | `#f08c6a` / `#6cc48a` | a signed change in a table | 5.64 / 4.94 | 7.18 / 8.21 |

The light theme never uses `#fc6060` for text: it is 2.81:1 on the light
page. A filled red control carries white type on `--kr-action-fill`
(`#c53030`) in both themes, because white on the dark theme's `#fc6060`
is only 3.01:1.

### Brand and photograph

| Token | Light | Dark | Use |
|---|---|---|---|
| `--kr-brand-from`, `--kr-brand-to` | `#c0392b`, `#d98324` | `#ff9696`, `#ffe89e` | the gradient's ends |
| `--kr-brand-gradient` | red to amber | peach to gold | the signature; apply as text with `.kr-gradient-text` |
| `--kr-photo-from`, `--kr-photo-to` | `#ff9696`, `#ffe89e` | same | type on a photograph (9.04 and 15.55 on `#111`) |
| `--kr-photo-gradient` | peach to gold | same | a headline on a photograph |
| `--kr-opener-scrim` | a dark vertical wash | same | between a photograph and the type on it |

The gradient is decoration, never body text: the light theme's amber end
is 2.72:1 on the page. Gradient text needs `.kr-gradient-text` (or its
selector list in §01), which carries the `@supports` fallback to a solid
colour; transparent text without `background-clip` support is invisible
text.

### Surfaces, lines, shape

| Token | Light | Dark | Use |
|---|---|---|---|
| `--kr-surface-0` | `#faf7f2` | `#1a1a1a` | the page |
| `--kr-surface-1` | `#f4efe7` | `#1f1f1f` | a tinted band (`.bg-tint`) |
| `--kr-surface-2` | `#fffdfa` | `#252525` | a card |
| `--kr-surface-3` | `#ffffff` | `#2a2a2a` | raised: a field, a pressed chip |
| `--kr-surface-warm`, `--kr-surface-card` | older names | | prefer the numbered scale in new rules |
| `--kr-hairline` | `#e7e0d6` | `#3a3a3a` | rules and borders |
| `--kr-radius-sm/md/lg` | 6, 10, 14px | same | a chip, a card, a panel of cards |
| `--kr-shadow-1`, `--kr-shadow-2` | a card at rest, lifted | same | |

The light page is warm off-white rather than white, which fought both
Lora and the photographs.

### Type and rhythm

| Token | Value | Use |
|---|---|---|
| `--kr-display` | `clamp(30px, 3.6vw, 50px)` | section headings (page titles are a step above it) |
| `--kr-display-sm` | `clamp(21px, 2.3vw, 29px)` | a smaller heading (`.section-heading--sm`), the h2s of a long-form page (`.kr-prose`) |
| `--kr-post-h-size` (§10) | 28px on a post's h2, 21px on its h3 | a post's own headings, with `--kr-post-h-leading`, `-above`, `-below` |
| `--kr-label-size`, `--kr-label-tracking` | 11px, 0.16em | the uppercase label (the eyebrow sets 12px, 0.18em on itself) |
| `--kr-section-y`, `--kr-section-y-tight` | `clamp(64px, 8vw, 112px)`, half of it | the vertical rhythm between sections (homepage, topic rows) |
| `--kr-post-width` (§10) | 640px | the reading measure: 18px Lora runs 71 to 75 characters a line |
| `--kr-prose-size`, `--kr-prose-leading` (§10) | 18px, 1.7 | post prose |
| `--kr-post-bleed` (§10) | 0, 25px, 60px by width | how far demos and figures run past the prose (to 760px from 992px) |

Component-scoped tokens stay with their component: the demo palette
(`--viz-*`, §12), the calendar ramp (`--kr-cal-*`, §14), the header's
states (`--kr-bar-*`, §04).

## Type

Lora (one variable file, weights 400 to 700, plus its italic) and Poppins
are self-hosted from `fonts/vendor/`, declared in `css/local-fonts.css`,
with no request to a font service. Each has a metric-matched local
fallback (`'Lora Fallback'`, `'Poppins Fallback'`) listed after it, so text
set in the fallback while the real font loads takes the same space and
nothing reflows when it arrives. Icons are Font Awesome, Themify and
ElegantIcons, each subset at build time to the glyphs the site uses
(`subset_icon_fonts.py`). (The essay:
[Self-Hosting Your Fonts](https://www.kenreid.co.uk/blog/self-hosting-your-fonts.html).)

## Breakpoints

| Width | What changes | Where |
|---|---|---|
| 576px | the reading calendar switches to months; the photo grid goes one up | §14, §11 |
| 768px | the page opener grows to its full height; paired figures sit side by side | §06, §11 |
| 992px | the desktop menu replaces the phone menu (`NAV_BREAKPOINT` 991 in `js/site.js`); the share rail appears beside a post; demos and figures run to the wide measure | §04, §10 |
| 1240px | the contents rail appears to the left of a post | §10, `renderPostToc` |
| 1360px | sidenotes appear, the rail stands down and the sign-off carries the share buttons (`KR_WIDE_POST`) | §10 |

A width in CSS and the same width in script must change together:
`KR_WIDE_POST` in `js/shared-components.js` and the 1360px rules, for
example, or sidenotes and share buttons appear in the wrong places.

## Components

### Page opener

Every top-level page opens on a photograph with its title in Lora,
bottom left, crumbs above it, over `--kr-opener-scrim` (§06).

```html
<section class="breadcrumb-area bg-img bg-overlay jarallax"
         style="background-image: url(/img/photography/hero/<n>.webp);">
  <div class="container">
    <div class="breadcrumb-content">
      <nav aria-label="breadcrumb"><ol class="breadcrumb">
        <li class="breadcrumb-item"><a href="/index.html"><i class="icon_house_alt"></i> Home</a></li>
        <li class="breadcrumb-item active" aria-current="page">Contact</li>
      </ol></nav>
      <h1 class="page-title">Contact</h1>
    </div>
  </div>
</section>
```

- Add `.breadcrumb-area--listing` for an index page (blog, series,
  gallery), where the content is what the reader came for: the banner
  takes about a third of the screen instead of half.
- The photograph stays in the inline `background-image`, where the
  parallax (`.jarallax`, run by `js/site.js`) reads it.
- Do keep the title to the page's name. Don't repeat it as the first
  `h2`, colour the title or crumbs per page, or give a second element the
  `kr-hero` view-transition name.

A post's opener (`.kr-opener`) is the same language, written into each
post by `apply_post_opener.py`; see [COMPONENTS.md](COMPONENTS.md). A
photograph further down a page is a `.kr-photo-band` (§06).

### Section heading

One heading for every section of every page: a stone eyebrow, the `h2` in
Lora, the gradient as a short rule under it, and an optional lede (§05).

```html
<div class="section-heading text-center">
  <span class="section-eyebrow">Where</span>
  <h2>Photographs by place</h2>
  <p class="section-heading__lede">One or two sentences.</p>
</div>
```

- Alignment is always stated: `.text-center`, or `.section-heading--left`.
  A heading with neither gets no rule.
- Modifiers: `--sm` (smaller), `--on-photo` (white type and the photo
  gradient over a photograph), `--snug` (the homepage's gap under the
  heading, `--kr-section-heading-gap`, on another page, in place of an
  inline margin).
- Keep the eyebrow immediately before the `h2`: the styles and the scroll
  flourishes find headings by that pair.
- The eyebrow, heading and rule animate in on scroll through CSS
  (`animation-timeline: view()`, with a script fallback). Add no other
  reveal to the block, and none to cards: a grid that fades in card by
  card makes a reader wait for what is already there.
- Don't put `.section-heading` on the `h2` itself; that is an older use in
  posts which none of these rules reach.

### Buttons

`.kr-btn` is the one button, for `<a>` and `<button>` (§03).

```html
<div class="kr-btn-row">
  <a class="kr-btn kr-btn--primary" href="/gallery.html">Browse the gallery</a>
  <button type="button" class="kr-btn kr-btn--ghost">Show more</button>
</div>
```

- `--primary`: red fill, white type (`--kr-action-fill`). One per row,
  first.
- `--ghost`: no fill, `currentColor` text and outline; fills red on hover.
- `--on-photo`: white outline for a band with a photograph behind it.
- `--sm`: smaller, for cards and dense rows.
- Group buttons in `.kr-btn-row` (wraps, 12px gap, centred;
  `--start` for flush left; `--below` after an embed or list) rather than
  giving them margins.
- To colour a button for a context, set its custom properties
  (`--kr-btn-fg`, `--kr-btn-bg`, `--kr-btn-border` and their `-hover`
  forms), never `color` or `background`: the button's own rule is written
  to outrank the global link colours, and a plain declaration loses to
  them. The demo toolbar does exactly this (§12).
- `.alime-btn`, the template's button, takes the `--ghost` rules
  (`--on-photo` over a photograph) until the last post using it
  migrates; `.btn-2` no longer has a rule. New markup uses `.kr-btn`.

### Cards

`.blog-card` (stacked: picture, date, title, excerpt, tags) and
`.single-post-area` (overlay: title over the photograph) are the post
cards, both built by `createBlogCardElement` (§08). Every point of an
overlay card is its title's link, so middle-click and "open in new tab"
work anywhere on it. Cards carry the cursor-lit ring (`.kr-lit`), the
cover glow (`.kr-glow-host`) and a live-cover sketch; a new card builder
must add them itself. `.blog-tag` is a tag pill, red and outlined because
a tag leads to the blog filtered by it; `.kr-series-chip` is neutral glass
because it labels and does not link.

### Labels

`.kr-label` is the small uppercase label: 11px, weight 600, spaced,
`--kr-eyebrow` (§02). The eyebrow, the footer headings, the colophon's
stat labels and the end band's slot titles are members of the same rule.
A label is never a link.

### Stages

Hover sketches outside the post cards run in a stage of their own, so the
text around them never moves: a strip beneath the homepage's stat tiles
and Explore links (`.kr-stat-stage`, `.kr-explore-stage`), a corner box on
the About page's hobby cards (`.kr-hobby-stage`), a panel beside each
publication (`.kr-pub-stage`). The stat, Explore and publication stages
take room only where the sketches can run (`(hover: hover)` and no
reduced-motion preference; the publication stage also from 900px wide),
which must stay in step with the gate in `initLiveCovers`. The About
card's corner stage is always there, but it is absolutely placed and
stays transparent until a sketch runs. A stage darkens while its sketch
runs and fades slowly (§20).

## A page, composed

1. The page opener, `.breadcrumb-area` (`--listing` for an index).
2. Sections, each a `section` with `.section-heading` and its content,
   alternating plain and `.bg-tint` grounds when neighbouring sections
   need telling apart.
3. Actions in a `.kr-btn-row`, one `--primary` at most.
4. Optionally a topic row: an empty
   `<div id="topic-posts" data-topic-tags="<tag>" data-topic-limit="3">`
   between sections, which `renderTopicPosts` fills with the latest posts
   on the page's subject.
5. Optionally the photo strip (`#instagram-section`, `renderPhotoStrip`)
   and always the footer.

`about.html` and `literature.html` are good models.

## Accessibility

What every component keeps to (the essay:
[Making This Website Accessible](https://www.kenreid.co.uk/blog/making-this-website-accessible.html)):

- **Contrast.** 4.5:1 for text, 3:1 for large text and for a focus ring or
  other mark, in both themes, on every surface it sits on; on a
  photograph, against the lightest part of the image under the letters.
  `tests/test_contrast.py` checks the tokens and the smoke suite's
  `check_contrast` checks rendered pages.
- **Focus.** The site's ring is `:focus-visible` only, in `--kr-focus`
  with the `--site-focus-shadow` halo. A component that needs its own
  ring sets it with a class selector on `:focus-visible`, which outranks
  the element rules, rather than with `!important`. The smoke suite
  presses Tab for real and checks the ring appears.
- **Motion.** Everything that moves has a `prefers-reduced-motion`
  answer: the demos mount paused, the carousels start paused, the hover
  sketches never load, the hero's evolving headline is drawn as type.
- **Floating UI.** Something that fades or slides away gets
  `.kr-offstage` (§10, "Share rail and share sheet") and toggles
  `.is-visible`; the component supplies the opacity or transform. The
  recipe sets `visibility: hidden` once hidden, so its controls leave the
  tab order, flipped at the end of the hide transition and the start of
  the show.
- **Announcements.** A live region says what changed and stops: the
  listings' `.kr-list-counter`, the demos' throttled status line, the
  lightbox's position. Nothing announces on every frame.
- **Carousels** have a pause button that holds (WCAG 2.2.2), start paused
  under reduced motion, and make off-screen slides inert.

## Adding a component

1. Decide where it belongs in `style.css` and add a sub-banner there
   (`/* --- Name --- */`), saying what builds it, which classes only script
   applies, and which tokens it reads. Read tokens; add one to §01 (both
   blocks, with its measured contrast) only if none fits.
2. If script builds its markup, put the builder in
   `js/shared-components.js` (a `render*` function taking a host, or an
   `init*` that finds its markup), escape data with `krEscapeHtml`, and
   make sure the pruner can see every class it applies (whole class
   names in literals, or `RUNTIME_TOKENS` in `css_prune.py`).
3. If it is written into posts, give it an entry in
   [COMPONENTS.md](COMPONENTS.md) with its markup and its "do not".
4. `git add -N` any new file, then `run_checks.py --fix`, and look at it in
   both themes at a phone width and a desktop width.
