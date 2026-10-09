/* ============================================================
   PAWBIN PDP RENDERER — pure string templates, no DOM access.
   Shared by the browser (js/product.js) and the static build
   (build.mjs) so pre-rendered pages and runtime pages match.
   opts: { base:'', linkToIndex:fn(hash), linkToProduct:fn(slug) }
   ============================================================ */
(function (glob) {
  'use strict';

  var STAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z"/></svg>';
  var STAR_E = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1L12 2Z"/></svg>';

  function money(c) { return '£' + (c / 100).toFixed(2); }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function stars(r) {
    var out = '', full = Math.round(r);
    for (var i = 1; i <= 5; i++) out += (i <= full ? STAR : STAR_E);
    return '<span class="stars" aria-hidden="true">' + out + '</span>';
  }
  function fmtDate(s) {
    var m = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    var d = s.split('-');
    return (+d[2]) + ' ' + m[(+d[1]) - 1] + ' ' + d[0];
  }
  function imgTag(base, f, alt, eager) {
    return '<img src="' + base + 'assets/img/' + f + '.webp" data-f="' + f + '.webp" alt="' + esc(alt) + '"' + (eager ? ' fetchpriority="high"' : ' loading="lazy" decoding="async"') + '>';
  }
  function shared(a, b) { var n = 0; a.forEach(function (t) { if (b.indexOf(t) >= 0) n++; }); return n; }
  function related(P, slug) {
    var p = P[slug];
    if (p.contains) return p.contains.slice(0, 4);
    var arr = [];
    Object.keys(P).forEach(function (k) {
      if (k === slug) return;
      var q = P[k], sc = 0;
      if (q.species === 'bundle') { if ((q.contains || []).indexOf(slug) >= 0) sc = 4; }
      else { if (q.species === p.species) sc += 2; sc += 2 * shared(q.tags || [], p.tags || []); }
      arr.push([sc, k]);
    });
    arr.sort(function (a, b) { return b[0] - a[0]; });
    return arr.slice(0, 4).map(function (x) { return x[1]; });
  }
  function hist(rating) {
    var five = Math.min(80, Math.max(38, Math.round(40 + (rating - 4.2) * 60)));
    var four = Math.round((4.9 - rating) * 30) + 12;
    var rest = 100 - five - four;
    var three = Math.round(rest * 0.6), two = Math.round(rest * 0.3), one = rest - three - two;
    return [[5, five], [4, four], [3, three], [2, two], [1, one]];
  }
  function speciesLabel(sp) { return sp === 'dog' ? 'Dog toys' : sp === 'cat' ? 'Cat toys' : 'Bundles'; }
  function speciesHash(sp) { return sp === 'dog' ? '#dogs' : sp === 'cat' ? '#cats' : '#bundles'; }

  function renderMissing(opts) {
    return '<div class="wrap pdp-missing"><span class="eyebrow">Hmm</span>' +
      '<h1 class="h mt-14">That toy has wandered off.</h1>' +
      '<p class="lead mt-14">We couldn’t find a toy at that address. The shelf, however, is fully stocked.</p>' +
      '<p class="mt-22"><a class="btn btn-primary" href="' + opts.indexLink('#shop') + '">Browse the shelf</a></p></div>';
  }

  function render(P, slug, opts) {
    var p = P[slug];
    var base = opts.base || '';
    if (!p) return null;

    var rel = related(P, slug);
    var h = hist(p.rating);
    var html = '';

    html += '<div class="wrap pdp-crumb"><a href="' + opts.indexLink('') + '">Home</a><span>/</span><a href="' + opts.indexLink(speciesHash(p.species)) + '">' + speciesLabel(p.species) + '</a><span>/</span><b>' + esc(p.name) + '</b></div>';

    html += '<div class="wrap pdp-grid">';
    html += '<div class="pdp-art reveal in">' + imgTag(base, p.img, p.name, true);
    if (p.species === 'bundle' && p.contains) {
      html += '<div class="pdp-thumbs">' + p.contains.map(function (c) {
        return '<a href="' + opts.productLink(c) + '" title="' + esc(P[c].name) + '">' + imgTag(base, P[c].img, P[c].name) + '</a>';
      }).join('') + '</div>';
    }
    html += '</div>';

    html += '<div class="pdp-info reveal in">';
    html += '<span class="eyebrow">' + (p.species === 'bundle' ? 'Gift set' : (p.species === 'dog' ? 'For dogs' : 'For cats')) + '</span>';
    html += '<h1 class="h mt-12">' + esc(p.name) + '</h1>';
    html += '<a class="pdp-rating" href="#reviews">' + stars(p.rating) + '<b>' + p.rating.toFixed(1) + '</b><span class="muted">· ' + p.count.toLocaleString('en-GB') + ' reviews</span></a>';
    html += '<p class="pdp-price">' + money(p.price) + ' <small>VAT included</small></p>';
    html += '<p class="lead mt-6">' + esc(p.blurb) + '</p>';
    html += '<div class="pdp-tags">' + (p.tags || []).map(function (t) { return '<span class="chip">' + esc(t) + '</span>'; }).join('') + '</div>';
    html += '<div class="pdp-buy"><button class="btn btn-coral btn-lg" type="button" id="pdpAdd" data-add="' + slug + '" data-name="' + esc(p.name) + '" data-price="' + p.price + '" data-img="' + p.img + '.webp">Add to basket — ' + money(p.price) + '</button></div>';
    html += '<ul class="pdp-facts">' +
      '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg> Free Royal Mail Tracked 24 over £25 — dispatched same working day before 1pm</li>' +
      '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg> 60-day chew-proof promise — one photo, refund or replace</li>' +
      '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg> Not right for your pet? 30-day ignored-toy returns, prepaid label</li>' +
      '</ul>';
    html += '<h2 class="pdp-h">Details</h2>';
    html += (p.details || []).map(function (d) { return '<p class="pdp-p">' + esc(d) + '</p>'; }).join('');
    if (p.specs) {
      html += '<table class="pdp-specs"><tbody>' + p.specs.map(function (row) {
        return '<tr><th scope="row">' + esc(row[0]) + '</th><td>' + esc(row[1]) + '</td></tr>';
      }).join('') + '</tbody></table>';
    }
    html += '</div></div>';

    html += '<div class="wrap pdp-rev" id="reviews">';
    html += '<h2 class="h mt-16">Honest reviews</h2>';
    html += '<p class="muted mt-8">Every review is from a verified purchase unless marked otherwise. We publish the grumpy ones too — they’re the useful ones.</p>';
    html += '<div class="rev-grid">';
    html += '<div class="rev-sum"><b>' + p.rating.toFixed(1) + '</b>' + stars(p.rating) + '<span class="muted">' + p.count.toLocaleString('en-GB') + ' ratings</span>' +
      '<div class="bars">' + h.map(function (row) {
        return '<div class="bar-row"><span>' + row[0] + '★</span><div class="barline"><i style="width:' + row[1] + '%"></i></div><small>' + row[1] + '%</small></div>';
      }).join('') + '</div></div>';
    html += '<div class="rev-list">' + (p.reviews || []).map(function (r) {
      return '<article class="rev-card">' +
        '<div class="rev-top">' + stars(r.r) + '<b>' + esc(r.n) + '</b><span class="muted">· ' + esc(r.loc) + '</span>' +
        (r.v ? '<span class="badge badge-new">Verified buyer</span>' : '') + '</div>' +
        '<p>' + esc(r.t) + '</p>' +
        '<div class="rev-meta"><span>' + fmtDate(r.d) + '</span><span>' + r.h + ' people found this helpful</span></div>' +
        '</article>';
    }).join('') + '</div></div></div>';

    if (rel.length) {
      html += '<div class="wrap pdp-rel"><div class="rel-head"><span class="eyebrow">Keep browsing</span><h2 class="h mt-14">' +
        (p.species === 'bundle' ? 'What’s in the box & beyond' : 'Goes well with') + '</h2></div>';
      html += '<div class="grid-products">' + rel.map(function (k) {
        var q = P[k];
        return '<article class="product" data-slug="' + k + '" data-name="' + esc(q.name) + '" data-price="' + q.price + '" data-img="' + q.img + '.webp">' +
          '<div class="ph"><a class="plink" href="' + opts.productLink(k) + '" aria-label="View ' + esc(q.name) + '">' + imgTag(base, q.img, q.name) + '</a></div>' +
          '<div class="body"><h3><a class="tlink" href="' + opts.productLink(k) + '">' + esc(q.name) + '</a></h3>' +
          '<div class="pdp-mini">' + stars(q.rating) + '<span class="muted">' + q.rating.toFixed(1) + '</span></div>' +
          '<span class="price">' + money(q.price) + '</span>' +
          '<div class="actions"><button class="btn btn-coral btn-sm btn-block" type="button" data-add="' + k + '">Add to basket</button></div></div></article>';
      }).join('') + '</div></div>';
    }

    return {
      html: html,
      title: p.name + ' — ' + money(p.price) + ' | Pawbin',
      desc: p.blurb
    };
  }

  glob.PawbinRender = { render: render, renderMissing: renderMissing, money: money, related: related };
})(typeof window !== 'undefined' ? window : globalThis);
