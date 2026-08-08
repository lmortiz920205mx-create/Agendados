import { servicios } from "./servicios.js";

function valorSeguroExcel(value) {
    const text = String(value ?? "");
    return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

export function establecerFechaSugerida() {
    const input = document.getElementById("fecha");
    if (!input || input.value) return;

    const date = new Date(Date.now() + 15 * 60 * 1000);
    date.setSeconds(0, 0);
    const offset = date.getTimezoneOffset() * 60000;
    input.value = new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function borradorRapido() {
    const form = document.getElementById("servicioForm");
    form.reset();
    document.getElementById("edit-id").value = "";
    document.getElementById("btn-cancel").hidden = true;
    document.getElementById("form-title").textContent = "Agendar traslado";

    const recurrencePanel = document.getElementById("bloqueRecurrencia");
    recurrencePanel.hidden = true;
    recurrencePanel.classList.remove("active");
    document.getElementById("resumenDias").textContent = "";

    establecerFechaSugerida();
    document.getElementById("nombre").focus();
}

export function exportarExcel() {
    if (!servicios.length) {
        Swal.fire("Sin datos", "Todavía no hay servicios para exportar.", "info");
        return;
    }

    const rows = servicios.map((service) => ({
        Fecha: new Date(service.fecha).toLocaleString("es-MX"),
        Cliente: valorSeguroExcel(service.nombre),
        Teléfono: valorSeguroExcel(service.telefono),
        Domicilio: valorSeguroExcel(service.domicilio),
        Unidad: valorSeguroExcel(service.unidad || "S/A"),
        Estado: service.estado,
        Recurrencia: service.recurrencia === "diario" ? "Sí" : "No",
        "Creado por": valorSeguroExcel(service.creadoPor || "Sistema"),
        "Asignado por": valorSeguroExcel(service.asignadoPor || "")
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet["!cols"] = [
        { wch: 21 }, { wch: 28 }, { wch: 14 }, { wch: 42 },
        { wch: 12 }, { wch: 14 }, { wch: 13 }, { wch: 26 }, { wch: 26 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Servicios");
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Taxi_Platino_Servicios_${date}.xlsx`);
}

export function actualizarResumenDias() {
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    const selected = Array.from(
        document.querySelectorAll("#diasSemana input:checked")
    ).map((checkbox) => dayNames[Number(checkbox.value)]);

    document.getElementById("resumenDias").textContent = selected.length
        ? `Se repetirá: ${selected.join(", ")}`
        : "Selecciona al menos un día.";
}
