// pricing/calculateShroud.js — unified logic using config/shroudUnified
const { metals, aliasIndex } = require('../config/shroudUnified');

let tierCfg = {};
try {
  // Supports either { tiers:{...} } or { elite:1, vg:1.11969, ... }
  tierCfg = require('../config/tier_pricing_factors');
} catch {
  // default to 1.0 if file not present
}

const TIER_ALIAS = {
  elite: 'elite',
  value: 'val',
  'value-gold': 'vg',
  'value-silver': 'vs',
  builder: 'bul',
  homeowner: 'ho',
  val: 'val',
  vg: 'vg',
  vs: 'vs',
  bul: 'bul',
  ho: 'ho'
};

function resolveTierAndFactor(tierInput) {
  const raw = (tierInput || 'elite').toString().toLowerCase();
  const short = TIER_ALIAS[raw] || raw;

  const table = (tierCfg && typeof tierCfg === 'object')
    ? (tierCfg.tiers && typeof tierCfg.tiers === 'object' ? tierCfg.tiers : tierCfg)
    : {};

  const tryKeys = [short, raw, 'elite'];
  let factor = 1.0;
  for (const k of tryKeys) {
    const v = table[k];
    if (v != null && !Number.isNaN(+v)) { factor = +v; break; }
  }
  return { tierKey: short, factor };
}

function pickMetalKey(metalKey, metalTypeKey) {
  const candidates = [metalKey, metalTypeKey].filter(Boolean).map(s => s.toLowerCase());
  for (const c of candidates) {
    const key = aliasIndex[c] || c; // e.g., ss24pol → stainless
    if (metals[key]) return key;
  }
  return null;
}

function calculateShroud(input) {
  // Accept both app-style fields and API-style fields
  const lengthIn = input.length ?? input.lengthVal;
  const widthIn  = input.width  ?? input.widthVal;
  const modelIn  = input.model  ?? input.product;

  const { metal, metalType, tier } = input || {};

  if (!metal && !metalType) return { error: 'Missing metal/metalType' };
  if (!modelIn) return { error: 'Missing model/product' };
  if (lengthIn == null || widthIn == null) return { error: 'Missing length/width' };

  const L = Number(lengthIn);
  const W = Number(widthIn);

  const metalKey = pickMetalKey(metal, metalType);
  if (!metalKey) return { error: `Unsupported metal type for shroud rules: ${metal || metalType}` };

  const config = metals[metalKey];
  const rules  = config.rules  || {};
  const prices = config.prices || {};

  const modelKey = (modelIn || '').toString().trim().toLowerCase();
  const { tierKey, factor } = resolveTierAndFactor(tier);

  // Copper: perimeter-based
  if (metalKey === 'copper') {
    const perimeter = (L + W) * 2 + 2;
    const match = (rules.perimeterRules || []).find(r => perimeter < r.max);

    if (!match) {
      return {
        metal: metalKey,
        model: modelKey,
        perimeter,
        sizeCategory: 'N/A',
        price: 'DESIGN',
        tier: tierKey,
        adjustedFactor: +factor.toFixed(4),
        message: 'Office to Price'
      };
    }

    const size = match.size;
    const base = prices[modelKey]?.[size] ?? 'DESIGN';
    const final = typeof base === 'number' ? +(base * factor).toFixed(2) : base;

    return {
      metal: metalKey,
      model: modelKey,
      perimeter,
      sizeCategory: size,
      price: base,
      tier: tierKey,
      adjustedFactor: +factor.toFixed(4),
      finalPrice: typeof final === 'number' ? final : undefined,
      message: base === 'DESIGN' ? 'Office to Price' : 'Price found'
    };
  }

  // Non-copper: L+W+1 size cutoffs
  const total = L + W + 1;
  const order = ['small', 'medium', 'large', 'small_tall', 'large_tall'];
  let sizeCategory = null;

  for (const size of order) {
    if (rules.restricted?.includes(size)) continue;
    const max = rules.sizeCutoffs?.[size];
    if (max == null) continue;
    if (total < max) { sizeCategory = size; break; }
  }

  if (!sizeCategory) {
    return {
      metal: metalKey,
      model: modelKey,
      sizeCategory: 'N/A',
      price: 'DESIGN',
      tier: tierKey,
      adjustedFactor: +factor.toFixed(4),
      message: 'Too large or not allowed'
    };
  }

  const base = prices[modelKey]?.[sizeCategory] ?? 'DESIGN';
  const final = typeof base === 'number' ? +(base * factor).toFixed(2) : base;

  return {
    metal: metalKey,
    model: modelKey,
    sizeCategory,
    price: base,
    tier: tierKey,
    adjustedFactor: +factor.toFixed(4),
    finalPrice: typeof final === 'number' ? final : undefined,
    message: base === 'DESIGN' ? 'Office to Price' : 'Price found'
  };
}

module.exports = { calculateShroud }; // <<— named export to match your destructured import
