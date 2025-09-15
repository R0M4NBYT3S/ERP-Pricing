// routes/calculate.js — chase cover + multi-flue + shrouds (inline, single-block logs)

const express = require('express');
const router = express.Router();
const { calculateMultiPrice } = require('../pricing/calculateMulti');
const { normalizeMetalType } = require('../utils/normalizeMetal');

// ---------- tiny helpers ----------
const n = (v, d = 2) => (Number.isFinite(+v) ? Number(v).toFixed(d) : String(v ?? ''));
const num = (v) => (Number.isFinite(+v) ? Number(v) : undefined);
const safeNum = (v, fallback = 0) => (Number.isFinite(+v) ? Number(v) : fallback);

// ---- helpers for chase-cover bucket selection ----
let toNum, dimForSkirt, CC_SIZE_ORDER;
try {
  ({ toNum, dimForSkirt, CC_SIZE_ORDER } = require('../config/pricingUtils'));
} catch (_) {}

toNum = toNum || ((v) => Number(v));
CC_SIZE_ORDER = CC_SIZE_ORDER || [
  'small',
  'medium',
  'large_no_seam',
  'large_seam',
  'extra_large'
];

dimForSkirt =
  dimForSkirt ||
  function dimForSkirt(dimensions = [], skirtVal = 0) {
    if (!Array.isArray(dimensions) || dimensions.length === 0) {
      return { maxLength: Infinity, maxWidth: Infinity };
    }
    let row = dimensions.find(d => Number(d.skirt) >= Number(skirtVal));
    if (!row) row = dimensions[dimensions.length - 1];
    return {
      maxLength: Number(row.maxLength),
      maxWidth: Number(row.maxWidth)
    };
  };

function banner(title, body) {
  console.log(
    `\n-----------------------${title}-----------------------\n` +
    body +
    `\n-------------------------------------------------------\n`
  );
}

function loadChaseCoverMatrix() {
  delete require.cache[require.resolve('../config/chaseCoverMatrix')];
  return require('../config/chaseCoverMatrix');
}
function loadMultiFactors() {
  try { delete require.cache[require.resolve('../config/multiFactors.json')]; } catch {}
  try { return require('../config/multiFactors.json'); } catch { return []; }
}
function loadTierTable() {
  try { delete require.cache[require.resolve('../config/tier_pricing_factors')]; } catch {}
  try { return require('../config/tier_pricing_factors'); } catch { return {}; }
}
function loadMultiDiscrepancies() {
  try {
    delete require.cache[require.resolve('../config/multi_discrepancies.js')];
    return require('../config/multi_discrepancies.js');
  } catch {
    return null;
  }
}
function tierToDeltaKey(t) {
  const raw = String(t || 'elite').toLowerCase();
  if (raw === 'value-gold' || raw === 'gold' || raw === 'vg') return 'vg';
  if (raw === 'value-silver' || raw === 'silver' || raw === 'vs') return 'vs';
  if (raw === 'value' || raw === 'val') return 'val';
  return null;
}
function multiDiscrepancyDelta(metalKey, productKey, tierKey) {
  const cfg = loadMultiDiscrepancies();
  if (!cfg) return 0;
  const table = (cfg && typeof cfg === 'object' && cfg.data) ? cfg.data : cfg;
  const m = table?.[metalKey];
  const p = m?.[productKey];
  if (!p || typeof p !== 'object') return 0;
  const k = tierToDeltaKey(tierKey);
  if (!k) return 0;
  const v = Number(p[k]);
  return Number.isFinite(v) ? v : 0;
}

