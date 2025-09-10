const AWS = require('aws-sdk');

async function verifyCredentials() {
    try {
        console.log('🔍 Starting AWS credentials verification...');
        
        // Log environment check
        console.log('\n📋 Environment Check:');
        console.log('AWS_REGION:', process.env.AWS_REGION || 'not set');
        console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '****' + process.env.AWS_ACCESS_KEY_ID.slice(-4) : 'not set');
        console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '**** (set)' : 'not set');

        // Configure AWS
        AWS.config.update({
            region: process.env.AWS_REGION || 'ap-south-1',
            credentials: new AWS.Credentials({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            })
        });

        console.log('\n🔄 Testing AWS STS...');
        const sts = new AWS.STS();
        const identity = await sts.getCallerIdentity().promise();
        console.log('✅ STS Check Successful!');
        console.log('Account:', identity.Account);
        console.log('User ARN:', identity.Arn);
        console.log('User ID:', identity.UserId);

        console.log('\n🔄 Testing DynamoDB Access...');
        const dynamoDB = new AWS.DynamoDB();
        const tables = await dynamoDB.listTables().promise();
        console.log('✅ DynamoDB Access Successful!');
        console.log('Tables found:', tables.TableNames);

        console.log('\n✅ All checks passed! Your AWS credentials are valid and working.');
    } catch (error) {
        console.error('\n❌ Verification failed!');
        console.error('Error Code:', error.code);
        console.error('Error Message:', error.message);
        
        if (error.code === 'InvalidClientTokenId') {
            console.error('\n⚠️ Your AWS credentials are invalid. Please check:');
            console.error('1. The Access Key ID is correct');
            console.error('2. The Secret Access Key is correct');
            console.error('3. The credentials are active in IAM');
            console.error('4. There are no extra spaces or special characters');
        }
        
        if (error.code === 'AccessDenied') {
            console.error('\n⚠️ Your AWS credentials are valid but lack necessary permissions. Please check:');
            console.error('1. The IAM user has appropriate DynamoDB permissions');
            console.error('2. The IAM user has appropriate STS permissions');
        }
    }
}

// Run the verification
verifyCredentials();
