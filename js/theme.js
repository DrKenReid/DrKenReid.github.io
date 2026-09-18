/**
 * theme.js — Site-wide dark/light mode toggle.
 *
 * Responsibilities:
 *   - Read stored preference from localStorage on DOMContentLoaded
 *   - Default to dark mode when there is no stored preference
 *   - Apply data-theme="dark"|"light" to <html>
 *   - Keep the #theme-toggle button aria state in sync
 *   - Persist choice across page loads
 *
 * The switch itself is a circular reveal: the new theme washes across the
 * page from the button that was pressed, using the View Transitions API
 * (document.startViewTransition, same-document form). Where that is not
 * supported, or where the reader has asked for reduced motion, it falls
 * back to the older slow cross-fade driven by the .theme-switching class.
 *
 * Flash-of-wrong-theme (FODT) prevention is handled by a tiny inline
 * script injected into every page's <head> (see the kr-theme check).
 */
(function () {
  var STORAGE_KEY = 'kr-theme';
  var DEFAULT_THEME = 'dark';

  function stored() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function save(t) {
    try { localStorage.setItem(STORAGE_KEY, t); } catch (e) {}
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var dark = theme === 'dark';

    // Keep the browser UI (mobile address bar etc.) matching the page background.
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#1a1a1a' : '#faf7f2');

    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    btn.setAttribute('title',      dark ? 'Switch to light mode' : 'Switch to dark mode');
  }

  function reducedMotion() {
    return window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /* The circle has to reach the farthest corner of the viewport from the
     button, whichever corner that is. */
  function revealRadius(x, y) {
    var w = window.innerWidth, h = window.innerHeight;
    return Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
  }

  document.addEventListener('DOMContentLoaded', function () {
    apply(stored() || DEFAULT_THEME);

    // Delegated click — works even if button is injected after this script runs
    var switchTimer = null;
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('#theme-toggle') : null;
      if (!btn) return;
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      save(next);

      var canReveal = typeof document.startViewTransition === 'function' && !reducedMotion();
      if (!canReveal) {
        // Cross-fade the swap (CSS scopes transitions to .theme-switching);
        // kept slow so the full-page luminance change is gentle on
        // photosensitive users
        document.documentElement.classList.add('theme-switching');
        if (switchTimer) clearTimeout(switchTimer);
        switchTimer = setTimeout(function () {
          document.documentElement.classList.remove('theme-switching');
        }, 1100);
        apply(next);
        return;
      }

      // Circle origin: the button's centre, in viewport pixels. Written to
      // custom properties so the CSS clip-path can read them.
      var r = btn.getBoundingClientRect();
      var x = r.left + r.width / 2;
      var y = r.top + r.height / 2;
      var root = document.documentElement;
      root.style.setProperty('--kr-reveal-x', x + 'px');
      root.style.setProperty('--kr-reveal-y', y + 'px');
      root.style.setProperty('--kr-reveal-r', revealRadius(x, y) + 'px');
      root.classList.add('kr-theme-reveal');

      var vt = document.startViewTransition(function () { apply(next); });
      vt.finished.catch(function () {}).then(function () {
        root.classList.remove('kr-theme-reveal');
      });
    });
  });
}());
