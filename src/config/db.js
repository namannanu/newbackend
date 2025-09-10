const AWS = require('aws-sdk');
const colors = require('colors');
const { performance } = require('perf_hooks');
const crypto = require('crypto');

// Initialize DynamoDB clients and cache
let dynamoDB;
let documentClient;
let cache = new Map();
let metricsCollector = new Map();

const verifyAWSCredentials = require('../utils/verify-aws');

const initializeDynamoDB = async () => {
    console.log('🔄 Initializing DynamoDB connection...'.yellow);

    try {
        // Verify AWS credentials first
        const verificationResult = await verifyAWSCredentials();
        
        // If we get here, credentials are verified
        const credentials = {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        };

        // Add session token if available (important for Lambda/Vercel environment)
        if (process.env.AWS_SESSION_TOKEN) {
            credentials.sessionToken = process.env.AWS_SESSION_TOKEN;
        }

        const awsConfig = {
            region: process.env.AWS_REGION || 'ap-south-1',
            credentials: new AWS.Credentials(credentials),
            maxRetries: 3,
            httpOptions: { timeout: 5000 } // 5 second timeout
        };

        // Check if we should use local DynamoDB mode (for development without AWS credentials)
        const useLocalMode = process.env.USE_LOCAL_DB === 'true';
        
        if (useLocalMode) {
            console.log('🔧 Using LOCAL DynamoDB mode for development'.yellow);
            
            // Setup local DynamoDB with in-memory implementation
            const localConfig = {
                region: 'local-region',
                endpoint: 'http://localhost:8000', // Standard DynamoDB local port
                accessKeyId: 'local',
                secretAccessKey: 'local'
            };
            
            AWS.config.update(localConfig);
            
            // Create in-memory mock clients
            dynamoDB = new AWS.DynamoDB({
                apiVersion: '2012-08-10',
                endpoint: localConfig.endpoint
            });
            
            documentClient = new AWS.DynamoDB.DocumentClient({
                convertEmptyValues: true,
                wrapNumbers: true,
                service: dynamoDB
            });
            
            console.log('✅ Local DynamoDB mode initialized'.green);
            return { dynamoDB, documentClient };
        }
        
        // For production use with real AWS credentials
        const region = process.env.AWS_REGION || 'ap-south-1';
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

        if (!accessKeyId || !secretAccessKey) {
            throw new Error('AWS credentials are required. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in environment variables.');
        }

        console.log('🔄 Configuring AWS SDK with provided credentials...'.yellow);
        console.log(`Region: ${region}`);
        console.log(`Access Key ID: ${accessKeyId.substring(0, 5)}...`);

        // Configure AWS SDK with explicit credentials for Vercel environment
        const config = {
            region: process.env.AWS_REGION || 'ap-south-1',
            credentials: new AWS.Credentials({
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }),
            maxRetries: 3,
            httpOptions: {
                timeout: 5000,
                connectTimeout: 3000
            }
        };

        // Log configuration (without sensitive data)
        console.log('AWS Configuration:', {
            region: config.region,
            accessKeyId: `${config.accessKeyId.substr(0, 4)}...${config.accessKeyId.substr(-4)}`,
            maxRetries: config.maxRetries,
            httpOptions: config.httpOptions
        });

        // Update AWS SDK configuration
        AWS.config.update(config);

        // Initialize DynamoDB clients with custom configuration
        dynamoDB = new AWS.DynamoDB({
            apiVersion: '2012-08-10',
            maxRetries: 3,
            retryDelayOptions: {
                base: 300 // Base delay for exponential backoff
            }
        });

        documentClient = new AWS.DynamoDB.DocumentClient({
            convertEmptyValues: true,
            wrapNumbers: true
        });

        // Test the connection
        await testConnection();

        try {
            // Setup CloudWatch monitoring
            await setupCloudWatchAlarms();
        } catch (err) {
            console.warn('⚠️ CloudWatch setup failed, but continuing: ' + err.message);
        }

        try {
            // Setup auto-scaling
            await setupAutoScaling();
        } catch (err) {
            console.warn('⚠️ Auto-scaling setup failed, but continuing: ' + err.message);
        }

        try {
            // Setup backup
            await setupBackups();
        } catch (err) {
            console.warn('⚠️ Backup setup failed, but continuing: ' + err.message);
        }

        console.log('✅ DynamoDB connection initialized successfully'.cyan.bold);
        return { dynamoDB, documentClient };

    } catch (error) {
        console.error('❌ DynamoDB connection failed:', error.message.red);
        console.error('📋 Full error:', error);
        
        // Fallback to local mode if AWS connection fails
        console.log('🔄 Falling back to local DynamoDB mode...'.yellow);
        
        // Create mock DynamoDB client and document client for local development
        dynamoDB = createMockDynamoDB();
        documentClient = createMockDocumentClient();
        
        return { dynamoDB, documentClient };
    }
};

