const adminMiddleware = async (req, res, next) => {
    try {
        // Get the authorization header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Admin access requires authentication'
                }
            });
        }

        // Get the token
        const token = authHeader.split(' ')[1];
        
        // In Vercel environment, validate against environment variable
        const adminToken = process.env.ADMIN_API_TOKEN;
        if (!adminToken) {
            console.error('❌ ADMIN_API_TOKEN not set in environment variables');
            return res.status(500).json({
                success: false,
                error: {
                    code: 'CONFIGURATION_ERROR',
                    message: 'Admin authentication not properly configured'
                }
            });
        }

        // Validate the token
        if (token !== adminToken) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'FORBIDDEN',
                    message: 'Invalid admin credentials'
                }
            });
        }

        // If we get here, the token is valid
        console.log('✅ Admin access granted');
        next();
    } catch (error) {
        console.error('❌ Admin middleware error:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Error processing admin authentication'
            }
        });
    }
};

module.exports = { adminMiddleware };
