import { initAuth } from "./auth.js";
import { cargarServicios } from "./servicios.js";
import { initTabs } from "./ui.js";
import { initEventos } from "./eventos.js";

window.onerror = (m) => console.error("ERROR GLOBAL:", m);

// Orquestación de inicio
initAuth(
    () => { // Al loguear
        initTabs();
        initEventos();
        cargarServicios();
    }
);

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('../firebase-messaging-sw.js')
        .then(() => console.log("SW registrado"));
}