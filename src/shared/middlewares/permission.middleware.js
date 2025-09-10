const AppError = require('../utils/appError');

module.exports = (requiredPermission) => {
  return (req, res, next) => {
    // Admins have all permissions
    if (req.user.role === 'admin') return next();
    
    // Check if user has the required permission
    if (!req.user.permissions || !req.user.permissions.includes(requiredPermission)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    
    next();
  };
};