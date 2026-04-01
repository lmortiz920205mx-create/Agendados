import { servicios } from "./servicios.js";

export function borradorRapido() {
    ['edit-id', 'nombre', 'telefono', 'domicilio', 'fecha'].forEach(i => document.getElementById(i).value = "");
    document.getElementById('btn-cancel').style.display = "none";
    document.querySelectorAll('#diasSemana input').forEach(c => c.checked = false);
    document.getElementById('resumenDias').innerText = "";
}

export function exportarExcel() {
    const data = servicios.map(s => ({
        Fecha: new Date(s.fecha).toLocaleString(),
        Cliente: s.nombre,
        Unidad: s.unidad,
        Estado: s.estado
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Servicios");
    XLSX.writeFile(wb, "Reporte_Platino.xlsx");
}

export function actualizarResumenDias() {
    const diasTexto = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const sel = Array.from(document.querySelectorAll('#diasSemana input:checked')).map(c => diasTexto[c.value]);
    document.getElementById('resumenDias').innerText = sel.length ? `🔁 ${sel.length} día(s): ${sel.join(', ')}` : "";
}