// routes/adminTiers.js
const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

const router = express.Router();

const TIERS_FILE = path.resolve(__dirname, '..', 'config', 'tier_pricing_factors.json');

async function ensureDir(p) {
  await fsp.mkdir(path.dirname(p), { recursive: true });
}

async function readJson(file) {
  try {
    const txt = (await fsp.readFile(file, 'utf8')).trim();
    if (!txt) return {};
    return JSON.parse(txt);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    const backup = `${file}.bad-${Date.now()}`;
    try { await fsp.copyFile(file, backup); } catch {}
    console.error('[tiers] JSON parse failed; backed up to', backup, 'err=', err.message);
    return {};
  }
}

function normalizeShape(raw) {
  // Accept legacy shapes and normalize to: { tiers: {...}, val?: number }
  const out = {};
  const tiers = {};

  if (raw && typeof raw === 'object') {
    // if already {tiers:{...}} keep them
    if (raw.tiers && typeof raw.tiers === 'object') {
      Object.assign(tiers, raw.tiers);
    }
    // carry through optional legacy "val"
    if (typeof raw.val === 'number') out.val = raw.val;

    // migrate any accidental top-level tier keys into tiers
    for (const k of Object.keys(raw)) {
      if (k === 'tiers' || k === 'val') continue;
      const v = raw[k];
      if (typeof v === 'number') {
        tiers[k] = v; // promote into tiers map
      }
    }
  }

  out.tiers = tiers;
  return out;
}

async function writeJson(file, obj) {
  await ensureDir(file);
  const json = JSON.stringify(obj, null, 2) + '\n';
  await fsp.writeFile(file, json, 'utf8');
}

// GET /api/admin/tiers  → always returns { tiers: {...}, val?: number }
router.get('/', async (_req, res) => {
  try {
    const raw = await readJson(TIERS_FILE);
    const data = normalizeShape(raw);
    // Persist normalized shape if file was messy
    if (JSON.stringify(raw) !== JSON.stringify(data)) {
      await writeJson(TIERS_FILE, data);
    }
    res.json(data);
  } catch (err) {
    console.error('[tiers][GET] error:', err);
    res.status(500).json({ message: 'Failed to read tiers' });
  }
});

// POST /api/admin/tiers  { tier: "vg", factor: 1.11969 }
router.post('/', express.json(), async (req, res) => {
  try {
    const { tier, factor } = req.body || {};
    const t = typeof tier === 'string' ? tier.trim() : '';
    const f = Number(factor);

    if (!t || !Number.isFinite(f)) {
      return res.status(400).json({ message: 'tier (string) and factor (number) are required' });
    }

    const raw = await readJson(TIERS_FILE);
    const data = normalizeShape(raw);

    // Only update inside data.tiers
    data.tiers[t] = f;

    await writeJson(TIERS_FILE, data);
    res.json({ success: true, tier: t, factor: f });
  } catch (err) {
    console.error('[tiers][POST] error:', err);
    res.status(500).json({ message: 'Failed to update tier' });
  }
});

// Optional: quick diag
router.get('/diag', (_req, res) => {
  res.json({ TIERS_FILE, exists: fs.existsSync(TIERS_FILE) });
});

module.exports = router;
