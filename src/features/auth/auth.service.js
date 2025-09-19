const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { promisify } = require('util');
const { initializeDynamoDB } = require('../../config/config');
const User = require('../users/user.model');
const Admin = require('../admin/admin.model');
const AppError = require('../../shared/utils/appError');
const catchAsync = require('../../shared/utils/catchAsync');
const { sendEmail } = require('../../shared/services/email.service');
const twilioService = require('../../shared/services/twilio.service');
const PhoneOtpModel = require('./phone-otp.model');
const { v4: uuidv4 } = require('uuid');

const signToken = (user) => {
  return jwt.sign(
    { userId: user.userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

const createSendToken = async (user, statusCode, res) => {
  const token = signToken(user);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  };

  res.cookie('jwt', token, cookieOptions);

  // Format lastLogin for better display
  let lastLoginFormatted = null;
  if (user.lastLogin) {
    const now = new Date();
    const timeDiff = now - new Date(user.lastLogin);
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) {
      lastLoginFormatted = 'Today';
    } else if (daysDiff === 1) {
      lastLoginFormatted = 'Yesterday';
    } else {
      lastLoginFormatted = `${daysDiff} days ago`;
    }
  }

  // Check if user has face image in the faceimage table
  console.log(`Checking if user ${user.userId} has face image records`);
  
  

  // Create user response without sensitive data
  const fullName = user.fullName || user.name || user.username || '';
  const username = user.username || null;
  const userResponse = {
    userId: user.userId,
    fullName,
    username,
    email: user.email,
    role: user.role || "user",
    permissions: user.permissions || [],
    verificationStatus: user.verificationStatus || "pending",
    status: user.status || "active",
    uploadedPhoto: user.avatar || user.uploadedPhoto || null,
    aadhaarPhoto: user.aadhaarPhoto || null,
    _id: user.userId,
    createdAt: user.createdAt || new Date().toISOString(),
    updatedAt: user.updatedAt || new Date().toISOString(),
    __v: 0,
    lastLoginFormatted
  };

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user: userResponse
    }
  });
};

exports.createSendToken = createSendToken;

const OTP_PURPOSE = {
  SIGNUP: 'signup',
  LOGIN: 'login'
};

const OTP_TTL_SECONDS = 5 * 60;

const generateOtpCode = () => String(Math.floor(100000 + Math.random() * 900000));

const normalizePhone = (phone) => {
  if (!phone) {
    return null;
  }
  return String(phone).trim();
};

const handleInvalidOtp = async ({ phone, purpose, reason }) => {
  if (reason === 'expired' || reason === 'max_attempts') {
    await PhoneOtpModel.deleteOtp({ phone, purpose });
  } else if (reason === 'mismatch') {
    await PhoneOtpModel.incrementAttempts({ phone, purpose });
  }

  switch (reason) {
    case 'expired':
      throw new AppError('The verification code has expired. Please request a new code.', 400);
    case 'max_attempts':
      throw new AppError('Too many incorrect attempts. Please request a new verification code.', 400);
    case 'mismatch':
    default:
      throw new AppError('Invalid verification code. Please try again.', 400);
  }
};

exports.getUserById = async (userId) => {
  const user = await User.get(userId);
  if (!user) {
    throw new AppError('User not found', 404);
  }
  return user;
};

exports.correctPassword = async (candidatePassword, userPassword) => {
  return await bcrypt.compare(candidatePassword, userPassword);
};

exports.updateUserPassword = async (userId, newPassword) => {
  const hashedPassword = await bcrypt.hash(newPassword, 12);
  await User.update(userId, { 
    password: hashedPassword,
    passwordChangedAt: new Date().toISOString()
  });
};

const signup = async (userObj = {}) => {
  const timestamp = new Date().toISOString();
  const email = userObj.email ? String(userObj.email).toLowerCase() : null;
  const rawUsername = userObj.username;
  const username = rawUsername ? String(rawUsername).trim() : '';
  const fullName = userObj.fullName ? String(userObj.fullName).trim() : '';

  if (!email) {
    throw new AppError('Email is required to register', 400);
  }

  if (!userObj.password) {
    throw new AppError('Password is required to register', 400);
  }

  if (!username) {
    throw new AppError('Username is required to register', 400);
  }

  // Ensure email uniqueness for clearer error responses
  const existingByEmail = await User.findByEmail(email);
  if (existingByEmail) {
    throw new AppError('Email already exists', 400);
  }

  const existingByUsername = await User.findByUsername(username);
  if (existingByUsername) {
    throw new AppError('Username already exists', 400);
  }

  // Hash the password before storing
  const hashedPassword = await bcrypt.hash(userObj.password, 12);

  // Ensure all fields are properly captured
  const userData = {
    ...userObj,
    email,
    username,
    fullName,
    password: hashedPassword, // Use hashed password instead of plain text
    uploadedPhoto: userObj.uploadedPhoto || null,
    verificationStatus: 'pending',
    updatedAt: timestamp,
    createdAt: timestamp
  };

  const newUser = await User.create(userData);
  return newUser;
};


