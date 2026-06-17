/**
 * nerd-mode.js  — shared nerd-mode toggle for blog posts
 *
 * Each blog needs these two things in its <head> to prevent FOUC:
 *
 *   1. Pre-paint guard (reads localStorage before first paint):
 *      <script>(function(){try{if(localStorage.getItem('kr-nerd')==='on')document.documentElement.classList.add('nerd-mode-on');}catch(e){}})();</script>
 *
 *   2. Visibility rules in a <style> block:
 *      .nerd-only { display: none; }
 *      html.nerd-mode-on .nerd-only { display: revert; }
 *      .non-nerd { display: revert; }
 *      html.nerd-mode-on .non-nerd { display: none; }
 *
 * Then at the bottom of the page:
 *   <script src="../js/nerd-mode.js"></script>
 *   <script>
 *     initNerdMode({
 *       description: 'Flip on to reveal the equations and code.',
 *       onChange: function(on) { if (on) loadPrism(['python']); }
 *     });
 *   </script>
 *
 * Place a container where the toggle card should appear:
 *   <div id="nerd-toggle-container"></div>
 */
(function (global) {
  var s = document.createElement('style');
  s.textContent = [
    '.nerd-toggle-card{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:28px 0 36px;padding:16px 20px;border:1px solid #e2e2e2;border-left:3px solid #fc6060;border-radius:8px;background:#fafafa}',
    '.nerd-toggle-card .nerd-copy strong{display:block;font-size:15px;letter-spacing:.02em}',
    '.nerd-toggle-card .nerd-copy span{display:block;font-size:13px;line-height:1.5;color:#666;margin-top:3px}',
    '.nerd-switch{position:relative;display:inline-block;flex:0 0 auto;width:56px;height:30px;margin:0}',
    '.nerd-switch input{opacity:0;width:0;height:0}',
    '.nerd-slider{position:absolute;cursor:pointer;inset:0;background:#c4c4c4;border-radius:30px;transition:background .2s ease}',
    '.nerd-slider::before{content:"";position:absolute;height:24px;width:24px;left:3px;top:3px;background:#fff;border-radius:50%;transition:transform .2s ease}',
    '.nerd-switch input:checked+.nerd-slider{background:#fc6060}',
    '.nerd-switch input:checked+.nerd-slider::before{transform:translateX(26px)}',
    '.nerd-switch input:focus-visible+.nerd-slider{outline:2px solid #fc6060;outline-offset:2px}',
    '[data-theme="dark"] .nerd-toggle-card{background:#1e1e1e;border-color:#333;border-left-color:#fc6060}',
    '[data-theme="dark"] .nerd-toggle-card .nerd-copy span{color:#aaa}'
  ].join('');
  document.head.appendChild(s);

  global.initNerdMode = function (opts) {
    var desc = (opts && opts.description) || 'Flip on to reveal the technical details.';
    var onChange = (opts && opts.onChange) || function () {};
    var containerId = (opts && opts.containerId) || 'nerd-toggle-container';

    var container = document.getElementById(containerId);
    if (container) {
      container.innerHTML =
        '<div class="nerd-toggle-card">' +
          '<div class="nerd-copy">' +
            '<strong>Nerd mode</strong>' +
            '<span>' + desc + '</span>' +
          '</div>' +
          '<label class="nerd-switch" title="Toggle nerd mode">' +
            '<input type="checkbox" id="nerd-toggle" aria-label="Toggle nerd mode">' +
            '<span class="nerd-slider"></span>' +
          '</label>' +
        '</div>';
    }

    function setNerd(on) {
      document.documentElement.classList.toggle('nerd-mode-on', on);
      try { localStorage.setItem('kr-nerd', on ? 'on' : 'off'); } catch (e) {}
      onChange(on);
    }

    document.addEventListener('DOMContentLoaded', function () {
      var box = document.getElementById('nerd-toggle');
      var on = document.documentElement.classList.contains('nerd-mode-on');
      if (box) {
        box.checked = on;
        box.addEventListener('change', function () { setNerd(box.checked); });
      }
      if (on) { onChange(true); }
    });
  };
}(window));
