const express = require('express');
const authController = require('./auth.controller');
const adminController = require('../admin/admin.controller');

const router = express.Router();

// Diagnostic endpoint to check deployment info and headers
router.get('/debug', (req, res) => {
    res.json({
        message: 'Auth debug info',
        environment: process.env.VERCEL_ENV || 'development',
        deploymentUrl: process.env.VERCEL_URL || 'local',
        headers: req.headers,
        cors: {
            origin: req.headers.origin,
            method: req.method,
            credentials: req.headers['access-control-request-credentials'],
            requestHeaders: req.headers['access-control-request-headers']
        },
        timestamp: new Date().toISOString()
    });
});

router.post('/signup', authController.signup);
// Alias commonly used by clients
router.post('/register', authController.signup);
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
