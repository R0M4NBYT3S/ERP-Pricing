const express = require('express');
const router = express.Router();

const { calculateChaseCover } = require('../pricing/calculateChaseCover');
const { calculateMultiPrice } = require('../pricing/calculateMulti');
const { calculateShroud } = require('../pricing/calculateShroud');
const { normalizeMetalType } = require('../utils/normalizeMetal');
const factorData = require('../config/multiFactors.json');

const shroudProducts = [
  'dynasty', 'princess', 'imperial', 'regal', 'majesty',
  'monarch', 'monaco', 'royale', 'temptress', 'durham',
  'centurion', 'prince', 'emperor'
];

// Customer tier multipliers for Multi-Flue
const tierMultipliers = {
  elite: 1.0,
  vg: 1.11969,
  vs: 1.181895,
  val: 1.2441,
  bul: 1.3299,
  ho: 1.43
};

router.post('/', (req, res) => {
  try {
    let { product, metalType, metal, tier } = req.body;
    if (!product) return res.status(400).json({ error: 'Missing product' });

    metalType = normalizeMetalType(metalType);
    metal = normalizeMetalType(metal) || metalType;
    const lowerProduct = product.toLowerCase();
    const lowerTier = (tier || 'elite').toLowerCase();

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
      result = calculateChaseCover(input);
      console.log('💰 Calculated Chase Cover Price:', result);
    }

    // Multi-Flue branch
    else if (
      lowerProduct.includes('flat_top') ||
      lowerProduct.includes('hip') ||
      lowerProduct.includes('ridge')
    ) {
      console.log('➡️ Routing to calculateMultiPrice');

      // Always look up the ELITE factor row, then apply tierMultipliers
      const factorRow = factorData.find(f =>
        f.metal.toLowerCase() === metalType &&
        f.product.toLowerCase() === lowerProduct &&
        f.tier.toLowerCase() === 'elite'
      );

      if (!factorRow) {
        console.warn(`⚠️ No factor found for ${product} (metal=${metalType})`);
        return res.status(400).json({ error: `No factor found for ${product} (${metalType})` });
      }

      const baseFactor = factorRow.factor || 0;
      const adjustments = factorRow.adjustments || {};

      // Fetch multiplier for the selected tier
      const tierMul = tierMultipliers[lowerTier] || 1.0;

      // Perform calculation
      result = calculateMultiPrice(input, adjustments, baseFactor, tierMul, lowerTier);
      console.log('💰 Calculated Multi-Flue Price:', result);
    }

    // Shroud branch
    else if (shroudProducts.some(name => lowerProduct.includes(name))) {
      console.log('➡️ Routing to calculateShroud');
      result = calculateShroud(input);
      console.log('💰 Calculated Shroud Price:', result);
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