// Helper function to create mock DynamoDB
function createMockDynamoDB() {
    console.log('🛠️ Creating mock DynamoDB client for local development'.yellow);
    
    const mockTables = {};
    
    return {
        listTables: () => {
            return {
                promise: async () => {
                    return { TableNames: Object.keys(mockTables) };
                }
            };
        },
        createTable: (params) => {
            return {
                promise: async () => {
                    mockTables[params.TableName] = {
                        items: [],
                        keySchema: params.KeySchema
                    };
                    return { TableDescription: { TableName: params.TableName } };
                }
            };
        },
        deleteTable: (params) => {
            return {
                promise: async () => {
                    delete mockTables[params.TableName];
                    return { TableDescription: { TableName: params.TableName } };
                }
            };
        },
        describeTable: (params) => {
            return {
                promise: async () => {
                    if (!mockTables[params.TableName]) {
                        throw new Error('Table not found');
                    }
                    return {
                        Table: {
                            TableName: params.TableName,
                            KeySchema: mockTables[params.TableName].keySchema
                        }
                    };
                }
            };
        }
    };
}

// Helper function to create mock DocumentClient
function createMockDocumentClient() {
    console.log('🛠️ Creating mock DynamoDB DocumentClient for local development'.yellow);
    
    // In-memory data store
    const mockData = {};
    
    return {
        get: (params) => {
            return {
                promise: async () => {
                    if (!mockData[params.TableName]) {
                        mockData[params.TableName] = [];
                    }
                    
                    const key = Object.keys(params.Key)[0];
                    const value = params.Key[key];
                    
                    const item = mockData[params.TableName].find(item => item[key] === value);
                    return { Item: item };
                }
            };
        },
        put: (params) => {
            return {
                promise: async () => {
                    if (!mockData[params.TableName]) {
                        mockData[params.TableName] = [];
                    }
                    
                    // Remove any existing item with same ID
                    const keyName = Object.keys(params.Item).find(k => k === 'id' || k === 'userId' || k === 'email');
                    if (keyName) {
                        const keyValue = params.Item[keyName];
                        const existingIndex = mockData[params.TableName].findIndex(item => item[keyName] === keyValue);
                        
                        if (existingIndex >= 0) {
                            mockData[params.TableName].splice(existingIndex, 1);
                        }
                    }
                    
                    mockData[params.TableName].push(params.Item);
                    return { Item: params.Item };
                }
            };
        },
        delete: (params) => {
            return {
                promise: async () => {
                    if (!mockData[params.TableName]) {
                        return {};
                    }
                    
                    const key = Object.keys(params.Key)[0];
                    const value = params.Key[key];
                    
                    const index = mockData[params.TableName].findIndex(item => item[key] === value);
                    if (index >= 0) {
                        mockData[params.TableName].splice(index, 1);
                    }
                    
                    return {};
                }
            };
        },
        scan: (params) => {
            return {
                promise: async () => {
                    if (!mockData[params.TableName]) {
                        mockData[params.TableName] = [];
                    }
                    return { Items: mockData[params.TableName] };
                }
            };
        },
        query: (params) => {
            return {
                promise: async () => {
                    if (!mockData[params.TableName]) {
                        mockData[params.TableName] = [];
                    }
                    
                    let filteredItems = [...mockData[params.TableName]];
                    
                    // Handle KeyConditionExpression
                    if (params.KeyConditionExpression) {
                        const expr = params.KeyConditionExpression;
                        const attrNames = params.ExpressionAttributeNames || {};
                        const attrValues = params.ExpressionAttributeValues || {};
                        
                        // Simple parsing for common patterns like "#pk = :pk"
                        if (expr.includes('=')) {
                            const [left, right] = expr.split('=').map(s => s.trim());
                            const keyName = attrNames[left] || left.replace('#', '');
                            const keyValue = attrValues[right] || right.replace(':', '');
                            
                            filteredItems = filteredItems.filter(item => item[keyName] === keyValue);
                        }
                    }
                    
                    return { Items: filteredItems };
                }
            };
        },
        update: (params) => {
            return {
                promise: async () => {
                    if (!mockData[params.TableName]) {
                        mockData[params.TableName] = [];
                    }
                    
                    const key = Object.keys(params.Key)[0];
                    const value = params.Key[key];
                    
                    const index = mockData[params.TableName].findIndex(item => item[key] === value);
                    
                    if (index < 0) {
                        return {};
                    }
                    
                    // Simple handling of UpdateExpression (very basic)
                    if (params.UpdateExpression && params.ExpressionAttributeValues) {
                        const expr = params.UpdateExpression;
                        
                        if (expr.startsWith('set ')) {
                            const setExpr = expr.substring(4);
                            const updates = setExpr.split(',').map(s => s.trim());
                            
                            updates.forEach(update => {
                                const [field, value] = update.split('=').map(s => s.trim());
                                const fieldName = field.replace('#', '');
                                const valueRef = value.replace(':', '');
                                
                                mockData[params.TableName][index][fieldName] = params.ExpressionAttributeValues[valueRef];
                            });
                        }
                    }
                    
                    return { Attributes: mockData[params.TableName][index] };
                }
            };
        }
    };
}

