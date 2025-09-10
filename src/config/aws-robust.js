// AWS SDK configuration with multiple fallback strategies
const AWS = require('aws-sdk');

const awsConfig = {
  region: process.env.AWS_REGION || 'ap-south-1',
  ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && {
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  })
};

// Configure AWS globally
AWS.config.update(awsConfig);

let s3, rekognition, cognito;

// Try AWS SDK v3 first
try {
  const { S3Client } = require('@aws-sdk/client-s3');
  const { RekognitionClient } = require('@aws-sdk/client-rekognition');
  const { CognitoIdentityProviderClient } = require('@aws-sdk/client-cognito-identity-provider');

  s3 = new S3Client(awsConfig);
  rekognition = new RekognitionClient(awsConfig);
  cognito = new CognitoIdentityProviderClient(awsConfig);
  
  console.log('AWS SDK v3 initialized successfully');

} catch (v3Error) {
  console.warn('AWS SDK v3 failed, using v2 clients:', v3Error.message);
  
  s3 = new AWS.S3();
  rekognition = new AWS.Rekognition();
  cognito = new AWS.CognitoIdentityServiceProvider();
}

// Create DynamoDB clients
const dynamoDB = new AWS.DynamoDB();
const documentClient = new AWS.DynamoDB.DocumentClient();

module.exports = {
  rekognition,
  s3,
  cognito,
  dynamoDB,
  documentClient,
  config: awsConfig
};
