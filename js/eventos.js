import { userRole, logout } from "./auth.js";
import { render, guardarServicio, servicios, eliminarServicio, cambiarEstado } from "./servicios.js";
import { functions } from "./firebase.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";
import { exportarExcel, borradorRapido, actualizarResumenDias } from "./utils.js";

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

    // Guardar
    document.getElementById('btnGuardar').onclick = async () => {
        const nom = document.getElementById('nombre').value;
        const fec = document.getElementById('fecha').value;
        if (!nom || !fec) return Swal.fire('Error', 'Datos incompletos', 'warning');

        const id = document.getElementById('edit-id').value || crypto.randomUUID();
        const tipoRec = document.getElementById('recurrencia').value;
        let dias = tipoRec === 'diario' ? Array.from(document.querySelectorAll('#diasSemana input:checked')).map(c => parseInt(c.value)) : [];

        const data = {
            nombre: nom,
            telefono: document.getElementById('telefono').value,
            domicilio: document.getElementById('domicilio').value,
            fecha: new Date(fec).getTime(),
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

    // Recurrencia
    document.getElementById('recurrencia').onchange = (e) => {
        const bloque = document.getElementById('bloqueRecurrencia');
        e.target.value === 'diario' ? bloque.classList.add('activo') : bloque.classList.remove('activo');
    };

    document.getElementById('btnTodos').onclick = () => {
        document.querySelectorAll('#diasSemana input').forEach(c => c.checked = true);
        actualizarResumenDias();
    };

    document.getElementById('btnLimpiarDias').onclick = () => {
        document.querySelectorAll('#diasSemana input').forEach(c => c.checked = false);
        actualizarResumenDias();
    };

    // Delegación de eventos en lista
    document.addEventListener('click', async e => {
        const t = e.target;
        const id = t.dataset.id;

        if(t.classList.contains('bg-ws')) {
            const { value: u } = await Swal.fire({ title: 'Unidad:', input: 'text' });
            if(u) {
                await cambiarEstado(id, 'en-proceso', u);
                const msg = `🚖 *TAXI PLATINO*\nUnidad: ${u}\nEn camino...`;
                window.open(`https://wa.me/52${t.dataset.tel}?text=${encodeURIComponent(msg)}`, '_blank');
            }
        }
        if(t.classList.contains('bg-map')) window.open(`https://www.google.com/maps/search/${encodeURIComponent(t.dataset.dom + ' Minatitlan')}`, '_blank');
        if(t.classList.contains('bg-edit')) {
            const s = servicios.find(x => x.id === id);
            document.getElementById('edit-id').value = s.id;
            document.getElementById('nombre').value = s.nombre;
            document.getElementById('fecha').value = new Date(s.fecha - new Date().getTimezoneOffset()*60000).toISOString().slice(0,16);
            window.scrollTo(0,0);
        }
        if(t.classList.contains('bg-fin')) await cambiarEstado(id, 'finalizado');
        if(t.classList.contains('bg-del') && userRole === "admin") {
            if((await Swal.fire({title:'¿Borrar?', showCancelButton:true})).isConfirmed) await eliminarServicio(id);
        }
    });

    document.getElementById('btnExcel').onclick = exportarExcel;
    document.getElementById('btnLimpiar').onclick = borradorRapido;
}