const authController = require('./auth.controller'); // Removed space after ./
const AppError = require('../../shared/utils/appError');

exports.protect = authController.protect;
exports.restrictTo = authController.restrictTo;

exports.checkPermissions = (requiredPermission) => {
  return (req, _res, next) => {
    if (req.user.role === 'admin') return next();
    
    if (!req.user.permissions || !req.user.permissions.includes(requiredPermission)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };
};

exports.verifyAdminToken = (req, res, next) => {
  // Check if we have a user from the protect middleware
  if (!req.user) {
    return next(new AppError('You are not logged in! Please log in to get access.', 401));
  }
  
  // Verify admin role
  if (!req.user.role || !['admin', 'superadmin'].includes(req.user.role)) {
    return next(new AppError('This route is restricted to admin users only.', 403));
  }
  
  // Log admin access
  console.log(`Admin ${req.user.userId} accessed route ${req.originalUrl} at ${new Date().toISOString()}`);
  
  next();
};