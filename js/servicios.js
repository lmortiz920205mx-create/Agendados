import { db } from "./firebase.js";
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { userRole } from "./auth.js";
import { actualizarUI, elementosDOM, tabActual } from "./ui.js";

export let servicios = [];
let audio;
let audioHabilitado = false;
let sonidoActivo = false;

export function cargarServicios() {
    audio = document.getElementById('audioAlerta');
    const q = query(collection(db, "servicios"), orderBy("fecha", "asc"));

    onSnapshot(q, snap => {
        servicios = [];
        snap.forEach(d => servicios.push({ ...d.data(), id: d.id }));
        render();
    });

    }

export function render(filtro = "") {
    const lista = document.getElementById('lista');
    lista.innerHTML = "";
    const fragment = document.createDocumentFragment();
    const ahora = Date.now();
    const quinceMin = ahora + (15 * 60 * 1000);
    let hayUrgente = false;

    const filtrados = servicios.filter(s => 
        s.estado === tabActual && 
        ((s.nombre || "").toLowerCase().includes(filtro) || (s.domicilio || "").toLowerCase().includes(filtro))
    );

    filtrados.forEach(s => {

        const fechaTxt = formatearFechaPro(s.fecha);
        let div = elementosDOM[s.id] || document.createElement('div');
        elementosDOM[s.id] = div;
        
        const esUrgente = s.estado === 'pendiente' && s.fecha <= quinceMin && s.fecha >= ahora - 600000;
        if (esUrgente) hayUrgente = true;

        const fechaObj = new Date(s.fecha);

function formatearFechaPro(timestamp) {

    const fecha = new Date(timestamp);
    const ahora = new Date();

    // Normalizar fechas (sin hora)
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);

    const fechaBase = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());

    const horaTxt = fecha.toLocaleTimeString('es-MX', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const diaTxt = fecha.toLocaleDateString('es-MX', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit'
    });

    const hora = fecha.getHours();

    // 🌙 Madrugada
    const esMadrugada = hora >= 0 && hora < 6;

    if (fechaBase.getTime() === hoy.getTime()) {
        return `${esMadrugada ? '🌙' : '🚀'} HOY ${horaTxt}`;
    }

    if (fechaBase.getTime() === manana.getTime()) {
        return `🟡 MAÑANA ${horaTxt}`;
    }

    return `📅 ${diaTxt.toUpperCase()} ${horaTxt}`;
}
        const minRest = Math.floor((s.fecha - ahora) / 60000);
        const taxiDisabled = s.estado !== 'pendiente' || (s.unidad && s.unidad !== 'S/A');

        div.className = `servicio-card ${s.estado} ${esUrgente ? 'urgente-blink' : ''}`;
        div.innerHTML = `
            <small style="${minRest <= 15 && minRest >= 0 && s.estado === 'pendiente' ? 'color:red;' : ''}">
                ${minRest <= 15 && minRest >= 0 && s.estado === 'pendiente' ? `⏰ <b>${minRest} min</b> - ${fechaTxt}` : `📅 ${fechaTxt}`}
            </small><br>
            <b>${(s.nombre || "").toUpperCase()}</b><br>
            <div>📍 ${s.domicilio || ""}</div>
            <div>🚕 Unidad: <b>${s.unidad || "S/A"}</b></div>
            <div class="acciones">
                <button 
    class="btn-acc bg-ws" 
    data-id="${s.id}" 
    data-tel="${s.telefono || ""}"
    ${taxiDisabled ? 'disabled style="opacity:0.5;pointer-events:none;"' : ''}
>
    TAXI
</button>
                <button class="btn-acc bg-map" data-dom="${s.domicilio || ""}">MAPA</button>
                <button class="btn-acc bg-edit" data-id="${s.id}">EDIT</button>
                <button class="btn-acc bg-fin" data-id="${s.id}">FIN</button>
                <button class="btn-acc bg-del" data-id="${s.id}" style="${userRole === 'admin' ? '' : 'display:none'}">DEL</button>
            </div>`;
        fragment.appendChild(div);
    });

    lista.appendChild(fragment);
    manejarAlertas(hayUrgente);
    actualizarUI(servicios, hayUrgente);
}

function manejarAlertas(hayUrgente) {
    const btnSonido = document.getElementById('btnSonido');
    audioHabilitado = btnSonido.innerText === "🔊";
    if (hayUrgente && audioHabilitado) {
        if (!sonidoActivo) { audio.play().catch(()=>{}); sonidoActivo = true; }
    } else { audio.pause(); sonidoActivo = false; }
    if (hayUrgente && navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

export async function guardarServicio(data, id) {

    console.log("🔥 GUARDAR LLAMADO");
    console.trace(); // 👈 ESTO ES ORO

    // 🧪 1. Validar que exista fecha
    if (!data.fecha) {
        console.error("❌ Fecha no definida");
        return;
    }

    // 🧪 2. Validar que sea número válido
    if (isNaN(data.fecha)) {
        console.error("❌ Fecha inválida:", data.fecha);
        return;
    }

    const ahora = Date.now();

        // ✅ Código corregido
if (data.fecha < ahora - 60000) {
    console.warn("⚠️ Fecha en el pasado detectada, ajustando a 24hrs después.");
    // En lugar de 1 minuto, sumamos 24 horas exactas (86,400,000 ms)
    data.fecha = data.fecha + 86400000; 
}

    // 🧪 4. Normalizar segundos (evita bugs raros)
    const fechaObj = new Date(data.fecha);
    fechaObj.setSeconds(0, 0);
    data.fecha = fechaObj.getTime();

    // 🧪 5. Log para debug
    console.log("✅ Guardando servicio:", {
        nombre: data.nombre,
        fecha: new Date(data.fecha)
    });

    await setDoc(doc(db, "servicios", id), data, { merge: true });
}

export async function cambiarEstado(id, estado, unidad = null) {
    const update = { estado };
    if (unidad) update.unidad = unidad;
    await setDoc(doc(db, "servicios", id), update, { merge: true });
}

export async function eliminarServicio(id) {
    await deleteDoc(doc(db, "servicios", id));
}