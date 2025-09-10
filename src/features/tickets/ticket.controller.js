const Ticket = require('./ticket.model');
const Event = require('../events/event.model');
const User = require('../users/user.model');
const AppError = require('../../shared/utils/appError');
const catchAsync = require('../../shared/utils/catchAsync');

// Table initialization is now controlled elsewhere to avoid startup failures on invalid AWS creds

exports.getAllTickets = catchAsync(async (req, res, next) => {
  // Get all tickets
  const tickets = await Promise.all(
    // First get tickets by status or all tickets
    (await Ticket.getByStatus('all')).map(async ticket => {
      // For each ticket, get event and user details
      const [event, user] = await Promise.all([
        Event.get(ticket.eventId),
        User.getUserById(ticket.userId)
      ]);
      return { ...ticket, event, user };
    })
  );

  res.status(200).json({
    status: 'success',
    results: tickets.length,
    data: {
      tickets
    }
  });
});

exports.getTicket = catchAsync(async (req, res, next) => {
  const ticket = await Ticket.get(req.params.id);

  if (!ticket) {
    return next(new AppError('No ticket found with that ID', 404));
  }

  // Get event and user details
  const [event, user] = await Promise.all([
    Event.get(ticket.eventId),
    User.getUserById(ticket.userId)
  ]);

  const ticketWithDetails = { ...ticket, event, user };

  res.status(200).json({
    status: 'success',
    data: {
      ticket: ticketWithDetails
    }
  });
});

exports.createTicket = catchAsync(async (req, res, next) => {
  // Verify event and user exist
  const [event, user] = await Promise.all([
    Event.get(req.body.eventId),
    User.getUserById(req.body.userId)
  ]);

  if (!event) {
    return next(new AppError('Event not found', 404));
  }

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Generate unique ticket ID
  const ticketId = `tkt_${Date.now()}`;
  const ticketData = {
    ...req.body,
    ticketId,
    status: 'active',
    faceVerified: false
  };

  const newTicket = await Ticket.create(ticketData);

  // Return ticket with event and user details
  const ticketWithDetails = { ...newTicket, event, user };

  res.status(201).json({
    status: 'success',
    data: {
      ticket: ticketWithDetails
    }
  });
});

exports.updateTicket = catchAsync(async (req, res, next) => {
  // First check if ticket exists
  const existingTicket = await Ticket.get(req.params.id);
  
  if (!existingTicket) {
    return next(new AppError('No ticket found with that ID', 404));
  }

  // If eventId or userId is being updated, verify they exist
  if (req.body.eventId) {
    const event = await Event.get(req.body.eventId);
    if (!event) {
      return next(new AppError('Event not found', 404));
    }
  }

  if (req.body.userId) {
    const user = await User.getUserById(req.body.userId);
    if (!user) {
      return next(new AppError('User not found', 404));
    }
  }

  // Update the ticket
  const ticket = await Ticket.update(req.params.id, req.body);

  // Get updated event and user details
  const [event, user] = await Promise.all([
    Event.get(ticket.eventId),
    User.getUserById(ticket.userId)
  ]);

  const ticketWithDetails = { ...ticket, event, user };

  res.status(200).json({
    status: 'success',
    data: {
      ticket: ticketWithDetails
    }
  });
});

exports.verifyTicket = catchAsync(async (req, res, next) => {
  const { ticketId, faceImage } = req.body;

  // First check if ticket exists
  const existingTicket = await Ticket.get(ticketId);
  
  if (!existingTicket) {
    return next(new AppError('No ticket found with that ID', 404));
  }

  // In a real app, you would verify the face against the user's stored face
  // Update ticket with verification details
  const ticket = await Ticket.checkIn(ticketId, true);

  // Get event and user details for response
  const [event, user] = await Promise.all([
    Event.get(ticket.eventId),
    User.getUserById(ticket.userId)
  ]);

  const ticketWithDetails = { ...ticket, event, user };

  res.status(200).json({
    status: 'success',
    data: {
      ticket: ticketWithDetails
    }
  });
});

// Get tickets by event
exports.getEventTickets = catchAsync(async (req, res, next) => {
  const event = await Event.get(req.params.eventId);
  
  if (!event) {
    return next(new AppError('No event found with that ID', 404));
  }

  // Get all tickets for this event
  const tickets = await Promise.all(
    (await Ticket.getByEvent(req.params.eventId)).map(async ticket => {
      // For each ticket, get user details
      const user = await User.getUserById(ticket.userId);
      return { ...ticket, event, user };
    })
  );

  res.status(200).json({
    status: 'success',
    results: tickets.length,
    data: {
      tickets
    }
  });
});
