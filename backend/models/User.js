const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  contactNumber: { type: String, required: true, trim: true },
  password: { type: String, required: true },

  // ✅ Verification for registration
  isVerified: { type: Boolean, default: false },
  verificationCode: { type: String },
  codeExpires: { type: Date },

  // ✅ Password reset fields
  resetCode: { type: String },
  resetExpires: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
