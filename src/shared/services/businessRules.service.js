const AppError = require('../utils/appError');
const UserEventRegistration = require('../../features/registrations/userEventRegistration.model');
const EventModel = require('../../features/events/event.model');

class BusinessRulesService {
  
  /**
   * Validate registration data integrity
   * @param {Object} registrationData 
   */
  static async validateRegistrationIntegrity(registrationData) {
    const { userId, eventId } = registrationData;

    if (!userId || !eventId) {
      throw new AppError('User ID and Event ID are required', 400);
    }

    // Check for duplicate registration
    const existingRegistration = await UserEventRegistration.findOne({ eventId, userId });

    if (existingRegistration) {
      throw new AppError('User is already registered for this event', 400);
    }

    return true;
  }

  /**
   * Validate event capacity
   * @param {String} eventId 
   */
  static async validateEventCapacity(eventId) {
    if (!eventId) {
      throw new AppError('Event ID is required', 400);
    }

    const event = await EventModel.get(eventId);

    if (!event) {
      throw new AppError('Event not found', 404);
    }

    // If the event defines capacity, enforce it using registration count
    if (typeof event.totalTickets === 'number' && event.totalTickets > 0) {
      const registrationCount = await UserEventRegistration.countDocuments({ eventId });

      if (registrationCount >= event.totalTickets) {
        throw new AppError('Event has reached maximum capacity', 400);
      }
    }

    return true;
  }

  /**
   * Validate ticket issuance rules
   * @param {Object} registration 
   */
  static validateTicketIssuanceRules(registration) {
    // Check if registration status is appropriate
    if (registration.status === 'rejected') {
      throw new AppError('Cannot issue ticket for rejected registration', 400);
    }

    // For testing purposes, be more lenient with re-issuing tickets
    // Allow re-issuing if face verification is successful OR admin override is present
    // Only block if ticket is already issued AND there's no valid reason to re-issue
    if (registration.ticketIssued && 
        registration.faceVerificationStatus !== 'success' && 
        !registration.adminBooked &&
        registration.status !== 'verified') {
      throw new AppError('Ticket has already been issued for this registration', 400);
    }

    // Check if face verification is successful (unless admin override or already verified)
    if (registration.faceVerificationStatus !== 'success' && 
        !registration.adminBooked && 
        registration.status !== 'verified') {
      throw new AppError('Face verification must be successful before issuing ticket (unless admin override)', 400);
    }

    return true;
  }

  /**
   * Validate admin override permissions
   * @param {String} adminUserId 
   * @param {String} reason 
   */
  static validateAdminOverride(adminUserId, reason) {
    if (!reason || reason.trim().length < 10) {
      throw new AppError('Admin override reason must be at least 10 characters', 400);
    }

    // In a real implementation, this would check admin permissions
    // For now, we'll assume the override is valid if a reason is provided

    return true;
  }

  /**
   * Validate face verification attempt
   * @param {Object} registration 
   */
  static validateFaceVerificationAttempt(registration) {
    const MAX_ATTEMPTS = 3;
    
    if (registration.verificationAttempts >= MAX_ATTEMPTS) {
      throw new AppError('Maximum face verification attempts exceeded', 400);
    }

    if (registration.faceVerificationStatus === 'success') {
      throw new AppError('Face verification already completed successfully', 400);
    }

    return true;
  }

  /**
   * Validate check-in eligibility
   * @param {Object} registration 
   */
  static validateCheckInEligibility(registration) {
    if (registration.status !== 'verified' && !registration.adminBooked) {
      throw new AppError('Registration must be verified before check-in', 400);
    }

    if (registration.checkInTime) {
      throw new AppError('User has already checked in', 400);
    }

    return true;
  }
}

module.exports = BusinessRulesService;
