const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const generateCutSheet = require('../utils/generateCutSheet');

// POST /api/cut-sheets/generate
router.post('/generate', async (req, res) => {
  try {
    const orderData = req.body;

    // Generate Excel file
    const fileName = await generateCutSheet(orderData);

    res.json({ success: true, file: fileName });
  } catch (err) {
    console.error('❌ Error generating cut sheet:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/cut-sheets/download/:fileName
router.get('/download/:fileName', (req, res) => {
  const fileName = req.params.fileName;
  const filePath = path.join(__dirname, '../data', fileName);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'File not found' });
  }

  // Send file to browser
  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error('❌ Error sending file:', err);
      res.status(500).json({ success: false, message: 'Download failed' });
    }
  });
});

module.exports = router;