const TIER_ALIAS = {
  elite: 'elite',
  val: 'value', value: 'value',
  vg: 'gold', gld: 'gold', gold: 'gold',
  vs: 'silver', silver: 'silver',
  bul: 'builder', builder: 'builder',
  ho: 'homeowner', homeowner: 'homeowner'
};
function normalizeTierKey(t) {
  const raw = String(t ?? '').trim().toLowerCase();
  return TIER_ALIAS[raw] || 'elite';
}
const TIER_TO_SHORT = {
  elite: 'elite',
  value: 'val',
  'value-gold': 'vg',
  'value-silver': 'vs',
  gold: 'vg',
  silver: 'vs',
  builder: 'bul',
  homeowner: 'ho',
  val: 'val', vg: 'vg', vs: 'vs', bul: 'bul', ho: 'ho'
};
function resolveTierWeight(tierInput) {
  const rawIn = tierInput ?? 'elite';
  const raw = String(rawIn).trim();
  const lc = raw.toLowerCase();
  const candidates = [
    TIER_TO_SHORT[lc] || lc,
    lc,
    (lc === 'gold' ? 'value-gold'
      : lc === 'silver' ? 'value-silver'
      : lc === 'value' ? 'value'
      : undefined),
    'elite'
  ].filter(Boolean);

  const tableRaw = loadTierTable();
  const table = (tableRaw && typeof tableRaw === 'object'
    ? (tableRaw.tiers && typeof tableRaw.tiers === 'object' ? tableRaw.tiers : tableRaw)
    : {}) || {};

  const lut = new Map();
  for (const [k, v] of Object.entries(table)) {
    const num = Number(v);
    if (!Number.isNaN(num)) {
      lut.set(String(k), num);
      lut.set(String(k).toLowerCase(), num);
    }
  }
  for (const key of candidates) {
    const found = lut.get(key) ?? lut.get(String(key).toLowerCase());
    if (Number.isFinite(found)) return found;
  }
  return 1;
}

