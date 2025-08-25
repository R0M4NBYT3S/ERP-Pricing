// pricing/calculateChaseCover.js
// Use tier-specific grid pricing only. No multipliers applied here.

const chaseCoverMatrix = require('../config/chaseCoverMatrix');

/**
 * @param {object} input - measurement + options
 * @param {string} tierKey - normalized tier key (elite, value, gold, silver, builder, homeowner)
 */
function calculateChaseCover(input, tierKey = 'elite') {
  const {
    lengthVal,
    widthVal,
    skirtVal,
    metalType,
    unsquare = false,
    holes = 0
  } = input || {};

  const L = Number(lengthVal);
  const W = Number(widthVal);
  const S = Number(skirtVal);
  const U = Boolean(unsquare);
  const H = Number(holes);
  const metalKey = (metalType || '').toLowerCase();

  console.log('📩 Calculating Chase Cover:', { L, W, S, metalKey, U, H, tierKey });

  if (!L || !W || !metalKey || Number.isNaN(S)) {
    return { error: 'Missing or invalid required fields for chase cover calculation' };
  }

  const tierSlice = chaseCoverMatrix[tierKey];
  if (!tierSlice) return { error: `Unsupported tier: ${tierKey}` };

  const metalData = tierSlice[metalKey];
  if (!metalData) return { error: `Unsupported metal: ${metalKey}` };

  let sizeCategory = null;
  let basePrice = null;

  for (const [size, data] of Object.entries(metalData)) {
    const match = (data.dimensions || []).find(dim =>
      L <= dim.maxLength && W <= dim.maxWidth && S === dim.skirt
    );
    if (match) {
      sizeCategory = size;
      basePrice = data.basePrice;
      break;
    }
  }

  if (!sizeCategory || typeof basePrice !== 'number') {
    console.log(`❌ No valid size category found for: { length: ${L}, width: ${W}, skirt: ${S} }`);
    return { error: 'No valid size category' };
  }

  console.log(`✅ Matched Size Category: ${sizeCategory} | Base Price (${tierKey}): ${basePrice}`);

  // ---------------------------
  // 🔹 Add-ons (Unsquare & Holes)
  // ---------------------------
  let addOns = 0;
  const addOnBreakdown = [];

  if (U) {
    const surcharge = (metalKey.includes('black') || metalKey.includes('kynar')) ? 60 : 85;
    addOns += surcharge;
    addOnBreakdown.push({ type: 'unsquare', amount: surcharge });
  }

  if (H > 1) {
    const extra = H - 1;
    const perHole = (metalKey.includes('black') || metalKey.includes('kynar')) ? 25 : 45;
    const amt = extra * perHole;
    addOns += amt;
    addOnBreakdown.push({ type: 'extra_holes', count: extra, perHole, amount: amt });
  }

  const finalPrice = parseFloat((basePrice + addOns).toFixed(2));

  return {
    metal: metalKey,
    tier: tierKey,
    sizeCategory,
    base_price: basePrice,
    add_ons: addOns,
    add_on_breakdown: addOnBreakdown,
    final_price: finalPrice,
    message: 'Price calculated'
  };
}

module.exports = { calculateChaseCover };
