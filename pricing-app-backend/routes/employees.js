const express = require('express');
const router = express.Router();
const Employees = require('../db/employees');
const { authRequired, requireRole } = require('../middleware/auth');

// 📌 Create employee
router.post('/', authRequired, requireRole(['admin', 'office']), async (req, res) => {
  try {
    const { name, email, phone, role } = req.body;
    if (!name || !role) {
      return res.status(400).json({ error: 'Name and role are required' });
    }
    const employee = await Employees.createEmployee({ name, email, phone, role });
    res.status(201).json(employee);
  } catch (err) {
    console.error('Error creating employee:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📌 List employees
router.get('/', authRequired, async (req, res) => {
  try {
    const { active } = req.query;
    const employees = await Employees.listEmployees(active === 'true');
    res.json(employees);
  } catch (err) {
    console.error('Error fetching employees:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📌 Get employee by ID
router.get('/:id', authRequired, async (req, res) => {
  try {
    const employee = await Employees.getEmployeeById(req.params.id);
    if (!employee) return res.status(404).json({ error: 'Employee not found' });
    res.json(employee);
  } catch (err) {
    console.error('Error fetching employee:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📌 Update employee
router.patch('/:id', authRequired, requireRole(['admin', 'office']), async (req, res) => {
  try {
    const updated = await Employees.updateEmployee(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: 'Employee not found' });
    res.json(updated);
  } catch (err) {
    console.error('Error updating employee:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📌 Deactivate employee
router.delete('/:id', authRequired, requireRole(['admin']), async (req, res) => {
  try {
    const deactivated = await Employees.deactivateEmployee(req.params.id);
    if (!deactivated) return res.status(404).json({ error: 'Employee not found' });
    res.json({ message: 'Employee deactivated', employee: deactivated });
  } catch (err) {
    console.error('Error deactivating employee:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
