const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { syncBootstrapAdmin } = require('../utils/admin');

const ACCOUNT_BLOCKED = {
  pending: { code: 'ACCOUNT_PENDING', message: 'Your account is waiting for an admin to give it access.' },
  revoked: { code: 'ACCOUNT_REVOKED', message: 'Your access to AttendTrack has been revoked.' }
};

// allowInactive lets pending and revoked accounts through (only /auth/me uses it,
// so the client can show them where they stand).
const authenticate = ({ allowInactive = false } = {}) => async (req, res, next) => {
  try {
    let token;

    // Check Authorization header first
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Fallback to cookie
    else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authenticated. Please log in.' });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: 'User no longer exists.' });
    }

    await syncBootstrapAdmin(user);

    // Checked on every request, so granting or revoking access takes effect at once.
    if (!allowInactive && user.status !== 'active') {
      const blocked = ACCOUNT_BLOCKED[user.status] || ACCOUNT_BLOCKED.pending;
      return res.status(403).json({ ...blocked, status: user.status });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired. Please log in again.' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token. Please log in again.' });
    }
    return res.status(500).json({ message: 'Authentication error.' });
  }
};

const auth = authenticate();
auth.allowInactive = authenticate({ allowInactive: true });

// Use after auth.
auth.requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only admins can do that.' });
  }
  next();
};

module.exports = auth;
