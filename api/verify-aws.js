// api/verify-aws.js

const AWS = require('aws-sdk');

module.exports = async (req, res) => {
    try {
        console.log('Starting AWS verification...');

        // Check environment variables
        const envVars = {
            AWS_REGION: process.env.AWS_REGION || 'ap-south-1',
            AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? '****' + process.env.AWS_ACCESS_KEY_ID.slice(-4) : 'NOT_SET',
            AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY ? '****' : 'NOT_SET'
        };

        console.log('Environment variables:', envVars);

        // Configure AWS
        AWS.config.update({
            region: process.env.AWS_REGION || 'ap-south-1',
            credentials: new AWS.Credentials({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            })
        });

        // Test STS first
        const sts = new AWS.STS();
        const identity = await sts.getCallerIdentity().promise();
        
        console.log('STS check passed:', {
            Account: identity.Account,
            UserId: identity.UserId,
            Arn: identity.Arn
        });

        // Test DynamoDB
        const dynamodb = new AWS.DynamoDB();
        const tables = await dynamodb.listTables().promise();
        
        console.log('DynamoDB check passed. Tables:', tables.TableNames);

        return res.status(200).json({
            status: 'success',
            message: 'AWS credentials are valid',
            details: {
                identity: {
                    account: identity.Account,
                    userArn: identity.Arn
                },
                tables: tables.TableNames
            }
        });
    } catch (error) {
        console.error('AWS verification failed:', error);
        
        return res.status(500).json({
            status: 'error',
            message: 'AWS credentials verification failed',
            error: {
                code: error.code,
                message: error.message,
                suggestion: error.code === 'InvalidClientTokenId' 
                    ? 'Please verify your AWS credentials in Vercel environment variables'
                    : 'Please check AWS permissions and configuration'
            }
        });
    }
};
