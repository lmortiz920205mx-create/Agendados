import { initAuth } from "./auth.js";
import { cargarServicios, detenerServicios } from "./servicios.js";
import { initTabs, setConnectionStatus } from "./ui.js";
import { initEventos } from "./eventos.js";

window.addEventListener("error", (event) => {
    console.error("Error global:", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
    console.error("Promesa rechazada:", event.reason);
});

function iniciarAplicacion() {
    initTabs();
    initEventos();
    cargarServicios();
}

function cerrarAplicacion() {
    detenerServicios();
    const list = document.getElementById("lista");
    if (list) list.replaceChildren();
}

initAuth(iniciarAplicacion, cerrarAplicacion);

setConnectionStatus(navigator.onLine);
window.addEventListener("online", () => setConnectionStatus(true));
window.addEventListener("offline", () => setConnectionStatus(false));

if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
        try {
            const registration = await navigator.serviceWorker.register(
                "./firebase-messaging-sw.js",
                { scope: "./" }
            );
            console.info("Service worker activo:", registration.scope);
        } catch (error) {
            console.error("No se pudo registrar la PWA:", error);
        }
    });
}
