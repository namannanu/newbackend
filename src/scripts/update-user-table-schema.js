const AWS = require('aws-sdk');

// Configure AWS from environment variables
if (!process.env.AWS_REGION) {
    process.env.AWS_REGION = 'ap-south-1';
}

AWS.config.update({
    region: process.env.AWS_REGION,
    maxRetries: 3,
    httpOptions: {
        timeout: 5000,
        connectTimeout: 3000
    }
});

const dynamoDB = new AWS.DynamoDB();

// Update the table with new attributes and GSI
async function updateUserTable() {
    try {
        // First, describe the existing table
        const tableDescription = await dynamoDB.describeTable({
            TableName: 'AdminUsers'
        }).promise();

        console.log('Current table structure:', JSON.stringify(tableDescription, null, 2));

        // Define the new GSI for email lookups
        const updateParams = {
            TableName: 'AdminUsers',
            AttributeDefinitions: [
                {
                    AttributeName: 'userId',
                    AttributeType: 'S'
                },
                {
                    AttributeName: 'email',
                    AttributeType: 'S'
                }
            ],
            GlobalSecondaryIndexUpdates: [
                {
                    Create: {
                        IndexName: 'EmailIndex',
                        KeySchema: [
                            {
                                AttributeName: 'email',
                                KeyType: 'HASH'
                            }
                        ],
                        Projection: {
                            ProjectionType: 'ALL'
                        },
                        ProvisionedThroughput: {
                            ReadCapacityUnits: 5,
                            WriteCapacityUnits: 5
                        }
                    }
                }
            ]
        };

        console.log('Updating table with new GSI...');
        await dynamoDB.updateTable(updateParams).promise();
        console.log('Successfully updated table schema');

        // Create a DocumentClient for easier item operations
        const docClient = new AWS.DynamoDB.DocumentClient();

        // Scan the table to update existing items with new attributes
        const scanResult = await docClient.scan({
            TableName: 'AdminUsers'
        }).promise();

        console.log(`Found ${scanResult.Items.length} items to update`);

        // Update each item with new attributes if they don't exist
        for (const item of scanResult.Items) {
            const updateItemParams = {
                TableName: 'AdminUsers',
                Key: {
                    userId: item.userId
                },
                UpdateExpression: 'SET ' +
                    'role = if_not_exists(#role, :defaultRole), ' +
                    'permissions = if_not_exists(permissions, :defaultPermissions), ' +
                    'verificationStatus = if_not_exists(verificationStatus, :defaultVerificationStatus), ' +
                    'status = if_not_exists(#status, :defaultStatus), ' +
                    'uploadedPhoto = if_not_exists(uploadedPhoto, :defaultPhoto), ' +
                    'createdAt = if_not_exists(createdAt, :defaultCreatedAt), ' +
                    'updatedAt = if_not_exists(updatedAt, :defaultUpdatedAt), ' +
                    '#version = if_not_exists(#version, :defaultVersion), ' +
                    'lastLogin = if_not_exists(lastLogin, :defaultLastLogin), ' +
                    'name = if_not_exists(#name, :defaultName)',
                ExpressionAttributeNames: {
                    '#role': 'role',
                    '#status': 'status',
                    '#version': '__v',
                    '#name': 'name'
                },
                ExpressionAttributeValues: {
                    ':defaultRole': 'user',
                    ':defaultPermissions': [],
                    ':defaultVerificationStatus': 'pending',
                    ':defaultStatus': 'active',
                    ':defaultPhoto': '',
                    ':defaultCreatedAt': new Date().toISOString(),
                    ':defaultUpdatedAt': new Date().toISOString(),
                    ':defaultVersion': 0,
                    ':defaultLastLogin': null,
                    ':defaultName': item.username || 'User'
                }
            };

            await docClient.update(updateItemParams).promise();
            console.log(`Updated item: ${item.userId}`);
        }

        console.log('Successfully updated all items with new attributes');

    } catch (error) {
        console.error('Error updating table:', error);
        throw error;
    }
}

// Run the update
updateUserTable()
    .then(() => console.log('Table update completed successfully'))
    .catch(error => console.error('Failed to update table:', error));
