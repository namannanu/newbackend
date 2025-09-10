// admin-url-test.js - A minimal test file for the admin signed URL endpoint
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const AWS = require('aws-sdk');
const User = require('./features/users/user.model');

// JWT Secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access token is required' 
        });
    }

    try {
        console.log(`Verifying token: ${token.substring(0, 10)}...`);
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log('Token decoded:', {
            userId: decoded.userId,
            role: decoded.role || 'not specified',
            iat: decoded.iat,
            exp: decoded.exp
        });
        req.user = decoded;
        next();
    } catch (error) {
        console.error(`Token verification failed: ${error.message}`);
        return res.status(403).json({ 
            success: false, 
            message: 'Invalid or expired token',
            error: error.message 
        });
    }
};

// Test ping to verify this router is working
router.get('/ping', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Admin URL test router is working',
    timestamp: new Date().toISOString()
  });
});

// Admin signed URL endpoint
router.get('/admin-url/:userId', verifyToken, async (req, res) => {
  try {
    // Debug info to see what's coming in the request
    console.log(`Admin signed URL request for userId: ${req.params.userId}`);
    console.log(`Request from user:`, req.user);
    
    // Authorize admin based on token role
    if (!req.user.role || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
      console.log(`User ${req.user.userId} is not an admin. Role: ${req.user.role || 'none'}`);
      return res.status(403).json({ 
        success: false, 
        message: "Admins only" 
      });
    }

    console.log(`Admin verified: ${req.user.userId}`);
    const targetUserId = req.params.userId;
    console.log(`Looking up user ${targetUserId}`);
    
    // Find user
    const user = await User.get(targetUserId);
    
    if (!user) {
      console.log(`User ${targetUserId} not found`);
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    // Just return user info for now to test
    return res.status(200).json({
      success: true,
      message: 'Admin URL test endpoint success',
      user: {
        userId: user.userId,
        hasPhoto: !!user.uploadedPhoto,
        updatedAt: user.updatedAt
      },
      adminId: req.user.userId,
      adminRole: req.user.role
    });
  } catch (err) {
    console.error("Admin URL test error:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Error in admin URL test", 
      error: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
  }
});

module.exports = router;
