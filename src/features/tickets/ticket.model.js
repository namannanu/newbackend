const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const dynamoDBRaw = new AWS.DynamoDB();

const scanAll = async (params) => {
    const items = [];
    let ExclusiveStartKey;

    do {
        const response = await dynamoDB.scan({
            ...params,
            ExclusiveStartKey
        }).promise();

        if (Array.isArray(response.Items)) {
            items.push(...response.Items);
        }

        ExclusiveStartKey = response.LastEvaluatedKey;
    } while (ExclusiveStartKey);

    return items;
};

const TicketModel = {
    tableName: 'EventTickets',

    // Initialize table if it doesn't exist
    async initTable() {
        try {
            await dynamoDBRaw.describeTable({ TableName: this.tableName }).promise();
            console.log(`Table ${this.tableName} already exists`);
        } catch (error) {
            if (error.code === 'ResourceNotFoundException') {
                console.log(`Creating table ${this.tableName}...`);
                const params = {
                    TableName: this.tableName,
                    KeySchema: [
                        { AttributeName: 'ticketId', KeyType: 'HASH' }
                    ],
                    AttributeDefinitions: [
                        { AttributeName: 'ticketId', AttributeType: 'S' },
                        { AttributeName: 'eventId', AttributeType: 'S' },
                        { AttributeName: 'userId', AttributeType: 'S' }
                    ],
                    GlobalSecondaryIndexes: [
                        {
                            IndexName: 'EventUserIndex',
                            KeySchema: [
                                { AttributeName: 'eventId', KeyType: 'HASH' },
                                { AttributeName: 'userId', KeyType: 'RANGE' }
                            ],
                            Projection: { ProjectionType: 'ALL' },
                            ProvisionedThroughput: {
                                ReadCapacityUnits: 5,
                                WriteCapacityUnits: 5
                            }
                        },
                        {
                            IndexName: 'UserTicketsIndex',
                            KeySchema: [
                                { AttributeName: 'userId', KeyType: 'HASH' }
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
        primary: 'ticketId',
        indexes: {
            eventIndex: {
                name: 'EventUserIndex',
                key: 'eventId',
                sortKey: 'userId'
            },
            userIndex: {
                name: 'UserTicketsIndex',
                key: 'userId'
            }
        }
    },

    // Create a new ticket
    async create(ticketData) {
        const timestamp = new Date().toISOString();

        const params = {
            TableName: this.tableName,
            Item: {
                ticketId: ticketData.ticketId,
                eventId: ticketData.eventId,
                userId: ticketData.userId,
                seatNumber: ticketData.seatNumber,
                price: ticketData.price,
                purchaseDate: timestamp,
                checkInTime: null,
                status: ticketData.status || 'active',
                faceVerified: false,
                createdAt: timestamp,
                updatedAt: timestamp
            }
        };

        await dynamoDB.put(params).promise();
        return params.Item;
    },

    // Get ticket by ID
    async get(ticketId) {
        const params = {
            TableName: this.tableName,
            Key: {
                ticketId: ticketId
            }
        };

        const result = await dynamoDB.get(params).promise();
        return result.Item;
    },

    // Update ticket
    async update(ticketId, updateData) {
        const timestamp = new Date().toISOString();
        let UpdateExpression = 'SET updatedAt = :updatedAt';
        const ExpressionAttributeValues = {
            ':updatedAt': timestamp
        };
        const ExpressionAttributeNames = {};

        Object.keys(updateData).forEach((key, index) => {
            if (key !== 'ticketId') {
                UpdateExpression += `, #key${index} = :value${index}`;
                ExpressionAttributeNames[`#key${index}`] = key;
                ExpressionAttributeValues[`:value${index}`] = updateData[key];
            }
        });

        const params = {
            TableName: this.tableName,
            Key: {
                ticketId: ticketId
            },
            UpdateExpression,
            ExpressionAttributeNames,
            ExpressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        };

        const result = await dynamoDB.update(params).promise();
        return result.Attributes;
    },

    // Get tickets by event
    async getByEvent(eventId) {
        const params = {
            TableName: this.tableName,
            IndexName: this.keys.indexes.eventIndex.name,
            KeyConditionExpression: 'eventId = :eventId',
            ExpressionAttributeValues: {
                ':eventId': eventId
            }
        };

        const result = await dynamoDB.query(params).promise();
        return result.Items;
    },

    // Get tickets by user
    async getByUser(userId) {
        const params = {
            TableName: this.tableName,
            IndexName: this.keys.indexes.userIndex.name,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        };

        const result = await dynamoDB.query(params).promise();
        return result.Items;
    },

    async getByStatus(status = 'all') {
        const params = {
            TableName: this.tableName
        };

        if (status && status !== 'all') {
            params.FilterExpression = '#status = :status';
            params.ExpressionAttributeNames = { '#status': 'status' };
            params.ExpressionAttributeValues = { ':status': status };
        }

        return scanAll(params);
    },

    async getAll() {
        return this.getByStatus('all');
    },

    // Check in ticket
    async checkIn(ticketId, faceVerified = false) {
        const timestamp = new Date().toISOString();
        const params = {
            TableName: this.tableName,
            Key: {
                ticketId: ticketId
            },
            UpdateExpression: 'SET #status = :status, checkInTime = :checkInTime, faceVerified = :faceVerified, updatedAt = :updatedAt',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':status': 'checked-in',
                ':checkInTime': timestamp,
                ':faceVerified': faceVerified,
                ':updatedAt': timestamp
            },
            ReturnValues: 'ALL_NEW'
        };

        const result = await dynamoDB.update(params).promise();
        return result.Attributes;
    }
};

module.exports = TicketModel;
