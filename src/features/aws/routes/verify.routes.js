const express = require('express');
const router = express.Router();
const verifyAWSCredentials = require('../../../utils/verify-aws');
const { attachDBMiddleware } = require('../../../middleware/db.middleware');
const { adminMiddleware } = require('../../../middleware/admin.middleware');

// Protected route - only admins can verify AWS credentials
router.get('/verify-aws-credentials', attachDBMiddleware, adminMiddleware, async (req, res) => {
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
