const express = require('express');
const registrationController = require('./userEventRegistration.controller');
// Temporarily comment out auth middleware for testing
// const authMiddleware = require('../auth/auth.middleware');
// const adminMiddleware = require('../../shared/middlewares/admin.middleware');

const router = express.Router();

// Temporarily disable auth middleware for testing
// router.use(authMiddleware.protect);

router.route('/')
  .get(registrationController.getAllRegistrations)
  .post(registrationController.createRegistration);

// IMPORTANT: Define specific routes BEFORE parameterized routes
// Get registration statistics (temporarily remove admin requirement for testing)
router.get('/stats', registrationController.getRegistrationStats);

// Get registrations by status
router.get('/status/:status', registrationController.getRegistrationsByStatus);

// Get registrations by event
router.get('/event/:eventId', registrationController.getEventRegistrations);

// Get registrations by user
router.get('/user/:userId', registrationController.getUserRegistrations);

// Parameterized routes come AFTER specific routes
router.route('/:id')
  .get(registrationController.getRegistration)
  .put(registrationController.updateRegistration) // Changed from patch to put
  .delete(registrationController.deleteRegistration);

router.put('/:id/checkin', registrationController.checkInUser); // Changed from patch to put

// Face verification endpoints
router.put('/:id/face-verification/start', registrationController.startFaceVerification); // Updated path and method
router.put('/:id/face-verification/complete', registrationController.completeFaceVerification); // Updated path and method

// Ticket issuance
router.put('/:id/issue-ticket', registrationController.issueTicket); // Changed from patch to put

// Admin override (temporarily remove admin requirement for testing)
router.put('/:id/admin-override', registrationController.adminOverride); // Changed from patch to put, removed admin middleware

module.exports = router;
