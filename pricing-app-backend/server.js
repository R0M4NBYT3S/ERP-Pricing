const express = require('express');
const cors = require('cors');

const app = express();
const port = 3001;

// ✅ Enable middlewares FIRST
app.use(cors());
app.use(express.json());

// ✅ Then import and mount routes
const cutSheetRoutes = require('./routes/cutSheetRoutes');
app.use('/api/cut-sheets', cutSheetRoutes);

const calculateRoutes = require('./routes/calculate');
app.use('/api/calculate', calculateRoutes);

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

const announcementRoutes = require('./routes/announcements');
app.use('/api/announcements', announcementRoutes);


// Health check route
app.get('/', (req, res) => {
  res.send('✅ API is up and running');
});

// 🔹 Listen on 0.0.0.0 instead of localhost
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://192.168.0.73:${port}`);
});
