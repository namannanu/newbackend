const AWS = require('aws-sdk');

// AWS Configuration
const awsConfig = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'ap-south-1',
    sessionToken: process.env.AWS_SESSION_TOKEN // Optional for temporary credentials
};

// Configure AWS SDK
AWS.config.update(awsConfig);

// Initialize AWS services
const s3 = new AWS.S3();
const rekognition = new AWS.Rekognition();
const dynamoDB = new AWS.DynamoDB();
const documentClient = new AWS.DynamoDB.DocumentClient();

// S3 bucket configuration
const s3Config = {
    bucketName: process.env.AWS_S3_BUCKET || 'your-bucket-name',
    region: process.env.AWS_REGION || 'ap-south-1',
    signedUrlExpireSeconds: 60 * 60 // 1 hour
};

// DynamoDB configuration
const dynamoConfig = {
    tablePrefix: process.env.DYNAMODB_TABLE_PREFIX || 'dev_',
    region: process.env.AWS_REGION || 'ap-south-1'
};

// Rekognition configuration
const rekognitionConfig = {
    similarityThreshold: 90.0, // Minimum similarity score for face matches
    maxFaces: 5 // Maximum number of faces to detect in an image
};

// Utility function to generate S3 signed URLs
const getSignedUrl = async (operation, params) => {
    return new Promise((resolve, reject) => {
        s3.getSignedUrl(operation, params, (err, url) => {
            if (err) reject(err);
            else resolve(url);
        });
    });
};

// Export configurations and initialized services
module.exports = {
    // AWS Services
    s3,
    rekognition,
    dynamoDB,
    documentClient,
    
    // Configurations
    awsConfig,
    s3Config,
    dynamoConfig,
    rekognitionConfig,
    
    // Utility functions
    getSignedUrl,
    
    // Helper function to get table name with prefix
    getTableName: (baseName) => `${dynamoConfig.tablePrefix}${baseName}`
};
