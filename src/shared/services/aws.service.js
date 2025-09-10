const { s3, rekognition } = require('../../config/aws-robust');
const AppError = require('../utils/appError');

exports.uploadFile = async (file, bucketName, key) => {
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype
  };

  try {
    const data = await s3.upload(params).promise();
    return data.Location;
  } catch (err) {
    throw new AppError('Failed to upload file to S3', 500);
  }
};

exports.deleteFile = async (bucketName, key) => {
  const params = {
    Bucket: bucketName,
    Key: key
  };

  try {
    await s3.deleteObject(params).promise();
  } catch (err) {
    throw new AppError('Failed to delete file from S3', 500);
  }
};

exports.compareFaces = async (sourceImage, targetImage, similarityThreshold = 90) => {
  const params = {
    SourceImage: { S3Object: { Bucket: process.env.AWS_S3_BUCKET, Name: sourceImage } },
    TargetImage: { S3Object: { Bucket: process.env.AWS_S3_BUCKET, Name: targetImage } },
    SimilarityThreshold: similarityThreshold
  };

  try {
    const data = await rekognition.compareFaces(params).promise();
    return data;
  } catch (err) {
    throw new AppError('Failed to compare faces', 500);
  }
};