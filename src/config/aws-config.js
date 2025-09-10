// AWS SDK configuration with serverless compatibility
const AWS = require('aws-sdk');

function getAWSConfig() {
    // Base configuration
    const config = {
        region: process.env.AWS_REGION || 'ap-south-1',
        maxRetries: 3,
        httpOptions: { timeout: 5000 }, // 5 second timeout
    };

    // Add credentials if they exist in environment
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        config.credentials = new AWS.Credentials({
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        });
        
        // If session token is provided (common in Lambda/Vercel environment)
        if (process.env.AWS_SESSION_TOKEN) {
            config.credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
        }
    }

    return config;
}

// Initialize AWS clients with retry logic
function createAWSClient(ClientClass, config = getAWSConfig()) {
    const client = new ClientClass(config);

    // Add error logging
    const originalSend = client.makeRequest;
    client.makeRequest = function(operation, params) {
        const request = originalSend.call(this, operation, params);
        
        request.on('error', (err) => {
            console.error(`AWS ${ClientClass.name} Error:`, {
                operation,
                errorCode: err.code,
                message: err.message,
                requestId: err.requestId,
                statusCode: err.statusCode,
                time: new Date().toISOString()
            });
        });

        return request;
    };

    return client;
}

// Initialize services
const services = {
    dynamoDB: () => createAWSClient(AWS.DynamoDB),
    documentClient: () => createAWSClient(AWS.DynamoDB.DocumentClient),
    s3: () => createAWSClient(AWS.S3),
    rekognition: () => createAWSClient(AWS.Rekognition),
    cognito: () => createAWSClient(AWS.CognitoIdentityServiceProvider),
    sts: () => createAWSClient(AWS.STS)
};

// Verify AWS credentials
async function verifyCredentials() {
    try {
        const sts = services.sts();
        const result = await sts.getCallerIdentity().promise();
        console.log('✅ AWS Credentials verified:', {
            account: result.Account,
            arn: result.Arn,
            userId: result.UserId
        });
        return { success: true, identity: result };
    } catch (error) {
        console.error('❌ AWS Credential verification failed:', {
            code: error.code,
            message: error.message,
            region: AWS.config.region,
            hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
            hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
            hasSessionToken: !!process.env.AWS_SESSION_TOKEN
        });
        return { success: false, error };
    }
}

module.exports = {
    getAWSConfig,
    createAWSClient,
    services,
    verifyCredentials,
    AWS // Export AWS SDK for direct use if needed
};
