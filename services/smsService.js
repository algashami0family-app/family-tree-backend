// خدمة إرسال الرسائل النصية
// في وضع التطوير: يطبع الرمز في Console
// في الإنتاج: يستخدم Twilio

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTP = async (phoneNumber, otp) => {
  // وضع التطوير - طباعة في Console
  if (process.env.NODE_ENV !== 'production' || !process.env.TWILIO_ACCOUNT_SID) {
    console.log('\n' + '='.repeat(50));
    console.log(`📱 [DEV MODE] OTP للرقم ${phoneNumber}: ${otp}`);
    console.log('='.repeat(50) + '\n');
    return { success: true, dev: true };
  }

  // وضع الإنتاج - Twilio
  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

    await client.messages.create({
      body: `رمز التحقق لتطبيق شجرة العائلة: ${otp}\nصالح لمدة 10 دقائق`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    return { success: true };
  } catch (error) {
    console.error('❌ خطأ في إرسال SMS:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = { generateOTP, sendOTP };
