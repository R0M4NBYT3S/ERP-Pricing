// server.js — minimal changes: ensure body parsers, and mount announcements at ALL paths

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const app = express();

// -------- Core middleware (keep these ABOVE routes) --------
app.use(express.json());
// Accept urlencoded body too (some frontends default to this)
app.use(express.urlencoded({ extended: true }));

app.use(morgan('dev'));
app.use(cors()); // dev: allow all

// -------- Health check --------
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ======== Calculator router you already have (unchanged) ========
const router = express.Router();

const { calculateChaseCover } = require('./pricing/calculateChaseCover');
const { calculateMultiPrice } = require('./pricing/calculateMulti');
const { calculateShroud } = require('./pricing/calculateShroud');
const { normalizeMetalType } = require('./utils/normalizeMetal');
const factorData = require('./config/multiFactors.json');

let tierCfg = {};
try { tierCfg = require('./config/tier_pricing_factors'); } catch { console.warn('⚠️ tier_pricing_factors not found; default 1.0'); }

const TIER_ALIAS = {
  elite: 'elite', value: 'val', 'value-gold': 'vg', 'value-silver': 'vs',
  builder: 'bul', homeowner: 'ho', val: 'val', vg: 'vg', vs: 'vs', bul: 'bul', ho: 'ho'
};
function resolveTierAndFactor(tierInput) {
  const raw = (tierInput || 'elite').toString().toLowerCase();
  const short = TIER_ALIAS[raw] || raw;
  const table = (tierCfg && typeof tierCfg === 'object')
    ? (tierCfg.tiers && typeof tierCfg.tiers === 'object' ? tierCfg.tiers : tierCfg)
    : {};
  const tryKeys = [short, raw, 'elite'];
  let factor = 1.0;
  for (const k of tryKeys) { const v = table[k]; if (v != null && !Number.isNaN(+v)) { factor = +v; break; } }
  return { tierKey: short, factor };
}
const shroudProducts = ['dynasty','princess','imperial','regal','majesty','monarch','monaco','royale','temptress','durham','centurion','prince','emperor'];

router.post('/', (req, res) => {
  try {
    let { product, metalType, metal, tier } = req.body;
    if (!product) return res.status(400).json({ error: 'Missing product' });

    metalType = normalizeMetalType(metalType);
    metal = normalizeMetalType(metal) || metalType;
    const lowerProduct = product.toLowerCase();

    const input = {
      lengthVal: parseFloat(req.body.length) || 0,
      widthVal: parseFloat(req.body.width) || 0,
      screenVal: parseFloat(req.body.screenHeight || req.body.screen || 0),
      overhangVal: parseFloat(req.body.lidOverhang || req.body.overhang || 0),
      insetVal: parseFloat(req.body.inset) || 0,
      skirtVal: parseFloat(req.body.skirt) || 0,
      pitchVal: parseFloat(req.body.pitch) || 0,
      holes: parseFloat(req.body.holes || 0),
      unsquare: !!req.body.unsquare,
      metalType, metal, product, tier
    };

    console.log('📦 Routing product:', lowerProduct);

    let result;

    if (lowerProduct.includes('chase_cover')) {
      console.log('➡️ Routing to calculateChaseCover');
      const { tierKey, factor: tierMul } = resolveTierAndFactor(tier);
      result = calculateChaseCover(input, tierMul, tierKey);
      console.log('💰 Calculated Chase Cover Price:', result);
    } else if (
      lowerProduct.includes('flat_top') ||
      lowerProduct.includes('hip') ||
      lowerProduct.includes('ridge')
    ) {
      console.log('➡️ Routing to calculateMultiPrice');
      const factorRow = factorData.find(f =>
        f.metal.toLowerCase() === metalType &&
        f.product.toLowerCase() === lowerProduct &&
        f.tier.toLowerCase() === 'elite'
      );
      if (!factorRow) {
        console.warn(`⚠️ No factor found for ${product} (metal=${metalType})`);
        return res.status(400).json({ error: `No factor found for ${product} (${metalType})` });
      }
      const baseFactor = factorRow.factor || 0;
      const adjustments = factorRow.adjustments || {};
      const { tierKey, factor: tierMul } = resolveTierAndFactor(tier);
      result = calculateMultiPrice(input, adjustments, baseFactor, tierMul, tierKey);
      console.log('💰 Calculated Multi-Flue Price:', result);
    } else if (shroudProducts.some(name => lowerProduct.includes(name))) {
      console.log('➡️ Routing to calculateShroud');
      result = calculateShroud(input);
      console.log('💰 Calculated Shroud Price:', result);
    } else {
      console.warn('⚠️ Unknown product type:', product);
      return res.status(400).json({ error: 'Unknown product type', product });
    }

    if (result && typeof result.finalPrice === 'number') {
      let fp = result.finalPrice;
      if (input.unsquare) {
        if (['black_galvanized','kynar'].includes(input.metalType)) fp += 60; else fp += 85;
      }
      if (input.holes > 1) {
        const extra = input.holes - 1;
        fp += extra * (['black_galvanized','kynar'].includes(input.metalType) ? 25 : 45);
      }
      result.finalPrice = parseFloat(fp.toFixed(2));
    }

    return res.json(result);

  } catch (err) {
    console.error('🔥 Error in /api/calculate:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Mount calculator
app.use('/api/calculate', router);

// ======== Admin + Announcements mounts ========
try {
  app.use('/api/admin', require('./routes/admin'));
  console.log('✅ Mounted /api/admin -> routes/admin.js');
} catch { console.warn('ℹ️ routes/admin.js not found'); }

// Use the SAME robust announcements router everywhere (singular/plural, admin/non-admin)
try {
  const announcementsRouter = require('./routes/announcements');

  // main paths
  app.use('/api/announcements', announcementsRouter);
  app.use('/api/announcement', announcementsRouter);

  // admin-scoped paths
  app.use('/api/admin/announcements', announcementsRouter);
  app.use('/api/admin/announcement', announcementsRouter);

  console.log('✅ Mounted announcements at /api/(admin/){announcement,announcements}');
} catch (e) {
  console.warn('ℹ️ routes/announcements.js not found');
}

// IMPORTANT: Do NOT also mount the older announcement files; they conflict:
//  - routes/announcement.js
//  - routes/announcementroutes.js

// ======== Startup ========
const PORT = process.env.PORT || 3001;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 API running at http://localhost:${PORT}`);
});
