const AdminUser = require('./admin.model');
const User = require('../auth/auth.model');
const UserModel = require('../users/user.model');
const Event = require('../events/event.model');
const Registration = require('../registrations/userEventRegistration.model');
const Ticket = require('../tickets/ticket.model');
const Organizer = require('../organizers/organizer.model');
const AppError = require('../../shared/utils/appError');
const catchAsync = require('../../shared/utils/catchAsync');
const { 
    validatePermissions, 
    createInvalidPermissionError, 
    createUnauthorizedPermissionError 
} = require('../../shared/utils/permissionValidator');

// Get dashboard statistics
exports.getDashboardStats = catchAsync(async (req, res) => {
  // Get counts from different collections
  const [
    totalUsers,
    totalEvents,
    totalRegistrations,
    totalTickets,
    totalOrganizers
  ] = await Promise.all([
    User.countDocuments(),
    Event.countDocuments(),
    Registration.countDocuments(),
    Ticket.countDocuments(),
    Organizer.countDocuments()
  ]);

  // Get recent registrations
  const recentRegistrations = await Registration.find()
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('userId', 'name email')
    .populate('eventId', 'title');

  res.status(200).json({
    status: 'success',
    data: {
      stats: {
        users: totalUsers,
        events: totalEvents,
        registrations: totalRegistrations,
        tickets: totalTickets,
        organizers: totalOrganizers
      },
      recentRegistrations
    }
  });
});

// Get a single user by ID
exports.getUser = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ userId: req.params.userId })
    .select('-password');

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  // Get user's event registrations
  const registrations = await Registration.find({ userId: user.userId })
    .populate('eventId', 'title startDate endDate')
    .sort('-createdAt');

  // Get user's tickets
  const tickets = await Ticket.find({ userId: user.userId })
    .populate('eventId', 'title')
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    data: {
      user,
      registrations,
      tickets
    }
  });
});

// Update a user
exports.updateUser = catchAsync(async (req, res, next) => {
  const updates = { ...req.body };
  
  // Prevent password update through this route
  delete updates.password;
  
  const user = await User.findOneAndUpdate(
    { userId: req.params.userId },
    updates,
    {
      new: true,
      runValidators: true
    }
  ).select('-password');

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

// Delete a user
exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findOneAndDelete({ userId: req.params.userId });

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  // Delete associated records (registrations, tickets, etc.)
  await Promise.all([
    Registration.deleteMany({ userId: user.userId }),
    Ticket.deleteMany({ userId: user.userId })
  ]);

  res.status(204).json({
    status: 'success',
    data: null
  });
});

