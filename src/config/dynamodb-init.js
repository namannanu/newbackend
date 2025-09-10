const AWS = require('aws-sdk');
const config = require('./aws-robust');

// Initialize DynamoDB client
const dynamoDB = new AWS.DynamoDB();
const documentClient = new AWS.DynamoDB.DocumentClient();

// Table definitions based on schema
const tables = {
  Users: {
    TableName: 'Users',
    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'EmailIndex',
        KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      }
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
  },
  AdminUsers: {
    TableName: 'AdminUsers',
    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'EmailIndex',
        KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      }
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
  },
  Events: {
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
  },
  EventTicket: {
    TableName: 'EventTicket',
    KeySchema: [{ AttributeName: 'ticketId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'ticketId', AttributeType: 'S' },
      { AttributeName: 'eventId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'EventIndex',
        KeySchema: [{ AttributeName: 'eventId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      },
      {
        IndexName: 'UserIndex',
        KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      }
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
  },
  UserEventRegistrations: {
    TableName: 'UserEventRegistrations',
    KeySchema: [{ AttributeName: 'registrationId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'registrationId', AttributeType: 'S' },
      { AttributeName: 'eventId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'EventIndex',
        KeySchema: [{ AttributeName: 'eventId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      },
      {
        IndexName: 'UserIndex',
        KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      }
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
  },
  FaceImage: {
    TableName: 'FaceImage',
    KeySchema: [{ AttributeName: 'rekognitionId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'rekognitionId', AttributeType: 'S' }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
  },
  EventOrganiser: {
    TableName: 'EventOrganiser',
    KeySchema: [{ AttributeName: 'organiserId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'organiserId', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'EmailIndex',
        KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      }
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
  }
  // Add other tables following the same pattern
};

// Function to check if a table exists
const tableExists = async (tableName) => {
  try {
    await dynamoDB.describeTable({ TableName: tableName }).promise();
    return true;
  } catch (error) {
    if (error.code === 'ResourceNotFoundException') {
      return false;
    }
    throw error;
  }
};

// Function to create a table
const createTable = async (tableDefinition) => {
  try {
    await dynamoDB.createTable(tableDefinition).promise();
    console.log(`Created table: ${tableDefinition.TableName}`);
    
    // Wait for table to be active
    await dynamoDB.waitFor('tableExists', { TableName: tableDefinition.TableName }).promise();
    console.log(`Table ${tableDefinition.TableName} is now active`);
  } catch (error) {
    console.error(`Error creating table ${tableDefinition.TableName}:`, error);
    throw error;
  }
};

// Main function to initialize tables
const initializeTables = async () => {
  try {
    for (const [tableName, tableDefinition] of Object.entries(tables)) {
      const exists = await tableExists(tableName);
      if (!exists) {
        console.log(`Table ${tableName} does not exist. Creating...`);
        await createTable(tableDefinition);
      } else {
        console.log(`Table ${tableName} already exists`);
      }
    }
    console.log('All tables initialized successfully');
  } catch (error) {
    console.error('Error initializing tables:', error);
    throw error;
  }
};

module.exports = {
  initializeTables
};
