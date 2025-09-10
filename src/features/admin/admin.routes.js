const express = require('express');
const adminController = require('./admin.controller');
const authController = require('../auth/auth.controller');

const router = express.Router();

// Protect all routes
router.use(authController.protect);

// Restrict to admin users
router.use(authController.restrictTo('admin'));

// Admin dashboard routes
router.get('/stats', adminController.getStats);

// Employee management routes
router.post('/employees', adminController.createEmployee);
router.get('/employees', adminController.getAllEmployees);
router.patch('/employees/permissions', adminController.updateEmployeePermissions);
router.delete('/employees/:id', adminController.deleteEmployee);

// Admin user management routes
router.post('/admin-users', adminController.createAdminUser);
router.get('/admin-users', adminController.getAllAdminUsers);

// Admin registration route (protected)
router.post('/register', adminController.registerAdmin);

// Face data management routes
router.get('/users/:userId/face-data', adminController.checkFaceId);

module.exports = router;