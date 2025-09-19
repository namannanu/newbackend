const UserEventRegistration = require('./userEventRegistration.model');
const AppError = require('../../shared/utils/appError');
const catchAsync = require('../../shared/utils/catchAsync');
const BusinessRulesService = require('../../shared/services/businessRules.service');
const UserModel = require('../users/user.model');
const EventModel = require('../events/event.model');

const nowIsoString = () => new Date().toISOString();

const hydrateRegistration = async (registration) => {
  if (!registration) {
    return null;
  }

  const [user, event] = await Promise.all([
    registration.userId ? UserModel.getUserById(registration.userId) : null,
    registration.eventId ? EventModel.get(registration.eventId) : null
  ]);

  return {
    ...registration,
    user,
    event
  };
};

const hydrateRegistrations = async (registrations = []) => Promise.all(registrations.map(hydrateRegistration));

// Initialize the DynamoDB table when the module is loaded
(async () => {
  try {
    await UserEventRegistration.initTable();
  } catch (error) {
    console.error('Error initializing EventUserRegistrations table:', error);
  }
})();

exports.getAllRegistrations = catchAsync(async (req, res) => {
  const registrations = await UserEventRegistration.scan();
  const populatedRegistrations = await hydrateRegistrations(registrations);

  res.status(200).json({
    status: 'success',
    results: populatedRegistrations.length,
    data: {
      registrations: populatedRegistrations
    }
  });
});

exports.getRegistration = catchAsync(async (req, res, next) => {
  const registration = await UserEventRegistration.findById(req.params.id);

  if (!registration) {
    return next(new AppError('No registration found with that ID', 404));
  }

  const populatedRegistration = await hydrateRegistration(registration);

  res.status(200).json({
    status: 'success',
    data: {
      registration: populatedRegistration
    }
  });
});

exports.createRegistration = catchAsync(async (req, res, next) => {
  const { userId, eventId, user, event, adminBooked = false, adminOverrideReason } = req.body;

  const userIdToUse = userId || user;
  const eventIdToUse = eventId || event;

  if (!userIdToUse || !eventIdToUse) {
    return next(new AppError('User ID and Event ID are required', 400));
  }

  await BusinessRulesService.validateRegistrationIntegrity({
    userId: userIdToUse,
    eventId: eventIdToUse
  });

  await BusinessRulesService.validateEventCapacity(eventIdToUse);

  const registrationData = {
    userId: userIdToUse,
    eventId: eventIdToUse,
    registrationDate: nowIsoString(),
    status: 'pending',
    waitingStatus: 'queued',
    faceVerificationStatus: 'pending',
    ticketAvailabilityStatus: 'pending',
    adminBooked,
    adminOverrideReason: adminBooked && adminOverrideReason ? adminOverrideReason : null
  };

  const registration = await UserEventRegistration.create(registrationData);
  const populatedRegistration = await hydrateRegistration(registration);

  res.status(201).json({
    status: 'success',
    message: 'Registration created successfully',
    data: {
      registration: populatedRegistration
    }
  });
});

exports.updateRegistration = catchAsync(async (req, res, next) => {
  const updatePayload = { ...req.body };
  delete updatePayload.registrationId;

  const updatedRegistration = await UserEventRegistration.findByIdAndUpdate(
    req.params.id,
    updatePayload
  );

  if (!updatedRegistration) {
    return next(new AppError('No registration found with that ID', 404));
  }

  const populatedRegistration = await hydrateRegistration(updatedRegistration);

  res.status(200).json({
    status: 'success',
    data: {
      registration: populatedRegistration
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
  const existingRegistration = await UserEventRegistration.findById(req.params.id);

  if (!existingRegistration) {
    return next(new AppError('No registration found with that ID', 404));
  }

  BusinessRulesService.validateCheckInEligibility(existingRegistration);

  const updatedRegistration = await UserEventRegistration.findByIdAndUpdate(
    req.params.id,
    {
      status: 'verified',
      checkInTime: nowIsoString(),
      waitingStatus: 'complete'
    }
  );

  const populatedRegistration = await hydrateRegistration(updatedRegistration);

  res.status(200).json({
    status: 'success',
    message: 'User checked in successfully',
    data: {
      registration: populatedRegistration
    }
  });
});

exports.getEventRegistrations = catchAsync(async (req, res, next) => {
  try {
    const registrations = await UserEventRegistration.getByEvent(req.params.eventId);
    const populatedRegistrations = await hydrateRegistrations(registrations);

    res.status(200).json({
      status: 'success',
      results: populatedRegistrations.length,
      data: {
        registrations: populatedRegistrations
      }
    });
  } catch (error) {
    console.error('Error getting event registrations:', error);
    return next(new AppError('Error retrieving registrations', 500));
  }
});

exports.getUserRegistrations = catchAsync(async (req, res, next) => {
  try {
    const registrations = await UserEventRegistration.getByUser(req.params.userId);
    const populatedRegistrations = await hydrateRegistrations(registrations);

    res.status(200).json({
      status: 'success',
      results: populatedRegistrations.length,
      data: {
        registrations: populatedRegistrations
      }
    });
  } catch (error) {
    console.error('Error getting user registrations:', error);
    return next(new AppError('Error retrieving registrations', 500));
  }
});

exports.startFaceVerification = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const registration = await UserEventRegistration.findById(id);

  if (!registration) {
    return next(new AppError('No registration found with that ID', 404));
  }

  BusinessRulesService.validateFaceVerificationAttempt(registration);

  const updatedRegistration = await UserEventRegistration.findByIdAndUpdate(id, {
    faceVerificationStatus: 'processing',
    waitingStatus: 'processing',
    lastVerificationAttempt: nowIsoString(),
    $inc: { verificationAttempts: 1 }
  });

  const populatedRegistration = await hydrateRegistration(updatedRegistration);

  res.status(200).json({
    status: 'success',
    message: 'Face verification started',
    data: {
      registration: populatedRegistration
    }
  });
});

exports.completeFaceVerification = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { success, ticketAvailable = false } = req.body;

  const registration = await UserEventRegistration.findById(id);

  if (!registration) {
    return next(new AppError('No registration found with that ID', 404));
  }

  const updateData = {
    faceVerificationStatus: success ? 'success' : 'failed',
    ticketAvailabilityStatus: success && ticketAvailable ? 'available' : 'unavailable',
    waitingStatus: success ? 'complete' : 'queued'
  };

  if (success && ticketAvailable) {
    updateData.ticketIssued = true;
    updateData.ticketIssuedDate = nowIsoString();
    updateData.status = 'verified';
  }

  const updatedRegistration = await UserEventRegistration.findByIdAndUpdate(id, updateData);
  const populatedRegistration = await hydrateRegistration(updatedRegistration);

  res.status(200).json({
    status: 'success',
    message: `Face verification ${success ? 'completed successfully' : 'failed'}`,
    data: {
      registration: populatedRegistration
    }
  });
});

