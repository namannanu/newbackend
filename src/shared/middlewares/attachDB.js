const AWS = require('aws-sdk');
const { initializeDynamoDB } = require('../../config/db');

// Middleware to attach DynamoDB connection to request
const attachDBMiddleware = async (req, res, next) => {
    try {
        await initializeDynamoDB();
        
        // Add DynamoDB client to request object
        if (!req.db) {
            req.db = {
                dynamoDB: new AWS.DynamoDB(),
                docClient: new AWS.DynamoDB.DocumentClient()
            };
        }
        
        next();
    } catch (error) {
        console.error('❌ Database connection error:', error);
        res.status(500).json({
            success: false,
            message: 'Database connection error',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = attachDBMiddleware;
