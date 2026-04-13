/* Blog share buttons - auto-injects into .blog-post */
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    var post = document.querySelector('.blog-post');
    if (!post) return;
    var url = encodeURIComponent(window.location.href);
    var title = encodeURIComponent(document.title.replace(' - Ken Reid', ''));
    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:30px 0;';
    var btns = [
      {label:'Bluesky', icon:'\uD83E\uDD4B', href:'https://bsky.app/intent/compose?text='+title+'%20'+url},
      {label:'X', icon:'\uD83D\uDC26', href:'https://twitter.com/intent/tweet?text='+title+'&url='+url},
      {label:'LinkedIn', icon:'\uD83D\uDCBC', href:'https://www.linkedin.com/sharing/share-offsite/?url='+url},
      {label:'Reddit', icon:'\uD83E\uDD16', href:'https://reddit.com/submit?url='+decodeURIComponent(url)+'&title='+title},
      {label:'Copy link', icon:'\uD83D\uDD17', href:'#copy'}
    ];
    btns.forEach(function(b) {
      var a = document.createElement('a');
      a.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:20px;font-size:13px;font-weight:500;text-decoration:none;border:1px solid #ddd;color:#555;background:#fff;transition:all 0.2s;cursor:pointer;';
      a.onmouseover = function(){a.style.borderColor='#fc6060';a.style.color='#fc6060';};
      a.onmouseout = function(){a.style.borderColor='#ddd';a.style.color='#555';};
      a.textContent = b.icon + ' ' + b.label;
      if (b.href === '#copy') {
        a.onclick = function(e) {
          e.preventDefault();
          navigator.clipboard.writeText(window.location.href).then(function() {
            a.textContent = '\u2705 Copied!';
            setTimeout(function() { a.textContent = b.icon + ' ' + b.label; }, 2000);
          });
        };
      } else {
        a.href = b.href;
        a.target = '_blank';
        a.rel = 'noopener';
      }
      bar.appendChild(a);
    });
    var hr = post.querySelector('hr');
    if (hr) { hr.parentNode.insertBefore(bar, hr); }
  });
})();
