const { s3 } = require('../../config/aws-robust');
const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const bucketName = process.env.S3_BUCKET_NAME || 'nfacialimagescollections';

const s3Service = {
  async uploadFile(fileBuffer, fileName, contentType = 'image/jpeg') {
    const key = `face-images/${Date.now()}-${fileName}`;
    
    try {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
        ACL: 'public-read'
      });
      await s3.send(command);

      const url = `https://${bucketName}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;
      
      return {
        url,
        key,
        bucket: bucketName,
        region: process.env.AWS_REGION || 'ap-south-1'
      };
    } catch (error) {
      console.error('S3 Upload Error:', error);
      return { success: false, error: error.message };
    }
  },

  async deleteFile(key) {
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key
    });

    try {
      await s3.send(command);
      return { success: true };
    } catch (error) {
      console.error('S3 Delete Error:', error);
      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  },

  async getSignedUrl(key, expiresIn = 3600) {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key
    });

    try {
      const signedUrl = await getSignedUrl(s3, command, { expiresIn });
      return signedUrl;
    } catch (error) {
      console.error('S3 Signed URL Error:', error);
      throw new Error(`Failed to generate signed URL: ${error.message}`);
    }
  },

  async getFileUrl(key) {
    return `https://${bucketName}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com/${key}`;
  }
};

module.exports = s3Service; 