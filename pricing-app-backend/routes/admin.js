// routes/admin.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// --- Mount announcements under /api/admin/announcements for Admin UI ---
try {
  // This uses your robust announcements router (with SSE + tolerant POST)
  const announcementsRouter = require('./announcements');
  router.use('/announcements', announcementsRouter);
  console.log('✅ /api/admin/announcements mounted via routes/announcements.js');
} catch (e) {
  console.warn('ℹ️ routes/announcements.js not found; admin announcements disabled.');
}

// --- Master data files ---
const FACTORS_PATH = path.join(__dirname, '..', 'config', 'multiFactors.json');
const SHROUD_OVERRIDES_PATH = path.join(__dirname, '..', 'config', 'shroud_overrides.json');

// Unified shroud base (JS module). We won't write to this file; we persist overrides separately.
const { metals } = require('../config/shroudUnified');

// ---- Helpers ----
function readJsonSafe(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function writeJsonSafe(p, obj) {
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), 'utf8');
}

// ---------- AUTH (placeholder) ----------
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: 'Missing credentials' });
  return res.json({ ok: true, user: username });
});

// ---------- MULTI-FACTORS ----------
/**
 * UI expects nested:
 * { metal: { product: { factor, adjustments } } }
 * Stored canonically as array rows in config/multiFactors.json (tier='elite')
 */
router.get('/factors', (_req, res) => {
  const rows = readJsonSafe(FACTORS_PATH, []);
  const out = {};
  for (const r of rows) {
    if (!r || (r.tier && r.tier.toLowerCase() !== 'elite')) continue;
    const metal = (r.metal || '').toLowerCase();
    const product = (r.product || '').toLowerCase();
    if (!metal || !product) continue;
    out[metal] = out[metal] || {};
    out[metal][product] = {
      factor: typeof r.factor === 'number' ? r.factor : 0,
      adjustments: r.adjustments || {}
    };
  }
  res.json(out);
});

router.post('/factors', (req, res) => {
  const { metal, product, factor, adjustments } = req.body || {};
  const metalKey = (metal || '').toLowerCase();
  const productKey = (product || '').toLowerCase();

  if (!metalKey || !productKey) {
    return res.status(400).json({ success: false, message: 'Missing metal/product' });
  }
  if (typeof factor !== 'number' || Number.isNaN(factor)) {
    return res.status(400).json({ success: false, message: 'Invalid factor' });
  }

  const rows = readJsonSafe(FACTORS_PATH, []);
  const tier = 'elite';

  let idx = rows.findIndex(r =>
    r &&
    (r.tier || 'elite').toLowerCase() === 'elite' &&
    (r.metal || '').toLowerCase() === metalKey &&
    (r.product || '').toLowerCase() === productKey
  );

  const row = {
    metal: metalKey,
    product: productKey,
    tier,
    factor: factor,
    adjustments: adjustments || {}
  };

  if (idx >= 0) rows[idx] = row; else rows.push(row);

  writeJsonSafe(FACTORS_PATH, rows);
  return res.json({ success: true });
});

// ---------- SHROUDS (prices) ----------
router.get('/shrouds', (_req, res) => {
  const base = {};
  for (const metal of Object.keys(metals)) {
    base[metal] = metals[metal].prices || {};
  }
  const overrides = readJsonSafe(SHROUD_OVERRIDES_PATH, {});
  const merged = JSON.parse(JSON.stringify(base));
  for (const m of Object.keys(overrides || {})) {
    merged[m] = merged[m] || {};
    for (const prod of Object.keys(overrides[m] || {})) {
      merged[m][prod] = { ...(merged[m][prod] || {}), ...(overrides[m][prod] || {}) };
    }
  }
  res.json(merged);
});

router.post('/shrouds', (req, res) => {
  const { metal, product, size, newPrice } = req.body || {};
  const m = (metal || '').toLowerCase();
  const p = (product || '').toLowerCase();
  const s = (size || '').toLowerCase();

  if (!m || !p || !s) {
    return res.status(400).json({ success: false, message: 'Missing metal/product/size' });
  }
  if (typeof newPrice !== 'number' || Number.isNaN(newPrice)) {
    return res.status(400).json({ success: false, message: 'Invalid price' });
  }

  const overrides = readJsonSafe(SHROUD_OVERRIDES_PATH, {});
  overrides[m] = overrides[m] || {};
  overrides[m][p] = overrides[m][p] || {};
  overrides[m][p][s] = newPrice;

  writeJsonSafe(SHROUD_OVERRIDES_PATH, overrides);

  return res.json({ success: true, message: 'Price updated' });
});

module.exports = router;
