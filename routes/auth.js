const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_this";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || "7d";

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "name,email,password required" });

    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ error: "User already exists" });

    const hash = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hash, role });
    await user.save();
    res.status(201).json({ message: "User created" });
  } catch (err) {
    console.error("POST /auth/register error", err);
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "email and password required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const payload = {
      id: user._id.toString(),
      role: user.role,
      name: user.name,
      email: user.email,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    const refreshToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });

    // Save refresh token to DB
    user.refreshTokens.push(refreshToken);
    await user.save();

    res.json({ token, refreshToken, user: payload });
  } catch (err) {
    console.error("POST /auth/login error", err);
    res.status(500).json({ error: err.message });
  }
});

// Refresh token
router.post("/token", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(401).json({ error: "Refresh token missing" });

  const user = await User.findOne({ refreshTokens: refreshToken });
  if (!user) return res.status(403).json({ error: "Invalid refresh token" });

  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET);
    const newAccessToken = jwt.sign(
      {
        id: payload.id,
        role: payload.role,
        name: payload.name,
        email: payload.email,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    res.json({ token: newAccessToken });
  } catch (err) {
    return res.status(403).json({ error: "Invalid or expired refresh token" });
  }
});

// Logout
router.post("/logout", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken)
    return res.status(400).json({ error: "Refresh token required" });

  await User.updateOne(
    { refreshTokens: refreshToken },
    { $pull: { refreshTokens: refreshToken } }
  );

  res.json({ message: "Logged out successfully" });
});

module.exports = router;
