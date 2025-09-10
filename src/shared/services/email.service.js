const nodemailer = require('nodemailer');
const AppError = require('../utils/appError');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD
  }
});

exports.sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: options.email,
      subject: options.subject,
      text: options.message,
      html: options.html
    };

    await transporter.sendMail(mailOptions);
  } catch (err) {
    throw new AppError('There was an error sending the email. Try again later!', 500);
  }
};

exports.sendVerificationEmail = async (user, verificationUrl) => {
  const subject = 'Email Verification';
  const message = `Please verify your email by clicking on this link: ${verificationUrl}`;
  
  await this.sendEmail({
    email: user.email,
    subject,
    message
  });
};

exports.sendPasswordResetEmail = async (user, resetUrl) => {
  const subject = 'Password Reset Request';
  const message = `You requested a password reset. Click this link to reset your password: ${resetUrl}`;
  
  await this.sendEmail({
    email: user.email,
    subject,
    message
  });
};