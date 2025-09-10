const catchAsync = require('../../shared/utils/catchAsync');
const AppError = require('../../shared/utils/appError');
const Feedback = require('./feedback.model');
const User = require('../auth/auth.model');
const Event = require('../events/event.model');
const { initializeDynamoDB } = require('../../config/config');

exports.getAllFeedback = catchAsync(async (req, res, next) => {
  // Get all feedback items from DynamoDB
  // Since our model doesn't have a scan method, we'll need to implement it
  const params = {
    TableName: Feedback.tableName
  };
  
  const { documentClient } = await initializeDynamoDB();
  const result = await documentClient.scan(params).promise();
  const feedback = result.Items || [];

  res.status(200).json({
    status: 'success',
    results: feedback.length,
    data: {
      feedback
    }
  });
});

exports.getFeedback = catchAsync(async (req, res, next) => {
  const feedback = await Feedback.get(req.params.id);

  if (!feedback) {
    return next(new AppError('No feedback found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      feedback
    }
  });
});

exports.createFeedback = catchAsync(async (req, res, next) => {
  // Get user ID from authenticated token - will be available if authMiddleware.protect was used
  if (!req.user || !req.user.userId) {
    return next(new AppError('Authentication required. User ID not found in token.', 401));
  }
  
  // Extract user ID from token and other fields from request body
  const userId = req.user.userId;
  // Handle both message and comment fields, and make category and subject optional
  const { eventId, rating, category: providedCategory, subject: providedSubject, message: providedMessage, comment } = req.body;
  
  // Determine the message content (either from message or comment field)
  const message = providedMessage || comment;
  // Default category to 'event' if not provided
  const category = providedCategory || 'event';
  // Default subject if not provided
  const subject = providedSubject || 'Event Feedback';
  
  console.log('Creating feedback with user from token:', userId);
  
  // Validate event ID is provided
  if (!eventId) {
    return next(new AppError('Event ID is required.', 400));
  }
  
  // Validate required fields
  if (!rating || rating < 1 || rating > 5) {
    return next(new AppError('Rating is required and must be between 1 and 5.', 400));
  }
  
  // Validate category if provided
  if (!['app', 'event', 'support', 'other'].includes(category)) {
    return next(new AppError('Feedback category must be one of: app, event, support, other', 400));
  }
  
  // Message is required (either as message or comment)
  if (!message || message.trim().length < 3) {
    return next(new AppError('Feedback message/comment is required and must be at least 3 characters long.', 400));
  }
  
  // Check if user has already submitted feedback for this event and category
  try {
    const userFeedbacks = await Feedback.getByUser(userId);
    
    // Only check for duplicates if userFeedbacks exists and is an array
    if (Array.isArray(userFeedbacks) && userFeedbacks.length > 0) {
      const existingEventFeedback = userFeedbacks.find(feedback => 
        feedback.eventId === eventId && feedback.category === category
      );
      
      if (existingEventFeedback) {
        return next(new AppError(`You have already submitted ${category} feedback for this event.`, 400));
      }
    }
  } catch (error) {
    console.log('Error checking for existing feedback:', error);
    // Continue even if there's an error checking existing feedback
  }
  
  // Create new feedback entry
  const feedbackData = {
    userId,
    eventId,
    rating,
    category,
    subject: subject ? subject.trim() : 'Event Feedback',
    message: message.trim(),
    status: 'new'
  };
  
  // Create feedback record in DynamoDB
  const feedback = await Feedback.create(feedbackData);
  
  res.status(201).json({
    status: 'success',
    message: 'Feedback created successfully',
    data: {
      feedback
    }
  });
});

exports.updateFeedback = catchAsync(async (req, res, next) => {
  // Verify feedback exists first
  const existingFeedback = await Feedback.get(req.params.id);
  
  if (!existingFeedback) {
    return next(new AppError('No feedback found with that ID', 404));
  }
  
  // Update the feedback
  const feedback = await Feedback.update(req.params.id, req.body);

  res.status(200).json({
    status: 'success',
    data: {
      feedback
    }
  });
});

exports.markAsReviewed = catchAsync(async (req, res, next) => {
  // Verify feedback exists first
  const existingFeedback = await Feedback.get(req.params.id);
  
  if (!existingFeedback) {
    return next(new AppError('No feedback found with that ID', 404));
  }
  
  // Update the feedback status
  const feedback = await Feedback.update(req.params.id, { status: 'reviewed' });

  res.status(200).json({
    status: 'success',
    data: {
      feedback
    }
  });
});
