require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const morgan = require('morgan');

const ENABLE_DB_ROUTES = process.env.ENABLE_DB_ROUTES === 'true';
const app = express();

// ✅ FIX: use the existing file `routes/calculate.js`
const calcRouter = require('./routes/calculate');

// ── core middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());
app.use(morgan('tiny')); // simple, production-safe logging

// keep calc online for testing without DB:
app.use('/api/calc', calcRouter);
app.use('/api/calculate', calcRouter); // keep old path working too

// ── health + root
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));
app.get('/', (_req, res) => res.send('API online'));

// ── static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// gate DB-backed routes until SQL is enabled
if (ENABLE_DB_ROUTES) {
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/admin/users', require('./routes/adminUsers'));
  app.use('/api/jobs', require('./routes/jobs'));
  app.use('/api/employees', require('./routes/employees'));
  app.use('/api/assignments', require('./routes/jobAssignments'));
  app.use('/api/announcements', require('./routes/announcements'));
}

// ── 404 + error
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── boot
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`✅ Server listening at http://${HOST}:${PORT}`);
});
