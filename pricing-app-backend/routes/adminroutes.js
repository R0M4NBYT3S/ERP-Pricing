// routes/adminRoutes.js
// Read-only endpoints used by the Admin UI to populate dropdowns.

const express = require('express');
const router = express.Router();

// ---- Health for admin scope (optional but handy) ----
router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Multi-flue factors source (as used by your calculators)
let multiFactors = {};
try {
  // If your file is an array of rows, we’ll reshape to { metal: {product:{factor,adjustments}} }
  const raw = require('../config/multiFactors.json');

  if (Array.isArray(raw)) {
    const shaped = {};
    for (const row of raw) {
      const metal = String(row.metal || '').toLowerCase();
      const product = String(row.product || '').toLowerCase();
      if (!metal || !product) continue;
      shaped[metal] ||= {};
      shaped[metal][product] = {
        factor: Number(row.factor || 0),
        adjustments: row.adjustments || {
          screen:  { standard: 0, interval: 0, rate: 0 },
          overhang:{ standard: 0, interval: 0, rate: 0 },
          inset:   { standard: 0, interval: 0, rate: 0 },
          skirt:   { standard: 0, interval: 0, rate: 0 },
          pitch:   { below: 0, above: 0 },
        },
      };
    }
    multiFactors = shaped;
  } else if (raw && typeof raw === 'object') {
    // Already keyed object
    multiFactors = raw;
  }
} catch (e) {
  console.warn('⚠️ adminRoutes: multiFactors.json not found or invalid:', e.message);
  multiFactors = {};
}

// Shroud pricing source (metals config consumed by admin UI)
let shroudMetals = {};
try {
  const { metals } = require('../config/shroudUnified');
  shroudMetals = metals || {};
} catch (e) {
  console.warn('⚠️ adminRoutes: shroudUnified not found or invalid:', e.message);
  shroudMetals = {};
}

// ---- ROUTES ----

// GET /api/admin/factors  → used by Admin Multi-Flue tab
router.get('/factors', (_req, res) => {
  res.json(multiFactors || {});
});

// GET /api/admin/shrouds  → used by Admin Shrouds tab
router.get('/shrouds', (_req, res) => {
  res.json(shroudMetals || {});
});

// --- ADD: write factors endpoint for Admin page ---
const fs = require('fs');
const path = require('path');
const FACTOR_PATH = path.resolve(__dirname, '../config/multiFactors.json');

function readFactorsRaw() {
  try { return JSON.parse(fs.readFileSync(FACTOR_PATH, 'utf8')); }
  catch { return []; }
}
function writeFactorsRaw(rows) {
  fs.writeFileSync(FACTOR_PATH, JSON.stringify(rows, null, 2));
  // bust require cache for any code that still require()s the file
  try { delete require.cache[require.resolve('../config/multiFactors.json')]; } catch {}
}

router.post('/factors', (req, res) => {
  const { metal, product, factor, adjustments } = req.body || {};
  const m = String(metal || '').toLowerCase();
  const p = String(product || '').toLowerCase();
  const f = Number(factor);

  if (!m || !p || !Number.isFinite(f)) {
    return res.status(400).send('metal, product, factor required');
  }

  const rows = readFactorsRaw();

  // We key off the ELITE row (that’s what pricing uses as the base)
  const idx = rows.findIndex(r =>
    String(r.metal || '').toLowerCase()   === m &&
    String(r.product || '').toLowerCase() === p &&
    String(r.tier || 'elite').toLowerCase() === 'elite'
  );

  if (idx === -1) {
    rows.push({ metal: m, product: p, tier: 'elite', factor: f, adjustments: adjustments || undefined });
  } else {
    rows[idx] = { ...rows[idx], factor: f, adjustments: adjustments ?? rows[idx].adjustments };
  }

  writeFactorsRaw(rows);
  return res.json({ success: true });
});


module.exports = router;
