// chaseRoutes.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Load metal prices (left as-is for your current logic/debug)
const metalPricesPath = path.resolve(__dirname, '../config/metal-prices.json');
const metalPrices = JSON.parse(fs.readFileSync(metalPricesPath, 'utf-8'));
console.log("✅ Loaded metal-prices.json from:", metalPricesPath);
console.log("🔍 Available metals:", Object.keys(metalPrices));

// Load chase cover matrixes and pricing
const chaseCoverMatrix = require('../config/chaseCoverMatrix');

// NEW: Load tier factors from JSON
const tierCfg = require('../config/tier_pricing_factors');

// Tier alias mapping (long → short keys used in your factors)
const TIER_ALIAS = {
  elite: 'elite',
  value: 'val',
  'value-gold': 'vg',
  'value-silver': 'vs',
  builder: 'bul',
  homeowner: 'ho',
  // already-short → short (no-op)
  val: 'val',
  vg: 'vg',
  vs: 'vs',
  bul: 'bul',
  ho: 'ho',
};

// Resolve tier + multiplier from tier_pricing_factors.json
function resolveTierAndFactor(reqTier, injectedTier) {
  const raw = (injectedTier || reqTier || 'elite').toString().toLowerCase();
  const short = TIER_ALIAS[raw] || raw;

  // Accept either { elite:1,... } or { tiers:{ elite:1,... } }
  const table =
    tierCfg && typeof tierCfg === 'object'
      ? (tierCfg.tiers && typeof tierCfg.tiers === 'object' ? tierCfg.tiers : tierCfg)
      : {};

  const tryKeys = [short, raw, 'elite'];
  let factor = 1.0;
  for (const k of tryKeys) {
    const v = table[k];
    if (v != null && !Number.isNaN(+v)) {
      factor = +v;
      break;
    }
  }

  if (factor === 1.0 && !('elite' in table)) {
    console.warn('tier_pricing_factors missing or unrecognized; defaulting to 1.0');
  }

  return { tierKey: short, factor };
}

// POST /api/chase/calculate - Chase cover pricing with decimal support
router.post('/calculate', (req, res) => {
  const {
    metalType: rawMetalType = req.body.metal,
    skirt,
    length,
    width,
    tier,
    holes = 1,
  } = req.body;
  const metalType = rawMetalType;

  console.log('📩 Incoming request to /api/chase/calculate:', req.body);

  // 🔹 Resolve tier via JSON config (prefer server-injected)
  const { tierKey: chosenTier, factor: multiplier } = resolveTierAndFactor(tier, req.tier);

  // Validate metal type
  const metalMatrix = chaseCoverMatrix[metalType];
  if (!metalMatrix) {
    console.log('❌ Invalid metalType:', metalType);
    return res.status(400).json({ error: 'Invalid metal type for chase cover' });
  }

  // Normalize skirt to decimal
  const skirtNum = parseFloat(Number(skirt).toFixed(2));
  const holeCount = Number(holes) || 1;
  console.log(`🔹 Normalized skirt for matching: ${skirtNum}"`);

  const sizeClasses = ['small', 'medium', 'large_no_seam', 'large_seam', 'extra_large'];
  let sizeCategory = null;
  let elitePrice = null;

  // 🔹 Find first valid size match
  for (const category of sizeClasses) {
    const data = metalMatrix[category];
    if (!data || !Array.isArray(data.dimensions)) continue;

    const match = data.dimensions.find((d) => {
      const skirtMatch = Math.abs(Number(d.skirt) - skirtNum) < 0.001; // tolerance for floating-point
      const lengthMatch = length <= d.maxLength;
      const widthMatch = width <= d.maxWidth;
      return skirtMatch && lengthMatch && widthMatch;
    });

    if (match) {
      sizeCategory = category;
      elitePrice = data.basePrice;
      console.log(`✅ Matched category: ${category} → Base Price: ${elitePrice}`);
      break;
    }
  }

  // ❌ No valid match
  if (!sizeCategory || elitePrice == null) {
    console.log('❌ No valid size category found');
    return res.status(400).json({ error: 'No valid size category found for input' });
  }

  // 🔹 Apply tier factor from JSON
  const baseFinal = elitePrice * multiplier;

  // 🔹 Hole pricing
  let holeCharge = 0;
  if (holeCount > 1) {
    const extraHoles = holeCount - 1;
    const expensiveMetals = ['stainless', 'copper', 'ss24pol', 'ss26mil', 'ss24mil'];
    const perHole = expensiveMetals.some((m) => metalType.toLowerCase().includes(m)) ? 45 : 25;
    holeCharge = extraHoles * perHole;
    console.log(`➕ Hole Charge: ${extraHoles} extra × $${perHole} = $${holeCharge}`);
  }

  const finalPrice = baseFinal + holeCharge;

  // ✅ Response JSON
  res.json({
    metalType,
    skirt: skirtNum,
    holes: holeCount,
    length,
    width,
    sizeCategory,
    base_price: parseFloat(elitePrice.toFixed(2)),
    tier: chosenTier,
    adjustedFactor: parseFloat(multiplier.toFixed(4)),
    finalPrice: parseFloat(finalPrice.toFixed(2)),
  });
});

module.exports = router;
