// pricing/calculateChaseCover.js
// Tiered grid pricing for Chase Covers with admin overrides support.
// This module reads the base matrix and merges in /config/chase_overrides.json
// at request-time so Admin edits take effect without a server restart.

const fs = require('fs');
const path = require('path');

// Path constants
const MATRIX_PATH = path.resolve(__dirname, '../config/chaseCoverMatrix.js');
const OVERRIDES_PATH = path.resolve(__dirname, '../config/chase_overrides.json');

// Lazily load a fresh copy of the base matrix each call (cheap, small file)
function loadBaseMatrixFresh() {
  try {
    delete require.cache[require.resolve(MATRIX_PATH)];
  } catch {}
  // matrix[tier][metal][size] => { basePrice:number, dimensions:[{skirt,maxLength,maxWidth}] }
  return require(MATRIX_PATH);
}

function readOverrides() {
  try {
    const raw = fs.readFileSync(OVERRIDES_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// Apply price overrides into a deep-cloned matrix while preserving dimensions
function mergePriceOverrides(matrix, overridesPrices = {}) {
  const out = JSON.parse(JSON.stringify(matrix));
  for (const [tier, metals] of Object.entries(overridesPrices || {})) {
    if (!out[tier]) out[tier] = {};
    for (const [metal, sizes] of Object.entries(metals || {})) {
      if (!out[tier][metal]) out[tier][metal] = {};
      for (const [size, price] of Object.entries(sizes || {})) {
        if (!out[tier][metal][size]) {
          out[tier][metal][size] = { basePrice: Number(price) || 0, dimensions: [] };
        } else {
          out[tier][metal][size].basePrice = Number(price);
        }
      }
    }
  }
  return out;
}

const DEFAULT_ADDONS = {
  hole: { black_kynar: 25, stainless: 45 },
  unsquare: { black_kynar: 60, stainless: 85 },
};

function mergeAddons(overridesAddons = {}) {
  // shallow merge; both trees are tiny
  const merged = JSON.parse(JSON.stringify(DEFAULT_ADDONS));
  for (const k1 of Object.keys(overridesAddons || {})) {
    merged[k1] = merged[k1] || {};
    const sub = overridesAddons[k1] || {};
    for (const k2 of Object.keys(sub)) {
      const v = Number(sub[k2]);
      if (Number.isFinite(v)) merged[k1][k2] = v;
    }
  }
  return merged;
}

function metalGroupForAddons(metalKey = '') {
  const m = String(metalKey).toLowerCase();
  // Treat painted steels as black/kynar; stainless as stainless
  const blackish = ['black_galvanized', 'kynar', 'g90', 'painted', 'galvanized', 'black'];
  const stainlessish = ['ss24pol', 'ss26mil', 'stainless', 'stainless_24', 'stainless_26'];
  if (stainlessish.some(x => m.includes(x))) return 'stainless';
  if (blackish.some(x => m.includes(x))) return 'black_kynar';
  if (m.startsWith('ss')) return 'stainless'; // fallback
  return 'black_kynar';
}

// Given metalData[size].dimensions and input S, pick the row whose `skirt` is the first >= S.
// If none, take the last. Return {maxLength,maxWidth}
function dimsForSkirt(dimensions = [], skirtVal = 0) {
  if (!Array.isArray(dimensions) || dimensions.length === 0) {
    return { maxLength: Infinity, maxWidth: Infinity };
  }
  let row = dimensions.find(d => d.skirt >= skirtVal);
  if (!row) row = dimensions[dimensions.length - 1];
  return { maxLength: Number(row.maxLength), maxWidth: Number(row.maxWidth) };
}

// Decide which size bucket the job fits into (small → extra_large)
const SIZE_ORDER = ['small', 'medium', 'large_no_seam', 'large_seam', 'extra_large'];
function resolveSizeCategory(metalData, L, W, S) {
  for (const size of SIZE_ORDER) {
    const entry = metalData[size];
    if (!entry) continue;
    const { maxLength, maxWidth } = dimsForSkirt(entry.dimensions, S);
    if (L <= maxLength && W <= maxWidth) {
      return { size, basePrice: Number(entry.basePrice) };
    }
  }
  return null;
}

/**
 * calculateChaseCover
 * @param {object} input - expected: { lengthVal, widthVal, skirtVal, metalType, unsquare?, holeCount? }
 * @param {string} tierKey - normalized tier key ('elite' | 'value' | 'gold' | 'silver' | 'builder' | 'homeowner')
 */
function calculateChaseCover(input, tierKey = 'elite') {
  const {
    lengthVal,
    widthVal,
    skirtVal,
    metalType,
    unsquare = false,
    holeCount = 0,
  } = input || {};

  const L = Number(lengthVal);
  const W = Number(widthVal);
  const S = Number(skirtVal);
  const H = Number(holeCount) || 0;
  const metalKey = String(metalType || '').toLowerCase();

  // Logging hint (your logger wrapper can pick this up)
  try {
    console.log('📩 Calculating Chase Cover:', { L, W, S, metalKey, U: !!unsquare, H, tierKey });
  } catch {}

  if (!Number.isFinite(L) || !Number.isFinite(W) || !Number.isFinite(S) || !metalKey) {
    return { error: 'Missing or invalid required fields for chase cover calculation' };
  }

  // Load data (base + overrides) fresh each call
  const base = loadBaseMatrixFresh();
  const { prices: ovPrices, addons: ovAddons } = readOverrides();
  const matrix = mergePriceOverrides(base, ovPrices);
  const addons = mergeAddons(ovAddons);

  const tierSlice = matrix[tierKey];
  if (!tierSlice) return { error: `Unsupported tier: ${tierKey}` };

  const metalData = tierSlice[metalKey];
  if (!metalData) return { error: `Unsupported metal: ${metalKey}` };

  const resolved = resolveSizeCategory(metalData, L, W, S);
  if (!resolved) {
    return { error: 'Requested dimensions exceed available size categories for selected skirt.' };
  }

  const { size: sizeCategory, basePrice } = resolved;

  // --- Add-ons ---
  const group = metalGroupForAddons(metalKey); // 'black_kynar' or 'stainless'
  const holeCharge = addons.hole?.[group];
  const unsqCharge = addons.unsquare?.[group];

  const addOnBreakdown = {};
  let addOns = 0;

  if (Number.isFinite(holeCharge) && H > 0) {
    addOnBreakdown.holes = +(H * holeCharge).toFixed(2);
    addOns += addOnBreakdown.holes;
  }
  if (unsquare && Number.isFinite(unsqCharge)) {
    addOnBreakdown.unsquare = +unsqCharge.toFixed(2);
    addOns += addOnBreakdown.unsquare;
  }

  const finalPrice = +(Number(basePrice) + addOns).toFixed(2);

  return {
    metal: metalKey,
    tier: tierKey,
    sizeCategory,
    base_price: Number(basePrice),
    add_ons: addOns,
    add_on_breakdown: addOnBreakdown,
    final_price: finalPrice,
    message: 'Price calculated',
  };
}

module.exports = { calculateChaseCover };
