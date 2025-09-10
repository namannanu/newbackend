const express = require('express');
const cors = require('cors');
const colors = require('colors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const { initializeDynamoDB, dbOperations } = require('./config/db');
const verifyAWSCredentials = require('./utils/verify-aws');
const verifyRoutes = require('./features/aws/routes/verify.routes');
const path = require('path');


// Initialize Express app first
const app = express();

dotenv.config({
    path: path.join(__dirname, 'config', 'config.env'),
});

// CORS Configuration for Vercel deployment
const corsOptions = {
    origin: process.env.VERCEL_URL ? [
        `https://${process.env.VERCEL_URL}`,
        'https://*.vercel.app'
    ] : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

// Verify AWS credentials on startup
verifyAWSCredentials()
    .then(() => {
        console.log('\n✅ AWS credentials verified successfully on startup'.green);
    })
    .catch((error) => {
        console.error('\n❌ AWS credential verification failed on startup:'.red);
        console.error('Error:', error.message);
        // Don't exit - let the app try to start anyway in case it's in local mode
    });



// Import DB middleware
const attachDBMiddleware = require('./shared/middlewares/attachDB');

// Route logger middleware
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.url}`);
  next();
});

// Import routes
const presignedUrlRoutes = require('./features/users/presigned-url.routes');

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); 
app.use(cookieParser());
app.use(morgan('dev'));
app.use(attachDBMiddleware);

// Debug middleware for user routes
app.use('/api/users/:userId/*', (req, res, next) => {
    console.log('🔍 User ID Debug:', {
        paramUserId: req.params.userId,
        path: req.path,
        method: req.method
    });
    next();
});

// Routes
app.use('/api/users', presignedUrlRoutes);

// Import feature routes
const awsRoutes = require('./features/aws/aws-debug.routes');


// Simple health check route - no DB queries, just a quick response
app.get('/api/health', (req, res) => {
    res.json({
        status: 'success',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

// Make sure we register the routes after defining endpoints
const eventRoutes = require('./features/events/event.routes');
const organizerRoutes = require('./features/organizers/organizer.routes'); 
const organizerPublicRoutes = require('./features/organizers/organizer-public.routes'); 
const ticketRoute = require('./features/tickets/ticket.routes');
const feedbackRoutes = require('./features/feedback/feedback.routes');
const adminRoutes = require('./features/admin/admin.routes');
const registrationRoutes = require('./features/registrations/userEventRegistration.routes');
const userRoutesNew = require('./features/users/user.routes');
const authRoutes = require('./features/auth/auth.routes');
const amplifyRoutes = require('./features/aws/routes/amplify');
const adminPublicRoutes = require('./features/admin/admin-public.routes');
const testFaceIdRoutes = require('./features/users/test-face-id.routes');
// Admin URL test router (for debugging admin signed URL)
const adminUrlTestRouter = require('./admin-url-test');
// Debug registered routes
console.log('🔄 Registering routes...');

// Use feature routes
app.use('/api/auth', authRoutes);
console.log('✅ Auth routes registered');

app.use('/api/events', eventRoutes);
console.log('✅ Event routes registered');

app.use('/api/organizers', organizerRoutes);
console.log('✅ Organizer routes registered');

app.use('/api/public/organizers', organizerPublicRoutes);
console.log('✅ Public organizer routes registered');

app.use('/api/tickets', ticketRoute);
console.log('✅ Ticket routes registered');

app.use('/api/feedback', feedbackRoutes);
console.log('✅ Feedback routes registered');

app.use('/api/admin', adminRoutes);
app.use('/api/admin', verifyRoutes); // Add AWS verification routes
console.log('✅ Admin routes registered');

app.use('/api/registrations', registrationRoutes);
console.log('✅ Registration routes registered');

// Add security middleware specifically for user routes
app.use('/api/user', (req, res, next) => {
  // Skip authentication check for specific endpoints like login
  if (req.path === '/login' || req.path === '/signup') {
    return next();
  }
  
  // Check for authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'fail',
      message: 'Authentication required for accessing user API'
    });
  }
  
  next();
}, userRoutesNew);
console.log('✅ User routes registered with enhanced security');

app.use('/api', amplifyRoutes);
console.log('✅ Amplify routes registered');

// The test router is already imported above
// Mount the test router at /api/test-admin-url
app.use('/api/test-admin-url', adminUrlTestRouter);
console.log('✅ Admin URL Test router registered at /api/test-admin-url');
app.use('/api/test', testFaceIdRoutes);
console.log('✅ Test Face ID routes registered');


// Import and use image status routes
const imageStatusRoutes = require('./features/aws/routes/image-status');
app.use('/api', imageStatusRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'success', 
    message: 'API server is running', 
    timestamp: new Date().toISOString() 
  });
});


// Print out all registered routes
app._router.stack.forEach((middleware) => {
  if (middleware.route) {
    // Routes registered directly
    console.log(`Route: ${Object.keys(middleware.route.methods)} ${middleware.route.path}`);
  } else if (middleware.name === 'router') {
    // Router middleware
    middleware.handle.stack.forEach((handler) => {
      if (handler.route) {
        console.log(`Route: ${Object.keys(handler.route.methods)} ${middleware.regexp} ${handler.route.path}`);
      }
    });
  }
});

// 404 handler
app.use((req, res, next) => {
  console.log('❌ 404 Not Found:', req.method, req.url);
  res.status(404).json({
    status: 'error',
    message: `Cannot ${req.method} ${req.url}`
  });
});


// Root route
app.get('/', (req, res) => {
  res.json({
    status: 'success',
    message: 'API is running on Vercel',
    environment: process.env.VERCEL_ENV || 'development',
    deploymentUrl: process.env.VERCEL_URL || 'local'
  });
});






// Initialize DynamoDB connection
const initializeApp = async () => {
  try {
    console.log('🚀 Initializing application for Vercel deployment...'.blue.bold);
    
    // Connect to DynamoDB
    console.log('🔄 Establishing DynamoDB connection...'.yellow);
    const dbConnection = await initializeDynamoDB();
    console.log('✅ DynamoDB connection established successfully!'.green.bold);
    
    // Attach database operations to app
    app.use((req, res, next) => {
      req.db = dbOperations;
      next();
    });

    console.log('✅ Application initialized successfully'.green);
    console.log('📡 API endpoints are available'.cyan);
    console.log('🌐 Environment:', process.env.VERCEL_ENV || 'development');
    
  } catch (error) {
    console.error('❌ Application initialization error:'.red, error.message);
    // Don't throw error in production, let Vercel handle it
    if (process.env.VERCEL_ENV === 'development') {
      throw error;
    }
  }
};

// Initialize the app for Vercel
initializeApp().catch(console.error);

// Export the app for Vercel serverless functions
module.exports = app;