exports.issueTicket = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const registration = await UserEventRegistration.findById(id);

  if (!registration) {
    return next(new AppError('No registration found with that ID', 404));
  }

  BusinessRulesService.validateTicketIssuanceRules(registration);

  const updatedRegistration = await UserEventRegistration.issueTicket(id);
  const populatedRegistration = await hydrateRegistration(updatedRegistration);

  res.status(200).json({
    status: 'success',
    message: 'Ticket issued successfully',
    data: {
      registration: populatedRegistration
    }
  });
});

exports.adminOverride = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { overrideReason, issueTicket = false } = req.body;

  if (!overrideReason) {
    return next(new AppError('Override reason is required', 400));
  }

  BusinessRulesService.validateAdminOverride(req.user?.id || null, overrideReason);

  const updateData = {
    adminBooked: true,
    adminOverrideReason: overrideReason,
    status: 'verified',
    waitingStatus: 'complete'
  };

  if (issueTicket) {
    updateData.ticketIssued = true;
    updateData.ticketIssuedDate = nowIsoString();
    updateData.ticketAvailabilityStatus = 'available';
  }

  const updatedRegistration = await UserEventRegistration.findByIdAndUpdate(id, updateData);

  if (!updatedRegistration) {
    return next(new AppError('No registration found with that ID', 404));
  }

  const populatedRegistration = await hydrateRegistration(updatedRegistration);

  res.status(200).json({
    status: 'success',
    message: 'Admin override applied successfully',
    data: {
      registration: populatedRegistration
    }
  });
});

exports.getRegistrationsByStatus = catchAsync(async (req, res, next) => {
  const { status } = req.params;
  const validStatuses = ['pending', 'verified', 'rejected'];

  if (!validStatuses.includes(status)) {
    return next(new AppError('Invalid status. Must be: pending, verified, or rejected', 400));
  }

  const registrations = await UserEventRegistration.find({ status });
  const populatedRegistrations = await hydrateRegistrations(registrations);

  res.status(200).json({
    status: 'success',
    results: populatedRegistrations.length,
    data: {
      registrations: populatedRegistrations
    }
  });
});

exports.getRegistrationStats = catchAsync(async (req, res) => {
  const registrations = await UserEventRegistration.scan();

  const stats = registrations.reduce((acc, registration) => {
    const statusKey = registration.status || 'unknown';
    acc[statusKey] = (acc[statusKey] || 0) + 1;
    return acc;
  }, {});

  const formattedStats = Object.keys(stats).map((key) => ({
    _id: key,
    count: stats[key]
  }));

  const faceVerificationStats = registrations.reduce((acc, registration) => {
    const statusKey = registration.faceVerificationStatus || 'unknown';
    acc[statusKey] = (acc[statusKey] || 0) + 1;
    return acc;
  }, {});

  const formattedFaceStats = Object.keys(faceVerificationStats).map((key) => ({
    _id: key,
    count: faceVerificationStats[key]
  }));

  const ticketIssued = registrations.filter((reg) => reg.ticketIssued).length;
  const adminBooked = registrations.filter((reg) => reg.adminBooked).length;

  const ticketStats = {
    ticketsIssued: ticketIssued,
    ticketsNotIssued: registrations.length - ticketIssued,
    adminBooked,
    totalRegistrations: registrations.length
  };

  res.status(200).json({
    status: 'success',
    data: {
      statusStats: formattedStats,
      faceVerificationStats: formattedFaceStats,
      ticketStats
    }
  });
});
