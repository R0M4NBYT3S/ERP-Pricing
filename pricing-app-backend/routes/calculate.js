// routes/calculate.js — chase cover + multi-flue + shrouds (inline, single-block logs)

const express = require('express');
const router = express.Router();

const { calculateMultiPrice } = require('../pricing/calculateMulti');
const { normalizeMetalType } = require('../utils/normalizeMetal');

// ---------- tiny helpers ----------
const n = (v, d = 2) => (Number.isFinite(+v) ? Number(v).toFixed(d) : String(v ?? ''));
const num = (v) => (Number.isFinite(+v) ? Number(v) : undefined);
const safeNum = (v, fallback = 0) => (Number.isFinite(+v) ? Number(v) : fallback);

// pretty single-block printer
function banner(title, body) {
  console.log(
    `\n-----------------------${title}-----------------------\n` +
    body +
    `\n-------------------------------------------------------\n`
  );
}

// hot loaders
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

// tier normalization + weight
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

// map display/raw to short codes used in tier_pricing_factors
const TIER_TO_SHORT = {
  elite: 'elite',
  value: 'val',
  'value-gold': 'vg',
  'value-silver': 'vs',
  builder: 'bul',
  homeowner: 'ho',
  // already-short forms:
  val: 'val', vg: 'vg', vs: 'vs', bul: 'bul', ho: 'ho'
};
// also try long-form keys if the table uses them
const TIER_LONG = {
  gold: 'value-gold',
  silver: 'value-silver',
  value: 'value'
};
// short/long-key aware tier factor resolver
function resolveTierWeight(tierInput) {
  const raw = String(tierInput || 'elite').toLowerCase(); // e.g., "gold"
  const short = TIER_TO_SHORT[raw] || raw;                 // -> "vg"
  const longForm = TIER_LONG[raw];                         // -> "value-gold" (maybe)

  const tableRaw = loadTierTable();
  const table = (tableRaw && typeof tableRaw === 'object')
    ? (tableRaw.tiers && typeof tableRaw.tiers === 'object' ? tableRaw.tiers : tableRaw)
    : {};

  const candidates = [short, raw, longForm, 'elite'].filter(Boolean);
  for (const k of candidates) {
    const v = table[k];
    if (v != null && !Number.isNaN(+v)) return +v;
  }
  return 1;
}

// chase cover helpers
const CC_SIZE_ORDER = ['small', 'medium', 'large_no_seam', 'large_seam', 'extra_large'];
function dimForSkirt(dimensions, S) {
  const arr = Array.isArray(dimensions) ? dimensions : [];
  if (!Number.isFinite(S)) return arr[0] || null;
  let pick = null;
  for (const d of arr) { if (S >= d.skirt) pick = d; else break; }
  return pick || arr[arr.length - 1] || null;
}
function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : undefined; }

