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

router.get('/factors', (req, res) => {
  try {
    const data = fs.readFileSync(factorsPath, 'utf-8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error('Error reading factors file:', err);
    res.status(500).json({ error: 'Failed to read factors' });
  }
});

router.post('/factors', (req, res) => {
  try {
    const updatedFactors = req.body;
    fs.writeFileSync(factorsPath, JSON.stringify(updatedFactors, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('Error writing factors file:', err);
    res.status(500).json({ error: 'Failed to save factors' });
  }
});

// ========================
//  📂 Shroud Pricing Setup
// ========================
const shroudPricesPath = path.join(__dirname, '../config/shroudPrices.js');

// ✅ GET all shroud prices (normalized)
router.get('/shrouds', (req, res) => {
  try {
    delete require.cache[require.resolve(shroudPricesPath)];
    const rawData = require(shroudPricesPath);

    // ✅ Normalize to return only the product-level keys
    const normalized = rawData.pricingRules || rawData;

    res.json(normalized);
  } catch (err) {
    console.error('Error reading shroudPrices.js:', err);
    res.status(500).json({ error: 'Failed to read shrouds' });
  }
});

// ✅ POST update a shroud price safely
router.post('/shrouds', (req, res) => {
  const { metal, product, size, newPrice } = req.body;
  if (!metal || !product || !size || isNaN(newPrice)) {
    return res.status(400).json({ error: 'Invalid data' });
  }

  try {
    delete require.cache[require.resolve(shroudPricesPath)];
    const rawData = require(shroudPricesPath);
    const shroudData = rawData.pricingRules || rawData;

    if (!shroudData[metal]) shroudData[metal] = {};
    if (!shroudData[metal][product]) shroudData[metal][product] = {};
    shroudData[metal][product][size] = newPrice;

    // ✅ Save clean object (no nested pricingRules)
    const content = "module.exports = " + JSON.stringify(shroudData, null, 2) + ";";
    fs.writeFileSync(shroudPricesPath, content, 'utf-8');

    res.json({ success: true, updated: { metal, product, size, newPrice } });
  } catch (err) {
    console.error('Error updating shroudPrices.js:', err);
    res.status(500).json({ error: 'Failed to save shroud price' });
  }
});

module.exports = router;
