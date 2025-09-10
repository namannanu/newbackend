const express = require('express');
const organizerController = require('./organizer.controller');

const router = express.Router();

// This endpoint doesn't require authentication
router.get('/', organizerController.getAllOrganizers);

module.exports = router;
