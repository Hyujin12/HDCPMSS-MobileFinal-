const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const router = express.Router();
const User = require("../models/User");
const sendVerificationCode = require("../mailer"); // ✅ sends verification code
const JWT_SECRET = process.env.JWT_SECRET;

// -----------------------------
// AUTH MIDDLEWARE
// -----------------------------
const authMiddleware = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token, authorization denied" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};

// -----------------------------
// REGISTER
// -----------------------------
router.post("/register", async (req, res) => {
  try {
    console.log("💡 Incoming request body:", req.body);
    const { username, email, contactNumber, password } = req.body;

    if (!username || !email || !contactNumber || !password) {
      console.warn("⚠️ Missing fields:", { username, email, contactNumber, password });
      return res.status(400).json({ error: "All fields are required" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ error: "Email already registered" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeExpires = new Date(Date.now() + 10 * 60 * 1000);

    const newUser = new User({
      username,
      email,
      contactNumber,
      password: hashedPassword,
      verificationCode,
      codeExpires,
      isVerified: false,
    });

    await newUser.save();

    try {
      await sendVerificationCode(email, verificationCode);
    } catch (emailErr) {
      console.error("❌ Email sending failed:", emailErr);
      return res.status(500).json({ error: "Failed to send verification code" });
    }

    console.log("✅ User created:", newUser._id);
    res.status(201).json({
      message: "Verification code sent to your email",
      userId: newUser._id,
    });
  } catch (err) {
    console.error("Registration Error:", err);
    return res.status(500).json({ error: "Registration failed" });
  }
});

// -----------------------------
// VERIFY EMAIL (OTP)
// -----------------------------
router.post("/verify", async (req, res) => {
  const { userId, code } = req.body;

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isVerified) return res.status(400).json({ message: "User already verified" });
    if (user.verificationCode !== code) return res.status(400).json({ message: "Invalid code" });
    if (user.codeExpires < Date.now()) return res.status(400).json({ message: "Code expired" });

    user.isVerified = true;
    user.verificationCode = null;
    user.codeExpires = null;
    await user.save();

    res.status(200).json({ message: "User verified successfully" });
  } catch (err) {
    console.error("Verification Error:", err.message);
    res.status(500).json({ message: "Verification failed" });
  }
});

// -----------------------------
// LOGIN
// -----------------------------
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid email or password" });

    if (!user.isVerified) {
      return res.status(403).json({
        error: "Please verify your email first",
        userId: user._id,
      });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, {
      expiresIn: "1d",
    });

    res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        contactNumber: user.contactNumber,
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// -----------------------------
// RESEND VERIFICATION CODE
// -----------------------------
router.post("/resend-code", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.isVerified) return res.status(400).json({ error: "User already verified" });

    const newCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.verificationCode = newCode;
    user.codeExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendVerificationCode(email, newCode);
    res.json({ message: "New verification code sent" });
  } catch (err) {
    console.error("Resend code error:", err);
    res.status(500).json({ error: "Failed to resend verification code" });
  }
});

// -----------------------------
// FORGOT PASSWORD
// -----------------------------
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetCode = resetCode;
    user.resetExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    await sendVerificationCode(email, resetCode);
    res.json({ message: "Password reset code sent to your email" });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ error: "Failed to send password reset code" });
  }
});

// -----------------------------
// RESET PASSWORD
// -----------------------------
router.post("/reset-password", async (req, res) => {
  const { email, code, newPassword } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.resetCode !== code) return res.status(400).json({ error: "Invalid code" });
    if (user.resetExpires < Date.now()) return res.status(400).json({ error: "Code expired" });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetCode = null;
    user.resetExpires = null;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    console.error("Reset password error:", err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// -----------------------------
// UPDATE PROFILE
// -----------------------------
router.put("/update-profile", authMiddleware, async (req, res) => {
  const { username, contactNumber } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (username) user.username = username;
    if (contactNumber) user.contactNumber = contactNumber;

    await user.save();
    res.json({ message: "Profile updated successfully", user });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// -----------------------------
// DELETE ACCOUNT
// -----------------------------
router.delete("/delete-account", authMiddleware, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

// -----------------------------
// PROTECTED PROFILE
// -----------------------------
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    console.error("Fetch profile error:", err);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

module.exports = router;
