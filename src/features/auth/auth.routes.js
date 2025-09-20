const express = require('express');
const authController = require('./auth.controller');
const adminController = require('../admin/admin.controller');
const userController = require('../users/user.controller');

const router = express.Router();



router.post('/signup', authController.signup);
// Alias commonly used by clients
router.post('/register', authController.signup);
router.post('/phone/signup/request-otp', authController.requestSignupOtp);
router.post('/phone/signup/verify-otp', authController.verifySignupOtp);
router.post('/login', authController.login);
router.post('/google/login', authController.googleLogin);
router.post('/phone/login/request-otp', authController.requestPhoneLoginOtp);
router.post('/phone/login/verify-otp', authController.verifyPhoneLoginOtp);
router.post('/admin-login', authController.adminLogin);

// Public admin registration endpoint (use with caution)
router.post('/admin/register', adminController.registerAdmin);


router.get('/checkfaceid', authController.checkFaceId);
router.post('/checkfaceid', authController.checkFaceId);


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

