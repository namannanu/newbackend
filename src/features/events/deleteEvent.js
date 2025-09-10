exports.deleteEvent = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    
    console.log(`🗑️ Attempting to delete event with ID: ${id}`);
    
    try {
        // Check if event exists
        const getParams = {
            TableName: Event.tableName,
            Key: {
                eventId: id
            }
        };
        
        const existingEvent = await dynamoDB.get(getParams).promise();
        
        if (!existingEvent.Item) {
            console.log(`❌ Event not found with ID: ${id}`);
            return next(new AppError('Event not found', 404));
        }

        // Check if user has permission to delete this event
        if (req.user.role !== 'admin' && existingEvent.Item.organizerId !== req.user.id) {
            console.log('❌ User does not have permission to delete this event');
            return next(new AppError('You do not have permission to delete this event', 403));
        }

        // Delete the event
        const deleteParams = {
            TableName: Event.tableName,
            Key: {
                eventId: id
            },
            ReturnValues: 'ALL_OLD' // This will return the deleted item
        };

        console.log('🔄 Deleting event from DynamoDB...');
        const result = await dynamoDB.delete(deleteParams).promise();
        
        if (!result.Attributes) {
            console.log('❌ Failed to delete event - no attributes returned');
            return next(new AppError('Failed to delete event', 500));
        }

        console.log(`✅ Successfully deleted event with ID: ${id}`);
        
        res.status(200).json({
            status: 'success',
            message: 'Event deleted successfully',
            data: result.Attributes
        });
    } catch (error) {
        console.error('❌ Error deleting event:', error);
        return next(new AppError(`Failed to delete event: ${error.message}`, 500));
    }
});
