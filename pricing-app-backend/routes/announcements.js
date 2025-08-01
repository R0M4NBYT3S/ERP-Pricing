// routes/announcements.js
const express = require('express');
const router = express.Router();

let currentAnnouncement = null;
let clients = [];

// 🔹 Live SSE endpoint
router.get('/live', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Add client to list
  clients.push(res);

  // Send current announcement if exists
  if (currentAnnouncement) {
    res.write(`data: ${JSON.stringify(currentAnnouncement)}\n\n`);
  }

  // Remove client on close
  req.on('close', () => {
    clients = clients.filter(c => c !== res);
  });
});

// 🔹 Update announcement (call this from admin)
router.post('/update', (req, res) => {
  const { text } = req.body;
  currentAnnouncement = text ? { text } : null;

  // Push to all connected clients
  clients.forEach(c => {
    c.write(`data: ${JSON.stringify(currentAnnouncement || { text: "" })}\n\n`);
  });

  res.json({ success: true, currentAnnouncement });
});

module.exports = router;
