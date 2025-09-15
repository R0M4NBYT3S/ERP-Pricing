// routes/multiRoutes.js — Slimmed down
const express = require('express');
const router = express.Router();

const factorData = require('../config/multiFactors.json');

// ───────────────────────────────────────────────
// Read-only factors for Admin UI dropdowns
router.get('/factors', (_req, res) => {
  try {
    if (Array.isArray(factorData)) {
      const shaped = {};
      for (const row of factorData) {
        const metal = String(row.metal || '').toLowerCase();
        const product = String(row.product || '').toLowerCase();
        if (!metal || !product) continue;
        shaped[metal] ||= {};
        shaped[metal][product] = {
          factor: Number(row.factor || 0),
          adjustments: row.adjustments || {
            screen: { standard: 0, interval: 0, rate: 0 },
            overhang: { standard: 5, interval: 1, rate: 0 },
            inset: { standard: 0, interval: 0, rate: 0 },
            skirt: { standard: 0, interval: 0, rate: 0 },
            pitch: { below: 0, above: 0 }
          }
        };
      }
      return res.json(shaped);
    }
    return res.json(factorData || {});
  } catch (e) {
    console.error('GET /factors error:', e);
    return res.json({});
  }
});

// ───────────────────────────────────────────────
// Legacy calculate route (discouraged)
router.post('/calculate', (_req, res) => {
  return res.status(410).json({
    error: "Legacy multiflue route removed. Use POST /api/calculate with product='flat_top'/'hip'/'ridge'."
  });
});

module.exports = router;


