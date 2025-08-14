// routes/adminAuth.js
const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// File lives in backend root per your note
const USERS_FILE = path.resolve(__dirname, '..', 'adminUsers.json');

async function loadUsers() {
  try {
    const txt = await fs.readFile(USERS_FILE, 'utf8');
    const json = JSON.parse(txt || '{}');
    const arr = Array.isArray(json) ? json : Array.isArray(json.users) ? json.users : [];
    // Normalize: [{username, password}]
    return arr
      .filter(u => u && typeof u.username === 'string' && typeof u.password === 'string')
      .map(u => ({ username: u.username, password: u.password }));
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

// POST /api/admin/login  { username, password } -> { user }
router.post('/login', express.json(), async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ message: 'username and password required' });
    }
    const users = await loadUsers();

    // Case-insensitive username compare, exact password match
    const uname = String(username).trim();
    const found = users.find(u => u.username.toLowerCase() === uname.toLowerCase());

    if (!found || found.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Success — return canonical username
    res.json({ user: found.username });
  } catch (e) {
    res.status(500).json({ message: 'Login error' });
  }
});

module.exports = router;
