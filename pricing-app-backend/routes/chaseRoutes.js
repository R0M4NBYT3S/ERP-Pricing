// routes/chaseRoutes.js — legacy Chase Cover routes neutralized

const express = require('express');
const router = express.Router();

// Return 410 Gone for any legacy Chase Cover route usage
router.all('*', (req, res) => {
  const rec = {
    ts: new Date().toISOString(),
    level: 'warn',
    msg: 'LEGACY_CHASE_ROUTE_CALLED',
    method: req.method,
    path: req.originalUrl
  };
  console.warn(JSON.stringify(rec, null, 2));
  res.status(410).json({
    error: "Legacy chase route removed. Use POST /api/calculate with product='chase_cover'."
  });
});

module.exports = router;
