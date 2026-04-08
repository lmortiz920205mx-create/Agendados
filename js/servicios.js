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

            <div class="logs" style="background: #f1f2f6; padding: 8px; border-radius: 8px; margin: 10px 0; font-size: 0.75rem; border-left: 4px solid #1a2b4c; color: #555;">
                <div>📝 <b>Creado:</b> ${s.creadoPor || 'Sistema'}</div>
                ${s.asignadoPor && s.unidad !== 'S/A' ? `<div>🚖 <b>Asignó:</b> ${s.asignadoPor}</div>` : ''}
                ${s.finalizadoPor ? `<div>🏁 <b>Finalizó:</b> ${s.finalizadoPor}</div>` : ''}
            </div>

            <div class="acciones">
                <button class="btn-acc bg-ws" data-id="${s.id}" data-tel="${s.telefono || ""}" ${taxiDisabled ? 'disabled style="opacity:0.5;pointer-events:none;"' : ''}>TAXI</button>
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

function formatearFechaPro(timestamp) {
    const fecha = new Date(timestamp);
    const ahora = new Date();
    const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
    const manana = new Date(hoy);
    manana.setDate(hoy.getDate() + 1);
    const fechaBase = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
    const horaTxt = fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
    const diaTxt = fecha.toLocaleDateString('es-MX', { weekday: 'short', day: '2-digit', month: '2-digit' });
    if (fechaBase.getTime() === hoy.getTime()) return `🚀 HOY ${horaTxt}`;
    if (fechaBase.getTime() === manana.getTime()) return `🟡 MAÑANA ${horaTxt}`;
    return `📅 ${diaTxt.toUpperCase()} ${horaTxt}`;
}

function manejarAlertas(hayUrgente) {
    const btnSonido = document.getElementById('btnSonido');
    audioHabilitado = btnSonido.innerText === "🔊";
    if (hayUrgente && audioHabilitado) {
        if (!sonidoActivo) { audio.play().catch(()=>{}); sonidoActivo = true; }
    } else { audio.pause(); sonidoActivo = false; }
}

export async function guardarServicio(data, id) {
    const ahoraMs = Date.now();
    if (!data.fecha || isNaN(data.fecha)) return;
    
    // Validar futuro (tolerancia 1 min)
    if (data.fecha < (ahoraMs - 60000)) return; 

    const d = new Date(data.fecha);
    d.setSeconds(0, 0);
    d.setMilliseconds(0);
    data.fecha = d.getTime();

    const servicioFinal = {
        ...data,
        creadoPor: data.creadoPor || userName || "Sistema",
        fechaRegistro: ahoraMs
    };
    await setDoc(doc(db, "servicios", id), servicioFinal, { merge: true });
}

export async function eliminarServicio(id) {
    await deleteDoc(doc(db, "servicios", id));
}