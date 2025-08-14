// pricing/calculateShroud.js — unified logic + overrides support
const path = require('path');

let tierCfg = {};
try { tierCfg = require('../config/tier_pricing_factors'); } catch {}

const TIER_ALIAS = {
  elite:'elite', value:'val', 'value-gold':'vg', 'value-silver':'vs',
  builder:'bul', homeowner:'ho', val:'val', vg:'vg', vs:'vs', bul:'bul', ho:'ho'
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

// ----- base + overrides loader -----
function loadBase() {
  try { delete require.cache[require.resolve('../config/shroudUnified')]; } catch {}
  return require('../config/shroudUnified');
}
function loadOverrides() {
  const p = path.join(__dirname, '../config/shroud_overrides.json');
  try { delete require.cache[p]; } catch {}
  try { return require(p); } catch { return {}; }
}
function mergeMetals() {
  const { metals, aliasIndex } = loadBase();
  const ov = loadOverrides();

  // deep merge only prices
  const out = JSON.parse(JSON.stringify(metals || {}));
  for (const m of Object.keys(ov || {})) {
    out[m] = out[m] || {};
    out[m].prices = out[m].prices || {};
    const mPrices = ov[m]?.prices || {};
    for (const model of Object.keys(mPrices)) {
      out[m].prices[model] = { ...(out[m].prices[model] || {}), ...(mPrices[model] || {}) };
    }
  }
  return { metals: out, aliasIndex };
}

// alias support unchanged
function pickMetalKey(metalKey, metalTypeKey, aliasIndex) {
  const candidates = [metalKey, metalTypeKey].filter(Boolean).map(s => s.toLowerCase());
  for (const c of candidates) {
    const key = aliasIndex[c] || c;
    if (key && key in merged.metals) return key;
  }
  return null;
}

function calculateShroud(input) {
  const merged = mergeMetals();
  const { metals, aliasIndex } = merged;

  const lengthIn = input.length ?? input.lengthVal;
  const widthIn  = input.width  ?? input.widthVal;
  const modelIn  = input.model  ?? input.product;

  const { metal, metalType, tier } = input || {};

  if (!metal && !metalType) return { error: 'Missing metal/metalType' };
  if (!modelIn) return { error: 'Missing model/product' };
  if (lengthIn == null || widthIn == null) return { error: 'Missing length/width' };

  const L = Number(lengthIn);
  const W = Number(widthIn);

  // resolve canonical metal key (e.g., ss24pol -> stainless)
  const candidates = [metal, metalType].filter(Boolean).map(s => s.toLowerCase());
  let metalKey = null;
  for (const c of candidates) {
    const k = aliasIndex[c] || c;
    if (metals[k]) { metalKey = k; break; }
  }
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
      return { metal: metalKey, model: modelKey, perimeter, sizeCategory: 'N/A', price: 'DESIGN',
               tier: tierKey, adjustedFactor: +factor.toFixed(4), message: 'Office to Price' };
    }

    const size = match.size;
    const base = prices[modelKey]?.[size] ?? 'DESIGN';
    const final = typeof base === 'number' ? +(base * factor).toFixed(2) : base;

    return { metal: metalKey, model: modelKey, perimeter, sizeCategory: size, price: base,
             tier: tierKey, adjustedFactor: +factor.toFixed(4),
             finalPrice: typeof final === 'number' ? final : undefined,
             message: base === 'DESIGN' ? 'Office to Price' : 'Price found' };
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
    return { metal: metalKey, model: modelKey, sizeCategory: 'N/A', price: 'DESIGN',
             tier: tierKey, adjustedFactor: +factor.toFixed(4), message: 'Too large or not allowed' };
  }

  const base = prices[modelKey]?.[sizeCategory] ?? 'DESIGN';
  const final = typeof base === 'number' ? +(base * factor).toFixed(2) : base;

  return { metal: metalKey, model: modelKey, sizeCategory, price: base,
           tier: tierKey, adjustedFactor: +factor.toFixed(4),
           finalPrice: typeof final === 'number' ? final : undefined,
           message: base === 'DESIGN' ? 'Office to Price' : 'Price found' };
}

module.exports = { calculateShroud };
