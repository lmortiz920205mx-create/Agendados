import { db } from "./firebase.js";
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { userRole, userName } from "./auth.js";
import { actualizarUI, elementosDOM, tabActual } from "./ui.js";

export let servicios = [];
let audio;
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
        const fechaFmt = new Date(s.fecha).toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: '2-digit' }).toUpperCase() + " " + new Date(s.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        
        let div = elementosDOM[s.id] || document.createElement('div');
        elementosDOM[s.id] = div;
        
        const esUrgente = s.estado === 'pendiente' && s.fecha <= quinceMin && s.fecha >= ahora - 600000;
        if (esUrgente) hayUrgente = true;

        div.className = `servicio-card ${s.estado} ${esUrgente ? 'urgente-blink' : ''}`;
        
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; font-size:0.7rem; font-weight:bold; color:#1a2b4c; margin-bottom:5px;">
                <span>📅 ${fechaFmt}</span>
                ${s.recurrencia === 'diario' ? '<span>🔁 RECURRENTE</span>' : ''}
            </div>
            
            <b style="font-size: 1.1rem; color: #1a2b4c;">${(s.nombre || "").toUpperCase()}</b><br>
            <div style="margin: 5px 0; color: #444;">📍 ${s.domicilio || ""}</div>
            <div style="font-size: 0.9rem;">🚕 Unidad: <b style="background:#fbc02d; padding:2px 6px; border-radius:4px; color:black;">${s.unidad || "S/A"}</b></div>

            <div style="font-size: 0.65rem; color: #888; border-top: 1px solid #eee; padding-top: 5px; margin-top: 8px; display: flex; justify-content: space-between;">
                <span>📝 Crea: ${s.creadoPor || 'Sist.'}</span>
                <span>🚖 Asigna: ${s.asignadoPor || '---'}</span>
            </div>

            <div class="acciones" style="margin-top:10px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px;">
                <button class="btn-acc bg-ws" data-id="${s.id}" ${s.estado !== 'pendiente' ? 'disabled style="opacity:0.4"' : ''}>TAXI</button>
                <button class="btn-acc bg-map" data-dom="${s.domicilio || ""}">MAPA</button>
                <button class="btn-acc bg-edit" data-id="${s.id}" ${s.estado === 'finalizado' ? 'disabled style="opacity:0.4"' : ''}>EDIT</button>
                <button class="btn-acc bg-fin" data-id="${s.id}" ${s.estado !== 'en-proceso' ? 'disabled style="opacity:0.4"' : ''}>FIN</button>
                <button class="btn-acc bg-del" data-id="${s.id}" style="${userRole === 'admin' ? 'grid-column: span 4;' : 'display:none'}">ELIMINAR</button>
            </div>`;

        fragment.appendChild(div);
    });

    lista.appendChild(fragment);
    manejarAlertas(hayUrgente);
    actualizarUI(servicios, hayUrgente);
}

function manejarAlertas(hayUrgente) {
    const btnSonido = document.getElementById('btnSonido');
    if (!btnSonido || !audio) return;

    const audioHabilitado = (btnSonido.innerText === "🔊");

    if (hayUrgente && audioHabilitado) {
        if (!sonidoActivo) {
            audio.play().catch(e => console.warn("Audio bloqueado por navegador"));
            sonidoActivo = true;
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        }
    } else {
        audio.pause();
        audio.currentTime = 0;
        sonidoActivo = false;
    }
}

export async function guardarServicio(data, id) {
    const d = new Date(data.fecha);
    d.setSeconds(0, 0); d.setMilliseconds(0);
    data.fecha = d.getTime();

    const final = { ...data, fechaRegistro: Date.now() };
    await setDoc(doc(db, "servicios", id), final, { merge: true });
}

export async function eliminarServicio(id) {
    await deleteDoc(doc(db, "servicios", id));
}