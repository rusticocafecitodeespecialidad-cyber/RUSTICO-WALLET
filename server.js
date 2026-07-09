// server.js
// Servidor principal. Corre 24/7 en tu hosting y es quien habla con
// Google Wallet en nombre de Rústico Café.

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const wallet = require('./walletService');
const store = require('./customerStore');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const TOTAL_CUPS = wallet.TOTAL_CUPS;

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function normalizePhone(raw) {
  return (raw || '').replace(/\D/g, '');
}

// ---------- Cliente: registrarse / entrar ----------
app.post('/api/register', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const name = (req.body.name || '').trim();

    if (phone.length < 8) return res.status(400).json({ error: 'Teléfono inválido' });

    let customer = store.getCustomer(phone);

    if (!customer) {
      if (!name) return res.status(400).json({ error: 'Falta el nombre' });

      customer = {
        phone,
        name,
        cardId: wallet.generateCardId(phone),
        stamps: 0,
        lastCheckIn: null,
        totalCheckins: 0,
        freeCoffees: 0,
        createdAt: todayStr()
      };

      const objectId = await wallet.createLoyaltyObject(customer);
      customer.walletObjectId = objectId;
      store.saveCustomer(phone, customer);
    }

    const saveUrl = wallet.buildSaveLink(customer.walletObjectId);
    res.json({ customer, saveUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor', detail: err.message });
  }
});

app.get('/api/customer/:phone', (req, res) => {
  const phone = normalizePhone(req.params.phone);
  const customer = store.getCustomer(phone);
  if (!customer) return res.status(404).json({ error: 'No encontrado' });
  const saveUrl = wallet.buildSaveLink(customer.walletObjectId);
  res.json({ customer, saveUrl });
});

// ---------- Mostrador: PIN ----------
app.post('/api/staff/login', (req, res) => {
  const pin = (req.body.pin || '').trim();
  if (pin === process.env.STAFF_PIN) {
    res.json({ ok: true });
  } else {
    res.status(401).json({ ok: false, error: 'PIN incorrecto' });
  }
});

// ---------- Mostrador: escanear QR y sumar sello / canjear ----------
app.post('/api/staff/scan', async (req, res) => {
  try {
    const pin = (req.body.pin || '').trim();
    if (pin !== process.env.STAFF_PIN) {
      return res.status(401).json({ error: 'PIN incorrecto' });
    }

    const qrValue = req.body.qrValue || '';
    const prefix = 'RUSTICO-CLIENTE:';
    if (!qrValue.startsWith(prefix)) {
      return res.status(400).json({ error: 'Código QR no reconocido' });
    }

    const phone = qrValue.slice(prefix.length).trim();
    const customer = store.getCustomer(phone);
    if (!customer) return res.status(404).json({ error: 'Cliente no encontrado' });

    const today = todayStr();

    // Tarjeta completa -> canjear café gratis
    if (customer.stamps >= TOTAL_CUPS) {
      customer.stamps = 0;
      customer.freeCoffees = (customer.freeCoffees || 0) + 1;
      store.saveCustomer(phone, customer);
      await wallet.updateLoyaltyObject(customer, {
        header: 'Rústico',
        body: '¡Canjeaste tu café gratis! Arrancás una tarjeta nueva.'
      });
      return res.json({
        result: 'redeemed',
        name: customer.name,
        stamps: customer.stamps,
        totalCups: TOTAL_CUPS
      });
    }

    // Ya marcó hoy
    if (customer.lastCheckIn === today) {
      return res.json({
        result: 'already_today',
        name: customer.name,
        stamps: customer.stamps,
        totalCups: TOTAL_CUPS
      });
    }

    // Sumar sello
    customer.stamps += 1;
    customer.lastCheckIn = today;
    customer.totalCheckins = (customer.totalCheckins || 0) + 1;
    store.saveCustomer(phone, customer);

    const full = customer.stamps >= TOTAL_CUPS;
    await wallet.updateLoyaltyObject(customer, {
      header: 'Rústico',
      body: full ? '¡Completaste la tarjeta! Ya podés canjear tu café gratis 🎉' : 'Sumaste un café ☕'
    });

    res.json({
      result: full ? 'completed' : 'stamped',
      name: customer.name,
      stamps: customer.stamps,
      totalCups: TOTAL_CUPS
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error del servidor', detail: err.message });
  }
});

const PORT = process.env.PORT || 3000;

wallet.ensureLoyaltyClass()
  .catch(err => console.error('No se pudo preparar la clase de Wallet:', err.message))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Servidor de Rústico Club escuchando en el puerto ${PORT}`);
    });
  });
