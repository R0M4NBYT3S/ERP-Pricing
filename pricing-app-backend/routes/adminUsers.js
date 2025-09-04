const express = require('express');
const router = express.Router();
const { createUser, getAllUsers, deleteUserById } = require('../db/users'); // ⬅️ added deleteUserById
const { authRequired, requireRole } = require('../middleware/auth');

// 🔒 Only admins can create users
router.post('/', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const { email, name, role = 'shop', password } = req.body;
    if (!email || !name || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const user = await createUser({ email, name, role, password });
    res.status(201).json(user);
  } catch (err) {
    console.error('Error creating user:', err);

    if (err.message === 'Email already in use') {
      return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: 'Server error' });
  }
});

// 🔒 Only admins can list users
router.get('/', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const users = await getAllUsers();
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 🔒 Only admins can delete users
router.delete('/:id', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const targetId = req.params.id;

    // Prevent self-deletion
    if (req.user.id === targetId) {
      return res.status(400).json({ error: 'You cannot delete your own account while logged in.' });
    }

    const deleted = await deleteUserById(targetId);
    if (!deleted) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted', user: deleted });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
