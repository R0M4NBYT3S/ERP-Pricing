const db = require('./index');

/**
 * Assign an employee to a job
 */
async function assignEmployee({ job_id, employee_id, role }) {
  const res = await db.query(
    `INSERT INTO job_assignments (job_id, employee_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (job_id, employee_id, role) DO UPDATE
     SET assigned_at = now(), unassigned_at = NULL
     RETURNING *`,
    [job_id, employee_id, role]
  );
  return res.rows[0];
}

/**
 * Unassign an employee from a job
 */
async function unassignEmployee(job_id, employee_id, role) {
  const res = await db.query(
    `UPDATE job_assignments
     SET unassigned_at = now()
     WHERE job_id = $1 AND employee_id = $2 AND role = $3
     RETURNING *`,
    [job_id, employee_id, role]
  );
  return res.rows[0] || null;
}

/**
 * List all assignments for a job
 */
async function listAssignments(job_id) {
  const res = await db.query(
    `SELECT ja.*, e.name as employee_name, e.role as employee_role
     FROM job_assignments ja
     JOIN employees e ON e.id = ja.employee_id
     WHERE ja.job_id = $1
     ORDER BY ja.assigned_at ASC`,
    [job_id]
  );
  return res.rows;
}

module.exports = {
  assignEmployee,
  unassignEmployee,
  listAssignments,
};
