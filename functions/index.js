// 🔥 Firebase Functions V2
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall } = require("firebase-functions/v2/https");

const admin = require("firebase-admin");

admin.initializeApp();


// =============================
// 🚕 1. NOTIFICAR NUEVO SERVICIO
// =============================
exports.notificarNuevoServicio = onDocumentCreated(
  "servicios/{id}",
  async (event) => {

    const data = event.data.data();

    console.log("🚕 Nuevo servicio:", data);

    // 🔥 SOLO OPERADORES
    const tokensSnap = await admin.firestore()
      .collection("tokens")
      .where("role", "==", "operador")
      .get();

    const tokens = tokensSnap.docs.map(doc => doc.data().token);

    if (tokens.length === 0) {
      console.log("❌ No hay tokens");
      return;
    }

    try {
      await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: "🚕 NUEVO SERVICIO",
          body: `${data.nombre || "Cliente"} - ${data.domicilio || ""}`
        }
      });

      console.log("📢 Notificación enviada");

    } catch (error) {
      console.error("❌ Error enviando notificación:", error);
    }
  }
);


// =====================================
// 🚨 2. ALERTA AUTOMÁTICA 15 MIN ANTES
// =====================================
exports.alertaServiciosUrgentes = onSchedule("every 1 minutes", async () => {

  const ahora = Date.now();
  const en15Min = ahora + (15 * 60 * 1000);

  console.log("⏰ Revisando servicios urgentes...");

  const snapshot = await admin.firestore()
    .collection("servicios")
    .where("estado", "==", "pendiente")
    .where("fecha", ">=", ahora)
    .where("fecha", "<=", en15Min)
    .get();

  if (snapshot.empty) {
    console.log("✅ No hay servicios urgentes");
    return;
  }

  // 🔥 SOLO OPERADORES
  const tokensSnap = await admin.firestore()
    .collection("tokens")
    .where("role", "==", "operador")
    .get();

  const tokens = tokensSnap.docs.map(doc => doc.data().token);

  if (tokens.length === 0) {
    console.log("❌ No hay tokens");
    return;
  }

  for (const docu of snapshot.docs) {
    const data = docu.data();

    // 🚫 evitar spam
    if (data.notificado === true) {
      console.log("⛔ Ya notificado:", data.nombre);
      continue;
    }

    try {
      await admin.messaging().sendEachForMulticast({
        tokens,
        notification: {
          title: "🚨 SERVICIO EN 15 MIN",
          body: `${data.nombre || "Cliente"} - ${data.domicilio || ""}`
        }
      });

      // 🔥 marcar como notificado
      await docu.ref.update({
        notificado: true
      });

      console.log("📢 Notificado:", data.nombre);

    } catch (error) {
      console.error("❌ Error enviando:", error);
    }
  }

});


// =====================================
// 👑 3. ASIGNAR ROL OPERADOR (ADMIN)
// =====================================
exports.asignarRolOperador = onCall(async (request) => {

  if (!request.auth) {
    throw new Error("No autenticado");
  }

  const adminUser = await admin.auth().getUser(request.auth.uid);

  if (!adminUser.customClaims || adminUser.customClaims.role !== "admin") {
    throw new Error("No autorizado");
  }

  const { uid } = request.data;

  if (!uid) {
    throw new Error("UID requerido");
  }

  await admin.auth().setCustomUserClaims(uid, {
    role: "operador"
  });

  console.log("👨‍💼 Rol operador asignado a:", uid);

  return { ok: true };
});

const db = admin.firestore();

exports.Servicios = onSchedule("every 5 minutes", async () => {
    console.log("🔁 Revisando servicios recurrentes...");

    const db = admin.firestore();
    const ahora = new Date();

    const snapshot = await db.collection("servicios")
        .where("", "==", "diario")
        .get();

    for (const docu of snapshot.docs) {

        const data = docu.data();

        const fechaOriginal = new Date(data.fecha);
        const diaHoy = ahora.getDay();

        // 🚫 Si hoy no está en los días, ignorar
        if (!data.dias.includes(diaHoy)) continue;

        // 🔥 Crear fecha para HOY con la misma hora
        const nuevaFecha = new Date();
        nuevaFecha.setHours(
            fechaOriginal.getHours(),
            fechaOriginal.getMinutes(),
            0,
            0
        );

        const nuevaFechaMs = nuevaFecha.getTime();

        // 🚫 Evitar duplicados
        const yaExiste = await db.collection("servicios")
            .where("nombre", "==", data.nombre)
            .where("fecha", "==", nuevaFechaMs)
            .get();

        if (!yaExiste.empty) {
            console.log("⛔ Ya existe:", data.nombre);
            continue;
        }

        // 🔥 Crear nuevo servicio
        await db.collection("servicios").add({
            ...data,
            fecha: nuevaFechaMs,
            estado: "pendiente",
            unidad: "S/A",
            notificado: false
        });

        console.log("♻️ Servicio recurrente creado:", data.nombre);
    }
});