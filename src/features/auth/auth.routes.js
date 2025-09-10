const express = require('express');
const authController = require('./auth.controller');
const adminController = require('../admin/admin.controller');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/admin-login', authController.adminLogin);

// Public admin registration endpoint (use with caution)
router.post('/admin/register', adminController.registerAdmin);

router.post('/forgotPassword', authController.forgotPassword);
router.patch('/resetPassword/:token', authController.resetPassword);

// Add a token validation endpoint
router.get('/validate-token', authController.protect, authController.validateToken);

// Protect all routes after this middleware
router.use(authController.protect);

router.patch('/updateMyPassword', authController.updatePassword);

module.exports = router;