// health
router.get('/_health', (_req, res) => res.json({ ok: true }));

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

    // model & keyword detectors
    const productStr = String(product || '').toLowerCase();
    const isShroudModel =
      /^(dynasty|majesty|monaco|royale|durham|monarch|regal|princess|prince|temptress|imperial|centurion|mountaineer)$/
      .test(productStr);
    const isCorbelKeyword = /corbel/.test(productStr);

    // ---------------------- CHASE COVER / CORBEL (route corbel here) ----------------------
    if (
      lowerProduct.includes('chase_cover') ||
      lowerProduct.includes('chase cover') ||
      isChaseImplicit ||
      isCorbelKeyword // ← ensure "corbel" products are handled as chase cover
    ) {
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

      const holesCount = Number(req.body.H ?? req.body.holes) || 1;
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

      // IMPORTANT: for CORBEL, bucket selection uses TOTAL TURNDOWN as "skirt"
      const skirtForBucket = isCorbel ? totalTurndown : S;

      let sizeCategory = null;
      let basePrice = null;
      for (const cat of CC_SIZE_ORDER) {
        const entry = metalNode[cat];
        if (!entry || typeof entry !== 'object' || !('basePrice' in entry)) continue;
        const chosen = dimForSkirt(entry.dimensions, skirtForBucket || 0);
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

      // single block (two variants)
      if (!isCorbel) {
        banner('CHASE COVER', [
          `Metal: ${resolvedMetalKey}`,
          `Length: ${n(L)}\nWidth: ${n(W)}\nSkirt: ${n(S)}`,
          `Hole Count: ${holesCount}                        Adjustment: ${n(holesAdj)}`,
          `Unsquare: ${unsq ? 'Yes' : 'No'}                     Adjustment: ${n(unsqAdj)}`,
          `Size Category: ${sizeCategory}`,
          `Tier: ${tierKey}`,
          `Final Price: ${n(final)}`
        ].join('\n'));
      } else {
        banner('CORBEL CHASE COVER', [
          `Metal: ${resolvedMetalKey}`,
          `Length: ${n(L)}\nWidth: ${n(W)}`,
          `Skirt (raw): ${n(S)}`,
          `Nailing Flange: ${n(nailingFlange)}`,
          `Base Overhang: ${n(baseOverhang)}`,
          `Total Turndown: ${n(totalTurndown)} (skirt+nailingflange+baseoverhang+1)`,
          `Grid Skirt Used (bucket): ${n(skirtForBucket)}`,
          `Hole Count: ${holesCount}                  Adjustment: ${n(holesAdj)}`,
          `Unsquare: ${unsq ? 'Yes' : 'No'}             Adjustment: ${n(unsqAdj)}`,
          `Size Category: ${sizeCategory}`,
          `Tier: ${tierKey}`,
          `Final Price: ${n(final)}`
        ].join('\n'));
      }

      return res.json({
        product: 'chase_cover',
        tier: tierKey,
        metalType: resolvedMetalKey,
        metal: resolvedMetalKey,
        sizeCategory,
        base_price,
        holes: holesCount,
        unsquare: !!unsq,
        finalPrice: final,
        price: final
      });
    }

    // ---------------------- SHROUDS (guard against corbel) ----------------------
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

        // single block
        banner('SHROUD', [
          `Model: ${result.product}`,
          `Metal: ${result.metal}`,
          `Tier: ${result.tier}`,
          `Length: ${n(payload.length)}`,
          `Width: ${n(payload.width)}`,
          `Size category: ${result.sizeCategory ?? '—'}`,
          `Final Price: ${n(result.finalPrice)}`
        ].join('\n'));

        return res.json(result);
      } catch (e) {
        banner('SHROUD EXCEPTION', String(e?.message || e));
        return res.status(500).json({ error: 'Shroud calculation failed' });
      }
    }

    // ---------------------- MULTI-FLUE ----------------------
    if (
      lowerProduct.includes('flat_top') ||
      lowerProduct.includes('hip') ||
      lowerProduct.includes('ridge')
    ) {
      const metalType2 = normalizeMetalType(req.body.metalType || req.body.metal);
      const tierKey = normalizeTierKey(tier);

      const factorRow = (loadMultiFactors() || []).find(f =>
        String(f.metal).toLowerCase() === metalType2 &&
        String(f.product).toLowerCase() === lowerProduct &&
        String(f.tier || 'elite').toLowerCase() === 'elite'
      );
      if (!factorRow) {
        banner('MULTIFLUE ERROR', `No factor found for ${lowerProduct} (${metalType2})`);
        return res.status(400).json({ error: `No factor found for ${lowerProduct} (${metalType2})` });
      }

      const baseFactor = factorRow.factor || 0;
      const adjustments = factorRow.adjustments || {};
      const tierWeight = resolveTierWeight(tierKey); // short/long aware

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

      // --- per-field adjustments (LOGGING ONLY) ---
      // helpers that mirror calculator's step semantics
      const ceilSteps = (diff, interval) => {
        const i = Number(interval) || 0;
        if (!(i > 0)) return 0;
        return Math.ceil(Math.max(0, Number(diff) || 0) / i);
      };
      const floorSteps = (diff, interval) => {
        const i = Number(interval) || 0;
        if (!(i > 0)) return 0;
        return Math.floor(Math.max(0, Number(diff) || 0) / i);
      };

      // SCREEN: ceil steps above standard + low-screen bonus (≤8 → -0.19)
      const scrStd  = Number(adjustments?.screen?.standard ?? 0);
      const scrInt  = Number(adjustments?.screen?.interval ?? 0);
      const scrRate = Number(adjustments?.screen?.rate ?? 0);
      const screenSteps = ceilSteps(input.screenVal - scrStd, scrInt);
      const screenAdjBase = screenSteps * scrRate;
      const screenLowAdj = (Number(input.screenVal) <= 8 ? -0.19 : 0);
      const screenAdj = +(screenAdjBase + screenLowAdj).toFixed(4);

      // OVERHANG: ceil 1" steps above standard (default standard=5"), never subtract
      const ovStd  = Number(adjustments?.overhang?.standard ?? 5);
      const ovInt  = Number(adjustments?.overhang?.interval ?? 1);
      const ovRate = Number(adjustments?.overhang?.rate ?? 0);
      const ovDiff = Math.max(0, input.overhangVal - ovStd);
      const ovSteps = ovDiff > 0 ? Math.ceil(ovDiff / ovInt) : 0;
      const overhangAdj = ovSteps * ovRate;

      // INSET: floor steps
      const inStd  = Number(adjustments?.inset?.standard ?? 0);
      const inInt  = Number(adjustments?.inset?.interval ?? 0);
      const inRate = Number(adjustments?.inset?.rate ?? 0);
      const insetSteps = floorSteps(input.insetVal - inStd, inInt);
      const insetAdj = insetSteps * inRate;

      // SKIRT: floor steps
      const skStd  = Number(adjustments?.skirt?.standard ?? 0);
      const skInt  = Number(adjustments?.skirt?.interval ?? 0);
      const skRate = Number(adjustments?.skirt?.rate ?? 0);
      const skirtSteps = floorSteps(input.skirtVal - skStd, skInt);
      const skirtAdj = skirtSteps * skRate;

      // CORBEL bonus: +0.15 if inset+overhang+skirt > 9 (only when product contains 'corbel')
      const isCorbelMF = typeof lowerProduct === 'string' && lowerProduct.includes('corbel');
      const sumCOS = Number(input.insetVal || 0) + Number(input.overhangVal || 0) + Number(input.skirtVal || 0);
      const corbelAdj = isCorbelMF && sumCOS > 9 ? 0.15 : 0;

      // PITCH: <=5 add "below" once; 6-9 add 0; >=10 add floor(p-9) * "above"
      const p = Number(input.pitchVal || 0);
      const pBelow = Number(adjustments?.pitch?.below ?? 0);
      const pAbove = Number(adjustments?.pitch?.above ?? 0);
      let pitchAdj = 0;
      if (p <= 5) pitchAdj += pBelow;
      else if (p >= 10) pitchAdj += Math.floor(p - 9) * pAbove;

      // Combine to match calculator's adjustedFactor
      const adj = {
        screen: screenAdj,
        overhang: overhangAdj,
        inset: insetAdj,
        skirt: skirtAdj,
        pitch: pitchAdj,
        corbel: corbelAdj
      };
      const totalAdjustment = +(Object.values(adj).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)).toFixed(4);

      // Mirror calculator’s order:
      // AdjustedFactor = Base + Adjustments
      // TieredFactor   = AdjustedFactor × Tier
      // Price          = (L+W) × TieredFactor
      const adjustedFactor = +(baseFactor + totalAdjustment).toFixed(4);
      const tieredFactor   = +(adjustedFactor * tierWeight).toFixed(4);
      const perimeter      = +(input.lengthVal + input.widthVal).toFixed(2);
      const expectedPrice  = +(tieredFactor * perimeter).toFixed(2);

      // Compute price using your calculator (unchanged) and PASS the real tierWeight
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

      const adjLine = (label, value, delta) =>
        `${label}: ${n(value)}                      Adjustment: ${n(delta, 4)}`;

      banner('MULTIFLUE', [
        `Metal: ${metalType2}`,
        `Type: ${lowerProduct}			Factor: ${n(baseFactor, 4)}`,
        `Tier: ${tierKey}                     	Factor: ${n(tierWeight, 4)}`,
        `Length: ${n(input.lengthVal)}`,
        `Width: ${n(input.widthVal)}`,
        adjLine('Screen',   	input.screenVal,	adj.screen),
        adjLine('Overhang', 	input.overhangVal,	adj.overhang),
        adjLine('Inset',    	input.insetVal,		adj.inset),
        adjLine('Skirt',    	input.skirtVal,    	adj.skirt),
        adjLine('Pitch',	input.pitchVal,    	adj.pitch),
        `Adjusted Factor (Base+Adj): ${n(adjustedFactor, 4)}`,
        `Tiered Factor ((Base+Adj)×Tier): ${n(tieredFactor, 4)}`,
        `Perimeter (L+W): ${n(perimeter)}`,
        `Computed Price (Perimeter×Tiered): ${n(expectedPrice)}`,
        `Total Price: ${n(result.finalPrice ?? '—')}`
      ].join('\n'));

      return res.json(result);
    }

    banner('UNKNOWN PRODUCT', String(product));
    return res.status(400).json({ error: 'Unknown product type', product });

  } catch (err) {
    banner('CALC EXCEPTION', String(err?.message || err));
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
