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

    console.log("Nuevo servicio:", data);

    // 🔥 Obtener tokens
    const tokensSnap = await admin.firestore().collection("tokens").get();
    const tokens = tokensSnap.docs.map(doc => doc.data().token);

    if (tokens.length === 0) {
      console.log("No hay tokens");
      return;
    }

    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: "🚕 NUEVO SERVICIO",
        body: `${data.nombre || "Cliente"} - ${data.domicilio || ""}`
      }
    });

  }
);


// =====================================
// 🚨 2. ALERTA AUTOMÁTICA 15 MIN ANTES
// =====================================
exports.alertaServiciosUrgentes = onSchedule("every 1 minutes", async () => {

  const ahora = Date.now();
  const en15Min = ahora + (15 * 60 * 1000);

  console.log("Revisando servicios urgentes...");

  const snapshot = await admin.firestore()
    .collection("servicios")
    .where("estado", "==", "pendiente")
    .where("fecha", ">=", ahora)
    .where("fecha", "<=", en15Min)
    .get();

  if (snapshot.empty) {
    console.log("No hay servicios urgentes");
    return;
  }

  // 🔥 Obtener tokens
  const tokensSnap = await admin.firestore().collection("tokens").get();
  const tokens = tokensSnap.docs.map(doc => doc.data().token);

  if (tokens.length === 0) {
    console.log("No hay tokens");
    return;
  }

  for (const docu of snapshot.docs) {
    const data = docu.data();

    // 🔒 evitar duplicados
    if (data.notificado) continue;

    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: {
        title: "🚨 SERVICIO EN 15 MIN",
        body: `${data.nombre || "Cliente"} - ${data.domicilio || ""}`
      }
    });

    // 🔥 marcar como notificado
    await docu.ref.update({ notificado: true });

    console.log("Notificado:", data.nombre);
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

  console.log("Rol asignado a:", uid);

  return { ok: true };
});