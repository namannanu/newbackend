const Event = require('./event.model');
const Organizer = require('../organizers/organizer.model');
const AppError = require('../../shared/utils/appError');
const catchAsync = require('../../shared/utils/catchAsync');
const { initializeDynamoDB } = require('../../config/config');

exports.getAllEvents = catchAsync(async (req, res, next) => {
  console.log('📢 GET /api/events endpoint hit - fetching all events');
  
  try {
    // Use direct scan to get all events without any filtering
    const params = {
      TableName: Event.tableName
    };
    
    console.log('🔍 Scanning events table with params:', JSON.stringify(params));
    const { documentClient } = await initializeDynamoDB();
    const result = await documentClient.scan(params).promise();
    const events = result.Items || [];
    
    console.log(`📊 Found ${events.length} events in database`);
    
    if (events.length === 0) {
      console.log('⚠️ No events found - checking table metadata');
      
      try {
        const { dynamoDB: dynamoDBRaw } = await initializeDynamoDB();
        const tableInfo = await dynamoDBRaw.describeTable({ TableName: Event.tableName }).promise();
        console.log(`ℹ️ Table info:`, JSON.stringify({
          status: tableInfo.Table.TableStatus,
          itemCount: tableInfo.Table.ItemCount,
          creationTime: tableInfo.Table.CreationDateTime
        }, null, 2));
      } catch (e) {
        console.error('❌ Could not get table info:', e.message);
      }
    } else {
      console.log('� Event IDs found:', events.map(e => e.eventId).join(', '));
    }
    
    // For each event, get the organizer details if needed
    const eventsWithOrganizers = await Promise.all(events.map(async (event) => {
      if (!event.organizerId) {
        console.warn(`⚠️ Event ${event.eventId} has no organizerId`);
        return event;
      }
      
      try {
        const organizer = await Organizer.get(event.organizerId);
        return organizer ? { ...event, organizer } : event;
      } catch (err) {
        console.warn(`⚠️ Could not get organizer for event ${event.eventId}: ${err.message}`);
        return event;
      }
    }));

    res.status(200).json({
      status: 'success',
      results: events.length,
      data: {
        events: eventsWithOrganizers
      }
    });
  } catch (error) {
    console.error('❌ Error fetching events:', error);
    return next(new AppError(`Error fetching events: ${error.message}`, 500));
  }
});

exports.getEvent = catchAsync(async (req, res, next) => {
  const event = await Event.get(req.params.id);

  if (!event) {
    return next(new AppError('No event found with that ID', 404));
  }

  // Get organizer details
  const organizer = await Organizer.get(event.organizerId);
  const eventWithOrganizer = { ...event, organizer };

  res.status(200).json({
    status: 'success',
    data: {
      event: eventWithOrganizer
    }
  });
});

