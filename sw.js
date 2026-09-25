/**
 * Service worker: offline reading for kenreid.co.uk.
 *
 * Registered from js/shared-components.js on every page. It keeps what a
 * reader has already seen so it opens again without a connection, and it
 * never lets a fresh page run stale code.
 *
 * Three caches, each named VERSION + suffix:
 *
 *   core   The PRECACHE list below, then every script, stylesheet, font
 *          and data file the site serves, kept as they are fetched. That
 *          set is bounded by the repository itself, so core is never
 *          trimmed. It has a cache of its own because trimming a shared
 *          one evicts the oldest entries first, and the oldest entries
 *          were always the precache: kr-v10 kept everything in one cache
 *          capped at 200, so a single scroll through the gallery pushed
 *          out offline.html and the stylesheet, and the fallback page then
 *          had nothing to show.
 *   img    Images. The gallery alone has hundreds of thumbnails, so this
 *          one is capped at IMG_LIMIT, oldest write first.
 *   pages  HTML, keyed on the path alone (see pageKey), capped at
 *          PAGES_LIMIT. offline.html reads it to list what is saved.
 *
 * Strategy by request:
 *
 *   Navigations  Network first, raced against NAV_TIMEOUT_MS. If the
 *                network has not answered by then and a saved copy exists,
 *                the saved copy is shown; the network response still lands
 *                in the cache when it arrives. No saved copy: keep waiting.
 *                Network failed and nothing saved: offline.html, or an
 *                inline page if even that has gone. Navigation preload
 *                starts the request while the worker boots.
 *   Scripts and  Network first, cache on failure. A page fetched fresh
 *   styles       must never run last week's JS or CSS against its new
 *                markup, so there is no stale-while-revalidate here.
 *                The one exception is a page that was itself served from
 *                the cache: its scripts come from the cache too, so an old
 *                page runs the code it was written against, and on a
 *                barely-there connection it is not left blank waiting on
 *                a render-blocking stylesheet.
 *   data/*.json  Network first, cache on failure (same exception). They
 *                change on a schedule (Last.fm, Goodreads), and served
 *                stale they showed last week's shelf.
 *   Images and   Stale-while-revalidate: instant from the cache, refreshed
 *   fonts        in the background.
 *   Anything     Not intercepted. Cross-origin requests (map tiles,
 *   else         full-size photographs on the release, embeds) are left
 *                to the browser as well.
 *
 * Only complete, successful same-origin responses are stored (cacheable).
 *
 * Versioning: bump VERSION whenever this file's caching behaviour changes
 * or the precache needs a clean start. A new worker installs alongside the
 * old one, takes over at once (skipWaiting and clients.claim) and deletes
 * every cache that is not one of its own on activate. Ordinary deploys do
 * not need a bump: nothing here is served stale without being revalidated.
 *
 * Handing over from an older worker: the old one keeps control until the
 * page it is serving has loaded, so that first page's requests follow the
 * OLD rules. kr-v10 served scripts and styles stale-while-revalidate,
 * matched by exact URL, which ran new markup against last deploy's
 * shared-components.js (an uncaught ReferenceError, no footer, no photo
 * strip) for one view. Every page therefore asks for style.min.css and the
 * shared scripts with a ?v= query (generate_post_head.py's ASSET_QUERY),
 * a URL kr-v10 never cached, so it goes to the network. lookup() below
 * ignores the query when offline, so the precache still answers for it.
 * Before replacing a worker that is not network first for code, change
 * that query too.
 *
 * Design notes: "Reading This Site Offline",
 * https://www.kenreid.co.uk/blog/reading-this-site-offline.html
 * (it describes the first version; this header is the current one).
 * The offline scenario in .github/scripts/perf_budget.py checks it.
 */

var VERSION = 'kr-v11';
var CORE = VERSION + '-core';
var IMG = VERSION + '-img';
var PAGES = VERSION + '-pages';
var OWN_CACHES = [CORE, IMG, PAGES];

var IMG_LIMIT = 200;
var PAGES_LIMIT = 60;
var NAV_TIMEOUT_MS = 3500;
var OFFLINE_URL = './offline.html';

