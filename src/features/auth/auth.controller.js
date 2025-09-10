
const catchAsync = require('../../shared/utils/catchAsync');
const authService = require('./auth.service');
const { createSendToken } = require('./auth.service');

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await authService.signup(req.body);
  await createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  const user = await authService.login(email, password);
  await createSendToken(user, 200, res);
});

exports.adminLogin = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  const user = await authService.login(email, password, true);
  await createSendToken(user, 200, res);
});

exports.protect = authService.protect;
exports.restrictTo = authService.restrictTo;
exports.forgotPassword = authService.forgotPassword;
exports.resetPassword = authService.resetPassword;
exports.updatePassword = authService.updatePassword;

// Simple validation endpoint to check if token is valid
exports.validateToken = catchAsync(async (req, res, next) => {
  // If we got here, it means the protect middleware allowed access
  // so the token is valid
  res.status(200).json({
    status: 'success',
    message: 'Token is valid',
    data: {
      user: {
        userId: req.user.userId,
        email: req.user.email,
        role: req.user.role
      }
    }
  });
});
