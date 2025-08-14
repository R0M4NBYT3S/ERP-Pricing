// routes/adminShrouds.js
const fs = require('fs');
const path = require('path');

const BASE_MOD = '../config/shroudUnified.js';
const OVERRIDES_JSON = path.join(__dirname, '../config/shroud_overrides.json');

// --- helpers ---
function loadBase() {
  // fresh require in case you edit the JS file
  try { delete require.cache[require.resolve(BASE_MOD)]; } catch {}
  return require(BASE_MOD).metals || {};
}
function loadOverrides() {
  try {
    const raw = fs.readFileSync(OVERRIDES_JSON, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {}; // no overrides yet
  }
}
function saveOverrides(obj) {
  fs.writeFileSync(OVERRIDES_JSON, JSON.stringify(obj, null, 2), 'utf8');
}

// deep merge only for .prices
function mergedMetals() {
  const base = loadBase();
  const ov = loadOverrides();
  const out = JSON.parse(JSON.stringify(base));
  for (const m of Object.keys(ov || {})) {
    out[m] = out[m] || {};
    out[m].prices = out[m].prices || {};
    const mPrices = ov[m]?.prices || {};
    for (const model of Object.keys(mPrices)) {
      out[m].prices[model] = { ...(out[m].prices[model] || {}), ...(mPrices[model] || {}) };
    }
  }
  return out;
}

const express = require('express');
const router = express.Router();

// ====== GET current (base + overrides) ======
router.get('/', (_req, res) => {
  try {
    return res.json(mergedMetals());
  } catch (e) {
    console.error('GET /api/admin/shrouds error:', e);
    return res.status(500).json({ error: 'Failed to load shroud data' });
  }
});

// ====== POST update a single price ======
// body: { metal, product, size, newPrice }
router.post('/', (req, res) => {
  try {
    const user = req.header('X-Admin-User'); // simple gate to match your Admin.jsx
    if (!user) return res.status(401).send('Missing X-Admin-User');

    const { metal, product, size } = req.body || {};
    let { newPrice } = req.body || {};
    if (!metal || !product || !size) return res.status(400).send('metal, product, size required');

    // accept number or numeric string
    if (typeof newPrice === 'string' && newPrice.trim() !== '') newPrice = Number(newPrice);
    if (!Number.isFinite(newPrice)) return res.status(400).send('newPrice must be a number');

    // validate against base to avoid typos
    const base = loadBase();
    const m = base[metal];
    if (!m) return res.status(400).send(`Unknown metal: ${metal}`);
    const p = (m.prices || {})[product];
    if (!p) return res.status(400).send(`Unknown product for ${metal}: ${product}`);
    if (!(size in p)) return res.status(400).send(`Unknown size for ${metal}/${product}: ${size}`);

    // write override
    const ov = loadOverrides();
    ov[metal] = ov[metal] || {};
    ov[metal].prices = ov[metal].prices || {};
    ov[metal].prices[product] = ov[metal].prices[product] || {};
    ov[metal].prices[product][size] = +newPrice;

    saveOverrides(ov);

    return res.json({ ok: true, metal, product, size, newPrice: +newPrice });
  } catch (e) {
    console.error('POST /api/admin/shrouds error:', e);
    return res.status(500).send('Failed to update shroud price');
  }
});

module.exports = router;
