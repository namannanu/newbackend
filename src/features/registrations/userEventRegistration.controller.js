const UserEventRegistration = require('./userEventRegistration.model');
const AppError = require('../../shared/utils/appError');
const catchAsync = require('../../shared/utils/catchAsync');
const BusinessRulesService = require('../../shared/services/businessRules.service');

// Initialize the DynamoDB table when the module is loaded
(async () => {
  try {
    await UserEventRegistration.initTable();
  } catch (error) {
    console.error('Error initializing EventUserRegistrations table:', error);
  }
})();

exports.getAllRegistrations = catchAsync(async (req, res, next) => {
  // Use DynamoDB scan instead of MongoDB find
  const registrations = await UserEventRegistration.scan();
  
  // We need to manually fetch associated user and event data
  // This is a simplified version - in a real app you'd batch these queries
  const populatedRegistrations = [];
  
  for (const registration of registrations) {
    // In a real implementation, you'd fetch user and event data here
    populatedRegistrations.push(registration);
  }

  res.status(200).json({
    status: 'success',
    results: registrations.length,
    data: {
      registrations: populatedRegistrations
    }
  });
});

exports.getRegistration = catchAsync(async (req, res, next) => {
  const registration = await UserEventRegistration.findById(req.params.id)
    .populate('userId', 'fullName email phone')
    .populate('eventId', 'name date location')
    .lean();

  if (!registration) {
    return next(new AppError('No registration found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      registration
    }
  });
});

exports.createRegistration = catchAsync(async (req, res, next) => {
  const { userId, eventId, user, event, adminBooked = false, adminOverrideReason } = req.body;
  
  // Support both new field names and legacy field names
  const userIdToUse = userId || user;
  const eventIdToUse = eventId || event;
  
  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(userIdToUse)) {
    return next(new AppError('Invalid user ID format.', 400));
  }
  
  if (!mongoose.Types.ObjectId.isValid(eventIdToUse)) {
    return next(new AppError('Invalid event ID format.', 400));
  }
  
  // Validate registration data integrity using business rules
  await BusinessRulesService.validateRegistrationIntegrity({
    userId: userIdToUse,
    eventId: eventIdToUse
  });

  // Validate event capacity
  await BusinessRulesService.validateEventCapacity(eventIdToUse);
  
  const registrationData = {
    userId: userIdToUse,
    eventId: eventIdToUse,
    registrationDate: new Date(),
    status: 'pending',
    waitingStatus: 'queued',
    faceVerificationStatus: 'pending',
    ticketAvailabilityStatus: 'pending',
    adminBooked,
    adminOverrideReason: adminBooked ? adminOverrideReason : null
  };
  
  const registration = await UserEventRegistration.create(registrationData);
  
  const populatedRegistration = await UserEventRegistration.findById(registration._id)
    .populate('userId', 'fullName email phone')
    .populate('eventId', 'name date location')
    .lean();

  res.status(201).json({
    status: 'success',
    message: 'Registration created successfully',
    data: {
      registration: populatedRegistration
    }
  });
});

exports.updateRegistration = catchAsync(async (req, res, next) => {
  const registration = await UserEventRegistration.findByIdAndUpdate(
    req.params.id, 
    req.body, 
    {
      new: true,
      runValidators: true
    }
  ).populate('userId', 'fullName email phone')
   .populate('eventId', 'name date location')
   .lean();

  if (!registration) {
    return next(new AppError('No registration found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      registration
    }
  });
});

