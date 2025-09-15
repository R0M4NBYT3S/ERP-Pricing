// routes/calculate.js — Orchestrator (final fixed)
const express = require('express');
const router = express.Router();

const { calculateChaseCover } = require('../pricing/calculateChaseCover');
const { calculateShroud } = require('../pricing/calculateShroud');
const { calculateMultiPrice } = require('../pricing/calculateMulti');
const { normalizeMetalType } = require('../utils/normalizeMetal');

const tierFactors = require('../config/tier_pricing_factors.json');
const multiFactors = require('../config/multiFactors.json');
const multiDiscrepancies = require('../config/multi_discrepancies');
const { data: multiDiscrepancyData } = multiDiscrepancies;

// Map short keys → long form names for Chase & Shroud
const chaseShroudTierMap = {
  elite: 'elite',
  vg: 'gold',
  vs: 'silver',
  val: 'value',
  bul: 'builder',
  ho: 'homeowner'
};


// ───────────────────────────────────────────────
// Tier resolution (for multi-flue math)
function resolveTierFactor(tierInput) {
  const key = String(tierInput || 'elite').toLowerCase();
  const table = tierFactors.tiers || tierFactors;
  if (!table[key]) return { tierKey: 'elite', factor: 1 };
  return { tierKey: key, factor: table[key] };
}

// ───────────────────────────────────────────────
// Global powdercoat bump
function applyPowdercoatIfNeeded(result, powdercoat) {
  if (powdercoat && /(ss|stainless)/i.test(result.metal || result.metalType)) {
    const bumped = +(result.finalPrice * 1.3).toFixed(2);
    result.finalPrice = bumped;
    result.price = bumped;
    if (result.printout) {
      result.printout.total = `Total Price (with Powdercoat): ${bumped.toFixed(2)}`;
    }
  }
  return result;
}

// ───────────────────────────────────────────────
// POST /api/calculate
router.post('/', (req, res) => {
  try {
    const product = String(req.body.product || '').toLowerCase();
    const metal = normalizeMetalType(req.body.metal || req.body.metalType);
    const { tierKey, factor: tierMultiplier } = resolveTierFactor(req.body.tier);
    const powdercoat = String(req.body.powdercoat).toLowerCase() === 'true';

    let rawResult;

    // ── Chase Covers ──
   // ── Chase Covers ──
if (product.includes('chase')) {
  const mappedTier = chaseShroudTierMap[tierKey] || 'elite';
  rawResult = calculateChaseCover({
    lengthVal: req.body.length || req.body.L,
    widthVal: req.body.width || req.body.W,
    skirtVal: req.body.skirt || req.body.S,
    metalType: metal,
    unsquare: req.body.unsquare,
    holeCount: req.body.holes
  }, mappedTier);

  if (rawResult.final_price != null) {
    rawResult.finalPrice = rawResult.final_price;
    rawResult.price = rawResult.final_price;
  }

  rawResult.tier = mappedTier;       // ✅ keep long form
  rawResult.tierMultiplier = 1;      // no multiplier, matrix already includes tiers
  rawResult = applyPowdercoatIfNeeded(rawResult, powdercoat);
  return res.json(rawResult);
}

// ── Shrouds ──
else if (
  product.includes('shroud') ||
  ['dynasty','majesty','monaco','royale','durham','monarch','regal',
   'princess','prince','temptress','imperial','centurion','mountaineer',
   'emperor'].some(name => product.includes(name))
) {
  const mappedTier = chaseShroudTierMap[tierKey] || 'elite';
  rawResult = calculateShroud({
    length: req.body.length,
    width: req.body.width,
    metal,
    model: req.body.model || product,
    tier: mappedTier
  });

  rawResult.tier = mappedTier;       // ✅ keep long form
  rawResult.tierMultiplier = 1;
  rawResult = applyPowdercoatIfNeeded(rawResult, powdercoat);
  return res.json(rawResult);
}

// ── Multi-Flue ──
else if (product.includes('flat_top') || product.includes('hip') || product.includes('ridge')) {
  // Always look up with elite
  const factorRow = (multiFactors || []).find(f =>
    String(f.metal).toLowerCase() === metal &&
    String(f.product).toLowerCase() === product &&
    String(f.tier || 'elite').toLowerCase() === 'elite'
  );
  if (!factorRow) {
    return res.status(400).json({ error: `No factor found for ${product} (${metal})` });
  }

  const rawBaseFactor = factorRow.factor || 0;
  const delta = (multiDiscrepancyData?.[metal]?.[product]?.[tierKey]) || 0;
  const baseFactor = +(rawBaseFactor + delta).toFixed(4);

  const input = {
    lengthVal: req.body.length,
    widthVal: req.body.width,
    screenVal: req.body.screenHeight || req.body.screen,
    overhangVal: req.body.lidOverhang || req.body.overhang,
    insetVal: req.body.inset,
    skirtVal: req.body.skirt,
    pitchVal: req.body.pitch,
    product,
    metal,
    tier: 'elite'   // 🔑 always elite for factor lookup
  };

  // Raw elite price
  rawResult = calculateMultiPrice(
    input,
    factorRow.adjustments,
    baseFactor,
    1,          // no multiplier yet
    'elite'
  );

  // Apply tier multiplier afterwards
  if (typeof rawResult.finalPrice === 'number') {
    rawResult.finalPrice = +(rawResult.finalPrice * tierMultiplier).toFixed(2);
    rawResult.price = rawResult.finalPrice;
  }

  // Powdercoat last
  rawResult = applyPowdercoatIfNeeded(rawResult, powdercoat);
  rawResult.tier = tierKey;
  rawResult.tierMultiplier = tierMultiplier;

  return res.json(rawResult);
}

    // ── Unknown product ──
    else {
      return res.status(400).json({ error: 'Unknown product type', product });
    }

  } catch (err) {
    console.error('CALCULATE ERROR:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

module.exports = router;