// Test DynamoDB connection
const testConnection = async () => {
    try {
        console.log('🔄 Testing DynamoDB connection...'.yellow);
        
        // First, check if credentials are properly set
        const sts = new AWS.STS();
        const identity = await sts.getCallerIdentity().promise();
        console.log(`✅ AWS Identity confirmed: ${identity.Arn}`.green);
        
        // Then try to list tables
        const tables = await dynamoDB.listTables().promise();
        console.log('✅ DynamoDB connection test successful'.green);
        console.log(`📋 Found ${tables.TableNames.length} tables: ${tables.TableNames.join(', ')}`.cyan);
        return true;
    } catch (error) {
        console.error('❌ DynamoDB connection test failed:'.red);
        console.error(`Error type: ${error.code}`.red);
        console.error(`Error message: ${error.message}`.red);
        
        if (error.code === 'CredentialsError' || error.code === 'InvalidClientTokenId') {
            console.error(`
⚠️  Common fixes for credential issues:
1. Make sure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in Vercel environment variables
2. Ensure the IAM user has appropriate DynamoDB permissions
3. Check if the credentials are active and not expired
4. Verify the credentials are properly formatted (no extra spaces)`.yellow);
        }
        
        throw new Error(`DynamoDB connection test failed: ${error.message}`);
    }
};

// Setup CloudWatch Alarms
const setupCloudWatchAlarms = async () => {
    const cloudWatch = new AWS.CloudWatch();
    
    const alarms = [
        {
            AlarmName: 'DynamoDB-ConsumedReadCapacityUnits-Critical',
            MetricName: 'ConsumedReadCapacityUnits',
            Threshold: 80,
            Period: 300,
            EvaluationPeriods: 2
        },
        {
            AlarmName: 'DynamoDB-ConsumedWriteCapacityUnits-Critical',
            MetricName: 'ConsumedWriteCapacityUnits',
            Threshold: 80,
            Period: 300,
            EvaluationPeriods: 2
        }
    ];

    try {
        for (const alarm of alarms) {
            await cloudWatch.putMetricAlarm({
                ...alarm,
                Namespace: 'AWS/DynamoDB',
                StatisticType: 'Average',
                ComparisonOperator: 'GreaterThanThreshold',
                ActionsEnabled: true
            }).promise();
        }
        console.log('✅ CloudWatch alarms configured successfully'.green);
    } catch (error) {
        console.warn('⚠️  Failed to setup CloudWatch alarms:', error.message.yellow);
    }
};

