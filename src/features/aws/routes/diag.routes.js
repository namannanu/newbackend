const express = require('express');
const router = express.Router();
const verifyAWSCredentials = require('../../../utils/verify-aws');

// Simple token-based guard using env var
router.get('/diag', async (req, res) => {
  try {
    const supplied = req.query.token || req.headers['x-aws-diag-token'];
    const expected = process.env.AWS_DIAG_TOKEN;

    if (!expected) {
      return res.status(503).json({ success: false, error: 'Diagnostics disabled (missing AWS_DIAG_TOKEN).' });
    }
    if (!supplied || supplied !== expected) {
      return res.status(401).json({ success: false, error: 'Unauthorized diagnostics request.' });
    }

    const result = await verifyAWSCredentials();
    res.json({ success: true, identity: result.identity, tables: result.tables });
  } catch (error) {
    res.status(500).json({ success: false, code: error.code, message: error.message });
  }
});

module.exports = router;

