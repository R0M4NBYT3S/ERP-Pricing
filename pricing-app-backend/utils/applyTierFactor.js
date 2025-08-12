const tierFactors = require('../config/tier_pricing_factors.json');

function applyTierFactor(price, tier) {
  if (!tierFactors[tier]) {
    throw new Error(`Invalid tier: ${tier}`);
  }
  return +(price * tierFactors[tier]).toFixed(2);
}

module.exports = applyTierFactor;
