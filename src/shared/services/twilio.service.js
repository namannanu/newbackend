const twilio = require('twilio');
const AppError = require('../utils/appError');

let twilioClient = null;

const getTwilioConfig = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new AppError(
      'Twilio credentials are not configured. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER environment variables.',
      500
    );
  }

  return { accountSid, authToken, fromNumber };
};

const getClient = () => {
  if (!twilioClient) {
    const { accountSid, authToken } = getTwilioConfig();
    twilioClient = twilio(accountSid, authToken);
  }

  return twilioClient;
};

exports.sendSms = async ({ to, body }) => {
  const { fromNumber } = getTwilioConfig();
  const client = getClient();

  try {
    await client.messages.create({
      body,
      from: fromNumber,
      to
    });
  } catch (error) {
    console.error('Failed to send SMS via Twilio:', error.message);
    throw new AppError('Unable to send SMS at this time. Please try again later.', 500);
  }
};

exports.sendOtp = async ({ to, code }) => {
  const message = `Your verification code is ${code}`;
  await exports.sendSms({ to, body: message });
};

exports.resetClient = () => {
  twilioClient = null;
};
