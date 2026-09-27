/* ケロちゃん もぐもぐ — offline support.
   Keeps the game on the device so it plays without a connection.
   Bump VERSION whenever the game files change; the new files are fetched
   in the background and used from the next launch. */
var VERSION = 'kero-v2';
var FONTS = 'kero-fonts';
var FILES = [
  './', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/engine.js', 'js/levels.js', 'js/draw.js', 'js/sound.js', 'js/game.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION)
    .then(function (c) { return c.addAll(FILES); })
    .then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION && k !== FONTS; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Game files: answer from the cache at once, refresh it in the background.
  if (url.origin === self.location.origin) {
    e.respondWith(caches.open(VERSION).then(function (c) {
      return c.match(req, { ignoreSearch: true }).then(function (hit) {
        var net = fetch(req).then(function (res) {
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
