const { initializeDynamoDB } = require('../../config/config');

const FeedbackModel = {
    tableName: 'EventFeedback',

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
                        { AttributeName: 'feedbackId', KeyType: 'HASH' }
                    ],
                    AttributeDefinitions: [
                        { AttributeName: 'feedbackId', AttributeType: 'S' },
                        { AttributeName: 'userId', AttributeType: 'S' },
                        { AttributeName: 'eventId', AttributeType: 'S' },
                        { AttributeName: 'status', AttributeType: 'S' },
                        { AttributeName: 'createdAt', AttributeType: 'S' }
                    ],
                    GlobalSecondaryIndexes: [
                        {
                            IndexName: 'UserFeedbackIndex',
                            KeySchema: [
                                { AttributeName: 'userId', KeyType: 'HASH' }
                            ],
                            Projection: { ProjectionType: 'ALL' },
                            ProvisionedThroughput: {
                                ReadCapacityUnits: 5,
                                WriteCapacityUnits: 5
                            }
                        },
                        {
                            IndexName: 'EventFeedbackIndex',
                            KeySchema: [
                                { AttributeName: 'eventId', KeyType: 'HASH' }
                            ],
                            Projection: { ProjectionType: 'ALL' },
                            ProvisionedThroughput: {
                                ReadCapacityUnits: 5,
                                WriteCapacityUnits: 5
                            }
                        },
                        {
                            IndexName: 'StatusDateIndex',
                            KeySchema: [
                                { AttributeName: 'status', KeyType: 'HASH' },
                                { AttributeName: 'createdAt', KeyType: 'RANGE' }
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

    // Define model methods
    async create(feedbackData) {
        const timestamp = new Date().toISOString();
        const feedbackId = `fb_${Date.now()}`;

        const params = {
            TableName: this.tableName,
            Item: {
                feedbackId,
                userId: feedbackData.userId,
                eventId: feedbackData.eventId,
                rating: feedbackData.rating,
                category: feedbackData.category,
                subject: feedbackData.subject,
                message: feedbackData.message,
                status: feedbackData.status || 'new',
                helpful: 0,
                notHelpful: 0,
                createdAt: timestamp,
                updatedAt: timestamp
            }
        };

        const { documentClient } = await initializeDynamoDB();
        await documentClient.put(params).promise();
        return params.Item;
    },

    async get(feedbackId) {
        const params = {
            TableName: this.tableName,
            Key: {
                feedbackId
            }
        };

        const { documentClient } = await initializeDynamoDB();
        const result = await documentClient.get(params).promise();
        return result.Item;
    },

    async getByUser(userId) {
        const params = {
            TableName: this.tableName,
            IndexName: 'UserFeedbackIndex',
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        };

        const { documentClient } = await initializeDynamoDB();
        const result = await documentClient.query(params).promise();
        return result.Items;
    },

    async getByEvent(eventId) {
        const params = {
            TableName: this.tableName,
            IndexName: 'EventFeedbackIndex',
            KeyConditionExpression: 'eventId = :eventId',
            ExpressionAttributeValues: {
                ':eventId': eventId
            }
        };

        const { documentClient } = await initializeDynamoDB();
        const result = await documentClient.query(params).promise();
        return result.Items;
    },

    async update(feedbackId, updateData) {
        const timestamp = new Date().toISOString();
        const updateExpression = [];
        const expressionAttributeNames = {};
        const expressionAttributeValues = {
            ':updatedAt': timestamp
        };

        Object.keys(updateData).forEach(key => {
            if (key !== 'feedbackId') {
                updateExpression.push(`#${key} = :${key}`);
                expressionAttributeNames[`#${key}`] = key;
                expressionAttributeValues[`:${key}`] = updateData[key];
            }
        });

        const params = {
            TableName: this.tableName,
            Key: {
                feedbackId
            },
            UpdateExpression: `SET ${updateExpression.join(', ')}, updatedAt = :updatedAt`,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        };

        const { documentClient } = await initializeDynamoDB();
        const result = await documentClient.update(params).promise();
        return result.Attributes;
    },

    async delete(feedbackId) {
        const params = {
            TableName: this.tableName,
            Key: {
                feedbackId
            }
        };

        const { documentClient } = await initializeDynamoDB();
        await documentClient.delete(params).promise();
    }
};

module.exports = FeedbackModel;
