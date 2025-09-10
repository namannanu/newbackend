const express = require('express');
const cors = require('cors');
const colors = require('colors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const { initializeDynamoDB, dbOperations } = require('./config/db');
const path = require('path');



// Initialize Express app first
const app = express();

dotenv.config({
    path: path.join(__dirname, 'config', 'config.env'),
});

// Debug environment variables
console.log('Environment check:');
console.log('PORT:', process.env.PORT || 'Using default 3001');
console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? 'Found' : 'NOT FOUND');
console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? 'Found' : 'NOT FOUND');
console.log('AWS_REGION:', process.env.AWS_REGION || 'ap-south-1');

// CORS Configuration
const corsOptions = {
  origin: [
    'http://localhost:8080',  // Vite dev server
    'http://localhost:8081',  // Alternative Vite dev server port
    'http://localhost:3000',  // React dev server (if used)
    'http://localhost:3001',  // New server port
    'http://localhost:5173',  // Alternative Vite port
    
    process.env.FRONTEND_URL // Your Vercel frontend URL
  ].filter(Boolean),
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

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

// Debug route to verify API is working
app.get('/api/debug', (req, res) => {
    res.json({
        success: true,
        message: 'API is working',
        routes: {
            users: '/api/users/:userId/presigned-urls',
            aws: '/api/aws/aws-test'
        },
        env: {
            hasAwsCredentials: !!process.env.AWS_ACCESS_KEY_ID && !!process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || 'not set',
            bucket: process.env.AWS_S3_BUCKET || 'not set'
        }
    });
});

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


// Global error handling middleware
app.use((err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';

    console.error('ERROR 💥:', err);

    res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
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

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({
    status: 'error',
    message: err.message || 'Internal server error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Basic Routes
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/', (req, res) => res.send('Hello, World!'));
app.get('/favicon.png', (req, res) => res.status(204).end());

// Test route for API health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is working!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// AWS status check endpoint
app.get('/api/aws-status', (req, res) => {
  // Import the S3 client from amplify route to check status
  const amplifyRouter = require('./features/aws/routes/amplify');
  
  // This is a simplified check - in practice you might want to 
  // expose the s3Available status from your amplify module
  res.status(200).json({
    status: 'success',
    awsConfigured: !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY),
    awsRegion: process.env.AWS_REGION || 'ap-south-1',
    bucket: 'nfacialimagescollections',
    message: 'AWS status check complete'
  });
});

// Simple route to test users without auth (for debugging)
app.get('/api/users/test', async (req, res) => {
  try {
    const result = await dbOperations.query('Users', {
      Limit: 10,
      ProjectionExpression: 'userId, email, fullName, status'
    });
    
    res.status(200).json({
      status: 'success',
      count: result.items.length,
      data: result.items
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Simple route to test events without auth (for debugging)
app.get('/api/events/test', async (req, res) => {
  try {
    const result = await dbOperations.query('Events', {
      Limit: 10
    });
    
    res.status(200).json({
      status: 'success',
      count: result.items.length,
      data: result.items
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Simple route to test organizers without auth (for debugging)
app.get('/api/organizers/test', async (req, res) => {
  try {
    const result = await dbOperations.query('EventOrganiser', {
      Limit: 10
    });
    
    res.status(200).json({
      status: 'success',
      count: result.items.length,
      data: result.items
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});




// Define PORT
const PORT = process.env.PORT || 3000;

// Start server function - Wait for database connection first
const startServer = async () => {
  try {
    console.log('🚀 Starting application...'.blue.bold);
    
    // Connect to DynamoDB first and wait for it to complete
    console.log('🔄 Establishing DynamoDB connection...'.yellow);
    try {
      const dbConnection = await initializeDynamoDB();
      console.log('✅ DynamoDB connection established successfully!'.green.bold);
      
      // Add middleware to attach dbOperations to every request
      app.use((req, res, next) => {
        req.db = dbOperations;
        next();
      });
      
    } catch (dbError) {
      console.error('❌ DynamoDB connection failed:', dbError.message);
      if (process.env.NODE_ENV !== 'production') {
        throw dbError; // In development, fail fast
      }
      // In production, continue without DB but log the error
      console.warn('⚠️ Continuing without database in production mode'.yellow);
    }
    
    // Try to find an available port
    let PORT = process.env.PORT || 3000;
    

    // Start the server with the available port
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Server running on: http://localhost:${PORT}`.blue.underline.bold);
      console.log('🎉 Server is ready to accept requests!'.green.bold);
      console.log('📡 API endpoints are now available'.cyan);
      console.log('🌐 AWS S3 Status:', 
        (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) 
        ? 'Configured'.green 
        : 'Not Configured'.red);
    }).on('error', async (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`❌ Port ${PORT} is still in use, trying next port...`.yellow);
        PORT++;
        server.listen(PORT, '0.0.0.0');
      } else {
        console.error('❌ Server error:', err.message.red);
        process.exit(1);
      }
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('🛑 SIGTERM received. Shutting down gracefully...'.yellow);
      server.close(() => {
        console.log('✅ Server closed successfully.'.green);
      });
    });
    
    process.on('SIGINT', () => {
      console.log('🛑 SIGINT received. Shutting down gracefully...'.yellow);
      server.close(() => {
        console.log('✅ Server closed successfully.'.green);
        process.exit(0);
      });
    });
    
    return server;
    
  } catch (error) {
    console.error('❌ Failed to start server:'.red.bold);
    console.error('🔍 Error details:', error.message.red);
    console.error('📋 Full error:', error);
    
    // Provide helpful error messages
    if (error.message.includes('EADDRINUSE')) {
      console.error('💡 Tip: Port is already in use. Try a different port or kill existing processes'.yellow);
    }
    
    process.exit(1);
  }
};

// If running directly (not imported), start the server
if (require.main === module) {
  startServer();
}

// Export the app for Vercel serverless functions
module.exports = app;
