require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const path = require('path');
const log = require('./utils/logger');

const app = express();

// 🔧 Core middleware (parsers first)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors());
app.use(log.http());

// 📂 Static file serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 📌 Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin/users', require('./routes/adminUsers'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/assignments', require('./routes/jobAssignments'));
app.use('/api/calc', require('./routes/calc'));
app.use('/api/announcements', require('./routes/announcements'));

// ❌ 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// 🔥 Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 🚀 Boot server
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`✅ Server listening at http://${HOST}:${PORT}`);
});
