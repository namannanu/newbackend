const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is not set');
}

// 🔑 Login Service
async function login(email, password) {
  // Use scan instead of query since EmailIndex doesn't exist
  const params = {
    TableName: 'AdminUsers',
    FilterExpression: 'email = :email',
    ExpressionAttributeValues: {
      ':email': email.toLowerCase()
    }
  };
  
  const result = await dynamoDB.scan(params).promise();
  const user = result.Items[0];
  
  if (!user) {
    throw new Error("Invalid user");
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
    JWT_SECRET,
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

  // Format the response
  return {
    status: "success",
    token,
    data: {
      user: {
        userId: user.userId,
        name: user.name || user.username,
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
