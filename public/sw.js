/* Bookly service worker — network-first shell for offline install. */
const CACHE = "bookly-shell-v5";
const SHELL = [
  "./",
  "./manifest.webmanifest",
  "./favicon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-any.png",
  "./icons/apple-touch-icon.png",
  "./sounds/page-turn.wav",
];

self.addEventListener("install", (event) => {
  // Keep install snappy — large assets (pdf worker) cache on first use.
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache opaque PDF user data or API-ish paths
  if (url.pathname.endsWith(".pdf") && url.pathname.includes("sample") === false) {
    return;
  }

  // Network-first for HTML/JS/CSS so updates always win (app never stuck on stale shell)
  const isShellDoc =
    request.mode === "navigate" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.includes("/_next/");

  if (isShellDoc) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./"))),
    );
    return;
  }

  // Cache-first for static assets (icons, worker, sounds) — warm after first hit
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Revalidate in background
        void fetch(request)
          .then((response) => {
            if (response.ok) {
              void caches.open(CACHE).then((cache) => cache.put(request, response));
            }
          })
          .catch(() => {});
        return cached;
      }
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            void caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
    }),
  );
});
