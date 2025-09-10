require('dotenv').config({ path: './src/config/config.env' });
const AWS = require('aws-sdk');

async function checkConfiguration() {
    console.log('🔍 Checking DynamoDB Configuration\n');

    // 1. Check Environment Variables
    console.log('📋 Environment Variables:');
    const envVars = {
        'AWS_REGION': process.env.AWS_REGION,
        'AWS_ACCESS_KEY_ID': process.env.AWS_ACCESS_KEY_ID,
        'AWS_SECRET_ACCESS_KEY': process.env.AWS_SECRET_ACCESS_KEY
    };

    for (const [key, value] of Object.entries(envVars)) {
        if (!value) {
            console.log(`❌ ${key}: Missing`);
        } else {
            console.log(`✅ ${key}: ${key.includes('SECRET') ? '****' : value}`);
        }
    }

    // 2. Test AWS Configuration
    console.log('\n🔄 Testing AWS Configuration...');
    try {
        AWS.config.update({
            region: process.env.AWS_REGION || 'ap-south-1',
            credentials: new AWS.Credentials({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            })
        });

        const sts = new AWS.STS();
        const identity = await sts.getCallerIdentity().promise();
        console.log('✅ AWS Configuration Valid');
        console.log(`📋 Identity: ${identity.Arn}`);
    } catch (error) {
        console.log('❌ AWS Configuration Invalid');
        console.log(`Error: ${error.message}`);
    }

    // 3. Test DynamoDB Access
    console.log('\n🔄 Testing DynamoDB Access...');
    try {
        const dynamoDB = new AWS.DynamoDB();
        const { TableNames } = await dynamoDB.listTables().promise();
        console.log('✅ DynamoDB Access Successful');
        console.log('📋 Available Tables:', TableNames);
    } catch (error) {
        console.log('❌ DynamoDB Access Failed');
        console.log(`Error: ${error.message}`);
    }
}

// Run the check
checkConfiguration()
    .then(() => console.log('\n✨ Configuration check complete'))
    .catch(error => console.error('\n❌ Configuration check failed:', error));
