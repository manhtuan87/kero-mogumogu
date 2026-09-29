/* ケロちゃん もぐもぐ — offline support.
   Keeps the game on the device so it plays without a connection.
   Bump VERSION whenever the game files change. The page looks for a new version
   whenever it is opened or comes back to the front; the new files are fetched
   straight from the server (never from the browser's own cache), this worker takes
   over at once, and the page reloads itself on the title screen.
   Other games on the same site (ケロちゃん ぴよぴよポン) share the cache storage,
   so only caches whose names start with "kero-" are ever deleted here. */
var VERSION = 'kero-v9';
var FONTS = 'kero-fonts';
var FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/lang.js', 'js/lang-text.js', 'js/accounts.js', 'js/engine.js', 'js/levels-more.js', 'js/levels.js', 'js/draw.js', 'js/sound.js', 'js/game.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'
];

// A file straight from the server, not from the browser's own cache (GitHub Pages lets browsers
// keep files for 10 minutes, which could otherwise put old files into a new version).
function fresh(f) { return new Request(f, { cache: 'reload' }); }

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION)
    .then(function (c) { return c.addAll(FILES.map(fresh)); })
    .then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('kero-') === 0 && k !== VERSION && k !== FONTS; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// ケロちゃん ランド (the menu) asks which version is on the phone, and shows it.
self.addEventListener('message', function (e) {
  if (e.data === 'version' && e.ports && e.ports[0]) e.ports[0].postMessage(VERSION);
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Game files: answer from the cache at once, refresh it in the background.
  if (url.origin === self.location.origin) {
    e.respondWith(caches.open(VERSION).then(function (c) {
      return c.match(req, { ignoreSearch: true }).then(function (hit) {
        var net = fetch(req.url, { cache: 'no-cache' }).then(function (res) {
          if (res.ok) c.put(req, res.clone());
          return res;
        }).catch(function () { return hit; });
        return hit || net;
      });
    }));
    return;
  }

  // Rounded font from Google Fonts: keep a copy for offline play.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FONTS).then(function (c) {
      return c.match(req).then(function (hit) {
        return hit || fetch(req).then(function (res) { c.put(req, res.clone()); return res; });
      });
    }));
  }
});
