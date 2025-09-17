const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Do not throw at import time; validate when needed so modules can load in dev/test
const requireJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error('JWT_SECRET environment variable is not set');
    err.name = 'ConfigError';
    throw err;
  }
  return secret;
};

// 🔑 Login Service
async function login(identifier, password) {
  if (!identifier || !password) {
    throw new Error('Identifier and password are required');
  }

  const trimmedIdentifier = identifier.trim();
  const normalizedIdentifier = trimmedIdentifier.toLowerCase();

  // Use scan instead of query since EmailIndex doesn't exist
  const params = {
    TableName: 'AdminUsers',
    FilterExpression:
      'email = :normalizedIdentifier OR #username = :normalizedIdentifier OR #username = :identifierExact',
    ExpressionAttributeNames: {
      '#username': 'username'
    },
    ExpressionAttributeValues: {
      ':normalizedIdentifier': normalizedIdentifier,
      ':identifierExact': trimmedIdentifier
    }
  };

  const result = await dynamoDB.scan(params).promise();
  const user = (result.Items || []).find((item) => {
    if (!item) return false;
    const emailMatch = item.email && item.email.toLowerCase() === normalizedIdentifier;
    const usernameMatch = item.username && item.username.toLowerCase() === normalizedIdentifier;
    return emailMatch || usernameMatch;
  });

  if (!user) {
    throw new Error('Invalid user');
  }

  // check password
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error("Invalid password");
  }

  // generate JWT
  const token = jwt.sign(
    {
      userId: user.userId,
      email: user.email,
      role: "admin",
    },
    requireJwtSecret(),
    { expiresIn: "1d" }
  );

  // Format the last login time
  const lastLoginFormatted = user.lastLogin ? 
    (new Date(user.lastLogin).toDateString() === new Date().toDateString() ? 
      'Today' : new Date(user.lastLogin).toLocaleDateString()) : null;

  // Update the user's last login time
  const updateParams = {
    TableName: 'AdminUsers',
    Key: { userId: user.userId },
    UpdateExpression: 'set lastLogin = :lastLogin, updatedAt = :updatedAt',
    ExpressionAttributeValues: {
      ':lastLogin': new Date().toISOString(),
      ':updatedAt': new Date().toISOString()
    }
  };
  await dynamoDB.update(updateParams).promise();

  const fullName = user.fullName || user.name || user.username || '';

  // Format the response
  return {
    status: "success",
    token,
    data: {
      user: {
        userId: user.userId,
        fullName,
        email: user.email,
        role: user.role || "user",
        permissions: user.permissions || [],
        verificationStatus: user.verificationStatus || "pending",
        status: user.status || "active",
        uploadedPhoto: user.avatar || user.uploadedPhoto,
        _id: user.userId,
        createdAt: user.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        __v: 0,
        lastLoginFormatted
      }
    }
  };
}

module.exports = {
  login,
};
