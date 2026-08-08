import { auth, db, functions } from "./firebase.js";
import { currentUser, logout, normalizarTelefono, userName, userRole } from "./auth.js";
import { activarNotificaciones } from "./notificaciones.js";
import {
    eliminarServicio,
    guardarServicio,
    render,
    servicios
} from "./servicios.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js";
import {
    actualizarResumenDias,
    borradorRapido,
    establecerFechaSugerida,
    exportarExcel
} from "./utils.js";

let eventsReady = false;

function selectedDays() {
    return Array.from(document.querySelectorAll("#diasSemana input:checked"))
        .map((checkbox) => Number(checkbox.value));
}

function toggleRecurrence(show) {
    const panel = document.getElementById("bloqueRecurrencia");
    panel.hidden = !show;
    panel.classList.toggle("active", show);
    if (!show) {
        document.querySelectorAll("#diasSemana input").forEach((checkbox) => {
            checkbox.checked = false;
        });
        document.getElementById("resumenDias").textContent = "";
    }
}

function localDateInput(timestamp) {
    const date = new Date(timestamp);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function nextRecurringDate(service) {
    const base = new Date(service.fecha);
    const now = new Date();
    if (base < now) {
        base.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
    }

    const days = Array.isArray(service.dias) ? service.dias : [];
    const next = new Date(base);
    for (let offset = 1; offset <= 7; offset += 1) {
        next.setDate(next.getDate() + 1);
        if (!days.length || days.includes(next.getDay())) return next;
    }
    return null;
}

function whatsappGroupUrl(service) {
    const date = new Date(service.fecha).toLocaleString("es-MX", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        hour: "2-digit",
        minute: "2-digit"
    }).toUpperCase();
    const message = [
        "✨ *NUEVO SERVICIO REGISTRADO* ✨",
        "━━━━━━━━━━━━━━━━━━",
        `👤 *CLIENTE:* ${service.nombre.toUpperCase()}`,
        `📍 *ORIGEN:* ${service.domicilio}`,
        `📞 *TEL:* ${service.telefono || "SIN TELÉFONO"}`,
        `📅 *HORA:* ${date}`,
        "━━━━━━━━━━━━━━━━━━",
        `✍️ _Registrado por: ${userName || "Sistema"}_`
    ].join("\n");
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

function whatsappClientUrl(service, unit) {
    const phone = normalizarTelefono(service.telefono);
    if (!/^\d{10}$/.test(phone)) return null;

    const message = [
        "🚕 *TAXI PLATINO*",
        "━━━━━━━━━━━━━━━━━━",
        `Hola *${service.nombre.toUpperCase()}*, la unidad *${unit.toUpperCase()}* va en camino.`,
        `📍 ${service.domicilio}`,
        "━━━━━━━━━━━━━━━━━━",
        "Gracias por su preferencia."
    ].join("\n");
    return `https://wa.me/52${phone}?text=${encodeURIComponent(message)}`;
}

async function saveService(event) {
    event.preventDefault();
    const form = event.currentTarget;

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    const name = document.getElementById("nombre").value.trim();
    const phone = normalizarTelefono(document.getElementById("telefono").value);
    const address = document.getElementById("domicilio").value.trim();
    const dateValue = document.getElementById("fecha").value;
    const recurrence = document.getElementById("recurrencia").value;
    const editId = document.getElementById("edit-id").value;
    const days = selectedDays();

    if (phone && !/^\d{10}$/.test(phone)) {
        Swal.fire("Teléfono inválido", "Escribe exactamente 10 dígitos.", "warning");
        return;
    }

    const selectedDate = new Date(dateValue);
    if (Number.isNaN(selectedDate.getTime())) {
        Swal.fire("Fecha inválida", "Selecciona una fecha y hora válidas.", "warning");
        return;
    }

    if (!editId && selectedDate.getTime() < Date.now() - 5 * 60 * 1000) {
        Swal.fire("Fecha anterior", "La fecha del nuevo servicio no puede estar en el pasado.", "warning");
        return;
    }

    if (recurrence === "diario" && !days.length) {
        Swal.fire("Faltan los días", "Selecciona al menos un día de repetición.", "warning");
        return;
    }

    const existing = editId ? servicios.find((service) => service.id === editId) : null;
    const data = {
        nombre: name,
        telefono: phone,
        domicilio: address,
        fecha: selectedDate.getTime(),
        recurrencia: recurrence,
        dias: recurrence === "diario" ? days : [],
        estado: existing?.estado || "pendiente",
        unidad: existing?.unidad || "S/A",
        creadoPor: existing?.creadoPor || userName || "Sistema",
        asignadoPor: existing?.asignadoPor || "",
        fechaRegistro: existing?.fechaRegistro || Date.now(),
        notificado: false
    };

    const button = document.getElementById("btnGuardar");
    const originalButton = button.innerHTML;
    button.disabled = true;
    button.textContent = "Guardando…";

    try {
        await guardarServicio(data, editId || crypto.randomUUID());
        borradorRapido();

        if (!editId) {
            const result = await Swal.fire({
                icon: "success",
                title: "Servicio guardado",
                text: "Puedes compartirlo ahora en el grupo de WhatsApp.",
                confirmButtonText: "Abrir WhatsApp",
                showCancelButton: true,
                cancelButtonText: "Cerrar",
                confirmButtonColor: "#198754"
            });
            if (result.isConfirmed) window.open(whatsappGroupUrl(data), "_blank", "noopener");
        } else {
            Swal.fire({
                icon: "success",
                title: "Cambios guardados",
                timer: 1400,
                showConfirmButton: false
            });
        }
    } catch (error) {
        console.error("No se pudo guardar:", error);
        Swal.fire("Error", "No se pudo guardar el servicio. Revisa tu conexión.", "error");
    } finally {
        button.disabled = false;
        button.innerHTML = originalButton;
    }
}

async function registerOperator() {
    if (userRole !== "admin") return;

    await Swal.fire({
        title: "Registrar operador",
        html: `
            <div class="swal-login">
                <label for="operator-name">Nombre
                    <input id="operator-name" autocomplete="name" maxlength="70" placeholder="Nombre del operador">
                </label>
                <label for="operator-phone">Teléfono
                    <input id="operator-phone" inputmode="numeric" maxlength="10" placeholder="10 dígitos">
                </label>
                <label for="operator-password">Contraseña temporal
                    <input id="operator-password" type="password" autocomplete="new-password" minlength="6" placeholder="Mínimo 6 caracteres">
                </label>
            </div>`,
        showCancelButton: true,
        confirmButtonText: "Crear operador",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#10213f",
        showLoaderOnConfirm: true,
        preConfirm: async () => {
            const name = document.getElementById("operator-name").value.trim();
            const phone = normalizarTelefono(document.getElementById("operator-phone").value);
            const password = document.getElementById("operator-password").value;

            if (name.length < 3) {
                Swal.showValidationMessage("Escribe el nombre completo del operador.");
                return false;
            }
            if (!/^\d{10}$/.test(phone)) {
                Swal.showValidationMessage("El teléfono debe tener 10 dígitos.");
                return false;
            }
            if (password.length < 6) {
                Swal.showValidationMessage("La contraseña debe tener al menos 6 caracteres.");
                return false;
            }

            try {
                const createOperator = httpsCallable(functions, "crearOperador");
                await createOperator({ name, phone, password });
                return { name, phone };
            } catch (error) {
                console.error("No se pudo crear el operador:", error);
                const duplicate = error.code?.includes("already-exists");
                Swal.showValidationMessage(
                    duplicate ? "Ya existe un operador con ese teléfono." : "No fue posible crear el operador."
                );
                return false;
            }
        }
    }).then((result) => {
        if (result.isConfirmed && result.value) {
            Swal.fire(
                "Operador creado",
                `${result.value.name} ya puede entrar con el teléfono ${result.value.phone}.`,
                "success"
            );
        }
    });
}

async function assignUnit(button, service) {
    const result = await Swal.fire({
        title: "Asignar unidad",
        input: "text",
        inputLabel: `Servicio para ${service.nombre}`,
        inputPlaceholder: "Número de unidad",
        showCancelButton: true,
        confirmButtonText: "Asignar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#10213f",
        inputValidator: (value) => !value?.trim() && "Escribe el número de unidad."
    });

    if (!result.value) return;
    const unit = result.value.trim().toUpperCase().slice(0, 20);
    button.disabled = true;

    try {
        await updateDoc(doc(db, "servicios", service.id), {
            unidad: unit,
            estado: "en-proceso",
            asignadoPor: userName || auth.currentUser?.email || "Operador",
            fechaAsignacion: Date.now()
        });

        const url = whatsappClientUrl(service, unit);
        if (url) {
            const notice = await Swal.fire({
                icon: "success",
                title: `Unidad ${unit} asignada`,
                text: "¿Deseas avisar al cliente por WhatsApp?",
                showCancelButton: true,
                confirmButtonText: "Abrir WhatsApp",
                cancelButtonText: "Cerrar",
                confirmButtonColor: "#198754"
            });
            if (notice.isConfirmed) window.open(url, "_blank", "noopener");
        }
    } catch (error) {
        button.disabled = false;
        console.error("No se pudo asignar la unidad:", error);
        Swal.fire("Error", "No fue posible asignar la unidad.", "error");
    }
}

async function finishService(button, service) {
    const confirmation = await Swal.fire({
        title: "¿Finalizar servicio?",
        text: `Servicio de ${service.nombre}`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Finalizar",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#c93636"
    });
    if (!confirmation.isConfirmed) return;

    button.disabled = true;
    try {
        await updateDoc(doc(db, "servicios", service.id), {
            estado: "finalizado",
            finalizadoPor: userName || "Operador",
            fechaFin: Date.now()
        });

        if (service.recurrencia === "diario") {
            const nextDate = nextRecurringDate(service);
            if (nextDate) {
                const alreadyExists = servicios.some((candidate) =>
                    candidate.estado === "pendiente" &&
                    candidate.nombre === service.nombre &&
                    Math.abs(Number(candidate.fecha) - nextDate.getTime()) < 60000
                );

                if (!alreadyExists) {
                    const nextService = {
                        ...service,
                        fecha: nextDate.getTime(),
                        estado: "pendiente",
                        unidad: "S/A",
                        creadoPor: "Sistema recurrente",
                        asignadoPor: "",
                        finalizadoPor: "",
                        fechaFin: null,
                        notificado: false,
                        fechaRegistro: Date.now()
                    };
                    delete nextService.id;
                    await guardarServicio(nextService, crypto.randomUUID());
                }
            }
        }
    } catch (error) {
        button.disabled = false;
        console.error("No se pudo finalizar:", error);
        Swal.fire("Error", "No fue posible finalizar el servicio.", "error");
    }
}

function editService(service) {
    document.getElementById("edit-id").value = service.id;
    document.getElementById("nombre").value = service.nombre || "";
    document.getElementById("telefono").value = service.telefono || "";
    document.getElementById("domicilio").value = service.domicilio || "";
    document.getElementById("fecha").value = localDateInput(service.fecha);
    document.getElementById("recurrencia").value = service.recurrencia || "no";
    document.getElementById("form-title").textContent = "Editar traslado";
    document.getElementById("btn-cancel").hidden = false;

    const recurring = service.recurrencia === "diario";
    toggleRecurrence(recurring);
    document.querySelectorAll("#diasSemana input").forEach((checkbox) => {
        checkbox.checked = service.dias?.includes(Number(checkbox.value)) || false;
    });
    actualizarResumenDias();
    document.getElementById("contenido").scrollIntoView({ behavior: "smooth" });
    document.getElementById("nombre").focus({ preventScroll: true });
}

export function initEventos() {
    if (eventsReady) return;

    document.getElementById("btnLogout").addEventListener("click", logout);
    document.getElementById("servicioForm").addEventListener("submit", saveService);
    document.getElementById("btnExcel").addEventListener("click", exportarExcel);
    document.getElementById("btnLimpiar").addEventListener("click", borradorRapido);
    document.getElementById("btn-cancel").addEventListener("click", borradorRapido);
    document.getElementById("btnRol").addEventListener("click", registerOperator);

    document.getElementById("btnSonido").addEventListener("click", (event) => {
        const button = event.currentTarget;
        const enabled = button.getAttribute("aria-pressed") !== "true";
        button.setAttribute("aria-pressed", String(enabled));
        button.classList.toggle("enabled", enabled);
        button.querySelector("span").textContent = enabled ? "🔊" : "🔇";
        button.setAttribute("aria-label", enabled ? "Desactivar alerta sonora" : "Activar alerta sonora");
        render(document.getElementById("searchBar").value.trim().toLowerCase());
    });

    document.getElementById("btnNotificaciones").addEventListener("click", async () => {
        try {
            const enabled = await activarNotificaciones(currentUser, userRole, true);
            Swal.fire(
                enabled ? "Notificaciones activas" : "Notificaciones desactivadas",
                enabled
                    ? "Recibirás avisos de servicios nuevos y próximos."
                    : "Puedes habilitarlas desde los permisos de tu navegador.",
                enabled ? "success" : "info"
            );
        } catch (error) {
            console.error("No se pudieron activar las notificaciones:", error);
            Swal.fire("Error", "No fue posible activar las notificaciones.", "error");
        }
    });

    document.getElementById("recurrencia").addEventListener("change", (event) => {
        toggleRecurrence(event.target.value === "diario");
    });

    document.querySelectorAll("#diasSemana input").forEach((checkbox) => {
        checkbox.addEventListener("change", actualizarResumenDias);
    });

    document.getElementById("searchBar").addEventListener("input", (event) => {
        render(event.target.value.trim().toLowerCase());
    });

    document.getElementById("lista").addEventListener("click", async (event) => {
        const button = event.target.closest("button");
        if (!button) return;

        if (button.classList.contains("action-map")) {
            const address = button.dataset.address;
            if (address) {
                const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
                window.open(url, "_blank", "noopener");
            }
            return;
        }

        const service = servicios.find((candidate) => candidate.id === button.dataset.id);
        if (!service) return;

        if (button.classList.contains("action-assign")) await assignUnit(button, service);
        if (button.classList.contains("action-finish")) await finishService(button, service);
        if (button.classList.contains("action-edit")) editService(service);

        if (button.classList.contains("action-delete") && userRole === "admin") {
            const confirmation = await Swal.fire({
                title: "¿Eliminar servicio?",
                text: "Esta acción no se puede deshacer.",
                icon: "warning",
                showCancelButton: true,
                confirmButtonText: "Eliminar",
                cancelButtonText: "Cancelar",
                confirmButtonColor: "#c93636"
            });

            if (confirmation.isConfirmed) {
                try {
                    await eliminarServicio(service.id);
                } catch (error) {
                    console.error("No se pudo eliminar:", error);
                    Swal.fire("Error", "No fue posible eliminar el servicio.", "error");
                }
            }
        }
    });

    establecerFechaSugerida();
    eventsReady = true;
}
