// scripts/createUser.js
require('dotenv').config();
const { createUser } = require('../db/users');

(async () => {
  try {
    const email = process.argv[2];
    const name = process.argv[3];
    const role = process.argv[4] || 'shop';
    const password = process.argv[5];

    if (!email || !name || !password) {
      console.error('Usage: node scripts/createUser.js <email> <name> [role] <password>');
      process.exit(1);
    }

    const user = await createUser({ email, name, role, password });
    console.log('✅ User created:', user);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating user:', err);
    process.exit(1);
  }
})();
