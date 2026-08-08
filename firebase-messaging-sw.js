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
const CACHE_NAME = "taxi-platino-agendados-v5";
const APP_SHELL = [
    "./",
    "./index.html",
    "./manifest.json",
    "./css/styles.css",
    "./assets/taxi-platino.svg",
    "./alerta.mp3",
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
        (async () => {
            const cache = await caches.open(CACHE_NAME);
            await Promise.all(APP_SHELL.map(async (path) => {
                try {
                    const response = await fetch(new Request(path, { cache: "reload" }));
                    if (response.ok) await cache.put(path, response);
                } catch (error) {
                    console.warn("No se pudo precargar:", path, error);
                }
            }));
            await self.skipWaiting();
        })()
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
            (async () => {
                try {
                    const response = await fetch(request);
                    const copy = response.clone();
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put("./index.html", copy);
                    return response;
                } catch (error) {
                    const cached = await caches.match("./index.html", { ignoreSearch: true }) ||
                        await caches.match("./", { ignoreSearch: true });
                    if (cached) return cached;

                    return new Response(`<!DOCTYPE html>
                        <html lang="es-MX"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
                        <title>Taxi Platino sin conexión</title>
                        <body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#08152b;color:white;font-family:Arial,sans-serif;text-align:center;padding:24px;box-sizing:border-box">
                        <main><h1>Taxi Platino</h1><p>No hay conexión y la aplicación todavía no está almacenada.</p><button onclick="location.reload()" style="padding:12px 18px;border:0;border-radius:10px;font-weight:bold">Reintentar</button></main></body></html>`, {
                        status: 200,
                        headers: { "Content-Type": "text/html; charset=utf-8" }
                    });
                }
            })()
        );
        return;
    }

    event.respondWith(
        (async () => {
            const cached = await caches.match(request, { ignoreSearch: true });
            if (cached) {
                fetch(request)
                    .then(async (response) => {
                        if (response.ok) {
                            const cache = await caches.open(CACHE_NAME);
                            await cache.put(request, response.clone());
                        }
                    })
                    .catch(() => {});
                return cached;
            }

            try {
                const response = await fetch(request);
                if (response.ok) {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(request, response.clone());
                }
                return response;
            } catch (error) {
                if (request.destination === "audio") {
                    return new Response(null, { status: 204 });
                }
                return new Response("Recurso temporalmente no disponible", {
                    status: 503,
                    statusText: "Offline",
                    headers: { "Content-Type": "text/plain; charset=utf-8" }
                });
            }
        })()
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
