const express = require('express');
const organizerController = require('./organizer.controller');
const authMiddleware = require('../auth/auth.middleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.route('/')
  .get(organizerController.getAllOrganizers)
  .post(authMiddleware.restrictTo('admin'), organizerController.createOrganizer);

router.route('/:id')
  .get(organizerController.getOrganizer)
  .patch(authMiddleware.restrictTo('admin'), organizerController.updateOrganizer)
  .delete(authMiddleware.restrictTo('admin'), organizerController.deleteOrganizer);

module.exports = router;