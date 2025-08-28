// routes/adminChase.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// ----- Paths (from /routes → /config) -----
const MATRIX_MOD = '../config/chaseCoverMatrix.js';
const OVERRIDES_JSON = path.join(__dirname, '../config/chase_overrides.json');

// ----- Helpers -----
function freshMatrix() {
  try { delete require.cache[require.resolve(MATRIX_MOD)]; } catch {}
  // chaseCoverMatrix[tier][metal][size] = { basePrice, ... }
  return require(MATRIX_MOD);
}

function readOverrides() {
  try {
    const raw = fs.readFileSync(OVERRIDES_JSON, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeOverrides(obj) {
  fs.writeFileSync(OVERRIDES_JSON, JSON.stringify(obj, null, 2));
}

function asPlainPrices(matrix) {
  const out = {};
  for (const [tier, metals] of Object.entries(matrix || {})) {
    out[tier] = out[tier] || {};
    for (const [metal, sizes] of Object.entries(metals || {})) {
      out[tier][metal] = out[tier][metal] || {};
      for (const [size, info] of Object.entries(sizes || {})) {
        const n = typeof info === 'number' ? info : info?.basePrice;
        if (Number.isFinite(n)) out[tier][metal][size] = n;
      }
    }
  }
  return out;
}

function deepMerge(target, src) {
  if (!src || typeof src !== 'object') return target;
  for (const k of Object.keys(src)) {
    const v = src[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      target[k] = deepMerge(target[k] && typeof target[k] === 'object' ? target[k] : {}, v);
    } else {
      target[k] = v;
    }
  }
  return target;
}

const DEFAULT_ADDONS = {
  hole: { black_kynar: 25, stainless: 45 },
  unsquare: { black_kynar: 60, stainless: 85 },
};

const toNum = (v) =>
  typeof v === 'string' ? Number(v.replace(/[^\d.\-]/g, '')) : Number(v);

// ----- GET /api/admin/chase -----
router.get('/', (_req, res) => {
  const base = asPlainPrices(freshMatrix());
  const ov = readOverrides();
  const prices = deepMerge(JSON.parse(JSON.stringify(base)), ov.prices || {});
  const addons = deepMerge(JSON.parse(JSON.stringify(DEFAULT_ADDONS)), ov.addons || {});
  return res.json({ prices, addons });
});

// ===== Upsert helpers =====
function upsertPrice(req, res) {
  const user = req.header('X-Admin-User');
  if (!user) return res.status(401).send('Missing X-Admin-User');

  const { tier, metal, size } = req.body || {};
  const t = String(tier || '').toLowerCase().trim();
  const m = String(metal || '').toLowerCase().trim();
  const s = String(size || '').toLowerCase().trim();
  if (!t || !m || !s) return res.status(400).send('tier, metal, size required');

  // Accept newPrice | price | value | amount
  let priceRaw =
    req.body?.newPrice ?? req.body?.price ?? req.body?.value ?? req.body?.amount;
  const price = toNum(priceRaw);
  if (!Number.isFinite(price)) return res.status(400).send('newPrice must be a number');

  const ov = readOverrides();
  ov.prices = ov.prices || {};
  ov.prices[t] = ov.prices[t] || {};
  ov.prices[t][m] = ov.prices[t][m] || {};
  ov.prices[t][m][s] = +price;
  writeOverrides(ov);

  const base = asPlainPrices(freshMatrix());
  const prices = deepMerge(JSON.parse(JSON.stringify(base)), ov.prices);
  return res.json({ ok: true, prices });
}

function setDeep(obj, dotted, val) {
  const parts = dotted.split('.');
  let cur = obj;
  while (parts.length > 1) {
    const k = parts.shift();
    cur[k] = cur[k] && typeof cur[k] === 'object' ? cur[k] : {};
    cur = cur[k];
  }
  cur[parts[0]] = val;
}

function upsertAddons(req, res) {
  const user = req.header('X-Admin-User');
  if (!user) return res.status(401).send('Missing X-Admin-User');

  const b = req.body || {};
  const ov = readOverrides();
  ov.addons = ov.addons || { hole: {}, unsquare: {} };

  // Support flat fields
  if (b.hole_black != null) ov.addons.hole.black_kynar = toNum(b.hole_black);
  if (b.hole_stainless != null) ov.addons.hole.stainless = toNum(b.hole_stainless);
  if (b.unsquare_black != null) ov.addons.unsquare.black_kynar = toNum(b.unsquare_black);
  if (b.unsquare_stainless != null) ov.addons.unsquare.stainless = toNum(b.unsquare_stainless);

  // Support { addons: { "hole.black_kynar": 25, "unsquare.stainless": 85, ... } }
  if (b.addons && typeof b.addons === 'object') {
    for (const [k, v] of Object.entries(b.addons)) {
      const n = toNum(v);
      if (Number.isFinite(n) && typeof k === 'string' && k.includes('.')) {
        setDeep(ov.addons, k, n);
      } else if (k === 'hole' || k === 'unsquare') {
        // Support nested object { addons: { hole: { black_kynar: 25 }, ... } }
        for (const [ik, iv] of Object.entries(b.addons[k] || {})) {
          const n2 = toNum(iv);
          if (Number.isFinite(n2)) {
            ov.addons[k] = ov.addons[k] || {};
            ov.addons[k][ik] = n2;
          }
        }
      }
    }
  }

  writeOverrides(ov);

  const addons = deepMerge(JSON.parse(JSON.stringify(DEFAULT_ADDONS)), ov.addons);
  return res.json({ ok: true, addons });
}

// ----- POST /api/admin/chase/price -----
router.post('/price', (req, res) => {
  try { return upsertPrice(req, res); }
  catch (e) { console.error(e); return res.status(500).json({ error: 'internal_error' }); }
});

// ----- POST /api/admin/chase/addons -----
router.post('/addons', (req, res) => {
  try { return upsertAddons(req, res); }
  catch (e) { console.error(e); return res.status(500).json({ error: 'internal_error' }); }
});

// ----- POST /api/admin/chase (generic dispatcher) -----
router.post('/', (req, res) => {
  try {
    const b = req.body || {};
    const looksLikePrice =
      (b.tier && b.metal && b.size) ||
      b.newPrice != null || b.price != null || b.value != null || b.amount != null;

    const looksLikeAddons =
      b.hole_black != null || b.hole_stainless != null ||
      b.unsquare_black != null || b.unsquare_stainless != null ||
      (b.addons && typeof b.addons === 'object');

    if (looksLikePrice) return upsertPrice(req, res);
    if (looksLikeAddons) return upsertAddons(req, res);
    return res.status(400).json({ error: 'Unsupported payload' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

module.exports = router;
