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
    var btn = document.getElementById('theme-toggle');
    if (!btn) return;
    var dark = theme === 'dark';
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    btn.setAttribute('title',      dark ? 'Switch to light mode' : 'Switch to dark mode');
  }

  document.addEventListener('DOMContentLoaded', function () {
    apply(stored() || DEFAULT_THEME);

    // Delegated click — works even if button is injected after this script runs
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('#theme-toggle') : null;
      if (!btn) return;
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      save(next);
      apply(next);
    });
  });
}());
