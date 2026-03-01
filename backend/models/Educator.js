const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const educatorSchema = new mongoose.Schema({
  organizationName: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationOTP: String,
  emailVerificationExpires: Date,
  passwordResetOTP: String,
  passwordResetExpires: Date,
  role: { type: String, default: 'educator' }
}, { timestamps: true });

// Hash password before saving
educatorSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
educatorSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Educator', educatorSchema);
