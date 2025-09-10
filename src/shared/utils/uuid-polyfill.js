// Polyfill for missing UUID stringify function in serverless environments
const crypto = require('crypto');

// Simple UUID v4 generator that doesn't rely on external stringify modules
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Alternative UUID using crypto
function generateCryptoUUID() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return generateUUID();
}

module.exports = {
  v4: generateCryptoUUID,
  generateUUID,
  generateCryptoUUID
};
