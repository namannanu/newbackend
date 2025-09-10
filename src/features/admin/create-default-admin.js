
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

// Define all available permissions
const ALL_PERMISSIONS = [
    'user_management',
    'event_management',
    'organizer_management',
    'ticket_management',
    'feedback_management',
    'admin_management',
    'registration_management',
    'verification_management',
    'analytics_view',
    'settings_management',
    'all_permissions' // Special permission that grants everything
];

const createDefaultAdmin = async () => {
    try {
        const timestamp = new Date().toISOString();
        
        // Hash password with proper salt rounds
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash('admin123', saltRounds);
        console.log('Password hashed successfully with salt rounds:', saltRounds);

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
                console.log('Default admin user already exists, updating permissions and password...');
                
                // Update the existing admin with proper password and all permissions
                const updateParams = {
                    TableName: 'AdminUsers',
                    Key: { userId: 'admin_001' },
                    UpdateExpression: 'SET #password = :password, #permissions = :permissions, #updatedAt = :updatedAt, #role = :role',
                    ExpressionAttributeNames: {
                        '#password': 'password',
                        '#permissions': 'permissions',
                        '#updatedAt': 'updatedAt',
                        '#role': 'role'
                    },
                    ExpressionAttributeValues: {
                        ':password': hashedPassword,
                        ':permissions': ALL_PERMISSIONS,
                        ':updatedAt': timestamp,
                        ':role': 'super_admin'
                    },
                    ReturnValues: 'ALL_NEW'
                };

                await docClient.update(updateParams).promise();
                console.log('✅ Admin updated successfully with all permissions');
            } else {
                // Create new admin user with all permissions
                const adminUser = {
                    TableName: 'AdminUsers',
                    Item: {
                        userId: 'admin_001',
                        email: 'admin@example.com',
                        name: 'Super Admin',
                        password: hashedPassword,
                        phone: '+918824223395',
                        role: 'super_admin',
                        status: 'active',
                        permissions: ALL_PERMISSIONS,
                        lastActivity: timestamp,
                        lastLogin: null,
                        activityLog: [],
                        createdAt: timestamp,
                        updatedAt: timestamp
                    }
                };

                console.log('Creating default super admin user...');
                await docClient.put(adminUser).promise();
                console.log('✅ Default super admin user created successfully');
            }
            
            console.log('\n🔑 Default admin credentials:');
            console.log('📧 Email: admin@example.com');
            console.log('🔒 Password: admin123');
            console.log('👑 Role: super_admin');
            console.log('🔐 Permissions: ALL (' + ALL_PERMISSIONS.length + ' permissions)');
            console.log('\n⚠️  IMPORTANT: Change the password after first login!');
            
        } catch (error) {
            console.error('Error checking/updating admin:', error.message);
            throw error;
        }
        
    } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
            console.error('❌ Error: AdminUsers table does not exist. Please create the table first.');
        } else {
            console.error('❌ Error creating default admin:', error.message);
        }
    }
};

// Run the function
createDefaultAdmin();
