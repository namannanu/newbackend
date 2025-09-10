/**
 * Script to create a test user account
 * 
 * This script creates a test user in the DynamoDB database
 * that can be used for authentication testing.
 */

const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({
  path: path.join(__dirname, '..', 'config', 'config.env'),
});

console.log('Setting up AWS SDK...');
AWS.config.update({
  region: process.env.AWS_REGION || 'ap-south-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();

async function createTestUser() {
  try {
    console.log('Checking if test user exists...');
    // Check if test user already exists
    const existingUserParams = {
      TableName: 'Users',
      IndexName: 'EmailIndex',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: {
        ':email': 'test@example.com'
      }
    };
    
    const existingUser = await dynamoDB.query(existingUserParams).promise();
    
    if (existingUser.Items && existingUser.Items.length > 0) {
      console.log('Test user already exists:', existingUser.Items[0].userId);
      return existingUser.Items[0];
    }
    
    // Create test user
    console.log('Creating test user...');
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash('password123', 12);
    const timestamp = new Date().toISOString();
    
    const newUser = {
      userId: userId,
      email: 'test@example.com',
      password: hashedPassword,
      fullName: 'Test User',
      role: 'user',
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp
    };
    
    await dynamoDB.put({
      TableName: 'Users',
      Item: newUser
    }).promise();
    
    console.log('✅ Test user created successfully!');
    console.log(`User ID: ${userId}`);
    console.log(`Email: test@example.com`);
    console.log(`Password: password123`);
    return newUser;
  } catch (error) {
    console.error('❌ Error creating test user:', error);
    throw error;
  }
}

// Run if executed directly
if (require.main === module) {
  createTestUser()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch(err => {
      console.error('Script failed:', err);
      process.exit(1);
    });
}

module.exports = { createTestUser };
