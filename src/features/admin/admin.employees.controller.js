const AWS = require('aws-sdk');
const AdminUser = require('./admin.model');
const User = require('../auth/auth.model');
const AppError = require('../../shared/utils/appError');
const catchAsync = require('../../shared/utils/catchAsync');

// Initialize DynamoDB
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Get all employees
exports.getAllEmployees = catchAsync(async (req, res, next) => {
    console.log('📊 Getting all employees...');

    try {
        // First verify admin permissions
        if (req.user.role !== 'admin') {
            console.log('❌ Unauthorized access attempt to get employees list');
            return next(new AppError('You do not have permission to perform this action', 403));
        }

        const params = {
            TableName: 'Users',
            FilterExpression: '#role = :roleValue',
            ExpressionAttributeNames: {
                '#role': 'role'
            },
            ExpressionAttributeValues: {
                ':roleValue': 'employee'
            }
        };

        console.log('🔍 Scanning Users table with params:', JSON.stringify(params, null, 2));
        
        const result = await dynamoDB.scan(params).promise();
        const employees = result.Items || [];

        // Remove sensitive information
        const sanitizedEmployees = employees.map(emp => {
            const { password, ...employeeWithoutPassword } = emp;
            return employeeWithoutPassword;
        });

        console.log(`✅ Found ${sanitizedEmployees.length} employees`);

        res.status(200).json({
            status: 'success',
            results: sanitizedEmployees.length,
            data: {
                employees: sanitizedEmployees
            }
        });
    } catch (error) {
        console.error('❌ Error fetching employees:', error);
        return next(new AppError(`Failed to fetch employees: ${error.message}`, 500));
    }
});
