const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../../users/user.model');
const router = express.Router();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ 
            success: false, 
            message: 'Invalid or expired token' 
        });
    }
};

// Get image status endpoint
router.get('/get-image-status/:userId', verifyToken, async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // Security check - can only access own data unless admin
        if (req.user.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to access this user\'s data'
            });
        }
        
        // Look up user in database
        const user = await User.findOne({ email: `${userId}@example.com` });
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Check if user has uploaded photo
        const hasUploadedImage = !!user.uploadedPhoto;
        
        // Return appropriate response
        if (hasUploadedImage) {
            return res.status(200).json({
                success: true,
                hasUploadedImage: true,
                imageUrl: user.uploadedPhoto,
                message: 'User has an uploaded image'
            });
        } else {
            return res.status(200).json({
                success: true,
                hasUploadedImage: false,
                message: 'User has not uploaded an image'
            });
        }
        
    } catch (error) {
        console.error('[ERROR] Getting Image Status Failed:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get image status',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// Delete image endpoint
router.delete('/delete-image/:userId', verifyToken, async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // Security check
        if (req.user.userId !== userId) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to delete this user\'s image'
            });
        }
        
        // Find and update user
        const user = await User.findOneAndUpdate(
            { email: `${userId}@example.com` },
            { $set: { uploadedPhoto: null, updatedAt: new Date() } },
            { new: true }
        );
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        return res.status(200).json({
            success: true,
            message: 'Image successfully deleted'
        });
        
    } catch (error) {
        console.error('[ERROR] Deleting Image Failed:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete image',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

module.exports = router;
