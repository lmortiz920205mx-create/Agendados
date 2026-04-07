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
        let div = elementosDOM[s.id] || document.createElement('div');
        elementosDOM[s.id] = div;
        
        const esUrgente = s.estado === 'pendiente' && s.fecha <= quinceMin && s.fecha >= ahora - 600000;
        if (esUrgente) hayUrgente = true;

        const fechaTxt = new Date(s.fecha).toLocaleString('es-MX', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
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

    // 🧪 3. Evitar guardar en el pasado (tolerancia 1 minuto)
    if (data.fecha < ahora - 60000) {
        console.warn("⚠️ Fecha en el pasado detectada:", new Date(data.fecha));

        // 🔥 CORRECCIÓN AUTOMÁTICA
        data.fecha = ahora + 60000; // lo manda 1 minuto al futuro
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