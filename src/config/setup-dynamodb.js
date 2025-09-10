const { initializeTables } = require('./dynamodb-init');

// Run the initialization
(async () => {
  try {
    await initializeTables();
    console.log('DynamoDB tables initialization completed successfully');
  } catch (error) {
    console.error('Failed to initialize DynamoDB tables:', error);
    process.exit(1);
  }
})();
