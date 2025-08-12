const express = require('express');

function tierInject(tier) {
  const r = express.Router();
  r.use((req, _res, next) => {
    req.tier = tier;     // server-side injected tier
    next();
  });
  return r;
}

module.exports = tierInject;