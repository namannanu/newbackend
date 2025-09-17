
const catchAsync = require('../../shared/utils/catchAsync');
const AppError = require('../../shared/utils/appError');
const UserModel = require('../users/user.model');
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


// Remove face data from a user
exports.checkFaceId = catchAsync(async (req, res, next) => {
  try {
    const userId = req.params.userId || req.query.userId || req.body.userId;

    if (!userId) {
      return next(new AppError('User ID is required', 400));
    }

    // First check if user exists
    const user = await UserModel.get(userId);

    if (!user) {
      return next(new AppError(`No user found with ID: ${userId}`, 404));
    }

    // Check if user has face image entries in faceimage table
    const hasFaceImage = await UserModel.hasFaceImageForUser(userId);

    if (!hasFaceImage) {
      return res.status(200).json({
        status: 'success',
        message: 'User has no face image data to remove',
        data: {
          user: {
            userId: user.userId,
            fullName: user.fullName,
            email: user.email,
            hasFaceImage: false,
            verificationStatus: user.verificationStatus
          }
        }
      });
    }

    // Log the action for audit purposes
    console.log(
      `Admin ${req.user?.userId || 'unknown'} checked face data for user ${userId} at ${new Date().toISOString()}`
    );

    res.status(200).json({
      status: 'success',
      message: 'User has face image data that requires manual removal from faceimage table',
      data: {
        user: {
          userId: user.userId,
          fullName: user.fullName,
          email: user.email,
          hasFaceImage: true,
          verificationStatus: user.verificationStatus
        }
      }
    });
  } catch (error) {
    console.error(`Error checking face data: ${error.message}`);
    return next(new AppError('Failed to check face data', 500));
  }
});

