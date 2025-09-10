const { initializeDynamoDB } = require('../../config/config');
const bcrypt = require('bcryptjs');

const AdminUserModel = {
    tableName: 'AdminUsers',

    // Create a new admin user
    async create(adminData) {
        const timestamp = new Date().toISOString();
        const hashedPassword = await bcrypt.hash(adminData.password, 12);
        
        const params = {
            TableName: this.tableName,
            Item: {
                userId: adminData.userId,
                email: adminData.email,
                password: hashedPassword,
                role: adminData.role || 'admin',
                permissions: adminData.permissions || [],
                lastLogin: null,
                lastActivity: timestamp,
                activityLog: [],
                status: 'active',
                createdAt: timestamp,
                updatedAt: timestamp
            },
            ConditionExpression: 'attribute_not_exists(email)'
        };

        try {
            const { documentClient } = await initializeDynamoDB();
            await documentClient.put(params).promise();
            return params.Item;
        } catch (error) {
            if (error.code === 'ConditionalCheckFailedException') {
                throw new Error('Email already exists');
            }
            throw error;
        }
    },

    // Get admin user by ID
    async get(userId) {
        const params = {
            TableName: this.tableName,
            Key: {
                userId: userId
            }
        };

        const { documentClient } = await initializeDynamoDB();
        const result = await documentClient.get(params).promise();
        return result.Item;
    },

    // Get admin user by email
    async getByEmail(email) {
        const params = {
            TableName: this.tableName,
            FilterExpression: 'email = :email',
            ExpressionAttributeValues: {
                ':email': email
            }
        };

        const { documentClient } = await initializeDynamoDB();
        const result = await documentClient.scan(params).promise();
        return result.Items[0];
    },

    // Find by email (alias for getByEmail)
    async findByEmail(email) {
        return this.getByEmail(email);
    },

    // Update admin user
    async update(userId, updateData) {
        const timestamp = new Date().toISOString();
        let UpdateExpression = 'SET updatedAt = :updatedAt';
        const ExpressionAttributeValues = {
            ':updatedAt': timestamp
        };
        const ExpressionAttributeNames = {};

        // Build update expression dynamically
        Object.keys(updateData).forEach((key, index) => {
            if (key !== 'userId') {
                UpdateExpression += `, #key${index} = :value${index}`;
                ExpressionAttributeNames[`#key${index}`] = key;
                ExpressionAttributeValues[`:value${index}`] = updateData[key];
            }
        });

        const params = {
            TableName: this.tableName,
            Key: {
                userId: userId
            },
            UpdateExpression,
            ExpressionAttributeNames,
            ExpressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        };

        const { documentClient } = await initializeDynamoDB();
        const result = await documentClient.update(params).promise();
        return result.Attributes;
    },

    // Delete admin user
    async delete(userId) {
        const params = {
            TableName: this.tableName,
            Key: {
                userId: userId
            }
        };

        const { documentClient } = await initializeDynamoDB();
        await documentClient.delete(params).promise();
    },

    // Get all admin users
    async getAll() {
        const params = {
            TableName: this.tableName
        };

        const { documentClient } = await initializeDynamoDB();
        const result = await documentClient.scan(params).promise();
        return result.Items;
    },

    // Add activity log entry
    async addActivity(userId, activity) {
        const timestamp = new Date().toISOString();
        const activityEntry = {
            action: activity.action,
            description: activity.description,
            timestamp: timestamp
        };

        const params = {
            TableName: this.tableName,
            Key: {
                userId: userId
            },
            UpdateExpression: 'SET lastActivity = :timestamp, activityLog = list_append(if_not_exists(activityLog, :emptyList), :activityEntry)',
            ExpressionAttributeValues: {
                ':timestamp': timestamp,
                ':activityEntry': [activityEntry],
                ':emptyList': []
            },
            ReturnValues: 'ALL_NEW'
        };

        const { documentClient } = await initializeDynamoDB();
        const result = await documentClient.update(params).promise();
        return result.Attributes;
    }
};

module.exports = AdminUserModel;
