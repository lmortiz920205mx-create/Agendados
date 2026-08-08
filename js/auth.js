import { auth } from "./firebase.js";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { activarNotificaciones, actualizarBotonNotificaciones } from "./notificaciones.js";

export let userRole = null;
export let userName = null;
export let currentUser = null;

const PHONE_DOMAIN = "taxiplatino.app";

export function normalizarTelefono(value = "") {
    return String(value).replace(/\D/g, "").slice(-10);
}

function identificadorAEmail(value) {
    const identifier = String(value || "").trim().toLowerCase();
    const phone = normalizarTelefono(identifier);

    if (/^\d{10}$/.test(phone) && !identifier.includes("@")) {
        return `${phone}@${PHONE_DOMAIN}`;
    }

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
        return identifier;
    }

    throw new Error("Escribe un teléfono de 10 dígitos o un correo válido.");
}

function nombreVisible(user) {
    if (user.displayName) return user.displayName;
    const syntheticPhone = user.email?.endsWith(`@${PHONE_DOMAIN}`)
        ? user.email.split("@")[0]
        : null;
    return syntheticPhone || user.email || "Usuario";
}

function mostrarAplicacion() {
    document.getElementById("loader").classList.add("hidden");
    document.getElementById("app-content").classList.remove("hidden");
}

function ocultarAplicacion() {
    document.getElementById("app-content").classList.add("hidden");
    document.getElementById("loader").classList.remove("hidden");
}

export function initAuth(onLogin, onLogout) {
    onAuthStateChanged(auth, async (user) => {
        window.clearTimeout(window.__taxiBootTimeout);
        currentUser = user || null;

        if (!user) {
            userRole = null;
            userName = null;
            ocultarAplicacion();
            document.getElementById("loader").classList.add("hidden");
            onLogout?.();
            await loginManual();
            return;
        }

        try {
            const token = await user.getIdTokenResult(true);
            userRole = token.claims.role === "admin" ? "admin" : "operador";
            userName = nombreVisible(user);

            const roleLabel = document.getElementById("rolUser");
            roleLabel.textContent = userRole === "admin"
                ? `Administrador · ${userName}`
                : `Operador · ${userName}`;

            const registerButton = document.getElementById("btnRol");
            registerButton.hidden = userRole !== "admin";

            mostrarAplicacion();
            onLogin?.();

            actualizarBotonNotificaciones();
            if ("Notification" in window && Notification.permission === "granted") {
                activarNotificaciones(user, userRole, false).catch((error) => {
                    console.warn("No fue posible actualizar las notificaciones:", error);
                });
            }
        } catch (error) {
            console.error("No se pudo preparar la sesión:", error);
            await signOut(auth);
            Swal.fire("Error", "No fue posible cargar tu sesión. Intenta nuevamente.", "error");
        }
    });
}

async function loginManual() {
    if (Swal.isVisible()) Swal.close();

    await Swal.fire({
        title: "Acceso Taxi Platino",
        imageUrl: "./assets/taxi-platino.svg",
        imageWidth: 82,
        imageHeight: 82,
        imageAlt: "Taxi Platino",
        html: `
            <div class="swal-login">
                <label for="u">Teléfono o correo
                    <input id="u" autocomplete="username" inputmode="email" placeholder="10 dígitos o correo">
                </label>
                <label for="p">Contraseña
                    <input id="p" type="password" autocomplete="current-password" placeholder="Tu contraseña">
                </label>
            </div>`,
        confirmButtonText: "Entrar",
        confirmButtonColor: "#10213f",
        allowOutsideClick: false,
        allowEscapeKey: false,
        showCloseButton: false,
        showLoaderOnConfirm: true,
        didOpen: () => document.getElementById("u")?.focus(),
        preConfirm: async () => {
            const identifier = document.getElementById("u").value;
            const password = document.getElementById("p").value;

            if (!identifier.trim() || !password) {
                Swal.showValidationMessage("Escribe tu teléfono o correo y la contraseña.");
                return false;
            }

            try {
                const email = identificadorAEmail(identifier);
                await signInWithEmailAndPassword(auth, email, password);
                return true;
            } catch (error) {
                const message = error.message?.startsWith("Escribe")
                    ? error.message
                    : "Datos incorrectos o usuario no registrado.";
                Swal.showValidationMessage(message);
                return false;
            }
        }
    });
}

export async function logout() {
    const result = await Swal.fire({
        title: "¿Cerrar sesión?",
        text: "Tendrás que ingresar nuevamente para usar el sistema.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Cerrar sesión",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#c93636"
    });

    if (result.isConfirmed) await signOut(auth);
}
