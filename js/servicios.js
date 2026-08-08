import { db } from "./firebase.js";
import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { userRole } from "./auth.js";
import { actualizarUI, tabActual } from "./ui.js";

export let servicios = [];

let audio = null;
let sonidoActivo = false;
let unsubscribe = null;

function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function formatDate(timestamp) {
    const date = new Date(timestamp);
    return `${date.toLocaleDateString("es-MX", {
        weekday: "short",
        day: "2-digit",
        month: "short"
    }).toUpperCase()} · ${date.toLocaleTimeString("es-MX", {
        hour: "2-digit",
        minute: "2-digit"
    })}`;
}

function actionButton(label, className, options = {}) {
    const button = createElement("button", `action-button ${className}`, label);
    button.type = "button";
    button.disabled = Boolean(options.disabled);
    if (options.id) button.dataset.id = options.id;
    if (options.address) button.dataset.address = options.address;
    if (options.ariaLabel) button.setAttribute("aria-label", options.ariaLabel);
    return button;
}

function createServiceCard(service, urgent) {
    const card = createElement(
        "article",
        `service-card ${service.estado || "pendiente"}${urgent ? " urgent" : ""}`
    );
    card.dataset.serviceId = service.id;

    const topLine = createElement("div", "service-topline");
    topLine.append(createElement("span", "", `📅 ${formatDate(service.fecha)}`));
    if (service.recurrencia === "diario") {
        topLine.append(createElement("span", "recurring-badge", "↻ Recurrente"));
    }

    const name = createElement(
        "h3",
        "service-name",
        String(service.nombre || "Cliente sin nombre").toUpperCase()
    );
    const address = createElement(
        "p",
        "service-address",
        `📍 ${service.domicilio || "Domicilio no especificado"}`
    );
    const unit = createElement("p", "service-unit");
    unit.append("🚕 Unidad: ");
    unit.append(createElement("span", "unit-badge", service.unidad || "S/A"));

    const audit = createElement("div", "service-audit");
    audit.append(
        createElement("span", "", `Crea: ${service.creadoPor || "Sistema"}`),
        createElement("span", "", `Asigna: ${service.asignadoPor || "Sin asignar"}`)
    );

    const actions = createElement("div", "service-actions");
    actions.append(
        actionButton("Asignar", "action-assign", {
            id: service.id,
            disabled: service.estado !== "pendiente",
            ariaLabel: `Asignar unidad al servicio de ${service.nombre || "cliente"}`
        }),
        actionButton("Mapa", "action-map", {
            address: service.domicilio || "",
            ariaLabel: `Abrir mapa de ${service.domicilio || "la ubicación"}`
        }),
        actionButton("Editar", "action-edit", {
            id: service.id,
            disabled: service.estado === "finalizado",
            ariaLabel: `Editar servicio de ${service.nombre || "cliente"}`
        }),
        actionButton("Finalizar", "action-finish", {
            id: service.id,
            disabled: service.estado !== "en-proceso",
            ariaLabel: `Finalizar servicio de ${service.nombre || "cliente"}`
        })
    );

    if (userRole === "admin") {
        actions.append(actionButton("Eliminar", "action-delete", {
            id: service.id,
            ariaLabel: `Eliminar servicio de ${service.nombre || "cliente"}`
        }));
    }

    card.append(topLine, name, address, unit, audit, actions);
    return card;
}

function renderEmptyState(list, hasSearch) {
    const empty = createElement("div", "empty-state");
    empty.append(
        createElement("span", "section-icon", hasSearch ? "⌕" : "🚕"),
        createElement("strong", "", hasSearch ? "No encontramos coincidencias" : "No hay servicios en este estado"),
        createElement("p", "", hasSearch ? "Prueba con otro nombre o domicilio." : "Los nuevos servicios aparecerán aquí.")
    );
    list.append(empty);
}

export function cargarServicios() {
    if (unsubscribe) return;

    audio = document.getElementById("audioAlerta");
    const servicesQuery = query(collection(db, "servicios"), orderBy("fecha", "asc"));

    unsubscribe = onSnapshot(
        servicesQuery,
        (snapshot) => {
            servicios = snapshot.docs.map((snapshotDoc) => ({
                ...snapshotDoc.data(),
                id: snapshotDoc.id
            }));
            render(document.getElementById("searchBar")?.value.trim().toLowerCase() || "");
        },
        (error) => {
            console.error("No se pudieron cargar los servicios:", error);
            const list = document.getElementById("lista");
            list.replaceChildren();
            const state = createElement("div", "empty-state");
            state.append(
                createElement("strong", "", "No fue posible cargar los servicios"),
                createElement("p", "", "Comprueba tu conexión y los permisos de Firebase.")
            );
            list.append(state);
        }
    );
}

export function detenerServicios() {
    unsubscribe?.();
    unsubscribe = null;
    servicios = [];
    sonidoActivo = false;
    if (audio) {
        audio.pause();
        audio.currentTime = 0;
    }
}

export function render(search = "") {
    const list = document.getElementById("lista");
    if (!list) return;

    const normalizedSearch = String(search).trim().toLowerCase();
    const now = Date.now();
    const fifteenMinutes = now + 15 * 60 * 1000;
    let hasUrgent = false;

    const filtered = servicios.filter((service) => {
        const matchesStatus = service.estado === tabActual;
        const matchesSearch = !normalizedSearch ||
            String(service.nombre || "").toLowerCase().includes(normalizedSearch) ||
            String(service.domicilio || "").toLowerCase().includes(normalizedSearch);
        return matchesStatus && matchesSearch;
    });

    const fragment = document.createDocumentFragment();
    filtered.forEach((service) => {
        const urgent = service.estado === "pendiente" &&
            Number(service.fecha) <= fifteenMinutes &&
            Number(service.fecha) >= now - 10 * 60 * 1000;
        if (urgent) hasUrgent = true;
        fragment.append(createServiceCard(service, urgent));
    });

    list.replaceChildren(fragment);
    if (!filtered.length) renderEmptyState(list, Boolean(normalizedSearch));

    manageAudioAlert(hasUrgent);
    actualizarUI(servicios, hasUrgent);
}

function manageAudioAlert(hasUrgent) {
    const soundButton = document.getElementById("btnSonido");
    if (!soundButton || !audio) return;

    const enabled = soundButton.getAttribute("aria-pressed") === "true";
    if (hasUrgent && enabled && !sonidoActivo) {
        audio.play().catch(() => console.warn("El navegador bloqueó la alerta sonora."));
        sonidoActivo = true;
        navigator.vibrate?.([200, 100, 200]);
        return;
    }

    if (!hasUrgent || !enabled) {
        audio.pause();
        audio.currentTime = 0;
        sonidoActivo = false;
    }
}

export async function guardarServicio(data, id) {
    const date = new Date(data.fecha);
    date.setSeconds(0, 0);
    const now = Date.now();
    const finalData = {
        ...data,
        fecha: date.getTime(),
        fechaActualizacion: now
    };

    if (!finalData.fechaRegistro) finalData.fechaRegistro = now;
    await setDoc(doc(db, "servicios", id), finalData, { merge: true });
}

export async function eliminarServicio(id) {
    await deleteDoc(doc(db, "servicios", id));
}
