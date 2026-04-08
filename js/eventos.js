import { userRole, logout, userName } from "./auth.js";
import { render, guardarServicio, servicios, eliminarServicio } from "./servicios.js";
import { db } from "./firebase.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { borradorRapido, exportarExcel, actualizarResumenDias } from "./utils.js";

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

    // Control de recurrencia (Reparado)
    document.getElementById('recurrencia').onchange = (e) => {
        const bloque = document.getElementById('bloqueRecurrencia');
        if (e.target.value === 'diario') {
            bloque.classList.add('activo');
        } else {
            bloque.classList.remove('activo');
            document.querySelectorAll('#diasSemana input').forEach(c => c.checked = false);
        }
    };

    // BOTÓN GUARDAR Y NOTIFICAR WHATSAPP
    document.getElementById('btnGuardar').onclick = async () => {
        const btn = document.getElementById('btnGuardar');
        const nom = document.getElementById('nombre').value;
        const fec = document.getElementById('fecha').value;
        const idExistente = document.getElementById('edit-id').value;

        if (!nom || !fec) return Swal.fire('Error', 'Completa Nombre y Fecha', 'warning');

        btn.disabled = true;
        btn.innerText = "⏳ Guardando...";

        const [fPart, hPart] = fec.split("T");
        const [y, m, d] = fPart.split("-").map(Number);
        const [h, min] = hPart.split(":").map(Number);
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

        try {
            await guardarServicio(data, idExistente || crypto.randomUUID());
            
            // ✅ MENSAJE DE WHATSAPP MEJORADO (Como antes)
            if (!idExistente) {
                const fechaFmt = new Date(data.fecha).toLocaleString('es-MX', { 
                    weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' 
                }).toUpperCase();

                const mensaje = 
                    `✨ *NUEVO SERVICIO REGISTRADO* ✨%0A` +
                    `━━━━━━━━━━━━━━━━━━%0A` +
                    `👤 *CLIENTE:* ${data.nombre.toUpperCase()}%0A` +
                    `📍 *ORIGEN:* ${data.domicilio}%0A` +
                    `📞 *TELÉFONO:* ${data.telefono || 'SIN TEL'}%0A` +
                    `📅 *FECHA/HORA:* ${fechaFmt}%0A` +
                    `━━━━━━━━━━━━━━━━━━%0A` +
                    `✍️ _Registrado por: ${userName}_`;
                
                window.open(`https://wa.me/?text=${mensaje}`, '_blank');
            }
            borradorRapido();
        } catch (err) { console.error(err); } 
        finally { btn.disabled = false; btn.innerText = "Guardar y Notificar"; }
    };

    document.addEventListener('click', async e => {
        const t = e.target;
        const id = t.dataset.id;
        if (!id) return;

        // 🚖 ASIGNAR TAXI (SweetAlert Mejorado)
        if (t.classList.contains('bg-ws')) {
            const s = servicios.find(x => x.id === id);
            if (!s || s.estado !== 'pendiente' || t.disabled) return;

            const { value: unidad } = await Swal.fire({
                title: 'ASIGNAR UNIDAD',
                input: 'text',
                inputLabel: `Cliente: ${s.nombre}`,
                inputPlaceholder: 'Número de unidad...',
                confirmButtonText: 'Confirmar',
                confirmButtonColor: '#1a2b4c',
                showCancelButton: true,
                inputValidator: (value) => { if (!value) return 'Escribe el número de unidad'; }
            });

            if (unidad) {
                t.disabled = true;
                await updateDoc(doc(db, "servicios", id), {
                    unidad: unidad.toUpperCase(), estado: 'en-proceso', asignadoPor: userName
                });
            }
        }

        // 🏁 FINALIZAR Y RECURRENCIA (Blindado)
        if (t.classList.contains('bg-fin')) {
            const s = servicios.find(x => x.id === id);
            if (!s || s.estado !== 'en-proceso' || t.disabled) return;

            t.disabled = true; t.innerText = "⏳";

            try {
                await updateDoc(doc(db, "servicios", id), {
                    estado: 'finalizado', finalizadoPor: userName, fechaFin: Date.now()
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

                        const yaExiste = servicios.some(x => x.estado === 'pendiente' && x.nombre === s.nombre && Math.abs(x.fecha - tsFinal) < 60000);
                        if (!yaExiste) {
                            const nuevo = { ...s, fecha: tsFinal, estado: 'pendiente', unidad: 'S/A', creadoPor: userName };
                            delete nuevo.id; delete nuevo.asignadoPor; delete nuevo.finalizadoPor; delete nuevo.fechaFin;
                            await guardarServicio(nuevo, crypto.randomUUID());
                        }
                    }
                }
            } catch (err) { t.disabled = false; t.innerText = "FIN"; }
        }

        // EDITAR
        if (t.classList.contains('bg-edit')) {
            const s = servicios.find(x => x.id === id);
            if (!s) return;
            document.getElementById('edit-id').value = s.id;
            document.getElementById('nombre').value = s.nombre;
            document.getElementById('domicilio').value = s.domicilio;
            document.getElementById('telefono').value = s.telefono;
            document.getElementById('fecha').value = new Date(s.fecha - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
            document.getElementById('recurrencia').value = s.recurrencia;
            document.getElementById('bloqueRecurrencia').classList.toggle('activo', s.recurrencia === 'diario');
            
            document.querySelectorAll('#diasSemana input').forEach(i => i.checked = false);
            s.dias?.forEach(d => {
                const c = document.querySelector(`#diasSemana input[value="${d}"]`);
                if(c) c.checked = true;
            });
            actualizarResumenDias();
            window.scrollTo(0,0);
        }

        if (t.classList.contains('bg-del') && userRole === "admin") {
            if ((await Swal.fire({title:'¿Borrar?', showCancelButton:true})).isConfirmed) await eliminarServicio(id);
        }
    });

    document.getElementById('btnExcel').onclick = exportarExcel;
    document.getElementById('btnLimpiar').onclick = borradorRapido;
}