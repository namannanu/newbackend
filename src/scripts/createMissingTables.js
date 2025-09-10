const AWS = require('aws-sdk');
const colors = require('colors');

// Configure AWS
AWS.config.update({
    region: process.env.AWS_REGION || 'ap-south-1'
});

const dynamoDB = new AWS.DynamoDB();

async function createMissingTables() {
    const tables = {
        AdminUsers: {
            TableName: 'AdminUsers',
            KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
            AttributeDefinitions: [
                { AttributeName: 'userId', AttributeType: 'S' },
                { AttributeName: 'email', AttributeType: 'S' }
            ],
            GlobalSecondaryIndexes: [{
                IndexName: 'EmailIndex',
                KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
                Projection: { ProjectionType: 'ALL' },
                ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
            }],
            ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
        },
        Feedback: {
            TableName: 'Feedback',
            KeySchema: [{ AttributeName: 'feedbackId', KeyType: 'HASH' }],
            AttributeDefinitions: [
                { AttributeName: 'feedbackId', AttributeType: 'S' },
                { AttributeName: 'userId', AttributeType: 'S' },
                { AttributeName: 'eventId', AttributeType: 'S' }
            ],
            GlobalSecondaryIndexes: [
                {
                    IndexName: 'UserIndex',
                    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
                    Projection: { ProjectionType: 'ALL' },
                    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
                },
                {
                    IndexName: 'EventIndex',
                    KeySchema: [{ AttributeName: 'eventId', KeyType: 'HASH' }],
                    Projection: { ProjectionType: 'ALL' },
                    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
                }
            ],
            ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
        },
        AdminActivityLog: {
            TableName: 'AdminActivityLog',
            KeySchema: [{ AttributeName: 'logId', KeyType: 'HASH' }],
            AttributeDefinitions: [
                { AttributeName: 'logId', AttributeType: 'S' },
                { AttributeName: 'adminUserId', AttributeType: 'S' }
            ],
            GlobalSecondaryIndexes: [{
                IndexName: 'AdminUserIndex',
                KeySchema: [{ AttributeName: 'adminUserId', KeyType: 'HASH' }],
                Projection: { ProjectionType: 'ALL' },
                ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
            }],
            ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
        },
        AuditLog: {
            TableName: 'AuditLog',
            KeySchema: [{ AttributeName: 'auditId', KeyType: 'HASH' }],
            AttributeDefinitions: [
                { AttributeName: 'auditId', AttributeType: 'S' },
                { AttributeName: 'performedBy', AttributeType: 'S' }
            ],
            GlobalSecondaryIndexes: [{
                IndexName: 'PerformedByIndex',
                KeySchema: [{ AttributeName: 'performedBy', KeyType: 'HASH' }],
                Projection: { ProjectionType: 'ALL' },
                ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
            }],
            ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
        },
        SystemConfiguration: {
            TableName: 'SystemConfiguration',
            KeySchema: [{ AttributeName: 'configId', KeyType: 'HASH' }],
            AttributeDefinitions: [{ AttributeName: 'configId', AttributeType: 'S' }],
            ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
        },
        FaceImage: {
            TableName: 'FaceImage',
            KeySchema: [{ AttributeName: 'rekognitionId', KeyType: 'HASH' }],
            AttributeDefinitions: [{ AttributeName: 'rekognitionId', AttributeType: 'S' }],
            ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
        }
    };

    console.log('🔄 Checking and creating missing tables...'.yellow);

    for (const [tableName, tableDefinition] of Object.entries(tables)) {
        try {
            await dynamoDB.describeTable({ TableName: tableName }).promise();
            console.log(`✅ Table ${tableName} already exists`.green);
        } catch (error) {
            if (error.code === 'ResourceNotFoundException') {
                try {
                    console.log(`📝 Creating table ${tableName}...`.yellow);
                    await dynamoDB.createTable(tableDefinition).promise();
                    console.log(`✅ Table ${tableName} created successfully`.green);
                    
                    // Wait for table to be active
                    console.log(`⏳ Waiting for table ${tableName} to be active...`.yellow);
                    await dynamoDB.waitFor('tableExists', { TableName: tableName }).promise();
                    console.log(`✅ Table ${tableName} is now active`.green);
                } catch (createError) {
                    console.error(`❌ Error creating table ${tableName}:`.red, createError.message);
                }
            } else {
                console.error(`❌ Error checking table ${tableName}:`.red, error.message);
            }
        }
    }
}

// Run the script if called directly
if (require.main === module) {
    createMissingTables()
        .then(() => {
            console.log('\n✅ Table creation process completed!'.green.bold);
            // Now run the data loading script
            require('./loadDemoData');
        })
        .catch(error => {
            console.error('❌ Failed to create tables:'.red.bold, error);
            process.exit(1);
        });
}

module.exports = createMissingTables;