// The shell: what offline.html and a saved page need to render. Every
// entry must be a tracked file (audit_site.py checks), because cache.addAll
// is all or nothing: one 404 here and the worker never installs, which
// means no offline reading at all rather than slightly less of it.
var PRECACHE = [
  './offline.html',
  './style.min.css',
  './js/site.js',
  './js/jquery.min.js',
  './js/alime.bundle.js',
  './js/theme.js',
  './js/palette.js',
  './js/shared-components.js',
  './js/lightbox.js',
  './js/kr-viz.js',
  './js/default-assets/active.js',
  './data/posts.json'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CORE).then(function (cache) {
      // Bypass the HTTP cache so a new version never precaches the old
      // version's files out of the browser's own cache.
      return cache.addAll(PRECACHE.map(function (url) {
        return new Request(url, {cache: 'reload'});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(Promise.all([
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) {
        return OWN_CACHES.indexOf(k) === -1;
      }).map(function (k) { return caches.delete(k); }));
    }),
    // Lets the page request start while the worker is still booting,
    // instead of after it; the response arrives as event.preloadResponse.
    self.registration.navigationPreload
      ? self.registration.navigationPreload.enable().catch(noop)
      : null
  ]).then(function () { return self.clients.claim(); }));
});

/* ---- request routing ------------------------------------------------ */

var CODE_RE = /\.(?:js|mjs|css)$/i;
var FONT_RE = /\.(?:woff2?|ttf|otf)$/i;
var IMAGE_RE = /\.(?:png|jpe?g|webp|avif|gif|svg|ico)$/i;

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(navigation(event));
  } else if (url.pathname.indexOf('/data/') === 0 ||
             req.destination === 'script' || req.destination === 'style' ||
             CODE_RE.test(url.pathname)) {
    event.respondWith(servedFromCache(event.clientId)
      ? cacheFirst(event, CORE)
      : networkFirst(event, CORE));
  } else if (req.destination === 'font' || FONT_RE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event, CORE));
  } else if (req.destination === 'image' || IMAGE_RE.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event, IMG, IMG_LIMIT));
  }
});

/* ---- strategies ----------------------------------------------------- */

function navigation(event) {
  var req = event.request;
  var key = pageKey(req.url);
  var network = Promise.resolve(event.preloadResponse).then(function (pre) {
    return pre || fetch(req);
  });
  // Registered before the page's own handler below, so the copy is taken
  // before the browser starts reading the body.
  event.waitUntil(network.then(function (res) {
    return isHtml(res) ? store(PAGES, key, res.clone(), PAGES_LIMIT) : null;
  }).catch(noop));

  return new Promise(function (resolve) {
    var done = false;
    function answer(res, fromCache) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (fromCache) rememberCachedClient(event.resultingClientId);
      resolve(res);
    }
    var timer = setTimeout(function () {
      savedPage(key).then(function (hit) { if (hit) answer(hit, true); });
    }, NAV_TIMEOUT_MS);
    network.then(function (res) { answer(res, false); }, function () {
      savedPage(key).then(function (hit) {
        if (hit) answer(hit, true);
        else offlinePage().then(function (res) { answer(res, true); });
      });
    });
  });
}

function networkFirst(event, cacheName) {
  var req = event.request;
  var network = fetch(req);
  event.waitUntil(network.then(function (res) {
    return store(cacheName, req, res.clone());
  }).catch(noop));
  return network.catch(function () {
    return lookup(req).then(orError);
  });
}

function cacheFirst(event, cacheName) {
  var req = event.request;
  var got = lookup(req).then(function (hit) {
    return hit ? {res: hit} : fetch(req).then(function (res) {
      return {res: res, fresh: true};
    });
  });
  event.waitUntil(got.then(function (g) {
    return g.fresh ? store(cacheName, req, g.res.clone()) : null;
  }).catch(noop));
  return got.then(function (g) { return g.res; }, function () {
    return Response.error();
  });
}

function staleWhileRevalidate(event, cacheName, limit) {
  var req = event.request;
  var network = fetch(req);
  event.waitUntil(network.then(function (res) {
    return store(cacheName, req, res.clone(), limit);
  }).catch(noop));
  return lookup(req).then(function (hit) {
    return hit || network.catch(function () { return Response.error(); });
  });
}

/* ---- pages ---------------------------------------------------------- */

// A static host serves the same file whatever the query string says; the
// query only steers the page's scripts (blog.html?tag=books). Keying on
// the path keeps one copy per page instead of one per filter, and lets an
// offline visit to any filtered link open the saved page. A directory
// path is the index file, as the host resolves it.
function pageKey(href) {
  var u = new URL(href);
  var path = u.pathname.slice(-1) === '/' ? u.pathname + 'index.html' : u.pathname;
  return u.origin + path;
}

