const AWS = require('aws-sdk');

async function verifyAWSCredentials() {
    try {
        console.log('\n🔍 Verifying AWS Credentials...');
        
        // Log environment variables (safely)
        console.log('\nEnvironment Variables:');
        console.log('AWS_REGION:', process.env.AWS_REGION || 'not set');
        console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? `${process.env.AWS_ACCESS_KEY_ID.slice(0, 4)}...${process.env.AWS_ACCESS_KEY_ID.slice(-4)}` : 'not set');
        console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '[HIDDEN]' : 'not set');

        // Check if essential variables are present
        if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
            throw new Error('Missing AWS credentials');
        }

        // Configure AWS SDK
        AWS.config.update({
            region: process.env.AWS_REGION || 'ap-south-1',
            credentials: new AWS.Credentials({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            })
        });

        // Test STS first (lightweight)
        const sts = new AWS.STS();
        const identity = await sts.getCallerIdentity().promise();
        console.log('\n✅ AWS Identity verified:');
        console.log('Account:', identity.Account);
        console.log('UserArn:', identity.Arn);

        // Test DynamoDB
        const dynamodb = new AWS.DynamoDB();
        const { TableNames } = await dynamodb.listTables().promise();
        console.log('\n✅ DynamoDB connection successful');
        console.log('Available tables:', TableNames);

        return {
            success: true,
            identity,
            tables: TableNames
        };
    } catch (error) {
        console.error('\n❌ AWS Verification Failed:');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);

        // Provide specific guidance based on error type
        if (error.code === 'InvalidClientTokenId') {
            console.error('\n⚠️ Your AWS credentials are invalid. Please check:');
            console.error('1. The Access Key ID is correct');
            console.error('2. You are using the most recent credentials');
            console.error('3. There are no extra spaces in the credentials');
        } else if (error.code === 'AccessDenied') {
            console.error('\n⚠️ Your AWS credentials are valid but lack permissions. Please check:');
            console.error('1. The IAM user has DynamoDB permissions');
            console.error('2. The IAM user has STS permissions');
        }

        throw error;
    }
}

module.exports = verifyAWSCredentials;
