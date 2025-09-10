const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const dynamoDBRaw = new AWS.DynamoDB();

const EventModel = {
    tableName: 'Events',

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
                        { AttributeName: 'eventId', KeyType: 'HASH' }
                    ],
                    AttributeDefinitions: [
                        { AttributeName: 'eventId', AttributeType: 'S' },
                        { AttributeName: 'organizerId', AttributeType: 'S' },
                        { AttributeName: 'status', AttributeType: 'S' },
                        { AttributeName: 'date', AttributeType: 'S' }
                    ],
                    GlobalSecondaryIndexes: [
                        {
                            IndexName: 'OrganizerIndex',
                            KeySchema: [
                                { AttributeName: 'organizerId', KeyType: 'HASH' }
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
                                { AttributeName: 'date', KeyType: 'RANGE' }
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
        primary: 'eventId',
        indexes: {
            organizerIndex: {
                name: 'OrganizerIndex',
                key: 'organizerId'
            },
            statusDateIndex: {
                name: 'StatusDateIndex',
                key: 'status',
                sortKey: 'date'
            }
        }
    },
       
    // Create a new event
    async create(eventData) {
        console.log('Creating event with data:', JSON.stringify(eventData, null, 2));
        
        const timestamp = new Date().toISOString();
        // Always generate a new eventId to avoid conflicts
        const eventId = `evt_${Date.now().toString(36)}${Math.random().toString(36).substring(2, 5)}`;
        
        // Make sure we have required fields
        if (!eventData.name || !eventData.organizerId || !eventData.date) {
            throw new Error('Missing required fields for event creation: name, organizerId, and date are required');
        }

        // Create a clean item object with all required fields
        const item = {
            eventId: eventId,
            name: eventData.name,
            description: eventData.description || '',
            date: eventData.date,
            startTime: eventData.startTime || '',
            endTime: eventData.endTime || '',
            location: eventData.location || '',
            organizerId: eventData.organizerId,
            totalTickets: parseInt(eventData.totalTickets || 0, 10),
            ticketsSold: 0,
            ticketPrice: parseFloat(eventData.ticketPrice || 0),
            status: eventData.status || 'upcoming',
            coverImage: eventData.coverImage || '',
            createdAt: timestamp,
            updatedAt: timestamp
        };
        
        const params = {
            TableName: this.tableName,
            Item: item
        };
        
        console.log('DynamoDB put params:', JSON.stringify(params, null, 2));
        
        try {
            await dynamoDB.put(params).promise();
            console.log('Event created successfully with ID:', eventId);
            return params.Item;
        } catch (error) {
            console.error('Error creating event:', error);
            throw error;
        }

        await dynamoDB.put(params).promise();
        return params.Item;
    },

    // Get event by ID
    async get(eventId) {
        const params = {
            TableName: this.tableName,
            Key: {
                eventId: eventId
            }
        };

        const result = await dynamoDB.get(params).promise();
        return result.Item;
    },

    // Update event
    async update(eventId, updateData) {
        const timestamp = new Date().toISOString();
        let UpdateExpression = 'SET updatedAt = :updatedAt';
        const ExpressionAttributeValues = {
            ':updatedAt': timestamp
        };
        const ExpressionAttributeNames = {};

        Object.keys(updateData).forEach((key, index) => {
            if (key !== 'eventId') {
                UpdateExpression += `, #key${index} = :value${index}`;
                ExpressionAttributeNames[`#key${index}`] = key;
                ExpressionAttributeValues[`:value${index}`] = updateData[key];
            }
        });

        const params = {
            TableName: this.tableName,
            Key: {
                eventId: eventId
            },
            UpdateExpression,
            ExpressionAttributeNames,
            ExpressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        };

        const result = await dynamoDB.update(params).promise();
        return result.Attributes;
    },

    // Delete event
    async delete(eventId) {
        const params = {
            TableName: this.tableName,
            Key: {
                eventId: eventId
            }
        };

        await dynamoDB.delete(params).promise();
    },

    // Query events by status and date range
    async queryByStatusAndDate(status, startDate, endDate) {
    console.log(`Querying events with status: ${status}, from ${startDate} to ${endDate}`);
    try {
        // If status is 'all', we need to scan instead of query
        if (status === 'all') {
            return await this.getAllEvents(startDate, endDate);
        }
        
        const params = {
            TableName: this.tableName,
            IndexName: this.keys.indexes.statusDateIndex.name,
            KeyConditionExpression: '#status = :status AND #date BETWEEN :startDate AND :endDate',
            ExpressionAttributeNames: {
                '#status': 'status',
                '#date': 'date'
            },
            ExpressionAttributeValues: {
                ':status': status,
                ':startDate': startDate,
                ':endDate': endDate
            }
        };

        console.log('Using query with params:', JSON.stringify(params, null, 2));
        const result = await dynamoDB.query(params).promise();
        console.log(`Query returned ${result.Items ? result.Items.length : 0} events`);
        return result.Items;
    } catch (error) {
        console.error('Error in queryByStatusAndDate:', error);
        if (error.code === 'ValidationException' && error.message.includes('index')) {
            console.warn('StatusDateIndex not available, falling back to scan');
            // Fallback to scan if index doesn't exist
            return await this.scanByStatusAndDate(status, startDate, endDate);
        }
        throw error;
    }
    },

    // Get all events regardless of status
    async getAllEvents(startDate, endDate) {
        console.log('Getting all events using scan');
        const params = {
            TableName: this.tableName
        };
        
        // Add date filter only if dates are provided
        if (startDate !== '1970-01-01' || endDate !== '9999-12-31') {
            params.FilterExpression = '#date BETWEEN :startDate AND :endDate';
            params.ExpressionAttributeNames = {
                '#date': 'date'
            };
            params.ExpressionAttributeValues = {
                ':startDate': startDate,
                ':endDate': endDate
            };
        }
        
        console.log('Using scan with params:', JSON.stringify(params, null, 2));
        const result = await dynamoDB.scan(params).promise();
        console.log(`Scan returned ${result.Items ? result.Items.length : 0} events`);
        return result.Items;
    },

    // Add fallback scan method
    async scanByStatusAndDate(status, startDate, endDate) {
        console.log('Scanning for events with status filter');
        const params = {
            TableName: this.tableName
        };
        
        // Only add filter if status is not 'all'
        if (status !== 'all') {
            params.FilterExpression = '#status = :status AND #date BETWEEN :startDate AND :endDate';
            params.ExpressionAttributeNames = {
                '#status': 'status',
                '#date': 'date'
            };
            params.ExpressionAttributeValues = {
                ':status': status,
                ':startDate': startDate,
                ':endDate': endDate
            };
        } else {
            params.FilterExpression = '#date BETWEEN :startDate AND :endDate';
            params.ExpressionAttributeNames = {
                '#date': 'date'
            };
            params.ExpressionAttributeValues = {
                ':startDate': startDate,
                ':endDate': endDate
            };
        }

    const result = await dynamoDB.scan(params).promise();
    return result.Items;
    },

    // Query events by organizer
    async queryByOrganizer(organizerId) {
        const params = {
            TableName: this.tableName,
            IndexName: this.keys.indexes.organizerIndex.name,
            KeyConditionExpression: 'organizerId = :organizerId',
            ExpressionAttributeValues: {
                ':organizerId': organizerId
            }
        };

        const result = await dynamoDB.query(params).promise();
        return result.Items;
    },

    // Calculate revenue (helper method)
    calculateRevenue(event) {
        return event.ticketsSold * event.ticketPrice;
    }
};

module.exports = EventModel;