const login = async (identifier, password, isAdminLogin = false) => {
  try {
    // 1) Check if identifier and password exist
    if (!identifier || !password) {
      throw new AppError('Please provide an email/username and password!', 400);
    }

    // 2) Check if user exists
    let user;
    const searchValue = identifier.trim();
    const normalizedSearchValue = searchValue.toLowerCase();
    
    if (isAdminLogin) {
      // Admin login - only check AdminUsers table
      const params = {
        TableName: 'AdminUsers',
        FilterExpression:
          'email = :normalizedIdentifier OR #username = :normalizedIdentifier OR #username = :identifierExact',
        ExpressionAttributeNames: {
          '#username': 'username'
        },
        ExpressionAttributeValues: {
          ':normalizedIdentifier': normalizedSearchValue,
          ':identifierExact': searchValue
        }
      };
    
      console.log('Searching for admin with identifier:', identifier);
      const { documentClient } = await initializeDynamoDB();
      const result = await documentClient.scan(params).promise();
      console.log('Scan result:', JSON.stringify(result, null, 2));
      user = (result.Items || []).find((item) => {
        if (!item) return false;
        const emailMatch = item.email && item.email.toLowerCase() === normalizedSearchValue;
        const usernameMatch = item.username && item.username.toLowerCase() === normalizedSearchValue;
        return emailMatch || usernameMatch;
      });
      
      if (!user) {
        console.log('No admin user found with identifier:', identifier);
        throw new AppError('Invalid email or password', 401);
      }
      console.log('Found admin user:', { ...user, password: '[REDACTED]' });
    } else {
      // Regular user login - try email first, then username
      console.log('Searching for user with identifier:', identifier);
      user = await User.findByEmail(normalizedSearchValue);

      if (!user) {
        user = await User.findByUsername(searchValue);
      }

      if (!user) {
        console.log('No user found with identifier:', identifier);
        throw new AppError('Invalid email or password', 401);
      }

      console.log('Found user:', { ...user, password: '[REDACTED]' });
    }

    // 3) Verify password
    console.log('Comparing password...');
    if (user && user.usernameLower) {
      delete user.usernameLower;
    }
    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    console.log('Password correct:', isPasswordCorrect);
    
    if (!isPasswordCorrect) {
      throw new AppError('Invalid email or password', 401);
    }

    // 4) Update last login
    const timestamp = new Date().toISOString();
    if (isAdminLogin) {
      const { documentClient } = await initializeDynamoDB();
      await documentClient.update({
        TableName: 'AdminUsers',
        Key: { userId: user.userId },
        UpdateExpression: 'SET lastLogin = :timestamp, lastActivity = :timestamp',
        ExpressionAttributeValues: {
          ':timestamp': timestamp
        }
      }).promise();
    } else {
      await User.update(user.userId, {
        lastLogin: timestamp
      });
    }

    // Don't send password in response
    user.password = undefined;
    return user;
  } catch (error) {
    console.error('Login error:', error);
    // Re-throw the error to be caught by the catchAsync wrapper
    throw error;
  }
};

const requestSignupOtp = async ({ phone, username, fullName }) => {
  const normalizedPhone = normalizePhone(phone);
  const trimmedUsername = username ? String(username).trim() : '';
  const trimmedFullName = fullName ? String(fullName).trim() : '';

  if (!normalizedPhone) {
    throw new AppError('Phone number is required', 400);
  }

  if (!trimmedUsername) {
    throw new AppError('Username is required', 400);
  }

  if (!trimmedFullName) {
    throw new AppError('Full name is required', 400);
  }

  const existingPhoneUser = await User.findByPhone(normalizedPhone);
  if (existingPhoneUser) {
    throw new AppError('An account already exists for this phone number.', 400);
  }

  const existingUsername = await User.findByUsername(trimmedUsername);
  if (existingUsername) {
    throw new AppError('Username already exists. Please choose another one.', 400);
  }

  const code = generateOtpCode();

  await PhoneOtpModel.storeOtp({
    phone: normalizedPhone,
    purpose: OTP_PURPOSE.SIGNUP,
    code,
    ttlSeconds: OTP_TTL_SECONDS,
    payload: {
      username: trimmedUsername,
      fullName: trimmedFullName
    }
  });

  await twilioService.sendOtp({ to: normalizedPhone, code });

  return {
    message: 'Verification code sent successfully.'
  };
};

