const { initializeDynamoDB } = require('../config/config');

async function verifyAWSConnection() {
    try {
        const { dynamoDB } = await initializeDynamoDB();
        
        // Test the connection by listing tables
        await dynamoDB.listTables().promise();
        console.log('✅ AWS Connection successful! DynamoDB is properly configured.');
        return true;
    } catch (error) {
        console.error('❌ AWS Connection failed:', error.message);
        if (error.code === 'UnrecognizedClientException') {
            console.error('This error typically means your AWS credentials are invalid or not properly set in Vercel.');
        }
        if (error.code === 'CredentialsError') {
            console.error('AWS credentials not found. Please check your Vercel environment variables.');
        }
        throw error;
    }
}

module.exports = verifyAWSConnection;
