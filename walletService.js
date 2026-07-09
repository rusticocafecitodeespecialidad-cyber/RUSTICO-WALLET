// walletService.js
// Toda la lógica que habla con la API de Google Wallet vive acá.
// No hace falta que entiendas cada línea: lo importante es que las
// variables de entorno (.env) estén bien completadas.

const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');
const jwt = require('jsonwebtoken');

const ISSUER_ID = process.env.WALLET_ISSUER_ID;
const CLASS_SUFFIX = 'rustico_club';
const CLASS_ID = `${ISSUER_ID}.${CLASS_SUFFIX}`;

const TOTAL_CUPS = 8;
const BRAND_BACKGROUND_COLOR = '#673921'; // Vison (marrón Rústico)
const BRAND_TEXT_ACCENT = '#f0e9d7';       // Quartz Pâle (crema Rústico)

const credentials = {
  client_email: process.env.GOOGLE_CLIENT_EMAIL,
  private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
};

const auth = new GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/wallet_object.issuer']
});

const walletClient = google.walletobjects({ version: 'v1', auth });

/**
 * Genera un "Card ID" corto y legible a partir del teléfono,
 * al estilo J4FEY3 que viste en la referencia.
 */
function generateCardId(phone) {
  let hash = 0;
  for (let i = 0; i < phone.length; i++) {
    hash = (hash * 31 + phone.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36).toUpperCase().slice(0, 6).padStart(6, '0');
}

/**
 * Crea la "Class" (la plantilla general de la tarjeta Rústico) la primera
 * vez que arranca el servidor. Si ya existe, no hace nada.
 */
async function ensureLoyaltyClass() {
  const classPayload = {
    id: CLASS_ID,
    issuerName: 'Rústico Café',
    programName: 'Rústico Club',
    programLogo: {
      sourceUri: { uri: process.env.RUSTICO_LOGO_URL }
    },
    hexBackgroundColor: BRAND_BACKGROUND_COLOR,
    reviewStatus: 'UNDER_REVIEW',
    rewardsTier: 'Miembro',
    rewardsTierLabel: 'Rústico Club'
  };

  try {
    await walletClient.loyaltyclass.get({ resourceId: CLASS_ID });
    console.log('La clase de Rústico Club ya existe, todo bien.');
  } catch (err) {
    if (err.code === 404) {
      await walletClient.loyaltyclass.insert({ requestBody: classPayload });
      console.log('Clase de Rústico Club creada por primera vez.');
    } else {
      console.error('Error chequeando/creando la clase:', err.message);
    }
  }
}

/**
 * Arma el objeto de "Passes Object" (la tarjeta individual de un cliente)
 * a partir de sus datos actuales.
 */
function buildLoyaltyObjectPayload(customer) {
  const objectId = `${ISSUER_ID}.cliente_${customer.phone}`;
  const stamps = customer.stamps || 0;
  const isFull = stamps >= TOTAL_CUPS;

  return {
    id: objectId,
    classId: CLASS_ID,
    state: 'ACTIVE',
    accountName: customer.name,
    accountId: customer.cardId,
    hexBackgroundColor: BRAND_BACKGROUND_COLOR,
    loyaltyPoints: {
      label: 'Progreso',
      balance: { string: `${stamps} / ${TOTAL_CUPS}` }
    },
    secondaryLoyaltyPoints: {
      label: 'Para obtener',
      balance: { string: isFull ? '¡Ya está!' : `${TOTAL_CUPS - stamps} cafés` }
    },
    textModulesData: [
      {
        id: 'reward',
        header: 'Siguiente recompensa',
        body: isFull ? 'Café gratis disponible ☕✨' : 'Café gratis ☕'
      }
    ],
    barcode: {
      type: 'QR_CODE',
      value: `RUSTICO-CLIENTE:${customer.phone}`,
      alternateText: customer.cardId
    }
  };
}

/**
 * Crea la tarjeta del cliente en Google Wallet la primera vez que se registra.
 */
async function createLoyaltyObject(customer) {
  const payload = buildLoyaltyObjectPayload(customer);
  try {
    await walletClient.loyaltyobject.insert({ requestBody: payload });
  } catch (err) {
    if (err.code === 409) {
      // ya existía, no pasa nada
    } else {
      throw err;
    }
  }
  return payload.id;
}

/**
 * Actualiza la tarjeta ya existente (cuando suma un sello o canjea el gratis)
 * y le manda una notificación push al teléfono del cliente.
 */
async function updateLoyaltyObject(customer, notificationMessage) {
  const payload = buildLoyaltyObjectPayload(customer);

  await walletClient.loyaltyobject.patch({
    resourceId: payload.id,
    requestBody: payload
  });

  if (notificationMessage) {
    try {
      await walletClient.loyaltyobject.addmessage({
        resourceId: payload.id,
        requestBody: {
          message: {
            header: notificationMessage.header,
            body: notificationMessage.body,
            id: `msg_${Date.now()}`,
            messageType: 'TEXT'
          }
        }
      });
    } catch (err) {
      console.warn('No se pudo mandar la notificación push:', err.message);
    }
  }
}

/**
 * Genera el link de "Agregar a Google Wallet" firmado con la cuenta de servicio.
 */
function buildSaveLink(objectId) {
  const claims = {
    iss: credentials.client_email,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    payload: {
      loyaltyObjects: [{ id: objectId }]
    }
  };

  const token = jwt.sign(claims, credentials.private_key, { algorithm: 'RS256' });
  return `https://pay.google.com/gp/v/save/${token}`;
}

module.exports = {
  generateCardId,
  ensureLoyaltyClass,
  createLoyaltyObject,
  updateLoyaltyObject,
  buildSaveLink,
  TOTAL_CUPS
};
