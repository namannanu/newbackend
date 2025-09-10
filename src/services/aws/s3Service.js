const AWS = require('aws-sdk');

// Initialize S3 client
const s3Client = new AWS.S3({
  apiVersion: '2006-03-01',
  region: process.env.AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

/**
 * Generate a presigned URL for S3 upload
 * @param {string} fileName - Name of the file to upload
 * @param {string} fileType - MIME type of the file
 * @param {string} userId - User ID for folder structure
 * @returns {Promise<string>} - Presigned URL
 */
const generatePresignedUrl = async (fileName, fileType, userId) => {
  const key = `user-uploads/${userId}/${Date.now()}-${fileName}`;
  
  const params = {
    Bucket: process.env.AWS_S3_BUCKET || 'nfacialimagescollections',
    Key: key,
    ContentType: fileType,
    Expires: 3600, // 1 hour
    Metadata: {
      userId: userId,
      uploadedAt: new Date().toISOString()
    }
  };

  try {
    const presignedUrl = await s3Client.getSignedUrlPromise('putObject', params);
    return {
      presignedUrl,
      key,
      uploadUrl: `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
    };
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw new Error('Failed to generate presigned URL');
  }
};

/**
 * Delete an object from S3
 * @param {string} key - S3 object key
 * @returns {Promise<boolean>} - Success status
 */
const deleteObject = async (key) => {
  try {
    await s3Client.deleteObject({
      Bucket: process.env.AWS_S3_BUCKET || 'nfacialimagescollections',
      Key: key
    }).promise();
    return true;
  } catch (error) {
    console.error('Error deleting object from S3:', error);
    throw new Error('Failed to delete object from S3');
  }
};

module.exports = {
  generatePresignedUrl,
  deleteObject,
  s3Client
};
