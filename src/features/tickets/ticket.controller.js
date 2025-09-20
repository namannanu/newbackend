const Ticket = require('./ticket.model');
const Event = require('../events/event.model');
const User = require('../users/user.model');
const UserEventRegistration = require('../registrations/userEventRegistration.model');
const AppError = require('../../shared/utils/appError');
const catchAsync = require('../../shared/utils/catchAsync');

// Initialize the DynamoDB table when the module is loaded
(async () => {
  try {
    await Ticket.initTable();
  } catch (error) {
    console.error('Error initializing EventTickets table:', error);
  }
})();

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
  const quantityRaw = req.body.quantity ?? 1;
  const quantity = Number(quantityRaw);

  if (!Number.isInteger(quantity) || quantity <= 0) {
    return next(new AppError('Quantity must be a positive whole number', 400));
  }

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

  const totalTickets = Number(event.totalTickets || 0);
  const ticketsSold = Number(event.ticketsSold || 0);
  const hasCapacityLimit = totalTickets > 0;

  if (hasCapacityLimit && ticketsSold + quantity > totalTickets) {
    return next(new AppError('Not enough tickets available for this event', 400));
  }

  const unitPrice = Number(
    req.body.price !== undefined ? req.body.price : event.ticketPrice || 0
  );
  const totalPrice = unitPrice * quantity;

  const hasFaceData = await User.hasFaceImageForUser(user.userId);
  const isUserVerified = !user.verificationStatus || user.verificationStatus === 'verified';
  const shouldQueueRequest = !hasFaceData || !isUserVerified;

  if (shouldQueueRequest) {
    const registration = await UserEventRegistration.recordTicketRequest({
      userId: user.userId,
      eventId: event.eventId,
      quantity,
      unitPrice,
      totalPrice,
      notes: req.body.notes,
      source: 'ticket_purchase_pending_verification'
    });

    return res.status(202).json({
      status: 'pending_verification',
      message: 'Face verification pending. Ticket request has been queued and will be issued once verification is approved.',
      data: {
        registration
      }
    });
  }

  const ticketId = `tkt_${Date.now()}`;
  const ticketData = {
    ticketId,
    eventId: event.eventId,
    userId: user.userId,
    seatNumber: req.body.seatNumber,
    price: unitPrice,
    totalPrice,
    quantity,
    notes: req.body.notes,
    status: 'active'
  };

  const newTicket = await Ticket.create(ticketData);

  const updatedEvent = await Event.update(event.eventId, {
    ticketsSold: ticketsSold + quantity
  });

  const ticketWithDetails = {
    ...newTicket,
    event: updatedEvent,
    user: {
      ...user,
      faceId: hasFaceData
    }
  };

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
