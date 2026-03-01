const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const { sendVerificationOTP, sendPasswordResetOTP } = require('../utils/email');

// Generate JWT
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  });
};

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Step 1: Request email verification (send OTP)
exports.requestStudentSignup = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if email already exists and is verified
    const existingStudent = await Student.findOne({ email });
    if (existingStudent && existingStudent.isEmailVerified) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Create or update student with OTP
    if (existingStudent) {
      existingStudent.emailVerificationOTP = otp;
      existingStudent.emailVerificationExpires = otpExpires;
      await existingStudent.save();
    } else {
      await Student.create({
        email,
        emailVerificationOTP: otp,
        emailVerificationExpires: otpExpires,
        name: 'Pending',
        username: `temp_${Date.now()}`,
        password: 'temporary'
      });
    }

    // Send OTP email
    await sendVerificationOTP(email, otp, 'student');

    res.status(200).json({
      success: true,
      message: 'Verification OTP sent to your email'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Step 2: Verify OTP
exports.verifyStudentOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const student = await Student.findOne({
      email,
      emailVerificationOTP: otp,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!student) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      email: student.email
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Step 3: Complete signup with details
exports.completeStudentSignup = async (req, res) => {
  try {
    const { email, otp, name, username, password } = req.body;

    if (!email || !otp || !name || !username || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const student = await Student.findOne({
      email,
      emailVerificationOTP: otp,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!student) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Check if username is already taken
    const existingUsername = await Student.findOne({ username });
    if (existingUsername && existingUsername._id.toString() !== student._id.toString()) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Update student details
    student.name = name;
    student.username = username;
    student.password = password;
    student.isEmailVerified = true;
    student.emailVerificationOTP = undefined;
    student.emailVerificationExpires = undefined;
    await student.save();

    // Generate JWT token
    const token = generateToken(student._id, student.role);

    // Send token as HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.status(201).json({
      success: true,
      user: {
        id: student._id,
        name: student.name,
        username: student.username,
        email: student.email,
        role: student.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Login
exports.loginStudent = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const student = await Student.findOne({ username });
    if (!student) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!student.isEmailVerified) {
      return res.status(401).json({ error: 'Please verify your email first' });
    }

    const isPasswordValid = await student.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(student._id, student.role);

    // Send token as HTTP-only cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.status(200).json({
      success: true,
      user: {
        id: student._id,
        name: student.name,
        username: student.username,
        email: student.email,
        role: student.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Get student profile
exports.getStudentProfile = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Logout student
exports.logoutStudent = async (req, res) => {
  try {
    res.cookie('token', '', {
      httpOnly: true,
      expires: new Date(0)
    });
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Request password reset (send OTP)
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const student = await Student.findOne({ email, isEmailVerified: true });
    if (!student) {
      return res.status(404).json({ error: 'No verified account found with this email' });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    student.passwordResetOTP = otp;
    student.passwordResetExpires = otpExpires;
    await student.save();

    // Send OTP email
    await sendPasswordResetOTP(email, otp);

    res.status(200).json({
      success: true,
      message: 'Password reset OTP sent to your email'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Verify password reset OTP
exports.verifyPasswordResetOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const student = await Student.findOne({
      email,
      passwordResetOTP: otp,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!student) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Reset password with OTP
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }

    const student = await Student.findOne({
      email,
      passwordResetOTP: otp,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!student) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Update password
    student.password = newPassword;
    student.passwordResetOTP = undefined;
    student.passwordResetExpires = undefined;
    await student.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Change password (for logged-in users)
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old password and new password are required' });
    }

    const student = await Student.findById(req.user._id);
    if (!student) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify old password
    const isPasswordValid = await student.comparePassword(oldPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update to new password
    student.password = newPassword;
    await student.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
