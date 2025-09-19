const crypto = require('crypto');
const { initializeDynamoDB } = require('../../config/config');

const TABLE_NAME = process.env.PHONE_OTP_TABLE || 'PhoneOtps';
const MAX_ATTEMPTS = 5;

const buildKey = (phone, purpose) => `${phone}#${purpose}`;

const hashCode = (code) =>
  crypto
    .createHash('sha256')
    .update(String(code))
    .digest('hex');

exports.storeOtp = async ({ phone, purpose, code, ttlSeconds, payload = {} }) => {
  const now = new Date();
  const expiresAtSeconds = Math.floor(now.getTime() / 1000) + ttlSeconds;
  const item = {
    pk: buildKey(phone, purpose),
    phone,
    purpose,
    codeHash: hashCode(code),
    attempts: 0,
    ttl: expiresAtSeconds,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
    payload,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  const params = {
    TableName: TABLE_NAME,
    Item: item
  };

  const { documentClient } = await initializeDynamoDB();
  await documentClient.put(params).promise();

  return item;
};

exports.getOtp = async ({ phone, purpose }) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { pk: buildKey(phone, purpose) }
  };

  const { documentClient } = await initializeDynamoDB();
  const result = await documentClient.get(params).promise();
  return result.Item || null;
};

exports.deleteOtp = async ({ phone, purpose }) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { pk: buildKey(phone, purpose) }
  };

  const { documentClient } = await initializeDynamoDB();
  await documentClient.delete(params).promise();
};

exports.incrementAttempts = async ({ phone, purpose }) => {
  const params = {
    TableName: TABLE_NAME,
    Key: { pk: buildKey(phone, purpose) },
    UpdateExpression: 'SET attempts = if_not_exists(attempts, :zero) + :inc, updatedAt = :now',
    ExpressionAttributeValues: {
      ':inc': 1,
      ':zero': 0,
      ':now': new Date().toISOString()
    },
    ReturnValues: 'ALL_NEW'
  };

  const { documentClient } = await initializeDynamoDB();
  const result = await documentClient.update(params).promise();
  return result.Attributes;
};

exports.validateCode = (code, item) => {
  if (!item) {
    return { valid: false, reason: 'not_found' };
  }

  if (item.attempts >= MAX_ATTEMPTS) {
    return { valid: false, reason: 'max_attempts' };
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (item.ttl && nowSeconds > item.ttl) {
    return { valid: false, reason: 'expired' };
  }

  const matches = item.codeHash === hashCode(code);
  return {
    valid: matches,
    reason: matches ? null : 'mismatch'
  };
};

exports.MAX_ATTEMPTS = MAX_ATTEMPTS;

