import { auth } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { activarNotificaciones } from "./notificaciones.js";

export let userRole = null;

export function initAuth(onLogin, onLogout) {
    onAuthStateChanged(auth, async user => {
        const loader = document.getElementById('loader');
        if (user) {
            try {
                const token = await user.getIdTokenResult();
                userRole = token.claims.role || "operador";
                await activarNotificaciones(user, userRole);
                document.getElementById('rolUser').innerText = userRole === "admin" ? "👑 ADMIN" : "👨‍💼 OPERADOR";
                loader.style.display = "none";
                document.getElementById('mainBody').style.display = "block";
                onLogin();
            } catch (error) {
                console.error(error);
                loader.innerHTML = "<p>Error al cargar</p>";
            }
        } else {
            loader.style.display = "none";
            document.getElementById('mainBody').style.display = "block";
            loginManual();
        }
    });
}

async function loginManual() {
    const { value: v } = await Swal.fire({
        title: '🔐 ACCESO TAXI PLATINO',
        html: `<input id="u" class="swal2-input" placeholder="Correo"><input id="p" type="password" class="swal2-input" placeholder="Contraseña">`,
        confirmButtonText: "Entrar",
        confirmButtonColor: '#1a2b4c',
        allowOutsideClick: false,
        preConfirm: () => [document.getElementById('u').value, document.getElementById('p').value]
    });

    if (v && v[0] && v[1]) {
        try {
            await signInWithEmailAndPassword(auth, v[0], v[1]);
        } catch (e) {
            Swal.fire('Error', 'Credenciales incorrectas', 'error');
            loginManual();
        }
    }
}

export function logout() {
    Swal.fire({ title: '¿Cerrar sesión?', showCancelButton: true, confirmButtonColor: '#d33' }).then(r => {
        if(r.isConfirmed) signOut(auth);
    });
}