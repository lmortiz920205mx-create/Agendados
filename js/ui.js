import { render } from "./servicios.js";

export let tabActual = "pendiente";
export let elementosDOM = {};

export function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            tabActual = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            render(document.getElementById('searchBar').value.toLowerCase());
        };
    });
}

export function actualizarUI(servicios, hayUrgente) {
    const p = servicios.filter(s => s.estado === "pendiente").length;
    const pr = servicios.filter(s => s.estado === "en-proceso").length;
    const f = servicios.filter(s => s.estado === "finalizado").length;

    const tabPend = document.querySelector('[data-tab="pendiente"]');
    tabPend.innerText = `🟡 Pendientes (${p})`;
    document.querySelector('[data-tab="en-proceso"]').innerText = `🟢 En proceso (${pr})`;
    document.querySelector('[data-tab="finalizado"]').innerText = `⚫ Finalizados (${f})`;

    if (hayUrgente) {
        tabPend.style.background = "#ff0000";
        tabPend.style.color = "white";
        if (tabActual !== 'pendiente') {
            tabActual = 'pendiente';
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            tabPend.classList.add('active');
            render();
        }
    } else {
        tabPend.style.background = "";
        tabPend.style.color = "";
    }
}