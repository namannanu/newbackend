const express = require('express');
const router = express.Router();
const verifyAWSCredentials = require('../utils/verify-aws');
const { attachDB } = require('../shared/middlewares/attachDB');
const { adminMiddleware } = require('../shared/middlewares/admin.middleware');

// Protected route - only admins can verify AWS credentials
router.get('/verify-aws-credentials', attachDB, adminMiddleware, async (req, res) => {
    try {
        const result = await verifyAWSCredentials();
        res.json({
            success: true,
            data: {
                identity: result.identity,
                tables: result.tables,
                message: 'AWS credentials verified successfully'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: {
                code: error.code,
                message: error.message,
                details: error.stack
            }
        });
    }
});

module.exports = router;
