// routes/adminTiers.js
const express = require('express');
const fs = require('fs');
const fsp = fs.promises;           // works on older Node too
const path = require('path');

const router = express.Router();

const TIERS_FILE = path.resolve(__dirname, '..', 'config', 'tier_pricing_factors.json');

async function ensureDir(p) {
  await fsp.mkdir(path.dirname(p), { recursive: true });
}

async function safeReadJson(file) {
  try {
    const buf = await fsp.readFile(file, 'utf8');
    const txt = buf.trim();
    if (!txt) return {};
    const data = JSON.parse(txt);
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('tiers file must be a JSON object map (e.g., {"elite":1})');
    }
    return data;
  } catch (err) {
    if (err.code === 'ENOENT') return {}; // file missing → start empty
    // Corrupt JSON: back it up and start fresh
    const backup = `${file}.bad-${Date.now()}`;
    try { await fsp.copyFile(file, backup); } catch {}
    console.error('[tiers] JSON parse failed; backed up to', backup, 'err=', err.message);
    return {};
  }
}

async function writeJson(file, obj) {
  await ensureDir(file);
  const json = JSON.stringify(obj, null, 2) + '\n';
  await fsp.writeFile(file, json, 'utf8');
}

// GET /api/admin/tiers
router.get('/', async (req, res) => {
  try {
    const tiers = await safeReadJson(TIERS_FILE);
    res.json(tiers);
  } catch (err) {
    console.error('[tiers][GET] error:', err);
    res.status(500).json({ message: err.message || 'Failed to read tiers', file: TIERS_FILE });
  }
});

// POST /api/admin/tiers  { tier, factor }
router.post('/', express.json(), async (req, res) => {
  try {
    const { tier, factor } = req.body || {};
    const num = Number(factor);
    if (typeof tier !== 'string' || !tier.trim() || !Number.isFinite(num)) {
      return res.status(400).json({ message: 'tier (string) and factor (number) are required' });
    }
    const tiers = await safeReadJson(TIERS_FILE);
    tiers[tier.trim()] = num;
    await writeJson(TIERS_FILE, tiers);
    res.json({ success: true, tier: tier.trim(), factor: num });
  } catch (err) {
    console.error('[tiers][POST] error:', err);
    res.status(500).json({ message: err.message || 'Failed to update tier', file: TIERS_FILE });
  }
});

// Optional: quick diag endpoint
router.get('/diag', async (req, res) => {
  try {
    const exists = fs.existsSync(TIERS_FILE);
    res.json({ TIERS_FILE, exists });
  } catch (err) {
    res.status(500).json({ message: err.message, TIERS_FILE });
  }
});

module.exports = router;
