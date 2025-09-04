// middleware/auth.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const COOKIE_NAME = 'erp_token';

// 🔑 Create a JWT for a given payload
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// 🔒 Middleware: require authentication
function authRequired(req, res, next) {
  let token = null;

  // Try cookie first
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    token = req.cookies[COOKIE_NAME];
  }

  // Fallback to Authorization: Bearer <token>
  if (!token && req.headers['authorization']) {
    const header = req.headers['authorization'];
    if (header.startsWith('Bearer ')) {
      token = header.substring(7, header.length);
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: no token provided' });
  }

  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data; // { id, email, name, role }
    return next();
  } catch (e) {
    console.error('❌ Auth verification failed:', e.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// 🔒 Middleware: role-gate
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Normalize input: string → array, array → itself
    const allowed = Array.isArray(roles) ? roles : [roles];

    if (!allowed.includes(req.user.role)) {
      return res
        .status(403)
        .json({ error: `Forbidden: requires role ${allowed.join(', ')}` });
    }

    next();
  };
}

module.exports = { signToken, authRequired, requireRole, COOKIE_NAME };
