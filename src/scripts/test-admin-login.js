const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({
    path: path.join(__dirname, '..', 'config', 'config.env'),
});

// Configure AWS
AWS.config.update({
    region: process.env.AWS_REGION || 'ap-south-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const dynamoDB = new AWS.DynamoDB.DocumentClient();

async function testAdminLogin() {
    try {
        // 1. First, check if admin exists
        console.log('Checking for admin user...');
        const params = {
            TableName: 'AdminUsers',
            FilterExpression: 'email = :email',
            ExpressionAttributeValues: {
                ':email': 'admin@example.com'
            }
        };

        const result = await dynamoDB.scan(params).promise();
        console.log('\nScan result:', JSON.stringify(result, null, 2));

        if (result.Items.length === 0) {
            console.log('\nNo admin user found. Creating default admin...');
            const timestamp = new Date().toISOString();
            const hashedPassword = await bcrypt.hash('admin123', 12);

            const adminUser = {
                TableName: 'AdminUsers',
                Item: {
                    userId: 'admin_001',
                    email: 'admin@example.com',
                    name: 'Admin User',
                    password: hashedPassword,
                    phone: '+918824223395',
                    role: 'admin',
                    status: 'active',
                    permissions: ['all'],
                    lastActivity: timestamp,
                    lastLogin: null,
                    activityLog: [],
                    createdAt: timestamp,
                    updatedAt: timestamp
                }
            };

            await dynamoDB.put(adminUser).promise();
            console.log('Admin user created successfully');
        } else {
            console.log('\nFound existing admin user');
        }

        // 2. Test password verification
        const admin = result.Items[0];
        if (admin) {
            console.log('\nTesting password verification...');
            const isPasswordValid = await bcrypt.compare('admin123', admin.password);
            console.log('Password valid:', isPasswordValid);
        }

        console.log('\nAdmin credentials for login:');
        console.log('Email: admin@example.com');
        console.log('Password: admin123');

    } catch (error) {
        console.error('Error:', error);
    }
}

testAdminLogin();
