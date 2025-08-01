function calculateMultiPrice(input, factorData) {
  let { metal, product, length, width, tier, screen, overhang, inset, skirt, pitch } = input;

  console.log("✅ multiPricing.js is being used right now!");

  // Normalize
  const normalizeKey = (key) => key.toLowerCase().replace(/\s+/g, '_');
  const normalizedProduct = normalizeKey(product);
  const productAliases = {
    ftomt: 'flat_top_outside_mount',
    hrtomt: 'hip_and_ridge_top_mount',
    hromt: 'hip_and_ridge_outside_mount',
    htsmt: 'hip_top_mount',
    homt: 'hip_outside_mount',
    hromss: 'hip_and_ridge_outside_mount_standing_seam',
    hipcor: 'hip_corbel'
  };
  const normalizedAlias = productAliases[product] || normalizedProduct;

  // Find base factor (always elite)
  const record = factorData.find(
    (r) =>
      r.metal === metal &&
      normalizeKey(r.product) === normalizedAlias &&
      r.tier === 'elite'
  );

  if (!record || typeof record.factor !== 'number') {
    console.error('❌ No valid factor record found for:', { product, metal });
    return { error: `No factor for ${product} / ${metal}` };
  }

  const { factor, adjustments } = record;

  // Tier multipliers
  const tierMultipliers = {
    elite: 1.0,
    vg: 1.11969,
    vs: 1.181895,
    val: 1.2441,
    bul: 1.3299,
    ho: 1.43
  };
  const tierMultiplier = tierMultipliers[tier] || 1.0;

  // Base Adjustments
  let rawFactor = factor;
  const round4 = (v) => parseFloat(v.toFixed(4));
  const round2 = (v) => parseFloat(v.toFixed(2));

  if (adjustments.screen && screen) rawFactor += adjustments.screen.rate;
  if (adjustments.overhang && overhang) rawFactor += adjustments.overhang.rate * overhang;
  if (adjustments.inset && inset) rawFactor += adjustments.inset.rate * inset;
  if (adjustments.skirt && skirt) {
    if (normalizedAlias.includes('hip_and_ridge') && skirt > 4) {
      const stepsAbove = Math.floor((skirt - 4) / 0.5);
      rawFactor += stepsAbove * 0.17;
    }
  }
  if (adjustments.pitch && pitch) {
    rawFactor += pitch > 0 ? 0.15 * pitch : 0;
  }

  const adjustedFactor = round4(rawFactor);
  const tieredFactor = round4(adjustedFactor * tierMultiplier);
  const finalPrice = round2(tieredFactor * (parseFloat(length) + parseFloat(width)));

  // ✅ Unified structured response
  const result = {
    product,
    metalType: metal,
    length: parseFloat(length),
    width: parseFloat(width),
    skirt: parseFloat(skirt || 0),
    screen: parseFloat(screen || 0),
    overhang: parseFloat(overhang || 0),
    inset: parseFloat(inset || 0),
    pitch: parseFloat(pitch || 0),
    holes: parseInt(input.holes || 0, 10),
    unsquare: !!input.unsquare,
    base_price: round2(factor),         // consistent with Chase Cover
    adjustedFactor,                     // after adjustments, before tier
    tierMultiplier,
    tier,
    finalPrice
  };

  console.log('💰 Calculated Multi-Flue Price:', result);
  return result;
}

module.exports = { calculateMultiPrice };
