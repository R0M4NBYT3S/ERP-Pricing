// routes/prices.js — legacy pricing routes neutralized

const express = require('express');
const router = express.Router();

// Return 410 Gone for any legacy pricing endpoints
router.all('*', (req, res) => {
  const rec = {
    ts: new Date().toISOString(),
    level: 'warn',
    msg: 'LEGACY_PRICES_ROUTE_CALLED',
    method: req.method,
    path: req.originalUrl
  };
  console.warn(JSON.stringify(rec, null, 2));
  res.status(410).json({
    error: "Legacy pricing routes removed. Use POST /api/calculate."
  });
});

module.exports = router;
