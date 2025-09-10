#!/usr/bin/env node

/**
 * Admin URL Test Client
 * 
 * This script helps diagnose issues with the admin signed URL endpoint
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Set up colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Configuration
const config = {
  baseUrl: 'http://localhost:3001',
  adminToken: process.env.ADMIN_TOKEN || fs.readFileSync('./test_admin_token.txt', 'utf8').trim(),
  userId: process.env.USER_ID || 'kkuserid'
};

console.log(`${colors.blue}========== Admin URL Test Client ==========${colors.reset}`);

// Check if we have a token
if (!config.adminToken) {
  console.log(`${colors.red}No admin token found. Run generate-test-admin-token.sh first${colors.reset}`);
  process.exit(1);
}

// Function to make API requests
async function makeRequest(url, method = 'GET', headers = {}, data = null) {
  console.log(`${colors.yellow}Making ${method} request to: ${url}${colors.reset}`);
  
  try {
    const response = await axios({
      method,
      url,
      headers,
      data,
      validateStatus: () => true // Return response regardless of status code
    });
    
    return {
      status: response.status,
      statusText: response.statusText,
      data: response.data
    };
  } catch (error) {
    return {
      status: error.response?.status || 0,
      statusText: error.response?.statusText || 'Network Error',
      data: error.response?.data || { error: error.message }
    };
  }
}

// Function to test endpoints
async function testEndpoint(path, withAuth = true) {
  const url = `${config.baseUrl}${path}`;
  const headers = withAuth ? { Authorization: `Bearer ${config.adminToken}` } : {};
  
  console.log(`\n${colors.blue}Testing endpoint: ${path}${colors.reset}`);
  console.log(`Auth: ${withAuth ? colors.green + 'Yes' + colors.reset : colors.red + 'No' + colors.reset}`);
  
  const response = await makeRequest(url, 'GET', headers);
  
  console.log(`${colors.yellow}Response (${response.status} ${response.statusText}):${colors.reset}`);
  console.log(JSON.stringify(response.data, null, 2));
  
  return response;
}

// Function to verify JWT token
function verifyToken(token) {
  try {
    console.log(`${colors.yellow}Analyzing token...${colors.reset}`);
    
    // Split the token into parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log(`${colors.red}Invalid token format${colors.reset}`);
      return;
    }
    
    // Decode the payload (middle part)
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    console.log(`${colors.green}Token payload:${colors.reset}`);
    console.log(JSON.stringify(payload, null, 2));
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.log(`${colors.red}Token has expired!${colors.reset}`);
      console.log(`Expired: ${new Date(payload.exp * 1000).toISOString()}`);
      console.log(`Current: ${new Date().toISOString()}`);
    } else if (payload.exp) {
      console.log(`${colors.green}Token is valid until:${colors.reset} ${new Date(payload.exp * 1000).toISOString()}`);
    }
    
    // Check for admin role
    if (payload.role === 'admin' || payload.role === 'superadmin') {
      console.log(`${colors.green}Token has admin privileges${colors.reset}`);
    } else {
      console.log(`${colors.red}Token does NOT have admin role${colors.reset}`);
    }
    
    return payload;
  } catch (error) {
    console.log(`${colors.red}Error analyzing token: ${error.message}${colors.reset}`);
  }
}

// Main function to run the tests
async function runTests() {
  // Verify token first
  const tokenInfo = verifyToken(config.adminToken);
  
  if (!tokenInfo) {
    console.log(`${colors.yellow}Continuing with tests despite token issues...${colors.reset}`);
  }
  
  // Test health endpoint (no auth required)
  await testEndpoint('/api/health', false);
  
  // Test all variations of the admin signed URL endpoint
  const endpoints = [
    '/api/admin/signed-urls/' + config.userId,
    '/api/s3/admin/signed-urls/' + config.userId,
    '/api/test-admin-url/ping',
    '/api/test-admin-url/admin-url/' + config.userId
  ];
  
  for (const endpoint of endpoints) {
    await testEndpoint(endpoint);
  }
  
  console.log(`\n${colors.blue}========== Tests Complete ==========${colors.reset}`);
  console.log(`${colors.yellow}If all endpoints return 404, check server.js configuration${colors.reset}`);
  console.log(`${colors.yellow}If endpoints return 403, check token has admin privileges${colors.reset}`);
  console.log(`${colors.yellow}Remember to restart the server after making changes${colors.reset}`);
}

// Run the tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
});
