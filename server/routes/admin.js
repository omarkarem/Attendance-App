const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Athlete = require('../models/Athlete');
const auth = require('../middleware/auth');
const { isBootstrapAdmin } = require('../utils/admin');

const router = express.Router();

// Every route here is admin only.
router.use(auth.self, auth.requireAdmin);

const accountView = (user, athleteCounts) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  statusChangedAt: user.statusChangedAt,
  createdAt: user.createdAt,
  athleteCount: athleteCounts.get(String(user._id)) || 0,
  // Set by ADMIN_EMAILS, so the app cannot demote or revoke it.
  locked: isBootstrapAdmin(user.email)
});

const countAthletes = async (ids) => {
  const rows = await Athlete.aggregate([
    { $match: { coach: { $in: ids } } },
    { $group: { _id: '$coach', count: { $sum: 1 } } }
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
};

// Loads the target account and refuses changes to yourself or to a locked admin.
const loadTarget = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(404).json({ message: 'Account not found.' });
    return null;
  }
  const user = await User.findById(req.params.id);
  if (!user) {
    res.status(404).json({ message: 'Account not found.' });
    return null;
  }
  if (user._id.equals(req.user._id)) {
    res.status(400).json({ message: 'You cannot change your own account here.' });
    return null;
  }
  if (isBootstrapAdmin(user.email)) {
    res.status(400).json({ message: 'This admin is set in the server settings (ADMIN_EMAILS) and cannot be changed here.' });
    return null;
  }
  return user;
};

// GET /api/admin/users - Every account, newest first
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    const counts = await countAthletes(users.map((u) => u._id));
    res.json(users.map((u) => accountView(u, counts)));
  } catch (error) {
    res.status(500).json({ message: 'Could not load accounts.' });
  }
});

// PATCH /api/admin/users/:id - Change access ({ status }) and/or role ({ role })
router.patch('/users/:id', async (req, res) => {
  try {
    const { status, role } = req.body;
    if (status !== undefined && !['active', 'revoked'].includes(status)) {
      return res.status(400).json({ message: 'Access can only be granted or revoked.' });
    }
    if (role !== undefined && !['coach', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Role must be coach or admin.' });
    }
    if (status === undefined && role === undefined) {
      return res.status(400).json({ message: 'Nothing to change.' });
    }

    const user = await loadTarget(req, res);
    if (!user) return;

    if (status !== undefined && status !== user.status) {
      user.status = status;
      user.statusChangedAt = new Date();
    }
    if (role !== undefined) {
      if (role === 'admin' && user.status !== 'active') {
        return res.status(400).json({ message: 'Give the account access before making it an admin.' });
      }
      user.role = role;
    }
    // An admin without access would be a contradiction.
    if (user.status !== 'active') user.role = 'coach';

    await user.save();
    const counts = await countAthletes([user._id]);
    res.json(accountView(user, counts));
  } catch (error) {
    res.status(500).json({ message: 'Could not update the account.' });
  }
});

// DELETE /api/admin/users/:id - Decline a sign-up. Only pending accounts, which cannot have data yet.
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await loadTarget(req, res);
    if (!user) return;
    if (user.status !== 'pending') {
      return res.status(400).json({ message: 'Only accounts waiting for access can be deleted. Revoke access instead.' });
    }
    await user.deleteOne();
    res.json({ message: 'Account deleted.' });
  } catch (error) {
    res.status(500).json({ message: 'Could not delete the account.' });
  }
});

module.exports = router;
