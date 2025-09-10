const db = require('../config/db');

const attachDBMiddleware = async (req, res, next) => {
    try {
        if (!req.db) {
            const { dynamoDB, documentClient } = await db.initializeDynamoDB();
            req.db = {
                dynamoDB,
                documentClient
            };
        }
        next();
    } catch (error) {
        console.error('❌ Database connection error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: error.code || 'DATABASE_ERROR',
                message: error.message,
                details: error.stack
            }
        });
    }
};

module.exports = { attachDBMiddleware };
