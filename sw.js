const CACHE_NAME = "taxi-platino-v1.4";

const ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/favicon.ico",
  "/alerta.mp3"
];


// =====================
// 🔹 FIREBASE (PUSH)
// =====================

// 🔥 IMPORTANTE: importar Firebase
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ⚠️ Tu config
firebase.initializeApp({
  apiKey: "AIzaSyCV432quSSYBQnvyVNoc7rXhw99x7UlMHg",
  authDomain: "taxi-platino-95ea3.firebaseapp.com",
  projectId: "taxi-platino-95ea3",
  messagingSenderId: "981982270950",
  appId: "1:981982270950:web:b7d0b4ca9ab03cafd97227"
});

const messaging = firebase.messaging();

// =====================
// 🔹 PUSH EN BACKGROUND
// =====================
messaging.onBackgroundMessage(payload => {
  console.log("Push recibido:", payload);

  const title = payload.notification?.title || "Taxi Platino";
  const body = payload.notification?.body || "Nuevo evento";

  self.registration.showNotification(title, {
    body: body,
    icon: "/favicon.ico",
    badge: "/favicon.ico"
  });
});


// =====================
// 🔹 CACHE (PWA)
// =====================

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(k => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      )
    )
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});

self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil(
    clients.openWindow("/")
  );
});
