const CACHE = "taxi-platino-v2.3";

const ASSETS = [
 "./",
 "./index.html",
 "./manifest.json",
 "./alerta.mp3"
];

self.addEventListener("install", e=>{
 e.waitUntil(
  caches.open(CACHE).then(c=>c.addAll(ASSETS))
 );
});

self.addEventListener("activate", e=>{
 e.waitUntil(
  caches.keys().then(keys=>
   Promise.all(keys.map(k=>{
    if(k!==CACHE) return caches.delete(k);
   }))
  )
 );
});

self.addEventListener("fetch", e=>{
 e.respondWith(
  caches.match(e.request).then(r=>r||fetch(e.request))
 );
});
