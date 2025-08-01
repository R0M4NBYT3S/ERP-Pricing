const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// ========================
//  📂 Announcements Setup
// ========================
const announcementsFile = path.join(__dirname, '../announcement.json');

function loadAnnouncements() {
  if (!fs.existsSync(announcementsFile)) return [];
  try {
    const data = fs.readFileSync(announcementsFile, 'utf-8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading announcements file:', err);
    return [];
  }
}

function saveAnnouncements(data) {
  fs.writeFileSync(announcementsFile, JSON.stringify(data, null, 2));
}

// ✅ GET all announcements
router.get('/announcements', (req, res) => {
  res.json(loadAnnouncements());
});

// ✅ POST add a new announcement
router.post('/announcements', (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ success: false, message: 'Text is required' });
  }

  const announcements = loadAnnouncements();
  const newAnnouncement = {
    id: Date.now(),
    text: text.trim(),
    timestamp: new Date().toISOString(),
  };

  announcements.push(newAnnouncement);
  saveAnnouncements(announcements);

  res.json({ success: true, announcement: newAnnouncement });
});

// ✅ DELETE an announcement
router.delete('/announcements/:id', (req, res) => {
  const id = Number(req.params.id);
  let announcements = loadAnnouncements();
  const initialLength = announcements.length;

  announcements = announcements.filter((a) => a.id !== id);

  if (announcements.length === initialLength) {
    return res.status(404).json({ success: false, message: 'Not found' });
  }

  saveAnnouncements(announcements);
  res.json({ success: true });
});

// ========================
//  📂 Multi-Flue Factors
// ========================
const factorsPath = path.join(__dirname, '../config/multiFactors.json');

// ✅ GET all factors with adjustments (nested by metal → product)
router.get('/factors', (req, res) => {
  try {
    const rawData = fs.readFileSync(factorsPath, 'utf-8');
    const factorsArray = JSON.parse(rawData);
    const transformed = {};
    factorsArray.forEach((entry) => {
      const metal = entry.metal || entry.metalType;
      const product = entry.product || entry.productSent;
      if (!metal || !product) return;
      if (!transformed[metal]) transformed[metal] = {};
      transformed[metal][product] = {
        factor: entry.factor || entry.baseFactor || 0,
        adjustments: entry.adjustments || {}
      };
    });
    res.json(transformed);
  } catch (err) {
    console.error('Error reading factors file:', err);
    res.status(500).json({ error: 'Failed to read factors' });
  }
});

// ✅ POST update a single multi‑flue factor and its adjustments
router.post('/factors', (req, res) => {
  const { metal, product, factor, adjustments } = req.body;
  if (!metal || !product || (factor !== undefined && isNaN(factor))) {
    return res.status(400).json({ success: false, message: 'Invalid payload' });
  }
  try {
    const rawData = fs.readFileSync(factorsPath, 'utf-8');
    const factorsArray = JSON.parse(rawData);
    const entry = factorsArray.find(
      (f) =>
        (f.metal === metal || f.metalType === metal) &&
        (f.product === product || f.productSent === product)
    );
    if (entry) {
      if (factor !== undefined) {
        entry.factor = Number(factor);
        entry.baseFactor = Number(factor);
      }
      if (adjustments && typeof adjustments === 'object') {
        entry.adjustments = adjustments;
      }
    } else {
      // Create default adjustments if none provided
      const defaultAdjustments = {
        screen: { standard: 0, interval: 0, rate: 0 },
        overhang: { standard: 0, interval: 0, rate: 0 },
        inset: { standard: 0, interval: 0, rate: 0 },
        skirt: { standard: 0, interval: 0, rate: 0 },
        pitch: { below: 0, above: 0 }
      };
      factorsArray.push({
        metal,
        product,
        tier: 'elite',
        factor: Number(factor) || 0,
        baseFactor: Number(factor) || 0,
        adjustments: adjustments || defaultAdjustments
      });
    }
    fs.writeFileSync(factorsPath, JSON.stringify(factorsArray, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('Error saving factors file:', err);
    res.status(500).json({ error: 'Failed to save factor' });
  }
});

// ========================
//  📂 Shroud Pricing Setup
// ========================
//
// The admin panel should update the actual per‑size shroud pricing.  Those
// prices live in `config/shroudPrices.js` (not in `shroudPricing.js`, which
// only contains size cutoffs and rules).  We read and write that file
// whenever shroud prices are requested or updated.

// Path to the canonical shroud prices.  If the module exports a
// `pricingRules` property (legacy support), we use that; otherwise the
// exported object is the data itself.
const shroudPricesPath = path.join(__dirname, '../config/shroudPrices.js');

// ✅ GET shroud prices
router.get('/shrouds', (req, res) => {
  try {
    // Always clear the cache so we get the latest file on each request
    delete require.cache[require.resolve(shroudPricesPath)];
    const rawData = require(shroudPricesPath);
    const normalized = rawData.pricingRules || rawData;
    res.json(normalized);
  } catch (err) {
    console.error('Error reading shroudPrices.js:', err);
    res.status(500).json({ error: 'Failed to read shrouds' });
  }
});

// ✅ POST update shroud price
router.post('/shrouds', (req, res) => {
  const { metal, product, size, newPrice } = req.body;
  if (!metal || !product || !size || isNaN(newPrice)) {
    return res.status(400).json({ success: false, message: 'Invalid payload' });
  }
  try {
    // Read the current prices
    delete require.cache[require.resolve(shroudPricesPath)];
    const rawData = require(shroudPricesPath);
    const shroudData = rawData.pricingRules || rawData;

    // Ensure nested objects exist
    if (!shroudData[metal]) shroudData[metal] = {};
    if (!shroudData[metal][product]) shroudData[metal][product] = {};

    // Update the price
    shroudData[metal][product][size] = Number(newPrice);

    // Write back to the file without the `pricingRules` wrapper
    const content = 'module.exports = ' + JSON.stringify(shroudData, null, 2) + ';';
    fs.writeFileSync(shroudPricesPath, content, 'utf-8');

    res.json({ success: true, updated: { metal, product, size, newPrice: Number(newPrice) } });
  } catch (err) {
    console.error('Error updating shroudPrices.js:', err);
    res.status(500).json({ success: false, message: 'Failed to update shroud price' });
  }
});

module.exports = router;
