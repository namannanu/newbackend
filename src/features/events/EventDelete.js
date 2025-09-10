const AWS = require('aws-sdk');
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const AppError = require('../../shared/utils/appError');

class Event {
    static tableName = 'Events';

    static async delete(eventId) {
        console.log(`🗑️ Attempting to delete event: ${eventId}`);

        try {
            // First check if the event exists
            const getParams = {
                TableName: this.tableName,
                Key: {
                    eventId: eventId
                }
            };

            const existingEvent = await dynamoDB.get(getParams).promise();
            
            if (!existingEvent.Item) {
                throw new AppError('Event not found', 404);
            }

            // Delete the event
            const deleteParams = {
                TableName: this.tableName,
                Key: {
                    eventId: eventId
                },
                ReturnValues: 'ALL_OLD'
            };

            const result = await dynamoDB.delete(deleteParams).promise();
            
            if (!result.Attributes) {
                throw new AppError('Failed to delete event', 500);
            }

            console.log(`✅ Successfully deleted event: ${eventId}`);
            return result.Attributes;

        } catch (error) {
            console.error(`❌ Error deleting event ${eventId}:`, error);
            
            if (error instanceof AppError) {
                throw error;
            }
            
            throw new AppError(
                `Failed to delete event: ${error.message}`, 
                error.statusCode || 500
            );
        }
    }
}
