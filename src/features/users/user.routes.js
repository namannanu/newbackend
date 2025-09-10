
const express = require('express');
const userController = require('./user.controller');
const authController = require('../auth/auth.controller');
const authMiddleware = require('../auth/auth.middleware');
const presignedUrlController = require('./presigned-url.controller');

const router = express.Router();

// Protect all routes after this middleware
router.use(authController.protect);

// Routes for getting user profile
router.get('/userdetails', userController.getMyProfile);

// Routes for getting presigned URLs
router.get('/presigned-urls/:userId', presignedUrlController.getPresignedUrls);

// Restrict to admin users for the following routes
router.use(authController.restrictTo('admin'));

// Use a more robust approach for the admin routes
// First apply the auth controller protect middleware explicitly
router
  .route('/')
  .get(
    // Force authentication check
    (req, res, next) => {
      // Check if token exists
      let token;
      if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
      ) {
        token = req.headers.authorization.split(' ')[1];
      } else if (req.cookies.jwt) {
        token = req.cookies.jwt;
      }

      if (!token) {
        return res.status(401).json({
          status: 'fail',
          message: 'You are not logged in! Please log in to get access.'
        });
      }
      
      // Continue with the next middleware
      next();
    },
    authController.protect, 
    authMiddleware.verifyAdminToken, 
    userController.getAllUsers
  );

router
  .route('/:id')
  .get(userController.getUser)
  .patch(userController.updateUser)
  .delete(userController.deleteUser);

router
  .route('/:id/verify-face')
  .post(userController.verifyUserFace);

// Debug route to verify API is working
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Users API is working',
        timestamp: new Date().toISOString()
    });
});

// Test route to verify API is accessible
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Users API is working',
        timestamp: new Date().toISOString()
    });
});

// Add this new route for pre-signed URLs
router.get('/:userId/presigned-urls', authMiddleware.protect, presignedUrlController.getPresignedUrls);


module.exports = router;
