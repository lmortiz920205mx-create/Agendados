# Agendados · Taxi Platino

PWA para registrar, asignar y dar seguimiento a los servicios de Taxi Platino en Central Minatitlán.

## Publicación

La interfaz se publica automáticamente con GitHub Pages al incorporar los cambios a `main`.

Las Cloud Functions y las reglas de Firestore requieren un despliegue separado desde una computadora con Firebase CLI y acceso al proyecto `taxi-platino-95ea3`:

```bash
npm install -g firebase-tools
firebase login
firebase deploy --only functions,firestore:rules
```

## Acceso

- Los usuarios existentes pueden seguir entrando con correo y contraseña.
- Los nuevos operadores entran con su teléfono de 10 dígitos y contraseña.
- Solo un usuario con el `custom claim` `role: "admin"` puede registrar operadores o eliminar servicios.

## Archivos principales

- `index.html`: estructura accesible de la aplicación.
- `css/styles.css`: diseño adaptable y colores de Taxi Platino.
- `js/auth.js`: acceso con teléfono o correo.
- `js/eventos.js`: formularios y acciones operativas.
- `firebase-messaging-sw.js`: PWA, caché y notificaciones.
- `functions/index.js`: notificaciones y alta segura de operadores.
- `firestore.rules`: permisos de lectura y escritura.
