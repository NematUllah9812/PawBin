/* ============================================================
   PAWBIN PRODUCT PAGE (runtime) — thin wrapper around the
   shared pure renderer in js/pdp-render.js. The static build
   pre-renders the same markup; this keeps legacy
   product.html?p=<slug> links fully functional.
   ============================================================ */
(function () {
  'use strict';
  var P = window.PAWBIN_PRODUCTS || {};
  var root = document.getElementById('pdpRoot');
  if (!root || !window.PawbinRender) return;

  var params = new URLSearchParams(location.search);
  var slug = (params.get('p') ||
              root.getAttribute('data-prerendered') ||
              (location.pathname.match(/product\/([\w-]+)\.html/) || [])[1] || '').toLowerCase();

  var opts = {
    base: '',
    indexLink: function (hash) { return 'index.html' + hash; },
    productLink: function (s) { return 'product.html?p=' + s; }
  };

  /* static build pre-renders this page; only render when needed */
  if (root.getAttribute('data-prerendered') === slug) return;
  var out = window.PawbinRender.render(P, slug, opts);
  if (!out) {
    document.title = 'Toy not found | Pawbin';
    root.innerHTML = window.PawbinRender.renderMissing(opts);
    return;
  }
  document.title = out.title;
  root.innerHTML = out.html;
  /* add-to-basket buttons use the global [data-add] delegation in app.js */
})();
