// Valid permissions for the system
const VALID_PERMISSIONS = [
  'users',
  'organizers', 
  'events',
  'registrations',
  'feedback',
  'analytics'
];

// Define which roles can grant which permissions
const ROLE_PERMISSION_MAP = {
  'admin': VALID_PERMISSIONS,
  'employee': []
};

/**
 * Validates if the given permissions are valid and if the requesting user can grant them
 * @param {Array} permissions - Array of permission strings to validate
 * @param {Object} user - The user making the request
 * @returns {Object} Validation result
 */
const validatePermissions = (permissions, user) => {
  if (!permissions || !Array.isArray(permissions)) {
    return {
      isValid: true,
      invalidPermissions: [],
      unauthorizedPermissions: [],
      validPermissions: VALID_PERMISSIONS,
      suggestions: []
    };
  }

  const normalizedPermissions = permissions.map(p => p.toLowerCase());
  const userRole = user?.role || 'user';
  const allowedPermissions = ROLE_PERMISSION_MAP[userRole] || [];

  const invalidPermissions = normalizedPermissions.filter(
    permission => !VALID_PERMISSIONS.includes(permission)
  );

  const unauthorizedPermissions = normalizedPermissions.filter(
    permission => VALID_PERMISSIONS.includes(permission) && !allowedPermissions.includes(permission)
  );

  const suggestions = invalidPermissions.map(invalid => {
    const suggestion = VALID_PERMISSIONS.find(valid => 
      valid.includes(invalid) || invalid.includes(valid.split('_')[0])
    );
    return suggestion || null;
  }).filter(Boolean);

  return {
    isValid: invalidPermissions.length === 0 && unauthorizedPermissions.length === 0,
    invalidPermissions,
    unauthorizedPermissions,
    validPermissions: VALID_PERMISSIONS,
    suggestions
  };
};

/**
 * Creates a standardized error response for invalid permissions
 * @param {Array} invalidPermissions - Array of invalid permission strings
 * @param {Array} suggestions - Array of suggested valid permissions
 * @param {Array} validPermissions - Array of all valid permissions
 * @returns {Object} Error response object
 */
const createInvalidPermissionError = (invalidPermissions, suggestions, validPermissions) => {
  return {
    error: 'Invalid permissions provided',
    invalidPermissions,
    suggestions: suggestions.length > 0 ? suggestions : null,
    validPermissions,
    message: `The following permissions are not valid: ${invalidPermissions.join(', ')}. Please use valid permissions from the list.`
  };
};

/**
 * Creates a standardized error response for unauthorized permissions
 * @param {Array} unauthorizedPermissions - Array of unauthorized permission strings
 * @param {Object} user - The user making the request
 * @returns {Object} Error response object
 */
const createUnauthorizedPermissionError = (unauthorizedPermissions, user) => {
  const userRole = user?.role || 'user';
  const allowedPermissions = ROLE_PERMISSION_MAP[userRole] || [];
  
  return {
    error: 'Insufficient permissions',
    unauthorizedPermissions,
    userRole,
    allowedPermissions,
    message: `Your role (${userRole}) does not allow you to grant the following permissions: ${unauthorizedPermissions.join(', ')}.`
  };
};

module.exports = {
  validatePermissions,
  createInvalidPermissionError,
  createUnauthorizedPermissionError,
  VALID_PERMISSIONS,
  ROLE_PERMISSION_MAP
};
