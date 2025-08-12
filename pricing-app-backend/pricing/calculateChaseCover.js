// pricing/calculateChaseCover.js
// Applies tier multiplier from caller (master tier file), then add-ons.

const chaseCoverMatrix = require('../config/chaseCoverMatrix');

/**
 * @param {object} input - measurement + options
 * @param {number} tierMul - multiplier from master tier file (e.g., elite=1.0, vg=1.11969)
 * @param {string} tierKey - normalized tier key (elite, vg, vs, val, bul, ho)
 */
function calculateChaseCover(input, tierMul = 1.0, tierKey = 'elite') {
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

  console.log('📩 Calculating Chase Cover:', { L, W, S, metalKey, U, H, tierMul, tierKey });

  // 🔹 Validate
  if (!L || !W || !metalKey || Number.isNaN(S)) {
    return { error: 'Missing or invalid required fields for chase cover calculation' };
  }

  // 🔹 Find size category + base price from matrix
  const metalData = chaseCoverMatrix[metalKey];
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

  console.log(`✅ Matched Size Category: ${sizeCategory} | Base Price (elite): ${basePrice}`);

  // 🔹 Apply tier multiplier to the base matrix price
  const adjustedBase = +(basePrice * (Number(tierMul) || 1)).toFixed(2);

  // ---------------------------
  // 🔹 Add-ons (Unsquare & Holes)
  // ---------------------------
  let addOns = 0;
  const addOnBreakdown = [];

  // Unsquare surcharge
  if (U) {
    const surcharge = (metalKey.includes('black') || metalKey.includes('kynar')) ? 60 : 85;
    addOns += surcharge;
    addOnBreakdown.push({ type: 'unsquare', amount: surcharge });
    console.log(`➕ Unsquare Surcharge Applied: ${surcharge}`);
  } else {
    console.log('ℹ️ No Unsquare Surcharge Applied');
  }

  // Hole surcharge (only holes over 1)
  if (H > 1) {
    const extra = H - 1;
    const perHole = (metalKey.includes('black') || metalKey.includes('kynar')) ? 25 : 45;
    const amt = extra * perHole;
    addOns += amt;
    addOnBreakdown.push({ type: 'extra_holes', count: extra, perHole, amount: amt });
    console.log(`➕ Hole Surcharge Applied: ${extra} extra holes × ${perHole} = ${amt}`);
  } else {
    console.log(`ℹ️ Hole Surcharge Not Applied (holes=${H})`);
  }

  // ---------------------------
  // 🔹 Final Price
  // ---------------------------
  const finalPrice = parseFloat((adjustedBase + addOns).toFixed(2));

  return {
    metal: metalKey,
    sizeCategory,
    base_price: basePrice,        // elite/base matrix price
    tier: tierKey,
    tier_multiplier: Number(tierMul) || 1,
    adjusted_base: adjustedBase,  // base × tier
    add_ons: addOns,
    add_on_breakdown: addOnBreakdown,
    final_price: finalPrice,
    message: 'Price calculated'
  };
}

module.exports = { calculateChaseCover };