// Setup Auto Scaling
const setupAutoScaling = async () => {
    const applicationAutoScaling = new AWS.ApplicationAutoScaling();
    
    try {
        const tables = await dynamoDB.listTables().promise();
        
        for (const tableName of tables.TableNames) {
            await applicationAutoScaling.registerScalableTarget({
                ServiceNamespace: 'dynamodb',
                ResourceId: `table/${tableName}`,
                ScalableDimension: 'dynamodb:table:ReadCapacityUnits',
                MinCapacity: 5,
                MaxCapacity: 100
            }).promise();

            await applicationAutoScaling.putScalingPolicy({
                ServiceNamespace: 'dynamodb',
                ResourceId: `table/${tableName}`,
                ScalableDimension: 'dynamodb:table:ReadCapacityUnits',
                PolicyName: `${tableName}-AutoScaling-Read`,
                PolicyType: 'TargetTrackingScaling',
                TargetTrackingScalingPolicyConfiguration: {
                    TargetValue: 70.0,
                    PredefinedMetricSpecification: {
                        PredefinedMetricType: 'DynamoDBReadCapacityUtilization'
                    }
                }
            }).promise();
        }
        console.log('✅ Auto Scaling configured successfully'.green);
    } catch (error) {
        console.warn('⚠️  Failed to setup Auto Scaling:', error.message.yellow);
    }
};

// Setup Backup
const setupBackups = async () => {
    try {
        const tables = await dynamoDB.listTables().promise();
        
        for (const tableName of tables.TableNames) {
            await dynamoDB.updateContinuousBackups({
                TableName: tableName,
                PointInTimeRecoverySpecification: {
                    PointInTimeRecoveryEnabled: true
                }
            }).promise();
        }
        console.log('✅ Continuous backups enabled for all tables'.green);
    } catch (error) {
        console.warn('⚠️  Failed to setup continuous backups:', error.message.yellow);
    }
};

// Error Handler
const handleConnectionError = (error) => {
    console.error(`❌ DynamoDB connection error: ${error.message}`.red.bold);
    console.error('🔍 Full error details:', error);

    if (error.code === 'CredentialsError') {
        console.error('🔐 Authentication error: Check AWS credentials'.red);
    } else if (error.code === 'NetworkingError') {
        console.error('🌐 Network error: Cannot reach DynamoDB'.red);
    } else if (error.code === 'ResourceNotFoundException') {
        console.error('📛 Resource not found: Check table names and region'.red);
    }

    if (process.env.NODE_ENV === 'production') {
        console.warn('⚠️  Continuing with limited functionality in production'.yellow);
        return null;
    } else {
        throw error;
    }
};

// Cache management
const cacheManager = {
    TTL: 300000, // 5 minutes default TTL
    async get(key) {
        const cached = cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.TTL) {
            return cached.value;
        }
        return null;
    },
    set(key, value) {
        cache.set(key, { value, timestamp: Date.now() });
    },
    invalidate(key) {
        cache.delete(key);
    },
    clear() {
        cache.clear();
    }
};

// Metrics collection
const metrics = {
    startOperation(operation, tableName) {
        const key = `${operation}_${tableName}`;
        return {
            start: performance.now(),
            key
        };
    },
    endOperation(context) {
        const duration = performance.now() - context.start;
        const current = metricsCollector.get(context.key) || {
            count: 0,
            totalDuration: 0,
            avgDuration: 0,
            maxDuration: 0
        };

        current.count++;
        current.totalDuration += duration;
        current.avgDuration = current.totalDuration / current.count;
        current.maxDuration = Math.max(current.maxDuration, duration);

        metricsCollector.set(context.key, current);
    },
    getMetrics() {
        return Object.fromEntries(metricsCollector);
    },
    resetMetrics() {
        metricsCollector.clear();
    }
};

