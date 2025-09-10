const express = require('express');
const eventController = require('./event.controller');
const authMiddleware = require('../auth/auth.middleware');

const router = express.Router();

router.get('/stats', eventController.getEventStats);

// Public route - no authentication required
router.get('/', eventController.getAllEvents);

// Apply authentication middleware to all routes below this point
router.use(authMiddleware.protect);

router.route('/')
  .post(authMiddleware.restrictTo('admin', 'organizer'), eventController.createEvent);

router.route('/:id')
  .get(eventController.getEvent)
  .patch(authMiddleware.restrictTo('admin', 'organizer'), eventController.updateEvent)
  .delete(authMiddleware.restrictTo('admin'), eventController.deleteEvent);

module.exports = router;