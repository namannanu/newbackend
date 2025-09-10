const AppError = require('./appError');
const catchAsync = require('./catchAsync');
const permissionValidator = require('./permissionValidator');

module.exports = {
  AppError,
  catchAsync,
  ...permissionValidator
};
