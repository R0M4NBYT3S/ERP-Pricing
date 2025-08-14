// routes/calculate.js
const express = require('express');
const router = express.Router();

const { calculateChaseCover } = require('../pricing/calculateChaseCover');
const { calculateMultiPrice } = require('../pricing/calculateMulti');
const { calculateShroud } = require('../pricing/calculateShroud');
const { normalizeMetalType } = require('../utils/normalizeMetal');
const factorData = require('../config/multiFactors.json'); // kept for minimal diff

// --- NEW: always read fresh factors so Admin edits apply without restart ---
function loadFactorData() {
  try { delete require.cache[require.resolve('../config/multiFactors.json')]; } catch {}
  try { return require('../config/multiFactors.json'); } catch { return []; }
}

// ---- compact logging control (kept) ----
const COMPACT_LOGS = true;
function runMuted(fn) {
  if (!COMPACT_LOGS) return fn();
  const orig = console.log;
  try {
    console.log = () => {};
    return fn();
  } finally {
    console.log = orig;
  }
}

// ---- Load tier factors from master file (kept) ----
let tierCfg = {};
try {
  // Accepts either:
  //   { tiers: { elite:1, vg:1.11969, ... } }
  // or { elite:1, vg:1.11969, ... }
  tierCfg = require('../config/tier_pricing_factors');
} catch {
  console.warn('⚠️ tier_pricing_factors not found; defaulting to 1.0 multipliers');
}

const TIER_ALIAS = {
  elite: 'elite',
  value: 'val',
  'value-gold': 'vg',
  'value-silver': 'vs',
  builder: 'bul',
  homeowner: 'ho',
  val: 'val',
  vg: 'vg',
  vs: 'vs',
  bul: 'bul',
  ho: 'ho'
};

function resolveTierAndFactor(tierInput) {
  const raw = (tierInput || 'elite').toString().toLowerCase();
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

const shroudProducts = [
  'dynasty', 'princess', 'imperial', 'regal', 'majesty',
  'monarch', 'monaco', 'royale', 'temptress', 'durham',
  'centurion', 'prince', 'emperor'
];

router.post('/', (req, res) => {
  try {
    let { product, metalType, metal, tier } = req.body;
    if (!product) return res.status(400).json({ error: 'Missing product' });

    metalType = normalizeMetalType(metalType);
    metal = normalizeMetalType(metal) || metalType;
    const lowerProduct = product.toLowerCase();

    // Build a uniform input object
    const input = {
      lengthVal: parseFloat(req.body.length) || 0,
      widthVal: parseFloat(req.body.width) || 0,
      screenVal: parseFloat(req.body.screenHeight || req.body.screen || 0),
      overhangVal: parseFloat(req.body.lidOverhang || req.body.overhang || 0),
      insetVal: parseFloat(req.body.inset) || 0,
      skirtVal: parseFloat(req.body.skirt) || 0,
      pitchVal: parseFloat(req.body.pitch) || 0,
      holes: parseFloat(req.body.holes || 0),
      unsquare: !!req.body.unsquare,
      metalType,
      metal,
      product,
      tier
    };

    console.log('📦 Routing product:', lowerProduct);

    let result;

    // Chase Cover branch
    if (lowerProduct.includes('chase_cover')) {
      console.log('➡️ Routing to calculateChaseCover');

      result = runMuted(() => calculateChaseCover(input));

      // compact one-line summary
      console.log(
        '🧮 Chase',
        JSON.stringify({
          L: input.lengthVal,
          W: input.widthVal,
          S: input.skirtVal,
          holes: input.holes,
          U: input.unsquare,
          metalType: input.metalType,
          tier: resolveTierAndFactor(tier).tierKey,
          final: result && (result.finalPrice ?? result.final_price)
        })
      );
    }

    // Multi-Flue branch
    else if (
      lowerProduct.includes('flat_top') ||
      lowerProduct.includes('hip') ||
      lowerProduct.includes('ridge')
    ) {
      console.log('➡️ Routing to calculateMultiPrice');

      // Always look up the ELITE factor row freshly from multiFactors, then apply the tier factor
      const factorRow = (loadFactorData() || []).find(f =>
        String(f.metal).toLowerCase() === metalType &&
        String(f.product).toLowerCase() === lowerProduct &&
        String(f.tier || 'elite').toLowerCase() === 'elite'
      );

      if (!factorRow) {
        console.warn(`⚠️ No factor found for ${product} (metal=${metalType})`);
        return res.status(400).json({ error: `No factor found for ${product} (${metalType})` });
      }

      const baseFactor = factorRow.factor || 0;
      const adjustments = factorRow.adjustments || {};

      // Pull multiplier from master tier file
      const { tierKey, factor: tierMul } = resolveTierAndFactor(tier);

      // Perform calculation (muted)
      result = runMuted(() =>
        calculateMultiPrice(input, adjustments, baseFactor, tierMul, tierKey)
      );

      // compact one-line summary
      console.log(
        '🧮 Multi',
        JSON.stringify({
          L: input.lengthVal, W: input.widthVal,
          screen: input.screenVal, overhang: input.overhangVal,
          inset: input.insetVal, skirt: input.skirtVal, pitch: input.pitchVal,
          metalType: input.metalType, tier: tierKey,
          base: baseFactor,
          adj: result && result.adjustedFactor,
          tiered: result && result.tieredFactor,
          final: result && result.finalPrice
        })
      );
    }

    // Shroud branch
    else if (shroudProducts.some(name => lowerProduct.includes(name))) {
      console.log('➡️ Routing to calculateShroud');

      result = runMuted(() => calculateShroud(input));

      // compact one-line summary
      console.log(
        '🧮 Shroud',
        JSON.stringify({
          product: input.product,
          metalType: input.metalType,
          tier: resolveTierAndFactor(tier).tierKey,
          final: result && (result.finalPrice ?? result.final_price)
        })
      );
    }

    // Unknown product
    else {
      console.warn('⚠️ Unknown product type:', product);
      return res.status(400).json({ error: 'Unknown product type', product });
    }

    // Finally, apply unsquare & hole surcharges if present
    if (result && typeof result.finalPrice === 'number') {
      let fp = result.finalPrice;

      if (input.unsquare) {
        if (['black_galvanized','kynar'].includes(input.metalType)) fp += 60;
        else fp += 85;
      }
      if (input.holes > 1) {
        const extra = input.holes - 1;
        fp += extra * (['black_galvanized','kynar'].includes(input.metalType) ? 25 : 45);
      }

      result.finalPrice = parseFloat(fp.toFixed(2));
    }

    return res.json(result);

  } catch (err) {
    console.error('🔥 Error in /api/calculate:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
