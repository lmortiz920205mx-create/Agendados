import { userRole, logout, userName } from "./auth.js";
import { render, guardarServicio, servicios, eliminarServicio } from "./servicios.js";
import { db, functions } from "./firebase.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";
import { exportarExcel, borradorRapido } from "./utils.js";

function obtenerSiguienteFechaValida(fechaActual, diasPermitidos) {
    const nueva = new Date(fechaActual);
    for (let i = 1; i <= 7; i++) {
        nueva.setDate(nueva.getDate() + 1);
        if (diasPermitidos.includes(nueva.getDay())) return nueva;
    }
    return null;
}

export function initEventos() {
    document.getElementById('btnLogout').onclick = logout;

    // Control de Interfaz: Mostrar/Ocultar días de semana
    document.getElementById('recurrencia').onchange = (e) => {
        const bloque = document.getElementById('bloqueRecurrencia');
        if (e.target.value === 'diario') {
            bloque.classList.add('activo');
        } else {
            bloque.classList.remove('activo');
            document.querySelectorAll('#diasSemana input').forEach(c => c.checked = false);
        }
    };

    // Guardar Servicio Manual
    document.getElementById('btnGuardar').onclick = async () => {
        const nom = document.getElementById('nombre').value;
        const fec = document.getElementById('fecha').value;
        if (!nom || !fec) return Swal.fire('Error', 'Datos incompletos', 'warning');

        const [fechaP, horaP] = fec.split("T");
        const [y, m, d] = fechaP.split("-").map(Number);
        const [h, min] = horaP.split(":").map(Number);
        let fechaSel = new Date(y, m - 1, d, h, min);

        const data = {
            nombre: nom,
            telefono: document.getElementById('telefono').value,
            domicilio: document.getElementById('domicilio').value,
            fecha: fechaSel.getTime(),
            recurrencia: document.getElementById('recurrencia').value,
            dias: Array.from(document.querySelectorAll('#diasSemana input:checked')).map(c => parseInt(c.value)),
            estado: 'pendiente',
            unidad: 'S/A',
            creadoPor: userName
        };

        await guardarServicio(data, document.getElementById('edit-id').value || crypto.randomUUID());
        borradorRapido();
    };

    // Eventos Click
    document.addEventListener('click', async e => {
        const t = e.target;
        const id = t.dataset.id;
        if (!id) return;

        // TAXI
        if (t.classList.contains('bg-ws')) {
            const { value: u } = await Swal.fire({ title: 'Unidad', input: 'text', confirmButtonColor: '#1a2b4c' });
            if (u) {
                await updateDoc(doc(db, "servicios", id), {
                    unidad: u,
                    estado: 'en-proceso',
                    asignadoPor: userName
                });
            }
        }

        // FINALIZAR Y RECURRENCIA LIMPIA
        if (t.classList.contains('bg-fin')) {
            const s = servicios.find(x => x.id === id);
            
            await updateDoc(doc(db, "servicios", id), {
                estado: 'finalizado',
                finalizadoPor: userName,
                fechaFin: Date.now()
            });

            if (s.recurrencia === 'diario') {
                let fechaBase = new Date(s.fecha);
                if (fechaBase < new Date()) fechaBase.setFullYear(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

                let proxima = (s.dias && s.dias.length > 0) 
                    ? obtenerSiguienteFechaValida(fechaBase.getTime(), s.dias) 
                    : new Date(fechaBase.setDate(fechaBase.getDate() + 1));

                if (proxima) {
                    let tsFinal = proxima.getTime();
                    while (tsFinal <= Date.now()) tsFinal += 86400000;

                    // Clonar objeto y LIMPIARLO
                    const nuevo = { ...s, fecha: tsFinal, estado: 'pendiente', unidad: 'S/A', creadoPor: userName };
                    delete nuevo.id;
                    delete nuevo.asignadoPor;
                    delete nuevo.finalizadoPor;
                    delete nuevo.fechaFin;

                    await guardarServicio(nuevo, crypto.randomUUID());
                }
            }
        }

        // EDITAR
        if (t.classList.contains('bg-edit')) {
            const s = servicios.find(x => x.id === id);
            document.getElementById('edit-id').value = s.id;
            document.getElementById('nombre').value = s.nombre;
            document.getElementById('domicilio').value = s.domicilio;
            document.getElementById('telefono').value = s.telefono;
            document.getElementById('fecha').value = new Date(s.fecha - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
            
            // Si es recurrente, activar panel de días
            document.getElementById('recurrencia').value = s.recurrencia;
            document.getElementById('bloqueRecurrencia').classList.toggle('activo', s.recurrencia === 'diario');
            
            window.scrollTo(0,0);
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