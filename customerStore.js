// customerStore.js
// Guarda los clientes en un archivo JSON simple (data/customers.json).
// Esto ALCANZA para arrancar y probar, pero para un local con muchos
// clientes en serio, en algún momento conviene pasar a una base de datos
// real (por ejemplo Postgres). Avisame cuando llegues a ese punto y lo
// armamos.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'customers.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, JSON.stringify({}), 'utf8');
}

function readAll() {
  ensureStore();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

function writeAll(data) {
  ensureStore();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getCustomer(phone) {
  const all = readAll();
  return all[phone] || null;
}

function saveCustomer(phone, customer) {
  const all = readAll();
  all[phone] = customer;
  writeAll(all);
  return customer;
}

module.exports = { getCustomer, saveCustomer };
