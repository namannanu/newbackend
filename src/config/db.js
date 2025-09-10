const AWS = require('aws-sdk');
const colors = require('colors');

let dynamoDB;
let documentClient;

/**
 * Initializes DynamoDB connection with AWS credentials
 * @returns {Promise<{dynamoDB: AWS.DynamoDB, documentClient: AWS.DynamoDB.DocumentClient}>}
 */
const initializeDynamoDB = async () => {
    console.log('🔄 Initializing DynamoDB connection...'.yellow);

    try {
        // Configure AWS credentials with session token support
        const accessKeyId = (process.env.AWS_ACCESS_KEY_ID || '').trim();
        const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();
        const sessionToken = (process.env.AWS_SESSION_TOKEN || '').trim();
        const credentials = {
            accessKeyId,
            secretAccessKey
        };

        if (!credentials.accessKeyId || !credentials.secretAccessKey) {
            throw new Error('AWS credentials are required. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in Vercel environment variables.');
        }

        // Add session token if available (required for Vercel/Lambda environment)
        if (accessKeyId.startsWith('ASIA') && sessionToken) {
            credentials.sessionToken = sessionToken;
            console.log('✅ Using AWS session token (temporary credentials detected)'.green);
        }

        // Configure AWS SDK
        const config = {
            region: (process.env.AWS_REGION || 'ap-south-1').trim(),
            credentials: new AWS.Credentials(credentials),
            maxRetries: 3,
            httpOptions: { 
                timeout: 5000,
                connectTimeout: 3000
            }
        };

        // Update AWS SDK configuration
        AWS.config.update(config);

        // Log configuration (safely)
        console.log('AWS Configuration:', {
            region: config.region,
            accessKeyId: credentials.accessKeyId ? `${credentials.accessKeyId.slice(0, 4)}...${credentials.accessKeyId.slice(-4)}` : 'not set',
            hasSecretKey: !!credentials.secretAccessKey,
            hasSessionToken: !!credentials.sessionToken
        });

        // Initialize DynamoDB clients
        if (!dynamoDB) {
            dynamoDB = new AWS.DynamoDB({
                apiVersion: '2012-08-10',
                maxRetries: 3
            });
        }

        if (!documentClient) {
            documentClient = new AWS.DynamoDB.DocumentClient({
                service: dynamoDB,
                convertEmptyValues: true,
                wrapNumbers: true
            });
        }

        // Test the connection
        console.log('🔄 Testing DynamoDB connection...'.yellow);
        const { TableNames } = await dynamoDB.listTables().promise();
        console.log('✅ DynamoDB connection successful. Available tables:'.green, TableNames);

        return { dynamoDB, documentClient };

    } catch (error) {
        console.error('❌ DynamoDB connection failed:'.red, error.message);
        console.error('Error details:', {
            code: error.code,
            statusCode: error.statusCode,
            requestId: error.requestId,
            time: error.time
        });
        
        if (error.code === 'UnrecognizedClientException' || error.code === 'InvalidClientTokenId') {
            console.error('\n⚠️  AWS credential error detected. Please check:'.yellow);
            console.error('1. AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in Vercel');
            console.error('2. AWS_SESSION_TOKEN is set (required for Vercel/Lambda)');
            console.error('3. The credentials have not expired');
            console.error('4. The IAM user/role has appropriate permissions');
            console.error('\nTo update credentials in Vercel:');
            console.error('$ vercel env add AWS_ACCESS_KEY_ID');
            console.error('$ vercel env add AWS_SECRET_ACCESS_KEY');
            console.error('$ vercel env add AWS_SESSION_TOKEN');
            console.error('$ vercel --prod');
        }

        throw error;
    }
};

// Export database operations interface
module.exports = {
    initializeDynamoDB,
    getDynamoDB: () => dynamoDB,
    getDocumentClient: () => documentClient
};
