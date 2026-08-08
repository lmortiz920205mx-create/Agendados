importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
    apiKey: "AIzaSyCV432quSSYBQnvyVNoc7rXhw99x7UlMHg",
    authDomain: "taxi-platino-95ea3.firebaseapp.com",
    projectId: "taxi-platino-95ea3",
    storageBucket: "taxi-platino-95ea3.firebasestorage.app",
    messagingSenderId: "981982270950",
    appId: "1:981982270950:web:b7d0b4ca9ab03cafd97227"
});

const messaging = firebase.messaging();
const CACHE_NAME = "taxi-platino-agendados-v3";
const APP_SHELL = [
    "./",
    "./index.html",
    "./manifest.json",
    "./css/styles.css",
    "./assets/taxi-platino.svg",
    "./js/main.js",
    "./js/auth.js",
    "./js/firebase.js",
    "./js/notificaciones.js",
    "./js/servicios.js",
    "./js/eventos.js",
    "./js/ui.js",
    "./js/utils.js"
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (event) => {
    const request = event.request;
    if (request.method !== "GET") return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
                    return response;
                })
                .catch(() => caches.match("./index.html"))
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => {
            const network = fetch(request).then((response) => {
                if (response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                }
                return response;
            });
            return cached || network;
        })
    );
});

messaging.onBackgroundMessage((payload) => {
    const title = payload.notification?.title || "Taxi Platino";
    const options = {
        body: payload.notification?.body || "Tienes una actualización de servicio.",
        icon: "./assets/taxi-platino.svg",
        badge: "./assets/taxi-platino.svg",
        data: { url: "./" }
    };
    return self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true })
            .then((clients) => {
                const existing = clients.find((client) => client.url.includes("/Agendados/"));
                return existing ? existing.focus() : self.clients.openWindow("./");
            })
    );
});
