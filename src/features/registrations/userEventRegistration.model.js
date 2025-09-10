const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const dynamoDBRaw = new AWS.DynamoDB();

const UserEventRegistrationModel = {
    tableName: 'EventUserRegistrations',

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
                        { AttributeName: 'registrationId', KeyType: 'HASH' }
                    ],
                    AttributeDefinitions: [
                        { AttributeName: 'registrationId', AttributeType: 'S' },
                        { AttributeName: 'eventId', AttributeType: 'S' },
                        { AttributeName: 'userId', AttributeType: 'S' },
                        { AttributeName: 'status', AttributeType: 'S' },
                        { AttributeName: 'registrationDate', AttributeType: 'S' }
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
                            IndexName: 'UserRegistrationsIndex',
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
                            IndexName: 'StatusIndex',
                            KeySchema: [
                                { AttributeName: 'status', KeyType: 'HASH' },
                                { AttributeName: 'registrationDate', KeyType: 'RANGE' }
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
        primary: 'registrationId',
        indexes: {
            eventUserIndex: {
                name: 'EventUserIndex',
                key: 'eventId',
                sortKey: 'userId'
            },
            userRegistrationsIndex: {
                name: 'UserRegistrationsIndex',
                key: 'userId'
            },
            statusIndex: {
                name: 'StatusIndex',
                key: 'status',
                sortKey: 'registrationDate'
            }
        }
    },

    // Create a new registration
    async create(registrationData) {
        const timestamp = new Date().toISOString();
        const registrationId = `reg_${Date.now()}`;

        const params = {
            TableName: this.tableName,
            Item: {
            registrationId: registrationId,
            eventId: registrationData.eventId,
            userId: registrationData.userId,
            registrationDate: timestamp,
            status: registrationData.status || 'pending',
            checkInTime: null,
            waitingStatus: registrationData.waitingStatus || 'queued',
            faceVerificationStatus: 'pending',
            ticketAvailabilityStatus: 'pending',
            verificationAttempts: 0,
            lastVerificationAttempt: null,
            ticketIssued: false,
            ticketIssuedDate: null,
            adminBooked: false,
            adminOverrideReason: null,
            updatedAt: timestamp
        }
    };

    try {
        await dynamoDB.put(params).promise();
        return params.Item;
    } catch (error) {
        console.error('Error creating registration:', error);
        throw error;
    }
},

    // Get registrations by event
    async getByEvent(eventId) {
        const params = {
            TableName: this.tableName,
            IndexName: this.keys.indexes.eventUserIndex.name,
            KeyConditionExpression: 'eventId = :eventId',
            ExpressionAttributeValues: {
                ':eventId': eventId
            }
        };

        const result = await dynamoDB.query(params).promise();
        return result.Items;
    },

    // Get registrations by user
    async getByUser(userId) {
        const params = {
            TableName: this.tableName,
            IndexName: this.keys.indexes.userRegistrationsIndex.name,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId
            }
        };

        const result = await dynamoDB.query(params).promise();
        return result.Items;
    },

    // Update registration status
    async updateStatus(registrationId, status, faceVerificationStatus = null) {
        const timestamp = new Date().toISOString();
        const params = {
            TableName: this.tableName,
            Key: {
                registrationId: registrationId
            },
            UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, verificationAttempts = verificationAttempts + :increment, lastVerificationAttempt = :lastAttempt',
            ExpressionAttributeNames: {
                '#status': 'status'
            },
            ExpressionAttributeValues: {
                ':status': status,
                ':updatedAt': timestamp,
                ':increment': 1,
                ':lastAttempt': timestamp
            },
            ReturnValues: 'ALL_NEW'
        };

        if (faceVerificationStatus) {
            params.UpdateExpression += ', faceVerificationStatus = :faceStatus';
            params.ExpressionAttributeValues[':faceStatus'] = faceVerificationStatus;
        }

        const result = await dynamoDB.update(params).promise();
        return result.Attributes;
    },

    // Issue ticket
    async issueTicket(registrationId) {
        const timestamp = new Date().toISOString();
        const params = {
            TableName: this.tableName,
            Key: {
                registrationId: registrationId
            },
            UpdateExpression: 'SET ticketIssued = :issued, ticketIssuedDate = :issuedDate, updatedAt = :updatedAt, ticketAvailabilityStatus = :availStatus',
            ExpressionAttributeValues: {
                ':issued': true,
                ':issuedDate': timestamp,
                ':updatedAt': timestamp,
                ':availStatus': 'available'
            },
            ReturnValues: 'ALL_NEW'
        };

        const result = await dynamoDB.update(params).promise();
        return result.Attributes;
    },

    // Check-in registration
    async checkIn(registrationId) {
        const timestamp = new Date().toISOString();
        const params = {
            TableName: this.tableName,
            Key: {
                registrationId: registrationId
            },
            UpdateExpression: 'SET checkInTime = :checkInTime, updatedAt = :updatedAt',
            ExpressionAttributeValues: {
                ':checkInTime': timestamp,
                ':updatedAt': timestamp
            },
            ReturnValues: 'ALL_NEW'
        };

        const result = await dynamoDB.update(params).promise();
        return result.Attributes;
    },

    // Scan the entire table - similar to MongoDB find()
    async scan() {
        const params = {
            TableName: this.tableName
        };

        try {
            const result = await dynamoDB.scan(params).promise();
            return result.Items;
        } catch (error) {
            console.error('Error scanning registrations:', error);
            throw error;
        }
    }
};

module.exports = UserEventRegistrationModel;
