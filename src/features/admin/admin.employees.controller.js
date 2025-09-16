const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const AppError = require('../../shared/utils/appError');
const catchAsync = require('../../shared/utils/catchAsync');

// Initialize DynamoDB
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// GET /api/admin/employees
exports.getAllEmployees = catchAsync(async (req, res, next) => {
  console.log('📊 Getting all employees...');

  try {
    // Verify admin permissions (route is already protected, this is extra safety)
    if (!req.user || req.user.role !== 'admin') {
      console.log('❌ Unauthorized access attempt to get employees list');
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    const params = {
      TableName: 'Users',
      FilterExpression: '#role = :roleValue',
      ExpressionAttributeNames: { '#role': 'role' },
      ExpressionAttributeValues: { ':roleValue': 'employee' }
    };

    console.log('🔍 Scanning Users table with params:', JSON.stringify(params, null, 2));
    const result = await dynamoDB.scan(params).promise();
    const employees = result.Items || [];

    // Remove sensitive information
    const sanitizedEmployees = employees.map((emp) => {
      const { password, ...employeeWithoutPassword } = emp;
      return employeeWithoutPassword;
    });

    console.log(`✅ Found ${sanitizedEmployees.length} employees`);

    res.status(200).json({
      status: 'success',
      results: sanitizedEmployees.length,
      data: { employees: sanitizedEmployees }
    });
  } catch (error) {
    console.error('❌ Error fetching employees:', error);
    return next(new AppError(`Failed to fetch employees: ${error.message}`, 500));
  }
});

// POST /api/admin/employees
exports.createEmployee = catchAsync(async (req, res, next) => {
  console.log('🧑‍💼 Creating employee...');

  try {
    // Verify admin permissions (route is already protected, this is extra safety)
    if (!req.user || req.user.role !== 'admin') {
      console.log('❌ Unauthorized access attempt to create employee');
      return next(new AppError('You do not have permission to perform this action', 403));
    }

    const { fullName, name, username, email, password, phone, permissions, status } = req.body || {};

    // Basic validation
    if (!email || !password) {
      return next(new AppError('Email and password are required', 400));
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    // Check if email already exists (scan since GSI may not exist)
    const existingParams = {
      TableName: 'Users',
      FilterExpression: '#email = :email',
      ExpressionAttributeNames: { '#email': 'email' },
      ExpressionAttributeValues: { ':email': normalizedEmail }
    };
    const existing = await dynamoDB.scan(existingParams).promise();
    if (existing.Items && existing.Items.length > 0) {
      return next(new AppError('Email already in use', 400));
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate userId
    const userId = `emp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

    const timestamp = new Date().toISOString();
    const item = {
      userId,
      fullName: fullName || name || username || null,
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone || null,
      role: 'employee',
      permissions: Array.isArray(permissions) ? permissions : [],
      avatar: null,
      verificationStatus: 'pending',
      aadhaarPhoto: null,
      uploadedPhoto: null,
      lastLogin: null,
      status: status || 'active',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    const putParams = { TableName: 'Users', Item: item };
    await dynamoDB.put(putParams).promise();

    const { password: _hidden, ...safeEmployee } = item;

    res.status(201).json({
      status: 'success',
      data: { employee: safeEmployee }
    });
  } catch (error) {
    console.error('❌ Error creating employee:', error);
    return next(new AppError(`Failed to create employee: ${error.message}`, 500));
  }
});

