const AWS = require('aws-sdk');
const colors = require('colors');

class AWSConfigValidator {
    static validateCredentials(config) {
        // Normalize inputs
        const normalized = {
            accessKeyId: (config.accessKeyId || '').trim() || undefined,
            secretAccessKey: (config.secretAccessKey || '').trim() || undefined,
            region: (config.region || '').trim() || undefined,
            sessionToken: (config.sessionToken || '').trim() || undefined
        };

        const required = ['accessKeyId', 'secretAccessKey', 'region'];
        const missing = required.filter(key => !normalized[key]);
        if (missing.length > 0) {
            throw new Error(`Missing required AWS configuration: ${missing.join(', ')}`);
        }

        // Check for whitespace in credentials
        if (normalized.accessKeyId.includes(' ') || normalized.secretAccessKey.includes(' ')) {
            throw new Error('AWS credentials contain spaces. Please remove any leading or trailing spaces.');
        }

        // Validate access key format (allow AKIA/AIDA/ABIA/ASIA etc.)
        if (!/^[A-Z0-9]{16,32}$/.test(normalized.accessKeyId)) {
            throw new Error('Invalid AWS Access Key ID format.');
        }

        return normalized;
    }
}

// Global DynamoDB instances
let dynamoDB = null;
let documentClient = null;

/**
 * Initializes DynamoDB connection with AWS credentials
 * @returns {Promise<{dynamoDB: AWS.DynamoDB, documentClient: AWS.DynamoDB.DocumentClient}>}
 */
const initializeDynamoDB = async () => {
    console.log('🔄 Initializing DynamoDB connection...'.yellow);

    try {
        // Read from environment and validate/normalize
        const envConfig = {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || 'ap-south-1',
            sessionToken: process.env.AWS_SESSION_TOKEN
        };

        const valid = AWSConfigValidator.validateCredentials(envConfig);

        // Only include sessionToken when using temporary creds (ASIA...)
        const useSession = !!(valid.sessionToken && String(valid.accessKeyId).startsWith('ASIA'));
        const sdkConfig = {
            accessKeyId: valid.accessKeyId,
            secretAccessKey: valid.secretAccessKey,
            region: valid.region,
            ...(useSession ? { sessionToken: valid.sessionToken } : {})
        };

        // Configure AWS SDK
        AWS.config.update(sdkConfig);

        // Safe log of resolved AWS configuration
        console.log('AWS SDK configured:', {
            region: sdkConfig.region,
            accessKeyId: sdkConfig.accessKeyId ? `${sdkConfig.accessKeyId.slice(0,4)}...${sdkConfig.accessKeyId.slice(-4)}` : 'not set',
            hasSecretKey: !!sdkConfig.secretAccessKey,
            hasSessionToken: !!sdkConfig.sessionToken
        });

        // Initialize DynamoDB instances if not already initialized
        if (!dynamoDB || !documentClient) {
            dynamoDB = new AWS.DynamoDB();
            documentClient = new AWS.DynamoDB.DocumentClient();
            console.log('✅ DynamoDB connection initialized successfully'.green);
        }

        return { dynamoDB, documentClient };
    } catch (error) {
        console.error('❌ Failed to initialize DynamoDB connection:'.red, error.message);
        throw error;
    }
};

/**
 * Initialize DynamoDB tables
 * @param {AWS.DynamoDB} dynamoDB - DynamoDB instance
 * @returns {Promise<void>}
 */
const initializeTables = async () => {
    try {
        const { dynamoDB } = await initializeDynamoDB();
        
        // Table definitions
        const tables = [
            {
                TableName: 'Users',
                KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
                AttributeDefinitions: [{ AttributeName: 'userId', AttributeType: 'S' }],
                ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
            },
            {
                TableName: 'Events',
                KeySchema: [{ AttributeName: 'eventId', KeyType: 'HASH' }],
                AttributeDefinitions: [{ AttributeName: 'eventId', AttributeType: 'S' }],
                ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
            },
            // Add other table definitions as needed
        ];

        for (const tableDefinition of tables) {
            try {
                // Check if table exists
                await dynamoDB.describeTable({ TableName: tableDefinition.TableName }).promise();
                console.log(`Table ${tableDefinition.TableName} already exists`.yellow);
            } catch (error) {
                if (error.code === 'ResourceNotFoundException') {
                    console.log(`Creating table ${tableDefinition.TableName}...`.cyan);
                    await dynamoDB.createTable(tableDefinition).promise();
                    await dynamoDB.waitFor('tableExists', { TableName: tableDefinition.TableName }).promise();
                    console.log(`Table ${tableDefinition.TableName} created successfully`.green);
                } else {
                    throw error;
                }
            }
        }

        console.log('✅ All DynamoDB tables initialized successfully'.green);
    } catch (error) {
        console.error('❌ Failed to initialize DynamoDB tables:'.red, error.message);
        throw error;
    }
};

// Export configuration and initialization functions
module.exports = {
    initializeDynamoDB,
    initializeTables,
    AWSConfigValidator,
    getDB: () => ({ dynamoDB, documentClient })
};
