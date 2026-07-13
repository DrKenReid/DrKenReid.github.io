/**
 * Service worker: offline reading for kenreid.co.uk.
 *
 * Strategy:
 *   - HTML navigations: network-first, falling back to cache, then to
 *     the offline page. Deploys are therefore always fresh online.
 *   - Same-origin assets (css/js/fonts/data/images): stale-while-
 *     revalidate — instant from cache, refreshed in the background.
 *   - Cross-origin requests are left alone.
 *
 * Bump VERSION to invalidate old caches.
 */

var VERSION = 'kr-v2';
var PAGES_CACHE = VERSION + '-pages';
var ASSETS_CACHE = VERSION + '-assets';
var IMG_LIMIT = 200;

var PRECACHE = [
  './offline.html',
  './style.min.css',
  './js/jquery.min.js',
  './js/popper.min.js',
  './js/bootstrap.min.js',
  './js/alime.bundle.js',
  './js/theme.js',
  './js/palette.js',
  './js/shared-components.js',
  './js/default-assets/active.js',
  './data/posts.json'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(ASSETS_CACHE).then(function (cache) {
      return cache.addAll(PRECACHE);
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return k.indexOf(VERSION) !== 0;
      }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function trimCache(cacheName, limit) {
  caches.open(cacheName).then(function (cache) {
    cache.keys().then(function (keys) {
      if (keys.length > limit) {
        cache.delete(keys[0]).then(function () { trimCache(cacheName, limit); });
      }
    });
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // HTML: network-first
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').indexOf('text/html') !== -1) {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(PAGES_CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./offline.html');
        });
      })
    );
    return;
  }

  // Assets: stale-while-revalidate
  event.respondWith(
    caches.match(req).then(function (hit) {
      var fetching = fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(ASSETS_CACHE).then(function (c) {
            c.put(req, copy);
            if (req.destination === 'image') trimCache(ASSETS_CACHE, IMG_LIMIT);
          });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || fetching;
    })
  );
});
