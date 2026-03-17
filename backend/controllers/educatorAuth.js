// ════════════════════════════════════════════════════════════════════════════
// TODO: Rewrite this controller to use Prisma instead of Mongoose.
//
// Import the Prisma client like this:
//   const prisma = require('../lib/prisma');
//
// The old Mongoose model (Educator) has been removed.
// Use `prisma.user` with `role: 'mentor'` for all queries.
//
// NOTE: The old "educator" role is now "mentor" in the new schema.
// NOTE: The old `organizationName` field is mapped to `name` in the new schema.
//
// Key changes needed:
//   - Educator.findOne({ email })       → prisma.user.findFirst({ where: { email, role: 'mentor' } })
//   - Educator.findById(id)             → prisma.user.findUnique({ where: { id } })
//   - Educator.create({...})            → prisma.user.create({ data: {..., role: 'mentor' } })
//   - educator.save()                   → prisma.user.update({ where: { id }, data: {...} })
//   - educator.comparePassword(pwd)     → bcrypt.compare(pwd, user.passwordHash)
//   - Mongoose pre-save hook for hash   → bcrypt.hash(password, 12) before create/update
//   - educator._id                      → user.id
//   - { $gt: Date.now() }              → { gt: new Date() }  (Prisma filter syntax)
//
// Password field mapping:
//   - Old: `password` (Mongoose)
//   - New: `passwordHash` (Prisma) → maps to `password_hash` column
//
// OTP field mapping:
//   - Old: emailVerificationOTP      → New: emailVerificationOtp
//   - Old: emailVerificationExpires   → New: emailVerificationExpires
//   - Old: passwordResetOTP          → New: passwordResetOtp
//   - Old: passwordResetExpires      → New: passwordResetExpires
//
// Setting a field to undefined (Mongoose) → set to null (Prisma)
// ════════════════════════════════════════════════════════════════════════════

// ── Placeholder stubs (remove these once you rewrite with Prisma) ──
const notImplemented = (req, res) => {
  res.status(501).json({ error: 'Not implemented yet — rewrite this controller to use Prisma' });
};

exports.requestEducatorSignup = notImplemented;
exports.verifyEducatorOTP = notImplemented;
exports.completeEducatorSignup = notImplemented;
exports.loginEducator = notImplemented;
exports.getEducatorProfile = notImplemented;
exports.logoutEducator = notImplemented;
exports.requestPasswordReset = notImplemented;
exports.verifyPasswordResetOTP = notImplemented;
exports.resetPassword = notImplemented;
exports.changePassword = notImplemented;

/*
const jwt = require('jsonwebtoken');
const Educator = require('../models/Educator');
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
exports.requestEducatorSignup = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if email already exists and is verified
    const existingEducator = await Educator.findOne({ email });
    if (existingEducator && existingEducator.isEmailVerified) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Create or update educator with OTP
    if (existingEducator) {
      existingEducator.emailVerificationOTP = otp;
      existingEducator.emailVerificationExpires = otpExpires;
      await existingEducator.save();
    } else {
      await Educator.create({
        email,
        emailVerificationOTP: otp,
        emailVerificationExpires: otpExpires,
        organizationName: 'Pending',
        username: `temp_${Date.now()}`,
        password: 'temporary'
      });
    }

    // Send OTP email
    await sendVerificationOTP(email, otp, 'educator');

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
exports.verifyEducatorOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const educator = await Educator.findOne({
      email,
      emailVerificationOTP: otp,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!educator) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    res.status(200).json({
      success: true,
      message: 'OTP verified successfully',
      email: educator.email
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Step 3: Complete signup with details
exports.completeEducatorSignup = async (req, res) => {
  try {
    const { email, otp, organizationName, username, password } = req.body;

    if (!email || !otp || !organizationName || !username || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const educator = await Educator.findOne({
      email,
      emailVerificationOTP: otp,
      emailVerificationExpires: { $gt: Date.now() }
    });

    if (!educator) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Check if username is already taken
    const existingUsername = await Educator.findOne({ username });
    if (existingUsername && existingUsername._id.toString() !== educator._id.toString()) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Update educator details
    educator.organizationName = organizationName;
    educator.username = username;
    educator.password = password;
    educator.isEmailVerified = true;
    educator.emailVerificationOTP = undefined;
    educator.emailVerificationExpires = undefined;
    await educator.save();

    // Generate JWT token
    const token = generateToken(educator._id, educator.role);

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
        id: educator._id,
        organizationName: educator.organizationName,
        username: educator.username,
        email: educator.email,
        role: educator.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Login
exports.loginEducator = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const educator = await Educator.findOne({ username });
    if (!educator) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!educator.isEmailVerified) {
      return res.status(401).json({ error: 'Please verify your email first' });
    }

    const isPasswordValid = await educator.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(educator._id, educator.role);

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
        id: educator._id,
        organizationName: educator.organizationName,
        username: educator.username,
        email: educator.email,
        role: educator.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Get educator profile
exports.getEducatorProfile = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Logout educator
exports.logoutEducator = async (req, res) => {
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

    const educator = await Educator.findOne({ email, isEmailVerified: true });
    if (!educator) {
      return res.status(404).json({ error: 'No verified account found with this email' });
    }

    // Generate OTP
    const otp = generateOTP();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    educator.passwordResetOTP = otp;
    educator.passwordResetExpires = otpExpires;
    await educator.save();

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

    const educator = await Educator.findOne({
      email,
      passwordResetOTP: otp,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!educator) {
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

    const educator = await Educator.findOne({
      email,
      passwordResetOTP: otp,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!educator) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Update password
    educator.password = newPassword;
    educator.passwordResetOTP = undefined;
    educator.passwordResetExpires = undefined;
    await educator.save();

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

    const educator = await Educator.findById(req.user._id);
    if (!educator) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify old password
    const isPasswordValid = await educator.comparePassword(oldPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Update to new password
    educator.password = newPassword;
    await educator.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
*/
