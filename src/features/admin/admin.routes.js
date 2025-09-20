const express = require('express');
const adminController = require('./admin.controller');
const authController = require('../auth/auth.controller');
const employeeRoutes = require('./admin.employees.routes');

const router = express.Router();

// Protect all routes
router.use(authController.protect);

// Restrict to admin users
router.use(authController.restrictTo('admin'));

// Admin dashboard routes
router.get('/stats', adminController.getStats);

// Employee management routes
router.use('/employees', employeeRoutes);

// Admin user management routes
router.post('/admin-users', adminController.createAdminUser);
router.get('/admin-users', adminController.getAllAdminUsers);

// Admin registration route (protected)
router.post('/register', adminController.registerAdmin);

// Face data management routes
router.get('/users/:userId/face-data', adminController.checkFaceId);
router.post('/users/:userId/issue-tickets', adminController.issuePendingTickets);

module.exports = router;
