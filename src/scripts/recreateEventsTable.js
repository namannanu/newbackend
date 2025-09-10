const { dynamoDB, documentClient } = require('../config/aws-robust');

async function backupEventsData() {
    console.log('Backing up existing events data...');
    const params = { TableName: 'Events' };
    const events = [];
    
    try {
        let items;
        do {
            items = await docClient.scan(params).promise();
            events.push(...items.Items);
            params.ExclusiveStartKey = items.LastEvaluatedKey;
        } while (items.LastEvaluatedKey);
        
        console.log(`Backed up ${events.length} events`);
        return events;
    } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
            console.log('Events table does not exist yet, no backup needed');
            return [];
        }
        throw error;
    }
}

async function deleteTable() {
    try {
        console.log('Deleting Events table...');
        await dynamoDB.deleteTable({ TableName: 'Events' }).promise();
        await dynamoDB.waitFor('tableNotExists', { TableName: 'Events' }).promise();
        console.log('Events table deleted successfully');
    } catch (error) {
        if (error.code === 'ResourceNotFoundException') {
            console.log('Events table does not exist');
            return;
        }
        throw error;
    }
}

async function createTable() {
    console.log('Creating Events table with StatusDateIndex...');
    const params = {
        TableName: 'Events',
        KeySchema: [{ AttributeName: 'eventId', KeyType: 'HASH' }],
        AttributeDefinitions: [
            { AttributeName: 'eventId', AttributeType: 'S' },
            { AttributeName: 'organiserId', AttributeType: 'S' },
            { AttributeName: 'status', AttributeType: 'S' },
            { AttributeName: 'date', AttributeType: 'S' }
        ],
        GlobalSecondaryIndexes: [
            {
                IndexName: 'OrganizerIndex',
                KeySchema: [{ AttributeName: 'organiserId', KeyType: 'HASH' }],
                Projection: { ProjectionType: 'ALL' },
                ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
            },
            {
                IndexName: 'StatusDateIndex',
                KeySchema: [
                    { AttributeName: 'status', KeyType: 'HASH' },
                    { AttributeName: 'date', KeyType: 'RANGE' }
                ],
                Projection: { ProjectionType: 'ALL' },
                ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
            }
        ],
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
    };
    
    await dynamoDB.createTable(params).promise();
    await dynamoDB.waitFor('tableExists', { TableName: 'Events' }).promise();
    console.log('Events table created successfully');
}

async function restoreEventsData(events) {
    if (events.length === 0) {
        console.log('No events to restore');
        return;
    }

    console.log(`Restoring ${events.length} events...`);
    const batchSize = 25; // DynamoDB batch write limit
    
    for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize);
        const params = {
            RequestItems: {
                'Events': batch.map(item => ({
                    PutRequest: { Item: item }
                }))
            }
        };
        
        await docClient.batchWrite(params).promise();
    }
    
    console.log('Events data restored successfully');
}

async function main() {
    try {
        console.log('Starting Events table recreation process...');
        const events = await backupEventsData();
        await deleteTable();
        await createTable();
        await restoreEventsData(events);
        console.log('Events table recreation completed successfully');
    } catch (error) {
        console.error('Error recreating Events table:', error);
        process.exit(1);
    }
}

main();
