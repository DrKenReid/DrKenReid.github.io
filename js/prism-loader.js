/**
 * prism-loader.js
 *
 * Lazy-loads Prism.js (tomorrow theme) plus any requested language plugins,
 * then calls Prism.highlightAll().
 *
 * Usage:
 *   loadPrism(['python']);          // highlight Python blocks
 *   loadPrism(['python', 'bash']);  // multiple languages
 *   loadPrism();                    // core only (markup / CSS / JS)
 *
 * Safe to call multiple times — loads once, re-highlights on repeat calls.
 */
(function (global) {
  var state = 0; // 0 = idle, 1 = loading, 2 = ready
  var CDN = 'https://cdn.jsdelivr.net/npm/prismjs@1.29.0/';

  // Inject a one-time style so Prism's pre sits flush inside .code-example blocks.
  (function () {
    var s = document.createElement('style');
    s.textContent = 'pre[class*="language-"]{margin:0!important;border-radius:0!important;}';
    document.head.appendChild(s);
  }());

  global.loadPrism = function (languages) {
    if (state === 2) {
      window.Prism && Prism.highlightAll();
      return;
    }
    if (state === 1) return;
    state = 1;

    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = CDN + 'themes/prism-tomorrow.css';
    document.head.appendChild(css);

    var core = document.createElement('script');
    core.setAttribute('data-manual', ''); // prevent auto-run before plugins load
    core.src = CDN + 'prism.min.js';
    core.onload = function () {
      var queue = (languages || []).slice();
      function next() {
        if (!queue.length) {
          state = 2;
          Prism.highlightAll();
          return;
        }
        var lang = queue.shift();
        var s = document.createElement('script');
        s.src = CDN + 'components/prism-' + lang + '.min.js';
        s.onload = next;
        s.onerror = next; // skip unknown languages gracefully
        document.head.appendChild(s);
      }
      next();
    };
    document.head.appendChild(core);
  };
}(window));
