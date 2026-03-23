const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

admin.initializeApp();

// 🔔 NOTIFICAR NUEVO SERVICIO
exports.notificarNuevoServicio = onDocumentCreated("servicios/{id}", async (event) => {

  const data = event.data.data();

  try {
    const tokensSnap = await admin.firestore().collection("tokens").get();

    const tokens = [];

    tokensSnap.forEach(doc => {
      const t = doc.data().token;
      if (t) tokens.push(t);
    });

    if (tokens.length === 0) {
      console.log("No hay tokens");
      return;
    }

    const mensaje = {
      notification: {
        title: "🚕 Nuevo servicio",
        body: `${data.nombre || "Cliente"} - ${data.domicilio || "Sin dirección"}`
      }
    };

    const res = await admin.messaging().sendToDevice(tokens, mensaje);

    console.log("Notificaciones enviadas:", res);

  } catch (error) {
    console.error("Error enviando push:", error);
  }
});