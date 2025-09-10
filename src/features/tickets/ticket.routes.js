const express = require('express');
const ticketController = require('./ticket.controller');
const authMiddleware = require('../auth/auth.middleware');

const router = express.Router();

router.use(authMiddleware.protect);

// Get tickets by event - place specific routes before parameterized routes
router.get('/event/:eventId', ticketController.getEventTickets);

router.route('/')
  .get(ticketController.getAllTickets)
  .post(ticketController.createTicket);

router.route('/:id')
  .get(ticketController.getTicket)
  .patch(ticketController.updateTicket);

router.post('/verify', ticketController.verifyTicket);

module.exports = router;