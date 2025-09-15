// routes/shroudRoutes.js — cleaned
const express = require('express');
const router = express.Router();

const { metals, aliasIndex } = require('../config/shroudUnified');
const { calculateShroud } = require('../pricing/calculateShroud');

// ───────────────────────────────────────────────
// Read-only config for Admin UI dropdowns
router.get('/config', (_req, res) => {
  try {
    return res.json(metals || {});
  } catch (e) {
    console.error('GET /config error:', e);
    return res.json({});
  }
});

// ───────────────────────────────────────────────
// Legacy calculate (discouraged)
// Now: Only runs raw shroud math, no tier/powdercoat.
// Final price adjustments happen in /api/calculate orchestrator.
router.post('/calculate', (req, res) => {
  try {
    const { metal, metalType, model, length, width } = req.body || {};
    if (!metal && !metalType) {
      return res.status(400).json({ error: 'Missing metal/metalType' });
    }
    if (!model) {
      return res.status(400).json({ error: 'Missing model' });
    }
    if (length == null || width == null) {
      return res.status(400).json({ error: 'Missing length/width' });
    }

    const rawResult = calculateShroud({
      length,
      width,
      metal,
      metalType,
      model
    });

    return res.json(rawResult);
  } catch (err) {
    console.error('🔥 Shroud error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
