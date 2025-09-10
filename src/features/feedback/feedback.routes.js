const express = require('express');
const feedbackController = require('./feedback.controller');
const authMiddleware = require('../auth/auth.middleware');

const router = express.Router();

router.use(authMiddleware.protect);

router.route('/')
  .get(feedbackController.getAllFeedback)
  .post(feedbackController.createFeedback);

router.route('/:id')
  .get(feedbackController.getFeedback)
  .patch(feedbackController.updateFeedback);

router.patch('/:id/review', feedbackController.markAsReviewed);

module.exports = router;