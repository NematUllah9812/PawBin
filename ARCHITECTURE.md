# Pawbin — Complete Architecture & Performance Engineering Report

> A maximally detailed account of how this storefront is built, how it ships, and exactly how
> performance, accessibility, SEO and CSS quality were measured and improved across three
> engineering passes (initial build → performance pass → audit remediation → re-audit fixes).
>
> Live: `https://pawbin.vercel.app` · Repo: `github.com/NematUllah9812/PawBin`

---

## Table of contents

1. [System overview](#1-system-overview)
2. [Repository layout](#2-repository-layout)
3. [Dual-mode architecture: dev runtime loader vs production SSG](#3-dual-mode-architecture)
4. [The build pipeline (`build.mjs`) in detail](#4-the-build-pipeline)
5. [Deployment (`vercel.json`, caching model)](#5-deployment--caching-model)
6. [Data layer (`js/data.js`)](#6-data-layer)
7. [The shared PDP renderer (`js/pdp-render.js`)](#7-the-shared-pdp-renderer)
8. [Runtime behaviour layer (`js/app.js`)](#8-runtime-behaviour-layer)
9. [Product page runtime (`js/product.js`)](#9-product-page-runtime)
10. [CSS architecture](#10-css-architecture)
11. [Colour system & WCAG contrast mathematics](#11-colour-system--wcag-contrast-mathematics)
12. [Performance engineering — baselines, techniques, measured results](#12-performance-engineering)
13. [Accessibility & UX engineering](#13-accessibility--ux-engineering)
14. [SEO engineering](#14-seo-engineering)
15. [QA & regression engineering](#15-qa--regression-engineering)
16. [Audit scorecard evolution](#16-audit-scorecard-evolution)
17. [Known limitations & roadmap](#17-known-limitations--roadmap)
18. [Operating the project](#18-operating-the-project)

---

## 1. System overview

Pawbin is a **static, dependency-free storefront** (no framework, no bundler, no npm packages)
for cat & dog toys. It has two execution modes that share one source of truth:

```
                        ┌────────────────────────────┐
                        │  SOURCE (repo root)        │
                        │  components/*.html (15)    │
                        │  js/*.js · css/styles.css  │
                        │  assets/{img,icons,thumbs} │
                        │  js/data.js (28 products)  │
                        └─────────────┬──────────────┘
                     dev │                          │ production (Vercel build)
              python3 -m http.server        node build.mjs  (vercel.json buildCommand)
                         ▼                          ▼
              ┌────────────────────┐     ┌─────────────────────────────┐
              │ loader.js fetches  │     │ dist/                       │
              │ 15 fragments at    │     │  index.html   (assembled)   │
              │ runtime, assembles │     │  product.html (legacy shell)│
              │ DOM, boots app.js  │     │  product/<slug>.html ×28    │
              └────────────────────┘     │   pre-rendered PDP + meta   │
                                         │   + JSON-LD, no loader      │
                                         └─────────────────────────────┘
```

Design principles enforced throughout:

1. **Component modularity in source** — 15 HTML fragments, never one hand-maintained monolith.
2. **Pre-rendered output in production** — zero runtime fragment fetches, full no-JS rendering,
   crawler-complete metadata (this is classic SSG; the loader survives only as a dev tool).
3. **One renderer, two consumers** — the PDP markup generator is a pure string function used by
   both the browser and the build, so shipped HTML and runtime HTML can never drift.
4. **Zero build dependencies** — `build.mjs` uses only Node's standard library; Vercel needs no
   install step.
5. **Token-first CSS** — every colour, radius and shadow resolves to a custom property; the
   palette is WCAG-audited with real luminance math.

---

## 2. Repository layout

```
pawbin/
├── index.html              Dev shell: <head> meta/JSON-LD + 15 <div data-component> slots
├── product.html            Dev PDP shell: header/footer slots + #pdpRoot + not-found copy
├── build.mjs               SSG: assembles dist/ (index, product shell, 28 product pages)
├── vercel.json             buildCommand, outputDirectory, immutable cache headers
├── components/             The 15 source-of-truth fragments:
│   ├── announcement.html      Top ribbon (free-delivery/trade message, dismissible)
│   ├── header.html            Sticky nav: logo, desktop links, burger, cart button, CTA
│   ├── hero.html              H1 with decorative slot-machine icons + shuffle button,
│   │                          hero photo (preloaded LCP element), proof line, CTAs
│   ├── reviews.html           Press/testimonial strip
│   ├── why.html               5 horizontal product marquees + pause toggle (WCAG 2.2.2)
│   ├── shop.html              Tabbed catalogue: 12 dog + 12 cat cards + 4 bundle cards,
│   │                          every card image & title wrapped in product-page links
│   ├── gifting.html           Bundle promo with two vertical marquees + pause toggle
│   ├── trade.html             Wholesale / drop-shipping section
│   ├── stories.html           Editorial story cards
│   ├── guides.html            Guide cards with honest "Friday drop" CTAs + newsletter form
│   ├── faq.html               FAQ accordion
│   ├── trust.html             Guarantees / trust grid
│   ├── final.html             Closing CTA band
│   ├── footer.html            Footer: link columns, wordmark toy-rain easter egg, legal
│   └── overlays.html          Cart drawer (dialog), scrim, cookie banner, toast, toTop
├── js/
│   ├── loader.js             DEV-ONLY assembler (stripped from built output)
│   ├── app.js                All shared behaviour (~300 lines, IIFE, strict mode)
│   ├── data.js               28-product catalogue — single source of truth
│   ├── pdp-render.js         Pure PDP renderer shared by browser + build
│   └── product.js            Thin runtime wrapper for legacy product.html?p= pages
├── css/styles.css            ~40 KB token-based stylesheet
├── assets/
│   ├── img/*.webp            Full-size photography (q78, method 6)
│   ├── icons/*.webp          Tiny square crops (hero slots, footer rain, mini glyphs)
│   ├── thumbs/*.webp         192 px variants for 96/160 px boxes (q72)
│   └── favicon.svg
├── ARCHITECTURE.md           This document
└── README.md                 Quick start + change log
```

Nothing else ships: no node_modules, no lockfile, no framework runtime.

---

## 3. Dual-mode architecture

### 3.1 Development mode — the runtime loader

`python3 -m http.server` at the repo root serves the source tree directly. `index.html` and
`product.html` contain empty slots:

```html
<div data-component="hero"></div>
```

`js/loader.js` (the last script in `<body>`) collects all slots, fires **parallel** `fetch()`
calls for `components/<name>.html`, parses each response into a `<template>` and swaps it in
with `slot.replaceWith(template.content)`. A counter boots the app only when every fragment
resolved:

```js
.then(function () { if (--pending === 0) boot(); });
```

`boot()` removes the `#boot` splash, appends `<script src="js/app.js">`, and on `app.js`'s
`onload` walks `body[data-scripts]` (e.g. `js/data.js,js/pdp-render.js,js/product.js` on the
PDP) as a sequential chain so page-specific scripts load in order after the shared behaviour.

Failure model: any failed fetch pushes the component name to `failed[]`; `boot()` then replaces
the app with a friendly "serve the folder" card (class `.boot-fallback`) instead of a half-built
page. This SPOF behaviour is acceptable **because it is dev-only** — production never runs it.

Why keep it at all? Because the component architecture was a hard product requirement, and the
loader makes `python3 -m http.server` a complete dev environment with zero tooling.

### 3.2 Production mode — static site generation

Vercel runs `node build.mjs` (see §4) and serves `dist/`. The built pages contain:

- **all 15 components inlined** — the 15-request waterfall simply does not exist;
- **no `loader.js` reference** — replaced by direct `<script src="js/app.js" defer>`;
- **no `#boot` splash** — stripped at build time (and `app.js` also removes it at runtime as a
  double safety, which also fixed dev pages);
- **28 extra URLs** `/product/<slug>.html`, each a complete, crawler-ready product page.

The browser's speculative **preload scanner** now sees the hero image, stylesheet and scripts in
the first HTML bytes — the single biggest latency win in the project (§12).

### 3.3 Why both modes coexist safely

Every behaviour lives in code paths that are mode-agnostic:

| Concern | Dev | Production |
|---|---|---|
| Component assembly | loader.js at runtime | build.mjs at deploy |
| `#boot` splash | shown while fetching, removed by loader | absent (stripped by build; app.js also removes) |
| PDP markup | product.js renders from data.js | pre-rendered by build; product.js skips (`data-prerendered`) |
| Product links | `product.html?p=<slug>` | rewritten to `product/<slug>.html` |
| Asset paths | relative `assets/…` | root pages `assets/…`, nested pages `../assets/…` |

Path relativity is resolved at runtime by `assetBase()`: it scans `document.images` for the
first successfully-loaded image (`naturalWidth > 0`) and derives the prefix from its `src`,
so cart/rain/slot images always resolve regardless of page depth.

---

## 4. The build pipeline

`build.mjs` (~150 lines, Node stdlib only) runs on Vercel via `vercel.json`:

1. **Reset & copy** — `fs.rmSync(dist)`, recreate, then `cpSync` `assets/`, `css/`, `js/`.
2. **Load data without a DOM** — `js/data.js` is evaluated with `new Function('window','document', code)`
   against a minimal shim; it assigns `window.PAWBIN_PRODUCTS`. `js/pdp-render.js` is evaluated
   the same way and attaches `window.PawbinRender`.
3. **Assemble** — `assemble()` regex-replaces every `<div data-component="X"></div>` with the
   file contents of `components/X.html`.
4. **Strip dev machinery** — `stripLoader()` swaps the loader `<script>` tag for real deferred
   script tags and deletes the `#boot` div plus its inline `<style>` block.
5. **Rewrite links** — `product.html?p=<slug>` → `product/<slug>.html` in assembled output.
6. **Emit three kinds of pages**:
   - `dist/index.html` — the assembled homepage;
   - `dist/product.html` — the assembled legacy shell (keeps `?p=` links alive forever);
   - `dist/product/<slug>.html` for each of the 28 catalogue keys — the assembled shell with:
     - `src="js/…"` → `src="../js/…"`, same for css/assets (one folder deep);
     - `<title>`, meta description, canonical, `og:title/description/image/url`,
       `twitter:title/image` replaced per product;
     - a Schema.org `Product` JSON-LD block (brand, offer with GBP price & availability,
       `aggregateRating` with the catalogue rating and review count) injected before `</head>`;
     - the **pre-rendered PDP body** inserted into `#pdpRoot` (with `data-prerendered="<slug>"`
       so the runtime renderer skips re-rendering).

Because step 2 evaluates the *same* `pdp-render.js` the browser uses, shipped markup and runtime
markup are byte-identical for identical data — drift is structurally impossible.

---

## 5. Deployment & caching model

```jsonc
// vercel.json
{
  "buildCommand": "node build.mjs",
  "outputDirectory": "dist",
  "headers": [
    { "source": "/(.*)",        "headers": [{ "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }] },
    { "source": "/assets/(.*)", "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
    { "source": "/css/(.*)",    "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] },
    { "source": "/js/(.*)",     "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }] }
  ]
}
```

- **HTML** stays `must-revalidate` so deploys go live instantly.
- **CSS/JS/images** are immutable for one year. Today this is safe without content-hashing
  because every change to those files ships together with an HTML change that revalidates;
  the browser re-reads HTML on each visit and therefore picks up new asset URLs on deploy.
  (If asset churn ever outpaces HTML visits, the upgrade path is content-hashed filenames.)
- Vercel re-runs the build on every push to `main`; there is nothing to configure in the UI.

---

## 6. Data layer

`js/data.js` is the single source of truth: one object literal, `window.PAWBIN_PRODUCTS`,
keyed by slug — 12 dogs, 12 cats, 4 bundles. Schema per item:

```js
'kong-classic': {
  name, species: 'dog'|'cat'|'bundle', price: 1199 /* pence */,
  img: 'dog-kong-classic'           /* asset stem, extension added by renderers */,
  tags: ['chew','tough'], rating: 4.8, count: 1243,
  blurb, details: [2 paragraphs], specs: [[k,v]×4],
  reviews: [{ n, loc, d, r, v, h, t }],   /* name, location, ISO date, stars, verified, helpful, text */
  contains: [slugs]                 /* bundles only */
}
```

Deliberate data policies:

- **Realistic, varied reviews** — ratings span 4.2–4.8, star histograms are derived
  (`hist()` in the renderer: five-star share clamped to 38–80 %, remainder split 60/30 across
  three/two/one), and every product carries at least one critical review ("we publish the
  grumpy ones too").
- **Real UK-dropshippable product types** — the catalogue mirrors items sourced from UK
  wholesalers (KONG, Chuckit!, snuffle mats, lick mats, tunnels, perches…).
- Prices are integer pence; `money()` formats `£x.yz`.

---

## 7. The shared PDP renderer

`js/pdp-render.js` is a UMD-ish IIFE that attaches `window.PawbinRender` (browser) or
`globalThis.PawbinRender` (Node). **No DOM access anywhere** — only string templates.

API:

```js
PawbinRender.render(P, slug, opts) → { html, title, desc } | null
PawbinRender.renderMissing(opts)   → html
opts = { base:'', indexLink:fn(hash), productLink:fn(slug) }
```

`opts` parameterises everything environment-specific, which is what makes one renderer serve
three consumers:

| Consumer | base | indexLink | productLink |
|---|---|---|---|
| dev `product.html?p=` | `''` | `index.html#…` | `product.html?p=…` |
| built root pages | `''` | `index.html#…` | `product/<slug>.html` |
| built nested pages | `'../'` | `../index.html#…` | `../product/<slug>.html` |

Output sections (in order): breadcrumb → gallery (eager hero-grade image with
`fetchpriority="high"`, bundle thumbnails) → buy box (eyebrow, `h1`, rating link to `#reviews`,
price, blurb, tag chips, **coral** add-to-basket button with full `data-add` payload, three
guarantee facts, details paragraphs, spec table) → reviews (summary + 5 histogram bars +
review cards) → related grid (bundles show their contents; otherwise scored by species +2,
shared tags +2 each, containing-bundle +4, top 4).

All dynamic text passes through `esc()` (HTML-entity escaping). Related-card add buttons and
the main button use the global `[data-add]` delegation in `app.js`, so no per-button wiring is
needed at render time.

---

## 8. Runtime behaviour layer

`js/app.js` is one strict-mode IIFE organised into labelled sections. Inventory:

1. **Boot hygiene** — removes any leftover `#boot` splash immediately.
2. **Helpers** — `$`/`$$` query shorthands, `money()`, `reduce`
   (`prefers-reduced-motion`), `PICKS` (rain/slot slug pool), `assetBase()` (§3.3).
3. **Announcement dismiss** — hides the top ribbon.
4. **Mobile menu** — burger toggles `#mobileMenu`, `aria-expanded`, closes on link click.
5. **Hero slot machine** — two decorative `<span class="slot">` boxes cross-fade product
   icons on a per-slot `setInterval`; timers are **cleared** when the hero leaves the viewport
   (IntersectionObserver) or the tab hides (`visibilitychange`), and recreated on return.
   Slots are `aria-hidden`; a separate visible `#shuffleToys` button advances them on demand,
   keeping interactive controls out of the `<h1>` accessibility tree.
6. **Tabs** — ARIA tablist with mouse + full keyboard support (arrows/Home/End);
   `openFromHash()` maps `#cats/#dogs/#bundles/#panel-new` to tabs, scrolls the panel, and —
   added during the performance pass — falls back to `scrollIntoView` for **any other** hash,
   because components are injected after `load` and the browser's native anchor scroll never
   got a chance.
7. **Cart** — `pawbin_cart_v1` in localStorage; `add()` strips any image extension and stores
   the slug; `render()` rebuilds the drawer list, count badge and the free-delivery progress
   bar (threshold £25); quantity +/− and remove are delegated via `data-inc/dec/rm`.
   **`[data-add]` clicks are delegated on `document`** so buttons rendered later by product.js
   work without re-binding (a bug caught by QA when the renderer moved).
8. **Drawer accessibility** — `role="dialog"`, `aria-modal="true"`, `aria-labelledby="cartTitle"`;
   opening focuses `#cartClose`, sets `main.inert = true`, and installs a Tab/Shift+Tab
   **focus trap** cycling between the first and last visible focusable elements; closing
   restores focus to the cart button and removes `inert`.
9. **Toast** — `role="status"` live region, bottom-centre, lifted above the cookie banner when
   both are visible.
10. **Guide CTAs** — `.guide-cta` scrolls to the newsletter card and focuses the email input;
    labels were renamed to honest copy ("Get this guide in the Friday drop").
11. **Cookie banner** — appears after **3.5 s** (was 1.4 s) only if no stored choice; Accept/Deny
    persist to `pawbin_cookies`; `#cookieLink` in the footer re-opens it.
12. **Footer wordmark rain** — clicking a letter drops up to 10 toy icons with randomised
    transform/rotation; a **cap of 40 concurrent `.falling` nodes** prevents click-spam DOM
    thrash; icons resolve through `imgPath()` (base-aware).
13. **Cross-page anchors** — a window-level click interceptor: for `a[href^="#"]` whose target
    id does **not** exist on the current page, `preventDefault()` and navigate to
    `pageBase + 'index.html#' + id` (`pageBase` is `'../'` on nested product pages). Hashes
    that exist locally (`#top`, `#reviews`, `#legal`) keep native behaviour. This made header,
    burger and footer links work from product pages.
14. **Reveal-on-scroll** — IntersectionObserver adds `.in`; reduced-motion or missing IO shows
    everything immediately.
15. **Marquee pause (WCAG 2.2.2)** — `.mq-toggle` buttons toggle `.mq-paused` on their section
    (`aria-pressed` + label swap "Pause/Resume the shelf"); CSS also auto-pauses on
    `:focus-within`.
16. **Smart toTop** — visible when `scrollY > 600` **and** the footer is <50 % intersecting
    (threshold raised from 0.04 → 0.5 so short product pages don't hide it mid-scroll); hidden
    while the cookie banner is open (user's original choice) and at the very bottom, where the
    footer's permanent "Back to top" link takes over; 40 px on phones with safe-area insets.
17. **Image 404 fallback** — a capture-phase error listener retries failed `data-f` images
    against a prefix ladder (`assets/img/`, `pawbin/assets/img/`, `/pawbin/assets/img/`),
    which is what makes the same tree work from any mount point.

---

## 9. Product page runtime

`js/product.js` is now ~30 lines: parse `?p=` (or `data-prerendered`, or the
`/product/<slug>.html` path), call `PawbinRender.render()`, set `document.title`, inject the
HTML — or the not-found state ("That toy has wandered off."). If the page was pre-rendered by
the build with the same slug, it **returns immediately**: shipped HTML is already correct and
the runtime adds nothing but behaviour (which lives in `app.js` delegation anyway).

---

## 10. CSS architecture

`css/styles.css` (~40 KB, no preprocessor) after the remediation pass:

- **Tokens (`:root`)** — green ramp `--g-25…--g-900`; neutrals `--ink/--ink-2/--ink-3/--ink-4`;
  surfaces `--canvas/--surface/--surface-2/--surface-3`; darks `--inverse/--inverse-2/
  --footer-bg`; accents `--amber`, `--amber-700`, `--coral`, `--coral-ink`, `--footer-txt`;
  radii, three shadow elevations, `--max:1280px`, system `--font` stack.
- **Breakpoints: exactly 3** — `640px`, `768px`, `1024px` (plus `prefers-reduced-motion`).
  The previous 8-value maze (640/700/760/768/900/920/980/1000) was collapsed: 700 & 760→768,
  900/920/980/1000→1024.
- **Typography rules** — system stack *without* the phantom "Inter" entry; only real static
  weights **600 / 700 / 900** (650/750/800/850 "ghost" weights eliminated); heading tracking
  relaxed to `-.02em` and hero leading raised to `1.04` so wrapped lines never collide on
  ClearType/narrow viewports.
- **Utility layer** — margin/size/row helpers (`.mt-*`, `.ml-*`, `.maxw-*`, `.row-end`,
  `.row-c`, `.row-wrap-c`, `.flex-none`, `.tc`, `.as-c`, `.fs-*`, `.chip-dark*`, `.grad-*`,
  `.bg-g25`, `.txt-*`, `.icon-32`, `.ci-total`, `.boot-fallback`) that absorbed **all 48 static
  inline `style=""` attributes** (62 counting JS templates) during the purge.
- **Dead code deleted** — `.badge-sale`, `.btn-quiet`, `.chip-sel`, `.center-x`, `.gap-*`,
  `.items-end`, `.mt-56`, `.section-tight`, and the abandoned `.stack-*` system.
- **Compositor hygiene** — `content-visibility:auto; contain-intrinsic-size:1px 420px` on
  marquee containers so off-screen animation costs nothing; marquees mask-fade at the edges.
- **Buttons** — `.btn-primary` (dark green, navigation), `.btn-green` (secondary green,
  hover = `--g-400` bg + dark ink, 9.29:1), and the new **`.btn-coral`** for conversion
  (hover via `filter:brightness(.93)` so contrast can never collapse).

---

## 11. Colour system & WCAG contrast mathematics

Every ratio below uses the WCAG relative-luminance formula
`(L1+0.05)/(L2+0.05)` and was verified numerically before shipping:

| Element | Before | After | Ratio now | Requirement | Status |
|---|---|---|---|---|---|
| `.btn-green:hover` text/bg | `#fff` on `#589E37` | `--ink` on `--g-400` | **9.29:1** | 4.5 | ✅ AAA |
| Muted text `--ink-4` on canvas | `#86978B` | `#57695E` | **5.56:1** | 4.5 | ✅ AA |
| Star icons on white | `#F2A63B` | `--amber-700 #B47708` | **3.76:1** | 3.0 (UI) | ✅ |
| Footer legal on `--footer-bg` | `rgba(…, .45)` | `--footer-txt #93A88F` | **7.04:1** | 4.5 | ✅ AAA |
| `.btn-coral` text/bg | new | `--coral-ink` on `--coral` | **6.12:1** | 4.5 | ✅ AA |
| Eyebrow `--g-700` on canvas | unchanged | | 4.81:1 | 4.5 | ✅ |
| Body `--ink` on canvas | unchanged | | 15.8:1 | 4.5 | ✅ |

**Semantic colour split (per the audit):** warm coral now marks *conversion* (add-to-basket
everywhere incl. PDP & related cards, checkout, Shop-bundles CTAs, cart count badge); green
remains the *trust/brand* hue (guarantees, badges, secondary buttons, progress). Near-identical
hex clusters (9 off-whites, 8 near-blacks) were consolidated onto tokens.

---

## 12. Performance engineering

### 12.1 Measurement methodology

All numbers come from headless Chromium via Playwright using the Resource Timing API
(`performance.getEntriesByType('resource')`, summed `transferSize`) in **fresh browser
contexts** (no cache pollution), 1440×950 viewport, served over local HTTP.

### 12.2 The original waterfall (measured)

```
0ms   index.html skeleton (15 empty slots + #boot splash)
 └─> styles.css + loader.js
      └─> 15 parallel fetch(components/*.html)      ← preload scanner blind
           └─> innerHTML assembly (~1,700 nodes)
                └─> app.js (dynamic <script>)
                     └─> images discovered          ← LCP candidate starts here
```

Measured baseline: **2,453 KB transferred, 66 requests, of which 2,295 KB (93.6 %) was JPEG
images**; LCP delayed by ~1 s of pure script/network overhead; `Cache-Control:
max-age=0, must-revalidate` on every asset forced revalidation on each visit.

### 12.3 Optimisation 1 — WebP everywhere (pass 2)

- All 60+ JPEGs re-encoded to WebP (quality 78, method 6) with PIL; originals deleted.
- Sample: `dog-kong-classic` 44 KB → **12 KB** (−73 %). Whole `assets/` dir:
  **3,449 KB → 1,714 KB (−50 %)**.
- Every reference rewritten across components, JS (`imgPath`, rain, cart, PDP renderer) and
  meta tags; the extension-stripping `add()` made cart payloads format-agnostic.
- Result (still on the loader architecture): index **2,453 → 1,290 KB (−47 %)**, zero broken
  references, all images decoding (`naturalWidth` sweep in QA).

### 12.4 Optimisation 2 — kill the waterfall with SSG (pass 3)

- `build.mjs` inlines all components; the built `index.html` needs **no fragment fetches**.
- Measured built site, cold context: **index = 8 requests / 217 KB at `load`** (remaining
  images are `loading="lazy"` below the fold), **DCL ≈ 115 ms**; product page **10 requests /
  304 KB**.
- The preload scanner now discovers `styles.css`, `app.js` and the hero image in the first
  response; FCP/LCP moved from "after 16 requests" to "after 2".

### 12.5 Optimisation 3 — LCP priority

- `<link rel="preload" as="image" href="assets/img/hero-tall.webp" fetchpriority="high">` in
  `index.html` head (dev + built).
- Hero `<img>` itself is eager with `fetchpriority="high" decoding="async"`.
- PDP main gallery image likewise eager + high priority in the renderer.

### 12.6 Optimisation 4 — immutable caching (§5)

- `/assets`, `/css`, `/js` → `public, max-age=31536000, immutable`; repeat visits are pure
  memory-cache hits; HTML stays revalidating for instant deploys.

### 12.7 Optimisation 5 — right-sized bytes & zero CLS

- **Intrinsic dimensions**: 156 `<img>` tags received real `width`/`height` attributes (written
  from the actual files by script), reserving layout before decode → no shift as images stream.
- **192 px thumbs**: 24 product crops (`assets/thumbs/`, q72, **67 KB total**) now serve every
  96 px/160 px box that previously downloaded 820–1024 px files; full size kept only as the
  `data-f` 404 fallback.
- Everything below the fold is `loading="lazy" decoding="async"`.

### 12.8 Optimisation 6 — runtime CPU/GPU budget

- Hero slot timers **cleared** off-screen / tab-hidden (IO + `visibilitychange`).
- Marquee containers get `content-visibility:auto` + `contain-intrinsic-size` → off-screen
  animation is skipped by the renderer entirely.
- Footer rain capped at 40 concurrent nodes.
- Reduced-motion preference disables marquees, rain, slots and smooth scrolling.

### 12.9 Results ledger

| Metric | Original | After WebP | After SSG (built) |
|---|---|---|---|
| index transfer @load | 2,453 KB / 66 req | 1,290 KB / 66 req | **217 KB / 8 req** |
| index DCL | waterfall-bound | ~36 ms local | **~115 ms** w/ full parse |
| product page | n/a | 314 KB / 14 req | **304 KB / 10 req** |
| assets on disk | 3,449 KB (JPEG) | 1,714 KB (WebP) | 1,714 KB + 67 KB thumbs |
| asset caching | max-age=0 | max-age=0 | **1 y immutable** |
| LCP discovery | post-16-request | post-16-request | **first HTML bytes** |

---

## 13. Accessibility & UX engineering

- **Cart drawer**: true modal dialog — `role="dialog"`, `aria-modal`, labelled by its title;
  Tab/Shift+Tab focus trap; page behind goes `inert`; focus restored to the cart button on
  close; Escape/`scrim` close. QA tab-cycles 12 times and asserts focus never escapes.
- **WCAG 2.2.2 motion**: visible pause toggles on both marquee sections with `aria-pressed`
  and label swap; `:focus-within` auto-pause so keyboard users aren't carried away mid-card.
- **Heading hygiene**: interactive slot buttons removed from the `<h1>` tree (`aria-hidden`
  decorative spans) with an accessible standalone "shuffle the toys" button.
- **Honest copy**: guide cards say "Get this guide in the Friday drop" (the action they
  perform); cookie banner delayed to 3.5 s; fixed-position banner ⇒ zero CLS.
- **toTop**: smart float (600 px threshold, hides at footer via 0.5 intersection, hidden while
  cookie banner is up by design, permanent footer "Back to top" link, safe-area aware).
- **Cross-page navigation**: header/burger/footer section links work from every page via the
  hash interceptor + post-injection `openFromHash` scroll fallback.
- **Keyboard**: skip link, full tablist arrow-key support, visible focus styles, `prefers-reduced-motion` respected everywhere animation exists.

---

## 14. SEO engineering

- **Home**: canonical, OG/Twitter cards, Organization+WebSite JSON-LD graph.
- **Per product (28 pages)**: unique `<title>` ("KONG Classic Chew Toy (M) — £11.99 | Pawbin"),
  meta description (the blurb), canonical `https://pawbin.vercel.app/product/<slug>.html`,
  per-product `og:*`/`twitter:*` with the product photo, and Schema.org `Product` JSON-LD
  including `offers` (GBP, InStock) and `aggregateRating`.
- **Domain harmony**: every canonical/og:url/JSON-LD id uses the same production domain.
- **No-JS**: built pages render the entire shop and full PDPs with JavaScript disabled
  (QA-verified with `java_script_enabled=False`); dev shells carry an honest `<noscript>`.
- Legacy `product.html?p=` remains indexed-safe: same renderer, runtime title swap.

---

## 15. QA & regression engineering

Every pass shipped behind a Playwright suite (headless Chromium, assertions + screenshots):

- **Navigation**: desktop nav, burger menu and footer links from product pages land on the
  right index tab/section; `#reviews`/`#top`/`#legal` stay local; logo goes home from subpages.
- **toTop**: appears mid-page, scrolls to 0, hides at top and at footer.
- **Cart**: add from card/PDP/related, count badge, toast, drawer dialog semantics, focus
  trap, `inert` lifecycle.
- **PDP**: title/rating/histogram/specs/related counts, bundle thumbs, not-found state,
  `?p=` legacy, pre-rendered nested pages, no-JS content.
- **Perf**: transfer/request ledgers in cold contexts; `naturalWidth` sweeps for broken images;
  HTTP ≥400 watcher; `pageerror` watcher (zero JS errors across all suites).
- **Layout**: 390 px mobile overflow check; footer-bottom gap check (the #boot regression);
  marquee pause state checks; canonical/OG assertions per page type.

---

## 16. Audit scorecard evolution

| Category | Initial audit | After remediation | Notes |
|---|---|---|---|
| Frontend architecture | 18 | 78 → fixed regressions | SSG + pre-rendered PDPs; ghost-splash regression fixed |
| Server & caching | 20 | 94 | immutable headers |
| Performance & web vitals | 32 | 81 | preload, waterfall collapse, thumbs |
| Colour palette & contrast | 52 | 88 | coral semantics + 5 mathematically fixed ratios |
| CSS architecture | 44 | 84 | 3 breakpoints, 0 inline styles, dead code purged |
| Accessibility | 46 | 74 → improved | dialog/trap/inert, 2.2.2 pauses; guide-trap copy fixed |

---

## 17. Known limitations & roadmap

Honest remaining work, in impact order:

1. **Density-aware `srcset`** — card/gallery images are single-file (820 px covers 2× at card
   size); true `srcset`/`sizes` ladders would save bytes on 1× desktops. Needs a second thumb
   tier (~480 px) and is the next perf win.
2. **Self-hosted variable font** — would guarantee identical metrics across OSes and unlock
   intermediate weights; costs ~100–250 KB woff2, so it trades against the current zero-font
   payload. Deliberately deferred.
3. **Content-hashed asset filenames** — required only if asset edits ever outpace HTML
   revalidation visits; trivial to add in `build.mjs` when needed.
4. **CSS/JS minification** — ~10–15 % byte win; omitted to keep shipped source readable and
   diffable (single-file, HTTP/2, immutable-cached — low value today).
5. **Per-product review pagination** and **search/filter UI** are product features, not
   architecture gaps.

---

## 18. Operating the project

```bash
# dev (component loader mode)
python3 -m http.server 8000          # then open /index.html

# production build (what Vercel runs)
node build.mjs                        # emits dist/
python3 -m http.server 8000 -d dist   # preview the built site locally

# deploy
git push origin main                  # Vercel builds + serves dist/ automatically
```

Conventions: components are the only place page copy lives; `data.js` is the only place
product data lives; `pdp-render.js` is the only place PDP markup lives; colours come from
`:root` tokens; breakpoints are 640/768/1024; weights are 600/700/900; conversion actions are
coral, trust signals are green.
