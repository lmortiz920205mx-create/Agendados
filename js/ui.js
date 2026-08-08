import { render } from "./servicios.js";

export let tabActual = "pendiente";
export const elementosDOM = {};
let tabsReady = false;

export function initTabs() {
    if (tabsReady) return;

    document.querySelectorAll(".tab-button").forEach((button) => {
        button.addEventListener("click", () => {
            tabActual = button.dataset.tab;
            document.querySelectorAll(".tab-button").forEach((candidate) => {
                const selected = candidate === button;
                candidate.classList.toggle("active", selected);
                candidate.setAttribute("aria-selected", String(selected));
            });
            render(document.getElementById("searchBar").value.trim().toLowerCase());
        });
    });

    tabsReady = true;
}

export function actualizarUI(servicios, hayUrgente) {
    const counts = {
        pendiente: servicios.filter((service) => service.estado === "pendiente").length,
        "en-proceso": servicios.filter((service) => service.estado === "en-proceso").length,
        finalizado: servicios.filter((service) => service.estado === "finalizado").length
    };

    const labels = {
        pendiente: "Pendientes",
        "en-proceso": "En proceso",
        finalizado: "Finalizados"
    };

    document.querySelectorAll(".tab-button").forEach((button) => {
        const status = button.dataset.tab;
        button.textContent = `${labels[status]} (${counts[status] || 0})`;
    });

    document
        .querySelector('[data-tab="pendiente"]')
        ?.classList.toggle("has-urgent", hayUrgente);
}

export function setConnectionStatus(online) {
    const status = document.getElementById("connectionStatus");
    if (!status) return;

    status.textContent = online ? "En línea" : "Sin conexión";
    status.classList.toggle("online", online);
    status.classList.toggle("offline", !online);
}
