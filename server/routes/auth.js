const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { isBootstrapAdmin, syncBootstrapAdmin, publicUser } = require('../utils/admin');
const { teamSummary } = require('../utils/team');

const router = express.Router();

// Generate JWT token with 30-day expiry
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// Admins also get the number of accounts waiting for access, for the nav badge.
// Active accounts get their team: head coach, access, open requests, accounts they can open.
const userPayload = async (user) => ({
  ...publicUser(user),
  ...(user.role === 'admin' && user.status === 'active'
    ? { pendingCount: await User.countDocuments({ status: 'pending' }) }
    : {}),
  ...(user.status === 'active' ? await teamSummary(user) : {})
});

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email, and password.' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: String(email).trim().toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    // New accounts wait for an admin to give them access (bootstrap admins excepted).
    const admin = isBootstrapAdmin(email);
    const user = await User.create({
      name,
      email,
      password,
      role: admin ? 'admin' : 'coach',
      status: admin ? 'active' : 'pending',
      statusChangedAt: new Date()
    });

    // Generate token
    const token = generateToken(user._id);

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.status(201).json({
      user: await userPayload(user),
      token
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }
    res.status(500).json({ message: error.message || 'Server error during signup.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password.' });
    }

    // Emails are stored lowercase, so match however it was typed or autofilled.
    const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    await syncBootstrapAdmin(user);

    // Generate token
    const token = generateToken(user._id);

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    // Pending and revoked accounts still sign in; the client shows them their status.
    res.json({
      user: await userPayload(user),
      token
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error during login.' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0)
  });
  res.json({ message: 'Logged out successfully.' });
});

// GET /api/auth/me
router.get('/me', auth.allowInactive, async (req, res) => {
  try {
    res.json({ user: await userPayload(req.user) });
  } catch (error) {
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
