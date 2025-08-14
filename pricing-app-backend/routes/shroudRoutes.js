// routes/shroudRoutes.js
const express = require('express');
const router = express.Router();

const { metals, aliasIndex } = require('../config/shroudUnified');

// ---- Tier factors loader (safe if missing) ----
let tierCfg = {};
try {
  tierCfg = require('../config/tier_pricing_factors'); // JSON or JS exporting { tiers:{...} } or { elite:1,... }
} catch (e) {
  console.warn('⚠️ tier_pricing_factors not found; defaulting to 1.0 multipliers');
}

const TIER_ALIAS = {
  elite: 'elite', value: 'val', 'value-gold': 'vg', 'value-silver': 'vs',
  builder: 'bul', homeowner: 'ho', val: 'val', vg: 'vg', vs: 'vs', bul: 'bul', ho: 'ho'
};

function resolveTierAndFactor(reqTier, injectedTier) {
  const raw = (injectedTier || reqTier || 'elite').toString().toLowerCase();
  const short = TIER_ALIAS[raw] || raw;

  const table = (tierCfg && typeof tierCfg === 'object')
    ? (tierCfg.tiers && typeof tierCfg.tiers === 'object' ? tierCfg.tiers : tierCfg)
    : {};

  const tryKeys = [short, raw, 'elite'];
  let factor = 1.0;
  for (const k of tryKeys) {
    const v = table[k];
    if (v != null && !Number.isNaN(+v)) { factor = +v; break; }
  }
  return { tierKey: short, factor };
}

function pickMetalKey(metalKey, metalTypeKey) {
  const candidates = [metalKey, metalTypeKey].filter(Boolean).map(s => s.toLowerCase());
  for (const c of candidates) {
    const key = aliasIndex[c] || c;
    if (metals[key]) return key;
  }
  return null;
}

// NEW: read-only config for Admin UI dropdowns
router.get('/config', (_req, res) => {
  try {
    return res.json(metals || {});
  } catch (e) {
    console.error('GET /config error:', e);
    return res.json({});
  }
});

// POST /api/.../shrouds/calculate
router.post('/calculate', (req, res) => {
  const { metal, metalType, model, length, width } = req.body || {};
  if (!metal && !metalType) return res.status(400).json({ error: 'Missing metal/metalType' });
  if (!model) return res.status(400).json({ error: 'Missing model' });
  if (length == null || width == null) return res.status(400).json({ error: 'Missing length/width' });

  const L = Number(length), W = Number(width);
  const metalKey = pickMetalKey(metal, metalType);
  if (!metalKey) return res.status(400).json({ error: `Unsupported metal: ${metal || metalType}` });

  const config = metals[metalKey];
  const rules = config.rules || {};
  const prices = config.prices || {};

  const modelKey = (model || '').toString().trim().toLowerCase();
  const { tierKey, factor } = resolveTierAndFactor(req.body?.tier, req.tier);

  // Copper path: perimeter-based
  if (metalKey === 'copper') {
    const perimeter = (L + W) * 2 + 2;
    const match = (rules.perimeterRules || []).find(r => perimeter < r.max);

    if (!match) {
      return res.json({
        metal: metalKey, model: modelKey, perimeter,
        sizeCategory: 'N/A', price: 'DESIGN',
        tier: tierKey, adjustedFactor: +factor.toFixed(4),
        message: 'Office to Price'
      });
    }

    const size = match.size;
    const base = prices[modelKey]?.[size] ?? 'DESIGN';
    const final = typeof base === 'number' ? +(base * factor).toFixed(2) : base;

    return res.json({
      metal: metalKey, model: modelKey, perimeter,
      sizeCategory: size, price: base,
      tier: tierKey, adjustedFactor: +factor.toFixed(4),
      finalPrice: typeof final === 'number' ? final : undefined,
      message: base === 'DESIGN' ? 'Office to Price' : 'Price found'
    });
  }

  // Non-copper path: L+W+1 cutoff
  const total = L + W + 1;
  const order = ['small', 'medium', 'large', 'small_tall', 'large_tall'];
  let sizeCategory = null;

  for (const size of order) {
    if (rules.restricted?.includes(size)) continue;
    const max = rules.sizeCutoffs?.[size];
    if (max == null) continue;
    if (total < max) { sizeCategory = size; break; }
  }

  if (!sizeCategory) {
    return res.json({
      metal: metalKey, model: modelKey,
      sizeCategory: 'N/A', price: 'DESIGN',
      tier: tierKey, adjustedFactor: +factor.toFixed(4),
      message: 'Too large or not allowed'
    });
  }

  const base = prices[modelKey]?.[sizeCategory] ?? 'DESIGN';
  const final = typeof base === 'number' ? +(base * factor).toFixed(2) : base;

  return res.json({
    metal: metalKey, model: modelKey, sizeCategory,
    price: base, tier: tierKey, adjustedFactor: +factor.toFixed(4),
    finalPrice: typeof final === 'number' ? final : undefined,
    message: base === 'DESIGN' ? 'Office to Price' : 'Price found'
  });
});

module.exports = router;
