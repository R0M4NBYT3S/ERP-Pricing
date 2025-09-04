const db = require('./index');

/**
 * Create a new employee
 */
async function createEmployee({ name, email, phone, role }) {
  const result = await db.query(
    `INSERT INTO employees (name, email, phone, role)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [name, email, phone, role]
  );
  return result.rows[0];
}

/**
 * Get all employees
 */
async function listEmployees(activeOnly = false) {
  let sql = `SELECT * FROM employees ORDER BY created_at DESC`;
  let params = [];
  if (activeOnly) {
    sql = `SELECT * FROM employees WHERE active = true ORDER BY created_at DESC`;
  }
  const result = await db.query(sql, params);
  return result.rows;
}

/**
 * Get employee by ID
 */
async function getEmployeeById(id) {
  const result = await db.query(`SELECT * FROM employees WHERE id = $1`, [id]);
  return result.rows[0] || null;
}

/**
 * Update employee
 */
async function updateEmployee(id, data) {
  const fields = [];
  const values = [];
  let idx = 1;

  for (const key of Object.keys(data)) {
    fields.push(`${key} = $${idx}`);
    values.push(data[key]);
    idx++;
  }

  values.push(id);

  const sql = `UPDATE employees SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`;
  const result = await db.query(sql, values);
  return result.rows[0] || null;
}

/**
 * Delete employee (soft delete → set active = false)
 */
async function deactivateEmployee(id) {
  const result = await db.query(
    `UPDATE employees SET active = false WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

module.exports = {
  createEmployee,
  listEmployees,
  getEmployeeById,
  updateEmployee,
  deactivateEmployee,
};
