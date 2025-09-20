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

exports.sendPromotionalEmail = async ({
  email,
  fullName,
  subject,
  message,
  html
} = {}) => {
  if (!email) {
    throw new AppError('Recipient email is required for promotional messages', 400);
  }

  const greetingName = fullName ? fullName.split(' ')[0] : 'there';
  const resolvedSubject = subject || 'Welcome!';
  const resolvedMessage =
    message ||
    `Hi ${greetingName},\n\nThanks for verifying your account. Keep an eye on your inbox for upcoming updates!`;
  const resolvedHtml =
    html ||
    `<p>Hi ${greetingName},</p><p>Thanks for verifying your account. Keep an eye on your inbox for upcoming updates!</p>`;

  await exports.sendEmail({
    email,
    subject: resolvedSubject,
    message: resolvedMessage,
    html: resolvedHtml
  });
};
