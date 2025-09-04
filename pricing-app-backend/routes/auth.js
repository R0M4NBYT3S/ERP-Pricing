// routes/auth.js
const express = require('express');
const router = express.Router();
const { verifyUser } = require('../db/users');
const { signToken, COOKIE_NAME } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing credentials' });
    }

    const user = await verifyUser(email, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);

    // Set HttpOnly cookie for browser usage
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production'
    });

    // Also return the token in JSON for API clients / Postman
    return res.json({
      user,
      token, // <-- handy for Postman and frontend headers
    });
  } catch (e) {
    console.error('Login error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  try {
    const token =
      req.cookies?.[COOKIE_NAME] ||
      req.headers['authorization']?.replace('Bearer ', '');

    if (!token) return res.json({ user: null });

    const jwt = require('jsonwebtoken');
    const data = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
    res.json({ user: data });
  } catch {
    res.json({ user: null });
  }
});

module.exports = router;
