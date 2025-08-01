const express = require('express');
const router = express.Router();
const shroudPricing = require('../config/shroudPricing');
const shroudPrices = require('../config/shroudPrices');

// POST /api/shrouds/calculate
router.post('/calculate', (req, res) => {
  const { metalType, metal, length, width, model } = req.body;

  if (!metalType || !metal || !model || length == null || width == null) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const metalKey = metal.toLowerCase();         // backend key: ss24pol, black_galvanized, kynar, copper
  const metalTypeKey = metalType.toLowerCase(); // frontend key: ss24pol, etc.
  const modelKey = model.toLowerCase();
  const L = Number(length);
  const W = Number(width);

  // ✅ Enforce Stainless Polish 24ga rule
  if (metalKey === 'ss24pol' && metalTypeKey !== 'ss24pol') {
    return res.status(400).json({
      error: 'Shrouds only support Stainless Steel Polish 24ga.'
    });
  }

  const pricingRule = shroudPricing.pricingRules[metalKey];
  if (!pricingRule) {
    return res.status(400).json({ error: `Unsupported metal: ${metalKey}` });
  }

  // Handle copper (formula-based)
  if (metalKey === 'copper') {
    const perimeter = (L + W) * 2 + 2;
    const match = pricingRule.rules.find(rule => perimeter < rule.max);

    if (!match) {
      return res.json({ sizeCategory: 'N/A', price: 'DESIGN', message: 'Office to Price' });
    }

    const sizeCategory = match.size;
    const price = shroudPrices[metalKey]?.[modelKey]?.[sizeCategory] ?? 'DESIGN';

    return res.json({
      metal: metalKey,
      model,
      perimeter,
      sizeCategory,
      price,
      message: price === 'DESIGN' ? 'Office to Price' : 'Price found'
    });
  }

  // Handle other metals (fixed cutoffs using L + W + 1)
  const sizeOrder = ['small', 'medium', 'large', 'small_tall', 'large_tall'];
  let sizeCategory = null;

  for (const size of sizeOrder) {
    if (
      pricingRule.restricted?.includes(size) ||
      (pricingRule.allowAll === false && !pricingRule.sizeCutoffs[size])
    ) {
      continue;
    }

    const max = pricingRule.sizeCutoffs[size];
    const total = L + W + 1;

    if (total < max) {
      sizeCategory = size;
      break;
    }
  }

  if (!sizeCategory) {
    return res.json({ sizeCategory: 'N/A', price: 'DESIGN', message: 'Too large or not allowed' });
  }

  const price = shroudPrices[metalKey]?.[modelKey]?.[sizeCategory] ?? 'DESIGN';

  res.json({
    metal: metalKey,
    model,
    sizeCategory,
    price,
    message: price === 'DESIGN' ? 'Office to Price' : 'Price found'
  });
});

module.exports = router;
