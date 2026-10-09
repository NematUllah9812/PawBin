/* ============================================================
   PAWBIN COMPONENT LOADER
   Fetches each components/<name>.html fragment, swaps it into
   its <div data-component="<name>"> placeholder, then boots
   js/app.js once the whole page is assembled.
   ============================================================ */
(function () {
  'use strict';
  var slots = Array.prototype.slice.call(document.querySelectorAll('[data-component]'));
  var pending = slots.length;
  var failed = [];

  function boot() {
    var splash = document.getElementById('boot');
    if (splash) splash.remove();

    if (failed.length) {
      var host = document.getElementById('app') || document.body;
      host.innerHTML =
        '<div class="boot-fallback">' +
        '<h1 style="margin:0 0 12px;font-size:22px">Pawbin needs a local web server</h1>' +
        '<p style="margin:0 0 12px;color:#3B4C41">This page assembles itself from the <b>components/</b> folder at runtime, which browsers block when a file is opened directly (<code>file://</code>) or when a file is missing.</p>' +
        '<p style="margin:0 0 12px;color:#3B4C41">Missing: <b>' + failed.join(', ') + '</b></p>' +
        '<p style="margin:0;color:#3B4C41">Serve the folder instead, then reload:<br><code style="background:#EDF8E6;padding:2px 8px;border-radius:8px">python3 -m http.server 8000</code></p>' +
        '</div>';
      return;
    }

    var s = document.createElement('script');
    s.src = 'js/app.js';
    s.onload = function () {
      /* extra page scripts, e.g. product.html loads js/product.js */
      var extra = (document.body.getAttribute('data-scripts') || '').split(',').filter(Boolean);
      (function next() {
        var src = extra.shift(); if (!src) return;
        var sc = document.createElement('script'); sc.src = src; sc.onload = next;
        document.body.appendChild(sc);
      })();
    };
    document.body.appendChild(s);
  }

  slots.forEach(function (slot) {
    var name = slot.getAttribute('data-component');
    fetch('components/' + name + '.html')
      .then(function (r) {
        if (!r.ok) throw new Error(name + ' → HTTP ' + r.status);
        return r.text();
      })
      .then(function (html) {
        var t = document.createElement('template');
        t.innerHTML = html.trim();
        slot.replaceWith(t.content);
      })
      .catch(function () { failed.push(name); })
      .then(function () { if (--pending === 0) boot(); });
  });

  if (!slots.length) boot();
})();
