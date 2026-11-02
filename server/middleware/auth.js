const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const { syncBootstrapAdmin } = require('../utils/admin');
const { accessTo } = require('../utils/team');

const ACCOUNT_BLOCKED = {
  pending: { code: 'ACCOUNT_PENDING', message: 'Your account is waiting for an admin to give it access.' },
  revoked: { code: 'ACCOUNT_REVOKED', message: 'Your access to AttendTrack has been revoked.' }
};

const ACT_AS_HEADER = 'x-act-as';

// allowInactive lets pending and revoked accounts through (only /auth/me uses it,
// so the client can show them where they stand).
// actAs honours the X-Act-As header: a head coach (or a team coach the head allows)
// works in another account. req.user is then that account, so every data route stays
// scoped to req.user; req.authUser is always the signed-in account.
const authenticate = ({ allowInactive = false, actAs = false } = {}) => async (req, res, next) => {
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
    req.authUser = user;
    req.access = 'edit';

    const targetId = actAs && req.headers[ACT_AS_HEADER];
    if (targetId && targetId !== String(user._id)) {
      const target = mongoose.isValidObjectId(targetId) ? await User.findById(targetId) : null;
      const access = accessTo(user, target);
      if (!access) {
        return res.status(403).json({ code: 'ACT_AS_DENIED', message: 'You no longer have access to that account.' });
      }
      if (access === 'view' && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return res.status(403).json({ code: 'VIEW_ONLY', message: `You can view ${target.name}'s data but not change it.` });
      }
      req.user = target;
      req.access = access;
    }

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

// Data routes (athletes, sessions, attendance, tests, export) follow X-Act-As.
const auth = authenticate({ actAs: true });
// Account-level routes (admin, team, finance) always act as the signed-in account.
auth.self = authenticate();
auth.allowInactive = authenticate({ allowInactive: true });

// Use after auth.
auth.requireAdmin = (req, res, next) => {
  if (req.authUser.role !== 'admin') {
    return res.status(403).json({ message: 'Only admins can do that.' });
  }
  next();
};

module.exports = auth;
