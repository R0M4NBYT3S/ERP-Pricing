const express = require('express');
const router = express.Router();
const Assignments = require('../db/jobAssignments');
const { authRequired, requireRole } = require('../middleware/auth');

// 📌 Assign employee
router.post('/', authRequired, requireRole(['admin', 'office']), async (req, res) => {
  try {
    const { job_id, employee_id, role } = req.body;
    if (!job_id || !employee_id || !role) {
      return res.status(400).json({ error: 'job_id, employee_id, and role are required' });
    }
    const assignment = await Assignments.assignEmployee({ job_id, employee_id, role });
    res.status(201).json(assignment);
  } catch (err) {
    console.error('Error assigning employee:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📌 Unassign employee
router.post('/unassign', authRequired, requireRole(['admin', 'office']), async (req, res) => {
  try {
    const { job_id, employee_id, role } = req.body;
    const unassigned = await Assignments.unassignEmployee(job_id, employee_id, role);
    if (!unassigned) return res.status(404).json({ error: 'Assignment not found' });
    res.json(unassigned);
  } catch (err) {
    console.error('Error unassigning employee:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📌 List job assignments
router.get('/:jobId', authRequired, async (req, res) => {
  try {
    const assignments = await Assignments.listAssignments(req.params.jobId);
    res.json(assignments);
  } catch (err) {
    console.error('Error fetching assignments:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
