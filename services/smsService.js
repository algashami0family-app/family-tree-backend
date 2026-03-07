const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTP = async (phoneNumber, otp) => {
  const hasTwilio = process.env.TWILIO_ACCOUNT_SID && 
                    process.env.TWILIO_ACCOUNT_SID.startsWith('AC') &&
                    process.env.TWILIO_AUTH_TOKEN &&
                    process.env.TWILIO_PHONE_NUMBER;

  if (!hasTwilio) {
    console.log('='.repeat(50));
    console.log(`OTP للرقم ${phoneNumber}: ${otp}`);
    console.log('='.repeat(50));
    return { success: true, dev: true, otp: otp };
  }

  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body: `رمز التحقق: ${otp}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });
    return { success: true };
  } catch (error) {
    console.error('خطأ SMS:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { generateOTP, sendOTP };
