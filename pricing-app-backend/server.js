// server.js — mount routes/calculate and BLOCK legacy /api/chase

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');

const { createLogger } = require('./utils/logger');

const app = express();
const log = createLogger();

// -------- Core middleware --------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(log.http());         // adds req.log + request IDs
app.use(cors());             // open CORS in dev

// ===== Block legacy chase route to prevent double-pricing =====
app.use('/api/chase', (req, res) => {
  console.warn(JSON.stringify({
    ts: new Date().toISOString(),
    level: 'warn',
    msg: 'LEGACY_CHASE_ROUTE_CALLED',
    method: req.method,
    path: req.originalUrl
  }, null, 2));

  return res.status(410).json({
    error: 'Legacy chase route removed. Use POST /api/calculate with product="chase_cover".'
  });
});

// -------- Routers --------
app.use('/api/admin/tiers',   require('./routes/adminTiers'));
app.use('/api/admin',         require('./routes/adminAuth'));
app.use('/api/admin/shrouds', require('./routes/adminShrouds'));
app.use('/api/shrouds',       require('./routes/shroudRoutes'));

// ✅ Unified calculator (Chase Cover + Multi + Shroud)
app.use('/api/calculate',     require('./routes/calculate'));

// ======== Optional: Announcements mounts ========
try {
  const announcementsRouter = require('./routes/announcements');
  app.use('/api/announcements', announcementsRouter);
  app.use('/api/announcement',  announcementsRouter);
  app.use('/api/admin/announcements', announcementsRouter);
  app.use('/api/admin/announcement',  announcementsRouter);
  log.info('announcements_mounted');
} catch (e) {
  log.info('announcements_router_missing', { error: e.message });
}

// --- Admin Factors (read-only) ---
function loadCfg(relPath, fallback) {
  try {
    const abs = require.resolve(relPath);
    delete require.cache[abs];
    return require(relPath);
  } catch (e) {
    log.warn('cfg_load_failed', { file: relPath, err: e.message });
    return fallback;
  }
}

app.get('/api/admin/factors', (req, res) => {
  const multi = loadCfg('./config/multiFactors.json', []);
  const grouped = {};
  for (const row of Array.isArray(multi) ? multi : []) {
    const metal = String(row?.metal ?? '').toLowerCase();
    const product = String(row?.product ?? '').toLowerCase();
    if (!metal || !product) continue;
    if (!grouped[metal]) grouped[metal] = {};
    grouped[metal][product] = {
      factor: (typeof row?.factor === 'number') ? +row.factor : row?.factor ?? null,
      adjustments: row?.adjustments ?? {}
    };
  }
  return res.json(grouped);
});

// -------- Centralized error handler --------
app.use((err, req, res, next) => {
  req.log?.error('unhandled_error', { err: err?.stack || String(err) });
  res.status(500).json({ error: 'Internal server error' });
});

// ---------- Boot ----------
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  log.info('server_start', { port: PORT, host: HOST });
});
