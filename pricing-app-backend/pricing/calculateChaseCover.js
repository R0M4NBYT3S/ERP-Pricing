// calculateChaseCover.js
const chaseCoverMatrix = require('../config/chaseCoverMatrix');

function calculateChaseCover(input) {
  const {
    lengthVal,
    widthVal,
    skirtVal,
    metalType,
    tier,
    unsquare = false,
    holes = 0
  } = input;

  const L = Number(lengthVal);
  const W = Number(widthVal);
  const S = Number(skirtVal);
  const U = Boolean(unsquare);
  const H = Number(holes);
  const metalKey = (metalType || '').toLowerCase();

  console.log('📩 Calculating Chase Cover:', { L, W, S, metalKey, U, H });

  // 🔹 Validate
  if (!L || !W || !metalKey || isNaN(S)) {
    return { error: 'Missing or invalid required fields for chase cover calculation' };
  }

  // 🔹 Determine size category
  const metalData = chaseCoverMatrix[metalKey];
  if (!metalData) return { error: `Unsupported metal: ${metalKey}` };

  let sizeCategory = null;
  let basePrice = null;

  for (const [size, data] of Object.entries(metalData)) {
    const match = data.dimensions.find(dim => L <= dim.maxLength && W <= dim.maxWidth && S === dim.skirt);
    if (match) {
      sizeCategory = size;
      basePrice = data.basePrice;
      break;
    }
  }

  if (!sizeCategory) {
    console.log(`❌ No valid size category found for: { length: ${L}, width: ${W}, skirt: ${S} }`);
    return { error: 'No valid size category' };
  }

  console.log(`✅ Matched Size Category: ${sizeCategory} | Base Price: ${basePrice}`);

  // ---------------------------
  // 🔹 Add-ons (Unsquare & Holes)
  // ---------------------------
  let addOns = 0;
  let addOnBreakdown = [];

  // ✅ Unsquare surcharge
  if (U) {
    const surcharge = (metalKey.includes('black') || metalKey.includes('kynar')) ? 60 : 85;
    addOns += surcharge;
    addOnBreakdown.push({ type: 'unsquare', amount: surcharge });
    console.log(`➕ Unsquare Surcharge Applied: ${surcharge}`);
  } else {
    console.log('ℹ️ No Unsquare Surcharge Applied');
  }

  // ✅ Hole surcharge (only holes over 1)
  if (H > 1) {
    const extraHoles = H - 1;
    const surchargePerHole = (metalKey.includes('black') || metalKey.includes('kynar')) ? 25 : 45;
    const totalHoleCharge = extraHoles * surchargePerHole;

    addOns += totalHoleCharge;
    addOnBreakdown.push({ type: 'extra_holes', count: extraHoles, perHole: surchargePerHole, amount: totalHoleCharge });
    console.log(`➕ Hole Surcharge Applied: ${extraHoles} extra holes × ${surchargePerHole} = ${totalHoleCharge}`);
  } else {
    console.log(`ℹ️ Hole Surcharge Not Applied (holes=${H})`);
  }

  // ---------------------------
  // 🔹 Final Price
  // ---------------------------
  const finalPrice = parseFloat((basePrice + addOns).toFixed(2));

  return {
    metal: metalKey,
    sizeCategory,
    base_price: basePrice,
    add_ons: addOns,
    add_on_breakdown: addOnBreakdown,
    tier,
    final_price: finalPrice,
    message: 'Price calculated'
  };
}

module.exports = { calculateChaseCover };
