const express = require('express');
const router = express.Router();
mkdir -p pricing-app-backend/routes
cat > pricing-app-backend/routes/calc.js <<'EOF'
const express = require('express');
const router = express.Router();

// prove route is alive
router.get('/', (req, res) => {
  res.status(200).json({ ok: true, route: '/api/calc' });
});

// stub POST — echoes payload so the frontend can test
router.post('/', (req, res) => {
  const payload = req.body || {};
  res.status(200).json({
    ok: true,
    message: 'calc stub response',
    received: payload
  });
});

module.exports = router;
