const express = require("express");
const multer = require("multer");
const { S3Client, PutObjectCommand, DeleteObjectCommand, ListBucketsCommand } = require("@aws-sdk/client-s3");
const { fromNodeProviderChain } = require("@aws-sdk/credential-providers");
const AWS = require('aws-sdk');
const jwt = require('jsonwebtoken');
const User = require('../../users/user.model');

// Import S3 signed URL service
const { getSignedImageUrl, checkObjectExists, getMultipleSignedUrls } = require('../s3-signed-url.service');

const router = express.Router();

// In-memory storage for user uploads
const userUploads = new Map();

// Debug: indicate router load
console.log('[Amplify] Router module loaded.');

// Simple ping to verify base mount (/api)
router.get('/test-ping', (req, res) => {
  res.status(200).json({ success: true, message: 'Amplify router alive', timestamp: new Date().toISOString() });
});

// List registered routes on this router (debug)
router.get('/_debug/routes', (req, res) => {
  try {
    const routes = (router.stack || [])
      .filter((l) => l.route)
      .map((l) => ({ methods: Object.keys(l.route.methods), path: l.route.path }));
    res.status(200).json({ success: true, count: routes.length, routes });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to enumerate routes', error: e.message });
  }
});

// This is all the same code, just keeping the original file structure
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

// Initialize S3 client with IAM Role credentials
let s3;
let s3Available = false;

try {
    const awsConfig = {
        region: process.env.AWS_REGION || "ap-south-1",
        credentials: fromNodeProviderChain()
    };

    s3 = new S3Client(awsConfig);
    s3Available = true;
    console.log('[INFO] S3 client initialized successfully');
} catch (s3Error) {
    console.error("[ERROR] S3 client initialization failed:", s3Error.message);
    s3Available = false;
}

// Configure multer and other setup code
// ... (keeping the same as original)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "image/jpeg" || file.mimetype === "image/png" || file.mimetype === "image/jpg") {
            cb(null, true);
        } else {
            cb(new Error("Invalid file type. Only JPEG, JPG and PNG are allowed."), false);
        }
    }
});

// Helper: small delay
const sleep = (ms) => new Promise(res => setTimeout(res, ms));

// All the routes remain the same
// ...

// ADMIN: Get signed URLs for any user by userId
// Here's the key change - removing the '/s3' prefix from the path
router.get("/admin/signed-urls/:userId", verifyToken, async (req, res) => {
  try {
    // Debug info to see what's coming in the request
    console.log(`Admin signed URL request for userId: ${req.params.userId}`);
    console.log(`Request from user:`, req.user);
    
    // Authorize admin based on AdminUsers table (token only carries userId)
    const adminUserId = req.user && req.user.userId;
    if (!adminUserId) {
      console.log("No userId found in token");
      return res.status(401).json({ success: false, message: "Unauthorized - No user ID" });
    }

    const Admin = require('../../admin/admin.model');
    console.log(`Checking if ${adminUserId} is an admin...`);
    
    // Try to find admin record
    const adminRecord = await Admin.get(adminUserId);
    
    // If no admin record or not admin role, check if it might be a superadmin
    if (!adminRecord || (adminRecord.role && adminRecord.role !== 'admin')) {
      console.log(`User ${adminUserId} is not in admin table or not admin role.`);
      // Also accept 'superadmin' role if present in token
      if (req.user.role === 'admin' || req.user.role === 'superadmin') {
        console.log(`But token has role: ${req.user.role}, so allowing access`);
      } else {
        console.log(`Role in token: ${req.user.role || 'none'}`);
        return res.status(403).json({ success: false, message: "Admins only" });
      }
    } else {
      console.log(`Admin verified: ${adminUserId}`);
    }

    const targetUserId = req.params.userId;
    console.log(`Looking up user ${targetUserId}`);
    
    // First try to find in User model
    const user = await User.get(targetUserId);
    
    if (!user) {
      console.log(`User ${targetUserId} not found`);
      return res.status(404).json({ success: false, message: "User not found" });
    }
    
    if (!user.uploadedPhoto) {
      console.log(`User ${targetUserId} has no uploaded photo`);
      return res.status(404).json({ success: false, message: "User has no uploaded photo" });
    }
    
    console.log(`Found user photo: ${user.uploadedPhoto}`);

    // Derive S3 key from stored value (URL or key)
    let key = user.uploadedPhoto;
    try {
      if (/^https?:\/\//i.test(user.uploadedPhoto)) {
        const url = new URL(user.uploadedPhoto);
        key = url.pathname.replace(/^\//, "");
        console.log(`Extracted S3 key from URL: ${key}`);
      }
    } catch (err) {
      console.log(`Error parsing URL: ${err.message}`);
    }

    const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME || 'nfacialimagescollections';
    const expiresSec = Math.max(60, parseInt(req.query.expires, 10) || 3600); // min 60s
    
    console.log(`Generating signed URL for bucket: ${bucket}, key: ${key}, expires: ${expiresSec}s`);
    
    // Create AWS S3 instance for direct access
    const s3 = new AWS.S3({
      region: process.env.AWS_REGION || 'ap-south-1',
      signatureVersion: 'v4'
    });
    
    let signedUrl;
    try {
      // Use getSignedUrl instead of custom function for more direct control
      signedUrl = await s3.getSignedUrlPromise('getObject', {
        Bucket: bucket,
        Key: key,
        Expires: expiresSec
      });
      console.log(`Generated signed URL successfully`);
    } catch (signErr) {
      console.error(`Error generating signed URL: ${signErr.message}`);
      return res.status(500).json({
        success: false,
        message: "Failed to generate signed URL for image",
        error: process.env.NODE_ENV === 'development' ? signErr.message : undefined
      });
    }

    return res.status(200).json({
      success: true,
      urls: { uploadedPhoto: signedUrl, aadhaarPhoto: user.aadhaarPhoto || null },
      user: {
        userId: user.userId,
        uploadedPhoto: user.uploadedPhoto,
        updatedAt: user.updatedAt
      },
      bucket,
      expiresIn: expiresSec,
      s3Key: key
    });
  } catch (err) {
    console.error("Admin signed URL error:", err);
    return res.status(500).json({ success: false, message: "Error generating signed URL", error: process.env.NODE_ENV === 'development' ? err.message : undefined });
  }
});

// Other existing routes and exports remain the same
// ...
module.exports = router;
