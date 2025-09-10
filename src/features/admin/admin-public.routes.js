const express = require('express');
const adminController = require('./admin.controller');

const router = express.Router();

// Public admin registration endpoint
router.post('/register', adminController.registerAdmin);

module.exports = router;