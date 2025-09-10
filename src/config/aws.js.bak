// AWS SDK configuration with serverless compatibility
let s3, rekognition, cognito;

try {
  const { S3Client } = require('@aws-sdk/client-s3');
  const { RekognitionClient } = require('@aws-sdk/client-rekognition');
  const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');

  // Configure AWS SDK v3 clients with error handling
  const awsConfig = {
    region: process.env.AWS_REGION || 'ap-south-1',
    ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && {
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    })
  };

  s3 = new S3Client(awsConfig);
  rekognition = new RekognitionClient(awsConfig);
  cognito = new CognitoIdentityProviderClient(awsConfig);

} catch (error) {
  console.warn('AWS SDK initialization failed, using mock clients:', error.message);
  
  // Provide mock clients if AWS SDK fails to load
  const mockClient = {
    send: async () => ({ success: false, error: 'AWS SDK not available in this environment' })
  };
  
  s3 = mockClient;
  rekognition = mockClient;
  cognito = mockClient;
}

module.exports = {
  rekognition,
  s3,
  cognito
};
