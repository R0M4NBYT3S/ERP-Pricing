// Store all active SSE connections
let clients = [];

router.get('/announcements/live', (req, res) => {
  // Setup SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send the current announcement immediately
  const current = readAnnouncement();
  res.write(`data: ${JSON.stringify(current)}\n\n`);

  // Keep connection
  clients.push(res);

  // Remove client on disconnect
  req.on('close', () => {
    clients = clients.filter(client => client !== res);
  });
});

// Broadcast helper
function broadcastAnnouncement() {
  const announcement = readAnnouncement();
  clients.forEach(client => {
    client.write(`data: ${JSON.stringify(announcement)}\n\n`);
  });
}

// Modify POST and DELETE to broadcast changes
router.post('/announcements', (req, res) => {
  const newAnnouncement = {
    message: req.body.text || '',
    timestamp: new Date().toISOString()
  };
  writeAnnouncement(newAnnouncement);
  broadcastAnnouncement(); // 🔹 Push to clients
  res.status(201).json({ success: true, announcement: newAnnouncement });
});

router.delete('/announcements', (req, res) => {
  writeAnnouncement({ message: '' });
  broadcastAnnouncement(); // 🔹 Push to clients
  res.json({ success: true });
});