// ============================================================================
// POST /api/calculate
// ============================================================================
router.post('/', (req, res) => {
  try {
    const isChaseImplicit =
      Number.isFinite(+req.body.L) && Number.isFinite(+req.body.W) &&
      (req.body.metalKey || req.body.metalType || req.body.metal);

    let product   = req.body.product;
    let metalType = normalizeMetalType(req.body.metalType);
    let metal     = normalizeMetalType(req.body.metal) || metalType;
    let tier      = req.body.tier;

    if (!product && !isChaseImplicit) {
      banner('CALC ERROR', `Missing product\nBody keys: ${Object.keys(req.body || {}).join(', ')}`);
      return res.status(400).json({ error: 'Missing product' });
    }

    const lowerProduct = product
      ? String(product).toLowerCase()
      : (isChaseImplicit ? 'chase_cover' : '');

    const productStr = String(product || '').toLowerCase();
    const isShroudModel =
      /^(dynasty|majesty|monaco|royale|durham|monarch|regal|princess|prince|temptress|imperial|centurion|mountaineer)$/
      .test(productStr);
    const isCorbelKeyword = /corbel/.test(productStr);

    let chaseAddOn = 0;
    let chaseDetails = null;

    const wantsChase =
      String(req.body.chaseCover ?? req.body.chase ?? '').toLowerCase() === 'true' ||
      lowerProduct.includes('chase_cover') ||
      lowerProduct.includes('chase cover') ||
      isCorbelKeyword;

    // ---------------------- CHASE COVER / CORBEL ----------------------
    if (wantsChase) {
      try {
        const L = toNum(req.body.L ?? req.body.length);
        const W = toNum(req.body.W ?? req.body.width);
        const S = toNum(req.body.S ?? req.body.skirt) || 0;
        const tierKey = normalizeTierKey(req.body.tier ?? req.body.tierKey ?? tier);

        const rawMetalKey  = String(req.body.metalKey ?? req.body.metalType ?? req.body.metal ?? '').trim().toLowerCase();
        const normMetalKey = normalizeMetalType(rawMetalKey);
        const tryMetals = [];
        if (rawMetalKey) tryMetals.push(rawMetalKey);
        if (normMetalKey && normMetalKey !== rawMetalKey) tryMetals.push(normMetalKey);

        const isCorbel = isCorbelKeyword;

        const holesCount = (() => {
          const raw = req.body.H ?? req.body.holes ?? req.body.holeCount;
          const parsed = Number(raw);
          if (Number.isFinite(parsed) && parsed > 0) return parsed;
          const t = String(req.body.holeType ?? '').toLowerCase().trim();
          if (t === 'offset-multi' || req.body.offsetMultiHole) {
            const mh = Number(req.body.multiHoleCount ?? req.body.count ?? 2);
            return Number.isFinite(mh) && mh > 0 ? mh : 2;
          }
          if (t === 'center' || t === 'single' || t === 'offset') return 1;
          return 1;
        })();

        const unsq = !!(req.body.U ?? req.body.unsquare);
        const nailingFlange = safeNum(req.body.nailingFlange, 0);
        const baseOverhang  = safeNum(req.body.baseOverhang, 0);
        const totalTurndown = +(S + nailingFlange + baseOverhang + 1).toFixed(2);

        if (!Number.isFinite(L) || !Number.isFinite(W)) {
          banner('CHASE COVER ERROR', `BAD_DIMENSIONS\nL:${L} W:${W} S:${S}`);
          return res.status(400).json({ error: 'BAD_DIMENSIONS', details: { L, W, S } });
        }

        const matrix = loadChaseCoverMatrix();
        const tierSlice = matrix && matrix[tierKey];
        if (!tierSlice) {
          banner('CHASE COVER ERROR', `INVALID_TIER\nRequested: ${tierKey}\nAvailable: ${Object.keys(matrix || {}).join(', ')}`);
          return res.status(400).json({ error: 'INVALID_TIER', details: { tierKey, availableTiers: Object.keys(matrix || {}) } });
        }

        let metalNode = null;
        let resolvedMetalKey = null;
        for (const k of tryMetals) {
          if (k && Object.prototype.hasOwnProperty.call(tierSlice, k)) {
            resolvedMetalKey = k;
            metalNode = tierSlice[k];
            break;
          }
        }
        if (!metalNode) {
          banner('CHASE COVER ERROR', `Invalid metal\nRequested: ${rawMetalKey}\nNormalized: ${normMetalKey}\nAvailable: ${Object.keys(tierSlice || {}).join(', ')}`);
          return res.status(400).json({
            error: 'Invalid metal type for chase cover',
            requested: rawMetalKey, normalized: normMetalKey, availableMetals: Object.keys(tierSlice || {})
          });
        }

        const skirtForBucket = isCorbel ? totalTurndown : S;      

        const SIZE_ORDER = ['small','medium','large_no_seam','large_seam','extra_large'];
        const pickDims = (dimensions = [], skirtVal = 0) => {
          const arr = Array.isArray(dimensions) ? dimensions : [];
          if (arr.length === 0) return null;
          let row = arr.find(d => Number(d.skirt) >= Number(skirtVal));
          if (!row) row = arr[arr.length - 1];
          return { maxLength: Number(row.maxLength), maxWidth: Number(row.maxWidth) };
        };

        let sizeCategory = null;
        let basePrice = null;
        for (const cat of SIZE_ORDER) {
          const entry = metalNode?.[cat];
          if (!entry || typeof entry !== 'object' || !('basePrice' in entry)) continue;
          const chosen = pickDims(entry.dimensions, skirtForBucket || 0);
          if (chosen && L <= chosen.maxLength && W <= chosen.maxWidth) {
            sizeCategory = cat;
            basePrice = Number(entry.basePrice);
            break;
          }
        }
        if (!sizeCategory || !Number.isFinite(basePrice)) {
          banner('CHASE COVER ERROR', `SIZE_BUCKET_UNRESOLVED\nL:${L} W:${W} (skirtUsed:${skirtForBucket})\nTier:${tierKey} Metal:${resolvedMetalKey}`);
          return res.status(400).json({
            error: 'SIZE_BUCKET_UNRESOLVED',
            details: { L, W, skirtUsed: skirtForBucket, tierKey, metal: resolvedMetalKey }
          });
        }

        if (Object.prototype.hasOwnProperty.call(req.body, 'tierMul')) delete req.body.tierMul;

        const isPremium = /^(ss|stainless|cop|copper)/i.test(resolvedMetalKey);
        const extraHoles = Math.max(0, holesCount - 1);
        const holesAdj = extraHoles * (isPremium ? 45 : 25);
        const unsqAdj  = unsq ? (isPremium ? 85 : 60) : 0;

        const base_price = Math.round((basePrice + Number.EPSILON) * 100) / 100;
        const final = Math.round((basePrice + holesAdj + unsqAdj + Number.EPSILON) * 100) / 100;

// >>> POWDERCOAT (CHASE): 30% bump if stainless
console.log("💥 POWDERCOAT CHECK (chase):", {
  powdercoat: req.body.powdercoat,
  metal: resolvedMetalKey,
  regexMatched: /(ss|stainless)/i.test(resolvedMetalKey),
  finalPriceBefore: final
});

let adjustedFinal = final;
if (req.body.powdercoat && /(ss|stainless)/i.test(resolvedMetalKey)) {
  const bumped = +(adjustedFinal * 1.3).toFixed(2);
  adjustedFinal = bumped;
  console.log("✅ POWDERCOAT APPLIED (chase):", { bumped });
}


        banner('CHASE COVER', [
          `Metal: ${resolvedMetalKey}`,
          `Length: ${n(L)} Width: ${n(W)} Skirt: ${n(S)}`,
          `Hole Count: ${holesCount} Adj: ${n(holesAdj)}`,
          `Unsquare: ${unsq ? 'Yes' : 'No'} Adj: ${n(unsqAdj)}`,
          `Size Category: ${sizeCategory}`,
          `Tier: ${tierKey}`,
          `Final Price: ${n(adjustedFinal)}`
        ].join('\n'));

        chaseAddOn = adjustedFinal;
        chaseDetails = {
          product: 'chase_cover',
          tier: tierKey,
          metalType: resolvedMetalKey,
          metal: resolvedMetalKey,
          sizeCategory,
          base_price,
          holes: holesCount,
          unsquare: !!unsq,
          finalPrice: adjustedFinal,
          price: adjustedFinal
        };

        if (!isShroudModel) {
          return res.json(chaseDetails);
        }
      } catch (err) {
        console.error('CHASE COVER ERROR:', err);
        return res.status(500).json({ error: 'CHASE_COVER', message: err.message });
      }
    }

    // ---------------------- SHROUDS ----------------------
    if ((lowerProduct.includes('shroud') || isShroudModel) && !/corbel/.test(productStr)) {
      try {
        delete require.cache[require.resolve('../pricing/calculateShroud')];
        const { calculateShroud } = require('../pricing/calculateShroud');

        const payload = {
          ...req.body,
          model: req.body.model ?? req.body.product ?? productStr,
          metal: metal || req.body.metal,
          metalType: metalType || req.body.metalType,
          tier: tier || req.body.tier,
          length: req.body.length ?? req.body.L,
          width:  req.body.width  ?? req.body.W
        };

        const out = calculateShroud(payload);
        if (out && out.error) {
          banner('SHROUD ERROR', `${out.error}`);
          return res.status(400).json(out);
        }

        const priceNum = Number(out?.finalPrice ?? out?.final_price ?? out?.price);
        const result = {
          ...out,
          product: out?.model ?? productStr,
          metal: out?.metal ?? (metal || metalType),
          tier: out?.tier ?? (tier || 'elite'),
        };
        if (Number.isFinite(priceNum)) {
          result.finalPrice = +priceNum.toFixed(2);
          result.price = +priceNum.toFixed(2);
        }

// >>> POWDERCOAT (SHROUD): 30% bump if stainless
console.log("💥 POWDERCOAT CHECK (shroud):", {
  powdercoat: req.body.powdercoat,
  metal: result.metal,
  regexMatched: /(ss|stainless)/i.test(result.metal),
  finalPriceBefore: result.finalPrice
});

if (req.body.powdercoat && /(ss|stainless)/i.test(result.metal)) {
  const bumped = +(result.finalPrice * 1.3).toFixed(2);
  result.finalPrice = bumped;
  result.price = bumped;
  if (result.printout) {
    result.printout.total = `Total Price (with Powdercoat): ${bumped.toFixed(2)}`;
  }
  console.log("✅ POWDERCOAT APPLIED (shroud):", { bumped });
}



        return res.json(result);
      } catch (e) {
        banner('SHROUD EXCEPTION', String(e?.message || e));
        return res.status(500).json({ error: 'Shroud calculation failed' });
      }
    }

    // ---------------------- MULTI-FLUE ----------------------
    if (lowerProduct.includes('flat_top') || lowerProduct.includes('hip') || lowerProduct.includes('ridge')) {
      const metalType2 = normalizeMetalType(req.body.metalType || req.body.metal);
      const tierKey = normalizeTierKey(tier);

      const factorRow = (loadMultiFactors() || []).find(f =>
        String(f.metal).toLowerCase() === metalType2 &&
        String(f.product).toLowerCase() === lowerProduct &&
        String(f.tier || 'elite').toLowerCase() === 'elite'
      );
      if (!factorRow) {
        return res.status(400).json({ error: `No factor found for ${lowerProduct} (${metalType2})` });
      }

      const rawBaseFactor = factorRow.factor || 0;
      const delta = multiDiscrepancyDelta(metalType2, lowerProduct, tierKey);
      const baseFactor = +(rawBaseFactor + delta).toFixed(4);

      const adjustments = factorRow.adjustments || {};
      const tierWeight = resolveTierWeight(tierKey);

      const input = {
        lengthVal: safeNum(req.body.length, safeNum(req.body.L)),
        widthVal: safeNum(req.body.width, safeNum(req.body.W)),
        screenVal: safeNum(req.body.screenHeight, safeNum(req.body.screen)),
        overhangVal: safeNum(req.body.lidOverhang, safeNum(req.body.overhang)),
        insetVal: safeNum(req.body.inset),
        skirtVal: safeNum(req.body.skirt),
        pitchVal: safeNum(req.body.pitch),
        holes: safeNum(req.body.holes),
        unsquare: !!req.body.unsquare,
        metalType: metalType2,
        metal: metalType2,
        product: lowerProduct,
        tier: tierKey
      };

      const out = calculateMultiPrice(
        { ...input },
        adjustments,
        baseFactor,
        tierWeight,
        tierKey
      );

      const priceNum = Number(out?.finalPrice ?? out?.final_price);
      const result = Number.isFinite(priceNum)
        ? { ...out, product: lowerProduct, tier: tierKey, metal: metalType2, finalPrice: +priceNum.toFixed(2), price: +priceNum.toFixed(2) }
        : { ...out, product: lowerProduct, tier: tierKey, metal: metalType2 };

// >>> POWDERCOAT (MULTIFLUE): 30% bump AFTER tier multiplier
console.log("💥 POWDERCOAT CHECK (multi):", {
  powdercoat: req.body.powdercoat,
  metalType2,
  regexMatched: /(ss|stainless)/i.test(metalType2),
  finalPriceBefore: result.finalPrice
});

if (req.body.powdercoat && /(ss|stainless)/i.test(metalType2)) {
  const bumped = +(result.finalPrice * 1.3).toFixed(2);
  result.finalPrice = bumped;
  result.price = bumped;

  // update printout if it exists
  if (result.printout) {
    result.printout.total = `Total Price (with Powdercoat): ${bumped.toFixed(2)}`;
  }

  console.log("✅ POWDERCOAT APPLIED:", { bumped });
}


      return res.json(result);
    }

    return res.status(400).json({ error: 'Unknown product type', product });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
