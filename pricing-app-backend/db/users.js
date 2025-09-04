const db = require('./index');
const bcrypt = require('bcrypt');

// Create a new user with hashed password
async function createUser({ email, name, role = 'shop', password }) {
  const normalizedEmail = email.toLowerCase();
  const password_hash = await bcrypt.hash(password, 12);

  try {
    const res = await db.query(
      `INSERT INTO users (email, name, role, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at`,
      [normalizedEmail, name, role, password_hash]
    );
    return res.rows[0];
  } catch (err) {
    // Postgres uses code 23505 for unique constraint violations
    if (err.code === '23505') {
      throw new Error('Email already in use');
    }
    throw err;
  }
}



// Fetch a user by email (including password_hash for verification)
async function getUserByEmail(email) {
  const normalizedEmail = email.toLowerCase();

  const res = await db.query(
    `SELECT id, email, name, role, password_hash, created_at
     FROM users WHERE email = $1`,
    [normalizedEmail]
  );

  return res.rows[0] || null;
}

// Verify user credentials
async function verifyUser(email, password) {
  const user = await getUserByEmail(email);
  if (!user) return null;

  try {
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return null;

    // Return safe object without password hash
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      created_at: user.created_at,
    };
  } catch (err) {
    console.error('bcrypt compare failed:', err);
    return null;
  }
}

// List all users (safe fields only)
async function getAllUsers() {
  const res = await db.query(
    `SELECT id, email, name, role, created_at
     FROM users
     ORDER BY created_at DESC`
  );
  return res.rows;
}

async function deleteUserById(id) {
  const res = await db.query(
    `DELETE FROM users WHERE id = $1 RETURNING id, email, name, role`,
    [id]
  );
  return res.rows[0] || null;
}

module.exports = {
  createUser,
  getUserByEmail,
  verifyUser,
  getAllUsers,
  deleteUserById,
};

