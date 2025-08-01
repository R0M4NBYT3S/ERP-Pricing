const express = require('express');
const router = express.Router();

const { calculateMultiPrice } = require('../pricing/calculateMulti');
const factorData = require('../config/multiFactors.json');
const { normalizeMetalType } = require('../utils/normalizeMetal');

router.post('/calculate', (req, res) => {
  try {
    let { product, metalType, metal, tier } = req.body;
    if (!product) return res.status(400).json({ error: 'Missing product' });

    // Normalize metal names
    metalType = normalizeMetalType(metalType);
    metal = normalizeMetalType(metal) || metalType;
    const lowerProduct = product.toLowerCase();
    const lowerTier = (tier || 'elite').toLowerCase();

    console.log('📦 Multi-Flue Pricing Request:', lowerProduct, `(${metalType}, ${lowerTier})`);

    // 🔹 Map payload to match calculateMultiPrice expectations
    const input = {
      lengthVal: parseFloat(req.body.length) || 0,
      widthVal: parseFloat(req.body.width) || 0,
      screenVal: parseFloat(req.body.screen) || 0,
      overhangVal: parseFloat(req.body.overhang) || 0,
      insetVal: parseFloat(req.body.inset) || 0,
      skirtVal: parseFloat(req.body.skirt) || 0,
      pitchVal: parseFloat(req.body.pitch) || 0,
      metalType,
      metal,
      product,
    };

    // 🔹 Find the matching factor row from flat JSON
    const factorRow = factorData.find(f =>
      f.metal.toLowerCase() === metalType &&
      f.product.toLowerCase() === lowerProduct &&
      f.tier.toLowerCase() === lowerTier
    );

    if (!factorRow) {
      return res.status(400).json({ error: `No factor found for ${product} (${metalType}, ${tier})` });
    }

    const baseFactor = factorRow.factor || 0;
    const adjustments = factorRow.adjustments || {};

    // 🔹 Tier multiplier - If JSON includes it, use it, otherwise fallback to 1
    const tierMultiplier = factorRow.multiplier || 1;

    // 🔹 Calculate Multi-Flue Price
    const result = calculateMultiPrice(input, adjustments, baseFactor, tierMultiplier, tier);

    // 🔹 Log Result
    console.log('💰 Multi-Flue Price Result:', {
      product: result.product,
      metalType: result.metalType,
      length: result.lengthVal,
      width: result.widthVal,
      screen: result.screenVal,
      overhang: result.overhangVal,
      inset: result.insetVal,
      skirt: result.skirtVal,
      pitch: result.pitchVal,
      baseFactor: result.baseFactor,
      adjustedFactor: result.adjustedFactor,
      tier: result.tier,
      tierMultiplier: result.tierMultiplier,
      tieredFactor: result.tieredFactor,
      finalPrice: result.finalPrice
    });

    return res.json(result);
  } catch (err) {
    console.error('🔥 Error in /api/multi/calculate:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
