import { messaging, db } from "./firebase.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const VAPID_KEY = "BOiwH3kCXA24-2Sdi7fTYbx2H3EL6oAgBzqtSpaK-1xlwc4kerPYy0YF7uzPme1zo3fO2jo8WGm52j6VbU0-2vc";
let foregroundListenerReady = false;

function notificationButton() {
    return document.getElementById("btnNotificaciones");
}

export function actualizarBotonNotificaciones() {
    const button = notificationButton();
    if (!button) return;

    const supported = "Notification" in window && "serviceWorker" in navigator;
    const granted = supported && Notification.permission === "granted";

    button.disabled = !supported;
    button.classList.toggle("enabled", granted);
    button.setAttribute("aria-pressed", String(granted));
    button.setAttribute(
        "aria-label",
        granted ? "Notificaciones activas" : "Activar notificaciones"
    );
    button.title = supported
        ? (granted ? "Notificaciones activas" : "Activar notificaciones")
        : "Este navegador no admite notificaciones";
}

export async function activarNotificaciones(user, role, solicitarPermiso = true) {
    if (!user || !("Notification" in window) || !("serviceWorker" in navigator)) {
        actualizarBotonNotificaciones();
        return false;
    }

    let permission = Notification.permission;
    if (solicitarPermiso && permission === "default") {
        permission = await Notification.requestPermission();
    }

    actualizarBotonNotificaciones();
    if (permission !== "granted") return false;

    const registration = await navigator.serviceWorker.ready;
    const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: registration
    });

    if (!token) throw new Error("Firebase no devolvió un token de notificación.");

    await setDoc(doc(db, "tokens", user.uid), {
        token,
        role,
        updatedAt: Date.now(),
        userAgent: navigator.userAgent.slice(0, 220)
    }, { merge: true });

    if (!foregroundListenerReady) {
        onMessage(messaging, async (payload) => {
            const title = payload.notification?.title || "Taxi Platino";
            const options = {
                body: payload.notification?.body || "Tienes una actualización de servicio.",
                icon: "./assets/taxi-platino.svg",
                badge: "./assets/taxi-platino.svg"
            };
            const activeRegistration = await navigator.serviceWorker.ready;
            activeRegistration.showNotification(title, options);
        });
        foregroundListenerReady = true;
    }

    actualizarBotonNotificaciones();
    return true;
}
