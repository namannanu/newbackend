const express = require('express');
const router = express.Router();
const employeeController = require('./admin.employees.controller');
const authMiddleware = require('../auth/auth.middleware');
const adminMiddleware = require('../../shared/middlewares/admin.middleware');

// Protect all routes after this middleware - requires login
router.use(authMiddleware.protect);

// Apply admin check to all routes
router.use(adminMiddleware.restrictTo('admin'));

// GET /api/admin/employees - Get all employees
router.get('/', employeeController.getAllEmployees);

module.exports = router;
