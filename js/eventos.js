import { userRole, logout, userName } from "./auth.js";
import { render, guardarServicio, servicios, eliminarServicio } from "./servicios.js";
import { db } from "./firebase.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { borradorRapido, exportarExcel, actualizarResumenDias } from "./utils.js";

export function initEventos() {
    // Logout
    document.getElementById('btnLogout').onclick = logout;

    // ✅ MEJORA: Botón de Sonido (Alarma) Restaurado
    document.getElementById('btnSonido').onclick = (e) => {
        const estaMudo = e.target.innerText === "🔇";
        e.target.innerText = estaMudo ? "🔊" : "🔇";
        // El render() de servicios.js leerá este cambio para activar/desactivar el audio
    };

    // Control de bloque de recurrencia
    document.getElementById('recurrencia').onchange = (e) => {
        const bloque = document.getElementById('bloqueRecurrencia');
        if (e.target.value === 'diario') {
            bloque.classList.add('activo');
        } else {
            bloque.classList.remove('activo');
            document.querySelectorAll('#diasSemana input').forEach(c => c.checked = false);
        }
    };

    // 💾 BOTÓN GUARDAR (Notifica al Grupo)
    document.getElementById('btnGuardar').onclick = async () => {
        const btn = document.getElementById('btnGuardar');
        const nom = document.getElementById('nombre').value;
        const fec = document.getElementById('fecha').value;
        const idExistente = document.getElementById('edit-id').value;

        if (!nom || !fec) return Swal.fire('Error', 'Nombre y Fecha son obligatorios', 'warning');

        btn.disabled = true;
        btn.innerText = "⏳ Guardando...";

        try {
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
                creadoPor: userName || "Sistema"
            };

            await guardarServicio(data, idExistente || crypto.randomUUID());
            
            // ✅ Notificación al Grupo (Solo si es nuevo)
            if (!idExistente) {
                const fFmt = new Date(data.fecha).toLocaleString('es-MX', { 
                    weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' 
                }).toUpperCase();

                const msgGrupo = `✨ *NUEVO SERVICIO REGISTRADO* ✨%0A━━━━━━━━━━━━━━━━━━%0A👤 *CLIENTE:* ${data.nombre.toUpperCase()}%0A📍 *ORIGEN:* ${data.domicilio}%0A📞 *TEL:* ${data.telefono || 'SIN TEL'}%0A📅 *HORA:* ${fFmt}%0A━━━━━━━━━━━━━━━━━━%0A✍️ _Registrado por: ${userName}_`;
                window.open(`https://wa.me/?text=${msgGrupo}`, '_blank');
            }
            borradorRapido();
        } catch (err) {
            console.error(err);
            Swal.fire('Error', 'No se pudo guardar', 'error');
        } finally {
            btn.disabled = false;
            btn.innerText = "Guardar y Notificar";
        }
    };

    // Eventos delegados para tarjetas
    document.addEventListener('click', async e => {
        const t = e.target;
        const id = t.dataset.id;
        if (!id) return;

        // 🚖 ASIGNAR UNIDAD (Notifica al Cliente)
        if (t.classList.contains('bg-ws')) {
            const s = servicios.find(x => x.id === id);
            if (!s || s.estado !== 'pendiente' || t.disabled) return;

            const { value: unidad } = await Swal.fire({
                title: 'ASIGNAR UNIDAD',
                input: 'text',
                inputLabel: `Servicio para: ${s.nombre}`,
                inputPlaceholder: 'Número de unidad...',
                confirmButtonText: 'Asignar y Avisar',
                confirmButtonColor: '#1a2b4c',
                showCancelButton: true,
                inputValidator: (v) => { if (!v) return 'Debes ingresar una unidad'; }
            });

            if (unidad) {
                t.disabled = true;
                await updateDoc(doc(db, "servicios", id), {
                    unidad: unidad.toUpperCase(),
                    estado: 'en-proceso',
                    asignadoPor: userName
                });

                // ✅ Notificación al Cliente vía WhatsApp
                if (s.telefono && s.telefono.trim().length >= 10) {
                    const msgCliente = `🚕 *TAXI PLATINO*%0A━━━━━━━━━━━━━━━━━━%0AHola *${s.nombre.toUpperCase()}*, le informamos que la unidad *${unidad.toUpperCase()}* va en camino a su ubicacion:%0A📍 _${s.domicilio}_%0A━━━━━━━━━━━━━━━━━━%0A*Gracias por su preferencia.*`;
                    window.open(`https://wa.me/${s.telefono}?text=${msgCliente}`, '_blank');
                }
            }
        }

        // 🏁 FINALIZAR Y LOGICA DE RECURRENCIA
        if (t.classList.contains('bg-fin')) {
            const s = servicios.find(x => x.id === id);
            if (!s || s.estado !== 'en-proceso' || t.disabled) return;

            t.disabled = true; t.innerText = "⏳";

            try {
                await updateDoc(doc(db, "servicios", id), {
                    estado: 'finalizado',
                    finalizadoPor: userName,
                    fechaFin: Date.now()
                });

                if (s.recurrencia === 'diario') {
                    // Lógica para generar el siguiente servicio basado en días seleccionados
                    let fechaBase = new Date(s.fecha);
                    if (fechaBase < new Date()) {
                        const hoy = new Date();
                        fechaBase.setFullYear(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
                    }

                    let proxima;
                    if (s.dias && s.dias.length > 0) {
                        const nueva = new Date(fechaBase);
                        let encontrado = false;
                        for (let i = 1; i <= 7; i++) {
                            nueva.setDate(nueva.getDate() + 1);
                            if (s.dias.includes(nueva.getDay())) {
                                proxima = nueva;
                                encontrado = true;
                                break;
                            }
                        }
                    } else {
                        proxima = new Date(fechaBase.setDate(fechaBase.getDate() + 1));
                    }

                    if (proxima) {
                        const yaExiste = servicios.some(x => x.estado === 'pendiente' && x.nombre === s.nombre && Math.abs(x.fecha - proxima.getTime()) < 60000);
                        if (!yaExiste) {
                            const nuevo = { ...s, fecha: proxima.getTime(), estado: 'pendiente', unidad: 'S/A', creadoPor: "Sistema (Recurrente)" };
                            delete nuevo.id; delete nuevo.asignadoPor; delete nuevo.finalizadoPor;
                            await guardarServicio(nuevo, crypto.randomUUID());
                        }
                    }
                }
            } catch (err) { t.disabled = false; t.innerText = "FIN"; }
        }

        // 📝 EDITAR
        if (t.classList.contains('bg-edit')) {
            const s = servicios.find(x => x.id === id);
            if (!s) return;
            document.getElementById('edit-id').value = s.id;
            document.getElementById('nombre').value = s.nombre;
            document.getElementById('domicilio').value = s.domicilio;
            document.getElementById('telefono').value = s.telefono;
            // Ajuste de zona horaria para el input datetime-local
            const offset = new Date().getTimezoneOffset() * 60000;
            document.getElementById('fecha').value = new Date(s.fecha - offset).toISOString().slice(0, 16);
            document.getElementById('recurrencia').value = s.recurrencia;
            document.getElementById('bloqueRecurrencia').classList.toggle('activo', s.recurrencia === 'diario');
            
            // Marcar días
            document.querySelectorAll('#diasSemana input').forEach(i => {
                i.checked = s.dias?.includes(parseInt(i.value));
            });
            actualizarResumenDias();
            window.scrollTo(0, 0);
        }

        // 🗑️ ELIMINAR
        if (t.classList.contains('bg-del') && userRole === "admin") {
            const conf = await Swal.fire({ title: '¿Borrar servicio?', showCancelButton: true, confirmButtonColor: '#d33' });
            if (conf.isConfirmed) await eliminarServicio(id);
        }
    });

    document.getElementById('btnExcel').onclick = exportarExcel;
    document.getElementById('btnLimpiar').onclick = borradorRapido;
}