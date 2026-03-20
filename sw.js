const CACHE_NAME = "platino-v1.5";
const resources = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icono.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(resources))
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
