// sw.js: the service worker. It lets the app open without internet, and
// keeps the device from mixing old and new files after an update.
//
// A service worker is a small script the device keeps between the app and
// the internet. This one works like this:
//   - Online: always ask for the newest copy of each file (so an update
//     shows up right away, all at once), and save that copy.
//   - Offline: use the saved copy.
//   - When it's first installed, it saves every file in FILES, so the whole
//     app works offline even before every screen has been opened.
//
// When you add a file the app needs, add it to FILES.
// tests/offline.test.js fails if one is missing.
//
// This only handles the app's own files. Practice data is stored
// separately on the device and never passes through here.

// Other apps on this web address keep their own caches under other prefixes.
const PREFIX = "piano-stars-";
const CACHE = PREFIX + "v1";

// Every file the app needs, relative to this file. "./" is the app itself.
const FILES = [
  "./",
  "index.html",
  "styles.css",
  "manifest.webmanifest",
  "src/app.js",
  "src/backup.js",
  "src/history.js",
  "src/prize.js",
  "src/rewards.js",
  "src/scene.js",
  "src/storage.js",
  "src/week.js",
  "data/stickers.js",
  "assets/apple-touch-icon.png",
  "assets/icon.svg",
  "assets/icon-192.png",
  "assets/icon-512.png",
];

// First install: save every file. `cache: "reload"` skips the browser's own
// short-term copies, so the saved set is all from the same version.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(FILES.map((file) => new Request(file, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

// Clear out saved files from any older version of this worker, and start
// looking after the app right away.
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((name) => name.startsWith(PREFIX) && name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

// Ask the internet for the newest copy and save it; if that fails, use the saved copy.
async function newestOrSaved(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request, { cache: "no-cache" });
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const saved = (await cache.match(request, { ignoreSearch: true }))
      // Opening the app itself (any address) offline: show the saved app.
      ?? (request.mode === "navigate" ? await cache.match("index.html") : undefined);
    if (saved) return saved;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only this app's own files. (The app makes no other requests anyway.)
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(newestOrSaved(request));
});
