// utils/cutSheetCore/dispatcher.js
const buildChaseCoverSchema = require('./cutSheetRules/chaseCover');
const buildDynastySchema = require('./cutSheetRules/dynasty');
// add other product schemas here…

const CUTSHEET_MAP = {
  chase_cover: buildChaseCoverSchema,
  dynasty: buildDynastySchema,
  // ...
};

function buildCutSheet(productKey, inputs) {
  const fn = CUTSHEET_MAP[productKey];
  if (!fn) throw new Error(`Unknown product type: ${productKey}`);
  return fn(inputs);
}

module.exports = { buildCutSheet };