const verifySignupOtp = async ({ phone, code, username, fullName }) => {
  const normalizedPhone = normalizePhone(phone);
  const providedUsername = username ? String(username).trim() : null;
  const providedFullName = fullName ? String(fullName).trim() : null;

  if (!normalizedPhone) {
    throw new AppError('Phone number is required', 400);
  }

  if (!code) {
    throw new AppError('Verification code is required', 400);
  }

  const existingPhoneUser = await User.findByPhone(normalizedPhone);
  if (existingPhoneUser) {
    throw new AppError('An account already exists for this phone number.', 400);
  }

  const otpRecord = await PhoneOtpModel.getOtp({
    phone: normalizedPhone,
    purpose: OTP_PURPOSE.SIGNUP
  });

  const validation = PhoneOtpModel.validateCode(code, otpRecord);
  if (!validation.valid) {
    await handleInvalidOtp({ phone: normalizedPhone, purpose: OTP_PURPOSE.SIGNUP, reason: validation.reason });
  }

  const storedUsername = otpRecord?.payload?.username;
  const storedFullName = otpRecord?.payload?.fullName;

  if (storedUsername && providedUsername && storedUsername !== providedUsername) {
    throw new AppError('Username does not match the original request.', 400);
  }

  const usernameToUse = storedUsername || providedUsername;
  const fullNameToUse = storedFullName || providedFullName || usernameToUse;

  if (!usernameToUse) {
    throw new AppError('Username is required to complete signup.', 400);
  }

  await PhoneOtpModel.deleteOtp({
    phone: normalizedPhone,
    purpose: OTP_PURPOSE.SIGNUP
  });

  const randomPassword = crypto.randomBytes(32).toString('hex');
  const hashedPassword = await bcrypt.hash(randomPassword, 12);
  const userId = uuidv4();

  const userData = {
    userId,
    username: usernameToUse,
    fullName: fullNameToUse,
    phone: normalizedPhone,
    password: hashedPassword,
    phoneVerified: true,
    verificationStatus: 'verified',
    status: 'active'
  };

  const newUser = await User.create(userData);

  newUser.password = undefined;

  return newUser;
};

const requestPhoneLoginOtp = async ({ phone }) => {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    throw new AppError('Phone number is required', 400);
  }

  const user = await User.findByPhone(normalizedPhone);
  if (!user) {
    throw new AppError('No account found with that phone number.', 404);
  }

  const code = generateOtpCode();

  await PhoneOtpModel.storeOtp({
    phone: normalizedPhone,
    purpose: OTP_PURPOSE.LOGIN,
    code,
    ttlSeconds: OTP_TTL_SECONDS,
    payload: {
      userId: user.userId
    }
  });

  await twilioService.sendOtp({ to: normalizedPhone, code });

  return {
    message: 'Verification code sent successfully.'
  };
};

const verifyPhoneLoginOtp = async ({ phone, code }) => {
  const normalizedPhone = normalizePhone(phone);

  if (!normalizedPhone) {
    throw new AppError('Phone number is required', 400);
  }

  if (!code) {
    throw new AppError('Verification code is required', 400);
  }

  const otpRecord = await PhoneOtpModel.getOtp({
    phone: normalizedPhone,
    purpose: OTP_PURPOSE.LOGIN
  });

  const validation = PhoneOtpModel.validateCode(code, otpRecord);
  if (!validation.valid) {
    await handleInvalidOtp({ phone: normalizedPhone, purpose: OTP_PURPOSE.LOGIN, reason: validation.reason });
  }

  await PhoneOtpModel.deleteOtp({
    phone: normalizedPhone,
    purpose: OTP_PURPOSE.LOGIN
  });

  let user = null;
  if (otpRecord?.payload?.userId) {
    user = await User.get(otpRecord.payload.userId);
  }

  if (!user) {
    user = await User.findByPhone(normalizedPhone);
  }

  if (!user) {
    throw new AppError('Account not found. Please sign up first.', 404);
  }

  const timestamp = new Date().toISOString();
  await User.update(user.userId, {
    lastLogin: timestamp,
    phoneVerified: true
  });

  user.phoneVerified = true;
  user.lastLogin = timestamp;
  if (user.password) {
    user.password = undefined;
  }

  return user;
};

const updateLastLogin = async (userId, isAdmin = false) => {
  const timestamp = new Date().toISOString();
  if (isAdmin) {
    const { documentClient } = await initializeDynamoDB();
    await documentClient.update({
      TableName: 'AdminUsers',
      Key: { userId },
      UpdateExpression: 'SET lastLogin = :timestamp, lastActivity = :timestamp',
      ExpressionAttributeValues: {
        ':timestamp': timestamp
      }
    }).promise();
  } else {
    await User.update(userId, {
      lastLogin: timestamp
    });
  }
};

