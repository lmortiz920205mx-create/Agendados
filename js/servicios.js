import { db } from "./firebase.js";
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { userRole, userName } from "./auth.js";
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

        const taxiDisabled = s.estado !== 'pendiente' || (s.unidad && s.unidad !== 'S/A');
        const finDisabled = s.estado !== 'en-proceso';
        const editDisabled = s.estado === 'finalizado';

        div.className = `servicio-card ${s.estado} ${esUrgente ? 'urgente-blink' : ''}`;
        
        div.innerHTML = `
            <div class="card-header" style="display:flex; justify-content:space-between; align-items:start;">
                <small style="font-weight:bold; color:#1a2b4c;">📅 ${fechaTxt}</small>
                ${s.recurrencia === 'diario' ? '<span style="font-size:10px; background:#eee; padding:2px 5px; border-radius:4px;">🔁 RECURRENTE</span>' : ''}
            </div>
            
            <div style="margin: 10px 0;">
                <b style="font-size: 1.1rem; color: #1a2b4c;">${(s.nombre || "").toUpperCase()}</b><br>
                <span style="color: #444; font-size: 0.95rem;">📍 ${s.domicilio || ""}</span><br>
                <div style="margin-top:5px;">
                    <span style="font-size: 0.9rem;">🚕 Unidad: <b style="background:#fbc02d; padding:2px 8px; border-radius:4px; color:black;">${s.unidad || "S/A"}</b></span>
                </div>
            </div>

            <div class="logs" style="font-size: 0.65rem; color: #888; border-top: 1px solid #eee; padding-top: 6px; margin-top: 8px; display: flex; justify-content: space-between;">
                <span>👤 Crea: ${s.creadoPor || 'Sist.'}</span>
                <span>🚖 Asigna: ${s.asignadoPor || '---'}</span>
            </div>

            <div class="acciones" style="margin-top:12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px;">
                <button class="btn-acc bg-ws" data-id="${s.id}" ${taxiDisabled ? 'disabled style="opacity:0.4"' : ''}>TAXI</button>
                <button class="btn-acc bg-map" data-dom="${s.domicilio || ""}">MAPA</button>
                <button class="btn-acc bg-edit" data-id="${s.id}" ${editDisabled ? 'disabled style="opacity:0.4"' : ''}>EDIT</button>
                <button class="btn-acc bg-fin" data-id="${s.id}" ${finDisabled ? 'disabled style="opacity:0.4"' : ''}>FIN</button>
                <button class="btn-acc bg-del" data-id="${s.id}" style="${userRole === 'admin' ? 'grid-column: span 4; margin-top:5px;' : 'display:none'}">ELIMINAR</button>
            </div>`;

        fragment.appendChild(div);
    });

    lista.appendChild(fragment);
    manejarAlertas(hayUrgente);
    actualizarUI(servicios, hayUrgente);
}

function formatearFechaPro(timestamp) {
    const f = new Date(timestamp);
    return f.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: '2-digit' }).toUpperCase() + " " + f.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function manejarAlertas(hayUrgente) {
    const btnSonido = document.getElementById('btnSonido');
    audioHabilitado = btnSonido?.innerText === "🔊";
    if (hayUrgente && audioHabilitado) {
        if (!sonidoActivo) { audio.play().catch(()=>{}); sonidoActivo = true; }
    } else { audio?.pause(); sonidoActivo = false; }
}

export async function guardarServicio(data, id) {
    const d = new Date(data.fecha);
    d.setSeconds(0, 0); d.setMilliseconds(0);
    data.fecha = d.getTime();

    const servicioFinal = {
        ...data,
        creadoPor: data.creadoPor || userName || "Sistema",
        fechaRegistro: Date.now()
    };
    await setDoc(doc(db, "servicios", id), servicioFinal, { merge: true });
}

export async function eliminarServicio(id) {
    await deleteDoc(doc(db, "servicios", id));
}