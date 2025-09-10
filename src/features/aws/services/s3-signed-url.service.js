const { S3Client, GetObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

// Initialize S3 client
let s3;

try {
  const awsConfig = {
    region: process.env.AWS_REGION || "ap-south-1"
  };

  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    awsConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };
  }

  s3 = new S3Client(awsConfig);
  console.log('[INFO] S3 client initialized successfully');
} catch (error) {
  console.error('[ERROR] Failed to initialize S3 client:', error.message);
}

/**
 * Generate a signed URL for accessing an S3 object
 * @param {string} bucket - The S3 bucket name
 * @param {string} key - The S3 object key (e.g., "public/user-uxf4qav4y-memrdvmn_rohit")
 * @param {number} expiresIn - Expiration time in seconds (default: 1 hour)
 * @returns {Promise<string|null>} - Signed URL or null if error
 */
const getSignedImageUrl = async (bucket, key, expiresIn = 60 * 60) => {
  try {
    if (!s3) {
      console.error('[ERROR] S3 client not initialized');
      return null;
    }

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn });
    
    console.log(`[DEBUG] Generated signed URL for key: ${key}, expires in ${expiresIn} seconds`);
    return signedUrl;
  } catch (error) {
    console.error(`[ERROR] Failed to generate signed URL for key ${key}:`, error);
    return null;
  }
};

/**
 * Check if an S3 object exists
 * @param {string} bucket - The S3 bucket name
 * @param {string} key - The S3 object key
 * @returns {Promise<boolean>} - True if object exists
 */
const checkObjectExists = async (bucket, key) => {
  try {
    if (!s3) {
      console.error('[ERROR] S3 client not initialized');
      return false;
    }

    const command = new HeadObjectCommand({
      Bucket: bucket,
      Key: key
    });

    await s3.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound') {
      return false;
    }
    console.error(`[ERROR] Error checking object existence for ${key}:`, error);
    return false;
  }
};

/**
 * Generate multiple signed URLs for different expiration times
 * @param {string} bucket - The S3 bucket name
 * @param {string} key - The S3 object key
 * @param {number[]} expirationTimes - Array of expiration times in seconds
 * @returns {Promise<string[]|null>} - Array of signed URLs or null if error
 */
const getMultipleSignedUrls = async (bucket, key, expirationTimes = [15*60, 60*60, 24*60*60]) => {
  try {
    if (!s3) {
      console.error('[ERROR] S3 client not initialized');
      return null;
    }

    const signedUrls = await Promise.all(
      expirationTimes.map(expiry => getSignedImageUrl(bucket, key, expiry))
    );

    // Check if any URL generation failed
    if (signedUrls.some(url => url === null)) {
      console.error('[ERROR] Some signed URLs failed to generate');
      return null;
    }

    return signedUrls;
  } catch (error) {
    console.error(`[ERROR] Failed to generate multiple signed URLs for key ${key}:`, error);
    return null;
  }
};

module.exports = {
  getSignedImageUrl,
  checkObjectExists,
  getMultipleSignedUrls,
  s3Client: s3
};
