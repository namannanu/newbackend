const express = require('express');
const router = express.Router();
const User = require('../users/user.model');
const authMiddleware = require('../auth/auth.middleware');

// Test endpoint to get user with face ID
router.get('/test-face-id/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // First get the user
    const user = await User.get(userId);
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }
    
    // Then get the faceId separately
    const faceId = await User.getFaceIdFromFaceImageTable(userId);
    
    // Return both pieces of information
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          ...user,
          password: '[REDACTED]'
        },
        faceIdFromTable: faceId,
        hasFaceId: !!faceId
      }
    });
  } catch (error) {
    console.error('Error in test-face-id endpoint:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Test endpoint to check login response
router.post('/test-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide email and password'
      });
    }
    
    // Use findByEmail to get the user
    const user = await User.findByEmail(email);
    
    if (!user) {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid email or password'
      });
    }
    
    // Get faceId from FaceImage table
    const faceId = await User.getFaceIdFromFaceImageTable(user.userId);
    
    // Return user with faceId for testing
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          ...user,
          password: '[REDACTED]',
          faceId
        }
      }
    });
  } catch (error) {
    console.error('Error in test-login endpoint:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

module.exports = router;
