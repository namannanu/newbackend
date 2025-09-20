const TicketModel = require('./ticket.model');
const EventModel = require('../events/event.model');
const UserEventRegistration = require('../registrations/userEventRegistration.model');

const buildTicketId = () => `tkt_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const issueTicketFromRegistration = async ({ registration, userId }) => {
  const event = await EventModel.get(registration.eventId);

  if (!event) {
    await UserEventRegistration.findByIdAndUpdate(registration.registrationId, {
      ticketAvailabilityStatus: 'event_unavailable',
      waitingStatus: 'cancelled',
      status: 'rejected'
    });
    return null;
  }

  const quantity = Number.isInteger(registration.requestedQuantity)
    ? registration.requestedQuantity
    : 1;

  const totalTickets = Number(event.totalTickets || 0);
  const ticketsSold = Number(event.ticketsSold || 0);
  const hasCapacityLimit = totalTickets > 0;

  if (hasCapacityLimit && ticketsSold + quantity > totalTickets) {
    await UserEventRegistration.findByIdAndUpdate(registration.registrationId, {
      ticketAvailabilityStatus: 'unavailable',
      waitingStatus: 'queued',
      status: 'pending'
    });
    return null;
  }

  const unitPrice = registration.unitPrice !== undefined
    ? Number(registration.unitPrice)
    : Number(event.ticketPrice || 0);
  const totalPrice = registration.totalPrice !== undefined
    ? Number(registration.totalPrice)
    : unitPrice * quantity;

  const ticketId = buildTicketId();
  const ticket = await TicketModel.create({
    ticketId,
    eventId: event.eventId,
    userId,
    registrationId: registration.registrationId,
    quantity,
    price: unitPrice,
    totalPrice,
    notes: registration.notes,
    status: 'active',
    faceVerified: true
  });

  await EventModel.update(event.eventId, {
    ticketsSold: ticketsSold + quantity
  });

  await UserEventRegistration.findByIdAndUpdate(registration.registrationId, {
    ticketIssued: true,
    ticketIssuedDate: new Date().toISOString(),
    ticketAvailabilityStatus: 'available',
    waitingStatus: 'complete',
    faceVerificationStatus: 'success',
    status: 'verified',
    ticketId: ticket.ticketId
  });

  return { ticket, event }; // include updated event snapshot for callers
};

const issuePendingTicketsForUser = async (userId) => {
  if (!userId) {
    return [];
  }

  try {
    const registrationsForUser = await UserEventRegistration.getByUser(userId);
    const pendingRegistrations = registrationsForUser.filter(
      (registration) => registration && registration.status === 'pending' && !registration.ticketIssued
    );

    if (!pendingRegistrations.length) {
      return [];
    }

    const issuedTickets = [];

    for (const registration of pendingRegistrations) {
      try {
        const result = await issueTicketFromRegistration({ registration, userId });
        if (result && result.ticket) {
          issuedTickets.push(result);
        }
      } catch (error) {
        console.error(
          `Failed to issue ticket for registration ${registration.registrationId}:`,
          error
        );
        await UserEventRegistration.findByIdAndUpdate(registration.registrationId, {
          ticketAvailabilityStatus: 'error',
          waitingStatus: 'queued'
        });
      }
    }

    return issuedTickets;
  } catch (error) {
    console.error(`Failed to issue tickets for user ${userId}:`, error);
    return [];
  }
};

module.exports = {
  issuePendingTicketsForUser
};
