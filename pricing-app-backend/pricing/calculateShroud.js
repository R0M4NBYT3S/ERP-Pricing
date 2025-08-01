// calculateShroud.js
const shroudPrices = require('../config/shroudPrices');
const shroudPricing = require('../config/shroudPricing');

function calculateShroud(input) {
  const { metalType, product, tier } = input;

  // 🔹 Support both `length/width` and `lengthVal/widthVal`
  const L = Number(input.length ?? input.lengthVal ?? 0);
  const W = Number(input.width ?? input.widthVal ?? 0);

  console.log('📩 Calculating Shroud:', { ...input, L, W });

  // 🔹 Validate required fields
  if (!metalType || !product || L <= 0 || W <= 0) {
    return { error: 'Missing required fields for shroud calculation' };
  }

  const metalKey = metalType.toLowerCase();
  const modelKey = product.toLowerCase();

  const tierMultipliers = {
    elite: 1.0,
    vg: 1.11969,
    vs: 1.181895,
    val: 1.2441,
    bul: 1.3299,
    ho: 1.43
  };

  const rules = shroudPricing.pricingRules[metalKey];
  if (!rules) return { error: `Unsupported metal type for shrouds: ${metalKey}` };

  let sizeCategory = null;

  // 🔹 Copper: formula-based sizing
  if (metalKey === 'copper') {
    const perimeter = (L + W) * 2 + 2;
    const match = rules.rules.find(r => perimeter < r.max);
    sizeCategory = match ? match.size : 'N/A';
  } else {
    // 🔹 Standard logic: L + W + 1
    const total = L + W + 1;
    const sizeOrder = ['small', 'medium', 'large', 'small_tall', 'large_tall'];

    for (const size of sizeOrder) {
      if (rules.restricted?.includes(size)) continue;
      const max = rules.sizeCutoffs[size];
      if (!max) continue;

      if (total < max) {
        sizeCategory = size;
        break;
      }
    }
  }

  if (!sizeCategory) {
    return { sizeCategory: 'N/A', price: 'DESIGN', message: 'Too large or not allowed' };
  }

  // 🔹 Get base price
  const metalPrices = shroudPrices[metalKey];
  if (!metalPrices) return { error: `No pricing found for metal: ${metalKey}` };

  const productPrices = metalPrices[modelKey];
  if (!productPrices) return { error: `No pricing found for product: ${modelKey}` };

  const elitePrice = productPrices[sizeCategory];
  if (!elitePrice || elitePrice === 'DESIGN') {
    return {
      metal: metalKey,
      product,
      sizeCategory,
      base_price: 'DESIGN',
      final_price: 'DESIGN',
      message: 'Office to Price'
    };
  }

  const multiplier = tierMultipliers[tier?.toLowerCase()] || 1.0;
  const finalPrice = elitePrice * multiplier;

  return {
    metal: metalKey,
    product,
    length: L,
    width: W,
    sizeCategory,
    base_price: parseFloat(elitePrice.toFixed(2)),
    tier,
    final_price: parseFloat(finalPrice.toFixed(2)),
    message: 'Price calculated'
  };
}

// ✅ Export with the expected name
module.exports = { calculateShroud };
