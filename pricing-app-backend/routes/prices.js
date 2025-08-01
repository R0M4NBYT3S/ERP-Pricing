// prices.js (refactored /calculate-chase-cover route)
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Load metal prices
const metalPricesPath = path.resolve(__dirname, '../config/metal-prices.json');
const metalPrices = JSON.parse(fs.readFileSync(metalPricesPath, 'utf-8'));
console.log("✅ Loaded metal-prices.json from:", metalPricesPath);
console.log("🔍 Available metals:", Object.keys(metalPrices));

// Load chase cover matrixes and pricing
const chaseCoverMatrix = require('../config/chaseCoverMatrix');

// Tier multipliers (applied AFTER elite base price)
const tierMultipliers = {
  elite: 1.0,
  vg: 1.11969,
  vs: 1.181895,
  val: 1.2441,
  bul: 1.3299,
  ho: 1.43
};

// POST /api/prices/calculate-chase-cover - Chase cover price calc (supports decimals)
router.post('/calculate-chase-cover', (req, res) => {
  const { metalType: rawMetalType = req.body.metal, skirt, length, width, tier, holes = 1 } = req.body;
  const metalType = rawMetalType;

  console.log('📩 Incoming request to /calculate-chase-cover:', req.body);

  // Validate metal type
  const metalMatrix = chaseCoverMatrix[metalType];
  if (!metalMatrix) {
    console.log('❌ Invalid metalType:', metalType);
    return res.status(400).json({ error: 'Invalid metal type for chase cover' });
  }

  // Normalize inputs
  const skirtNum = parseFloat(Number(skirt).toFixed(2));
  const holeCount = Number(holes) || 1;
  console.log(`🔹 Normalized skirt for matching: ${skirtNum}"`);

  const sizeClasses = ['small', 'medium', 'large_no_seam', 'large_seam', 'extra_large'];
  let sizeCategory = null;
  let elitePrice = null;

  // 🔹 Find first matching size category
  for (const category of sizeClasses) {
    const data = metalMatrix[category];
    if (!data || !Array.isArray(data.dimensions)) continue;

    const match = data.dimensions.find((d) => {
      const skirtMatch = Math.abs(Number(d.skirt) - skirtNum) < 0.001;
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

  if (!sizeCategory || elitePrice == null) {
    console.log('❌ No valid size category found');
    return res.status(400).json({ error: 'No valid size category found for input' });
  }

  // 🔹 Tier multiplier
  const multiplier = tierMultipliers[tier] ?? 1.0;
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

  // ✅ Response
  res.json({
    metalType,
    skirt: skirtNum,
    holes: holeCount,
    length,
    width,
    sizeCategory,
    base_price: parseFloat(elitePrice.toFixed(2)),
    tier,
    adjustedFactor: parseFloat(multiplier.toFixed(4)),
    finalPrice: parseFloat(finalPrice.toFixed(2))
  });
});

module.exports = router;