exports.createEvent = catchAsync(async (req, res, next) => {
  console.log('📝 Creating event with data:', JSON.stringify(req.body, null, 2));
  
  try {
    // 1. Basic validation
    const requiredFields = ['name', 'organizerId', 'date'];
    for (const field of requiredFields) {
      if (!req.body[field]) {
        return next(new AppError(`Missing required field: ${field}`, 400));
      }
    }
    
    // 2. Verify organizer exists
    const organizer = await Organizer.get(req.body.organizerId);
    if (!organizer) {
      return next(new AppError('Invalid organizer ID', 400));
    }

    // 3. Create event using direct DynamoDB operation instead of model
    const timestamp = new Date().toISOString();
    const eventId = `evt_${Date.now()}${Math.random().toString(36).substring(2, 5)}`;
    
    const eventItem = {
      eventId: eventId,
      name: req.body.name,
      description: req.body.description || '',
      date: req.body.date,
      startTime: req.body.startTime || '',
      endTime: req.body.endTime || '',
      location: req.body.location || '',
      organizerId: req.body.organizerId,
      totalTickets: Number(req.body.totalTickets || 0),
      ticketsSold: 0,
      ticketPrice: Number(req.body.ticketPrice || 0),
      status: req.body.status || 'upcoming',
      coverImage: req.body.coverImage || '',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    console.log('📊 Prepared event item:', JSON.stringify(eventItem, null, 2));

    // Insert directly using DynamoDB DocumentClient
    const params = {
      TableName: 'Events', // Using string literal instead of reference
      Item: eventItem
    };
    
    console.log('⬆️ Putting item to DynamoDB with params:', JSON.stringify(params, null, 2));
    await dynamoDB.put(params).promise();
    console.log('✅ Event created successfully in DynamoDB with ID:', eventId);

    // 4. Update organizer stats
    try {
      await Organizer.updateStats(req.body.organizerId, {
        totalEvents: 1,
        activeEvents: 1
      });
      console.log('✅ Organizer stats updated');
    } catch (statsError) {
      console.error('⚠️ Failed to update organizer stats:', statsError);
      // Continue even if stats update fails
    }

    // 5. Return successful response
    res.status(201).json({
      status: 'success',
      data: {
        event: {
          ...eventItem,
          organizer: organizer
        }
      }
    });
  } catch (error) {
    console.error('❌ Error creating event:', error);
    console.error('Error stack:', error.stack);
    
    // Simplify error handling
    return next(new AppError(`Failed to create event: ${error.message}`, 500));
  }
});

exports.updateEvent = catchAsync(async (req, res, next) => {
  // First check if event exists
  const existingEvent = await Event.get(req.params.id);
  if (!existingEvent) {
    return next(new AppError('No event found with that ID', 404));
  }

  // If organizerId is being updated, verify new organizer exists
  if (req.body.organizerId && req.body.organizerId !== existingEvent.organizerId) {
    const newOrganizer = await Organizer.get(req.body.organizerId);
    if (!newOrganizer) {
      return next(new AppError('Invalid organizer ID', 400));
    }
  }

  // Update the event
  const event = await Event.update(req.params.id, req.body);

  // Get updated organizer details
  const organizer = await Organizer.get(event.organizerId);
  const eventWithOrganizer = { ...event, organizer };

  res.status(200).json({
    status: 'success',
    data: {
      event: eventWithOrganizer
    }
  });
});

exports.deleteEvent = catchAsync(async (req, res, next) => {
  // First get the event to check if it exists and get organizer info
  const event = await Event.get(req.params.id);

  if (!event) {
    return next(new AppError('No event found with that ID', 404));
  }

  // Delete the event
  await Event.delete(req.params.id);

  // Update organizer stats
  await Organizer.updateStats(event.organizerId, {
    totalEvents: -1,
    activeEvents: event.status === 'upcoming' ? -1 : 0
  });

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.getEventStats = async (req, res, next) => {
  console.log('🔍 GET /api/events/stats endpoint hit');
  
  // Default empty stats object
  const emptyStats = {
    totalEvents: 0,
    totalRevenue: 0,
    minTicketPrice: 0,
    maxTicketPrice: 0,
    avgTicketPrice: 0
  };
  
  try {
    // Use a direct try/catch instead of the catchAsync wrapper
    // to have more control over error handling
    
    // Make sure Event.tableName exists
    if (!Event.tableName) {
      console.error('Table name is undefined');
      return res.status(200).json({
        status: 'success',
        data: { stats: emptyStats }
      });
    }
    
    // Use scan instead of queryByStatusAndDate since the index is not set up
    const params = {
      TableName: Event.tableName
    };
    
    let result;
    try {
      result = await dynamoDB.scan(params).promise();
    } catch (dbError) {
      console.error('🚨 DynamoDB scan error:', dbError.message);
      // Return empty stats rather than failing with an error
      return res.status(200).json({
        status: 'success',
        data: { stats: emptyStats }
      });
    }
    
    // Make sure we have items
    const events = result && result.Items ? result.Items : [];
    
    if (events.length === 0) {
      console.log('No events found in database');
      return res.status(200).json({
        status: 'success',
        data: { stats: emptyStats }
      });
    }
    
    // Calculate stats manually
    const stats = events.reduce((acc, event) => {
      acc.totalEvents++;
      
      // Safe calculations for revenue
      try {
        if (typeof Event.calculateRevenue === 'function') {
          const revenue = Event.calculateRevenue(event);
          if (!isNaN(revenue)) {
            acc.totalRevenue += revenue;
          }
        } else if (event.ticketPrice && event.ticketsSold) {
          const price = parseFloat(event.ticketPrice);
          const sold = parseInt(event.ticketsSold, 10);
          
          if (!isNaN(price) && !isNaN(sold)) {
            acc.totalRevenue += (price * sold);
          }
        }
        
        // Only add valid ticket prices
        if (event.ticketPrice) {
          const price = parseFloat(event.ticketPrice);
          if (!isNaN(price) && price > 0) {
            acc.ticketPrices.push(price);
          }
        }
      } catch (calcError) {
        console.error('Error calculating stats for event:', calcError);
        // Continue with next event
      }
      
      return acc;
    }, {
      totalEvents: 0,
      totalRevenue: 0,
      ticketPrices: []
    });

    // Calculate min, max, and average ticket prices safely
    let minTicketPrice = 0;
    let maxTicketPrice = 0;
    let avgTicketPrice = 0;
    
    if (stats.ticketPrices && stats.ticketPrices.length > 0) {
      try {
        minTicketPrice = Math.min(...stats.ticketPrices);
        maxTicketPrice = Math.max(...stats.ticketPrices);
        avgTicketPrice = stats.ticketPrices.reduce((a, b) => a + b, 0) / stats.ticketPrices.length;
      } catch (error) {
        console.error('Error calculating ticket price stats:', error);
      }
    }

    // Remove the intermediate array
    delete stats.ticketPrices;
    
    // Add the calculated price stats
    Object.assign(stats, { minTicketPrice, maxTicketPrice, avgTicketPrice });

    console.log('📊 Stats calculated successfully');
    res.status(200).json({
      status: 'success',
      data: { stats }
    });
  } catch (error) {
    console.error('❌ Error in getEventStats:', error);
    // Instead of passing to error handler, return empty stats
    return res.status(200).json({
      status: 'success',
      data: { stats: emptyStats }
    });
  }
};
