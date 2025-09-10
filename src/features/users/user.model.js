
const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();

const UserModel = {
    tableName: 'Users',
    faceImageTableName: 'faceimage',
    
    // Define primary key and GSI configurations
    keys: {
        primary: 'userId',
        indexes: {
            email: {
                name: 'EmailIndex',
                key: 'email'
            }
        }
    },

    // Create a new user
    async create(userData) {
        const timestamp = new Date().toISOString();
        
        const params = {
            TableName: this.tableName,
            Item: {
                userId: userData.userId,
                fullName: userData.fullName,
                email: userData.email,
                password: userData.password,
                phone: userData.phone,
                role: userData.role || 'user',
                permissions: userData.permissions || [],
                avatar: userData.avatar,
                verificationStatus: userData.verificationStatus || 'pending',
                aadhaarPhoto: userData.aadhaarPhoto,
                uploadedPhoto: userData.uploadedPhoto,
                lastLogin: userData.lastLogin,
                status: userData.status || 'active',
                createdAt: timestamp,
                updatedAt: timestamp
            },
            // Ensure email is unique
            ConditionExpression: 'attribute_not_exists(email)'
        };

        try {
            await dynamoDB.put(params).promise();
            return params.Item;
        } catch (error) {
            if (error.code === 'ConditionalCheckFailedException') {
                throw new Error('Email already exists');
            }
            throw error;
        }
    },

    // Get user by ID
    async get(userId, includeFaceId = false) {
        const params = {
            TableName: this.tableName,
            Key: {
                userId: userId
            }
        };

        const result = await dynamoDB.get(params).promise();
        const user = result.Item;
        
        // If includeFaceId flag is true, add hasFaceImage property to the response
        if (user && includeFaceId) {
            try {
                // Check if user has any face image record
                const hasFaceImage = await this.hasFaceImageForUser(userId);
                
                // Add hasFaceImage property rather than setting faceId
                user.hasFaceImage = hasFaceImage;
                
                if (hasFaceImage) {
                    const actualFaceId = await this.getFaceIdFromFaceImageTable(userId);
                    console.log(`User ${userId} has face image with ID: ${actualFaceId || 'unknown'}`);
                }
            } catch (error) {
                console.error(`Error checking face image for user ${userId}:`, error);
            }
        }
        
        return user;
    },

    // Get user by email (using GSI)
  // Get user by email (using GSI)
async getByEmail(email) {
    const params = {
        TableName: this.tableName,
        IndexName: 'EmailIndex',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
            ':email': email.toLowerCase()
        }
    };

    const result = await dynamoDB.query(params).promise();
    return result.Items[0]; // Return first matching user
},

    // Find by email (alias for getByEmail)
    async findByEmail(email) {
        return this.getByEmail(email);
    },

    // Update user
    async update(userId, updateData) {
        const timestamp = new Date().toISOString();
        let UpdateExpression = 'SET updatedAt = :updatedAt';
        const ExpressionAttributeValues = {
            ':updatedAt': timestamp
        };
        const ExpressionAttributeNames = {};

        // Build update expression dynamically
        let i = 0;
        Object.keys(updateData).forEach((key) => {
            // Prevent updating primary key and avoid duplicating updatedAt which we always set above
            if (key === 'userId' || key === 'updatedAt') return;
            UpdateExpression += `, #key${i} = :value${i}`;
            ExpressionAttributeNames[`#key${i}`] = key;
            ExpressionAttributeValues[`:value${i}`] = updateData[key];
            i += 1;
        });

        const params = {
            TableName: this.tableName,
            Key: {
                userId: userId
            },
            UpdateExpression,
            ExpressionAttributeNames: Object.keys(ExpressionAttributeNames).length ? ExpressionAttributeNames : undefined,
            ExpressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        };

        const result = await dynamoDB.update(params).promise();
        return result.Attributes;
    },

    // Delete user
    async delete(userId) {
        const params = {
            TableName: this.tableName,
            Key: {
                userId: userId
            }
        };

        await dynamoDB.delete(params).promise();
    },

    // List users with pagination
    async list(limit = 10, lastEvaluatedKey = null) {
        const params = {
            TableName: this.tableName,
            Limit: limit
        };

        if (lastEvaluatedKey) {
            params.ExclusiveStartKey = lastEvaluatedKey;
        }

        const result = await dynamoDB.scan(params).promise();
        return {
            items: result.Items,
            lastEvaluatedKey: result.LastEvaluatedKey
        };
    },

    // Query users by status
    async queryByStatus(status) {
        const params = {
            TableName: this.tableName,
            FilterExpression: '#status = :status',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':status': status
            }
        };

        const result = await dynamoDB.scan(params).promise();
        return result.Items;
    },

    // Get all users
    async getAllUsers() {
        const params = {
            TableName: this.tableName
        };

        const result = await dynamoDB.scan(params).promise();
        return result.Items;
    },

    // Get user by ID (alias for get)
    async getUserById(userId, includeFaceId = false) {
        return this.get(userId, includeFaceId);
    },

    // Update user (alias for update)
    async updateUser(userId, updateData) {
        return this.update(userId, updateData);
    },

    // Delete user (alias for delete)
    async deleteUser(userId) {
        return this.delete(userId);
    },

    // Update verification status
    async updateVerificationStatus(userId, status) {
        return this.update(userId, {
            verificationStatus: status,
            updatedAt: new Date().toISOString()
        });
    },
    
    // Get face RekognitionId for a user from faceimage table
    async getFaceIdFromFaceImageTable(userId) {
        try {
            // Prefer using a GSI on UserId if available
            try {
                const q = await dynamoDB.query({
                    TableName: this.faceImageTableName,
                    IndexName: 'UserId-index',
                    KeyConditionExpression: '#Uid = :uid',
                    ExpressionAttributeNames: { '#Uid': 'UserId' },
                    ExpressionAttributeValues: { ':uid': userId },
                    Limit: 1
                }).promise();
                if (q.Items && q.Items.length > 0) {
                    const item = q.Items[0];
                    const faceId = item.RekognitionId || null;
                    console.log(`Found faceimage via UserId GSI for user ${userId}:`, faceId);
                    return faceId;
                }
            } catch (gsiErr) {
                console.warn('faceimage UserId-index query failed, will try scan fallback:', gsiErr.message);
            }

            // Fallback: scan for any item with this UserId
            try {
                const scan = await dynamoDB.scan({
                    TableName: this.faceImageTableName,
                    FilterExpression: '#Uid = :uid',
                    ExpressionAttributeNames: { '#Uid': 'UserId' },
                    ExpressionAttributeValues: { ':uid': userId },
                    Limit: 1
                }).promise();
                if (scan.Items && scan.Items.length > 0) {
                    const item = scan.Items[0];
                    const faceId = item.RekognitionId || null;
                    console.log(`Found faceimage via scan for user ${userId}:`, faceId);
                    return faceId;
                }
            } catch (scanErr) {
                console.warn('faceimage scan fallback failed:', scanErr.message);
            }

            return null;
        } catch (error) {
            console.error(`Error getting face ID for user ${userId}:`, error);
            return null;
        }
    },

    // Check if a faceimage record exists for the user (by UserId); returns boolean
    async hasFaceImageForUser(userId) {
        console.log(`Checking if faceimage record exists for user ${userId}`);
        try {
            // Try GSI on UserId first (more efficient)
            try {
                console.log(`Querying faceimage table with UserId-index GSI for user ${userId}`);
                const q = await dynamoDB.query({
                    TableName: this.faceImageTableName,
                    IndexName: 'UserId-index',
                    KeyConditionExpression: '#Uid = :uid',
                    ExpressionAttributeNames: { '#Uid': 'UserId' },
                    ExpressionAttributeValues: { ':uid': userId },
                    Limit: 1
                }).promise();
                
                console.log(`GSI query result for ${userId}: found ${q.Items ? q.Items.length : 0} items`);
                if (q.Items && q.Items.length > 0) {
                    console.log(`Found faceimage record via GSI for user ${userId}`);
                    return true;
                }
            } catch (gsiErr) {
                console.warn(`GSI query failed for user ${userId}, falling back to scan: ${gsiErr.message}`);
                
                // Fallback to scan (less efficient but more reliable)
                const scan = await dynamoDB.scan({
                    TableName: this.faceImageTableName,
                    FilterExpression: '#Uid = :uid',
                    ExpressionAttributeNames: { '#Uid': 'UserId' },
                    ExpressionAttributeValues: { ':uid': userId },
                    Limit: 1
                }).promise();
                
                console.log(`Scan result for ${userId}: found ${scan.Items ? scan.Items.length : 0} items`);
                if (scan.Items && scan.Items.length > 0) {
                    console.log(`Found faceimage record via scan for user ${userId}`);
                    return true;
                }
            }
            console.log(`No faceimage record found for user ${userId}`);
            return false;
        } catch (err) {
            console.error(`Error checking faceimage presence for ${userId}:`, err);
            return false;
        }
    },
    
    // Get user by ID with face image existence check
    async getUserWithFaceId(userId) {
        // Get user data
        const user = await this.get(userId);
        
        if (!user) {
            return null;
        }
        
        // Check if user has any face image entry
        const hasFaceImage = await this.hasFaceImageForUser(userId);
        
        // Update the user object with the face image existence flag
        return {
            ...user,
            hasFaceImage: hasFaceImage
        };
    }
};

module.exports = UserModel;
