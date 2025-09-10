const { initializeDynamoDB } = require('../config/config');

/**
 * Middleware to attach DynamoDB instances to the request object
 */
const attachDBMiddleware = async (req, res, next) => {
    try {
        // Get or initialize DynamoDB connection
        const { dynamoDB, documentClient } = await initializeDynamoDB();
        
        // Attach DB instances to the request object
        req.db = {
            dynamoDB,
            documentClient
        };
        
        next();
    } catch (error) {
        console.error('❌ Failed to attach DB middleware:'.red, error.message);
        res.status(500).json({
            success: false,
            error: 'Database connection failed'
        });
    }
};

module.exports = {
    attachDBMiddleware
};
