const AWS = require('aws-sdk');

async function verifyAWSCredentials() {
    return new Promise((resolve, reject) => {
        AWS.config.getCredentials((err) => {
            if (err) {
                console.error('❌ AWS Credentials Error:', err.message);
                reject(new Error(`AWS Credentials Error: ${err.message}`));
                return;
            }

            // Check if credentials exist and are not empty
            if (!AWS.config.credentials ||
                !AWS.config.credentials.accessKeyId ||
                !AWS.config.credentials.secretAccessKey) {
                reject(new Error('AWS credentials are missing or invalid'));
                return;
            }

            // Test credentials with a simple DynamoDB operation
            const dynamodb = new AWS.DynamoDB();
            dynamodb.listTables({Limit: 1}, (err, data) => {
                if (err) {
                    console.error('❌ AWS Connection Test Failed:', err.message);
                    reject(new Error(`AWS Connection Test Failed: ${err.message}`));
                    return;
                }
                console.log('✅ AWS Credentials Verified Successfully');
                resolve(true);
            });
        });
    });
}

module.exports = verifyAWSCredentials;
