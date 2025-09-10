
const catchAsync = require('../../shared/utils/catchAsync');
const AppError = require('../../shared/utils/appError');
const User = require('./user.model');
const { rekognition } = require('../../config/aws-robust');

exports.getAllUsers = catchAsync(async (req, res, next) => {
  // HARD SECURITY CHECK - Check for authorization header
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'fail',
      message: 'Authentication token required. Please provide a valid Bearer token.'
    });
  }

  // Check if the user has admin privileges
  if (!req.user || !req.user.role || !['admin', 'superadmin'].includes(req.user.role)) {
    return res.status(403).json({
      status: 'fail',
      message: 'You do not have permission to perform this action. Admin privileges required.'
    });
  }

  // Log the admin access with headers info for debugging
  console.log(`Admin ${req.user?.userId || 'unknown'} accessed all users list at ${new Date().toISOString()}`);
  console.log('Authorization header:', req.headers.authorization ? 'Exists' : 'Missing');
  
  const users = await User.getAllUsers();

  // Remove password from each user object
  const usersWithoutPassword = users.map(user => {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  });

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: {
      users: usersWithoutPassword
    }
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.get(req.params.id);

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  // Remove password from response
  const { password, ...userWithoutPassword } = user;

  res.status(200).json({
    status: 'success',
    data: {
      user: userWithoutPassword
    }
  });
});

exports.updateUser = catchAsync(async (req, res, next) => {
  // First check if user exists
  const existingUser = await User.get(req.params.id);
  
  if (!existingUser) {
    return next(new AppError('No user found with that ID', 404));
  }

  // Update the user
  const user = await User.update(req.params.id, req.body);

  // Remove password from response
  const { password, ...userWithoutPassword } = user;

  res.status(200).json({
    status: 'success',
    data: {
      user: userWithoutPassword
    }
  });
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  // First check if user exists
  const user = await User.get(req.params.id);
  
  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  // Delete the user
  await User.delete(req.params.id);

  res.status(204).json({
    status: 'success',
    data: null
  });
});

exports.verifyUserFace = catchAsync(async (req, res, next) => {
  const { userId, uploadedPhoto, aadhaarPhoto } = req.body;

  // First check if user exists
  const user = await User.get(userId);
  
  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  const params = {
    SourceImage: {
      S3Object: {
        Bucket: process.env.AWS_S3_BUCKET,
        Name: uploadedPhoto
      }
    },
    TargetImage: {
      S3Object: {
        Bucket: process.env.AWS_S3_BUCKET,
        Name: aadhaarPhoto
      }
    },
    SimilarityThreshold: 90
  };

  try {
    const data = await rekognition.compareFaces(params).promise();
    
    if (data.FaceMatches && data.FaceMatches.length > 0) {
      const similarity = data.FaceMatches[0].Similarity;
      
      if (similarity >= 90) {
        const updatedUser = await User.updateVerificationStatus(
          userId,
          'verified',
          data.FaceMatches[0].Face.FaceId
        );

        // Remove password from response
        const { password, ...userWithoutPassword } = updatedUser;

        return res.status(200).json({
          status: 'success',
          data: {
            user: userWithoutPassword,
            similarity
          }
        });
      }
    }

    res.status(200).json({
      status: 'fail',
      message: 'Faces do not match',
      data: {
        similarity: data.FaceMatches ? data.FaceMatches[0].Similarity : 0
      }
    });
  } catch (err) {
    return next(new AppError('Error verifying face: ' + err.message, 500));
  }
});

exports.getMyProfile = catchAsync(async (req, res, next) => {
  const user = await User.get(req.user.userId);

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Remove password from response
  const { password, ...userWithoutPassword } = user;

  res.status(200).json({
    status: 'success',
    data: {
      user: userWithoutPassword,
      yourPermissions: user.permissions || [],
      yourRole: user.role
    }
  });
});
