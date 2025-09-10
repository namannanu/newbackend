const AWS = require('aws-sdk');

// This script checks if required tables exist
async function checkTables() {
    try {
        // Configure AWS
        const region = process.env.AWS_REGION || 'ap-south-1';
        const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
        const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

        if (!accessKeyId || !secretAccessKey) {
            console.error('AWS credentials are missing!');
            process.exit(1);
        }

        AWS.config.update({
            region: region,
            credentials: new AWS.Credentials({
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey
            })
        });

        const dynamoDB = new AWS.DynamoDB();

        // List all tables
        const tables = await dynamoDB.listTables().promise();
        console.log('Available tables:', tables.TableNames);

        // Check for required tables
        const requiredTables = ['Users', 'faceimage'];
        const missingTables = requiredTables.filter(table => !tables.TableNames.includes(table));

        if (missingTables.length > 0) {
            console.error('Missing required tables:', missingTables);
            process.exit(1);
        }

        console.log('All required tables exist!');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
}

checkTables();
