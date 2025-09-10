// AWS SDK configuration with serverless compatibility
const AWS = require('aws-sdk');
const colors = require('colors');

// Log AWS SDK version for debugging
console.log('AWS SDK Version:', AWS.VERSION);

function sanitizeLogValue(value) {
    if (!value) return 'not set';
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function logCredentials() {
    console.log('\n📝 AWS Credentials Status:'.cyan);
    console.log('Region:', process.env.AWS_REGION || 'ap-south-1');
    console.log('Access Key:', sanitizeLogValue(process.env.AWS_ACCESS_KEY_ID));
    console.log('Secret Key:', process.env.AWS_SECRET_ACCESS_KEY ? '[PRESENT]' : 'not set');
    console.log('Session Token:', process.env.AWS_SESSION_TOKEN ? '[PRESENT]' : 'not set');
}

function getAWSConfig() {
    // Log current credentials for debugging
    logCredentials();

    // Base configuration with better timeout and retry settings
    const config = {
        region: process.env.AWS_REGION || 'ap-south-1',
        maxRetries: 3,
        retryDelayOptions: { base: 200 },
        httpOptions: { 
            timeout: 5000,
            connectTimeout: 3000
        }
    };

    try {
        // Vercel/Lambda environment with temporary credentials
        if (process.env.AWS_SESSION_TOKEN) {
            config.credentials = new AWS.Credentials({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
                sessionToken: process.env.AWS_SESSION_TOKEN
            });
            console.log('✅ Using temporary credentials with session token'.green);
        }
        // Standard environment with permanent credentials
        else if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
            config.credentials = new AWS.Credentials({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            });
            console.log('✅ Using permanent credentials'.green);
        }
        // Development fallback
        else if (process.env.NODE_ENV === 'development') {
            console.log('⚠️  No AWS credentials found, using development defaults'.yellow);
            config.credentials = new AWS.Credentials({
                accessKeyId: 'local',
                secretAccessKey: 'local'
            });
            config.endpoint = 'http://localhost:8000';
        }
        else {
            throw new Error('No valid AWS credentials found');
        }
    } catch (error) {
        console.error('❌ Error configuring AWS credentials:'.red, error.message);
        throw error;
    }

    return config;
}

async function verifyAWSCredentials() {
    const sts = new AWS.STS(getAWSConfig());
    
    try {
        console.log('\n🔍 Verifying AWS credentials...'.cyan);
        const identity = await sts.getCallerIdentity().promise();
        
        console.log('✅ AWS Credentials Verified:'.green);
        console.log('Account:', identity.Account);
        console.log('User ID:', identity.UserId);
        console.log('ARN:', identity.Arn);
        
        // Test DynamoDB access specifically
        const dynamoDB = new AWS.DynamoDB(getAWSConfig());
        await dynamoDB.listTables().promise();
        console.log('✅ DynamoDB access verified'.green);
        
        return { success: true, identity };
    } catch (error) {
        console.error('❌ AWS Credential Verification Failed:'.red);
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        
        if (error.code === 'InvalidClientTokenId' || error.code === 'UnrecognizedClientException') {
            console.error('\n⚠️  Potential solutions:'.yellow);
            console.error('1. Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in Vercel');
            console.error('2. Ensure AWS_SESSION_TOKEN is set in Vercel');
            console.error('3. Verify credentials have not expired');
            console.error('4. Check IAM user/role permissions');
            console.error('5. Remove any whitespace from credentials');
            console.error('\nTo update credentials in Vercel:');
            console.error('1. Run: vercel env add AWS_ACCESS_KEY_ID');
            console.error('2. Run: vercel env add AWS_SECRET_ACCESS_KEY');
            console.error('3. Run: vercel env add AWS_SESSION_TOKEN');
            console.error('4. Run: vercel --prod');
        }
        
        return { success: false, error };
    }
}

// Initialize AWS clients with retry logic and better error handling
function createAWSClient(ClientClass, config = getAWSConfig()) {
    const client = new ClientClass(config);

    // Add detailed error logging
    const originalMakeRequest = client.makeRequest.bind(client);
    client.makeRequest = function(operation, params) {
        const request = originalMakeRequest(operation, params);
        request.on('error', (err) => {
            console.error(`❌ AWS ${ClientClass.name} Error:`.red, {
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
