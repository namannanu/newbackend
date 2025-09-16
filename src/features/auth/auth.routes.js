const express = require('express');
const authController = require('./auth.controller');
const adminController = require('../admin/admin.controller');
const userController = require('../users/user.controller');

const router = express.Router();

// Diagnostic endpoint to check deployment info, headers, and registered routes
router.get('/debug', (req, res) => {
    // Extract route info from the router stack
    const routes = [];
    router.stack.forEach((layer) => {
        if (layer.route && layer.route.path) {
            const methods = Object.keys(layer.route.methods)
                .filter((m) => layer.route.methods[m])
                .map((m) => m.toUpperCase());
            routes.push({ methods, path: layer.route.path });
        } else if (layer.name === 'router' && layer.handle && layer.handle.stack) {
            // Nested routers
            layer.handle.stack.forEach((nested) => {
                if (nested.route && nested.route.path) {
                    const methods = Object.keys(nested.route.methods)
                        .filter((m) => nested.route.methods[m])
                        .map((m) => m.toUpperCase());
                    routes.push({ methods, path: nested.route.path });
                }
            });
        }
    });

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
        routes,
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

// Current authenticated user's profile
router.get('/profile', userController.getMyProfile);

router.patch('/updateMyPassword', authController.updatePassword);

module.exports = router;
