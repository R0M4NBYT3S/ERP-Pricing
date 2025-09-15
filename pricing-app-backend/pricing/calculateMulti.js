// routes/calculate.js — Orchestrator (fixed for Chase + Shroud)
const express = require('express');
const router = express.Router();

const { calculateChaseCover } = require('../pricing/calculateChaseCover');
const { calculateShroud } = require('../pricing/calculateShroud');
const { calculateMultiPrice } = require('../pricing/calculateMulti');
const { normalizeMetalType } = require('../utils/normalizeMetal');

const tierFactors = require('../config/tier_pricing_factors.json');
const multiFactors = require('../config/multiFactors.json');
const multiDiscrepancies = require('../config/multi_discrepancies');
const { data: multiDiscrepancyData } = multiDiscrepancies;

// ───────────────────────────────────────────────
// Tier resolution
function resolveTierFactor(tierInput) {
  const key = String(tierInput || 'elite').toLowerCase();
  const table = tierFactors.tiers || tierFactors;
  if (!table[key]) return { tierKey: 'elite', factor: 1 };
  return { tierKey: key, factor: table[key] };
}

// ───────────────────────────────────────────────
// Global powdercoat bump
function applyPowdercoatIfNeeded(result, powdercoat) {
  if (powdercoat && /(ss|stainless)/i.test(result.metal || result.metalType)) {
    const bumped = +(result.finalPrice * 1.3).toFixed(2);
    result.finalPrice = bumped;
    result.price = bumped;
    if (result.printout) {
      result.printout.total = `Total Price (with Powdercoat): ${bumped.toFixed(2)}`;
    }
  }
  return result;
}

// ───────────────────────────────────────────────
// POST /api/calculate
router.post('/', (req, res) => {
  try {
    const product = String(req.body.product || '').toLowerCase();
    const metal = normalizeMetalType(req.body.metal || req.body.metalType);
    const { tierKey, factor: tierMultiplier } = resolveTierFactor(req.body.tier);
    const powdercoat = String(req.body.powdercoat).toLowerCase() === 'true';

    let rawResult;

    // ── Chase Covers ──
    if (product.includes('chase')) {
      rawResult = calculateChaseCover({
        lengthVal: req.body.length || req.body.L,
        widthVal: req.body.width || req.body.W,
        skirtVal: req.body.skirt || req.body.S,
        metalType: metal,
        unsquare: req.body.unsquare,
        holeCount: req.body.holes
      }, tierKey);

      // Normalize field names
      if (rawResult.final_price != null) {
        rawResult.finalPrice = rawResult.final_price;
        rawResult.price = rawResult.final_price;
      }

      // Chase pricing is already tiered → do NOT apply global tier multiplier
      rawResult.tier = tierKey;
      rawResult.tierMultiplier = 1;
      rawResult = applyPowdercoatIfNeeded(rawResult, powdercoat);
    }

    // ── Shrouds ──
    else if (product.includes('shroud') && !/corbel/.test(product)) {
      rawResult = calculateShroud({
        length: req.body.length,
        width: req.body.width,
        metal,
        model: req.body.model || product
      });

      // Shroud pricing is table-based, not multiplier-based
      rawResult.tier = tierKey;
      rawResult.tierMultiplier = 1;
      rawResult = applyPowdercoatIfNeeded(rawResult, powdercoat);
    }

    // ── Multi-Flue ──
    else if (product.includes('flat_top') || product.includes('hip') || product.includes('ridge')) {
      const factorRow = (multiFactors || []).find(f =>
        String(f.metal).toLowerCase() === metal &&
        String(f.product).toLowerCase() === product &&
        String(f.tier || 'elite').toLowerCase() === 'elite'
      );
      if (!factorRow) {
        return res.status(400).json({ error: `No factor found for ${product} (${metal})` });
      }

      const rawBaseFactor = factorRow.factor || 0;
      const delta = (multiDiscrepancyData?.[metal]?.[product]?.[tierKey]) || 0;
      const baseFactor = +(rawBaseFactor + delta).toFixed(4);

      const input = {
        lengthVal: req.body.length,
        widthVal: req.body.width,
        screenVal: req.body.screenHeight || req.body.screen,
        overhangVal: req.body.lidOverhang || req.body.overhang,
        insetVal: req.body.inset,
        skirtVal: req.body.skirt,
        pitchVal: req.body.pitch,
        product,
        metal,
        tier: tierKey
      };

      rawResult = calculateMultiPrice(
        input,
        factorRow.adjustments,
        baseFactor,
        tierMultiplier,
        tierKey
      );

      rawResult = applyPowdercoatIfNeeded(rawResult, powdercoat);
      rawResult.tier = tierKey;
      rawResult.tierMultiplier = tierMultiplier;
    }

    // ── Unknown product ──
    else {
      return res.status(400).json({ error: 'Unknown product type', product });
    }

    return res.json(rawResult);

  } catch (err) {
    console.error('CALCULATE ERROR:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
});

module.exports = router;
