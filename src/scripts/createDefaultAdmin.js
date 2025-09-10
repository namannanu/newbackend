const AWS = require('aws-sdk');
const dotenv = require('dotenv');
const path = require('path');
const bcrypt = require('bcryptjs');

// Load environment variables
dotenv.config({
    path: path.join(__dirname, '..', 'config', 'config.env'),
});

// Configure AWS
AWS.config.update({
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const docClient = new AWS.DynamoDB.DocumentClient();

const createDefaultAdmin = async () => {
    try {
        const timestamp = new Date().toISOString();
        const hashedPassword = await bcrypt.hash('admin123', 12);

        // First check if admin already exists
        const getParams = {
            TableName: 'AdminUsers',
            Key: {
                userId: 'admin_001'
            }
        };

        try {
            const existingAdmin = await docClient.get(getParams).promise();
            if (existingAdmin.Item) {
                console.log('Default admin user already exists');
                console.log('\nAdmin credentials:');
                console.log('Email: admin@example.com');
                console.log('Password: admin123');
                return;
            }
        } catch (error) {
            console.log('Checking for existing admin...');
        }

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
                permissions: ['all_permissions'],
                lastActivity: timestamp,
                lastLogin: null,
                activityLog: [],
                createdAt: timestamp,
                updatedAt: timestamp
            }
        };
        

        console.log('Creating default admin user...');
        await docClient.put(adminUser).promise();
        console.log('✅ Default admin user created successfully');
        console.log('\n🔑 Default admin credentials:');
        console.log('📧 Email: admin@example.com');
        console.log('🔒 Password: admin123');
        console.log('\n⚠️  IMPORTANT: Change the password after first login!');
        
    } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
            console.error('❌ Error: AdminUsers table does not exist. Please create the table first.');
            console.error('Table schema required:');
            console.error('- Table name: AdminUsers');
            console.error('- Primary key: userId (String)');
        } else {
            console.error('❌ Error creating default admin:', error.message);
        }
    }
};

// Run the function
createDefaultAdmin();