const AWS = require('aws-sdk');

class AWSConfigValidator {
    static validateCredentials(config) {
        const required = ['accessKeyId', 'secretAccessKey', 'region'];
        const missing = required.filter(key => !config[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required AWS configuration: ${missing.join(', ')}`);
        }

        // Check for common formatting issues
        if (config.accessKeyId.includes(' ') || config.secretAccessKey.includes(' ')) {
            throw new Error('AWS credentials contain spaces. Please remove any leading or trailing spaces.');
        }

        // Validate access key format (typically starts with 'AKIA' for AWS access keys)
        if (!config.accessKeyId.startsWith('AKIA')) {
            throw new Error('Invalid AWS Access Key ID format. Should start with "AKIA"');
        }

        // Validate secret key length
        if (config.secretAccessKey.length !== 40) {
            throw new Error('Invalid AWS Secret Access Key length. Should be 40 characters');
        }

        return true;
    }

    static async testConnection(config) {
        try {
            // First validate the credentials format
            this.validateCredentials(config);

            // Configure AWS with the provided credentials
            AWS.config.update({
                region: config.region,
                credentials: new AWS.Credentials({
                    accessKeyId: config.accessKeyId,
                    secretAccessKey: config.secretAccessKey
                })
            });

            // Test STS service first (lightweight check)
            const sts = new AWS.STS();
            const stsResponse = await sts.getCallerIdentity().promise();
            console.log('✅ STS check passed:', {
                Account: stsResponse.Account,
                UserId: stsResponse.UserId,
                Arn: stsResponse.Arn
            });

            // Test DynamoDB specifically
            const dynamodb = new AWS.DynamoDB();
            await dynamodb.listTables().promise();
            console.log('✅ DynamoDB check passed');

            return {
                success: true,
                identity: stsResponse
            };
        } catch (error) {
            console.error('❌ AWS connection test failed:', {
                code: error.code,
                message: error.message
            });

            // Provide more specific error messages
            let errorMessage = error.message;
            switch (error.code) {
                case 'InvalidClientTokenId':
                    errorMessage = 'Invalid AWS credentials. Please check your Access Key ID and Secret Access Key.';
                    break;
                case 'SignatureDoesNotMatch':
                    errorMessage = 'Invalid AWS Secret Access Key. Please verify your Secret Access Key.';
                    break;
                case 'AccessDenied':
                    errorMessage = 'Access denied. Please check IAM permissions for this user.';
                    break;
            }

            return {
                success: false,
                error: {
                    code: error.code,
                    message: errorMessage
                }
            };
        }
    }
}

module.exports = AWSConfigValidator;