// Transaction support
const createTransaction = items => {
    return {
        TransactItems: items.map(({ operation, tableName, item, key, condition }) => {
            switch (operation) {
                case 'put':
                    return {
                        Put: {
                            TableName: tableName,
                            Item: item,
                            ...(condition && { ConditionExpression: condition })
                        }
                    };
                case 'delete':
                    return {
                        Delete: {
                            TableName: tableName,
                            Key: key,
                            ...(condition && { ConditionExpression: condition })
                        }
                    };
                case 'update':
                    return {
                        Update: {
                            TableName: tableName,
                            Key: key,
                            UpdateExpression: item.UpdateExpression,
                            ExpressionAttributeValues: item.ExpressionAttributeValues,
                            ...(condition && { ConditionExpression: condition })
                        }
                    };
            }
        })
    };
};

// Utility functions for common DynamoDB operations
const dbOperations = {
    async get(tableName, key, options = {}) {
        const metricsContext = metrics.startOperation('get', tableName);
        try {
            // Check cache if enabled
            if (options.useCache) {
                const cacheKey = `${tableName}:${JSON.stringify(key)}`;
                const cached = await cacheManager.get(cacheKey);
                if (cached) return cached;
            }

            const result = await documentClient.get({
                TableName: tableName,
                Key: key,
                ...(options.consistentRead && { ConsistentRead: true })
            }).promise();

            // Store in cache if enabled
            if (options.useCache && result.Item) {
                const cacheKey = `${tableName}:${JSON.stringify(key)}`;
                cacheManager.set(cacheKey, result.Item);
            }

            return result.Item;
        } catch (error) {
            console.error(`Error getting item from ${tableName}:`, error);
            throw error;
        } finally {
            metrics.endOperation(metricsContext);
        }
    },

    async put(tableName, item, options = {}) {
        const metricsContext = metrics.startOperation('put', tableName);
        try {
            const params = {
                TableName: tableName,
                Item: {
                    ...item,
                    updatedAt: new Date().toISOString()
                },
                ...(options.condition && { ConditionExpression: options.condition })
            };

            await documentClient.put(params).promise();

            // Invalidate cache if exists
            if (options.useCache) {
                const cacheKey = `${tableName}:${JSON.stringify(item)}`;
                cacheManager.invalidate(cacheKey);
            }

            return item;
        } catch (error) {
            if (error.code === 'ConditionalCheckFailedException') {
                throw new Error('Condition check failed for put operation');
            }
            console.error(`Error putting item to ${tableName}:`, error);
            throw error;
        } finally {
            metrics.endOperation(metricsContext);
        }
    },

    async query(tableName, params, options = {}) {
        const metricsContext = metrics.startOperation('query', tableName);
        try {
            const queryParams = {
                TableName: tableName,
                ...params,
                ...(options.limit && { Limit: options.limit }),
                ...(options.scanIndexForward !== undefined && { 
                    ScanIndexForward: options.scanIndexForward 
                })
            };

            let items = [];
            let lastEvaluatedKey;

            do {
                if (lastEvaluatedKey) {
                    queryParams.ExclusiveStartKey = lastEvaluatedKey;
                }

                const result = await documentClient.query(queryParams).promise();
                items = items.concat(result.Items);
                lastEvaluatedKey = result.LastEvaluatedKey;

                // Break if we've reached the desired limit
                if (options.limit && items.length >= options.limit) {
                    items = items.slice(0, options.limit);
                    break;
                }
            } while (lastEvaluatedKey && (!options.maxPages || items.length < options.maxPages * queryParams.Limit));

            return {
                items,
                lastEvaluatedKey
            };
        } catch (error) {
            console.error(`Error querying ${tableName}:`, error);
            throw error;
        } finally {
            metrics.endOperation(metricsContext);
        }
    },

    async batchWrite(tableName, items, options = {}) {
        const metricsContext = metrics.startOperation('batchWrite', tableName);
        try {
            const batchSize = 25; // DynamoDB batch write limit
            const results = [];
            const retryItems = new Map();

            for (let i = 0; i < items.length; i += batchSize) {
                const batch = items.slice(i, i + batchSize);
                const batchRequests = {
                    RequestItems: {
                        [tableName]: batch.map(item => ({
                            PutRequest: { 
                                Item: {
                                    ...item,
                                    updatedAt: new Date().toISOString()
                                }
                            }
                        }))
                    }
                };

                let attempt = 0;
                const maxAttempts = options.maxRetries || 3;

                while (attempt < maxAttempts) {
                    try {
                        const result = await documentClient.batchWrite(batchRequests).promise();

                        // Handle unprocessed items
                        if (result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0) {
                            const unprocessed = result.UnprocessedItems[tableName];
                            retryItems.set(attempt, unprocessed);
                            batchRequests.RequestItems = result.UnprocessedItems;
                            attempt++;
                            
                            // Exponential backoff
                            await new Promise(resolve => 
                                setTimeout(resolve, Math.pow(2, attempt) * 100)
                            );
                        } else {
                            results.push(batch);
                            break;
                        }
                    } catch (error) {
                        if (attempt === maxAttempts - 1) throw error;
                        attempt++;
                        await new Promise(resolve => 
                            setTimeout(resolve, Math.pow(2, attempt) * 100)
                        );
                    }
                }
            }

            return {
                success: results,
                retryAttempts: retryItems
            };
        } catch (error) {
            console.error(`Error batch writing to ${tableName}:`, error);
            throw error;
        } finally {
            metrics.endOperation(metricsContext);
        }
    },

    async transactWrite(operations) {
        const metricsContext = metrics.startOperation('transactWrite', 'multiple');
        try {
            const params = createTransaction(operations);
            await documentClient.transactWrite(params).promise();
        } catch (error) {
            console.error('Error in transaction:', error);
            throw error;
        } finally {
            metrics.endOperation(metricsContext);
        }
    },

    async update(tableName, key, updates, options = {}) {
        const metricsContext = metrics.startOperation('update', tableName);
        try {
            const { updateExpression, attributeValues } = this.buildUpdateExpression(updates);
            
            const params = {
                TableName: tableName,
                Key: key,
                UpdateExpression: updateExpression,
                ExpressionAttributeValues: attributeValues,
                ReturnValues: options.returnValues || 'ALL_NEW',
                ...(options.condition && { ConditionExpression: options.condition })
            };

            const result = await documentClient.update(params).promise();

            // Invalidate cache if exists
            if (options.useCache) {
                const cacheKey = `${tableName}:${JSON.stringify(key)}`;
                cacheManager.invalidate(cacheKey);
            }

            return result.Attributes;
        } catch (error) {
            console.error(`Error updating item in ${tableName}:`, error);
            throw error;
        } finally {
            metrics.endOperation(metricsContext);
        }
    },

    buildUpdateExpression(updates) {
        const expressions = [];
        const attributeValues = {};
        
        Object.entries(updates).forEach(([key, value]) => {
            const attributeKey = `:${key}`;
            expressions.push(`#${key} = ${attributeKey}`);
            attributeValues[attributeKey] = value;
        });

        return {
            updateExpression: `SET ${expressions.join(', ')}`,
            attributeValues
        };
    },

    // Utility methods
    getMetrics: metrics.getMetrics,
    resetMetrics: metrics.resetMetrics,
    clearCache: cacheManager.clear,
    
    // Stream processing
    async processStream(tableName, handler) {
        const stream = await dynamoDB.describeTable({
            TableName: tableName
        }).promise();
        
        if (!stream.Table.StreamSpecification?.StreamEnabled) {
            throw new Error(`Stream not enabled for table ${tableName}`);
        }

        const streamArn = stream.Table.LatestStreamArn;
        const dynamodbstreams = new AWS.DynamoDBStreams();
        
        try {
            const { Shards } = await dynamodbstreams.describeStream({
                StreamArn: streamArn
            }).promise();

            for (const shard of Shards) {
                const { ShardIterator } = await dynamodbstreams.getShardIterator({
                    StreamArn: streamArn,
                    ShardId: shard.ShardId,
                    ShardIteratorType: 'LATEST'
                }).promise();

                let iterator = ShardIterator;
                while (iterator) {
                    const { Records, NextShardIterator } = await dynamodbstreams
                        .getRecords({ ShardIterator: iterator })
                        .promise();

                    for (const record of Records) {
                        await handler(record);
                    }

                    iterator = NextShardIterator;
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } catch (error) {
            console.error(`Error processing stream for ${tableName}:`, error);
            throw error;
        }
    }
};

module.exports = {
    initializeDynamoDB,
    dbOperations
};
