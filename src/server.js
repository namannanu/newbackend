const express = require('express');
const cors = require('cors');
const colors = require('colors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const { initializeDynamoDB } = require('./config/config');
const verifyAWSConnection = require('./utils/verifyAWSConnection');
const { attachDBMiddleware } = require('./shared/middlewares/db.middleware');
const path = require('path');

// Initialize Express app
const app = express();

// Load environment variables
dotenv.config({
    path: path.join(__dirname, 'config', 'config.env'),
});

// Configure CORS
app.use(cors({
    origin: true, // Allow all origins
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400 // CORS preflight cache time in seconds
}));

// Add OPTIONS handling for preflight requests
app.options('*', cors());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

        if (isAllowed) return callback(null, true);
        return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 204
};

// Basic Middleware
app.use(cors(corsOptions));
// Explicitly handle preflight for all routes (esp. on serverless)
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// Attach DB to all requests
app.use(attachDBMiddleware);

// Route logger middleware
app.use((req, res, next) => {
    console.log(`📡 ${req.method} ${req.url}`);
    next();
});

// Import routes
const eventRoutes = require('./features/events/event.routes');
const organizerRoutes = require('./features/organizers/organizer.routes');
const ticketRoute = require('./features/tickets/ticket.routes');
const feedbackRoutes = require('./features/feedback/feedback.routes');
const adminRoutes = require('./features/admin/admin.routes');
const registrationRoutes = require('./features/registrations/userEventRegistration.routes');
const userRoutes = require('./features/users/user.routes');
const authRoutes = require('./features/auth/auth.routes');
const awsDiagRoutes = require('./features/aws/routes/diag.routes');

// Root route - Vercel status
app.get('/', (req, res) => {
    res.json({
        status: 'success',
        message: 'API is running on Vercel',
        environment: process.env.VERCEL_ENV || 'development',
        deploymentUrl: process.env.VERCEL_URL || 'local'
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'API server is running',
        timestamp: new Date().toISOString()
    });
});

// Backward-compat: some clients call /api/health-check
app.get('/api/health-check', (req, res) => {
    res.status(200).json({
        status: 'success',
        message: 'API server is running',
        timestamp: new Date().toISOString()
    });
});

// Apply routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/organizers', organizerRoutes);
app.use('/api/tickets', ticketRoute);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/users', userRoutes);
// Backward-compat: some clients call /api/user (singular)
app.use('/api/user', userRoutes);
app.use('/api/aws', awsDiagRoutes);

// 404 handler
app.use((req, res, next) => {
    console.log('❌ 404 Not Found:', req.method, req.url);
    res.status(404).json({
        status: 'error',
        message: `Cannot ${req.method} ${req.url}`
    });
});

// Error handling middleware (must be last)
app.use((err, req, res, next) => {
    console.error('❌ Error:'.red, err.message);
    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
    });
});

// Initialize application
const initializeApp = async () => {
    try {
        console.log('🚀 Initializing application for Vercel deployment...'.blue);
        
        // Verify AWS connection
        await verifyAWSConnection();
        console.log('✅ AWS connection verified successfully'.green);

        // Test DynamoDB connection
        const { dynamoDB } = await initializeDynamoDB();
        await dynamoDB.listTables().promise();
        console.log('✅ DynamoDB connection test successful'.green);

        // Start the server
        const port = process.env.PORT || 3000;
        app.listen(port, () => {
            console.log(`🚀 Server running on port ${port}`.green);
            console.log('📡 API endpoints are available'.cyan);
            console.log('🌐 Environment:', process.env.VERCEL_ENV || 'development');
        });
    } catch (error) {
        console.error('❌ Application initialization error:'.red, error.message);
        if (process.env.VERCEL_ENV === 'development') {
            process.exit(1);
        }
    }
};

// Initialize the app
initializeApp().catch(console.error);

// Export the app for Vercel serverless functions
module.exports = app;
