const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({
    path: path.join(__dirname, 'src', 'config', 'config.env'),
});

console.log('========== Route Diagnostic Tool ==========');

// Create a simple diagnostic server
const app = express();

// Import the router we want to diagnose
console.log('Importing amplify routes...');
const amplifyRoutes = require('./src/features/aws/routes/amplify');

// Create a temporary router to list routes
const listRouter = (router) => {
    if (!router || !router.stack) {
        console.log('No router stack found!');
        return [];
    }
    
    return router.stack
        .filter(layer => layer.route)
        .map(layer => {
            const route = layer.route;
            const methods = Object.keys(route.methods).map(m => m.toUpperCase()).join(', ');
            return {
                path: route.path,
                methods,
                regexp: route.path === '*' ? '*' : layer.regexp.toString()
            };
        });
};

// Get all routes
console.log('Analyzing routes...');
const routes = listRouter(amplifyRoutes);

// Print routes
console.log(`\nFound ${routes.length} routes in amplify.js:`);
console.log('-'.repeat(80));
console.log('METHOD\t| PATH\t\t\t\t| REGEX');
console.log('-'.repeat(80));
routes.forEach(route => {
    // Pad the path for better readability
    let paddedPath = route.path;
    while (paddedPath.length < 24) paddedPath += ' ';
    
    console.log(`${route.methods}\t| ${paddedPath}\t| ${route.regexp}`);
});

// Specifically check for admin signed URLs route
console.log('\nChecking for admin signed URLs route:');
const adminUrlRoute = routes.find(r => r.path.includes('/s3/admin/signed-urls/'));
if (adminUrlRoute) {
    console.log('✅ FOUND: Admin signed URL route is correctly registered');
    console.log(`- Path: ${adminUrlRoute.path}`);
    console.log(`- Methods: ${adminUrlRoute.methods}`);
    console.log(`- Regex: ${adminUrlRoute.regexp}`);
} else {
    console.log('❌ NOT FOUND: Admin signed URL route is NOT registered');
    
    // Look for similar routes
    console.log('\nSimilar routes:');
    const similarRoutes = routes.filter(r => 
        r.path.includes('admin') || 
        r.path.includes('signed') ||
        r.path.includes('url')
    );
    
    if (similarRoutes.length > 0) {
        similarRoutes.forEach(route => {
            console.log(`- ${route.methods} ${route.path}`);
        });
    } else {
        console.log('No similar routes found.');
    }
}

console.log('\n========== End of Route Diagnostic ==========');
