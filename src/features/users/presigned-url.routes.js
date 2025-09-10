const express = require('express');
const router = express.Router();
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const User = require('./user.model');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Configure S3 (v3 client)
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  } : undefined
});

// Get presigned URLs for user's images
router.get('/:userId/presigned-urls', async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch user by userId (DynamoDB-backed model)
    const user = await User.get(userId);

    console.log('🔍 User lookup result:', {
      userIdParam: userId,
      userFound: !!user,
      hasUploadedPhoto: !!(user && user.uploadedPhoto)
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        details: `No user found with id: ${userId}`
      });
    }

    // If no uploaded photo, return empty array but include user info
    if (!user.uploadedPhoto) {
      return res.status(200).json({
        success: true,
        images: [],
        user: {
          userId: user.userId,
          verificationStatus: user.verificationStatus
        }
      });
    }

    // Resolve bucket and key
    const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME || 'nfacialimagescollections';

    // Derive the S3 key from the stored value which may be a full URL or already a key
    let key = user.uploadedPhoto;
    try {
      if (/^https?:\/\//i.test(user.uploadedPhoto)) {
        const url = new URL(user.uploadedPhoto);
        key = url.pathname.replace(/^\//, '');
      }
    } catch (_) {
      // If URL parsing fails, assume it's already an S3 object key
    }

    // Generate presigned URL
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.status(200).json({
      success: true,
      images: [{
        url: presignedUrl,
        originalUrl: user.uploadedPhoto,
        filename: key.split('/').pop(),
        isPublic: false,
        uploadedAt: user.updatedAt
      }]
    });

  } catch (error) {
    console.error('Error in presigned URL generation:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
