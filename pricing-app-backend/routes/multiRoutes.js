const express = require('express');
const router = express.Router();

const { calculateMultiPrice } = require('../pricing/calculateMulti');
const factorData = require('../config/multiFactors.json');
const { normalizeMetalType } = require('../utils/normalizeMetal');
const tierCfg = require('../config/tier_pricing_factors'); // NEW

// ---- Tier aliases (long → short used in your factors) ----
const TIER_ALIAS = {
  'elite': 'elite',
  'value': 'val',
  'value-gold': 'vg',
  'value-silver': 'vs',
  'builder': 'bul',
  'homeowner': 'ho',
  // already-short → short (no-op)
  'val': 'val',
  'vg': 'vg',
  'vs': 'vs',
  'bul': 'bul',
  'ho': 'ho',
};

// Resolve tier + multiplier from tier_pricing_factors.json
function resolveTierAndFactor(reqTier, injectedTier) {
  const raw = (injectedTier || reqTier || 'elite').toString().toLowerCase();
  const short = TIER_ALIAS[raw] || raw;

  // Accept either { elite:1,... } or { tiers:{ elite:1,... } }
  const table = (tierCfg && typeof tierCfg === 'object')
    ? (tierCfg.tiers && typeof tierCfg.tiers === 'object' ? tierCfg.tiers : tierCfg)
    : {};

  const tryKeys = [short, raw, 'elite'];
  let factor = 1.0;
  for (const k of tryKeys) {
    const v = table[k];
    if (v != null && !Number.isNaN(+v)) { factor = +v; break; }
  }

  if (factor === 1.0 && !('elite' in table)) {
    console.warn('⚠️  tier_pricing_factors missing or unrecognized; defaulting to 1.0');
  }

  return { tierKey: short, factor };
}

// NEW: read-only config for Admin UI dropdowns
router.get('/factors', (_req, res) => {
  try {
    const raw = factorData;
    // If array-shaped, present as { metal: { product: { factor, adjustments } } }
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
            screen: { standard: 0, interval: 0, rate: 0 },
            overhang: { standard: 0, interval: 0, rate: 0 },
            inset: { standard: 0, interval: 0, rate: 0 },
            skirt: { standard: 0, interval: 0, rate: 0 },
            pitch: { below: 0, above: 0 }
          }
        };
      }
      return res.json(shaped);
    }
    // already-keyed object
    return res.json(raw || {});
  } catch (e) {
    console.error('GET /factors error:', e);
    return res.json({});
  }
});

router.post('/calculate', (req, res) => {
  try {
    let { product, metalType, metal, tier } = req.body;
    if (!product) return res.status(400).json({ error: 'Missing product' });

    // Normalize metals
    metalType = normalizeMetalType(metalType);
    metal = normalizeMetalType(metal) || metalType;

    const lowerProduct = String(product || '').toLowerCase();

    // 🔹 Resolve tier (prefer server-injected), get multiplier from JSON
    const { tierKey: chosenTier, factor: tierMultiplier } = resolveTierAndFactor(tier, req.tier);

    console.log('📦 Multi-Flue Pricing Request:', lowerProduct, `(${metalType}, tier=${chosenTier})`);

    // 🔹 Map incoming payload to calculator’s expected input (keep your existing field names)
    const input = {
      // dimensions (support both legacy & new keys if they exist in body)
      lengthVal: parseFloat(req.body.length ?? req.body.lengthVal) || 0,
      widthVal: parseFloat(req.body.width ?? req.body.widthVal) || 0,
      screenVal: parseFloat(req.body.screen ?? req.body.screenVal) || 0,
      lidOverhang: parseFloat(req.body.lidOverhang ?? req.body.lid_overhang ?? 0) || 0,
      baseOverhang: parseFloat(req.body.baseOverhang ?? req.body.base_overhang ?? 0) || 0,
      inset: parseFloat(req.body.inset ?? req.body.insetVal ?? 0) || 0,
      holeCount: parseInt(req.body.holes ?? req.body.holeCount ?? 1, 10) || 1,

      // identifiers
      product: lowerProduct,
      metalType,
      metal,

      // pricing context
      tier: chosenTier, // pass resolved tier to the calculator
    };

    // 🔸 Run your advanced factor-based calculator
    const result = calculateMultiPrice(input, factorData) || {};

    // ── Harmonize + supplement tier fields in the response without breaking existing behavior ──
    // If the calculator already produced a tiered final price, respect it.
    // Otherwise, apply our multiplier to an available base price.
    const hasFinal = typeof result.finalPrice === 'number';
    const baseCandidate =
      typeof result.basePrice === 'number' ? result.basePrice
      : typeof result.price === 'number' ? result.price
      : typeof result.elitePrice === 'number' ? result.elitePrice
      : null;

    if (!hasFinal && baseCandidate != null) {
      result.finalPrice = +(baseCandidate * tierMultiplier).toFixed(2);
    }

    // Always expose normalized tier + multiplier for transparency
    result.tier = result.tier || chosenTier;
    if (typeof result.tierMultiplier !== 'number') {
      result.tierMultiplier = +tierMultiplier.toFixed(6);
    }

    // Optional: if your calculator exposes a baseFactor, provide tieredFactor for debugging
    if (typeof result.baseFactor === 'number' && typeof result.tieredFactor !== 'number') {
      result.tieredFactor = +(result.baseFactor * tierMultiplier).toFixed(6);
    }

    // Log key outputs once
    console.log('✅ Multi price result:', {
      product: lowerProduct,
      metal: metal,
      tier: result.tier,
      tierMultiplier: result.tierMultiplier,
      finalPrice: result.finalPrice
    });

    return res.json(result);
  } catch (err) {
    console.error('🔥 Error in /api/multi/calculate:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
