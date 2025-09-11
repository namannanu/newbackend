const express = require('express');
const router = express.Router();
const employeeController = require('./admin.employees.controller');
const authMiddleware = require('../auth/auth.middleware');
// Use the auth middleware's role-based guard

// Protect all routes after this middleware - requires login
router.use(authMiddleware.protect);

// Apply admin check to all routes
router.use(authMiddleware.restrictTo('admin'));

// GET /api/admin/employees - Get all employees
router.get('/', employeeController.getAllEmployees);

module.exports = router;
