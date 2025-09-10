const AWS = require('aws-sdk');
const dotenv = require('dotenv');
const path = require('path');

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

const scanAdminTable = async () => {
    try {
        const params = {
            TableName: 'AdminUsers'
        };

        const result = await docClient.scan(params).promise();
        console.log('AdminUsers table contents:');
        console.log(JSON.stringify(result.Items, null, 2));
    } catch (error) {
        console.error('Error scanning table:', error);
    }
};

scanAdminTable();
