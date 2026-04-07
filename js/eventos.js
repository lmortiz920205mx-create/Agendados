import { userRole, logout } from "./auth.js";
import { render, guardarServicio, servicios, eliminarServicio, cambiarEstado } from "./servicios.js";
import { functions } from "./firebase.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";
import { exportarExcel, borradorRapido, actualizarResumenDias } from "./utils.js";

// ✅ FUNCIÓN GLOBAL (IMPORTANTE)
function obtenerSiguienteFechaValida(fechaActual, diasPermitidos) {
    const nueva = new Date(fechaActual);

    for (let i = 1; i <= 7; i++) {
        nueva.setDate(nueva.getDate() + 1);

        const diaSemana = nueva.getDay(); // 0=domingo

        if (diasPermitidos.includes(diaSemana)) {
            return nueva;
        }
    }

    return null;
}

export function initEventos() {

    // Logout y Sonido
    document.getElementById('btnLogout').onclick = logout;

    document.getElementById('btnSonido').onclick = (e) => {
        const h = e.target.innerText === "🔇";
        e.target.innerText = h ? "🔊" : "🔇";
    };

    // Registrar Operador
    document.getElementById('btnRol').onclick = async () => {
        if (userRole !== "admin") return Swal.fire("Acceso denegado");

        const { value: uid } = await Swal.fire({ title: 'UID', input: 'text' });

        if (uid) {
            const asignarRol = httpsCallable(functions, "asignarRolOperador");
            await asignarRol({ uid });
            Swal.fire('Listo', 'Ahora es operador', 'success');
        }
    };

    // Guardar servicio
    document.getElementById('btnGuardar').onclick = async () => {
        const nom = document.getElementById('nombre').value;
        const fec = document.getElementById('fecha').value;

        if (!nom || !fec) return Swal.fire('Error', 'Datos incompletos', 'warning');

        const id = document.getElementById('edit-id').value || crypto.randomUUID();
        const tipoRec = document.getElementById('recurrencia').value;

        let dias = tipoRec === 'diario'
            ? Array.from(document.querySelectorAll('#diasSemana input:checked')).map(c => parseInt(c.value))
            : [];

        // 🔥 Parseo correcto en horario LOCAL
const [fechaParte, horaParte] = fec.split("T");
const [year, month, day] = fechaParte.split("-").map(Number);
const [hour, minute] = horaParte.split(":").map(Number);

let fechaSeleccionada = new Date(year, month - 1, day, hour, minute);

// 🧼 Normalizar segundos
fechaSeleccionada.setSeconds(0, 0);

const ahora = new Date();

// ⛔ Evitar pasado (solo para recurrencia)
if (tipoRec === 'diario' && fechaSeleccionada.getTime() <= ahora.getTime()) {
    fechaSeleccionada.setDate(fechaSeleccionada.getDate() + 1);
}

        const data = {
            nombre: nom,
            telefono: document.getElementById('telefono').value,
            domicilio: document.getElementById('domicilio').value,
            fecha: fechaSeleccionada.getTime(),
            recurrencia: tipoRec,
            dias: dias,
            estado: 'pendiente',
            unidad: 'S/A'
        };

        await guardarServicio(data, id);

        const f = new Date(data.fecha).toLocaleString();
        const msg = `🚕 *NUEVO SERVICIO*\n\n👤 *Cliente:* ${nom}\n📍 *Origen:* ${data.domicilio}\n⏰ *Hora:* ${f}`;

        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');

        borradorRapido();
    };

    // Recurrencia UI
    document.getElementById('recurrencia').onchange = (e) => {
        const bloque = document.getElementById('bloqueRecurrencia');

        if (e.target.value === 'diario') {
            bloque.classList.add('activo');
        } else {
            bloque.classList.remove('activo');
            document.querySelectorAll('#diasSemana input').forEach(c => c.checked = false);
        }
    };

    // ============================
    // 🔥 EVENTOS DE LISTA
    // ============================
    document.addEventListener('click', async e => {
        const t = e.target;
        const id = t.dataset.id;

        // 🚖 TAXI
        if (t.classList.contains('bg-ws')) {

            try {
                const s = servicios.find(x => x.id === id);

                if (!s || s.estado !== 'pendiente' || (s.unidad && s.unidad !== 'S/A')) {
                    return Swal.fire("Este servicio ya tiene unidad asignada", "", "info");
                }

                const { value: u } = await Swal.fire({
                    title: '🚖 Asignar unidad',
                    input: 'text',
                    inputPlaceholder: 'Ej: TX-01',
                    confirmButtonText: 'Asignar',
                    confirmButtonColor: '#1a2b4c'
                });

                if (!u) return;

                t.disabled = true;
                t.innerText = "⏳...";

                await cambiarEstado(id, 'en-proceso', u);

                try {
                    if (s.telefono && s.telefono.length >= 10) {
                        const msg = `🚖 *TAXI PLATINO*\n\n🚕 Unidad: ${u}\n📍 Va en camino\n⏱️ Gracias por preferirnos`;
                        window.open(`https://wa.me/52${s.telefono}?text=${encodeURIComponent(msg)}`, '_blank');
                    }
                } catch {}

                const audio = document.getElementById('audioAlerta');
                if (audio) {
                    audio.currentTime = 0;
                    audio.play().catch(()=>{});
                }

                if (navigator.vibrate) {
                    navigator.vibrate([200, 100, 200]);
                }

                t.innerText = "✔";
                t.style.background = "#2ecc71";

            } catch (err) {
                console.error(err);
                Swal.fire("Error", "No se pudo asignar", "error");

                t.innerText = "TAXI";
                t.disabled = false;
            }

            return;
        }

        // MAPA
        if (t.classList.contains('bg-map')) {
            window.open(`https://www.google.com/maps/search/${encodeURIComponent(t.dataset.dom + ' Minatitlan')}`, '_blank');
        }

        // EDITAR
        if (t.classList.contains('bg-edit')) {
            const s = servicios.find(x => x.id === id);

            document.getElementById('edit-id').value = s.id;
            document.getElementById('nombre').value = s.nombre;
            document.getElementById('fecha').value =
                new Date(s.fecha - new Date().getTimezoneOffset()*60000)
                .toISOString()
                .slice(0,16);

            window.scrollTo(0,0);
        }

        // FINALIZAR
        if (t.classList.contains('bg-fin')) {

            const s = servicios.find(x => x.id === id);

            await cambiarEstado(id, 'finalizado');

            if (s.recurrencia === 'diario') {

                let nuevaFecha;

                if (s.dias && s.dias.length > 0) {
                    nuevaFecha = obtenerSiguienteFechaValida(s.fecha, s.dias);
                } else {
                    nuevaFecha = new Date(s.fecha);
                    nuevaFecha.setDate(nuevaFecha.getDate() + 1);
                }

                if (!nuevaFecha) return;

                const yaExiste = servicios.some(x =>
                    x.fecha === nuevaFecha.getTime() &&
                    x.nombre === s.nombre &&
                    x.domicilio === s.domicilio
                );

                if (yaExiste) return;

                const nuevoServicio = {
                    ...s,
                    fecha: nuevaFecha.getTime(),
                    estado: 'pendiente',
                    unidad: 'S/A'
                };

                delete nuevoServicio.id;

                await guardarServicio(nuevoServicio, crypto.randomUUID());
            }
        }

        // ELIMINAR
        if (t.classList.contains('bg-del') && userRole === "admin") {
            if ((await Swal.fire({title:'¿Borrar?', showCancelButton:true})).isConfirmed) {
                await eliminarServicio(id);
            }
        }
    });

    document.getElementById('btnExcel').onclick = exportarExcel;
    document.getElementById('btnLimpiar').onclick = borradorRapido;
}