exports.deleteRegistration = catchAsync(async (req, res, next) => {
  const registration = await UserEventRegistration.findByIdAndDelete(req.params.id);

  if (!registration) {
    return next(new AppError('No registration found with that ID', 404));
  }

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.checkInUser = catchAsync(async (req, res, next) => {
  const registration = await UserEventRegistration.findByIdAndUpdate(
    req.params.id,
    { 
      status: 'verified',
      checkInTime: new Date(),
      waitingStatus: 'complete'
    },
    { new: true }
  ).populate('userId', 'fullName email phone')
   .populate('eventId', 'name date location')
   .lean();

  if (!registration) {
    return next(new AppError('No registration found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'User checked in successfully',
    data: {
      registration
    }
  });
});

exports.getEventRegistrations = catchAsync(async (req, res, next) => {
  const { eventId } = req.params;
  
  // Use DynamoDB query with index instead of MongoDB find
  try {
    const registrations = await UserEventRegistration.getByEvent(eventId);
    
    res.status(200).json({
      status: 'success',
      results: registrations.length,
      data: {
        registrations
      }
    });
  } catch (error) {
    console.error('Error getting event registrations:', error);
    return next(new AppError('Error retrieving registrations', 500));
  }
});

exports.getUserRegistrations = catchAsync(async (req, res, next) => {
  const { userId } = req.params;
  
  // Use DynamoDB query with index instead of MongoDB find
  try {
    const registrations = await UserEventRegistration.getByUser(userId);
    
    res.status(200).json({
      status: 'success',
      results: registrations.length,
      data: {
        registrations
      }
    });
  } catch (error) {
    console.error('Error getting user registrations:', error);
    return next(new AppError('Error retrieving registrations', 500));
  }
});

// New methods for comprehensive schema support

exports.startFaceVerification = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { faceVerificationId } = req.body;
  
  const registration = await UserEventRegistration.findByIdAndUpdate(
    id,
    {
      faceVerificationStatus: 'processing',
      $inc: { verificationAttempts: 1 },
      lastVerificationAttempt: new Date(),
      waitingStatus: 'processing'
    },
    { new: true }
  ).populate('userId', 'fullName email phone')
   .populate('eventId', 'name date location')
   .lean();

  if (!registration) {
    return next(new AppError('No registration found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Face verification started',
    data: {
      registration
    }
  });
});

exports.completeFaceVerification = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { success, ticketAvailable = false } = req.body;
  
  const updateData = {
    faceVerificationStatus: success ? 'success' : 'failed',
    ticketAvailabilityStatus: success && ticketAvailable ? 'available' : 'unavailable',
    waitingStatus: success ? 'complete' : 'queued'
  };
  
  // If verification successful and ticket available, issue ticket
  if (success && ticketAvailable) {
    updateData.ticketIssued = true;
    updateData.ticketIssuedDate = new Date();
    updateData.status = 'verified';
  }
  
  const registration = await UserEventRegistration.findByIdAndUpdate(
    id,
    updateData,
    { new: true }
  ).populate('userId', 'fullName email phone')
   .populate('eventId', 'name date location')
   .lean();

  if (!registration) {
    return next(new AppError('No registration found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    message: `Face verification ${success ? 'completed successfully' : 'failed'}`,
    data: {
      registration
    }
  });
});

exports.issueTicket = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  
  const registration = await UserEventRegistration.findById(id);
  
  if (!registration) {
    return next(new AppError('No registration found with that ID', 404));
  }
  
  // Apply business rules validation for ticket issuance
  BusinessRulesService.validateTicketIssuanceRules(registration);
  
  const updatedRegistration = await UserEventRegistration.findByIdAndUpdate(
    id,
    {
      ticketIssued: true,
      ticketIssuedDate: new Date(),
      ticketAvailabilityStatus: 'available',
      status: 'verified'
    },
    { new: true }
  ).populate('userId', 'fullName email phone')
   .populate('eventId', 'name date location')
   .lean();

  res.status(200).json({
    status: 'success',
    message: 'Ticket issued successfully',
    data: {
      registration: updatedRegistration
    }
  });
});

exports.adminOverride = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { overrideReason, issueTicket = false } = req.body;
  
  if (!overrideReason) {
    return next(new AppError('Override reason is required', 400));
  }
  
  const updateData = {
    adminBooked: true,
    adminOverrideReason: overrideReason,
    status: 'verified',
    waitingStatus: 'complete'
  };
  
  if (issueTicket) {
    updateData.ticketIssued = true;
    updateData.ticketIssuedDate = new Date();
    updateData.ticketAvailabilityStatus = 'available';
  }
  
  const registration = await UserEventRegistration.findByIdAndUpdate(
    id,
    updateData,
    { new: true }
  ).populate('userId', 'fullName email phone')
   .populate('eventId', 'name date location')
   .lean();

  if (!registration) {
    return next(new AppError('No registration found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Admin override applied successfully',
    data: {
      registration
    }
  });
});

exports.getRegistrationsByStatus = catchAsync(async (req, res, next) => {
  const { status } = req.params;
  
  const validStatuses = ['pending', 'verified', 'rejected'];
  if (!validStatuses.includes(status)) {
    return next(new AppError('Invalid status. Must be: pending, verified, or rejected', 400));
  }
  
  const registrations = await UserEventRegistration.find({ status })
    .populate('userId', 'fullName email phone')
    .populate('eventId', 'name date location')
    .sort({ registrationDate: -1 })
    .lean();

  res.status(200).json({
    status: 'success',
    results: registrations.length,
    data: {
      registrations
    }
  });
});

exports.getRegistrationStats = catchAsync(async (req, res, next) => {
  // Use scan for DynamoDB instead of MongoDB aggregate
  const registrations = await UserEventRegistration.scan();
  
  // Calculate stats manually from the scan results
  const stats = registrations.reduce((acc, registration) => {
    const status = registration.status || 'unknown';
    if (!acc[status]) {
      acc[status] = 0;
    }
    acc[status]++;
    return acc;
  }, {});

  // Convert to the format expected by frontend
  const formattedStats = Object.keys(stats).map(key => ({
    _id: key,
    count: stats[key]
  }));
  
  // Calculate face verification stats manually
  const faceVerificationStats = registrations.reduce((acc, registration) => {
    const status = registration.faceVerificationStatus || 'unknown';
    if (!acc[status]) {
      acc[status] = 0;
    }
    acc[status]++;
    return acc;
  }, {});

  // Convert to the format expected by frontend
  const formattedFaceStats = Object.keys(faceVerificationStats).map(key => ({
    _id: key,
    count: faceVerificationStats[key]
  }));
  
  // Calculate ticket stats manually
  const ticketIssued = registrations.filter(reg => reg.ticketIssued).length;
  const ticketNotIssued = registrations.length - ticketIssued;
  const adminBooked = registrations.filter(reg => reg.adminBooked).length;
  
  const ticketStats = {
    ticketsIssued: ticketIssued,
    ticketsNotIssued: ticketNotIssued,
    adminBooked: adminBooked,
    totalRegistrations: registrations.length
  };

  res.status(200).json({
    status: 'success',
    data: {
      statusStats: formattedStats,
      faceVerificationStats: formattedFaceStats,
      ticketStats: ticketStats
    }
  });
});
