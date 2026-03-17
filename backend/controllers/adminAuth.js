// ════════════════════════════════════════════════════════════════════════════
// TODO: Rewrite this controller to use Prisma instead of Mongoose.
//
// Import the Prisma client like this:
//   const prisma = require('../lib/prisma');
//
// The old Mongoose model (Admin) has been removed.
// Use `prisma.user` with `role: 'admin'` for all queries.
//
// Key changes needed:
//   - Admin.findOne({ username })       → prisma.user.findFirst({ where: { username, role: 'admin' } })
//   - Admin.findById(id)               → prisma.user.findUnique({ where: { id } })
//   - Admin.create({...})              → prisma.user.create({ data: {..., role: 'admin' } })
//   - admin._id                        → user.id
//   - Password hashing: use bcrypt.hash(password, 12) before create
//
// Password field mapping:
//   - Old: `password` (Mongoose)
//   - New: `passwordHash` (Prisma) → maps to `password_hash` column
// ════════════════════════════════════════════════════════════════════════════

// ── Placeholder stubs (remove these once you rewrite with Prisma) ──
const notImplemented = (req, res) => {
  res.status(501).json({ error: 'Not implemented yet — rewrite this controller to use Prisma' });
};

exports.loginAdmin = notImplemented;
exports.getAdminProfile = notImplemented;
exports.logoutAdmin = notImplemented;

/*
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

// Generate JWT
const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  });
};

// Admin Login (hardcoded credentials)
exports.loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Hardcoded admin credentials
    const ADMIN_USERNAME = 'DC_Admin';
    const ADMIN_PASSWORD = 'DC_Admin!123';

    if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Find or create admin user
    let admin = await Admin.findOne({ username: ADMIN_USERNAME });
    
    if (!admin) {
      admin = await Admin.create({
        name: 'System Administrator',
        username: ADMIN_USERNAME,
        email: 'admin@dreamcrafters.com',
        password: ADMIN_PASSWORD
      });
    }

    const token = generateToken(admin._id, admin.role);

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
        id: admin._id,
        name: admin.name,
        username: admin.username,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// Get admin profile
exports.getAdminProfile = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      user: req.user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Logout admin
exports.logoutAdmin = async (req, res) => {
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
*/