// Export all functions
exports.signup = signup;
exports.login = login;
exports.updateLastLogin = updateLastLogin;
exports.requestSignupOtp = requestSignupOtp;
exports.verifySignupOtp = verifySignupOtp;
exports.requestPhoneLoginOtp = requestPhoneLoginOtp;
exports.verifyPhoneLoginOtp = verifyPhoneLoginOtp;

const protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  // 2) Verification token
  if (!process.env.JWT_SECRET) {
    console.error('JWT secret is not configured');
    return next(new AppError('Authentication service misconfigured', 500));
  }
  let decoded;
  try {
    decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  } catch (e) {
    console.error('JWT verification failed:', e.message);
    return next(new AppError('Invalid or expired token', 401));
  }
  
  console.log(`🔍 Auth Debug: Decoded token:`, { 
    userId: decoded.userId,
    iat: decoded.iat,
    exp: decoded.exp
  });

  // 3) Check if user still exists
  try {
    // First check in regular users table
    let currentUser = await User.get(decoded.userId);
    
    // If not found in users table, check in admin users table
    if (!currentUser) {
      console.log(`🔍 Auth Debug: User not found in Users table, checking Admin table...`);
      currentUser = await Admin.get(decoded.userId);
    }
    
    console.log(`🔍 Auth Debug: User lookup result:`, currentUser ? 'User found' : 'User not found');
    
    if (!currentUser) {
      return next(
        new AppError(
          'The user belonging to this token does no longer exist.',
          401
        )
      );
    }
    
    // 4) Check if user changed password after the token was issued
    if (currentUser.passwordChangedAt && 
        new Date(currentUser.passwordChangedAt).getTime() / 1000 > decoded.iat) {
      return next(
        new AppError('User recently changed password! Please log in again.', 401)
      );
    }

    // GRANT ACCESS TO PROTECTED ROUTE
    req.user = currentUser;
    next();
  } catch (error) {
    console.error('❌ User lookup error:', error);
    return next(
      new AppError(
        'Error verifying user authentication. Please login again.',
        401
      )
    );
  }
});

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
};

const forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on POSTed email
  const user = await User.findByEmail(req.body.email);
  if (!user) {
    return next(new AppError('There is no user with email address.', 404));
  }

  // 2) Generate the random reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  const passwordResetExpires = new Date(
    Date.now() + 10 * 60 * 1000
  ).toISOString();

  // Save the reset token to the user
  await User.update(user.userId, {
    passwordResetToken,
    passwordResetExpires
  });

  // 3) Send it to user's email
  const resetURL = `${req.protocol}://${req.get(
    'host'
  )}/api/v1/users/resetPassword/${resetToken}`;

  const message = `Forgot your password? Submit a PATCH request with your new password and passwordConfirm to: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;

  try {
    await sendEmail({
      email: user.email,
      subject: 'Your password reset token (valid for 10 min)',
      message
    });

    res.status(200).json({
      status: 'success',
      message: 'Token sent to email!'
    });
  } catch (err) {
    // Reset the reset token fields
    await User.update(user.userId, {
      passwordResetToken: null,
      passwordResetExpires: null
    });

    return next(
      new AppError('There was an error sending the email. Try again later!'),
      500
    );
  }
});

const resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get user based on the token
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  // Get user with matching reset token that hasn't expired
  const user = await User.findByResetToken(hashedToken);

  // 2) If token has not expired, and there is user, set the new password
  if (!user || !user.passwordResetExpires || new Date(user.passwordResetExpires) < new Date()) {
    return next(new AppError('Token is invalid or has expired', 400));
  }

  // Hash the new password
  const hashedPassword = await bcrypt.hash(req.body.password, 12);
  
  // Update the user with new password and clear reset token
  await User.update(user.userId, {
    password: hashedPassword,
    passwordResetToken: null,
    passwordResetExpires: null,
    passwordChangedAt: new Date().toISOString()
  });

  // 3) Log the user in, send JWT
  await createSendToken(user, 200, res);
});

const updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection
  const user = await User.get(req.user.userId);

  // 2) Check if POSTed current password is correct
  if (!(await bcrypt.compare(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is wrong.', 401));
  }

  // 3) If so, update password
  const hashedPassword = await bcrypt.hash(req.body.password, 12);
  
  await User.update(user.userId, {
    password: hashedPassword,
    passwordChangedAt: new Date().toISOString()
  });

  // 4) Log user in, send JWT
  await createSendToken(user, 200, res);
});

module.exports = {
  signup,
  login,
  protect,
  restrictTo,
  createSendToken,
  forgotPassword,
  resetPassword,
  updatePassword,
  updateLastLogin,
  requestSignupOtp,
  verifySignupOtp,
  requestPhoneLoginOtp,
  verifyPhoneLoginOtp
};
