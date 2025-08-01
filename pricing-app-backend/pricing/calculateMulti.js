// calculateMulti.js
// Multi-Flue Pricing Engine with full logging and flat pitch rules

function calculateMultiPrice(payload, adjustments = {}, baseFactor = 0, tierMultiplier = 1, tier = 'elite') {
  const {
    lengthVal = 0,
    widthVal = 0,
    screenVal = 0,
    overhangVal = 0,
    insetVal = 0,
    skirtVal = 0,
    pitchVal = 0,
  } = payload;

  // Ensure adjustments is always an object
  const adj = adjustments || {};

  let adjustedFactor = baseFactor;
  const adjustmentLog = [];

  // ✅ Skirt Adjustment
  if (adj.skirt) {
    const diff = skirtVal - adj.skirt.standard;
    if (diff !== 0) {
      const steps = Math.floor(Math.abs(diff) / adj.skirt.interval);
      const add = steps * adj.skirt.rate * (diff > 0 ? 1 : -1);
      adjustedFactor += add;
      adjustmentLog.push(`skirt: ${add > 0 ? '+' : ''}${add.toFixed(2)}`);
    }
  }

  // ✅ Inset Adjustment
  if (adj.inset) {
    const diff = insetVal - adj.inset.standard;
    if (diff !== 0) {
      const steps = Math.floor(Math.abs(diff) / adj.inset.interval);
      const add = steps * adj.inset.rate * (diff > 0 ? 1 : -1);
      adjustedFactor += add;
      adjustmentLog.push(`inset: ${add > 0 ? '+' : ''}${add.toFixed(2)}`);
    }
  }

  // ✅ Screen Adjustment (allow negative)
  if (adj.screen) {
    const diff = screenVal - adj.screen.standard;
    if (diff !== 0) {
      const steps = Math.floor(Math.abs(diff) / adj.screen.interval);
      const add = steps * adj.screen.rate * (diff > 0 ? 1 : -1);
      adjustedFactor += add;
      adjustmentLog.push(`screen: ${add > 0 ? '+' : ''}${add.toFixed(2)}`);
    }
  }

  // ✅ Overhang Adjustment (allow negative)
  if (adj.overhang) {
    const diff = overhangVal - adj.overhang.standard;
    if (diff !== 0) {
      const steps = Math.floor(Math.abs(diff) / adj.overhang.interval);
      const add = steps * adj.overhang.rate * (diff > 0 ? 1 : -1);
      adjustedFactor += add;
      adjustmentLog.push(`overhang: ${add > 0 ? '+' : ''}${add.toFixed(2)}`);
    }
  }

  // ✅ Pitch Adjustment (Flat Rules)
  if (adj.pitch) {
    if (pitchVal >= 1 && pitchVal <= 6) {
      adjustedFactor += adj.pitch.below; // usually -0.07
      adjustmentLog.push(`pitch: ${adj.pitch.below}`);
    } else if (pitchVal >= 10 && pitchVal <= 12) {
      adjustedFactor += adj.pitch.above; // usually +0.15
      adjustmentLog.push(`pitch: +${adj.pitch.above}`);
    } else {
      adjustmentLog.push('pitch: 0 (no change)');
    }
  }

  // ✅ Apply tier multiplier
  const tieredFactor = adjustedFactor * tierMultiplier;

  // ✅ Current price formula (Length + Width)
  const price = (lengthVal + widthVal) * tieredFactor;

  // ✅ Log breakdown for debugging
  console.log('📦 Multi-Flue Pricing Calculation');
  console.log('📦 Incoming payload (sanitized):', payload);
  console.log('🧩 Adjustments Object:', adj);
  console.log('🔧 Adjustments Applied:', adjustmentLog.join(', ') || 'none');
  console.log(`💡 Base: ${baseFactor}, Adjusted: ${adjustedFactor}, Tiered: ${tieredFactor}, Price: ${price}`);

  // ✅ Return full breakdown with two-decimal finalPrice
  return {
    ...payload,
    baseFactor,
    adjustedFactor,
    tierMultiplier,
    tieredFactor,
    tier,
    finalPrice: parseFloat(price.toFixed(2)),  // ⬅️ Always two decimals
  };
}

// ✅ Export in CommonJS format
module.exports = { calculateMultiPrice };
