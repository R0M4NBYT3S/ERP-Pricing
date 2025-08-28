// pricing/calculateMulti.js
// Multi-flue price calculator
// Formula: finalPrice = (L + W) * ((baseFactor + adjustments) * tierMultiplier)

function num(v, dflt = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : dflt;
}

function ceilSteps(diff, interval) {
  const i = num(interval, 0);
  if (!(i > 0)) return 0;
  return Math.ceil(Math.max(0, num(diff, 0)) / i);
}

function floorSteps(diff, interval) {
  const i = num(interval, 0);
  if (!(i > 0)) return 0;
  return Math.floor(Math.max(0, num(diff, 0)) / i);
}

// ── Deterministic rounding helpers ─────────────────────────────────────────────
const roundDp = (n, dp) => {
  const p = 10 ** dp;
  return Math.round((n + Number.EPSILON) * p) / p;
};
const toCents = (amount) => Math.round((amount + Number.EPSILON) * 100);
const fromCents = (cents) => cents / 100;
// ───────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} input
 *   lengthVal, widthVal, screenVal, overhangVal, insetVal, skirtVal, pitchVal, product (string) ...
 * @param {Object} adjustments table, e.g. {
 *   screen: { standard, interval, rate },
 *   overhang: { standard, interval, rate },
 *   inset: { standard, interval, rate },
 *   skirt: { standard, interval, rate },
 *   pitch: { below, above }
 * }
 * @param {number} baseFactor      → product/type base factor
 * @param {number} tierMultiplier  → tier factor (val/vg/vs/etc.)
 * @param {string} tierKey         → tier name (for debug only)
 */
function calculateMultiPrice(input = {}, adjustments = {}, baseFactor = 0, tierMultiplier = 1, tierKey = 'elite') {
  const L = num(input.lengthVal);
  const W = num(input.widthVal);
  const perimeter = L + W;

  // Screen (ceil above standard)
  const scrStd  = num(adjustments?.screen?.standard, 0);
  const scrInt  = num(adjustments?.screen?.interval, 0);
  const scrRate = num(adjustments?.screen?.rate, 0);
  const screenSteps = ceilSteps(num(input.screenVal) - scrStd, scrInt);
  const screenAdjBase = screenSteps * scrRate;

  // New rule: screen <= 8 gets -0.19 (additive to base screen calc)
  const screenLowAdj = num(input.screenVal) <= 8 ? -0.19 : 0;

  // Overhang (ceil 1" steps ABOVE standard; never subtract). Default standard 5".
  const ovStd  = num(adjustments?.overhang?.standard, 5);
  const ovInt  = num(adjustments?.overhang?.interval, 1);
  const ovRate = num(adjustments?.overhang?.rate, 0);
  const ovDiff = Math.max(0, num(input.overhangVal) - ovStd);
  const overhangSteps = ovDiff > 0 ? Math.ceil(ovDiff / ovInt) : 0;
  const overhangAdj = overhangSteps * ovRate;

  // Inset (floor steps)
  const inStd  = num(adjustments?.inset?.standard, 0);
  const inInt  = num(adjustments?.inset?.interval, 0);
  const inRate = num(adjustments?.inset?.rate, 0);
  const insetSteps = floorSteps(num(input.insetVal) - inStd, inInt);
  const insetAdj = insetSteps * inRate;

  // Skirt (floor steps)
  const skStd  = num(adjustments?.skirt?.standard, 0);
  const skInt  = num(adjustments?.skirt?.interval, 0);
  const skRate = num(adjustments?.skirt?.rate, 0);
  const skirtSteps = floorSteps(num(input.skirtVal) - skStd, skInt);
  const skirtAdj = skirtSteps * skRate;

  // Pitch: <=5 add "below" once; 6-9 add 0; >=10 add floor(p-9) * "above"
  const p = num(input.pitchVal);
  const pBelow = num(adjustments?.pitch?.below, 0);
  const pAbove = num(adjustments?.pitch?.above, 0);
  let pitchAdj = 0;
  if (p <= 5) pitchAdj += pBelow;
  else if (p >= 10) pitchAdj += Math.floor(p - 9) * pAbove;

  // Corbel bonus: +0.15 if inset+overhang+skirt > 9 and product contains 'corbel'
  const isCorbel = typeof input.product === 'string' && input.product.toLowerCase().includes('corbel');
  const sumCOS = num(input.insetVal) + num(input.overhangVal) + num(input.skirtVal);
  const corbelAdj = isCorbel && sumCOS > 9 ? 0.15 : 0;

  // Totals
  const totalAdjustment =
    screenAdjBase + screenLowAdj + overhangAdj + insetAdj + skirtAdj + pitchAdj + corbelAdj;

  // ── Rounding policy ─────────────────────────────────────────────────────────
  // 1) Adjusted factor rounded to 4dp (clean logs)
  const adjustedFactor = roundDp(baseFactor + totalAdjustment, 4);

  // 2) Tiered factor rounded to 2dp BEFORE perimeter multiply
  const tieredFactor = roundDp(adjustedFactor * num(tierMultiplier, 1), 2);

  // 3) Final price via integer cents to avoid float drift
  const priceCents = toCents(perimeter * tieredFactor);
  const finalPrice = fromCents(priceCents);
  // ────────────────────────────────────────────────────────────────────────────

  // Return details for logging/debug (UI should use these directly)
  return {
    product: input.product || '',
    tier: tierKey,
    baseFactor: +baseFactor.toFixed(4),
    adjustedFactor: +adjustedFactor.toFixed(4), // 4dp
    tierMultiplier: +num(tierMultiplier, 1).toFixed(4),
    tieredFactor: +tieredFactor.toFixed(2),     // 2dp (pre-mult)
    perimeter: +perimeter.toFixed(2),

    // cents-safe price fields (use either; identical)
    computedPrice: finalPrice,
    totalPrice: finalPrice,
    finalPrice, // legacy/compat

    debug: {
      inputs: {
        length: L, width: W,
        screen: num(input.screenVal),
        overhang: num(input.overhangVal),
        inset: num(input.insetVal),
        skirt: num(input.skirtVal),
        pitch: num(input.pitchVal)
      },
      adjustments: {
        screen_base: +screenAdjBase.toFixed(4),
        screen_low8: +screenLowAdj.toFixed(4),
        overhang: +overhangAdj.toFixed(4),
        inset: +insetAdj.toFixed(4),
        skirt: +skirtAdj.toFixed(4),
        pitch: +pitchAdj.toFixed(4),
        corbel: +corbelAdj.toFixed(4),
        total: +totalAdjustment.toFixed(4)
      }
    }
  };
}

module.exports = { calculateMultiPrice };
