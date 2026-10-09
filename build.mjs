/* ============================================================
   PAWBIN STATIC BUILD
   Assembles components/ into fully pre-rendered pages in dist/:
     - dist/index.html            (all 15 components inlined)
     - dist/product.html          (legacy ?p= runtime page, assembled)
     - dist/product/<slug>.html   (one pre-rendered page per toy,
                                   with per-product <title>, OG tags,
                                   canonical + JSON-LD)
   No runtime component fetching in the shipped output: the loader
   stays a dev-only convenience for `python3 -m http.server`.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.cwd();
const DIST = path.join(SRC, 'dist');
const SITE = 'https://pawbin.vercel.app';

/* ---------- fresh dist ---------- */
fs.rmSync(DIST, { recursive: true, force: true });
for (const d of ['', '/product', '/assets', '/css', '/js']) fs.mkdirSync(path.join(DIST, d), { recursive: true });
for (const d of ['assets', 'css', 'js']) {
  fs.cpSync(path.join(SRC, d), path.join(DIST, d), { recursive: true });
}

/* ---------- load data + shared renderer without a DOM ---------- */
const shim = {
  addEventListener() {}, images: [],
  getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
};
const win = {};
new Function('window', 'document', fs.readFileSync(path.join(SRC, 'js/data.js'), 'utf8'))(win, shim);
new Function('window', 'document', 'globalThis', fs.readFileSync(path.join(SRC, 'js/pdp-render.js'), 'utf8'))(win, shim, win);
const P = win.PAWBIN_PRODUCTS;
const R = win.PawbinRender;

/* ---------- assemble a page from data-component slots ---------- */
function assemble(html) {
  return html.replace(/<div data-component="([\w-]+)"\s*>\s*<\/div>/g, (m, name) => {
    return fs.readFileSync(path.join(SRC, 'components', name + '.html'), 'utf8').trim();
  });
}
/* dev loader is not needed once everything is inlined; the #boot
   splash only makes sense while the loader runs, so drop it too */
function stripLoader(html, scripts) {
  html = html.replace(/<script[^>]*src="js\/loader\.js"[^>]*>\s*<\/script>/, scripts);
  html = html.replace(/<div id="boot"[\s\S]*?<\/div>\s*/, '');
  html = html.replace(/<style>\s*#boot[\s\S]*?<\/style>/, '');
  return html;
}

/* ---------- index.html ---------- */
let index = assemble(fs.readFileSync(path.join(SRC, 'index.html'), 'utf8'));
index = stripLoader(index, '<script src="js/app.js" defer></script>');
index = index.replace(/href="product\.html\?p=([\w-]+)"/g, 'href="product/$1.html"');
fs.writeFileSync(path.join(DIST, 'index.html'), index);

/* ---------- product.html (legacy runtime page, assembled) ---------- */
let prodShell = assemble(fs.readFileSync(path.join(SRC, 'product.html'), 'utf8'));
prodShell = stripLoader(prodShell,
  '<script src="js/data.js" defer></script><script src="js/pdp-render.js" defer></script>' +
  '<script src="js/app.js" defer></script><script src="js/product.js" defer></script>');
prodShell = prodShell.replace(/href="product\.html\?p=([\w-]+)"/g, 'href="product/$1.html"');
fs.writeFileSync(path.join(DIST, 'product.html'), prodShell);

/* ---------- per-product pre-rendered pages ---------- */
const rootOpts = {
  base: '', indexLink: h => 'index.html' + h, productLink: s => 'product/' + s + '.html',
};
const nestedOpts = {
  base: '../', indexLink: h => '../index.html' + h, productLink: s => '../product/' + s + '.html',
};

for (const slug of Object.keys(P)) {
  const p = P[slug];
  const out = R.render(P, slug, nestedOpts);
  if (!out) continue;

  let page = prodShell;
  /* paths one level deep */
  page = page
    .replace(/src="js\//g, 'src="../js/')
    .replace(/href="css\//g, 'href="../css/')
    .replace(/src="assets\//g, 'src="../assets/')
    .replace(/href="assets\//g, 'href="../assets/')
    .replace(/href="index\.html/g, 'href="../index.html')
    .replace(/href="product\.html/g, 'href="../product.html');

  const price = (p.price / 100).toFixed(2);
  const img = SITE + '/assets/img/' + p.img + '.webp';
  const url = SITE + '/product/' + slug + '.html';

  /* per-product metadata */
  page = page.replace(/<title>[^<]*<\/title>/, '<title>' + out.title.replace(/&/g, '&amp;') + '</title>');
  page = page.replace(/<meta name="description" content="[^"]*">/, '<meta name="description" content="' + out.desc.replace(/"/g, '&quot;') + '">');
  page = page.replace(/<link rel="canonical" href="[^"]*">/, '<link rel="canonical" href="' + url + '">');
  page = page.replace(/<meta property="og:title" content="[^"]*">/, '<meta property="og:title" content="' + p.name.replace(/"/g, '&quot;') + ' — £' + price + ' | Pawbin">');
  page = page.replace(/<meta property="og:description" content="[^"]*">/, '<meta property="og:description" content="' + out.desc.replace(/"/g, '&quot;') + '">');
  page = page.replace(/<meta property="og:image" content="[^"]*">/, '<meta property="og:image" content="' + img + '">');
  page = page.replace(/<meta property="og:url" content="[^"]*">/, '<meta property="og:url" content="' + url + '">');
  page = page.replace(/<meta name="twitter:title" content="[^"]*">/, '<meta name="twitter:title" content="' + p.name.replace(/"/g, '&quot;') + ' | Pawbin">');
  page = page.replace(/<meta name="twitter:image" content="[^"]*">/, '<meta name="twitter:image" content="' + img + '">');

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name, image: img, description: out.desc, url,
    brand: { '@type': 'Brand', name: 'Pawbin' },
    offers: { '@type': 'Offer', priceCurrency: 'GBP', price, availability: 'https://schema.org/InStock', url },
    aggregateRating: { '@type': 'AggregateRating', ratingValue: p.rating, reviewCount: p.count },
  };
  page = page.replace('</head>', '<script type="application/ld+json">' + JSON.stringify(ld) + '</script>\n</head>');

  /* pre-rendered body */
  page = page.replace(/<div class="pdp" id="pdpRoot">[\s\S]*?<\/div>/,
    '<div class="pdp" id="pdpRoot" data-prerendered="' + slug + '">\n' + out.html + '\n</div>');

  fs.writeFileSync(path.join(DIST, 'product', slug + '.html'), page);
}

console.log('build ok:', Object.keys(P).length, 'product pages + index + product shell');
