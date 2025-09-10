const { initializeDynamoDB } = require('../../config/config');

const OrganizerModel = {
    tableName: 'EventOrganiser',

    // Initialize table if it doesn't exist
    async initTable() {
        try {
            const { dynamoDB: dynamoDBRaw } = await initializeDynamoDB();
            await dynamoDBRaw.describeTable({ TableName: this.tableName }).promise();
            console.log(`Table ${this.tableName} already exists`);
        } catch (error) {
            if (error.code === 'ResourceNotFoundException') {
                console.log(`Creating table ${this.tableName}...`);
                const params = {
                    TableName: this.tableName,
                    KeySchema: [
                        { AttributeName: 'organiserId', KeyType: 'HASH' }
                    ],
                    AttributeDefinitions: [
                        { AttributeName: 'organiserId', AttributeType: 'S' },
                        { AttributeName: 'email', AttributeType: 'S' },
                        { AttributeName: 'status', AttributeType: 'S' },
                        { AttributeName: 'joinDate', AttributeType: 'S' }
                    ],
                    GlobalSecondaryIndexes: [
                        {
                            IndexName: 'EmailIndex',
                            KeySchema: [
                                { AttributeName: 'email', KeyType: 'HASH' }
                            ],
                            Projection: { ProjectionType: 'ALL' },
                            ProvisionedThroughput: {
                                ReadCapacityUnits: 5,
                                WriteCapacityUnits: 5
                            }
                        },
                        {
                            IndexName: 'StatusIndex',
                            KeySchema: [
                                { AttributeName: 'status', KeyType: 'HASH' },
                                { AttributeName: 'joinDate', KeyType: 'RANGE' }
                            ],
                            Projection: { ProjectionType: 'ALL' },
                            ProvisionedThroughput: {
                                ReadCapacityUnits: 5,
                                WriteCapacityUnits: 5
                            }
                        }
                    ],
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 5,
                        WriteCapacityUnits: 5
                    }
                };

                await dynamoDBRaw.createTable(params).promise();
                console.log(`Table ${this.tableName} created successfully`);
                
                // Wait for table to become active
                await dynamoDBRaw.waitFor('tableExists', { TableName: this.tableName }).promise();
            } else {
                throw error;
            }
        }
    },

    // Define primary key and GSI configurations
    keys: {
        primary: 'organiserId',
        indexes: {
            emailIndex: {
                name: 'EmailIndex',
                key: 'email'
            },
            statusIndex: {
                name: 'StatusIndex',
                key: 'status',
                sortKey: 'joinDate'
            }
        }
    },

    // Create a new organizer
    async create(organizerData) {
        const timestamp = new Date().toISOString();
        const organizerId = `org_${Date.now()}`;

        const params = {
            TableName: this.tableName,
            Item: {
                organiserId: organizerId,
                name: organizerData.name,
                email: organizerData.email,
                phone: organizerData.phone,
                address: organizerData.address,
                website: organizerData.website || null,
                description: organizerData.description || null,
                contactPerson: organizerData.contactPerson,
                status: organizerData.status || 'active',
                joinDate: timestamp,
                lastActivity: timestamp,
                logo: organizerData.logo || null,
                totalRevenue: organizerData.totalRevenue || 0,
                totalEvents: organizerData.totalEvents || 0,
                activeEvents: organizerData.activeEvents || 0,
                createdAt: timestamp,
                updatedAt: timestamp
            },
            // Ensure email is unique
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

    // Get organizer by ID
    async get(organizerId) {
        const params = {
            TableName: this.tableName,
            Key: {
                organiserId: organizerId
            }
        };

        const { documentClient } = await initializeDynamoDB();
        const result = await documentClient.get(params).promise();
        return result.Item;
    },

    // Get organizer by email
    async getByEmail(email) {
        const params = {
            TableName: this.tableName,
            IndexName: this.keys.indexes.emailIndex.name,
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: {
                ':email': email
            }
        };

        const { documentClient } = await initializeDynamoDB();
        const result = await documentClient.query(params).promise();
        return result.Items[0]; // Return first matching organizer
    },

    // Update organizer
    async update(organizerId, updateData) {
        const timestamp = new Date().toISOString();
        let UpdateExpression = 'SET updatedAt = :updatedAt';
        const ExpressionAttributeValues = {
            ':updatedAt': timestamp
        };
        const ExpressionAttributeNames = {};

        Object.keys(updateData).forEach((key, index) => {
            if (key !== 'organiserId') {
                UpdateExpression += `, #key${index} = :value${index}`;
                ExpressionAttributeNames[`#key${index}`] = key;
                ExpressionAttributeValues[`:value${index}`] = updateData[key];
            }
        });

        const params = {
            TableName: this.tableName,
            Key: {
                organiserId: organizerId
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

    // Update organizer stats
    async updateStats(organizerId, { revenue = 0, totalEvents = 0, activeEvents = 0 }) {
        const timestamp = new Date().toISOString();
        const params = {
            TableName: this.tableName,
            Key: {
                organiserId: organizerId
            },
            UpdateExpression: `SET 
                totalRevenue = totalRevenue + :revenue,
                totalEvents = totalEvents + :totalEvents,
                activeEvents = activeEvents + :activeEvents,
                lastActivity = :lastActivity,
                updatedAt = :updatedAt`,
            ExpressionAttributeValues: {
                ':revenue': revenue,
                ':totalEvents': totalEvents,
                ':activeEvents': activeEvents,
                ':lastActivity': timestamp,
                ':updatedAt': timestamp
            },
            ReturnValues: 'ALL_NEW'
        };

        const { documentClient } = await initializeDynamoDB();
        const result = await documentClient.update(params).promise();
        return result.Attributes;
    },

    // List organizers with pagination
    async list(limit = 10, lastEvaluatedKey = null) {
        const params = {
            TableName: this.tableName,
            Limit: limit
        };

        if (lastEvaluatedKey) {
            params.ExclusiveStartKey = lastEvaluatedKey;
        }

        const { documentClient } = await initializeDynamoDB();
        const result = await documentClient.scan(params).promise();
        return {
            items: result.Items,
            lastEvaluatedKey: result.LastEvaluatedKey
        };
    },

    // Query organizers by status
    async queryByStatus(status) {
        const params = {
            TableName: this.tableName,
            IndexName: this.keys.indexes.statusIndex.name,
            KeyConditionExpression: '#status = :status',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':status': status
            }
        };

        const { documentClient } = await initializeDynamoDB();
        const result = await documentClient.query(params).promise();
        return result.Items;
    }
};

module.exports = OrganizerModel;
