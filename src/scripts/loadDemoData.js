require('dotenv').config({ path: path.join(__dirname, '../config/config.env') });
const AWS = require('aws-sdk');
const fs = require('fs').promises;
const path = require('path');
const colors = require('colors');

// Configure AWS
AWS.config.update({
    region: process.env.AWS_REGION || 'ap-south-1',
    ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && {
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
    })
});

// Initialize DynamoDB DocumentClient
const documentClient = new AWS.DynamoDB.DocumentClient();

// Helper function to get table name with stage prefix
const getTableName = (baseName) => {
    const stage = process.env.STAGE || 'dev';
    return `${stage}-${baseName}`;
};

async function loadDemoData() {
    try {
        // Read the demo data file
        console.log('📖 Reading demo data file...'.yellow);
        const dataPath = path.join(__dirname, 'demo-data.json');
        const demoData = JSON.parse(await fs.readFile(dataPath, 'utf8'));
        console.log('✅ Demo data loaded successfully'.green);

        // Function to batch write items
        const batchWriteItems = async (tableName, items) => {
            const batchSize = 25; // DynamoDB batch write limit
            
            for (let i = 0; i < items.length; i += batchSize) {
                const batch = items.slice(i, i + batchSize);
                const params = {
                    RequestItems: {
                        [tableName]: batch.map(item => ({
                            PutRequest: { Item: item }
                        }))
                    }
                };

                try {
                    await documentClient.batchWrite(params).promise();
                    console.log(`✅ Loaded batch ${Math.floor(i/batchSize) + 1} for ${tableName}`.green);
                } catch (error) {
                    console.error(`❌ Error loading batch for ${tableName}:`.red, error.message);
                    throw error;
                }
            }
        };

        // Load data into each table with proper table names
        for (const [collection, items] of Object.entries(demoData)) {
            const tableName = getTableName(collection);
            console.log(`\n🔄 Loading data for ${tableName}...`.yellow);
            try {
                await batchWriteItems(tableName, items);
                console.log(`✅ Successfully loaded ${items.length} items into ${tableName}`.green);
            } catch (error) {
                console.error(`❌ Error loading data for ${tableName}:`.red, error.message);
                console.error('Continuing with next table...\n'.yellow);
                continue;
            }
        }

        console.log('\n🎉 Demo data loading completed!'.green.bold);
        
        // Print loading statistics
        console.log('\n📊 Loading Statistics:'.cyan);
        for (const [tableName, items] of Object.entries(demoData)) {
            console.log(`${tableName}: ${items.length} items`.cyan);
        }

    } catch (error) {
        console.error('❌ Failed to load demo data:'.red.bold, error);
        process.exit(1);
    }
}

// Run the script if called directly
if (require.main === module) {
    loadDemoData();
}

module.exports = loadDemoData;
