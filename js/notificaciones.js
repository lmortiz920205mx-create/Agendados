import { messaging, db } from "./firebase.js";
import { getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export async function activarNotificaciones(user, role) {
    try {
        const permiso = await Notification.requestPermission();
        if (permiso !== "granted") return;

        const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
        const token = await getToken(messaging, {
            vapidKey: "BOiwH3kCXA24-2Sdi7fTYbx2H3EL6oAgBzqtSpaK-1xlwc4kerPYy0YF7uzPme1zo3fO2jo8WGm52j6VbU0-2vc",
            serviceWorkerRegistration: registration
        });

        await setDoc(doc(db, "tokens", user.uid), { token: token, role: role });

        onMessage(messaging, payload => {
            new Notification(payload.notification.title, { body: payload.notification.body });
        });
    } catch (error) {
        console.error("Error notificaciones:", error);
    }
}