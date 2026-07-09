# Rústico Club — Tarjeta de fidelización en Google Wallet

Esta es la guía completa para poner esto en funcionamiento. No hace falta
que sepas programar — seguí los pasos en orden. Vas a necesitar entre 30
y 60 minutos la primera vez.

---

## Parte 1 — Conseguir las credenciales de Google (gratis)

### 1.1 Crear cuenta de Issuer en Google Wallet

1. Andá a: https://pay.google.com/business/console/
2. Iniciá sesión con tu cuenta de Google (o creá una nueva para el negocio).
3. Elegí **Google Wallet API** y completá el formulario con el nombre de
   tu cafetería.
4. Vas a arrancar en **"modo demo"** — está bien, sirve para probar. Solo
   vas a poder agregar la tarjeta a Wallets de cuentas que vos autorices
   como "testers" (las agregás en el mismo panel).
5. Guardá el **Issuer ID** que te dan — es un número largo. Ese va en tu
   archivo `.env` como `WALLET_ISSUER_ID`.

### 1.2 Crear el proyecto en Google Cloud y la cuenta de servicio

1. Andá a: https://console.cloud.google.com/
2. Creá un proyecto nuevo (arriba a la izquierda, "Nuevo proyecto").
   Ponele de nombre algo como `rustico-wallet`.
3. En el buscador de arriba, escribí **"Google Wallet API"** y hacé clic
   en **Habilitar**.
4. Andá a **"Credenciales"** (menú de la izquierda) → **Crear
   credenciales** → **Cuenta de servicio**.
5. Ponele un nombre (ej: `rustico-wallet-service`) y creála.
6. Entrá a la cuenta de servicio recién creada → pestaña **Claves** →
   **Agregar clave** → **Crear clave nueva** → tipo **JSON**.
7. Se va a descargar un archivo `.json` a tu computadora. **Guardalo bien,
   no lo compartas ni lo subas a ningún lado público** — es como la
   contraseña maestra de tu cuenta de Wallet.
8. Abrí ese archivo con el Bloc de notas. Vas a ver algo así:
   ```json
   {
     "client_email": "rustico-wallet-service@rustico-wallet.iam.gserviceaccount.com",
     "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n"
   }
   ```
   Copiás `client_email` a la variable `GOOGLE_CLIENT_EMAIL` del `.env`,
   y `private_key` (completo, con los `\n` incluidos) a
   `GOOGLE_PRIVATE_KEY`.

### 1.3 Autorizar la cuenta de servicio en tu cuenta de Issuer

1. Volvé al Google Pay & Wallet Console (paso 1.1).
2. Buscá la sección de **usuarios / API access**.
3. Agregá el `client_email` de tu cuenta de servicio (el mismo del paso
   anterior) con permisos de administrador de la cuenta de Issuer.

---

## Parte 2 — Preparar tu logo

Google necesita que tu logo esté en una URL pública de internet (no
puede ser un archivo de tu computadora). Opciones simples:

- Subilo a tu propia página web, si tenés una.
- Subilo a un servicio de imágenes públicas (por ejemplo, un repositorio
  público de GitHub, o cualquier hosting de imágenes).

Copiá esa URL en `RUSTICO_LOGO_URL` dentro del `.env`.

---

## Parte 3 — Subir el servidor a un hosting gratuito

Recomendación: **Render** (tiene plan gratis, es simple).

1. Creá una cuenta en https://render.com (podés entrar con GitHub).
2. Subí esta carpeta a un repositorio de GitHub (si nunca usaste GitHub,
   pedime que te explique ese paso también, es sencillo).
3. En Render: **New** → **Web Service** → conectá tu repositorio.
4. Configuración:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
5. En la sección **Environment**, cargá todas las variables que están en
   tu archivo `.env` (una por una, en el panel de Render, NO subas el
   archivo `.env` al repositorio).
6. Desplegá. Render te va a dar una URL pública, algo como
   `https://rustico-wallet.onrender.com`.

⚠️ Importante: nunca subas el archivo `.env` real a GitHub. Ese
repositorio debería tener un archivo `.gitignore` con la línea `.env`
para evitar subirlo por error.

---

## Parte 4 — Probar

- **Para clientes:** entrá a `https://tu-url.onrender.com/` desde el
  celular, cargá el teléfono y nombre, y va a aparecer el botón
  **"Agregar a Google Wallet"**.
- **Para el mostrador:** entrá a `https://tu-url.onrender.com/staff.html`,
  metés el PIN (el que pusiste en `STAFF_PIN`), y ya podés escanear el QR
  de la tarjeta del cliente desde dentro de su Wallet.

Mientras tu cuenta de Issuer esté en "modo demo", solo las cuentas de
Google que agregaste como testers van a poder agregar la tarjeta. Para
salir del modo demo y que cualquier cliente pueda usarla, tenés que pedir
"acceso de producción" desde el mismo panel de Google Pay & Wallet
Console — Google revisa la solicitud (puede tardar unos días).

---

## Si algo falla

Los errores más comunes:

- **"No se pudo conectar con el servidor"** → revisá que el hosting esté
  corriendo (Render a veces "duerme" los servicios gratis después de un
  rato sin uso, y tarda unos segundos en despertar).
- **Error de Google Wallet al crear la clase** → normalmente es porque
  falta habilitar la API, o la cuenta de servicio no tiene permiso en el
  Issuer (repasá la Parte 1.3).
- **El logo no aparece** → la URL tiene que ser pública y terminar en
  `.png` o `.jpg`, accesible sin login.

Si te trabás en cualquier paso, pegame el mensaje de error exacto y
seguimos desde ahí.
