const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

exports.sendVerificationOTP = async (email, otp, userType) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@dreamcrafters.com',
    to: email,
    subject: 'Email Verification OTP - DreamCrafters',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #667eea;">DreamCrafters</h1>
        <h2>Email Verification</h2>
        <p>Your verification code is:</p>
        <div style="background: #f5f7fa; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0;">
          <h1 style="color: #667eea; font-size: 48px; margin: 0; letter-spacing: 8px;">${otp}</h1>
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Verification OTP sent to:', email);
  } catch (err) {
    console.error('Email sending failed:', err);
    throw new Error('Email could not be sent');
  }
};

exports.sendPasswordResetOTP = async (email, otp) => {
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@dreamcrafters.com',
    to: email,
    subject: 'Password Reset OTP - DreamCrafters',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #667eea;">DreamCrafters</h1>
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Your OTP is:</p>
        <div style="background: #f5f7fa; padding: 20px; text-align: center; border-radius: 10px; margin: 20px 0;">
          <h1 style="color: #667eea; font-size: 48px; margin: 0; letter-spacing: 8px;">${otp}</h1>
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p><strong>If you didn't request this, please ignore this email and your password will remain unchanged.</strong></p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Password reset OTP sent to:', email);
  } catch (err) {
    console.error('Email sending failed:', err);
    throw new Error('Email could not be sent');
  }
};
