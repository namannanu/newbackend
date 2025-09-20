const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const dynamoDBRaw = new AWS.DynamoDB();

const TABLE_NAME = 'EventUserRegistrations';

const buildTimestamp = () => new Date().toISOString();

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

const queryAll = async (params) => {
    const items = [];
    let ExclusiveStartKey;

    do {
        const response = await dynamoDB.query({
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

const buildUpdateExpression = (updateData = {}) => {
    const ExpressionAttributeNames = {};
    const ExpressionAttributeValues = {};
    const sets = [];
    const adds = [];
    let index = 0;

    const data = { ...updateData };
    const inc = data.$inc;
    delete data.$inc;

    Object.entries(data).forEach(([key, value]) => {
        if (value === undefined) {
            return;
        }

        const attrName = `#attr${index}`;
        const attrValue = `:val${index}`;
        ExpressionAttributeNames[attrName] = key;
        ExpressionAttributeValues[attrValue] = value;
        sets.push(`${attrName} = ${attrValue}`);
        index++;
    });

    if (inc && typeof inc === 'object') {
        Object.entries(inc).forEach(([key, value]) => {
            const attrName = `#inc${index}`;
            const attrValue = `:inc${index}`;
            ExpressionAttributeNames[attrName] = key;
            ExpressionAttributeValues[attrValue] = value;
            adds.push(`${attrName} ${attrValue}`);
            index++;
        });
    }

    const timestamp = buildTimestamp();
    ExpressionAttributeNames['#updatedAt'] = 'updatedAt';
    ExpressionAttributeValues[':updatedAt'] = timestamp;
    sets.push('#updatedAt = :updatedAt');

    const parts = [];

    if (sets.length) {
        parts.push(`SET ${sets.join(', ')}`);
    }

    if (adds.length) {
        parts.push(`ADD ${adds.join(', ')}`);
    }

    return {
        UpdateExpression: parts.join(' '),
        ExpressionAttributeNames,
        ExpressionAttributeValues
    };
};

const sanitizeItem = (item) => {
    const sanitized = { ...item };
    Object.keys(sanitized).forEach((key) => {
        if (sanitized[key] === undefined) {
            delete sanitized[key];
        }
    });
    return sanitized;
};

const UserEventRegistrationModel = {
    tableName: TABLE_NAME,

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

    // Initialize table if it doesn't exist
    async initTable() {
        try {
            await dynamoDBRaw.describeTable({ TableName: this.tableName }).promise();
        } catch (error) {
            if (error.code !== 'ResourceNotFoundException') {
                throw error;
            }

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
                        IndexName: this.keys.indexes.eventUserIndex.name,
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
                        IndexName: this.keys.indexes.userRegistrationsIndex.name,
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
                        IndexName: this.keys.indexes.statusIndex.name,
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
            await dynamoDBRaw.waitFor('tableExists', { TableName: this.tableName }).promise();
        }
    },

    // Create a new registration
    async create(registrationData) {
        const timestamp = buildTimestamp();
        const registrationId = registrationData.registrationId || `reg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

        const requestedQuantity = typeof registrationData.requestedQuantity === 'number'
            ? registrationData.requestedQuantity
            : (registrationData.quantity || 1);
        const unitPrice = typeof registrationData.unitPrice === 'number'
            ? registrationData.unitPrice
            : (registrationData.price !== undefined ? registrationData.price : undefined);
        const totalPrice = typeof registrationData.totalPrice === 'number'
            ? registrationData.totalPrice
            : (unitPrice !== undefined ? unitPrice * requestedQuantity : undefined);

        const item = sanitizeItem({
            registrationId,
            eventId: registrationData.eventId,
            userId: registrationData.userId,
            registrationDate: registrationData.registrationDate ? new Date(registrationData.registrationDate).toISOString() : timestamp,
            status: registrationData.status || 'pending',
            checkInTime: registrationData.checkInTime || null,
            waitingStatus: registrationData.waitingStatus || 'queued',
            faceVerificationStatus: registrationData.faceVerificationStatus || 'pending',
            ticketAvailabilityStatus: registrationData.ticketAvailabilityStatus || 'pending',
            verificationAttempts: typeof registrationData.verificationAttempts === 'number' ? registrationData.verificationAttempts : 0,
            lastVerificationAttempt: registrationData.lastVerificationAttempt || null,
            ticketIssued: Boolean(registrationData.ticketIssued),
            ticketIssuedDate: registrationData.ticketIssuedDate || null,
            adminBooked: Boolean(registrationData.adminBooked),
            adminOverrideReason: registrationData.adminOverrideReason || null,
            ticketId: registrationData.ticketId || null,
            requestedQuantity,
            unitPrice,
            totalPrice,
            notes: registrationData.notes || null,
            ticketRequestSource: registrationData.ticketRequestSource || null,
            createdAt: timestamp,
            updatedAt: timestamp
        });

        const params = {
            TableName: this.tableName,
            Item: item
        };

        await dynamoDB.put(params).promise();
        return item;
    },

    async get(registrationId) {
        const params = {
            TableName: this.tableName,
            Key: {
                registrationId
            }
        };

        const result = await dynamoDB.get(params).promise();
        return result.Item || null;
    },

    async findById(registrationId) {
        return this.get(registrationId);
    },

    async findByIdAndUpdate(registrationId, updateData = {}) {
        const { UpdateExpression, ExpressionAttributeNames, ExpressionAttributeValues } = buildUpdateExpression(updateData);

        const params = {
            TableName: this.tableName,
            Key: {
                registrationId
            },
            UpdateExpression,
            ExpressionAttributeNames,
            ExpressionAttributeValues,
            ConditionExpression: 'attribute_exists(registrationId)',
            ReturnValues: 'ALL_NEW'
        };

        try {
            const result = await dynamoDB.update(params).promise();
            return result.Attributes || null;
        } catch (error) {
            if (error.code === 'ConditionalCheckFailedException') {
                return null;
            }
            throw error;
        }
    },

    async findByIdAndDelete(registrationId) {
        const params = {
            TableName: this.tableName,
            Key: {
                registrationId
            },
            ReturnValues: 'ALL_OLD'
        };

        const result = await dynamoDB.delete(params).promise();
        return result.Attributes || null;
    },

    async find(filter = {}) {
        if (filter.registrationId) {
            const item = await this.get(filter.registrationId);
            return item ? [item] : [];
        }

        if (filter.status) {
            const params = {
                TableName: this.tableName,
                IndexName: this.keys.indexes.statusIndex.name,
                KeyConditionExpression: '#status = :status',
                ExpressionAttributeNames: {
                    '#status': 'status'
                },
                ExpressionAttributeValues: {
                    ':status': filter.status
                }
            };

            const items = await queryAll(params);
            return items.sort((a, b) => new Date(b.registrationDate || 0) - new Date(a.registrationDate || 0));
        }

        if (filter.eventId && filter.userId) {
            const params = {
                TableName: this.tableName,
                IndexName: this.keys.indexes.eventUserIndex.name,
                KeyConditionExpression: 'eventId = :eventId AND userId = :userId',
                ExpressionAttributeValues: {
                    ':eventId': filter.eventId,
                    ':userId': filter.userId
                }
            };

            const items = await queryAll(params);
            return items;
        }

        // Fallback to scanning when no index-based filter applies
        const scanParams = {
            TableName: this.tableName
        };

        if (Object.keys(filter).length) {
            const filterExpressions = [];
            scanParams.ExpressionAttributeNames = {};
            scanParams.ExpressionAttributeValues = {};

            Object.entries(filter).forEach(([key, value], idx) => {
                const nameKey = `#filter${idx}`;
                const valueKey = `:filter${idx}`;
                filterExpressions.push(`${nameKey} = ${valueKey}`);
                scanParams.ExpressionAttributeNames[nameKey] = key;
                scanParams.ExpressionAttributeValues[valueKey] = value;
            });

            scanParams.FilterExpression = filterExpressions.join(' AND ');
        }

        return scanAll(scanParams);
    },

    async findOne(filter = {}) {
        const results = await this.find(filter);
        return results.length ? results[0] : null;
    },

    async countDocuments(filter = {}) {
        const items = await this.find(filter);
        return items.length;
    },

    async recordTicketRequest({
        userId,
        eventId,
        quantity = 1,
        unitPrice,
        totalPrice,
        notes,
        source
    }) {
        if (!userId || !eventId) {
            throw new Error('userId and eventId are required to record a ticket request');
        }

        const normalizedQuantity = Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
        const normalizedUnitPrice = unitPrice !== undefined ? Number(unitPrice) : undefined;
        const normalizedTotalPrice = totalPrice !== undefined
            ? Number(totalPrice)
            : (normalizedUnitPrice !== undefined ? normalizedUnitPrice * normalizedQuantity : undefined);

        const existingRegistrations = await this.find({ eventId, userId });
        const existing = existingRegistrations.find(
            (registration) => registration && !registration.ticketIssued && registration.status === 'pending'
        );

        const updatePayload = {
            requestedQuantity: normalizedQuantity,
            unitPrice: normalizedUnitPrice,
            totalPrice: normalizedTotalPrice,
            notes: notes || null,
            ticketRequestSource: source || 'ticket_purchase',
            status: 'pending',
            waitingStatus: 'queued',
            faceVerificationStatus: 'pending',
            ticketAvailabilityStatus: 'pending'
        };

        if (existing) {
            return this.findByIdAndUpdate(existing.registrationId, updatePayload);
        }

        return this.create({
            userId,
            eventId,
            requestedQuantity: normalizedQuantity,
            unitPrice: normalizedUnitPrice,
            totalPrice: normalizedTotalPrice,
            notes: notes || null,
            ticketRequestSource: source || 'ticket_purchase',
            status: 'pending',
            waitingStatus: 'queued',
            faceVerificationStatus: 'pending',
            ticketAvailabilityStatus: 'pending'
        });
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

        const items = await queryAll(params);
        return items.sort((a, b) => new Date(b.registrationDate || 0) - new Date(a.registrationDate || 0));
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

        const items = await queryAll(params);
        return items.sort((a, b) => new Date(b.registrationDate || 0) - new Date(a.registrationDate || 0));
    },

    // Update registration status
    async updateStatus(registrationId, status, faceVerificationStatus = null) {
        const updateData = {
            status,
            lastVerificationAttempt: buildTimestamp()
        };

        if (faceVerificationStatus) {
            updateData.faceVerificationStatus = faceVerificationStatus;
        }

        updateData.$inc = { verificationAttempts: 1 };

        return this.findByIdAndUpdate(registrationId, updateData);
    },

    // Issue ticket
    async issueTicket(registrationId) {
        return this.findByIdAndUpdate(registrationId, {
            ticketIssued: true,
            ticketIssuedDate: buildTimestamp(),
            ticketAvailabilityStatus: 'available'
        });
    },

    // Check-in registration
    async checkIn(registrationId) {
        return this.findByIdAndUpdate(registrationId, {
            checkInTime: buildTimestamp()
        });
    },

    // Scan the entire table - similar to MongoDB find()
    async scan() {
        return scanAll({ TableName: this.tableName });
    }
};

module.exports = UserEventRegistrationModel;
