// Multi-Flue Pricing Engine with full logging and safe guards
// Drop-in replacement for ../pricing/calculateMulti.js
// Exports: { calculateMultiPrice(payload, adjustments, baseFactor, tierMultiplier, tier) }

function toNum(x, def = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function safeSteps(diff, interval) {
  const d = Math.abs(toNum(diff, 0));
  const i = toNum(interval, 0);
  if (!(i > 0)) return 0;
  return Math.floor(d / i);
}

function calculateMultiPrice(payload, adjustments = {}, baseFactor = 0, tierMultiplier = 1, tier = 'elite') {
  // normalize inputs
  const lengthVal   = toNum(payload?.lengthVal, 0);
  const widthVal    = toNum(payload?.widthVal, 0);
  const screenVal   = toNum(payload?.screenVal, 0);
  const overhangVal = toNum(payload?.overhangVal, 0);
  const insetVal    = toNum(payload?.insetVal, 0);
  const skirtVal    = toNum(payload?.skirtVal, 0);
  const pitchVal    = toNum(payload?.pitchVal, 0);

  const product = String(payload?.product || '');
  const metal   = String(payload?.metal || payload?.metalType || '');
  const isCorbel = /corbel/i.test(product);

  const adj = adjustments || {};
  let adjustedFactor = toNum(baseFactor, 0);
  const adjustmentLog = [];

  // For transparency, log the adjustments object once
  try {
    console.log('🧩 Adjustments Object:', JSON.stringify(adj, null, 2));
  } catch {}

  // ---- INSET ---- (skip for corbel or invalid interval/rate)
  if (!isCorbel && adj.inset && adj.inset.interval > 0 && toNum(adj.inset.rate, 0) !== 0) {
    const diff  = insetVal - toNum(adj.inset.standard, 0);
    if (diff !== 0) {
      const steps = safeSteps(diff, adj.inset.interval);
      const add   = steps * toNum(adj.inset.rate, 0) * (diff > 0 ? 1 : -1);
      adjustedFactor += add;
      adjustmentLog.push(`inset: ${add >= 0 ? '+' : ''}${add.toFixed(2)}`);
    } else {
      adjustmentLog.push('inset: 0');
    }
  } else {
    if (!isCorbel) adjustmentLog.push('inset: 0 (skipped)');
  }

  // ---- SCREEN ----
  if (adj.screen && adj.screen.interval > 0 && toNum(adj.screen.rate, 0) !== 0) {
    const diff  = screenVal - toNum(adj.screen.standard, 0);
    if (diff !== 0) {
      const steps = safeSteps(diff, adj.screen.interval);
      const add   = steps * toNum(adj.screen.rate, 0) * (diff > 0 ? 1 : -1);
      adjustedFactor += add;
      adjustmentLog.push(`screen: ${add >= 0 ? '+' : ''}${add.toFixed(2)}`);
    } else {
      adjustmentLog.push('screen: 0');
    }
  } else {
    adjustmentLog.push('screen: 0 (skipped)');
  }

  // ---- OVERHANG ----
  if (adj.overhang && adj.overhang.interval > 0 && toNum(adj.overhang.rate, 0) !== 0) {
    const diff  = overhangVal - toNum(adj.overhang.standard, 0);
    if (diff !== 0) {
      const steps = safeSteps(diff, adj.overhang.interval);
      const add   = steps * toNum(adj.overhang.rate, 0) * (diff > 0 ? 1 : -1);
      adjustedFactor += add;
      adjustmentLog.push(`overhang: ${add >= 0 ? '+' : ''}${add.toFixed(2)}`);
    } else {
      adjustmentLog.push('overhang: 0');
    }
  } else {
    adjustmentLog.push('overhang: 0 (skipped)');
  }

  // ---- SKIRT ---- (skip for corbel per your rule)
  if (!isCorbel && adj.skirt && adj.skirt.interval > 0 && toNum(adj.skirt.rate, 0) !== 0) {
    const diff  = skirtVal - toNum(adj.skirt.standard, 0);
    if (diff !== 0) {
      const steps = safeSteps(diff, adj.skirt.interval);
      const add   = steps * toNum(adj.skirt.rate, 0) * (diff > 0 ? 1 : -1);
      adjustedFactor += add;
      adjustmentLog.push(`skirt: ${add >= 0 ? '+' : ''}${add.toFixed(2)}`);
    } else {
      adjustmentLog.push('skirt: 0');
    }
  } else if (!isCorbel) {
    adjustmentLog.push('skirt: 0 (skipped)');
  }

  // ---- CORBEL EXTRA ----
  if (isCorbel) {
    const sumCOS = insetVal + overhangVal + skirtVal;
    if (sumCOS > 9) {
      adjustedFactor += 0.15;
      adjustmentLog.push('corbel(>9): +0.15');
    } else {
      adjustmentLog.push('corbel(<=9): +0');
    }
  }

  // ---- PITCH ----
  // Flat rule: if pitchVal < 12 => below; if > 12 => above; exactly 12 => 0
  if (adj.pitch && (toNum(adj.pitch.below, 0) || toNum(adj.pitch.above, 0))) {
    let add = 0;
    if (pitchVal < 12) add = toNum(adj.pitch.below, 0);
    else if (pitchVal > 12) add = toNum(adj.pitch.above, 0);
    adjustedFactor += add;
    adjustmentLog.push(`pitch: ${add >= 0 ? '+' : ''}${add.toFixed(2)}`);
  } else {
    adjustmentLog.push('pitch: +0');
  }

  // Guard final numeric values
  if (!Number.isFinite(adjustedFactor)) adjustedFactor = 0;

  // Tier application
  const tm = toNum(tierMultiplier, 1);
  const tieredFactor = adjustedFactor * (Number.isFinite(tm) && tm > 0 ? tm : 1);

  // Price formula for multi: (L + W) * tieredFactor
  const price = (lengthVal + widthVal) * tieredFactor;

  // Emit a compact log line mirroring your format
  try {
    console.log(`🔧 Adjustments Applied: ${adjustmentLog.join(', ')} [sum=${(insetVal + overhangVal + skirtVal)}]`);
    console.log(`💡 Base: ${toNum(baseFactor,0)}, Adjusted: ${Number.isFinite(adjustedFactor) ? adjustedFactor.toFixed(2) : 'NaN'}, Tiered: ${Number.isFinite(tieredFactor) ? tieredFactor.toFixed(4) : 'NaN'}, Price: ${Number.isFinite(price) ? price.toFixed(2) : 'NaN'}`);
  } catch {}

  return {
    ...payload,
    metal,
    product,
    baseFactor: toNum(baseFactor, 0),
    adjustedFactor: Number.isFinite(adjustedFactor) ? +adjustedFactor.toFixed(2) : NaN,
    tierMultiplier: tm,
    tieredFactor: Number.isFinite(tieredFactor) ? +tieredFactor.toFixed(4) : NaN,
    tier,
    finalPrice: Number.isFinite(price) ? +price.toFixed(2) : NaN,
  };
}

module.exports = { calculateMultiPrice };
