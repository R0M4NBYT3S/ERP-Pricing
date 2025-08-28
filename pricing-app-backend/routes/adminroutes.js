// routes/adminroutes.js
// Admin read/write endpoints used by the Admin UI (Multi-Flue Factors only)

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// ----------------- Paths (from /routes → /config) -----------------
const FACTOR_PATH = path.resolve(__dirname, '../config/multiFactors.json');

// ----------------- Small utils -----------------
function readJsonSafe(abs, fallback) {
  try {
    const raw = fs.readFileSync(abs, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonPretty(abs, value) {
  fs.writeFileSync(abs, JSON.stringify(value, null, 2));
}

// ----------------- FACTORS (Multi-Flue) -----------------
function shapeFactors(rows) {
  if (!Array.isArray(rows)) return rows && typeof rows === 'object' ? rows : {};
  const shaped = {};
  for (const row of rows) {
    const metal = String(row?.metal || '').toLowerCase();
    const product = String(row?.product || '').toLowerCase();
    if (!metal || !product) continue;
    shaped[metal] ??= {};
    shaped[metal][product] = {
      factor: Number(row?.factor ?? 0),
      adjustments:
        row?.adjustments ?? {
          screen: { standard: 0, interval: 0, rate: 0 },
          overhang: { standard: 0, interval: 0, rate: 0 },
          inset: { standard: 0, interval: 0, rate: 0 },
          skirt: { standard: 0, interval: 0, rate: 0 },
          pitch: { below: 0, above: 0 }
        }
    };
  }
  return shaped;
}

function loadFactorsFresh() {
  return shapeFactors(readJsonSafe(FACTOR_PATH, []));
}

function writeFactorsRaw(rows) {
  writeJsonPretty(FACTOR_PATH, rows);
  try {
    const abs = require.resolve(FACTOR_PATH);
    delete require.cache[abs];
  } catch {}
}

// ----------------- ROUTES -----------------

// Health
router.get('/health', (_req, res) => res.json({ status: 'ok' }));

// FACTORS (Admin → Factors tab)
router.get('/factors', (_req, res) => {
  return res.json(loadFactorsFresh());
});

router.post('/factors', (req, res) => {
  const { metal, product, factor, adjustments } = req.body || {};
  const m = String(metal || '').toLowerCase();
  const p = String(product || '').toLowerCase();
  const f = Number(factor);

  if (!m || !p || !Number.isFinite(f)) {
    return res.status(400).send('metal, product, factor required');
  }

  const rows = readJsonSafe(FACTOR_PATH, []);
  const idx = rows.findIndex(r =>
    String(r?.metal || '').toLowerCase() === m &&
    String(r?.product || '').toLowerCase() === p &&
    String(r?.tier || 'elite').toLowerCase() === 'elite'
  );

  if (idx === -1) {
    rows.push({ metal: m, product: p, tier: 'elite', factor: f, adjustments: adjustments || undefined });
  } else {
    rows[idx] = { ...rows[idx], factor: f, adjustments: adjustments ?? rows[idx].adjustments };
  }

  writeFactorsRaw(rows);
  return res.json({ success: true, factors: shapeFactors(rows) });
});

module.exports = router;
