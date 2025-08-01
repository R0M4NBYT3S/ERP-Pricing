const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const announcementFile = path.join(__dirname, '../config/announcement.json');

// GET current announcement
router.get('/', (req, res) => {
  try {
    const data = fs.readFileSync(announcementFile, 'utf8');
    const json = JSON.parse(data);
    res.json(json);
  } catch (err) {
    console.error('Error reading announcement file:', err);
    res.status(500).json({ message: 'Error reading announcement' });
  }
});

// POST update announcement
router.post('/', (req, res) => {
  const { message } = req.body;
  if (!message && message !== "") {
    return res.status(400).json({ error: 'Message is required' });
  }

  const newData = { message };
  try {
    fs.writeFileSync(announcementFile, JSON.stringify(newData, null, 2), 'utf8');
    res.json({ success: true, message: 'Announcement updated.' });
  } catch (err) {
    console.error('Error writing announcement file:', err);
    res.status(500).json({ message: 'Error updating announcement' });
  }
});

module.exports = router;
