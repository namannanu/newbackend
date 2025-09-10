const express = require('express');
const router = express.Router();
const AWS = require('aws-sdk');

router.get('/aws-test', async (req, res) => {
    try {
        // Initialize S3 with current configuration
        const s3 = new AWS.S3({
            apiVersion: '2006-03-01',
            region: process.env.AWS_REGION,
            signatureVersion: 'v4'
        });

        // Test AWS configuration
        const testResult = {
            config: {
                region: process.env.AWS_REGION,
                bucket: process.env.AWS_S3_BUCKET,
                hasAccessKeyId: !!process.env.AWS_ACCESS_KEY_ID,
                hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY
            }
        };

        // Try to list buckets as a credentials test
        try {
            const buckets = await s3.listBuckets().promise();
            testResult.bucketsTest = {
                success: true,
                count: buckets.Buckets.length
            };
        } catch (error) {
            testResult.bucketsTest = {
                success: false,
                error: error.message
            };
        }

        // Try to list objects in the specified bucket
        if (process.env.AWS_S3_BUCKET) {
            try {
                const objects = await s3.listObjectsV2({
                    Bucket: process.env.AWS_S3_BUCKET,
                    MaxKeys: 1
                }).promise();
                testResult.bucketTest = {
                    success: true,
                    hasContents: objects.Contents.length > 0
                };
            } catch (error) {
                testResult.bucketTest = {
                    success: false,
                    error: error.message
                };
            }
        }

        res.json({
            success: true,
            ...testResult
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
