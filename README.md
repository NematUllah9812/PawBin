# Pawbin — cat & dog toy storefront

A complete marketing + storefront site built from the Mobbin breakdown
structure (`mobbin-website-breakdown (1).md`), restyled in a **light-green palette**
and filled with real cat & dog toy products that are genuinely available for
UK drop-shipping.

## Architecture (component-based)
`index.html` is a thin shell. At runtime `js/loader.js` fetches 15 HTML fragments
from `components/`, swaps each one into its `<div data-component="…">` placeholder,
then boots `js/app.js`. Final DOM is identical to a static page — no framework,
no build step, no dependencies.

```
pawbin/
├── index.html          # shell: <head>, placeholders, loader
├── css/styles.css      # full design system (tokens → components)
├── js/
│   ├── loader.js       # fetches + injects components, then boots app.js
│   └── app.js          # all interactions (tabs, cart, slots, rain, …)
├── components/         # 15 sections, in page order
│   ├── announcement.html  header.html     hero.html
│   ├── reviews.html       why.html        shop.html      (catalogue + tabs)
│   ├── gifting.html       trade.html      stories.html
│   ├── guides.html        faq.html        trust.html
│   ├── final.html         footer.html     overlays.html  (drawer + cookie + toast)
└── assets/             # img/ product + lifestyle photos, icons/ 24 chips
```

To add/reorder a section: drop a fragment in `components/` and add/move its
`<div data-component="name">` placeholder in `index.html`.

## Run it
Because components are fetched at runtime, the site must be served over HTTP
(`fetch` is blocked on `file://` — the loader shows an instruction card if so):
- **Locally:** `cd pawbin && python3 -m http.server 8000` → http://localhost:8000
- **Deploy:** upload the folder as-is (GitHub Pages, Netlify, any static host).
- Images auto-resolve whether the page is served from `/` or from a `/pawbin/`
  parent path (fallback handler at the top of `<body>` + runtime base detection).

## Palette (light green)
| Token | Value | Use |
|---|---|---|
| canvas | `#F5FBF1` | page background |
| surface | `#FFFFFF` | cards |
| surface-2 / g-50 / g-100 | `#EDF8E6` / `#DDF1CF` | tints, chips, bars |
| g-200 → g-400 | `#C7E9B2` `#AEDE92` `#93D272` | accents, paw mark, highlights |
| g-500 / g-600 | `#74BE4F` / `#589E37` | primary green buttons |
| g-700 / g-900 | `#427C28` / `#1E3D14` | text accents |
| ink | `#13211A` | headings/body |
| inverse | `#11241A` | dark buttons, trade section, footer |
| amber | `#F2A63B` | star ratings only |
Colour is carried by product photography; outside that, the UI is green + near-black.

## Sections (all filled)
Announcement bar · sticky header + mobile menu · hero with **clickable icon-slot machine**
(the chip cycles through 24 real toy icons) · review strip · problem→solution + 5
infinite marquee rows · *One shelf for every kind of play* with 4 filterable tabs
(**12 dog toys, 12 cat toys, 4 bundles, 4 new**) · bundle promo with dual vertical
marquees · **trade & drop-shipping** section with a live-looking supplier console ·
stories + quote/stats · guides · FAQ accordion · trust strip · final CTA + newsletter ·
dark footer with the **click-a-letter toy-rain easter egg** · cart drawer · cookie banner.

## Working interactions
Tabs, add-to-cart with `localStorage` persistence, quantity +/−, free-shipping
progress bar, toast notifications, newsletter validation, FAQ accordion, scroll reveal,
header `data-scrolled` morph, cookie accept/deny memory, and the footer toy-rain.

## The range (real, drop-shippable-in-the-UK product types)
**Dogs** — KONG Classic chew (£11.99) · Chuckit!-style ball launcher 26M (£14.99) ·
Snuffle feeder mat (£18.99) · sliding treat puzzle "brick" (£22.99) · knotted cotton
rope tug (£8.99) · wobble treat-dispensing ball (£13.99) · motion-activated smart ball,
USB-C (£26.99) · lick mat + slow feeder (£12.99) · 7-piece puppy teething set (£15.99) ·
soft flyer frisbee (£11.99) · tough plush tiger (£12.99) · no-stuff fox plush (£10.99).

**Cats** — feather wand teaser (£8.99) · ball circuit track (£21.99) · 3-tier track
tower (£16.99) · collapsible play tunnel (£17.99) · catnip bananas 4-pack (£7.99) ·
automatic laser chaser (£24.99) · motion-sensor mouse (£11.99) · rechargeable smart
ball (£19.99) · suction-cup window perch (£26.99) · sisal scratching post (£19.99) ·
crinkle kicker 2-pack (£9.99) · treat puzzle feeder (£15.99).

**Bundles** — Kitten Starter £32.99 · New Puppy Survival £44.99 ·
Rainy Day Enrichment £54.99 · Chew-Proof Big Dog £54.99.

Supply model described on the site matches how these categories actually move in the
UK: UK-warehouse fulfilment (Sheffield HQ in the copy) at 1–3 day tracked delivery,
trade from £4.10/unit, blind-branded dispatch, and integration with Shopify,
WooCommerce, Etsy, eBay, Amazon, Avasam, CJ Dropshipping, Spocket and the Royal Mail
Click & Drop API — all channels a UK pet-toy reseller can realistically automate.

## Demo-only notes
Fictional brand and copy (Pawbin Ltd, Sheffield address, order numbers). Product names
such as KONG, Chuckit! and Catit remain the property of their owners; prices, review
counts and statistics are illustrative, and the checkout is a demo (no payments).
Images are sourced from public product/stock listings for demonstration only.
