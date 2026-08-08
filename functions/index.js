const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

function requireAdmin(request) {
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    }
    if (request.auth.token.role !== "admin") {
        throw new HttpsError("permission-denied", "Solo un administrador puede realizar esta acción.");
    }
}

function normalizePhone(value) {
    return String(value || "").replace(/\D/g, "").slice(-10);
}

async function getTokenDocuments() {
    const snapshot = await db.collection("tokens").get();
    return snapshot.docs.filter((tokenDoc) => Boolean(tokenDoc.data().token));
}

async function sendToStaff(notification) {
    const tokenDocs = await getTokenDocuments();
    if (!tokenDocs.length) return { successCount: 0, failureCount: 0 };

    const response = await admin.messaging().sendEachForMulticast({
        tokens: tokenDocs.map((tokenDoc) => tokenDoc.data().token),
        notification,
        webpush: {
            fcmOptions: {
                link: "https://lmortiz920205mx-create.github.io/Agendados/"
            }
        }
    });

    const invalidCodes = new Set([
        "messaging/invalid-registration-token",
        "messaging/registration-token-not-registered"
    ]);
    const cleanup = db.batch();
    let hasCleanup = false;
    response.responses.forEach((result, index) => {
        if (!result.success && invalidCodes.has(result.error?.code)) {
            cleanup.delete(tokenDocs[index].ref);
            hasCleanup = true;
        }
    });
    if (hasCleanup) await cleanup.commit();

    return response;
}

exports.notificarNuevoServicio = onDocumentCreated("servicios/{id}", async (event) => {
    const data = event.data?.data();
    if (!data) return;

    await sendToStaff({
        title: "🚕 Nuevo servicio",
        body: "Hay un nuevo servicio pendiente. Abre la aplicación para ver los datos."
    });
});

exports.alertaServiciosUrgentes = onSchedule({
    schedule: "every 5 minutes",
    timeZone: "America/Mexico_City"
}, async () => {
    const now = Date.now();
    const inFifteenMinutes = now + 15 * 60 * 1000;

    const snapshot = await db.collection("servicios")
        .where("estado", "==", "pendiente")
        .where("fecha", ">=", now)
        .where("fecha", "<=", inFifteenMinutes)
        .get();

    for (const serviceDoc of snapshot.docs) {
        const data = serviceDoc.data();
        if (data.notificado === true) continue;

        await sendToStaff({
            title: "🚨 Servicio próximo",
            body: "Un servicio inicia en menos de 15 minutos. Abre la aplicación para revisarlo."
        });

        await serviceDoc.ref.update({
            notificado: true,
            notificadoAt: Date.now()
        });
    }
});

exports.crearOperador = onCall(async (request) => {
    requireAdmin(request);

    const name = String(request.data?.name || "").trim();
    const phone = normalizePhone(request.data?.phone);
    const password = String(request.data?.password || "");

    if (name.length < 3) {
        throw new HttpsError("invalid-argument", "Nombre inválido.");
    }
    if (!/^\d{10}$/.test(phone)) {
        throw new HttpsError("invalid-argument", "El teléfono debe tener 10 dígitos.");
    }
    if (password.length < 6) {
        throw new HttpsError("invalid-argument", "La contraseña debe tener al menos 6 caracteres.");
    }

    const email = `${phone}@taxiplatino.app`;
    try {
        await admin.auth().getUserByEmail(email);
        throw new HttpsError("already-exists", "Ya existe un operador con ese teléfono.");
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        if (error.code !== "auth/user-not-found") throw error;
    }

    let userRecord;
    try {
        userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: name,
            disabled: false
        });

        await admin.auth().setCustomUserClaims(userRecord.uid, {
            role: "operador",
            phone
        });

        await db.collection("usuarios").doc(userRecord.uid).set({
            nombre: name,
            telefono: phone,
            email,
            role: "operador",
            activo: true,
            creadoAt: Date.now(),
            creadoPor: request.auth.uid
        });

        return { ok: true, uid: userRecord.uid, name, phone };
    } catch (error) {
        if (userRecord?.uid) await admin.auth().deleteUser(userRecord.uid).catch(() => {});
        if (error.code === "auth/email-already-exists") {
            throw new HttpsError("already-exists", "Ya existe un operador con ese teléfono.");
        }
        console.error("Error al crear operador:", error);
        throw new HttpsError("internal", "No fue posible crear el operador.");
    }
});

exports.asignarRolOperador = onCall(async (request) => {
    requireAdmin(request);
    const uid = String(request.data?.uid || "").trim();
    if (!uid) throw new HttpsError("invalid-argument", "UID requerido.");

    const user = await admin.auth().getUser(uid);
    await admin.auth().setCustomUserClaims(uid, {
        ...(user.customClaims || {}),
        role: "operador"
    });
    await db.collection("usuarios").doc(uid).set({ role: "operador" }, { merge: true });
    return { ok: true };
});
