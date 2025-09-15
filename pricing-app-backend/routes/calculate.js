const express = require('express');
const router = express.Router();
const { calculateMultiPrice } = require('../pricing/calculateMulti');
const { calculateChaseCover } = require('../pricing/calculateChaseCover');
const normalizeMetal = require('../utils/normalizeMetal');
const loadMultiFactors = require('../utils/loadMultiFactors');
const { multiDiscrepancyDelta } = require('../utils/discrepancy');
const { resolveTierWeight } = require('../utils/resolveTierWeight');
const { n, safeNum, toNum } = require('../utils/num');

// ============================================================================
// POST /api/calculate
// ============================================================================
router.post('/', (req, res) => {
  try {
    const isChaseImplicit =
      Number.isFinite(+req.body.L) && Number.isFinite(+req.body.W) &&
      (req.body.metalKey || req.body.metalType || req.body.metal);

    // normalize powdercoat flag once per request
    const powdercoat = String(req.body.powdercoat).toLowerCase() === 'true';

    let product   = req.body.product;
    let metalType = normalizeMetal(req.body.metalType);
    let metal     = normalizeMetal(req.body.metal) || metalType;
    let tier      = req.body.tier;

    const productStr   = String(product || '').toLowerCase();
    const lowerProduct = productStr;

    // ---------------------- CHASE COVER ----------------------
    const wantsChase = lowerProduct.includes('chase') || isChaseImplicit;
    if (wantsChase) {
      try {
        const L = toNum(req.body.L ?? req.body.length);
        const W = toNum(req.body.W ?? req.body.width);
        const S = toNum(req.body.S ?? req.body.skirt);
        const unsq = !!req.body.unsquare;

        const resolvedMetalKey = normalizeMetal(req.body.metalKey || req.body.metalType || req.body.metal);
        const sizeCategory = `${L}x${W}`;
        const tierKey = String(tier || 'elite').toLowerCase();

        let holesCount = toNum(req.body.holes) || 0;
        let holesAdj = holesCount * 10;
        let unsqAdj = unsq ? 25 : 0;
        const base_price = 100; // placeholder

        const final = Math.round((base_price + holesAdj + unsqAdj + Number.EPSILON) * 100) / 100;
        let chasePrice = final;

        // >>> POWDERCOAT (CHASE): 30% bump if stainless
        console.log("💥 POWDERCOAT CHECK (chase):", {
          powdercoat: req.body.powdercoat,
          metal: resolvedMetalKey,
          regexMatched: /(ss|stainless)/i.test(resolvedMetalKey),
          finalPriceBefore: final
        });

        if (powdercoat && /(ss|stainless)/i.test(resolvedMetalKey)) {
          const bumped = +(final * 1.3).toFixed(2);
          chasePrice = bumped;
          console.log("✅ POWDERCOAT APPLIED (chase):", { bumped });
        }

        banner('CHASE COVER', [
          `Metal: ${resolvedMetalKey}`,
          `Length: ${n(L)} Width: ${n(W)} Skirt: ${n(S)}`,
          `Hole Count: ${holesCount} Adj: ${n(holesAdj)}`,
          `Unsquare: ${unsq ? 'Yes' : 'No'} Adj: ${n(unsqAdj)}`,
          `Size Category: ${sizeCategory}`,
          `Tier: ${tierKey}`,
          `Final Price: ${n(chasePrice)}`
        ].join('\n'));

        chaseAddOn = chasePrice;
        chaseDetails = {
          product: 'chase_cover',
          tier: tierKey,
          metalType: resolvedMetalKey,
          metal: resolvedMetalKey,
          sizeCategory,
          base_price,
          holes: holesCount,
          unsquare: !!unsq,
          finalPrice: chasePrice,
          price: chasePrice
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

        const tierKey = String(tier || 'elite').toLowerCase();
        const result = calculateShroud(req.body, tierKey);

        // >>> POWDERCOAT (SHROUD): 30% bump if stainless
        console.log("💥 POWDERCOAT CHECK (shroud):", {
          powdercoat: req.body.powdercoat,
          metal: result.metal,
          regexMatched: /(ss|stainless)/i.test(result.metal),
          finalPriceBefore: result.finalPrice
        });

        if (powdercoat && /(ss|stainless)/i.test(result.metal)) {
          const bumped = +(result.finalPrice * 1.3).toFixed(2);
          result.finalPrice = bumped;
          result.price = bumped;
          if (result.printout) {
            result.printout.total = `Total Price (with Powdercoat): ${bumped.toFixed(2)}`;
          }
          console.log("✅ POWDERCOAT APPLIED (shroud):", { bumped });
        }

        return res.json(result);
      } catch (err) {
        console.error('SHROUD ERROR:', err);
        return res.status(500).json({ error: 'SHROUD', message: err.message });
      }
    }

    // ---------------------- MULTI-FLUE ----------------------
    if (lowerProduct.includes('flat_top') || lowerProduct.includes('hip') || lowerProduct.includes('ridge')) {
      const metalType2 = normalizeMetal(req.body.metalType || req.body.metal);
      const tierKey = String(tier || 'elite').toLowerCase();

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

      if (powdercoat && /(ss|stainless)/i.test(metalType2)) {
        const bumped = +(result.finalPrice * 1.3).toFixed(2);
        result.finalPrice = bumped;
        result.price = bumped;
        if (result.printout) {
          result.printout.total = `Total Price (with Powdercoat): ${bumped.toFixed(2)}`;
        }
        console.log("✅ POWDERCOAT APPLIED (multi):", { bumped });
      }

      return res.json(result);
    }

    return res.status(400).json({ error: 'Unknown product type', product });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});
module.exports = router;
