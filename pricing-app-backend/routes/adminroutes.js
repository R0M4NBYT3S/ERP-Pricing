// routes/adminroutes.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const router = express.Router();

/* ──────────────────────────────────────────────
   Helpers: read/write JSON, ensure folders exist
────────────────────────────────────────────── */
function readJSON(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    return JSON.parse(fs.readFileSync(p, 'utf8') || 'null') ?? fallback;
  } catch (e) {
    console.error(`Error reading ${p}:`, e);
    return fallback;
  }
}
function writeJSON(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}
const LOGS_DIR = path.join(__dirname, '../logs');
fs.mkdirSync(LOGS_DIR, { recursive: true });
const AUDIT_LOG = path.join(LOGS_DIR, 'admin-audit.json'); // array of entries

function logChange(entry) {
  const existing = readJSON(AUDIT_LOG, []);
  existing.push({ ts: new Date().toISOString(), ...entry });
  writeJSON(AUDIT_LOG, existing);
}

/* ──────────────────────────────────────────────
   Simple multi-user login
   File: config/adminUsers.json  (see below)
────────────────────────────────────────────── */
const usersFile = path.join(__dirname, '../config/adminUsers.json');

router.post('/login', (req, res) => {
  const { username = '', password = '' } = req.body || {};
  const cfg = readJSON(usersFile, { users: [] });
  const ok = cfg.users.some(
    u => u.username.toLowerCase() === String(username).toLowerCase() && u.password === password
  );
  if (!ok) return res.status(401).json({ success: false, message: 'Invalid credentials' });

  logChange({ action: 'login', user: username });
  return res.json({ success: true, user: username });
});

router.get('/logs', (req, res) => {
  res.json(readJSON(AUDIT_LOG, []));
});

/* ──────────────────────────────────────────────
   Announcements (file-backed)
────────────────────────────────────────────── */
const announcementsFile = path.join(__dirname, '../announcement.json');

function loadAnnouncements() {
  return readJSON(announcementsFile, []);
}
function saveAnnouncements(list) {
  writeJSON(announcementsFile, list);
}

// GET all announcements
router.get('/announcements', (req, res) => {
  res.json(loadAnnouncements());
});

// POST add announcement
router.post('/announcements', (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ success: false, message: 'Text is required' });

  const announcements = loadAnnouncements();
  const newAnnouncement = { id: Date.now(), text: text.trim(), timestamp: new Date().toISOString() };
  announcements.push(newAnnouncement);
  saveAnnouncements(announcements);

  logChange({ action: 'announcement:add', user: req.headers['x-admin-user'] || 'unknown', text: newAnnouncement.text });
  res.json({ success: true, announcement: newAnnouncement });
});

// DELETE announcement
router.delete('/announcements/:id', (req, res) => {
  const id = Number(req.params.id);
  const before = loadAnnouncements();
  const after = before.filter(a => a.id !== id);
  if (after.length === before.length) return res.status(404).json({ success: false, message: 'Not found' });

  saveAnnouncements(after);
  logChange({ action: 'announcement:delete', user: req.headers['x-admin-user'] || 'unknown', id });
  res.json({ success: true });
});

/* ──────────────────────────────────────────────
   Multi-Flue Factors
   (kept compatible with your current file format)
────────────────────────────────────────────── */
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
    const updated = req.body;
    fs.writeFileSync(factorsPath, JSON.stringify(updated, null, 2));
    logChange({
      action: 'factors:update',
      user: req.headers['x-admin-user'] || 'unknown',
      summary: 'multiFactors.json overwritten'
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Error writing factors file:', err);
    res.status(500).json({ error: 'Failed to save factors' });
  }
});

/* ──────────────────────────────────────────────
   Shroud Pricing
────────────────────────────────────────────── */
const shroudPricesPath = path.join(__dirname, '../config/shroudPrices.js');

router.get('/shrouds', (req, res) => {
  try {
    delete require.cache[require.resolve(shroudPricesPath)];
    const raw = require(shroudPricesPath);
    const normalized = raw.pricingRules || raw;
    res.json(normalized);
  } catch (err) {
    console.error('Error reading shroudPrices.js:', err);
    res.status(500).json({ error: 'Failed to read shrouds' });
  }
});

router.post('/shrouds', (req, res) => {
  const { metal, product, size, newPrice } = req.body || {};
  if (!metal || !product || !size || isNaN(newPrice)) return res.status(400).json({ error: 'Invalid data' });

  try {
    delete require.cache[require.resolve(shroudPricesPath)];
    const raw = require(shroudPricesPath);
    const data = raw.pricingRules || raw;

    if (!data[metal]) data[metal] = {};
    if (!data[metal][product]) data[metal][product] = {};
    data[metal][product][size] = Number(newPrice);

    const content = 'module.exports = ' + JSON.stringify(data, null, 2) + ';\n';
    fs.writeFileSync(shroudPricesPath, content, 'utf-8');

    logChange({
      action: 'shroud:update',
      user: req.headers['x-admin-user'] || 'unknown',
      metal, product, size, newPrice: Number(newPrice)
    });

    res.json({ success: true, updated: { metal, product, size, newPrice: Number(newPrice) } });
  } catch (err) {
    console.error('Error updating shroudPrices.js:', err);
    res.status(500).json({ error: 'Failed to save shroud price' });
  }
});

module.exports = router;