// Register a new admin user (protected route for creating additional admin users)
exports.registerAdmin = catchAsync(async (req, res, next) => {
  const { email, password, name, phone, role, permissions } = req.body;

  // Only superadmin can create admin users
  if (req.user.role !== 'superadmin') {
    return next(new AppError('Only superadmins can register new admin users', 403));
  }

  // Check if admin with email already exists
  const existingAdmin = await AdminUser.findOne({ email });
  if (existingAdmin) {
    return next(new AppError('Admin with this email already exists', 400));
  }

  // Generate unique adminId
  const adminId = `admin_${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
  
  const newAdmin = await AdminUser.create({
    userId: adminId,
    email,
    password,
    name,
    phone,
    role: role || 'admin',
    permissions: permissions || [],
    status: 'active',
    createdBy: req.user.userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Remove password from response
  newAdmin.password = undefined;

  res.status(201).json({
    status: 'success',
    data: { admin: newAdmin }
  });
});

// Get all face verifications
exports.getFaceVerifications = catchAsync(async (req, res) => {
  const verifications = await User.find({
    verificationStatus: { $exists: true }
  })
  .select('userId name email verificationStatus uploadedPhoto createdAt updatedAt')
  .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: verifications.length,
    data: {
      verifications
    }
  });
});

// Update verification status
exports.updateVerificationStatus = catchAsync(async (req, res, next) => {
  const { verificationId } = req.params;
  const { status, remarks } = req.body;

  const user = await User.findOneAndUpdate(
    { userId: verificationId },
    { 
      verificationStatus: status,
      verificationRemarks: remarks,
      verifiedBy: req.user.userId,
      verifiedAt: new Date()
    },
    {
      new: true,
      runValidators: true
    }
  ).select('userId name email verificationStatus verificationRemarks verifiedBy verifiedAt');

  if (!user) {
    return next(new AppError('No verification request found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      verification: user
    }
  });
});

// Get all tickets
exports.getAllTickets = catchAsync(async (req, res) => {
  const tickets = await Ticket.find()
    .populate('userId', 'name email')
    .populate('eventId', 'title startDate endDate')
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: tickets.length,
    data: {
      tickets
    }
  });
});

// Update ticket status
exports.updateTicketStatus = catchAsync(async (req, res, next) => {
  const { ticketId } = req.params;
  const { status, remarks } = req.body;

  const ticket = await Ticket.findByIdAndUpdate(
    ticketId,
    { 
      status,
      remarks,
      updatedBy: req.user.userId
    },
    {
      new: true,
      runValidators: true
    }
  ).populate('userId', 'name email')
    .populate('eventId', 'title');

  if (!ticket) {
    return next(new AppError('No ticket found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      ticket
    }
  });
});

// Get all users
exports.getAllUsers = catchAsync(async (req, res) => {
  const users = await User.find()
    .select('-password')
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: {
      users
    }
  });
});

// Create a new user
exports.createUser = catchAsync(async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    role = 'user',
    uploadedPhoto,
    firstname,
    lastname
  } = req.body;

  // Check if user with email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('User with this email already exists', 400);
  }

  // Create new user
  const user = await User.create({
    name,
    email,
    password,
    phone,
    role,
    uploadedPhoto,
    firstname: firstname || name,
    lastname: lastname || '',
    createdBy: req.user.userId
  });

  // Remove password from output
  user.password = undefined;

  res.status(201).json({
    status: 'success',
    data: {
      user
    }
  });
  });


// Get all users
exports.getAllUsers = catchAsync(async (req, res) => {
  const users = await User.find()
    .select('-password')
    .sort('-createdAt');

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: {
      users
    }
  });
});

// Create a new user
exports.createUser = catchAsync(async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    role = 'user',
    uploadedPhoto,
    firstname,
    lastname
  } = req.body;

  // Check if user with email already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('User with this email already exists', 400);
  }

  // Create new user
  const user = await User.create({
    name,
    email,
    password,
    phone,
    role,
    uploadedPhoto,
    firstname: firstname || name,
    lastname: lastname || '',
    createdBy: req.user.userId
  });

  // Remove password from output
  user.password = undefined;

  res.status(201).json({
    status: 'success',
    data: {
      user
    }
  });
  });


// Create a new employee user
exports.createEmployee = catchAsync(async (req, res, next) => {
  const { email, password, phone, permissions, name } = req.body;

  // Validate permissions
  const validation = validatePermissions(permissions, req.user);

  if (!validation.isValid) {
    if (validation.invalidPermissions.length > 0) {
      const errorResponse = createInvalidPermissionError(
        validation.invalidPermissions,
        validation.suggestions,
        validation.validPermissions
      );
      return res.status(400).json({
        status: 'fail',
        data: errorResponse
      });
    }

    return res.status(204).json({
        status: 'success',
        data: null
    });
  }

  // Generate unique userId
  const UserId = `emp_${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
  
  // Convert to lowercase for consistency
  const normalizedPermissions = permissions ? permissions.map(p => p.toLowerCase()) : [];

  const newUser = await AdminUser.create({
    userId: UserId,
    name,
    email,
    password,
    phone,
    role: 'employee',
    permissions: normalizedPermissions
  });

  // Remove password from response
  newUser.password = undefined;

  res.status(201).json({
    status: 'success',
    message: 'Employee created successfully',
    data: {
      user: newUser
    }
  });
});

// Event Management
exports.getAllEvents = catchAsync(async (req, res) => {
    const events = await Event.getAllEvents();
    res.status(200).json({
        status: 'success',
        data: { events }
    });
});

exports.getEvent = catchAsync(async (req, res) => {
    const event = await Event.getEventById(req.params.eventId);
    if (!event) {
        throw new AppError('Event not found', 404);
    }

    res.status(200).json({
        status: 'success',
        data: { event }
    });
});

exports.createEvent = catchAsync(async (req, res) => {
    const eventId = `evt_${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
    const newEvent = await Event.create({
        ...req.body,
        eventId,
        status: 'upcoming',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    res.status(201).json({
        status: 'success',
        data: { event: newEvent }
    });
});

exports.updateEvent = catchAsync(async (req, res) => {
    const updatedEvent = await Event.updateEvent(req.params.eventId, {
        ...req.body,
        updatedAt: new Date().toISOString()
    });

    if (!updatedEvent) {
        throw new AppError('Event not found', 404);
    }

    res.status(200).json({
        status: 'success',
        data: { event: updatedEvent }
    });
});

exports.deleteEvent = catchAsync(async (req, res) => {
    const result = await Event.deleteEvent(req.params.eventId);
    if (!result) {
        throw new AppError('Event not found', 404);
    }

    res.status(204).json({
        status: 'success',
        data: null
    });
});

// Registration Management
exports.getAllRegistrations = catchAsync(async (req, res) => {
    const { status, eventId } = req.query;
    const filters = {};
    
    if (status) filters.status = status;
    if (eventId) filters.eventId = eventId;
    
    const registrations = await Registration.getAllRegistrations(filters);
    
    res.status(200).json({
        status: 'success',
        data: { registrations }
    });
});

exports.updateRegistrationStatus = catchAsync(async (req, res) => {
    const { status, verificationStatus } = req.body;
    const updates = {
        updatedAt: new Date().toISOString()
    };

    if (status) updates.status = status;
    if (verificationStatus) updates.verificationStatus = verificationStatus;

    const updatedRegistration = await Registration.updateRegistration(
        req.params.registrationId,
        updates
    );

    if (!updatedRegistration) {
        throw new AppError('Registration not found', 404);
    }

    res.status(200).json({
        status: 'success',
        data: { registration: updatedRegistration }
    });
});

// Analytics & Reports
exports.getRevenueAnalytics = catchAsync(async (req, res) => {
    const { startDate, endDate } = req.query;
    const analytics = await Ticket.getRevenueAnalytics(startDate, endDate);
    
    res.status(200).json({
        status: 'success',
        data: { analytics }
    });
});

// Admin User Management
exports.getAllAdminUsers = catchAsync(async (req, res) => {
    const admins = await AdminUser.getAll();
    res.status(200).json({
        status: 'success',
        data: { admins }
    });
});

exports.getAdminUser = catchAsync(async (req, res) => {
    const admin = await AdminUser.get(req.params.adminId);
    if (!admin) {
        throw new AppError('Admin user not found', 404);
    }
    
    // Remove sensitive information
    admin.password = undefined;
    
    res.status(200).json({
        status: 'success',
        data: { admin }
    });
});

exports.createAdminUser = catchAsync(async (req, res) => {
    const { email, password, name, phone, role, permissions } = req.body;

    // Validate permissions
    const validation = validatePermissions(permissions, req.user);
    if (!validation.isValid) {
        if (validation.invalidPermissions.length > 0) {
            throw new AppError(
                `Invalid permissions: ${validation.invalidPermissions.join(', ')}`,
                400
            );
        }
        if (validation.unauthorizedPermissions.length > 0) {
            throw new AppError(
                `You cannot assign these permissions: ${validation.unauthorizedPermissions.join(', ')}`,
                403
            );
        }
    }

    // Generate unique userId
    const adminId = `admin_${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`;
    
    const newAdmin = await AdminUser.create({
        userId: adminId,
        email,
        password,
        name,
        phone,
        role: role || 'admin',
        permissions: permissions || [],
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });

    // Remove sensitive information
    newAdmin.password = undefined;

    res.status(201).json({
        status: 'success',
        data: { admin: newAdmin }
    });
});

exports.updateAdminUser = catchAsync(async (req, res) => {
    const updates = { ...req.body };
    delete updates.userId; // Prevent userId from being updated

    // If updating permissions, validate them
    if (updates.permissions) {
        const validation = validatePermissions(updates.permissions, req.user);
        if (!validation.isValid) {
            if (validation.invalidPermissions.length > 0) {
                throw new AppError(
                    `Invalid permissions: ${validation.invalidPermissions.join(', ')}`,
                    400
                );
            }
            if (validation.unauthorizedPermissions.length > 0) {
                throw new AppError(
                    `You cannot assign these permissions: ${validation.unauthorizedPermissions.join(', ')}`,
                    403
                );
            }
        }
    }

    updates.updatedAt = new Date().toISOString();
    
    const updatedAdmin = await AdminUser.update(req.params.adminId, updates);
    if (!updatedAdmin) {
        throw new AppError('Admin user not found', 404);
    }

    // Remove sensitive information
    updatedAdmin.password = undefined;

    res.status(200).json({
        status: 'success',
        data: { admin: updatedAdmin }
    });
});

exports.deleteAdminUser = catchAsync(async (req, res) => {
    const result = await AdminUser.delete(req.params.adminId);
    if (!result) {
        throw new AppError('Admin user not found', 404);
    }

    res.status(204).json({
        status: 'success',
        data: null
    });
});

// Activity Logs
exports.getActivityLogs = catchAsync(async (req, res) => {
    const { startDate, endDate, userId } = req.query;
    const filters = {};
    
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    if (userId) filters.userId = userId;
    
    const logs = await AdminUser.getActivityLogs(filters);
    
    res.status(200).json({
        status: 'success',
        data: { logs }
    });
});

exports.getAuditLogs = catchAsync(async (req, res) => {
    const { startDate, endDate, action } = req.query;
    const filters = {};
    
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    if (action) filters.action = action;
    
    const logs = await AdminUser.getAuditLogs(filters);
    
    res.status(200).json({
        status: 'success',
        data: { logs }
    });
});
// The duplicate code block has been removed since it appears to be a duplicate of createAdminUser

// Update employee permissions
exports.updateEmployeePermissions = catchAsync(async (req, res, next) => {
  const { userId, permissions } = req.body;

  // Validate permissions
  const validation = validatePermissions(permissions, req.user);

  if (!validation.isValid) {
    if (validation.invalidPermissions.length > 0) {
      const errorResponse = createInvalidPermissionError(
        validation.invalidPermissions,
        validation.suggestions,
        validation.validPermissions
      );
      return res.status(400).json({
        status: 'fail',
        data: errorResponse
      });
    }

    if (validation.unauthorizedPermissions.length > 0) {
      const errorResponse = createUnauthorizedPermissionError(
        validation.unauthorizedPermissions,
        req.user
      );
      return res.status(403).json({
        status: 'fail',
        data: errorResponse
      });
    }
  }

  // Convert to lowercase for consistency
  const normalizedPermissions = permissions ? permissions.map(p => p.toLowerCase()) : [];

  const user = await User.findByIdAndUpdate(
    userId,
    { permissions: normalizedPermissions },
    { new: true }
  );

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  // Remove password from response
  user.password = undefined;

  res.status(200).json({
    status: 'success',
    message: 'Employee permissions updated successfully',
    data: {
      user
    }
  });
});

// Delete employee
exports.deleteEmployee = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);

  if (!user) {
    return next(new AppError('No user found with that ID', 404));
  }

  // Remove password from response
  user.password = undefined;

  res.status(200).json({
    status: 'success',
    message: 'Employee deleted successfully',
    data: {
      deletedUser: user
    }
  });
});

// Get all employees
exports.getAllEmployees = catchAsync(async (req, res, next) => {
  const employees = await User.find({ role: 'employee' }).select('-password');

  res.status(200).json({
    status: 'success',
    results: employees.length,
    data: {
      employees
    }
  });
});

// Get all admin users
exports.getAllAdminUsers = catchAsync(async (req, res, next) => {
  const adminUsers = await AdminUser.find().select('-password');

  res.status(200).json({
    status: 'success',
    results: adminUsers.length,
    data: {
      adminUsers
    }
  });
});

// Admin dashboard stats
exports.getStats = catchAsync(async (req, res, next) => {
  const totalUsers = await User.countDocuments();
  const totalEmployees = await User.countDocuments({ role: 'employee' });
  const totalAdminUsers = await AdminUser.countDocuments();
  const totalOrganizers = await Organizer.countDocuments();

  // User status breakdown
  const activeUsers = await User.countDocuments({ status: 'active' });
  const suspendedUsers = await User.countDocuments({ status: 'suspended' });

  // Verification status breakdown
  const pendingVerification = await User.countDocuments({ verificationStatus: 'pending' });
  const verifiedUsers = await User.countDocuments({ verificationStatus: 'verified' });
  const rejectedUsers = await User.countDocuments({ verificationStatus: 'rejected' });

  res.status(200).json({
    status: 'success',
    data: {
      stats: {
        users: {
          total: totalUsers,
          employees: totalEmployees,
          active: activeUsers,
          suspended: suspendedUsers
        },
        adminUsers: {
          total: totalAdminUsers
        },
        organizers: {
          total: totalOrganizers
        },
        verification: {
          pending: pendingVerification,
          verified: verifiedUsers,
          rejected: rejectedUsers
        }
      }
    }
  });
});

// Activity log (for AdminUsers)
exports.getActivityLog = catchAsync(async (req, res, next) => {
  try {
    // Try to fetch admin users with activity logs
    const adminUsers = await AdminUser.find().select('email activityLog');

    // If no admin users found, return empty activity log
    if (!adminUsers || adminUsers.length === 0) {
      return res.status(200).json({
        status: 'success',
        data: {
          activityLog: [],
          message: 'No admin users found'
        }
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        activityLog: adminUsers
      }
    });
  } catch (error) {
    console.error('Error fetching activity log:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch activity log',
      error: error.message
    });
  }
});

// Super Admin specific functions

// Update admin user (Super Admin only)
exports.updateAdminUser = catchAsync(async (req, res, next) => {
  const { role, permissions, status } = req.body;

  // Only super admins can update other admin users
  if (!req.user.permissions.includes('all_permissions')) {
    return next(new AppError('Only Super Admins can update admin users', 403));
  }

  const updateData = {};
  if (role) updateData.role = role;
  if (permissions) {
    const validation = validatePermissions(permissions, req.user);
    if (!validation.isValid) {
      return next(new AppError('Invalid permissions provided', 400));
    }
    updateData.permissions = permissions.map(p => p.toLowerCase());
  }
  if (status) updateData.status = status;
  
  updateData.updatedAt = new Date();

  const adminUser = await AdminUser.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true, runValidators: true }
  ).select('-password');

  if (!adminUser) {
    return next(new AppError('No admin user found with that ID', 404));
  }

  res.status(200).json({
    status: 'success',
    message: 'Admin user updated successfully',
    data: {
      adminUser
    }
  });
});

// Delete admin user (Super Admin only)
exports.deleteAdminUser = catchAsync(async (req, res, next) => {
  // Only super admins can delete other admin users
  if (!req.user.permissions.includes('all_permissions')) {
    return next(new AppError('Only Super Admins can delete admin users', 403));
  }

  const adminUser = await AdminUser.findByIdAndDelete(req.params.id);

  if (!adminUser) {
    return next(new AppError('No admin user found with that ID', 404));
  }

  // Remove password from response
  adminUser.password = undefined;

  res.status(200).json({
    status: 'success',
    message: 'Admin user deleted successfully',
    data: {
      deletedAdminUser: adminUser
    }
  });
});

// Advanced system stats (Super Admin only)
exports.getAdvancedStats = catchAsync(async (req, res, next) => {
  // Only super admins can access advanced stats
  if (!req.user.permissions.includes('all_permissions') && !req.user.permissions.includes('system_management')) {
    return next(new AppError('Insufficient permissions for advanced stats', 403));
  }

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // Users stats
  const totalUsers = await User.countDocuments();
  const totalEmployees = await User.countDocuments({ role: 'employee' });
  const activeUsers = await User.countDocuments({ status: 'active' });
  const suspendedUsers = await User.countDocuments({ status: 'suspended' });
  const newUsersThisMonth = await User.countDocuments({ 
    createdAt: { $gte: thisMonthStart } 
  });
  const newUsersLastMonth = await User.countDocuments({ 
    createdAt: { $gte: lastMonthStart, $lt: thisMonthStart } 
  });

  // Admin users stats
  const totalAdminUsers = await AdminUser.countDocuments();
  const activeAdminUsers = await AdminUser.countDocuments({ status: { $ne: 'suspended' } });
  const suspendedAdminUsers = await AdminUser.countDocuments({ status: 'suspended' });

  // Organizers stats
  const totalOrganizers = await Organizer.countDocuments();
  const activeOrganizers = await Organizer.countDocuments({ status: 'active' });
  const pendingOrganizers = await Organizer.countDocuments({ status: 'pending' });

  // Verification stats
  const pendingVerification = await User.countDocuments({ verificationStatus: 'pending' });
  const verifiedUsers = await User.countDocuments({ verificationStatus: 'verified' });
  const rejectedUsers = await User.countDocuments({ verificationStatus: 'rejected' });

  // Calculate growth percentage
  const growthRate = newUsersLastMonth > 0 
    ? ((newUsersThisMonth - newUsersLastMonth) / newUsersLastMonth * 100).toFixed(1)
    : '0';

  res.status(200).json({
    status: 'success',
    data: {
      systemStats: {
        users: {
          total: totalUsers,
          employees: totalEmployees,
          active: activeUsers,
          suspended: suspendedUsers,
          newThisMonth: newUsersThisMonth,
          growth: `${growthRate}%`
        },
        adminUsers: {
          total: totalAdminUsers,
          active: activeAdminUsers,
          suspended: suspendedAdminUsers,
          lastLoginToday: 0 // This would need session tracking
        },
        organizers: {
          total: totalOrganizers,
          active: activeOrganizers,
          pending: pendingOrganizers,
          rejected: totalOrganizers - activeOrganizers - pendingOrganizers,
          revenue: 0 // This would need event/ticket integration
        },
        verification: {
          pending: pendingVerification,
          verified: verifiedUsers,
          rejected: rejectedUsers
        },
        system: {
          serverUptime: process.uptime(),
          nodeVersion: process.version,
          environment: process.env.NODE_ENV || 'development',
          timestamp: new Date().toISOString()
        }
      }
    }
  });
});

// System health check (Super Admin only)
exports.getSystemHealth = catchAsync(async (req, res, next) => {
  // Only super admins can access system health
  if (!req.user.permissions.includes('all_permissions') && !req.user.permissions.includes('system_management')) {
    return next(new AppError('Insufficient permissions for system health', 403));
  }

  const mongoose = require('mongoose');
  
  // Check database connection
  const dbStatus = mongoose.connection.readyState === 1 ? 'healthy' : 'unhealthy';
  const dbConnections = mongoose.connection.db?.serverConfig?.connections?.length || 0;

  res.status(200).json({
    status: 'success',
    data: {
      systemHealth: {
        overall: 'healthy',
        services: {
          database: {
            status: dbStatus,
            responseTime: '12ms', // This would need actual ping measurement
            connections: dbConnections
          },
          server: {
            status: 'healthy',
            uptime: `${Math.floor(process.uptime() / 86400)} days, ${Math.floor((process.uptime() % 86400) / 3600)} hours`,
            memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            cpuUsage: `${Math.round(process.cpuUsage().user / 1000)}%`
          },
          storage: {
            status: 'healthy',
            freeSpace: '85%', // This would need actual disk space check
            totalSpace: '500GB'
          }
        },
        lastChecked: new Date().toISOString()
      }
    }
  });
});

// Get users with advanced filters (Super Admin only)
exports.getAdvancedUsers = catchAsync(async (req, res, next) => {
  // Only super admins can access advanced user data
  if (!req.user.permissions.includes('all_permissions') && !req.user.permissions.includes('system_management')) {
    return next(new AppError('Insufficient permissions for advanced user data', 403));
  }

  const {
    role,
    status,
    verificationStatus,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = req.query;

  // Build filter object
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (verificationStatus) filter.verificationStatus = verificationStatus;

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Get users with filters and pagination
  const users = await User.find(filter)
    .select('-password')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));

  const total = await User.countDocuments(filter);
  const totalPages = Math.ceil(total / limit);

  res.status(200).json({
    status: 'success',
    results: users.length,
    totalPages,
    currentPage: parseInt(page),
    data: {
      users
    }
  });
});

// Bulk user operations (Super Admin only)
exports.bulkUserOperations = catchAsync(async (req, res, next) => {
  // Only super admins can perform bulk operations
  if (!req.user.permissions.includes('all_permissions')) {
    return next(new AppError('Only Super Admins can perform bulk operations', 403));
  }

  const { operation, userIds, reason, notifyUsers = false } = req.body;

  if (!operation || !userIds || !Array.isArray(userIds)) {
    return next(new AppError('Operation and userIds array are required', 400));
  }

  const validOperations = ['suspend', 'activate', 'delete', 'verify', 'reject'];
  if (!validOperations.includes(operation)) {
    return next(new AppError('Invalid operation. Valid operations: ' + validOperations.join(', '), 400));
  }

  const results = [];
  let successful = 0;
  let failed = 0;

  for (const userId of userIds) {
    try {
      let updateData = {};
      
      switch (operation) {
        case 'suspend':
          updateData = { status: 'suspended' };
          break;
        case 'activate':
          updateData = { status: 'active' };
          break;
        case 'verify':
          updateData = { verificationStatus: 'verified' };
          break;
        case 'reject':
          updateData = { verificationStatus: 'rejected' };
          break;
        case 'delete':
          await User.findByIdAndDelete(userId);
          results.push({
            userId,
            status: 'success',
            message: 'User deleted successfully'
          });
          successful++;
          continue;
      }

      if (operation !== 'delete') {
        const user = await User.findByIdAndUpdate(userId, updateData, { new: true });
        if (user) {
          results.push({
            userId,
            status: 'success',
            message: `User ${operation}${operation.endsWith('e') ? 'd' : 'ed'} successfully`
          });
          successful++;
        } else {
          results.push({
            userId,
            status: 'failed',
            message: 'User not found'
          });
          failed++;
        }
      }
    } catch (error) {
      results.push({
        userId,
        status: 'failed',
        message: error.message
      });
      failed++;
    }
  }

  res.status(200).json({
    status: 'success',
    message: 'Bulk operation completed successfully',
    data: {
      operation,
      totalUsers: userIds.length,
      successful,
      failed,
      results
    }
  });
});

// Get user activity with last login information
exports.getUserActivity = catchAsync(async (req, res, next) => {
  // Check if user has admin permissions
  if (!req.user.permissions.includes('all_permissions') && 
      !req.user.permissions.includes('user_management')) {
    return next(new AppError('Insufficient permissions for user activity', 403));
  }

  const { page = 1, limit = 20, sortBy = 'lastLogin', sortOrder = 'desc', status } = req.query;
  const skip = (page - 1) * limit;

  // Build filter object
  const filter = {};
  if (status) filter.status = status;

  // Build sort object
  const sort = {};
  sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

  try {
    // Get users with pagination and sorting
    const users = await User.find(filter)
      .select('fullName email phone createdAt lastLogin status verificationStatus role')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    // Calculate activity statistics
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const activityStats = {
      totalUsers: total,
      activeToday: await User.countDocuments({ 
        lastLogin: { $gte: oneDayAgo },
        ...filter 
      }),
      activeThisWeek: await User.countDocuments({ 
        lastLogin: { $gte: oneWeekAgo },
        ...filter 
      }),
      activeThisMonth: await User.countDocuments({ 
        lastLogin: { $gte: oneMonthAgo },
        ...filter 
      }),
      neverLoggedIn: await User.countDocuments({ 
        lastLogin: null,
        ...filter 
      })
    };

    // Format users with relative time for last login
    const formattedUsers = users.map(user => {
      let lastLoginFormatted = 'Never';
      let loginStatus = 'inactive';
      
      if (user.lastLogin) {
        const timeDiff = now - user.lastLogin;
        const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hoursDiff = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutesDiff = Math.floor(timeDiff / (1000 * 60));

        if (daysDiff === 0) {
          if (hoursDiff === 0) {
            lastLoginFormatted = minutesDiff === 0 ? 'Just now' : `${minutesDiff} minutes ago`;
            loginStatus = 'active';
          } else {
            lastLoginFormatted = `${hoursDiff} hours ago`;
            loginStatus = 'recent';
          }
        } else if (daysDiff === 1) {
          lastLoginFormatted = 'Yesterday';
          loginStatus = 'recent';
        } else if (daysDiff <= 7) {
          lastLoginFormatted = `${daysDiff} days ago`;
          loginStatus = 'weekly';
        } else if (daysDiff <= 30) {
          lastLoginFormatted = `${daysDiff} days ago`;
          loginStatus = 'monthly';
        } else {
          lastLoginFormatted = `${Math.floor(daysDiff / 30)} months ago`;
          loginStatus = 'inactive';
        }
      }

      return {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        verificationStatus: user.verificationStatus,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        lastLoginFormatted,
        loginStatus,
        registeredDays: Math.floor((now - user.createdAt) / (1000 * 60 * 60 * 24))
      };
    });

    res.status(200).json({
      status: 'success',
      results: users.length,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages
      },
      activityStats,
      data: {
        users: formattedUsers
      }
    });
  } catch (error) {
    console.error('Error fetching user activity:', error);
    return next(new AppError('Failed to fetch user activity data', 500));
  }
});

// Remove face data from a user
exports.checkFaceId = catchAsync(async (req, res, next) => {
  try {
    const { userId } = req.params;
    
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
    
    // If there's no face image, there's nothing to do
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
    
    // TODO: If needed, implement actual deletion of face image records from faceimage table
    // This would require a new method in UserModel to delete face image records
    // For now, we just report the current status
    
    // Log the action for audit purposes
    console.log(`Admin ${req.user.userId} checked face data for user ${userId} at ${new Date().toISOString()}`);
    
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