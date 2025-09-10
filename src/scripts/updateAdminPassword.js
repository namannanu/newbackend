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
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

const docClient = new AWS.DynamoDB.DocumentClient();

const updateAdminPassword = async () => {
    try {
        const timestamp = new Date().toISOString();
        const hashedPassword = await bcrypt.hash('admin123', 12);

        const params = {
            TableName: 'AdminUsers',
            Key: {
                userId: 'admin_001'
            },
            UpdateExpression: 'SET password = :password, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
                ':password': hashedPassword,
                ':updatedAt': timestamp
            }
        };

        console.log('Updating admin password...');
        await docClient.update(params).promise();
        console.log('Admin password updated successfully');
        console.log('\nAdmin credentials:');
        console.log('Email: admin@thrillathon.com');
        console.log('Password: admin123');
    } catch (error) {
        console.error('Error updating admin password:', error);
    }
};

updateAdminPassword();