function savedPage(key) {
  return caches.open(PAGES).then(function (cache) { return cache.match(key); });
}

function isHtml(res) {
  return (res.headers.get('content-type') || '').indexOf('text/html') !== -1;
}

function offlinePage() {
  return caches.match(OFFLINE_URL).then(function (hit) {
    if (hit) return hit;
    // The precache has been evicted (storage pressure, or a user clearing
    // site data mid-session). Something readable beats the browser's own
    // error page, which would blame the site rather than the connection.
    return new Response(
      '<!DOCTYPE html><html lang="en"><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Offline - Ken Reid</title>' +
      '<body style="margin:0;min-height:100vh;display:grid;place-items:center;' +
      'background:#1a1a1a;color:#e2e2e2;font:16px/1.7 system-ui,sans-serif;' +
      'text-align:center;padding:24px">' +
      '<div><h1 style="font-weight:600;margin:0 0 8px">You\'re offline</h1>' +
      '<p style="color:#a8a8a8;margin:0 0 16px">This page has not been saved on this device.</p>' +
      '<a href="" style="color:#fc6060">Try again</a></div></body></html>',
      {status: 503, statusText: 'Offline',
       headers: {'Content-Type': 'text/html; charset=utf-8'}});
  });
}

/* ---- clients served from the cache ---------------------------------- */

// Ids of pages that were answered from the cache, so their own requests
// for scripts, styles and data go cache first (see the header). Held in
// memory only: if the browser stops the worker in between, those requests
// fall back to network first, which is the safe default anyway.
var cachedClients = [];

function rememberCachedClient(id) {
  if (!id) return;
  cachedClients.push(id);
  if (cachedClients.length > 20) cachedClients.shift();
}

function servedFromCache(id) {
  return !!id && cachedClients.indexOf(id) !== -1;
}

/* ---- cache plumbing ------------------------------------------------- */

// 206 is ok but cannot be stored (Cache rejects partial content), and
// anything else unsuccessful would pin an error page in place of the file.
function cacheable(res) {
  return !!res && res.ok && res.status !== 206;
}

function store(cacheName, req, res, limit) {
  if (!cacheable(res)) return Promise.resolve();
  return caches.open(cacheName).then(function (cache) {
    return cache.put(req, res).then(function () {
      if (cacheName === CORE) return dropOtherVersions(cache, req);
      if (limit) return trim(cacheName, limit);
    });
  });
}

// Scripts loaded with a version query (js/blog.js?v=20260917a) would
// otherwise pile up one copy per version in a cache that is never trimmed.
// Storing a URL retires every other query of the same path.
function dropOtherVersions(cache, req) {
  var href = typeof req === 'string' ? req : req.url;
  var path = new URL(href).pathname;
  return cache.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) {
      return k.url !== href && new URL(k.url).pathname === path;
    }).map(function (k) { return cache.delete(k); }));
  });
}

// Exact match first, then the same path under any query, so a saved page
// that asks for a newer ?v= of a script still finds the copy it has.
function lookup(req) {
  return caches.match(req).then(function (hit) {
    return hit || caches.match(req, {ignoreSearch: true});
  });
}

function orError(res) {
  return res || Response.error();
}

// Cache.keys() lists entries in insertion order, and put() on an existing
// key re-inserts it, so the front of the list is the least recently
// written. One trim runs per cache at a time: a gallery scroll stores
// hundreds of images in a burst, and overlapping trims each read the same
// key list and delete the same entries. A request that arrives mid-trim
// queues one more pass rather than being dropped.
var trims = {};

function trim(cacheName, limit) {
  var t = trims[cacheName] || (trims[cacheName] = {running: null, again: false});
  if (t.running) {
    t.again = true;
    return t.running;
  }
  t.running = caches.open(cacheName).then(function (cache) {
    return cache.keys().then(function (keys) {
      var excess = keys.slice(0, Math.max(0, keys.length - limit));
      return Promise.all(excess.map(function (k) { return cache.delete(k); }));
    });
  }).catch(noop).then(function () {
    t.running = null;
    if (t.again) {
      t.again = false;
      return trim(cacheName, limit);
    }
  });
  return t.running;
}

function noop() {}
