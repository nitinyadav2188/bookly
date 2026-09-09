/* Página service worker — network-first shell; snappy install (no huge worker). */
const CACHE = "bookly-shell-v7";
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
  // Keep install snappy — never cache pdf.worker (~1.3MB) during install/activate.
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

  // Network-first for HTML / JS / CSS / module scripts so updates always win.
  // Includes .mjs app chunks; the large pdf.worker is handled separately below.
  const path = url.pathname;
  const isPdfWorker = path.endsWith("/pdf.worker.min.mjs") || path.endsWith("pdf.worker.min.mjs");
  const isShellDoc =
    !isPdfWorker &&
    (request.mode === "navigate" ||
      path.endsWith(".html") ||
      path.endsWith(".js") ||
      path.endsWith(".mjs") ||
      path.endsWith(".css") ||
      path.includes("/_next/"));

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

  // Cache-first for static assets (icons, pdf worker, sounds) — warm after first hit.
  // Worker is deliberately NOT in install SHELL so first visit activate stays fast.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
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
